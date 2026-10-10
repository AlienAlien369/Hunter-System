import { Router, Request, Response } from 'express';
import { pool } from '../db.js';
import { hit } from '../middleware/security.js';
import { deleteUserData, hashToken, invalidateStatus, recordConsent } from '../consent.js';

// Parent-facing endpoints. Authenticated only by the emailed token (the parent
// has no account), so they are rate limited per IP and the token is compared
// by hash. Nothing here is reachable from the child's session.
const router = Router();

async function findByToken(raw: unknown) {
  if (typeof raw !== 'string' || raw.length < 20 || raw.length > 100) return null;
  const r = await pool.query(
    'SELECT id, username, consent_status, parent_requested_at FROM users WHERE parent_token_hash = $1',
    [hashToken(raw)],
  );
  return r.rows[0] ?? null;
}

// GET /api/consent/parent?token=… — what the parent is being asked to approve.
router.get('/parent', async (req: Request, res: Response) => {
  if (hit(`consent:${req.ip}`, 30, 60 * 60_000)) return res.status(429).json({ error: 'Too many requests' });
  try {
    const u = await findByToken(req.query.token);
    if (!u) return res.status(404).json({ error: 'This link is not valid or has already been used.' });
    res.set('Cache-Control', 'no-store');
    res.json({ username: u.username, status: u.consent_status });
  } catch (error) {
    console.error('Consent lookup error:', error);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// POST /api/consent/parent { token, decision: 'grant' | 'decline' }
//  grant   → the child can use the product
//  decline → the account and all its data are deleted (also withdraws a past grant)
router.post('/parent', async (req: Request, res: Response) => {
  if (hit(`consent:${req.ip}`, 30, 60 * 60_000)) return res.status(429).json({ error: 'Too many requests' });
  try {
    const u = await findByToken(req.body?.token);
    if (!u) return res.status(404).json({ error: 'This link is not valid or has already been used.' });
    const decision = req.body?.decision;
    if (decision === 'grant') {
      if (u.consent_status === 'granted') return res.json({ status: 'granted' });
      if (u.consent_status !== 'pending') return res.status(409).json({ error: 'No consent is pending for this account.' });
      await pool.query(`UPDATE users SET consent_status = 'granted', parent_consented_at = NOW(), updated_at = NOW() WHERE id = $1`, [u.id]);
      invalidateStatus(u.id);
      await recordConsent(u.id, 'parental', 'v1');
      return res.json({ status: 'granted' });
    }
    if (decision === 'decline') {
      await deleteUserData(u.id);
      return res.json({ status: 'deleted' });
    }
    res.status(400).json({ error: 'decision must be "grant" or "decline"' });
  } catch (error) {
    console.error('Consent decision error:', error);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

export default router;
