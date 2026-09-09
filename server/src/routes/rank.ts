import { Router, Request, Response } from "express";
import { pool } from "../db.js";
import { authenticateToken } from "../middleware/auth.js";
import {
  calculateLevel,
  levelThreshold,
  RANK_THRESHOLDS,
} from "../progression.js";

const router = Router();

// GET /api/rank - Get current rank and progression
router.get("/", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userResult = await pool.query("SELECT * FROM users WHERE id = $1", [
      req.user?.id,
    ]);
    const user = userResult.rows[0];

    if (!user) {
      return res.status(404).json({ error: "No user found" });
    }

    const RANK_COLORS: Record<string, string> = {
      E: "#8A92B2",
      D: "#3498DB",
      C: "#5D26C1",
      B: "#8E2DE2",
      A: "#F1C40F",
      S: "#F1C40F",
    };
    const ranks = RANK_THRESHOLDS.map((t, i) => ({
      name: t.rank,
      minXP: t.minXP,
      maxXP:
        i + 1 < RANK_THRESHOLDS.length
          ? RANK_THRESHOLDS[i + 1].minXP
          : Number.MAX_SAFE_INTEGER,
      color: RANK_COLORS[t.rank],
    }));

    const currentRank =
      ranks.find((r) => user.xp >= r.minXP && user.xp < r.maxXP) || ranks[0];
    const nextRankIndex = ranks.indexOf(currentRank) + 1;
    const nextRank = nextRankIndex < ranks.length ? ranks[nextRankIndex] : null;

    let progress = 0;
    if (nextRank) {
      progress =
        ((user.xp - currentRank.minXP) / (nextRank.minXP - currentRank.minXP)) *
        100;
    } else {
      progress = 100;
    }

    // Get rank history (scoped to this user)
    const history = await pool.query(
      "SELECT * FROM rank_history WHERE user_id = $1 ORDER BY achieved_at DESC LIMIT 10",
      [req.user?.id],
    );

    res.json({
      user: {
        name: user.name,
        rank: currentRank.name,
        xp: user.xp,
        level: calculateLevel(user.xp),
      },
      currentRank: {
        ...currentRank,
        progress: Math.min(progress, 100),
      },
      nextRank: nextRank
        ? {
            ...nextRank,
            xpRequired: nextRank.minXP,
          }
        : null,
      history: history.rows,
    });
  } catch (error) {
    console.error("Error fetching rank:", error);
    res.status(500).json({ error: "Failed to fetch rank" });
  }
});

// GET /api/rank/levels - Get level progression
router.get(
  "/levels",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const userResult = await pool.query(
        "SELECT xp FROM users WHERE id = $1",
        [req.user?.id],
      );
      const user = userResult.rows[0];

      if (!user) {
        return res.status(404).json({ error: "No user found" });
      }

      const levels = [];
      const currentLevel = calculateLevel(user.xp);
      // Infinite progression: always show well past the current level, never capped
      const maxLevel = Math.max(currentLevel + 10, 12);

      for (let i = 1; i <= maxLevel; i++) {
        const levelXP = levelThreshold(i);
        const prevLevelXP = levelThreshold(Math.max(i - 1, 1));
        const isCompleted = user.xp >= levelXP;
        const progress = isCompleted
          ? 100
          : ((user.xp - prevLevelXP) / (levelXP - prevLevelXP)) * 100;

        levels.push({
          level: i,
          xpRequired: levelXP,
          isCompleted,
          progress: Math.min(Math.max(progress, 0), 100),
          isCurrent: i === currentLevel,
        });
      }

      res.json({ levels, currentLevel });
    } catch (error) {
      console.error("Error fetching levels:", error);
      res.status(500).json({ error: "Failed to fetch levels" });
    }
  },
);

export default router;
