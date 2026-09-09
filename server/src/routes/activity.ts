import { Router, Request, Response } from 'express';
import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// GET /api/activity - Recent activity log entries for the current user
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);

    const result = await pool.query(
      `SELECT id, action, entity, details, created_at
       FROM activity_log
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching activity:', error);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

export default router;