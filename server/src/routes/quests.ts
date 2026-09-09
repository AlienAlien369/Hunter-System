import { Router, Request, Response } from 'express';
import { pool } from '../db.js';

const router = Router();

// GET /api/quests - List all quests
router.get('/', async (req: Request, res: Response) => {
  try {
    const { category, completed } = req.query;
    let query = 'SELECT * FROM quests';
    const params: any[] = [];
    let where = '';

    if (category) {
      where += where ? ' AND' : ' WHERE';
      where += ` category = $${params.length + 1}`;
      params.push(category);
    }
    if (completed !== undefined) {
      where += where ? ' AND' : ' WHERE';
      where += ` is_daily = $${params.length + 1}`;
      params.push(completed === 'true');
    }

    if (where) query += where;
    query += ' ORDER BY difficulty ASC, title ASC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching quests:', error);
    res.status(500).json({ error: 'Failed to fetch quests' });
  }
});

// GET /api/quests/:id - Get single quest with completion status
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM quests WHERE quest_id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Quest not found' });
    }

    const quest = result.rows[0];

    // Get completions for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const completions = await pool.query(
      `SELECT completion_date FROM quest_completions
       WHERE quest_id = $1 AND completion_date >= $2`,
      [quest.id, thirtyDaysAgo]
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

// PATCH /api/quests/:id/complete - Toggle quest completion for today
router.patch('/:id/complete', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const today = new Date().toISOString().split('T')[0];

    // Check if already completed
    const existing = await pool.query(
      'SELECT id FROM quest_completions WHERE quest_id = (SELECT id FROM quests WHERE quest_id = $1) AND completion_date = $2',
      [id, today]
    );

    if (existing.rows.length > 0) {
      // Undo completion
      await pool.query('DELETE FROM quest_completions WHERE id = $1', [existing.rows[0].id]);

      // Reduce XP from user
      await pool.query(
        'UPDATE users SET xp = GREATEST(0, xp - (SELECT xp_reward FROM quests WHERE quest_id = $1)) WHERE id = 1',
        [id]
      );
      await pool.query('UPDATE users SET updated_at = NOW() WHERE id = 1');

      res.json({ action: 'completed', message: 'Quest uncompleted' });
    } else {
      // Mark as completed
      const quest = await pool.query('SELECT id, xp_reward FROM quests WHERE quest_id = $1', [id]);
      if (quest.rows.length === 0) {
        return res.status(404).json({ error: 'Quest not found' });
      }

      await pool.query(
        'INSERT INTO quest_completions (quest_id, completion_date) VALUES ($1, $2)',
        [quest.rows[0].id, today]
      );

      // Add XP to user
      await pool.query(
        'UPDATE users SET xp = xp + $1, updated_at = NOW() WHERE id = 1',
        [quest.rows[0].xp_reward]
      );

      res.json({ action: 'completed', xpGained: quest.rows[0].xp_reward });
    }
  } catch (error) {
    console.error('Error toggling quest completion:', error);
    res.status(500).json({ error: 'Failed to toggle quest' });
  }
});

// GET /api/quests/stats - Get quest statistics
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const todayStats = await pool.query(
      `SELECT COUNT(*) as completed FROM quest_completions qc
       JOIN quests q ON qc.quest_id = q.id
       WHERE qc.completion_date = $1`,
      [today]
    );

    const weekStats = await pool.query(
      `SELECT COUNT(DISTINCT qc.completion_date) as active_days,
              SUM(CASE WHEN qc.completion_date >= $1 THEN 1 ELSE 0 END) as total_completions,
              SUM(q.xp_reward) as total_xp
       FROM quest_completions qc
       JOIN quests q ON qc.quest_id = q.id
       WHERE qc.completion_date >= $1`,
      [weekAgo.toISOString().split('T')[0]]
    );

    const categoryStats = await pool.query(
      `SELECT q.category,
              COUNT(qc.id) as completed_count,
              COUNT(q.id) as total_count
       FROM quests q
       LEFT JOIN quest_completions qc ON qc.quest_id = q.id AND qc.completion_date = $1
       GROUP BY q.category`,
      [today]
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

export default router;
