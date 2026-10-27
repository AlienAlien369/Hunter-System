/**
 * Integration tests for institutions (B2B) next to individuals (B2C):
 * setting up an institution, joining by student/staff code, seats, the core
 * timetable, the two separate XP ledgers, what staff can and cannot see,
 * guardian and personal weekly-report recipients, and the super admin's
 * platform settings (dynamic brand name and prices).
 * Requires the server on localhost:3000 with ADMIN_USERNAMES=admin_e2e.
 * Run with: node --test src/tests/orgs.test.ts
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import pg from 'pg';

const BASE_URL = 'http://localhost:3000';
const db = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'hunter',
  password: process.env.DB_PASSWORD || 'hunterpass',
  database: process.env.DB_NAME || 'hunter_system',
});
const json = { 'Content-Type': 'application/json' };
const PASS = 'OrgPass123!';
const ADMIN = process.env.ADMIN_E2E_USER || 'admin_e2e';
// Shared with analytics.test.ts, which may have created the admin account first.
const ADMIN_PASS = process.env.ADMIN_E2E_PASS || 'AnalyticsPass123!';
const suffix = Date.now();
const made: number[] = [];

type H = { id: number; cookie: string; username: string };
async function hunter(name: string, opts: { consent?: string } = {}): Promise<H> {
  const username = `org_${name}_${suffix}`;
  const res = await fetch(`${BASE_URL}/api/auth/register`, { method: 'POST', headers: json, body: JSON.stringify({ username, password: PASS, birthMonth: '1990-01', acceptTerms: true }) });
  assert.strictEqual(res.status, 201);
  const cookie = (res.headers.get('set-cookie') || '').split(';')[0];
  const id = (await (await fetch(`${BASE_URL}/api/auth/me`, { headers: { Cookie: cookie } })).json()).user.id as number;
  made.push(id);
  await db.query('UPDATE users SET name_set = true, name = $2 WHERE id = $1', [id, `H_${name}_${suffix}`.slice(0, 30)]);
  if (opts.consent) await db.query('UPDATE users SET consent_status = $2 WHERE id = $1', [id, opts.consent]);
  return { id, cookie, username };
}
async function signIn(username: string, password = ADMIN_PASS): Promise<string> {
  let res = await fetch(`${BASE_URL}/api/auth/register`, { method: 'POST', headers: json, body: JSON.stringify({ username, password, birthMonth: '1990-01', acceptTerms: true }) });
  if (res.status === 409) res = await fetch(`${BASE_URL}/api/auth/login`, { method: 'POST', headers: json, body: JSON.stringify({ username, password }) });
  assert.ok(res.ok, `sign-in failed for ${username}: ${res.status}`);
  const cookie = (res.headers.get('set-cookie') || '').split(';')[0];
  const me = (await (await fetch(`${BASE_URL}/api/auth/me`, { headers: { Cookie: cookie } })).json()).user;
  if (me.consentStatus === 'needs_age') await fetch(`${BASE_URL}/api/auth/age`, { method: 'POST', headers: { ...json, Cookie: cookie }, body: JSON.stringify({ birthMonth: '1990-01' }) });
  return cookie;
}
const api = async (cookie: string | null, method: string, path: string, body?: unknown) => {
  const r = await fetch(`${BASE_URL}/api${path}`, { method, headers: { ...json, ...(cookie ? { Cookie: cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: r.status, body: (await r.json().catch(() => null)) as any };
};

describe('Institutions (B2B) and individuals (B2C)', () => {
  let principal: H, teacher: H, s1: H, s2: H, solo: H, outsider: H;
  let studentCode: string, staffCode: string, orgId: number, taskId: number, weeklyTaskId: number;

  before(async () => {
    [principal, teacher, s1, s2, solo, outsider] = await Promise.all(['principal', 'teacher', 's1', 's2', 'solo', 'outsider'].map(n => hunter(n)));
  });
  after(async () => {
    if (orgId) await db.query('DELETE FROM organizations WHERE id = $1', [orgId]);
    await db.query('DELETE FROM users WHERE id = ANY($1)', [made]);
    await db.end();
  });

  describe('setting up', () => {
    it('requires a session, a name and an adult', async () => {
      assert.strictEqual((await api(null, 'POST', '/orgs', { name: 'X School' })).status, 401);
      assert.strictEqual((await api(principal.cookie, 'POST', '/orgs', { name: 'x' })).body.code, 'bad_name');
      assert.strictEqual((await api(principal.cookie, 'POST', '/orgs', { name: 'Fine', kind: 'casino' })).body.code, 'bad_kind');
      const teen = await hunter('teen', { consent: 'granted' });
      assert.strictEqual((await api(teen.cookie, 'POST', '/orgs', { name: 'Teen Inc' })).body.code, 'adult_required');
    });
    it('makes the creator admin and starts the free trial', async () => {
      const r = await api(principal.cookie, 'POST', '/orgs', { name: '  Sunrise   Academy ', kind: 'coaching' });
      assert.strictEqual(r.status, 201);
      assert.strictEqual(r.body.org.name, 'Sunrise Academy');
      assert.strictEqual(r.body.org.role, 'admin');
      assert.strictEqual(r.body.org.plan.trial, true);
      assert.ok(r.body.org.plan.seats > 0);
      assert.match(r.body.org.studentCode, /^[A-HJ-NP-Z2-9]{6}$/);
      assert.notStrictEqual(r.body.org.studentCode, r.body.org.staffCode);
      ({ id: orgId, studentCode, staffCode } = r.body.org);
    });
    it('allows one institution per person', async () => {
      assert.strictEqual((await api(principal.cookie, 'POST', '/orgs', { name: 'Second' })).body.code, 'already_member');
    });
    it('reports no institution for an individual', async () => {
      assert.deepStrictEqual((await api(solo.cookie, 'GET', '/orgs/me')).body, { org: null });
    });
  });

  describe('joining', () => {
    it('shows what staff will and will not see before joining', async () => {
      const r = await api(s1.cookie, 'GET', `/orgs/lookup?code=${studentCode.toLowerCase()}`);
      assert.strictEqual(r.status, 200);
      assert.strictEqual(r.body.role, 'student');
      assert.ok(r.body.staffNeverSees.includes('personalTasks'));
      assert.strictEqual((await api(s1.cookie, 'GET', '/orgs/lookup?code=ZZZZZZ')).status, 404);
      assert.strictEqual((await api(s1.cookie, 'GET', '/orgs/lookup?code=bad')).status, 400);
    });
    it('joins students with the student code and teachers with the staff code', async () => {
      assert.strictEqual((await api(s1.cookie, 'POST', '/orgs/join', { code: studentCode })).status, 201);
      assert.strictEqual((await api(s2.cookie, 'POST', '/orgs/join', { code: studentCode })).status, 201);
      const t = await api(teacher.cookie, 'POST', '/orgs/join', { code: staffCode });
      assert.strictEqual(t.body.org.role, 'teacher');
      assert.strictEqual(t.body.org.staffCode, undefined, 'only admins see the staff code');
      assert.ok(t.body.org.studentCode, 'teachers can share the student code');
    });
    it('hides codes and seats from students', async () => {
      const r = await api(s1.cookie, 'GET', '/orgs/me');
      assert.strictEqual(r.body.org.role, 'student');
      assert.strictEqual(r.body.org.studentCode, undefined);
      assert.strictEqual(r.body.org.plan, undefined);
    });
    it('stops students joining when the seats are used up', async () => {
      await db.query('UPDATE organizations SET seats = 2 WHERE id = $1', [orgId]);
      const r = await api(outsider.cookie, 'POST', '/orgs/join', { code: studentCode });
      assert.deepStrictEqual({ s: r.status, c: r.body.code }, { s: 409, c: 'no_seats' });
      await db.query('UPDATE organizations SET seats = 30 WHERE id = $1', [orgId]);
    });
    it('gives members of an active institution Pro', async () => {
      const r = await api(s1.cookie, 'GET', '/billing/me');
      assert.deepStrictEqual({ p: r.body.plan, s: r.body.source }, { p: 'pro', s: 'org' });
      assert.strictEqual((await api(solo.cookie, 'GET', '/billing/me')).body.plan, 'free');
    });
  });

  describe('core timetable and the two XP ledgers', () => {
    it('lets staff, not students, assign core tasks', async () => {
      assert.strictEqual((await api(s1.cookie, 'POST', '/orgs/tasks', { title: 'Hack', difficulty: 3 })).status, 403);
      const r = await api(teacher.cookie, 'POST', '/orgs/tasks', { title: 'Morning revision', description: 'Chapter 4', difficulty: 2, scheduleTime: '06:30', xpReward: 9999 });
      assert.strictEqual(r.status, 201);
      assert.notStrictEqual(r.body.xpReward, 9999, 'XP follows difficulty');
      taskId = r.body.id;
      // A task scheduled on no day of this week except one that is not today.
      const todayCode = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][new Date().getUTCDay()];
      const other = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].find(d => d !== todayCode)!;
      weeklyTaskId = (await api(principal.cookie, 'POST', '/orgs/tasks', { title: 'Weekly test', difficulty: 3, recurrence: [other] })).body.id;
    });
    it('shows every member the same core tasks', async () => {
      const a = (await api(s1.cookie, 'GET', '/orgs/tasks')).body.tasks.map((t: any) => t.title);
      const b = (await api(s2.cookie, 'GET', '/orgs/tasks')).body.tasks.map((t: any) => t.title);
      assert.deepStrictEqual(a, b);
      assert.ok(a.includes('Morning revision'));
      assert.strictEqual((await api(solo.cookie, 'GET', '/orgs/tasks')).status, 404);
    });
    it('puts core-task XP on the institution ledger only', async () => {
      const before = (await db.query('SELECT xp FROM users WHERE id = $1', [s1.id])).rows[0].xp;
      const r = await api(s1.cookie, 'POST', `/orgs/tasks/${taskId}/toggle`);
      assert.strictEqual(r.status, 200);
      assert.strictEqual(r.body.action, 'completed');
      assert.ok(r.body.orgXpGained > 0);
      const after = (await db.query('SELECT xp FROM users WHERE id = $1', [s1.id])).rows[0].xp;
      assert.strictEqual(after, before, 'personal XP untouched');
      const me = (await api(s1.cookie, 'GET', '/orgs/me')).body;
      assert.strictEqual(me.progress.xp, r.body.orgXpGained);
      assert.strictEqual(me.tasks.find((t: any) => t.id === taskId).done, true);
      // Personal XP history never counts institution work.
      const hist = await db.query(`SELECT details FROM activity_log WHERE user_id = $1 AND action = 'org_task_complete'`, [s1.id]);
      assert.strictEqual(hist.rows[0].details.xp, undefined);
    });
    it('undoes exactly what was awarded, and cannot double-award', async () => {
      const r = await api(s1.cookie, 'POST', `/orgs/tasks/${taskId}/toggle`);
      assert.strictEqual(r.body.action, 'undone');
      assert.strictEqual((await api(s1.cookie, 'GET', '/orgs/me')).body.progress.xp, 0);
      const burst = await Promise.all(Array.from({ length: 6 }, () => api(s1.cookie, 'POST', `/orgs/tasks/${taskId}/toggle`)));
      assert.ok(burst.every(b => b.status === 200));
      const xp = (await api(s1.cookie, 'GET', '/orgs/me')).body.progress.xp;
      const rows = (await db.query('SELECT COUNT(*)::int AS n FROM org_task_completions WHERE user_id = $1 AND task_id = $2', [s1.id, taskId])).rows[0].n;
      assert.strictEqual(xp, rows * (await db.query('SELECT xp_reward FROM org_tasks WHERE id = $1', [taskId])).rows[0].xp_reward);
      if (rows === 0) await api(s1.cookie, 'POST', `/orgs/tasks/${taskId}/toggle`); // leave it completed for the dashboards below
    });
    it('refuses a core task that is not scheduled today', async () => {
      assert.strictEqual((await api(s1.cookie, 'POST', `/orgs/tasks/${weeklyTaskId}/toggle`)).status, 400);
    });
    it('keeps personal XP growing independently', async () => {
      // A personal module task moves users.xp and never the institution ledger.
      const mod = await api(s1.cookie, 'POST', '/modules', { name: 'Guitar', kind: 'tasks', acknowledged: true, tasks: [{ title: 'Practice chords', difficulty: 1 }] });
      assert.strictEqual(mod.status, 201, JSON.stringify(mod.body));
      const q = (await db.query(`SELECT quest_id FROM quests WHERE user_id = $1 AND category <> 'routine' AND NOT archived LIMIT 1`, [s1.id])).rows[0];
      assert.ok(q, 'personal task created');
      const orgXp = (await api(s1.cookie, 'GET', '/orgs/me')).body.progress.xp;
      const r = await fetch(`${BASE_URL}/api/quests/${q.quest_id}/complete`, { method: 'PATCH', headers: { Cookie: s1.cookie } });
      assert.strictEqual(r.status, 200);
      assert.strictEqual((await api(s1.cookie, 'GET', '/orgs/me')).body.progress.xp, orgXp);
    });
  });

  describe('what staff see', () => {
    it('shows institution progress per member, never personal data', async () => {
      const r = await api(teacher.cookie, 'GET', '/orgs/members');
      assert.strictEqual(r.status, 200);
      const row = r.body.members.find((m: any) => m.userId === s1.id);
      assert.ok(row.xp > 0 && row.level >= 1);
      const text = JSON.stringify(r.body);
      assert.ok(!text.includes('Guitar') && !text.includes('Practice chords'), 'no personal modules or tasks');
      assert.ok(!('personalXp' in row));
      assert.strictEqual(r.body.summary.students, 2);
      assert.strictEqual((await api(s1.cookie, 'GET', '/orgs/members')).status, 403);
    });
    it('lets only admins change roles and settings', async () => {
      assert.strictEqual((await api(teacher.cookie, 'PATCH', `/orgs/members/${s2.id}`, { role: 'teacher' })).status, 403);
      assert.strictEqual((await api(teacher.cookie, 'PATCH', '/orgs/settings', { name: 'Hijack' })).status, 403);
      const r = await api(principal.cookie, 'PATCH', '/orgs/settings', { reportEmails: ['Principal@Example.com', 'principal@example.com'] });
      assert.deepStrictEqual(r.body.org.reportEmails, ['principal@example.com']);
      assert.strictEqual((await api(principal.cookie, 'PATCH', '/orgs/settings', { reportEmails: ['nope'] })).body.code, 'bad_email');
    });
    it('keeps at least one admin', async () => {
      assert.strictEqual((await api(principal.cookie, 'PATCH', `/orgs/members/${principal.id}`, { role: 'teacher' })).body.code, 'last_admin');
      assert.strictEqual((await api(principal.cookie, 'DELETE', '/orgs/membership')).body.code, 'last_admin');
    });
    it('lets teachers remove students but not other staff', async () => {
      assert.strictEqual((await api(teacher.cookie, 'DELETE', `/orgs/members/${principal.id}`)).status, 403);
    });
  });

  describe('weekly reports', () => {
    it('lets staff add a guardian who gets the institution part only', async () => {
      const r = await api(teacher.cookie, 'POST', `/orgs/members/${s1.id}/guardians`, { email: 'Parent.S1@Example.com', relation: 'parent' });
      assert.strictEqual(r.status, 201);
      const mine = (await api(s1.cookie, 'GET', '/reports/recipients')).body.recipients;
      const g = mine.find((x: any) => x.email === 'parent.s1@example.com');
      assert.deepStrictEqual({ scope: g.scope, managed: g.managedByInstitution }, { scope: 'org', managed: true });
      // The student sees it but cannot delete or widen it.
      assert.strictEqual((await api(s1.cookie, 'DELETE', `/reports/recipients/${g.id}`)).body.code, 'managed_by_institution');
      assert.strictEqual((await api(s1.cookie, 'PATCH', `/reports/recipients/${g.id}`, { scope: 'both' })).body.code, 'managed_by_institution');
      assert.strictEqual((await api(s2.cookie, 'POST', `/orgs/members/${s1.id}/guardians`, { email: 'x@example.com' })).status, 403);
    });
    it('lets anyone choose their own recipients and what they receive', async () => {
      const add = await api(s1.cookie, 'POST', '/reports/recipients', { email: 'friend@example.com', relation: 'friend', scope: 'personal' });
      assert.strictEqual(add.status, 201);
      assert.strictEqual((await api(s1.cookie, 'POST', '/reports/recipients', { email: 'friend@example.com' })).body.code, 'duplicate');
      assert.strictEqual((await api(s1.cookie, 'POST', '/reports/recipients', { email: 'bad' })).body.code, 'bad_email');
      const upd = await api(s1.cookie, 'PATCH', `/reports/recipients/${add.body.id}`, { scope: 'both', active: false });
      assert.deepStrictEqual({ s: upd.body.scope, a: upd.body.active }, { s: 'both', a: false });
      // An individual has no institution report to send.
      assert.strictEqual((await api(solo.cookie, 'POST', '/reports/recipients', { email: 'mum@example.com', scope: 'org' })).body.code, 'bad_scope');
      assert.strictEqual((await api(solo.cookie, 'POST', '/reports/recipients', { email: 'mum@example.com', relation: 'parent' })).status, 201);
      // Nobody can touch someone else's recipients.
      assert.strictEqual((await api(solo.cookie, 'DELETE', `/reports/recipients/${add.body.id}`)).status, 404);
    });
    it('builds a report with separate institution and personal parts', async () => {
      const both = (await api(s1.cookie, 'GET', '/reports/weekly?scope=both')).body;
      assert.ok(both.data.org && both.data.org.xpGained > 0);
      assert.ok(both.data.personal.xpGained > 0);
      assert.match(both.preview.text, /INSTITUTION/);
      assert.match(both.preview.text, /PERSONAL GROWTH/);
      const org = (await api(s1.cookie, 'GET', '/reports/weekly?scope=org')).body;
      assert.doesNotMatch(org.preview.text, /Personal XP/);
      const b2c = (await api(solo.cookie, 'GET', '/reports/weekly')).body;
      assert.strictEqual(b2c.data.org, null);
    });
    it('gives staff the institution summary', async () => {
      const r = await api(teacher.cookie, 'GET', '/reports/org/weekly');
      assert.strictEqual(r.status, 200);
      assert.strictEqual(r.body.data.students.length, 2);
      assert.strictEqual((await api(s1.cookie, 'GET', '/reports/org/weekly')).status, 403);
    });
    it('unsubscribes with the emailed link and rejects forged ones', async () => {
      const bad = await fetch(`${BASE_URL}/api/public/report-unsubscribe?token=1.forged`);
      assert.strictEqual(bad.status, 400);
    });
  });

  describe('leaving', () => {
    it('keeps personal XP and drops the institution-added guardian', async () => {
      const personal = (await db.query('SELECT xp FROM users WHERE id = $1', [s1.id])).rows[0].xp;
      assert.strictEqual((await api(s1.cookie, 'DELETE', '/orgs/membership')).status, 200);
      assert.strictEqual((await db.query('SELECT xp FROM users WHERE id = $1', [s1.id])).rows[0].xp, personal);
      const left = (await api(s1.cookie, 'GET', '/reports/recipients')).body.recipients;
      assert.ok(!left.some((x: any) => x.managedByInstitution));
      assert.deepStrictEqual((await api(s1.cookie, 'GET', '/orgs/me')).body, { org: null });
    });
  });

  describe('super admin platform settings', () => {
    let admin: string;
    let original: any;
    before(async () => { admin = await signIn(ADMIN); original = (await api(admin, 'GET', '/admin/settings')).body.settings; });
    after(async () => { if (original) await api(admin, 'PUT', '/admin/settings', original); });

    it('is closed to everyone else, including institution admins', async () => {
      assert.strictEqual((await api(null, 'PUT', '/admin/settings', { brandName: 'Pwned' })).status, 401);
      assert.strictEqual((await api(principal.cookie, 'PUT', '/admin/settings', { brandName: 'Pwned' })).status, 403);
      assert.strictEqual((await api(principal.cookie, 'GET', '/admin/orgs')).status, 403);
    });
    it('renames the website and reprices it for everyone at once', async () => {
      const r = await api(admin, 'PUT', '/admin/settings', { brandName: 'Study Quest', proYearInr: 60000, orgSeatYearInr: 55000 });
      assert.strictEqual(r.status, 200);
      const cfg = (await api(null, 'GET', '/public/config')).body;
      assert.strictEqual(cfg.brand.name, 'Study Quest');
      assert.strictEqual(cfg.pricing.individual.yearMinor, 60000);
      assert.strictEqual(cfg.pricing.organization.seatYearMinor, 55000);
      const plans = (await api(null, 'GET', '/billing/plans?region=IN')).body;
      assert.strictEqual(plans.plans.find((p: any) => p.id === 'pro').prices.year.amountMinor, 60000);
      assert.strictEqual((await api(admin, 'PUT', '/admin/settings', { brandName: '<x>' })).status, 400);
    });
    it('lists institutions and grants seats offline', async () => {
      const list = (await api(admin, 'GET', '/admin/orgs')).body.orgs;
      assert.ok(list.some((o: any) => o.id === orgId));
      const until = new Date(Date.now() + 365 * 86_400_000).toISOString();
      const r = await api(admin, 'PATCH', `/admin/orgs/${orgId}`, { seats: 500, planUntil: until });
      assert.strictEqual(r.status, 200);
      assert.strictEqual((await api(principal.cookie, 'GET', '/orgs/me')).body.org.plan.seats, 500);
    });
  });
});
