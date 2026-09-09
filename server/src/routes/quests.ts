import { Router, Request, Response } from 'express';
import { pool } from '../db.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import { logActivity } from '../activity.js';

const router = Router();

// GET /api/quests - List all quests (with the current user's completion history)
router.get('/', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { category, completed } = req.query;
    const userId = req.user?.id ?? null;
    let query = `
      SELECT q.*, COALESCE(
        json_agg(json_build_object('completion_date', qc.completion_date) ORDER BY qc.completion_date)
          FILTER (WHERE qc.id IS NOT NULL), '[]'
      ) AS completions
      FROM quests q
      LEFT JOIN quest_completions qc ON qc.quest_id = q.id AND qc.user_id = $1
    `;
    const params: any[] = [userId];
    const conditions: string[] = [];

    if (category) {
      params.push(category);
      conditions.push(`q.category = $${params.length}`);
    }
    if (completed !== undefined) {
      params.push(completed === 'true');
      conditions.push(`q.is_daily = $${params.length}`);
    }

    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' GROUP BY q.id ORDER BY q.difficulty ASC, q.title ASC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching quests:', error);
    res.status(500).json({ error: 'Failed to fetch quests' });
  }
});

// GET /api/quests/stats - Get quest statistics (scoped to the current user)
router.get('/stats', optionalAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id ?? null;
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const todayStats = await pool.query(
      `SELECT COUNT(*) as completed FROM quest_completions qc
       JOIN quests q ON qc.quest_id = q.id
       WHERE qc.completion_date = $1 AND ($2::int IS NULL OR qc.user_id = $2)`,
      [today, userId]
    );

    const weekStats = await pool.query(
      `SELECT COUNT(DISTINCT qc.completion_date) as active_days,
              SUM(CASE WHEN qc.completion_date >= $1 THEN 1 ELSE 0 END) as total_completions,
              SUM(q.xp_reward) as total_xp
       FROM quest_completions qc
       JOIN quests q ON qc.quest_id = q.id
       WHERE qc.completion_date >= $1 AND ($2::int IS NULL OR qc.user_id = $2)`,
      [weekAgo.toISOString().split('T')[0], userId]
    );

    const categoryStats = await pool.query(
      `SELECT q.category,
              COUNT(qc.id) as completed_count,
              COUNT(q.id) as total_count
       FROM quests q
       LEFT JOIN quest_completions qc ON qc.quest_id = q.id AND qc.completion_date = $1 AND ($2::int IS NULL OR qc.user_id = $2)
       GROUP BY q.category`,
      [today, userId]
    );

    res.json({
      today: {
        completed: parseInt(todayStats.rows[0].completed),
        total: parseInt(await pool.query('SELECT COUNT(*) FROM quests').then((r: any) => r.rows[0].count)),
        xp: parseInt(todayStats.rows[0].completed) * 10, // rough estimate
      },
      weekly: weekStats.rows[0],
      categories: categoryStats.rows,
    });
  } catch (error) {
    console.error('Error fetching quest stats:', error);
    res.status(500).json({ error: 'Failed to fetch quest stats' });
  }
});

// GET /api/quests/:id - Get single quest with the current user's completion status
router.get('/:id', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id ?? null;
    const result = await pool.query('SELECT * FROM quests WHERE quest_id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Quest not found' });
    }

    const quest = result.rows[0];

    // Get completions for the last 30 days (scoped to the current user)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const completions = await pool.query(
      `SELECT completion_date FROM quest_completions
       WHERE quest_id = $1 AND completion_date >= $2 AND ($3::int IS NULL OR user_id = $3)`,
      [quest.id, thirtyDaysAgo, userId]
    );

    res.json({ ...quest, completions: completions.rows });
  } catch (error) {
    console.error('Error fetching quest:', error);
    res.status(500).json({ error: 'Failed to fetch quest' });
  }
});

// POST /api/quests - Create a new quest
router.post('/', async (req: Request, res: Response) => {
  try {
    const { quest_id, title, xp_reward, category, difficulty } = req.body;
    const result = await pool.query(
      `INSERT INTO quests (quest_id, title, xp_reward, category, difficulty)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [quest_id, title, xp_reward, category, difficulty || 1]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating quest:', error);
    res.status(500).json({ error: 'Failed to create quest' });
  }
});

// PATCH /api/quests/:id/complete - Toggle quest completion
// Daily quests (DQ-*) reset every day: completion is tracked per date.
// DSA problems (LC-*) are permanent: once marked, they stay done until
// the user explicitly undoes them or uses "redo all" (XP untouched).
router.patch('/:id/complete', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const today = new Date().toISOString().split('T')[0];

    const quest = await pool.query(
      'SELECT id, quest_id, title, xp_reward FROM quests WHERE quest_id = $1',
      [id]
    );
    if (quest.rows.length === 0) {
      return res.status(404).json({ error: 'Quest not found' });
    }
    const q = quest.rows[0];
    const isDSA = q.quest_id.startsWith('LC-');

    // Check if already completed by this user (DSA: any date = done; daily: today only)
    const existing = isDSA
      ? await pool.query(
          `SELECT id FROM quest_completions
           WHERE user_id = $1 AND quest_id = $2`,
          [userId, q.id]
        )
      : await pool.query(
          `SELECT id FROM quest_completions
           WHERE user_id = $1 AND quest_id = $2 AND completion_date = $3`,
          [userId, q.id, today]
        );

    if (existing.rows.length > 0) {
      // Undo completion (removes every row for DSA so the mark is cleared)
      await pool.query(
        'DELETE FROM quest_completions WHERE user_id = $1 AND quest_id = $2',
        [userId, q.id]
      );

      // Reduce XP from user
      await pool.query(
        'UPDATE users SET xp = GREATEST(0, xp - $1), updated_at = NOW() WHERE id = $2',
        [q.xp_reward, userId]
      );
      await logActivity(userId, 'quest_undo', id, { title: q.title, xp: q.xp_reward });

      res.json({ action: 'undone', message: 'Quest uncompleted' });
    } else {
      // Mark as completed
      await pool.query(
        'INSERT INTO quest_completions (user_id, quest_id, completion_date) VALUES ($1, $2, $3)',
        [userId, q.id, today]
      );

      // Add XP to user
      await pool.query(
        'UPDATE users SET xp = xp + $1, updated_at = NOW() WHERE id = $2',
        [q.xp_reward, userId]
      );
      await logActivity(userId, 'quest_complete', id, { title: q.title, xp: q.xp_reward });

      res.json({ action: 'completed', xpGained: q.xp_reward });
    }
  } catch (error) {
    console.error('Error toggling quest completion:', error);
    res.status(500).json({ error: 'Failed to toggle quest' });
  }
});

// POST /api/quests/redo-dsa - Reset all DSA (LeetCode) progress, keep XP and level
router.post('/redo-dsa', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const result = await pool.query(
      `DELETE FROM quest_completions qc
       USING quests q
       WHERE qc.quest_id = q.id AND qc.user_id = $1 AND q.quest_id LIKE 'LC-%'`,
      [userId]
    );
    await logActivity(userId, 'dsa_redo', 'LC', { reset: result.rowCount ?? 0 });
    res.json({
      action: 'redone',
      deleted: result.rowCount ?? 0,
      message: 'All DSA problems reset. XP and level unchanged.',
    });
  } catch (error) {
    console.error('Error redoing DSA quests:', error);
    res.status(500).json({ error: 'Failed to reset DSA quests' });
  }
});

export default router;
