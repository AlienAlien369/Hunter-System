import { Router, Request, Response } from 'express';
import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

// Cloud save for client-side game progress (inventory, loadout, streak
// freezes, unlocked titles/achievements) so it follows the hunter across
// devices. XP stays server-authoritative elsewhere; this is only cosmetic /
// consumable state the client already owned.
const router = Router();
router.use(authenticateToken);

export const STATE_KEYS = ['inventory', 'equipped', 'freezeCount', 'freezeDates', 'unlockedTitles', 'unlockedAchievements'] as const;
const MAX_BYTES = 64 * 1024;

// GET /api/state → { state, updatedAt } (state null if never saved)
router.get('/', async (req: Request, res: Response) => {
  try {
    const r = await pool.query('SELECT state, updated_at FROM user_state WHERE user_id = $1', [req.user!.id]);
    res.json({ state: r.rows[0]?.state ?? null, updatedAt: r.rows[0]?.updated_at ?? null });
  } catch (error) {
    console.error('State load error:', error);
    res.status(500).json({ error: 'Failed to load game state' });
  }
});

// PUT /api/state { state } — whitelisted keys only, size-capped
router.put('/', async (req: Request, res: Response) => {
  const body = req.body?.state;
  if (!body || typeof body !== 'object' || Array.isArray(body)) return res.status(400).json({ error: 'state object required' });
  const state: Record<string, unknown> = {};
  for (const k of STATE_KEYS) if (body[k] !== undefined) state[k] = body[k];
  if (JSON.stringify(state).length > MAX_BYTES) return res.status(413).json({ error: 'Game state too large' });
  try {
    const r = await pool.query(
      `INSERT INTO user_state (user_id, state) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET state = EXCLUDED.state, updated_at = NOW()
       RETURNING updated_at`,
      [req.user!.id, state],
    );
    res.json({ updatedAt: r.rows[0].updated_at });
  } catch (error) {
    console.error('State save error:', error);
    res.status(500).json({ error: 'Failed to save game state' });
  }
});

export default router;
