import { Router, Request, Response } from 'express';
import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { calculateLevel, calculateRank } from '../progression.js';
import { weekStart } from './leaderboard.js';

// Friends: follow hunters by their Hunter name and compete on weekly XP.
// Same privacy as the public leaderboard — only hunters who chose a name and
// haven't opted out can be found; only name, level/rank and weekly XP show.
const router = Router();
router.use(authenticateToken);

const MAX_FRIENDS = 100;

// GET /api/friends — you + the hunters you follow, ranked by this week's XP
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const since = weekStart();
    const r = await pool.query(
      `WITH circle AS (
         SELECT $1::int AS id
         UNION SELECT f.followee_id FROM friendships f JOIN users u ON u.id = f.followee_id
           WHERE f.follower_id = $1 AND u.name_set AND u.show_on_leaderboard
       ),
       week AS (
         SELECT user_id, SUM(xp)::int AS xp FROM (
           SELECT user_id, COALESCE(xp_awarded, 0) AS xp FROM quest_completions WHERE completion_date >= $2::date AND user_id IN (SELECT id FROM circle)
           UNION ALL
           SELECT user_id, COALESCE(xp_awarded, 0) FROM unplanned_activities WHERE status = 'accepted' AND resolved_at >= $2::date AND user_id IN (SELECT id FROM circle)
         ) e GROUP BY user_id
       )
       SELECT u.id, u.name, u.xp, COALESCE(w.xp, 0) AS weekly,
              (SELECT MAX(completion_date)::text FROM quest_completions WHERE user_id = u.id) AS last_active
       FROM circle c JOIN users u ON u.id = c.id LEFT JOIN week w ON w.user_id = u.id
       ORDER BY weekly DESC, u.id`,
      [userId, since],
    );
    res.json({
      weekStart: since,
      friends: r.rows.map((x: any, i: number) => ({
        position: i + 1,
        name: x.name,
        weeklyXp: x.weekly,
        level: calculateLevel(x.xp),
        rank: calculateRank(x.xp),
        lastActive: x.last_active,
        isMe: x.id === userId,
      })),
    });
  } catch (error) {
    console.error('Error fetching friends:', error);
    res.status(500).json({ error: 'Failed to fetch friends' });
  }
});

// POST /api/friends { name } — follow a hunter by Hunter name (case-insensitive)
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    if (!name) return res.status(400).json({ error: 'Enter a Hunter name' });
    const target = (await pool.query(
      'SELECT id, name FROM users WHERE LOWER(name) = LOWER($1) AND name_set AND show_on_leaderboard',
      [name],
    )).rows[0];
    if (!target) return res.status(404).json({ error: 'No hunter with that name' });
    if (target.id === userId) return res.status(400).json({ error: "That's you!" });
    const count = await pool.query('SELECT COUNT(*)::int AS n FROM friendships WHERE follower_id = $1', [userId]);
    if (count.rows[0].n >= MAX_FRIENDS) return res.status(400).json({ error: `You can follow up to ${MAX_FRIENDS} hunters` });
    await pool.query(
      'INSERT INTO friendships (follower_id, followee_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [userId, target.id],
    );
    res.status(201).json({ name: target.name });
  } catch (error) {
    console.error('Error adding friend:', error);
    res.status(500).json({ error: 'Failed to add friend' });
  }
});

// DELETE /api/friends/:name — unfollow
router.delete('/:name', async (req: Request, res: Response) => {
  try {
    const r = await pool.query(
      `DELETE FROM friendships f USING users u
       WHERE f.follower_id = $1 AND f.followee_id = u.id AND LOWER(u.name) = LOWER($2)`,
      [req.user!.id, req.params.name],
    );
    if (!r.rowCount) return res.status(404).json({ error: 'Not following that hunter' });
    res.json({ message: 'Unfollowed' });
  } catch (error) {
    console.error('Error removing friend:', error);
    res.status(500).json({ error: 'Failed to remove friend' });
  }
});

export default router;
