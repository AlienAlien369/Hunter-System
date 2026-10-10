import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { computeFunnel } from '../analytics.js';

// Admin = a username listed in ADMIN_USERNAMES (comma-separated env var).
// With the variable unset nobody is an admin, so a fresh deploy exposes nothing.
// The match is EXACT (case-sensitive), like username uniqueness itself: a
// case-insensitive match would let anyone register "ALIEN" and be treated as
// the admin "alien".
export function isAdminUsername(username: string | undefined): boolean {
  if (!username) return false;
  const list = (process.env.ADMIN_USERNAMES || '').split(',').map(s => s.trim()).filter(Boolean);
  return list.includes(username);
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!isAdminUsername(req.user?.username)) return res.status(403).json({ error: 'Admins only' });
  next();
}

const router = Router();
router.use(authenticateToken, requireAdmin);

// GET /api/admin/funnel?days=30&region=IN
router.get('/funnel', async (req: Request, res: Response) => {
  try {
    const days = Math.min(365, Math.max(1, Math.floor(Number(req.query.days)) || 30));
    const raw = String(req.query.region || '').toUpperCase();
    const region = /^([A-Z]{2}|\?\?)$/.test(raw) ? raw : null;
    res.json(await computeFunnel(days, region));
  } catch (error) {
    console.error('Funnel error:', error);
    res.status(500).json({ error: 'Failed to compute funnel' });
  }
});

export default router;
