import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "../db.js";
import { authenticateToken, jwtSecret } from "../middleware/auth.js";
import { logActivity } from "../activity.js";
import { calculateLevel, calculateRank } from "../progression.js";
import { LIMITS, blockedFor, clearKey, hit, tooMany } from "../middleware/security.js";

const router = Router();

// Sessions last 7 days and slide: every app open (GET /me) renews the cookie.
const SESSION_DAYS = 7;
const JWT_EXPIRES_IN = `${SESSION_DAYS}d`;
const RENEW_AFTER_MS = 24 * 60 * 60 * 1000;

/**
 * Build cookie options for the JWT auth cookie.
 *
 * When the frontend and API are hosted on different sites (e.g. a Vercel
 * frontend calling this API on Render), the request is cross-site. Browsers
 * reject `SameSite=strict` cookies in that context, so the token never gets
 * stored and every authenticated request fails with 401 "Access denied.
 * No token provided.". We therefore use `SameSite=None; Secure` for
 * non-localhost hosts (the API is always served over HTTPS there) and fall
 * back to `Lax` for local development over plain HTTP.
 */
function getAuthCookieOptions(req: Request) {
  const host = (req.hostname || "").toLowerCase();
  const isLocal =
    host === "localhost" || host === "127.0.0.1" || host.endsWith(".localhost");

  return {
    httpOnly: true,
    // SameSite=None is only accepted together with the Secure attribute.
    secure: !isLocal,
    sameSite: (isLocal ? "lax" : "none") as "lax" | "none",
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000, // matches JWT_EXPIRES_IN
  };
}

/** Sign a session JWT and set it as the auth cookie. */
function issueSession(req: Request, res: Response, user: { id: number; username: string }) {
  const token = jwt.sign({ id: user.id, username: user.username }, jwtSecret(), { expiresIn: JWT_EXPIRES_IN });
  res.cookie("token", token, getAuthCookieOptions(req));
}

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post("/register", async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    const wait = hit(`register:${req.ip}`, LIMITS.registrations.max, LIMITS.registrations.windowMs);
    if (wait) return tooMany(res, wait, "sign-ups from this network");

    // Validate input
    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Username and password are required" });
    }

    if (username.length < 3) {
      return res
        .status(400)
        .json({ error: "Username must be at least 3 characters" });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters" });
    }

    // Check if user already exists
    const existing = await pool.query(
      "SELECT id FROM users WHERE username = $1",
      [username],
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Username already exists" });
    }

    // Hash password with bcrypt (10 rounds)
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Insert user
    const result = await pool.query(
      `INSERT INTO users (username, password_hash, name)
       VALUES ($1, $2, $3) RETURNING id, username, name, created_at`,
      [username, password_hash, username],
    );

    const user = result.rows[0];

    // Invite link (/login?invite=<Hunter name>): the new hunter and the inviter
    // follow each other so they race on weekly XP from day one. No XP reward, so
    // fake sign-ups gain nothing.
    const invite = typeof req.body.invite === "string" ? req.body.invite.trim().slice(0, 30) : "";
    if (invite) {
      await pool.query(
        `INSERT INTO friendships (follower_id, followee_id)
         SELECT a, b FROM users t, LATERAL (VALUES ($1::int, t.id), (t.id, $1::int)) v(a, b)
         WHERE LOWER(t.name) = LOWER($2) AND t.name_set AND t.show_on_leaderboard AND t.id <> $1
         ON CONFLICT DO NOTHING`,
        [user.id, invite],
      ).catch((e) => console.error("Invite follow failed:", e));
    }

    issueSession(req, res, user);

    await logActivity(user.id, "register", user.username);

    res.status(201).json({
      message: "User registered successfully",
      user: { id: user.id, username: user.username, name: user.name },
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ error: "Failed to register user" });
  }
});

/**
 * POST /api/auth/login
 * Login with username and password
 */
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Username and password are required" });
    }

    // Brute-force protection: too many failed attempts for this account from
    // this network → temporarily locked (successful logins reset the count).
    const failKey = `login-fail:${req.ip}:${String(username).toLowerCase()}`;
    const locked = blockedFor(failKey, LIMITS.failedLogins.max);
    if (locked) return tooMany(res, locked, "failed login attempts");

    // Find user
    const result = await pool.query("SELECT * FROM users WHERE username = $1", [
      username,
    ]);
    const user = result.rows[0];

    // Compare password with hash
    const isValid = user ? await bcrypt.compare(password, user.password_hash) : false;

    if (!isValid) {
      hit(failKey, LIMITS.failedLogins.max, LIMITS.failedLogins.windowMs);
      return res.status(401).json({ error: "Invalid credentials" });
    }
    clearKey(failKey);

    issueSession(req, res, user);

    await logActivity(user.id, "login", user.username);

    res.json({
      message: "Login successful",
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Failed to login" });
  }
});

