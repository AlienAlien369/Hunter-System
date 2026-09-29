import { Router, Request, Response } from 'express';
import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { initPush } from '../push.js';
import { requestTimeZone } from '../time.js';

const router = Router();

// GET /api/push/key → { publicKey } (VAPID application server key)
router.get('/key', async (_req: Request, res: Response) => {
  try {
    res.json({ publicKey: await initPush() });
  } catch (error) {
    console.error('Push key error:', error);
    res.status(500).json({ error: 'Push unavailable' });
  }
});

const MAX_DEVICES = 10;

// POST /api/push/subscribe { subscription: PushSubscriptionJSON } — timezone from X-Timezone
router.post('/subscribe', authenticateToken, async (req: Request, res: Response) => {
  const sub = req.body?.subscription;
  const endpoint = sub?.endpoint;
  const keys = sub?.keys;
  if (typeof endpoint !== 'string' || !/^https:\/\//.test(endpoint) || endpoint.length > 1000
    || typeof keys?.p256dh !== 'string' || typeof keys?.auth !== 'string') {
    return res.status(400).json({ error: 'Invalid push subscription' });
  }
  try {
    const userId = req.user!.id;
    // Re-subscribing a device moves it to this hunter (shared browsers) and refreshes its timezone.
    await pool.query(
      `INSERT INTO push_subscriptions (user_id, endpoint, keys, timezone) VALUES ($1, $2, $3, $4)
       ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, keys = EXCLUDED.keys, timezone = EXCLUDED.timezone`,
      [userId, endpoint, { p256dh: keys.p256dh.slice(0, 200), auth: keys.auth.slice(0, 100) }, requestTimeZone(req)],
    );
    await pool.query(
      `DELETE FROM push_subscriptions WHERE user_id = $1 AND id NOT IN (
         SELECT id FROM push_subscriptions WHERE user_id = $1 ORDER BY created_at DESC LIMIT ${MAX_DEVICES})`,
      [userId],
    );
    res.status(201).json({ ok: true });
  } catch (error) {
    console.error('Push subscribe error:', error);
    res.status(500).json({ error: 'Failed to save push subscription' });
  }
});

// DELETE /api/push/subscribe { endpoint }
router.delete('/subscribe', authenticateToken, async (req: Request, res: Response) => {
  try {
    await pool.query('DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2', [req.user!.id, String(req.body?.endpoint ?? '')]);
    res.status(204).end();
  } catch (error) {
    console.error('Push unsubscribe error:', error);
    res.status(500).json({ error: 'Failed to remove push subscription' });
  }
});

export default router;
