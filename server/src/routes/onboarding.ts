import { Router, Request, Response } from 'express';
import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { applyXp } from '../xp.js';

// "Hunter Initiation": a first-session checklist on the Dashboard. Every step
// is derived from real data (nothing the client can claim), and finishing
// all of them unlocks a one-time XP bonus.
const router = Router();
router.use(authenticateToken);

export const INITIATION_BONUS = 50;

async function steps(userId: number) {
  const r = await pool.query(
    `SELECT
       u.name_set,
       EXISTS (SELECT 1 FROM routines WHERE user_id = u.id AND confirmed_at IS NOT NULL) AS timetable,
       EXISTS (SELECT 1 FROM user_modules WHERE user_id = u.id) AS module,
       EXISTS (SELECT 1 FROM quest_completions WHERE user_id = u.id) AS quest,
       EXISTS (SELECT 1 FROM unplanned_activities WHERE user_id = u.id AND status = 'accepted') AS extra,
       EXISTS (SELECT 1 FROM activity_log WHERE user_id = u.id AND action = 'initiation_bonus') AS claimed
     FROM users u WHERE u.id = $1`,
    [userId],
  );
  const s = r.rows[0];
  return {
    claimed: s.claimed as boolean,
    steps: [
      { id: 'name', label: 'Choose your Hunter name', done: s.name_set },
      { id: 'timetable', label: 'Build your timetable', done: s.timetable },
      { id: 'module', label: 'Add your first module', done: s.module },
      { id: 'quest', label: 'Complete your first quest', done: s.quest },
      { id: 'extra', label: 'Log something extra you did', done: s.extra },
    ] as { id: string; label: string; done: boolean }[],
  };
}

// GET /api/onboarding
router.get('/', async (req: Request, res: Response) => {
  try {
    res.json({ ...(await steps(req.user!.id)), bonus: INITIATION_BONUS });
  } catch (error) {
    console.error('Error fetching onboarding:', error);
    res.status(500).json({ error: 'Failed to fetch onboarding' });
  }
});

// POST /api/onboarding/claim — one-time bonus once every step is done
router.post('/claim', async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT 1 FROM users WHERE id = $1 FOR UPDATE', [userId]); // serialize double-claims
    const s = await steps(userId);
    if (s.claimed) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Initiation bonus already claimed' });
    }
    if (!s.steps.every(x => x.done)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Finish every initiation step first' });
    }
    const xp = await applyXp(client, userId, [{
      delta: INITIATION_BONUS, action: 'initiation_bonus', entity: 'onboarding',
      details: { label: 'Hunter Initiation complete' },
    }]);
    await client.query('COMMIT');
    res.json({ xpGained: INITIATION_BONUS, ...xp });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error claiming initiation bonus:', error);
    res.status(500).json({ error: 'Failed to claim bonus' });
  } finally {
    client.release();
  }
});

export default router;
