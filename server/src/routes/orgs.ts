import { Router, Request, Response } from 'express';
import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { hit, tooMany } from '../middleware/security.js';
import { addDays, requestTimeZone, requestToday } from '../time.js';
import { calculateLevel, calculateRank } from '../progression.js';
import { generateJoinCode, normalizeJoinCode, CODE_LENGTH } from '../classes.js';
import { isValidEmail } from '../age.js';
import { subscriptionEntitles } from '../billing.js';
import { platformSettings } from '../platform.js';
import { appUrl } from '../mailer.js';
import { priceFor, priceGroupFor, providerFor } from '../pricing.js';
import { getProvider } from '../payments/index.js';
import { ProviderError } from '../payments/types.js';
import { detectRegion } from '../region.js';
import {
  MAX_ORG_TASKS, MAX_REPORT_EMAILS, ORG_WINDOW_DAYS, can, isStaff, memberProgress, orgPlanStatus, sanitizeOrgTask,
  scheduledOn, seatAvailable, taskSince, validOrgKind, validOrgName, type OrgRole,
} from '../orgs.js';
import { RELATIONS } from '../reports.js';

const router = Router();
router.use(authenticateToken);

interface Membership {
  orgId: number;
  role: OrgRole;
  xp: number;
  joinedAt: Date;
  org: { id: number; name: string; kind: string; student_code: string; staff_code: string; seats: number; plan_until: Date | null; report_emails: string[]; owner_id: number | null; created_at: Date };
}

export async function membershipOf(userId: number): Promise<Membership | null> {
  const r = (await pool.query(
    `SELECT m.org_id, m.role, m.xp, m.joined_at, row_to_json(o) AS org
     FROM org_members m JOIN organizations o ON o.id = m.org_id
     WHERE m.user_id = $1 AND NOT o.archived`, [userId])).rows[0];
  return r ? { orgId: r.org_id, role: r.role, xp: r.xp, joinedAt: r.joined_at, org: r.org } : null;
}

export async function planOf(org: Membership['org']) {
  const subs = (await pool.query(
    `SELECT status, current_period_end, seats FROM subscriptions WHERE org_id = $1 AND plan = 'teams'`, [org.id])).rows;
  return orgPlanStatus(
    { seats: org.seats, planUntil: org.plan_until },
    subs.map((s: any) => ({ seats: s.seats, currentPeriodEnd: s.current_period_end, live: subscriptionEntitles(s) })),
  );
}

const studentCount = async (orgId: number) =>
  (await pool.query(`SELECT COUNT(*)::int AS n FROM org_members WHERE org_id = $1 AND role = 'student'`, [orgId])).rows[0].n as number;

async function uniqueCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = generateJoinCode();
    const taken = await pool.query(
      `SELECT 1 FROM organizations WHERE student_code = $1 OR staff_code = $1 UNION ALL SELECT 1 FROM classes WHERE code = $1`, [code]);
    if (!taken.rowCount) return code;
  }
  throw new Error('could not allocate an institution code');
}

const levelOf = (xp: number) => ({ xp, level: calculateLevel(xp), rank: calculateRank(xp) });

/** The member's own view of the institution. Codes, seats and billing only for staff. */
async function orgView(m: Membership) {
  const plan = await planOf(m.org);
  const [members, students] = await Promise.all([
    pool.query('SELECT COUNT(*)::int AS n FROM org_members WHERE org_id = $1', [m.orgId]),
    studentCount(m.orgId),
  ]);
  const staff = isStaff(m.role);
  return {
    id: m.org.id,
    name: m.org.name,
    kind: m.org.kind,
    role: m.role,
    members: members.rows[0].n,
    students,
    ...(staff ? {
      studentCode: m.org.student_code,
      ...(m.role === 'admin' ? { staffCode: m.org.staff_code, reportEmails: m.org.report_emails } : {}),
      plan: { active: plan.active, trial: plan.trial, seats: plan.seats, until: plan.until },
    } : {}),
  };
}

const today = (req: Request) => requestToday(req);

