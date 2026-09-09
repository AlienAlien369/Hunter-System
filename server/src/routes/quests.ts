import { Router, Request, Response } from 'express';
import { pool } from '../db.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import { logActivity } from '../activity.js';
import { calculateLevel } from '../progression.js';
import { selectTodaysHiddenQuest, scaleHiddenXp, tierForLevel, TIERS } from '../data/hiddenQuests.js';

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
    // Hidden quests (HQ-*) are served by GET /quests/hidden/today — they are not
    // part of the quest board listing.
    conditions.push(`q.category <> 'hidden'`);

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
       WHERE qc.completion_date = $1 AND q.quest_id NOT LIKE 'HQ-%' AND ($2::int IS NULL OR qc.user_id = $2)`,
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
        total: parseInt(await pool.query("SELECT COUNT(*) FROM quests WHERE quest_id NOT LIKE 'HQ-%'").then((r: any) => r.rows[0].count)),
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

// GET /api/quests/hidden/today - Today's hidden quest for this hunter, picked
// from the 200+ tiered pool and scaled to the hunter's level.
router.get('/hidden/today', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const userRes = await pool.query('SELECT username, xp FROM users WHERE id = $1', [userId]);
    const user = userRes.rows[0];
    if (!user) {
      return res.status(404).json({ error: 'No user found' });
    }

    const level = calculateLevel(parseInt(user.xp ?? '0'));
    const def = selectTodaysHiddenQuest(user.username, level);
    const tier = tierForLevel(level);
    const today = new Date().toISOString().split('T')[0];

    const done = await pool.query(
      `SELECT qc.id FROM quest_completions qc
       JOIN quests q ON qc.quest_id = q.id
       WHERE qc.user_id = $1 AND q.quest_id = $2 AND qc.completion_date = $3`,
      [userId, def.id, today]
    );

    res.json({
      id: def.id,
      title: def.title,
      description: def.description,
      icon: def.icon,
      baseXp: def.baseXp,
      xpReward: scaleHiddenXp(def.baseXp, level),
      difficulty: def.difficulty,
      tier: {
        index: TIERS.indexOf(tier) + 1,
        name: tier.name,
        minLevel: tier.minLevel,
        multiplier: tier.multiplier,
      },
      level,
      date: today,
      completedToday: done.rows.length > 0,
    });
  } catch (error) {
    console.error('Error fetching today\'s hidden quest:', error);
    res.status(500).json({ error: 'Failed to fetch hidden quest' });
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
// Daily quests (DQ-*) and hidden quests (HQ-*) reset every day:
// completion is tracked per date.
// Permanent tracks (LC-* DSA, SS-* SaaS, AR-* Architecture) stay done
// until the user explicitly undoes them or uses "redo all" (XP untouched).
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
    // Daily quests (DQ-*) and hidden quests (HQ-*) reset every day.
    const isDaily = q.quest_id.startsWith('DQ-') || q.quest_id.startsWith('HQ-');

    // Hidden quests award level-scaled XP: the pool's base XP × the hunter's
    // level-band multiplier. The exact amount is stored on the completion row
    // so an undo removes precisely what was granted.
    const isHidden = q.quest_id.startsWith('HQ-');
    let awardXp = q.xp_reward;
    if (isHidden) {
      const lvlRes = await pool.query('SELECT xp FROM users WHERE id = $1', [userId]);
      awardXp = scaleHiddenXp(q.xp_reward, calculateLevel(parseInt(lvlRes.rows[0]?.xp ?? '0')));
    }

    // Check if already completed by this user (permanent tracks: any date = done; daily: today only)
    const existing = !isDaily
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
      // Undo removes exactly what that completion awarded (level-scaled for hidden quests)
      const awarded = await pool.query(
        `SELECT xp_awarded FROM quest_completions
         WHERE user_id = $1 AND quest_id = $2
         ORDER BY completion_date DESC, id DESC LIMIT 1`,
        [userId, q.id]
      );
      const undoXp = awarded.rows[0]?.xp_awarded ?? q.xp_reward;

      // Undo completion (removes every row for DSA so the mark is cleared)
      await pool.query(
        'DELETE FROM quest_completions WHERE user_id = $1 AND quest_id = $2',
        [userId, q.id]
      );

      // Reduce XP from user
      await pool.query(
        'UPDATE users SET xp = GREATEST(0, xp - $1), updated_at = NOW() WHERE id = $2',
        [undoXp, userId]
      );
      await logActivity(userId, 'quest_undo', id, { title: q.title, xp: undoXp });

      // Decrement lifetime track counters (redo-all intentionally does NOT reset these)
      const track = trackForQuest(q.quest_id);
      if (track) {
        await pool.query(
          `UPDATE track_progress
           SET total_completions = GREATEST(0, total_completions - 1),
               total_xp = GREATEST(0, total_xp - $3),
               updated_at = NOW()
           WHERE user_id = $1 AND track = $2`,
          [userId, track, q.xp_reward]
        );
      }

      res.json({ action: 'undone', message: 'Quest uncompleted' });
    } else {
      // Mark as completed (store exactly how much XP was awarded)
      await pool.query(
        'INSERT INTO quest_completions (user_id, quest_id, completion_date, xp_awarded) VALUES ($1, $2, $3, $4)',
        [userId, q.id, today, awardXp]
      );

      // Add XP to user
      await pool.query(
        'UPDATE users SET xp = xp + $1, updated_at = NOW() WHERE id = $2',
        [awardXp, userId]
      );
      await logActivity(userId, 'quest_complete', id, { title: q.title, xp: awardXp });

      // Accrue lifetime track counters and detect full passes (redo-all keeps these)
      const track = trackForQuest(q.quest_id);
      if (track) {
        await pool.query(
          `INSERT INTO track_progress (user_id, track, total_completions, total_xp)
           VALUES ($1, $2, 1, $3)
           ON CONFLICT (user_id, track) DO UPDATE SET
             total_completions = track_progress.total_completions + 1,
             total_xp = track_progress.total_xp + $3,
             updated_at = NOW()`,
          [userId, track, q.xp_reward]
        );

        // A pass completes when every quest in the track has a current completion
        const done = await pool.query(
          `SELECT COUNT(DISTINCT qc.quest_id)::int AS done,
                  (SELECT COUNT(*)::int FROM quests WHERE quest_id LIKE $2) AS total
           FROM quest_completions qc
           JOIN quests q ON qc.quest_id = q.id
           WHERE qc.user_id = $1 AND q.quest_id LIKE $2`,
          [userId, TRACK_PREFIXES[track]]
        );
        if (done.rows[0].done >= done.rows[0].total) {
          await pool.query(
            'UPDATE track_progress SET passes = passes + 1, updated_at = NOW() WHERE user_id = $1 AND track = $2',
            [userId, track]
          );
        }
      }

      res.json({ action: 'completed', xpGained: awardXp });
    }
  } catch (error) {
    console.error('Error toggling quest completion:', error);
    res.status(500).json({ error: 'Failed to toggle quest' });
  }
});

// POST /api/quests/redo/:track - Reset a permanent track, keep XP and level
// tracks: dsa (LC-*), saas (SS-*), arch (AR-*)
const TRACK_PREFIXES: Record<string, string> = {
  dsa: 'LC-%',
  saas: 'SS-%',
  arch: 'AR-%',
};

function trackForQuest(questId: string): string | null {
  for (const [track, prefix] of Object.entries(TRACK_PREFIXES)) {
    if (questId.startsWith(prefix.replace('-%', ''))) return track;
  }
  return null;
}

router.post('/redo/:track', authenticateToken, async (req: Request, res: Response) => {
  try {
    const track = req.params.track;
    const prefix = TRACK_PREFIXES[track];
    if (!prefix) {
      return res.status(400).json({ error: `Unknown track '${track}'. Expected dsa, saas or arch.` });
    }
    const userId = req.user?.id;
    const result = await pool.query(
      `DELETE FROM quest_completions qc
       USING quests q
       WHERE qc.quest_id = q.id AND qc.user_id = $1 AND q.quest_id LIKE $2`,
      [userId, prefix]
    );
    await logActivity(userId, `${track}_redo`, track.toUpperCase(), { reset: result.rowCount ?? 0 });
    res.json({
      action: 'redone',
      track,
      deleted: result.rowCount ?? 0,
      message: `All ${track.toUpperCase()} items reset. XP and level unchanged.`,
    });
  } catch (error) {
    console.error('Error redoing track:', error);
    res.status(500).json({ error: 'Failed to reset track' });
  }
});

export default router;
