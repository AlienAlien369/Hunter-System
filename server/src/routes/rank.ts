import { Router, Request, Response } from 'express';
import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// GET /api/rank - Get current rank and progression
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [req.user?.id]);
    const user = userResult.rows[0];

    if (!user) {
      return res.status(404).json({ error: 'No user found' });
    }

    const ranks = [
      { name: 'E', minXP: 0, maxXP: 350, color: '#8A92B2' },
      { name: 'D', minXP: 350, maxXP: 700, color: '#3498DB' },
      { name: 'C', minXP: 700, maxXP: 1050, color: '#5D26C1' },
      { name: 'B', minXP: 1050, maxXP: 1400, color: '#8E2DE2' },
      { name: 'A', minXP: 1400, maxXP: 1750, color: '#F1C40F' },
      { name: 'S', minXP: 1750, maxXP: 2100, color: '#F1C40F' },
    ];

    const currentRank = ranks.find(r => user.xp >= r.minXP && user.xp < r.maxXP) || ranks[0];
    const nextRankIndex = ranks.indexOf(currentRank) + 1;
    const nextRank = nextRankIndex < ranks.length ? ranks[nextRankIndex] : null;

    let progress = 0;
    if (nextRank) {
      progress = ((user.xp - currentRank.minXP) / (nextRank.minXP - currentRank.minXP)) * 100;
    } else {
      progress = 100;
    }

    // Get rank history (scoped to this user)
    const history = await pool.query(
      'SELECT * FROM rank_history WHERE user_id = $1 ORDER BY achieved_at DESC LIMIT 10',
      [req.user?.id]
    );

    res.json({
      user: {
        name: user.name,
        rank: currentRank.name,
        xp: user.xp,
        level: Math.floor(user.xp / 1000) + 1,
      },
      currentRank: {
        ...currentRank,
        progress: Math.min(progress, 100),
      },
      nextRank: nextRank ? {
        ...nextRank,
        xpRequired: nextRank.minXP,
      } : null,
      history: history.rows,
    });
  } catch (error) {
    console.error('Error fetching rank:', error);
    res.status(500).json({ error: 'Failed to fetch rank' });
  }
});

// GET /api/rank/levels - Get level progression
router.get('/levels', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userResult = await pool.query('SELECT xp FROM users WHERE id = $1', [req.user?.id]);
    const user = userResult.rows[0];

    if (!user) {
      return res.status(404).json({ error: 'No user found' });
    }

    const levels = [];
    const currentLevel = Math.floor(user.xp / 1000) + 1;

    for (let i = 1; i <= currentLevel + 5; i++) {
      const levelXP = i * 1000;
      const prevLevelXP = (i - 1) * 1000;
      const isCompleted = user.xp >= levelXP;
      const progress = isCompleted ? 100 : ((user.xp - prevLevelXP) / 1000) * 100;

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
    console.error('Error fetching levels:', error);
    res.status(500).json({ error: 'Failed to fetch levels' });
  }
});

export default router;
