import { Router, Request, Response } from 'express';
import { pool } from '../db.js';
import { hit } from '../middleware/security.js';
import { calculateLevel, calculateRank } from '../progression.js';
import { weekStart } from './leaderboard.js';
import { currentStreak, isValidTimeZone, localDate } from '../time.js';

// Public hunter profiles (/h/<name>) — the landing page for shared cards and
// invite links. Same privacy as the leaderboard: only hunters who chose a name
// and haven't opted out, and only name, level/rank, streak and XP totals.
const router = Router();

// GET /api/public/hunters/:name
router.get('/hunters/:name', async (req: Request, res: Response) => {
  if (hit(`public-profile:${req.ip}`, 120, 60_000)) return res.status(429).json({ error: 'Too many requests' });
  try {
    const u = (await pool.query(
      `SELECT u.id, u.name, u.xp, u.created_at, r.timezone FROM users u LEFT JOIN routines r ON r.user_id = u.id
       WHERE LOWER(u.name) = LOWER($1) AND u.name_set AND u.show_on_leaderboard`,
      [String(req.params.name).slice(0, 30)],
    )).rows[0];
    if (!u) return res.status(404).json({ error: 'No hunter with that name' });
    const tz = u.timezone && isValidTimeZone(u.timezone) ? u.timezone : 'UTC';
    const [days, week, modules] = await Promise.all([
      pool.query(`SELECT DISTINCT completion_date::text AS d FROM quest_completions WHERE user_id = $1 AND completion_date >= CURRENT_DATE - 400`, [u.id]),
      pool.query(
        `SELECT COALESCE(SUM(xp), 0)::int AS xp FROM (
           SELECT COALESCE(xp_awarded, 0) AS xp FROM quest_completions WHERE user_id = $1 AND completion_date >= $2::date
           UNION ALL
           SELECT COALESCE(xp_awarded, 0) FROM unplanned_activities WHERE user_id = $1 AND status = 'accepted' AND resolved_at >= $2::date
         ) e`,
        [u.id, weekStart()],
      ),
      pool.query(`SELECT icon, name FROM user_modules WHERE user_id = $1 AND status = 'active' ORDER BY id LIMIT 8`, [u.id]),
    ]);
    res.set('Cache-Control', 'public, max-age=60');
    res.json({
      name: u.name,
      level: calculateLevel(u.xp),
      rank: calculateRank(u.xp),
      xp: u.xp,
      weeklyXp: week.rows[0].xp,
      streak: currentStreak(new Set(days.rows.map((r: any) => r.d)), localDate(tz)),
      modules: modules.rows.map((m: any) => `${m.icon} ${m.name}`),
      joined: u.created_at,
    });
  } catch (error) {
    console.error('Public profile error:', error);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

export default router;