async function tasksFor(orgId: number, userId: number, day: string) {
  const rows = (await pool.query(
    `SELECT t.id, t.title, t.description, t.difficulty, t.xp_reward, t.schedule_time, t.recurrence,
            EXISTS (SELECT 1 FROM org_task_completions c WHERE c.task_id = t.id AND c.user_id = $2 AND c.completion_date = $3::date) AS done
     FROM org_tasks t WHERE t.org_id = $1 AND NOT t.archived
     ORDER BY t.schedule_time NULLS LAST, t.id`, [orgId, userId, day])).rows;
  return rows.map((t: any) => ({
    id: t.id, title: t.title, description: t.description, difficulty: t.difficulty, xpReward: t.xp_reward,
    scheduleTime: t.schedule_time, recurrence: t.recurrence, today: scheduledOn(t.recurrence, day), done: t.done,
  }));
}

// GET /api/orgs/me — my institution, my institution progress and today's core tasks (null when I am an individual)
router.get('/me', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    res.set('Cache-Control', 'no-store');
    const m = await membershipOf(userId);
    if (!m) return res.json({ org: null });
    const day = today(req);
    const week = (await pool.query(
      `SELECT COALESCE(SUM(xp_awarded), 0)::int AS xp, COUNT(*)::int AS done FROM org_task_completions
       WHERE user_id = $1 AND org_id = $2 AND completion_date >= $3::date`, [userId, m.orgId, addDays(day, -6)])).rows[0];
    res.json({
      org: await orgView(m),
      progress: { ...levelOf(m.xp), weekXp: week.xp, weekDone: week.done },
      tasks: await tasksFor(m.orgId, userId, day),
    });
  } catch (error) {
    console.error('Org me error:', error);
    res.status(500).json({ error: 'Failed to load your institution' });
  }
});

// POST /api/orgs { name, kind } — set up an institution (adults only). Starts the free trial.
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const wait = hit(`org-create:${userId}`, 5, 24 * 60 * 60_000);
    if (wait) return tooMany(res, wait, 'institutions created');
    const name = validOrgName(req.body?.name);
    if (!name) return res.status(400).json({ error: 'Give the institution a name (2 to 80 characters).', code: 'bad_name' });
    const kind = validOrgKind(req.body?.kind ?? 'school');
    if (!kind) return res.status(400).json({ error: 'Unknown institution type.', code: 'bad_kind' });
    const u = (await pool.query('SELECT consent_status FROM users WHERE id = $1', [userId])).rows[0];
    if (u?.consent_status !== 'not_required') return res.status(403).json({ error: 'Only adults can set up an institution.', code: 'adult_required' });
    if (await membershipOf(userId)) return res.status(409).json({ error: 'You already belong to an institution. Leave it first.', code: 'already_member' });
    const s = platformSettings();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const org = (await client.query(
        `INSERT INTO organizations (name, kind, owner_id, student_code, staff_code, seats, plan_until)
         VALUES ($1, $2, $3, $4, $5, $6, CASE WHEN $7::int > 0 THEN NOW() + make_interval(days => $7::int) ELSE NULL END) RETURNING id`,
        [name, kind, userId, await uniqueCode(), await uniqueCode(), s.orgTrialSeats, s.orgTrialDays])).rows[0];
      await client.query(`INSERT INTO org_members (org_id, user_id, role) VALUES ($1, $2, 'admin')`, [org.id, userId]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      client.release();
    }
    res.status(201).json({ org: await orgView((await membershipOf(userId))!) });
  } catch (error) {
    console.error('Org create error:', error);
    res.status(500).json({ error: 'Failed to create the institution' });
  }
});

/** Resolve a join code to its institution and the role it grants. */
async function byCode(code: string) {
  const o = (await pool.query(
    `SELECT id, name, kind, student_code, staff_code, seats, plan_until, report_emails, owner_id, created_at FROM organizations
     WHERE (student_code = $1 OR staff_code = $1) AND NOT archived`, [code])).rows[0];
  if (!o) return null;
  return { org: o, role: (o.staff_code === code ? 'teacher' : 'student') as OrgRole };
}

// GET /api/orgs/lookup?code= — what a member sees BEFORE joining, including what staff will see
router.get('/lookup', async (req: Request, res: Response) => {
  try {
    const wait = hit(`org-lookup:${req.user!.id}`, 30, 60 * 60_000);
    if (wait) return tooMany(res, wait, 'institution code attempts');
    const code = normalizeJoinCode(req.query.code);
    if (!code) return res.status(400).json({ error: `An institution code has ${CODE_LENGTH} letters and numbers.`, code: 'bad_code' });
    const found = await byCode(code);
    if (!found) return res.status(404).json({ error: 'No institution with that code.', code: 'not_found' });
    res.json({
      name: found.org.name, kind: found.org.kind, role: found.role,
      staffSees: ['name', 'institutionLevel', 'coreTasksDone', 'activeDays', 'lastActive'],
      staffNeverSees: ['personalTasks', 'personalXp', 'modules', 'notes'],
    });
  } catch (error) {
    console.error('Org lookup error:', error);
    res.status(500).json({ error: 'Failed to look up the institution' });
  }
});

