import { Router, Request, Response } from 'express';
import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { logActivity } from '../activity.js';

const router = Router();

// GET /api/nutrition?month=YYYY-MM (defaults to the current month)
// Returns every logged food for that month, scoped to the user.
// Monthly totals are derived by summing rows, so the month naturally
// resets on the 1st (a new month simply has no rows yet).
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const now = new Date();
    const month = (req.query.month as string) || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const start = `${month}-01`;

    const result = await pool.query(
      `SELECT id, log_date::text AS date, food_name AS name, protein::float AS protein, cost::float AS cost
       FROM nutrition_logs
       WHERE user_id = $1 AND log_date >= $2::date AND log_date < ($2::date + INTERVAL '1 month')
       ORDER BY log_date ASC, id ASC`,
      [userId, start]
    );

    const totals = await pool.query(
      `SELECT COALESCE(SUM(protein), 0)::float AS protein,
              COALESCE(SUM(cost), 0)::float AS cost
       FROM nutrition_logs
       WHERE user_id = $1 AND log_date >= $2::date AND log_date < ($2::date + INTERVAL '1 month')`,
      [userId, start]
    );

    res.json({ month, entries: result.rows, totals: totals.rows[0] });
  } catch (error) {
    console.error('Error fetching nutrition:', error);
    res.status(500).json({ error: 'Failed to fetch nutrition' });
  }
});

// POST /api/nutrition/day - Replace a single day's consumed foods
// body: { date: 'YYYY-MM-DD', items: [{ name, protein, cost }] }
router.post('/day', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { date, items } = req.body;

    if (!date || !Array.isArray(items)) {
      return res.status(400).json({ error: 'date and items are required' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Replace this date's entries for this user (daily marks reset each day;
      // previous days' rows are kept so monthly calculations persist)
      await client.query('DELETE FROM nutrition_logs WHERE user_id = $1 AND log_date = $2::date', [userId, date]);
      for (const item of items) {
        await client.query(
          `INSERT INTO nutrition_logs (user_id, log_date, food_name, protein, cost)
           VALUES ($1, $2::date, $3, $4, $5)`,
          [userId, date, item.name, item.protein || 0, item.cost || 0]
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    await logActivity(userId, 'nutrition_update', date, { items: items.length });
    res.json({ message: 'Nutrition saved', date, count: items.length });
  } catch (error) {
    console.error('Error saving nutrition:', error);
    res.status(500).json({ error: 'Failed to save nutrition' });
  }
});

export default router;