import { Router, Request, Response } from 'express';
import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { hit, tooMany } from '../middleware/security.js';
import { isValidEmail } from '../age.js';
import { requestTimeZone, requestToday } from '../time.js';
import { appUrl, mailConfigured } from '../mailer.js';
import { brandName } from '../platform.js';
import { isStaff } from '../orgs.js';
import {
  MAX_RECIPIENTS, RELATIONS, SCOPES, computeOrgWeekly, computeWeekly, renderOrgWeekly, renderWeekly,
  sendOrgWeeklyReport, sendWeeklyReport, type Scope,
} from '../reports.js';
import { membershipOf } from './orgs.js';

// Who receives a hunter's weekly report, and what part of it.
const router = Router();
router.use(authenticateToken);

const toDto = (r: any) => ({
  id: r.id, email: r.email, relation: r.relation, scope: r.scope, active: r.active, lastSentAt: r.last_sent_at,
  // Added by the institution: visible to the member, managed by staff.
  managedByInstitution: r.added_by_org !== null,
});

// GET /api/reports/recipients
router.get('/recipients', async (req: Request, res: Response) => {
  try {
    const r = await pool.query('SELECT * FROM report_recipients WHERE user_id = $1 ORDER BY id', [req.user!.id]);
    const m = await membershipOf(req.user!.id);
    res.set('Cache-Control', 'no-store');
    res.json({ recipients: r.rows.map(toDto), max: MAX_RECIPIENTS, mailConfigured: mailConfigured(), inInstitution: !!m, schedule: 'Sunday 6 pm' });
  } catch (error) {
    console.error('Recipients list error:', error);
    res.status(500).json({ error: 'Failed to load report recipients' });
  }
});

async function validScope(userId: number, raw: unknown): Promise<Scope | string> {
  const scope = raw ?? 'both';
  if (!SCOPES.includes(scope as Scope)) return 'scope must be both, org or personal';
  if (scope === 'org' && !(await membershipOf(userId))) return 'You are not in an institution, so there is no institution report to send.';
  return scope as Scope;
}

// POST /api/reports/recipients { email, relation, scope }
router.post('/recipients', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const wait = hit(`report-recipient:${userId}`, 20, 24 * 60 * 60_000);
    if (wait) return tooMany(res, wait, 'recipients added today');
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    if (!isValidEmail(email)) return res.status(400).json({ error: 'Enter a valid email address.', code: 'bad_email' });
    const relation = RELATIONS.includes(req.body?.relation) ? req.body.relation : 'other';
    const scope = await validScope(userId, req.body?.scope);
    if (!SCOPES.includes(scope as Scope)) return res.status(400).json({ error: scope, code: 'bad_scope' });
    const n = (await pool.query('SELECT COUNT(*)::int AS n FROM report_recipients WHERE user_id = $1', [userId])).rows[0].n;
    if (n >= MAX_RECIPIENTS) return res.status(409).json({ error: `You can send your report to at most ${MAX_RECIPIENTS} people.`, code: 'too_many' });
    const r = await pool.query(
      `INSERT INTO report_recipients (user_id, email, relation, scope) VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, email) DO NOTHING RETURNING *`, [userId, email, relation, scope]);
    if (!r.rowCount) return res.status(409).json({ error: 'That email already receives your report.', code: 'duplicate' });
    res.status(201).json(toDto(r.rows[0]));
  } catch (error) {
    console.error('Recipient add error:', error);
    res.status(500).json({ error: 'Failed to add the recipient' });
  }
});

const ownRecipient = async (userId: number, raw: unknown) =>
  (await pool.query('SELECT * FROM report_recipients WHERE id = $1 AND user_id = $2', [Number(raw) || 0, userId])).rows[0];

// PATCH /api/reports/recipients/:id { relation?, scope?, active? }
router.patch('/recipients/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const r = await ownRecipient(userId, req.params.id);
    if (!r) return res.status(404).json({ error: 'Recipient not found' });
    if (r.added_by_org !== null) return res.status(403).json({ error: 'Your institution manages this email.', code: 'managed_by_institution' });
    const relation = req.body?.relation === undefined ? r.relation : RELATIONS.includes(req.body.relation) ? req.body.relation : null;
    if (!relation) return res.status(400).json({ error: 'Unknown relation' });
    const scope = req.body?.scope === undefined ? r.scope : await validScope(userId, req.body.scope);
    if (!SCOPES.includes(scope as Scope)) return res.status(400).json({ error: scope, code: 'bad_scope' });
    const active = typeof req.body?.active === 'boolean' ? req.body.active : r.active;
    const u = await pool.query('UPDATE report_recipients SET relation = $2, scope = $3, active = $4 WHERE id = $1 RETURNING *', [r.id, relation, scope, active]);
    res.json(toDto(u.rows[0]));
  } catch (error) {
    console.error('Recipient update error:', error);
    res.status(500).json({ error: 'Failed to update the recipient' });
  }
});