// POST /api/orgs/join { code } — the member's own, informed action
router.post('/join', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const wait = hit(`org-join:${userId}`, 10, 60 * 60_000);
    if (wait) return tooMany(res, wait, 'institution code attempts');
    const code = normalizeJoinCode(req.body?.code);
    if (!code) return res.status(400).json({ error: `An institution code has ${CODE_LENGTH} letters and numbers.`, code: 'bad_code' });
    const found = await byCode(code);
    if (!found) return res.status(404).json({ error: 'No institution with that code.', code: 'not_found' });
    const current = await membershipOf(userId);
    if (current) {
      if (current.orgId === found.org.id) return res.json({ org: await orgView(current) });
      return res.status(409).json({ error: 'You already belong to an institution. Leave it first.', code: 'already_member' });
    }
    if (found.role === 'teacher') {
      const u = (await pool.query('SELECT consent_status FROM users WHERE id = $1', [userId])).rows[0];
      if (u?.consent_status !== 'not_required') return res.status(403).json({ error: 'Staff accounts are for adults.', code: 'adult_required' });
    }
    // Seats must hold when a whole class joins at once: lock the institution row.
    const client = await pool.connect();
    let full = false;
    try {
      await client.query('BEGIN');
      await client.query('SELECT id FROM organizations WHERE id = $1 FOR UPDATE', [found.org.id]);
      if (found.role === 'student') {
        const n = (await client.query(`SELECT COUNT(*)::int AS n FROM org_members WHERE org_id = $1 AND role = 'student'`, [found.org.id])).rows[0].n;
        full = !seatAvailable(await planOf(found.org), n);
      }
      if (!full) await client.query('INSERT INTO org_members (org_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [found.org.id, userId, found.role]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      client.release();
    }
    if (full) return res.status(409).json({ error: 'This institution has no free seats. Ask your institution to add seats.', code: 'no_seats' });
    const m = await membershipOf(userId);
    if (!m) return res.status(409).json({ error: 'You already belong to an institution.', code: 'already_member' });
    res.status(201).json({ org: await orgView(m) });
  } catch (error) {
    console.error('Org join error:', error);
    res.status(500).json({ error: 'Failed to join the institution' });
  }
});

// DELETE /api/orgs/membership — leave. Institution XP stays with the institution; personal XP is untouched.
router.delete('/membership', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const m = await membershipOf(userId);
    if (!m) return res.status(404).json({ error: 'You are not in an institution.' });
    if (m.role === 'admin') {
      const admins = (await pool.query(`SELECT COUNT(*)::int AS n FROM org_members WHERE org_id = $1 AND role = 'admin'`, [m.orgId])).rows[0].n;
      if (admins <= 1) return res.status(409).json({ error: 'Make another member an admin first, or close the institution.', code: 'last_admin' });
    }
    await pool.query('DELETE FROM org_members WHERE org_id = $1 AND user_id = $2', [m.orgId, userId]);
    // Guardian emails the institution added for me stop receiving my reports.
    await pool.query('DELETE FROM report_recipients WHERE user_id = $1 AND added_by_org = $2', [userId, m.orgId]);
    res.json({ left: true });
  } catch (error) {
    console.error('Org leave error:', error);
    res.status(500).json({ error: 'Failed to leave the institution' });
  }
});

/** Load the caller's membership and check a permission; answers the request on failure. */
async function staffGate(req: Request, res: Response, allowed: (role: string) => boolean): Promise<Membership | null> {
  const m = await membershipOf(req.user!.id);
  if (!m) { res.status(404).json({ error: 'You are not in an institution.', code: 'not_member' }); return null; }
  if (!allowed(m.role)) { res.status(403).json({ error: 'You do not have permission to do that.', code: 'forbidden' }); return null; }
  return m;
}

