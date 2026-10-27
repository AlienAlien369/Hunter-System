import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { computeBusiness, computeFunnel } from '../analytics.js';
import { pool } from '../db.js';
import { platformSettings, updatePlatformSettings } from '../platform.js';
import { planOf } from './orgs.js';

// Admin = the platform's super admin(s): a username listed in ADMIN_USERNAMES
// (comma-separated env var). Only they change the product name and prices and
// grant seats to institutions. Institution admins are a different, per-org role.
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

// GET /api/admin/business?days=30 — revenue, referral and class aggregates
router.get('/business', async (req: Request, res: Response) => {
  try {
    const days = Math.min(365, Math.max(1, Math.floor(Number(req.query.days)) || 30));
    res.json(await computeBusiness(days));
  } catch (error) {
    console.error('Business report error:', error);
    res.status(500).json({ error: 'Failed to compute business report' });
  }
});

// GET /api/admin/settings — the platform settings (brand name, prices, trial)
router.get('/settings', (_req: Request, res: Response) => {
  res.set('Cache-Control', 'no-store');
  res.json({ settings: platformSettings() });
});

// PUT /api/admin/settings { brandName?, tagline?, supportEmail?, proYearInr?, proMonthInr?, orgSeatYearInr?, orgTrialDays?, orgTrialSeats? }
router.put('/settings', async (req: Request, res: Response) => {
  try {
    const next = await updatePlatformSettings(req.body ?? {});
    if (typeof next === 'string') return res.status(400).json({ error: next });
    console.log(`Platform settings changed by ${req.user!.username}`);
    res.json({ settings: next });
  } catch (error) {
    console.error('Platform settings error:', error);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// GET /api/admin/orgs — every institution with its size and plan
router.get('/orgs', async (_req: Request, res: Response) => {
  try {
    const orgs = (await pool.query(
      `SELECT o.*, (SELECT COUNT(*)::int FROM org_members m WHERE m.org_id = o.id AND m.role = 'student') AS students,
              (SELECT COUNT(*)::int FROM org_members m WHERE m.org_id = o.id AND m.role <> 'student') AS staff,
              (SELECT u.name FROM org_members m JOIN users u ON u.id = m.user_id WHERE m.org_id = o.id AND m.role = 'admin' ORDER BY m.joined_at LIMIT 1) AS admin_name
       FROM organizations o WHERE NOT o.archived ORDER BY o.created_at DESC LIMIT 500`)).rows;
    const out = [];
    for (const o of orgs) {
      const plan = await planOf(o);
      out.push({ id: o.id, name: o.name, kind: o.kind, admin: o.admin_name, students: o.students, staff: o.staff, createdAt: o.created_at, grantSeats: o.seats, grantUntil: o.plan_until, plan });
    }
    res.set('Cache-Control', 'no-store');
    res.json({ orgs: out });
  } catch (error) {
    console.error('Admin orgs error:', error);
    res.status(500).json({ error: 'Failed to load institutions' });
  }
});

// PATCH /api/admin/orgs/:id { seats, planUntil } — grant seats offline (invoice, pilot, discount)
router.patch('/orgs/:id', async (req: Request, res: Response) => {
  try {
    const seats = Number(req.body?.seats);
    if (!Number.isInteger(seats) || seats < 0 || seats > 100_000) return res.status(400).json({ error: 'seats must be 0 to 100000' });
    const until = req.body?.planUntil === null ? null : new Date(String(req.body?.planUntil));
    if (until !== null && Number.isNaN(until.getTime())) return res.status(400).json({ error: 'planUntil must be a date or null' });
    const r = await pool.query('UPDATE organizations SET seats = $2, plan_until = $3 WHERE id = $1 AND NOT archived RETURNING id', [Number(req.params.id) || 0, seats, until]);
    if (!r.rowCount) return res.status(404).json({ error: 'Institution not found' });
    console.log(`Institution ${req.params.id} granted ${seats} seats until ${until?.toISOString() ?? 'none'} by ${req.user!.username}`);
    res.json({ id: Number(req.params.id), seats, planUntil: until });
  } catch (error) {
    console.error('Admin org grant error:', error);
    res.status(500).json({ error: 'Failed to update the institution' });
  }
});

export default router;
