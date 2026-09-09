import { Router, Request, Response } from 'express';
import { pool } from '../db.js';

const router = Router();

// GET /api/stats - Get all stats
router.get('/', async (req: Request, res: Response) => {
  try {
    const userResult = await pool.query('SELECT * FROM users WHERE id = 1');
    const user = userResult.rows[0] || null;

    if (!user) {
      return res.status(404).json({ error: 'No user found' });
    }

    // Get today's stats
    const today = new Date().toISOString().split('T')[0];
    const todayStats = await pool.query(
      `SELECT COALESCE(SUM(q.xp_reward), 0) as daily_xp,
              COUNT(qc.id) as quests_completed
       FROM quest_completions qc
       JOIN quests q ON qc.quest_id = q.id
       WHERE qc.completion_date = $1`,
      [today]
    );

    // Get weekly stats
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weeklyStats = await pool.query(
      `SELECT COALESCE(SUM(q.xp_reward), 0) as weekly_xp,
              COUNT(DISTINCT qc.completion_date) as active_days,
              COUNT(qc.id) as total_quests
       FROM quest_completions qc
       JOIN quests q ON qc.quest_id = q.id
       WHERE qc.completion_date >= $1`,
      [weekAgo.toISOString().split('T')[0]]
    );

    // Get streak
    const streakResult = await pool.query(`
      WITH date_series AS (
        SELECT generate_series(
          (SELECT MAX(completion_date) FROM quest_completions),
          CURRENT_DATE,
          INTERVAL '1 day'
        )::date AS date
      ),
      completed_dates AS (
        SELECT DISTINCT completion_date FROM quest_completions
      )
      SELECT COUNT(*) as streak
      FROM date_series ds
      JOIN completed_dates cd ON ds.date = cd.completion_date
      WHERE ds.date <= CURRENT_DATE
      ORDER BY ds.date DESC
      LIMIT 7
    `);

    const streak = streakResult.rows.length > 0 ? streakResult.rows.length : 0;

    res.json({
      user,
      daily: todayStats.rows[0],
      weekly: weeklyStats.rows[0],
      streak,
      rank: calculateRank(user.xp),
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// PATCH /api/stats - Update user stats
router.patch('/', async (req: Request, res: Response) => {
  try {
    const updates = req.body;
    const allowedFields = ['hp', 'mp', 'str', 'agi', 'vit', 'int', 'sen'];
    const setClauses = allowedFields
      .filter(f => updates[f] !== undefined)
      .map((f, i) => `${f} = $${i + 1}`)
      .join(', ');
    const values = allowedFields.filter(f => updates[f] !== undefined).map(f => updates[f]);

    if (setClauses) {
      values.push(...[1, ...Array.from({ length: setClauses.split(',').length }, (_, i) => i + 1)].slice(0, values.length + 1));
      await pool.query(`UPDATE users SET ${setClauses}, updated_at = NOW() WHERE id = 1`, values.slice(0, setClauses.split(',').length));
    }

    const result = await pool.query('SELECT * FROM users WHERE id = 1');
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating stats:', error);
    res.status(500).json({ error: 'Failed to update stats' });
  }
});

// GET /api/stats/history - Get stat history for charts
router.get('/history', async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const result = await pool.query(
      `SELECT completion_date,
              COUNT(id) as quests_completed,
              COALESCE(SUM(q.xp_reward), 0) as xp_gained
       FROM quest_completions qc
       JOIN quests q ON qc.quest_id = q.id
       WHERE completion_date >= $1
       GROUP BY completion_date
       ORDER BY completion_date ASC`,
      [startDate.toISOString().split('T')[0]]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

function calculateRank(xp: number): string {
  if (xp >= 1750) return 'S';
  if (xp >= 1400) return 'A';
  if (xp >= 1050) return 'B';
  if (xp >= 700) return 'C';
  if (xp >= 350) return 'D';
  return 'E';
}

export default router;