// DELETE /api/reports/recipients/:id
router.delete('/recipients/:id', async (req: Request, res: Response) => {
  try {
    const r = await ownRecipient(req.user!.id, req.params.id);
    if (!r) return res.status(404).json({ error: 'Recipient not found' });
    if (r.added_by_org !== null) return res.status(403).json({ error: 'Your institution manages this email.', code: 'managed_by_institution' });
    await pool.query('DELETE FROM report_recipients WHERE id = $1', [r.id]);
    res.json({ removed: true });
  } catch (error) {
    console.error('Recipient delete error:', error);
    res.status(500).json({ error: 'Failed to remove the recipient' });
  }
});

// GET /api/reports/weekly?scope=both — this week's report as recipients will see it
router.get('/weekly', async (req: Request, res: Response) => {
  try {
    const scope = (SCOPES.includes(req.query.scope as Scope) ? req.query.scope : 'both') as Scope;
    const data = await computeWeekly(req.user!.id, requestToday(req), requestTimeZone(req));
    if (!data) return res.status(404).json({ error: 'User not found' });
    res.set('Cache-Control', 'no-store');
    res.json({ data, scope, preview: renderWeekly(data, scope, { brand: brandName(), appLink: appUrl() }) });
  } catch (error) {
    console.error('Weekly report error:', error);
    res.status(500).json({ error: 'Failed to build the weekly report' });
  }
});

// POST /api/reports/weekly/send — send now (it also goes out every Sunday evening on its own)
router.post('/weekly/send', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    if (!mailConfigured()) return res.status(503).json({ error: 'Email delivery is not set up on this server yet.', code: 'mail_not_configured' });
    const wait = hit(`report-send:${userId}`, 3, 24 * 60 * 60_000);
    if (wait) return tooMany(res, wait, 'reports sent today');
    const r = await sendWeeklyReport(userId, requestToday(req), requestTimeZone(req));
    if (!r.recipients) return res.status(400).json({ error: 'Add at least one email first.', code: 'no_recipients' });
    res.json(r);
  } catch (error) {
    console.error('Weekly report send error:', error);
    res.status(500).json({ error: 'Failed to send the weekly report' });
  }
});

// GET /api/reports/org/weekly — institution summary preview (staff)
router.get('/org/weekly', async (req: Request, res: Response) => {
  try {
    const m = await membershipOf(req.user!.id);
    if (!m || !isStaff(m.role)) return res.status(403).json({ error: 'Institution staff only.', code: 'forbidden' });
    const data = await computeOrgWeekly(m.orgId, requestToday(req), requestTimeZone(req));
    if (!data) return res.status(404).json({ error: 'Institution not found' });
    res.set('Cache-Control', 'no-store');
    res.json({ data, reportEmails: m.role === 'admin' ? m.org.report_emails : undefined, preview: renderOrgWeekly(data, { brand: brandName(), appLink: `${appUrl()}/org` }) });
  } catch (error) {
    console.error('Org weekly report error:', error);
    res.status(500).json({ error: 'Failed to build the institution report' });
  }
});

// POST /api/reports/org/weekly/send — admin
router.post('/org/weekly/send', async (req: Request, res: Response) => {
  try {
    const m = await membershipOf(req.user!.id);
    if (!m || m.role !== 'admin') return res.status(403).json({ error: 'Institution admins only.', code: 'forbidden' });
    if (!mailConfigured()) return res.status(503).json({ error: 'Email delivery is not set up on this server yet.', code: 'mail_not_configured' });
    const wait = hit(`org-report-send:${m.orgId}`, 3, 24 * 60 * 60_000);
    if (wait) return tooMany(res, wait, 'reports sent today');
    const r = await sendOrgWeeklyReport(m.orgId, requestToday(req), requestTimeZone(req));
    if (!r.recipients) return res.status(400).json({ error: 'Add report emails in institution settings first.', code: 'no_recipients' });
    res.json(r);
  } catch (error) {
    console.error('Org report send error:', error);
    res.status(500).json({ error: 'Failed to send the institution report' });
  }
});

export default router;