/**
 * POST /api/auth/logout
 * Clear the JWT cookie
 */
router.post("/logout", (req: Request, res: Response) => {
  // Match the attributes used when setting the cookie so the browser
  // reliably removes it in every deployment context.
  const cookieOptions = getAuthCookieOptions(req);
  res.clearCookie("token", {
    httpOnly: cookieOptions.httpOnly,
    secure: cookieOptions.secure,
    sameSite: cookieOptions.sameSite,
  });
  res.json({ message: "Logged out successfully" });
});

/**
 * GET /api/auth/me
 * Get current user info (requires authentication)
 */
router.get("/me", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    const result = await pool.query(
      `SELECT id, username, name, name_set, rank, xp, hp, mp, str, agi, vit, int, sen, created_at
       FROM users WHERE id = $1`,
      [userId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = result.rows[0];

    // Sliding session: renew the cookie when the token is more than a day old.
    const iat = (jwt.decode(req.cookies?.token) as { iat?: number } | null)?.iat;
    if (iat && Date.now() - iat * 1000 > RENEW_AFTER_MS) issueSession(req, res, user);

    // Remove password hash from response, and report the live rank/level
    // computed from XP (the stored rank column is only a registration default)
    const { password_hash: _passwordHash, ...userWithoutPassword } = user;

    res.json({
      user: {
        ...userWithoutPassword,
        rank: calculateRank(user.xp),
        level: calculateLevel(user.xp),
      },
    });
  } catch (error) {
    console.error("Get me error:", error);
    res.status(500).json({ error: "Failed to get user info" });
  }
});

/**
 * POST /api/auth/set-name
 * Set hunter name once (cannot be changed after)
 */
router.post(
  "/set-name",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      const { name } = req.body;

      if (!name || name.trim().length < 2) {
        return res
          .status(400)
          .json({ error: "Name must be at least 2 characters" });
      }

      if (name.trim().length > 30) {
        return res
          .status(400)
          .json({ error: "Name must be 30 characters or less" });
      }

      // Check if name is already set
      const existing = await pool.query(
        "SELECT name_set FROM users WHERE id = $1",
        [userId],
      );
      if (existing.rows.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      if (existing.rows[0].name_set) {
        return res
          .status(403)
          .json({
            error: "Hunter name has already been set and cannot be changed",
          });
      }

      // Check if name is already taken by another user
      const nameCheck = await pool.query(
        "SELECT id FROM users WHERE LOWER(name) = LOWER($1) AND id != $2",
        [name.trim(), userId],
      );
      if (nameCheck.rows.length > 0) {
        return res
          .status(409)
          .json({ error: "This hunter name is already taken" });
      }

      // Set the name
      await pool.query(
        "UPDATE users SET name = $1, name_set = true, updated_at = NOW() WHERE id = $2",
        [name.trim(), userId],
      );

      await logActivity(userId, "set_name", name.trim());

      res.json({
        message: "Hunter name set successfully",
        name: name.trim(),
      });
    } catch (error) {
      console.error("Set name error:", error);
      res.status(500).json({ error: "Failed to set hunter name" });
    }
  },
);

/** Re-check the signed-in hunter's password (rate-limited like logins). */
async function verifyPassword(req: Request, res: Response, password: unknown): Promise<any | null> {
  const userId = req.user!.id;
  const failKey = `password-check:${userId}`;
  const locked = blockedFor(failKey, LIMITS.failedLogins.max);
  if (locked) {
    tooMany(res, locked, "incorrect password attempts");
    return null;
  }
  const user = (await pool.query("SELECT * FROM users WHERE id = $1", [userId])).rows[0];
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return null;
  }
  if (typeof password !== "string" || !(await bcrypt.compare(password, user.password_hash))) {
    hit(failKey, LIMITS.failedLogins.max, LIMITS.failedLogins.windowMs);
    res.status(401).json({ error: "Current password is incorrect" });
    return null;
  }
  clearKey(failKey);
  return user;
}

/**
 * POST /api/auth/change-password { currentPassword, newPassword }
 */
router.post("/change-password", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (typeof newPassword !== "string" || newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters" });
    }
    const user = await verifyPassword(req, res, currentPassword);
    if (!user) return;
    if (await bcrypt.compare(newPassword, user.password_hash)) {
      return res.status(400).json({ error: "New password must be different from the current one" });
    }
    await pool.query("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2", [await bcrypt.hash(newPassword, 10), user.id]);
    await logActivity(user.id, "password_change", user.username);
    issueSession(req, res, user);
    res.json({ message: "Password updated" });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ error: "Failed to change password" });
  }
});