// PATCH /api/orgs/settings { name?, kind?, reportEmails? } — admin
router.patch('/settings', async (req: Request, res: Response) => {
  try {
    const m = await staffGate(req, res, can.editSettings);
    if (!m) return;
    const name = req.body?.name === undefined ? m.org.name : validOrgName(req.body.name);
    if (!name) return res.status(400).json({ error: 'Give the institution a name (2 to 80 characters).', code: 'bad_name' });
    const kind = req.body?.kind === undefined ? m.org.kind : validOrgKind(req.body.kind);
    if (!kind) return res.status(400).json({ error: 'Unknown institution type.', code: 'bad_kind' });
    let emails = m.org.report_emails;
    if (req.body?.reportEmails !== undefined) {
      if (!Array.isArray(req.body.reportEmails)) return res.status(400).json({ error: 'reportEmails must be a list' });
      const list = [...new Set(req.body.reportEmails.map((e: unknown) => String(e ?? '').trim().toLowerCase()).filter(Boolean))] as string[];
      if (list.length > MAX_REPORT_EMAILS) return res.status(400).json({ error: `At most ${MAX_REPORT_EMAILS} report emails.`, code: 'too_many' });
      const bad = list.find(e => !isValidEmail(e));
      if (bad) return res.status(400).json({ error: `"${bad}" is not a valid email address.`, code: 'bad_email' });
      emails = list;
    }
    await pool.query('UPDATE organizations SET name = $2, kind = $3, report_emails = $4 WHERE id = $1', [m.orgId, name, kind, emails]);
    res.json({ org: await orgView((await membershipOf(req.user!.id))!) });
  } catch (error) {
    console.error('Org settings error:', error);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// POST /api/orgs/rotate-codes { which: 'student' | 'staff' } — invalidate a leaked code (admin)
router.post('/rotate-codes', async (req: Request, res: Response) => {
  try {
    const m = await staffGate(req, res, can.editSettings);
    if (!m) return;
    const col = req.body?.which === 'staff' ? 'staff_code' : 'student_code';
    await pool.query(`UPDATE organizations SET ${col} = $2 WHERE id = $1`, [m.orgId, await uniqueCode()]);
    res.json({ org: await orgView((await membershipOf(req.user!.id))!) });
  } catch (error) {
    console.error('Org rotate error:', error);
    res.status(500).json({ error: 'Failed to rotate the code' });
  }
});

// DELETE /api/orgs { confirm: <institution name> } — close the institution for everyone (admin)
router.delete('/', async (req: Request, res: Response) => {
  try {
    const m = await staffGate(req, res, can.editSettings);
    if (!m) return;
    if (String(req.body?.confirm ?? '').trim() !== m.org.name) return res.status(400).json({ error: 'Type the institution name exactly to confirm.', code: 'confirm_required' });
    await pool.query('UPDATE organizations SET archived = true WHERE id = $1', [m.orgId]);
    await pool.query('DELETE FROM org_members WHERE org_id = $1', [m.orgId]);
    await pool.query('DELETE FROM report_recipients WHERE added_by_org = $1', [m.orgId]);
    res.json({ closed: true });
  } catch (error) {
    console.error('Org close error:', error);
    res.status(500).json({ error: 'Failed to close the institution' });
  }
});

// GET /api/orgs/members — institution progress per member (staff). Never personal data.
router.get('/members', async (req: Request, res: Response) => {
  try {
    const m = await staffGate(req, res, can.viewMembers);
    if (!m) return;
    const day = today(req);
    const since = addDays(day, -(ORG_WINDOW_DAYS - 1));
    const [members, tasks, comps, guardians] = await Promise.all([
      pool.query(
        `SELECT m.user_id, m.role, m.xp, m.joined_at, u.name FROM org_members m JOIN users u ON u.id = m.user_id
         WHERE m.org_id = $1 ORDER BY CASE m.role WHEN 'admin' THEN 0 WHEN 'teacher' THEN 1 ELSE 2 END, u.name`, [m.orgId]),
      pool.query(`SELECT id, recurrence, created_at FROM org_tasks WHERE org_id = $1 AND NOT archived`, [m.orgId]),
      pool.query(
        `SELECT user_id, task_id, completion_date::text AS d, xp_awarded FROM org_task_completions
         WHERE org_id = $1 AND completion_date >= $2::date`, [m.orgId, since]),
      pool.query(`SELECT user_id, COUNT(*)::int AS n FROM report_recipients WHERE added_by_org = $1 AND active GROUP BY user_id`, [m.orgId]),
    ]);
    const tz = requestTimeZone(req);
    const taskSched = tasks.rows.map((t: any) => ({ id: t.id, recurrence: t.recurrence, since: taskSince(t.created_at, tz) }));
    const byUser = new Map<number, { date: string; taskId: number }[]>();
    const weekXp = new Map<number, number>();
    const weekFrom = addDays(day, -6);
    for (const c of comps.rows) {
      if (!byUser.has(c.user_id)) byUser.set(c.user_id, []);
      byUser.get(c.user_id)!.push({ date: c.d, taskId: c.task_id });
      if (c.d >= weekFrom) weekXp.set(c.user_id, (weekXp.get(c.user_id) ?? 0) + c.xp_awarded);
    }
    const g = new Map<number, number>(guardians.rows.map((r: any) => [r.user_id, r.n]));
    const rows = members.rows.map((r: any) => {
      const p = memberProgress(byUser.get(r.user_id) ?? [], taskSched, day);
      return {
        userId: r.user_id, name: r.name, role: r.role, ...levelOf(r.xp), weekXp: weekXp.get(r.user_id) ?? 0,
        activeDays7: p.activeDays7, activeDays28: p.activeDays28, completionPct: p.completionPct, lastActive: p.lastActive,
        guardians: g.get(r.user_id) ?? 0, joinedAt: r.joined_at, you: r.user_id === req.user!.id,
      };
    });
    const students = rows.filter(r => r.role === 'student');
    const pcts = students.map(s => s.completionPct).filter((p): p is number => p !== null);
    res.set('Cache-Control', 'no-store');
    res.json({
      windowDays: ORG_WINDOW_DAYS,
      summary: {
        students: students.length,
        staff: rows.length - students.length,
        activeThisWeek: students.filter(s => s.activeDays7 > 0).length,
        avgCompletionPct: pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null,
        weekXp: students.reduce((a, s) => a + s.weekXp, 0),
      },
      members: rows,
    });
  } catch (error) {
    console.error('Org members error:', error);
    res.status(500).json({ error: 'Failed to load members' });
  }
});

const targetMember = async (orgId: number, raw: unknown) => {
  const id = Number(raw);
  if (!Number.isInteger(id)) return null;
  return (await pool.query('SELECT user_id, role FROM org_members WHERE org_id = $1 AND user_id = $2', [orgId, id])).rows[0] ?? null;
};

// PATCH /api/orgs/members/:userId { role } — admin
router.patch('/members/:userId', async (req: Request, res: Response) => {
  try {
    const m = await staffGate(req, res, can.changeRoles);
    if (!m) return;
    const t = await targetMember(m.orgId, req.params.userId);
    if (!t) return res.status(404).json({ error: 'Member not found' });
    const role = req.body?.role;
    if (!['admin', 'teacher', 'student'].includes(role)) return res.status(400).json({ error: 'role must be admin, teacher or student' });
    if (t.user_id === req.user!.id && role !== 'admin') {
      const admins = (await pool.query(`SELECT COUNT(*)::int AS n FROM org_members WHERE org_id = $1 AND role = 'admin'`, [m.orgId])).rows[0].n;
      if (admins <= 1) return res.status(409).json({ error: 'An institution needs at least one admin.', code: 'last_admin' });
    }
    if (role !== 'student') {
      const u = (await pool.query('SELECT consent_status FROM users WHERE id = $1', [t.user_id])).rows[0];
      if (u?.consent_status !== 'not_required') return res.status(403).json({ error: 'Staff accounts are for adults.', code: 'adult_required' });
    } else if (t.role !== 'student') {
      if (!seatAvailable(await planOf(m.org), await studentCount(m.orgId))) return res.status(409).json({ error: 'No free seats for another student.', code: 'no_seats' });
    }
    await pool.query('UPDATE org_members SET role = $3 WHERE org_id = $1 AND user_id = $2', [m.orgId, t.user_id, role]);
    res.json({ userId: t.user_id, role });
  } catch (error) {
    console.error('Org role error:', error);
    res.status(500).json({ error: 'Failed to change the role' });
  }
});

// DELETE /api/orgs/members/:userId — remove a member (admins remove anyone but admins; teachers remove students)
router.delete('/members/:userId', async (req: Request, res: Response) => {
  try {
    const m = await staffGate(req, res, isStaff);
    if (!m) return;
    const t = await targetMember(m.orgId, req.params.userId);
    if (!t) return res.status(404).json({ error: 'Member not found' });
    if (t.user_id === req.user!.id) return res.status(400).json({ error: 'Use "Leave institution" to remove yourself.' });
    if (!can.removeMember(m.role, t.role)) return res.status(403).json({ error: 'You do not have permission to remove this member.', code: 'forbidden' });
    await pool.query('DELETE FROM org_members WHERE org_id = $1 AND user_id = $2', [m.orgId, t.user_id]);
    await pool.query('DELETE FROM report_recipients WHERE user_id = $1 AND added_by_org = $2', [t.user_id, m.orgId]);
    res.json({ removed: true });
  } catch (error) {
    console.error('Org remove error:', error);
    res.status(500).json({ error: 'Failed to remove the member' });
  }
});

// ── Guardian emails (institution-scoped weekly reports for a student) ───────

// GET /api/orgs/members/:userId/guardians — staff
router.get('/members/:userId/guardians', async (req: Request, res: Response) => {
  try {
    const m = await staffGate(req, res, can.addGuardian);
    if (!m) return;
    const t = await targetMember(m.orgId, req.params.userId);
    if (!t) return res.status(404).json({ error: 'Member not found' });
    const r = await pool.query(
      `SELECT id, email, relation, active, last_sent_at FROM report_recipients WHERE user_id = $1 AND added_by_org = $2 ORDER BY id`, [t.user_id, m.orgId]);
    res.json({ guardians: r.rows.map((g: any) => ({ id: g.id, email: g.email, relation: g.relation, active: g.active, lastSentAt: g.last_sent_at })) });
  } catch (error) {
    console.error('Guardian list error:', error);
    res.status(500).json({ error: 'Failed to load guardian emails' });
  }
});

// POST /api/orgs/members/:userId/guardians { email, relation } — staff add a parent/guardian who receives the institution report
router.post('/members/:userId/guardians', async (req: Request, res: Response) => {
  try {
    const m = await staffGate(req, res, can.addGuardian);
    if (!m) return;
    const t = await targetMember(m.orgId, req.params.userId);
    if (!t || t.role !== 'student') return res.status(404).json({ error: 'Student not found' });
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    if (!isValidEmail(email)) return res.status(400).json({ error: 'Enter a valid email address.', code: 'bad_email' });
    const relation = RELATIONS.includes(req.body?.relation) ? req.body.relation : 'parent';
    const n = (await pool.query('SELECT COUNT(*)::int AS n FROM report_recipients WHERE user_id = $1', [t.user_id])).rows[0].n;
    if (n >= MAX_REPORT_EMAILS) return res.status(409).json({ error: `A student can have at most ${MAX_REPORT_EMAILS} report recipients.`, code: 'too_many' });
    const r = await pool.query(
      `INSERT INTO report_recipients (user_id, email, relation, scope, added_by_org)
       VALUES ($1, $2, $3, 'org', $4)
       ON CONFLICT (user_id, email) DO NOTHING RETURNING id`,
      [t.user_id, email, relation, m.orgId]);
    if (!r.rowCount) return res.status(409).json({ error: 'That email already receives this student’s report.', code: 'duplicate' });
    res.status(201).json({ id: r.rows[0].id, email, relation, active: true });
  } catch (error) {
    console.error('Guardian add error:', error);
    res.status(500).json({ error: 'Failed to add the guardian email' });
  }
});

// DELETE /api/orgs/members/:userId/guardians/:id — staff
router.delete('/members/:userId/guardians/:id', async (req: Request, res: Response) => {
  try {
    const m = await staffGate(req, res, can.addGuardian);
    if (!m) return;
    const r = await pool.query('DELETE FROM report_recipients WHERE id = $1 AND user_id = $2 AND added_by_org = $3',
      [Number(req.params.id) || 0, Number(req.params.userId) || 0, m.orgId]);
    if (!r.rowCount) return res.status(404).json({ error: 'Guardian email not found' });
    res.json({ removed: true });
  } catch (error) {
    console.error('Guardian remove error:', error);
    res.status(500).json({ error: 'Failed to remove the guardian email' });
  }
});

// ── Core tasks: the shared timetable staff assign to every member ───────────

// GET /api/orgs/tasks — every member
router.get('/tasks', async (req: Request, res: Response) => {
  try {
    const m = await membershipOf(req.user!.id);
    if (!m) return res.status(404).json({ error: 'You are not in an institution.', code: 'not_member' });
    res.set('Cache-Control', 'no-store');
    res.json({ tasks: await tasksFor(m.orgId, req.user!.id, today(req)) });
  } catch (error) {
    console.error('Org tasks error:', error);
    res.status(500).json({ error: 'Failed to load core tasks' });
  }
});

// POST /api/orgs/tasks { title, description?, difficulty, scheduleTime?, recurrence? } — staff
router.post('/tasks', async (req: Request, res: Response) => {
  try {
    const m = await staffGate(req, res, can.manageTasks);
    if (!m) return;
    const t = sanitizeOrgTask(req.body);
    if (typeof t === 'string') return res.status(400).json({ error: t });
    const n = (await pool.query('SELECT COUNT(*)::int AS n FROM org_tasks WHERE org_id = $1 AND NOT archived', [m.orgId])).rows[0].n;
    if (n >= MAX_ORG_TASKS) return res.status(409).json({ error: `An institution can have at most ${MAX_ORG_TASKS} core tasks.`, code: 'too_many' });
    const r = await pool.query(
      `INSERT INTO org_tasks (org_id, title, description, difficulty, xp_reward, schedule_time, recurrence, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [m.orgId, t.title, t.description, t.difficulty, t.xpReward, t.scheduleTime, t.recurrence, req.user!.id]);
    res.status(201).json({ id: r.rows[0].id, ...t });
  } catch (error) {
    console.error('Org task create error:', error);
    res.status(500).json({ error: 'Failed to add the core task' });
  }
});

// PATCH /api/orgs/tasks/:id — staff. Completions already earned keep their XP.
router.patch('/tasks/:id', async (req: Request, res: Response) => {
  try {
    const m = await staffGate(req, res, can.manageTasks);
    if (!m) return;
    const cur = (await pool.query('SELECT * FROM org_tasks WHERE id = $1 AND org_id = $2 AND NOT archived', [Number(req.params.id) || 0, m.orgId])).rows[0];
    if (!cur) return res.status(404).json({ error: 'Core task not found' });
    const t = sanitizeOrgTask({
      title: cur.title, description: cur.description, difficulty: cur.difficulty, scheduleTime: cur.schedule_time,
      recurrence: cur.recurrence ?? undefined, ...req.body,
    });
    if (typeof t === 'string') return res.status(400).json({ error: t });
    await pool.query(
      `UPDATE org_tasks SET title = $2, description = $3, difficulty = $4, xp_reward = $5, schedule_time = $6, recurrence = $7 WHERE id = $1`,
      [cur.id, t.title, t.description, t.difficulty, t.xpReward, t.scheduleTime, t.recurrence]);
    res.json({ id: cur.id, ...t });
  } catch (error) {
    console.error('Org task update error:', error);
    res.status(500).json({ error: 'Failed to update the core task' });
  }
});

// DELETE /api/orgs/tasks/:id — staff (archived: history and earned XP remain)
router.delete('/tasks/:id', async (req: Request, res: Response) => {
  try {
    const m = await staffGate(req, res, can.manageTasks);
    if (!m) return;
    const r = await pool.query('UPDATE org_tasks SET archived = true WHERE id = $1 AND org_id = $2 AND NOT archived', [Number(req.params.id) || 0, m.orgId]);
    if (!r.rowCount) return res.status(404).json({ error: 'Core task not found' });
    res.json({ removed: true });
  } catch (error) {
    console.error('Org task delete error:', error);
    res.status(500).json({ error: 'Failed to remove the core task' });
  }
});

// POST /api/orgs/tasks/:id/toggle — complete or undo today's core task. Moves INSTITUTION XP only.
router.post('/tasks/:id/toggle', async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const client = await pool.connect();
  try {
    const m = await membershipOf(userId);
    if (!m) return res.status(404).json({ error: 'You are not in an institution.', code: 'not_member' });
    const day = today(req);
    await client.query('BEGIN');
    const task = (await client.query('SELECT id, title, xp_reward, recurrence FROM org_tasks WHERE id = $1 AND org_id = $2 AND NOT archived',
      [Number(req.params.id) || 0, m.orgId])).rows[0];
    if (!task) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Core task not found' }); }
    // Serialise this member's ledger so double taps cannot double-award.
    await client.query('SELECT xp FROM org_members WHERE org_id = $1 AND user_id = $2 FOR UPDATE', [m.orgId, userId]);
    const existing = (await client.query(
      'DELETE FROM org_task_completions WHERE task_id = $1 AND user_id = $2 AND completion_date = $3::date RETURNING xp_awarded',
      [task.id, userId, day])).rows[0];
    let delta: number;
    let action: 'completed' | 'undone';
    if (existing) {
      delta = -existing.xp_awarded;
      action = 'undone';
    } else {
      if (!scheduledOn(task.recurrence, day)) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'This core task is not scheduled for today' }); }
      await client.query(
        'INSERT INTO org_task_completions (org_id, task_id, user_id, completion_date, xp_awarded) VALUES ($1, $2, $3, $4, $5)',
        [m.orgId, task.id, userId, day, task.xp_reward]);
      delta = task.xp_reward;
      action = 'completed';
    }
    const xp = (await client.query('UPDATE org_members SET xp = xp + $3 WHERE org_id = $1 AND user_id = $2 RETURNING xp', [m.orgId, userId, delta])).rows[0].xp;
    // Logged with `orgXp`, never `xp`: personal XP history must not count institution work.
    await client.query('INSERT INTO activity_log (user_id, action, entity, details) VALUES ($1, $2, $3, $4)',
      [userId, action === 'completed' ? 'org_task_complete' : 'org_task_undo', `OT-${task.id}`, JSON.stringify({ orgXp: delta, org: m.orgId, title: task.title })]);
    await client.query('COMMIT');
    res.json({ action, orgXpGained: delta, progress: levelOf(xp) });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Org task toggle error:', error);
    res.status(500).json({ error: 'Failed to update the core task' });
  } finally {
    client.release();
  }
});

// ── Billing: seats per year ─────────────────────────────────────────────────

// GET /api/orgs/billing — price per seat and current plan (admin)
router.get('/billing', async (req: Request, res: Response) => {
  try {
    const m = await staffGate(req, res, can.manageBilling);
    if (!m) return;
    const group = priceGroupFor(detectRegion(req) ?? 'IN');
    const seat = priceFor('teams', 'year', group);
    const plan = await planOf(m.org);
    res.set('Cache-Control', 'no-store');
    res.json({
      seatPrice: seat, plan, students: await studentCount(m.orgId),
      checkoutEnabled: !!getProvider(providerFor(seat.currency)),
    });
  } catch (error) {
    console.error('Org billing error:', error);
    res.status(500).json({ error: 'Failed to load billing' });
  }
});

// POST /api/orgs/checkout { seats } → { url } (admin). Seats arrive only through the verified webhook.
router.post('/checkout', async (req: Request, res: Response) => {
  try {
    const m = await staffGate(req, res, can.manageBilling);
    if (!m) return;
    const wait = hit(`org-checkout:${req.user!.id}`, 10, 60 * 60_000);
    if (wait) return tooMany(res, wait, 'checkout attempts');
    const seats = Number(req.body?.seats);
    if (!Number.isInteger(seats) || seats < 1 || seats > 5000) return res.status(400).json({ error: 'Choose between 1 and 5000 seats.', code: 'bad_seats' });
    const group = priceGroupFor(detectRegion(req) ?? 'IN');
    const seat = priceFor('teams', 'year', group);
    const provider = getProvider(providerFor(seat.currency));
    if (!provider) return res.status(503).json({ error: 'Online payments are not available yet. Contact us for an invoice.', code: 'payments_not_configured' });
    const u = (await pool.query('SELECT username FROM users WHERE id = $1', [req.user!.id])).rows[0];
    const amountMinor = seat.amountMinor * seats;
    const { url } = await provider.createCheckout({
      userId: req.user!.id, username: u.username, plan: 'teams', interval: 'year', currency: seat.currency, amountMinor,
      orgId: m.orgId, seats,
      successUrl: `${appUrl()}/org?checkout=success`, cancelUrl: `${appUrl()}/org?checkout=cancelled`,
    });
    res.json({ url, currency: seat.currency, amountMinor, seats });
  } catch (error) {
    if (error instanceof ProviderError) {
      console.error('Org checkout provider error:', error.message);
      return res.status(502).json({ error: 'The payment provider could not start checkout. Please try again.', code: 'provider_error' });
    }
    console.error('Org checkout error:', error);
    res.status(500).json({ error: 'Failed to start checkout' });
  }
});

export default router;
