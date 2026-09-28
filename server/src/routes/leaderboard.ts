import { Router, Request, Response } from 'express';
import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { calculateLevel, calculateRank } from '../progression.js';

// Leaderboard (shown on the Rank page). Only hunters who chose a Hunter name
// and haven't opted out appear, and only by that name — never by username.
//  - week: XP *earned* since Monday 00:00 UTC (quest completions + accepted
//    unplanned activities, both already capped by the XP rules)
//  - all:  total XP
const router = Router();
router.use(authenticateToken);

/** Monday 00:00 UTC of the current week, as YYYY-MM-DD. */
export function weekStart(now = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().split('T')[0];
}

// GET /api/leaderboard?period=week|all
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const period = req.query.period === 'all' ? 'all' : 'week';
    const since = weekStart();
    const scores = period === 'all'
      ? `SELECT id AS user_id, xp AS score FROM users`
      : `SELECT user_id, SUM(xp)::int AS score FROM (
           SELECT user_id, COALESCE(xp_awarded, 0) AS xp FROM quest_completions WHERE completion_date >= $2::date
           UNION ALL
           SELECT user_id, COALESCE(xp_awarded, 0) FROM unplanned_activities WHERE status = 'accepted' AND resolved_at >= $2::date
         ) e GROUP BY user_id`;
    const r = await pool.query(
      `WITH s AS (${scores}),
       ranked AS (
         SELECT u.id, u.name, u.xp, s.score::int AS score, RANK() OVER (ORDER BY s.score DESC) AS pos
         FROM s JOIN users u ON u.id = s.user_id
         WHERE u.name_set AND u.show_on_leaderboard AND s.score > 0
       )
       SELECT * FROM ranked WHERE pos <= 50 OR id = $1 ORDER BY pos, id`,
      period === 'all' ? [userId] : [userId, since],
    );
    const me = (await pool.query('SELECT name_set, show_on_leaderboard FROM users WHERE id = $1', [userId])).rows[0];
    const mine = r.rows.find((x: any) => x.id === userId);
    let myScore = mine?.score;
    if (myScore === undefined) {
      const own = await pool.query(
        period === 'all' ? 'SELECT xp AS score FROM users WHERE id = $1'
          : `SELECT (COALESCE((SELECT SUM(xp_awarded) FROM quest_completions WHERE user_id = $1 AND completion_date >= $2::date), 0)
                   + COALESCE((SELECT SUM(xp_awarded) FROM unplanned_activities WHERE user_id = $1 AND status = 'accepted' AND resolved_at >= $2::date), 0))::int AS score`,
        period === 'all' ? [userId] : [userId, since],
      );
      myScore = own.rows[0]?.score ?? 0;
    }
    res.json({
      period,
      weekStart: since,
      entries: r.rows.filter((x: any) => Number(x.pos) <= 50).map((x: any) => ({
        position: Number(x.pos),
        name: x.name,
        score: x.score,
        level: calculateLevel(x.xp),
        rank: calculateRank(x.xp),
        isMe: x.id === userId,
      })),
      me: {
        score: myScore,
        position: mine ? Number(mine.pos) : null,
        visible: !!me?.show_on_leaderboard,
        nameSet: !!me?.name_set,
      },
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// PATCH /api/leaderboard/visibility { visible: boolean }
router.patch('/visibility', async (req: Request, res: Response) => {
  try {
    if (typeof req.body.visible !== 'boolean') return res.status(400).json({ error: 'visible must be true or false' });
    await pool.query('UPDATE users SET show_on_leaderboard = $1, updated_at = NOW() WHERE id = $2', [req.body.visible, req.user!.id]);
    res.json({ visible: req.body.visible });
  } catch (error) {
    console.error('Error updating leaderboard visibility:', error);
    res.status(500).json({ error: 'Failed to update visibility' });
  }
});

export default router;