/**
 * GET /api/auth/export — everything Hunter stores about the signed-in hunter,
 * as a downloadable JSON file (data portability). Never includes the password
 * hash or other users' private data (friends are listed by Hunter name only).
 */
router.get("/export", authenticateToken, async (req: Request, res: Response) => {
  try {
    const id = req.user!.id;
    const q = async (sql: string) => (await pool.query(sql, [id])).rows;
    const [user] = await q(
      `SELECT id, username, name, name_set, xp, hp, mp, str, agi, vit, int, sen, show_on_leaderboard, created_at, updated_at FROM users WHERE id = $1`,
    );
    if (!user) return res.status(404).json({ error: "User not found" });
    const data = {
      exportedAt: new Date().toISOString(),
      format: "hunter-system-export/v1",
      profile: { ...user, level: calculateLevel(user.xp), rank: calculateRank(user.xp) },
      routine: (await q(`SELECT items, timezone, confirmed_at, updated_at FROM routines WHERE user_id = $1`))[0] ?? null,
      modules: await q(`SELECT slug, name, icon, kind, status, goals, created_at FROM user_modules WHERE user_id = $1 ORDER BY id`),
      customTasks: await q(`SELECT quest_id, title, category, difficulty, xp_reward, schedule_time, time_of_day, recurrence, metadata, archived, created_at FROM quests WHERE user_id = $1 ORDER BY id`),
      completions: await q(
        `SELECT q.quest_id, q.title, qc.completion_date, qc.xp_awarded, qc.completed_at
         FROM quest_completions qc JOIN quests q ON q.id = qc.quest_id WHERE qc.user_id = $1 ORDER BY qc.completed_at`,
      ),
      xpHistory: await q(`SELECT action, entity, details, created_at FROM activity_log WHERE user_id = $1 ORDER BY created_at, id`),
      unplannedActivities: await q(`SELECT description, analysis, source, status, xp_awarded, created_at FROM unplanned_activities WHERE user_id = $1 ORDER BY id`),
      contentChannels: await q(`SELECT name, platform, category, status, posting_frequency, target_per_week, created_at FROM content_channels WHERE user_id = $1 ORDER BY id`),
      nutritionLogs: await q(`SELECT log_date, food_name, protein, cost FROM nutrition_logs WHERE user_id = $1 ORDER BY log_date, id`),
      penalties: await q(`SELECT penalty_date, missed_days, broken_streak, xp_lost, hp_lost, recovered FROM penalties WHERE user_id = $1 ORDER BY penalty_date`),
      gameState: (await q(`SELECT state, updated_at FROM user_state WHERE user_id = $1`))[0] ?? null,
      coachReviews: await q(`SELECT week_start, review, created_at FROM coach_reviews WHERE user_id = $1 ORDER BY week_start`),
      following: (await q(`SELECT u.name FROM friendships f JOIN users u ON u.id = f.followee_id WHERE f.follower_id = $1 ORDER BY u.name`)).map((r: any) => r.name),
    };
    await logActivity(id, "data_export", user.username);
    res.setHeader("Content-Disposition", `attachment; filename="hunter-export-${user.username}.json"`);
    res.json(data);
  } catch (error) {
    console.error("Export error:", error);
    res.status(500).json({ error: "Failed to export data" });
  }
});

/**
 * DELETE /api/auth/account { password, confirm } — confirm must equal the username.
 * Permanently deletes the hunter and all their data.
 */
router.delete("/account", authenticateToken, async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const user = await verifyPassword(req, res, req.body?.password);
    if (!user) return;
    if (req.body?.confirm !== user.username) {
      return res.status(400).json({ error: "Type your username to confirm" });
    }
    await client.query("BEGIN");
    // These two tables reference users without ON DELETE CASCADE.
    await client.query("DELETE FROM rank_history WHERE user_id = $1", [user.id]);
    await client.query("DELETE FROM daily_stats WHERE user_id = $1", [user.id]);
    await client.query("DELETE FROM users WHERE id = $1", [user.id]); // everything else cascades
    await client.query("COMMIT");
    const cookieOptions = getAuthCookieOptions(req);
    res.clearCookie("token", { httpOnly: cookieOptions.httpOnly, secure: cookieOptions.secure, sameSite: cookieOptions.sameSite });
    res.json({ message: "Account deleted" });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Delete account error:", error);
    res.status(500).json({ error: "Failed to delete account" });
  } finally {
    client.release();
  }
});

export default router;
