/**
 * Integration tests for classes: creating, joining by code, the teacher's
 * consistency-only dashboard and its access control, leaving/removing, limits.
 * Requires the server on localhost:3000.
 * Run with: node --test src/tests/classes.test.ts
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
const PASS = 'ClassPass123!';
const suffix = Date.now();
const made: number[] = [];

type H = { id: number; cookie: string; username: string };
async function hunter(name: string, opts: { named?: boolean; consent?: string } = {}): Promise<H> {
  const username = `cl_${name}_${suffix}`;
  const res = await fetch(`${BASE_URL}/api/auth/register`, { method: 'POST', headers: json, body: JSON.stringify({ username, password: PASS, birthMonth: '1990-01', acceptTerms: true }) });
  assert.strictEqual(res.status, 201);
  const cookie = (res.headers.get('set-cookie') || '').split(';')[0];
  const id = (await (await fetch(`${BASE_URL}/api/auth/me`, { headers: { Cookie: cookie } })).json()).user.id as number;
  made.push(id);
  if (opts.named !== false) await db.query('UPDATE users SET name_set = true, name = $2 WHERE id = $1', [id, `Hunter_${name}_${suffix}`.slice(0, 30)]);
  if (opts.consent) await db.query('UPDATE users SET consent_status = $2 WHERE id = $1', [id, opts.consent]);
  return { id, cookie, username };
}
const call = async (cookie: string | null, method: string, path: string, body?: unknown) => {
  const r = await fetch(`${BASE_URL}/api/classes${path}`, { method, headers: { ...json, ...(cookie ? { Cookie: cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: r.status, body: (await r.json().catch(() => null)) as any };
};
const dayAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

describe('Classes', () => {
  let teacher: H, s1: H, s2: H, outsider: H, questId: number;
  let classId: number, code: string;

  before(async () => {
    teacher = await hunter('teacher');
    s1 = await hunter('s1');
    s2 = await hunter('s2');
    outsider = await hunter('out');
    questId = (await db.query(`INSERT INTO quests (quest_id, title, xp_reward, category) VALUES ($1, 'PRIVATE TASK TITLE', 10, 'private-module') RETURNING id`, [`CL-${suffix}`])).rows[0].id;
  });
  after(async () => {
    await db.query('DELETE FROM users WHERE id = ANY($1)', [made]);
    await db.query(`DELETE FROM users WHERE username LIKE $1`, [`cl_bulk_${suffix}_%`]);
    await db.query('DELETE FROM quests WHERE id = $1', [questId]);
    await db.end();
  });

  describe('creating a class', () => {
    it('requires a session and a name', async () => {
      assert.strictEqual((await call(null, 'POST', '', { name: 'X' })).status, 401);
      assert.strictEqual((await call(teacher.cookie, 'POST', '', { name: 'x' })).status, 400);
    });
    it('keeps under-18s out of teaching', async () => {
      const teen = await hunter('teen', { consent: 'granted' });
      const r = await call(teen.cookie, 'POST', '', { name: 'My class' });
      assert.deepStrictEqual({ s: r.status, c: r.body.code }, { s: 403, c: 'adult_required' });
    });
    it('makes the first class a free pilot with a readable code', async () => {
      const r = await call(teacher.cookie, 'POST', '', { name: '  JEE   2027  A ' });
      assert.strictEqual(r.status, 201);
      assert.strictEqual(r.body.name, 'JEE 2027 A');
      assert.match(r.body.code, /^[A-HJ-NP-Z2-9]{6}$/);
      assert.strictEqual(r.body.pilot, true);
      classId = r.body.id; code = r.body.code;
    });
    it('allows one free class; more need the Teams plan', async () => {
      const r = await call(teacher.cookie, 'POST', '', { name: 'Second' });
      assert.deepStrictEqual({ s: r.status, c: r.body.code }, { s: 409, c: 'class_limit' });
      assert.strictEqual((await call(teacher.cookie, 'GET', '')).body.canCreate, false);
    });
  });

  describe('joining', () => {
    it('shows a student what the teacher will see before they join', async () => {
      const r = await call(s1.cookie, 'GET', `/lookup?code=${code.toLowerCase()}`);
      assert.strictEqual(r.status, 200);
      assert.deepStrictEqual({ name: r.body.name, members: r.body.members, capacity: r.body.capacity }, { name: 'JEE 2027 A', members: 0, capacity: 60 });
      assert.deepStrictEqual(r.body.teacherSees, ['hunterName', 'levelAndRank', 'streak', 'activeDays', 'lastActive']);
    });
    it('rejects malformed and unknown codes', async () => {
      assert.strictEqual((await call(s1.cookie, 'GET', '/lookup?code=ABC')).body.code, 'bad_code');
      assert.strictEqual((await call(s1.cookie, 'GET', '/lookup?code=ZZZZZZ')).body.code, 'not_found');
      assert.strictEqual((await call(null, 'GET', `/lookup?code=${code}`)).status, 401);
    });
    it('needs a chosen Hunter name, so the teacher never sees a login username', async () => {
      const unnamed = await hunter('unnamed', { named: false });
      assert.strictEqual((await call(unnamed.cookie, 'POST', '/join', { code })).body.code, 'name_required');
    });
    it('lets a student join with a code typed any way, once', async () => {
      const a = await call(s1.cookie, 'POST', '/join', { code: ` ${code.slice(0, 3).toLowerCase()}-${code.slice(3)} ` });
      assert.deepStrictEqual({ s: a.status, joined: a.body.joined }, { s: 201, joined: true });
      assert.strictEqual((await call(s1.cookie, 'POST', '/join', { code })).status, 200, 'joining again is harmless');
      assert.strictEqual((await call(s2.cookie, 'POST', '/join', { code })).status, 201);
      const mine = (await call(s1.cookie, 'GET', '')).body;
      assert.deepStrictEqual(mine.joined.map((c: any) => c.name), ['JEE 2027 A']);
    });
    it('does not let the teacher join their own class', async () => {
      assert.strictEqual((await call(teacher.cookie, 'POST', '/join', { code })).body.code, 'own_class');
    });
    it('limits guessing: too many attempts are throttled', async () => {
      const guesser = await hunter('guess');
      let last = 0;
      for (let i = 0; i < 11; i++) last = (await call(guesser.cookie, 'POST', '/join', { code: 'ZZZZZZ' })).status;
      assert.strictEqual(last, 429);
    });
  });

  describe('the teacher dashboard', () => {
    before(async () => {
      // s1: active today, yesterday and 2 days ago, plus 10 days ago. s2: never.
      for (const n of [0, 1, 2, 10]) await db.query('INSERT INTO quest_completions (user_id, quest_id, completion_date) VALUES ($1, $2, $3::date)', [s1.id, questId, dayAgo(n)]).catch(async () => {
        const q = (await db.query(`INSERT INTO quests (quest_id, title, xp_reward, category) VALUES ($1, 'x', 1, 'p') RETURNING id`, [`CLX-${suffix}-${n}`])).rows[0].id;
        await db.query('INSERT INTO quest_completions (user_id, quest_id, completion_date) VALUES ($1, $2, $3::date)', [s1.id, q, dayAgo(n)]);
      });
    });
    it('is for the teacher only', async () => {
      assert.strictEqual((await call(null, 'GET', `/${classId}/dashboard`)).status, 401);
      assert.strictEqual((await call(s1.cookie, 'GET', `/${classId}/dashboard`)).status, 404, 'a student cannot read it');
      assert.strictEqual((await call(outsider.cookie, 'GET', `/${classId}/dashboard`)).status, 404, 'nor can another teacher');
      assert.strictEqual((await call(teacher.cookie, 'GET', '/999999/dashboard')).status, 404);
      assert.strictEqual((await call(teacher.cookie, 'GET', '/abc/dashboard')).status, 404);
    });
    it('shows consistency per student and a class summary', async () => {
      const d = (await call(teacher.cookie, 'GET', `/${classId}/dashboard`)).body;
      assert.strictEqual(d.summary.members, 2);
      assert.strictEqual(d.summary.activeThisWeek, 1);
      const a = d.members.find((m: any) => m.name.startsWith('Hunter_s1'));
      const b = d.members.find((m: any) => m.name.startsWith('Hunter_s2'));
      assert.deepStrictEqual({ streak: a.streak, week: a.activeDaysThisWeek, pct: a.consistencyPct, last: a.lastActive }, { streak: 3, week: 3, pct: Math.round((4 / 28) * 100), last: dayAgo(0) });
      assert.deepStrictEqual({ streak: b.streak, week: b.activeDaysThisWeek, pct: b.consistencyPct, last: b.lastActive }, { streak: 0, week: 0, pct: 0, last: null });
      assert.strictEqual(d.summary.avgConsistencyPct, Math.round((a.consistencyPct + b.consistencyPct) / 2));
    });
    it('exposes only consistency fields, never private details', async () => {
      const raw = await call(teacher.cookie, 'GET', `/${classId}/dashboard`);
      const text = JSON.stringify(raw.body);
      for (const secret of [s1.username, s2.username, 'PRIVATE TASK TITLE', 'private-module', 'password', 'region', 'birth', 'email', 'parent']) assert.ok(!text.includes(secret), `leaked: ${secret}`);
      for (const m of raw.body.members) assert.deepStrictEqual(Object.keys(m).sort(), ['activeDaysThisWeek', 'consistencyPct', 'joinedAt', 'lastActive', 'level', 'memberId', 'name', 'rank', 'streak']);
    });
  });

  describe('leaving and removing', () => {
    it('lets a student leave, which ends the teacher\'s view of them at once', async () => {
      assert.strictEqual((await call(s2.cookie, 'DELETE', `/${classId}/membership`)).status, 200);
      assert.strictEqual((await call(s2.cookie, 'DELETE', `/${classId}/membership`)).status, 404, 'already left');
      const d = (await call(teacher.cookie, 'GET', `/${classId}/dashboard`)).body;
      assert.deepStrictEqual(d.members.map((m: any) => m.name.slice(0, 10)), ['Hunter_s1_']);
    });
    it('lets the teacher remove a student, and nobody else', async () => {
      const d = (await call(teacher.cookie, 'GET', `/${classId}/dashboard`)).body;
      const memberId = d.members[0].memberId;
      assert.strictEqual((await call(s1.cookie, 'DELETE', `/${classId}/members/${memberId}`)).status, 404, 'a student cannot remove classmates');
      assert.strictEqual((await call(outsider.cookie, 'DELETE', `/${classId}/members/${memberId}`)).status, 404);
      assert.strictEqual((await call(teacher.cookie, 'DELETE', `/${classId}/members/${memberId}`)).status, 200);
      assert.strictEqual((await call(teacher.cookie, 'DELETE', `/${classId}/members/${memberId}`)).status, 404);
      assert.strictEqual((await call(teacher.cookie, 'GET', `/${classId}/dashboard`)).body.members.length, 0);
    });
  });

  describe('codes', () => {
    it('can be rotated, which kills the old one', async () => {
      assert.strictEqual((await call(outsider.cookie, 'POST', `/${classId}/rotate-code`)).status, 404, 'only the owner');
      const r = await call(teacher.cookie, 'POST', `/${classId}/rotate-code`);
      assert.strictEqual(r.status, 200);
      assert.notStrictEqual(r.body.code, code);
      assert.strictEqual((await call(s1.cookie, 'POST', '/join', { code })).body.code, 'not_found');
      assert.strictEqual((await call(s1.cookie, 'POST', '/join', { code: r.body.code })).status, 201);
      code = r.body.code;
    });
  });

  describe('limits', () => {
    it('enforces the class capacity even when students arrive together', async () => {
      const cap = (await call(teacher.cookie, 'GET', `/${classId}/dashboard`)).body.class.capacity;
      assert.strictEqual(cap, 60);
      // Fill to 59 (s1 is already in), then two students race for the last seat.
      await db.query(`INSERT INTO users (username, password_hash, name, consent_status) SELECT 'cl_bulk_${suffix}_' || g, 'x', 'bulk' || g, 'not_required' FROM generate_series(1, 58) g`);
      await db.query(`INSERT INTO class_members (class_id, user_id) SELECT $1, id FROM users WHERE username LIKE $2`, [classId, `cl_bulk_${suffix}_%`]);
      const racers = await Promise.all([hunter('r1'), hunter('r2')]);
      const results = await Promise.all(racers.map(r => call(r.cookie, 'POST', '/join', { code })));
      assert.deepStrictEqual(results.map(r => r.status).sort(), [201, 409]);
      assert.ok(results.some(r => r.body.code === 'class_full'));
      const count = (await db.query('SELECT COUNT(*)::int AS n FROM class_members WHERE class_id = $1', [classId])).rows[0].n;
      assert.strictEqual(count, 60);
    });
    it('lets a student be in up to three classes', async () => {
      const student = await hunter('multi');
      const codes: string[] = [];
      for (let i = 0; i < 4; i++) {
        const t = await hunter(`mt${i}`);
        codes.push((await call(t.cookie, 'POST', '', { name: `Class ${i}` })).body.code);
      }
      for (let i = 0; i < 3; i++) assert.strictEqual((await call(student.cookie, 'POST', '/join', { code: codes[i] })).status, 201);
      assert.strictEqual((await call(student.cookie, 'POST', '/join', { code: codes[3] })).body.code, 'too_many_classes');
    });
  });

  describe('archiving and deleting', () => {
    it('closes joining and frees the teacher to start another class', async () => {
      const t = await hunter('arch');
      const c = (await call(t.cookie, 'POST', '', { name: 'Old batch' })).body;
      assert.strictEqual((await call(t.cookie, 'PATCH', `/${c.id}`, { archived: true })).status, 200);
      assert.strictEqual((await call(s2.cookie, 'POST', '/join', { code: c.code })).body.code, 'not_found');
      assert.strictEqual((await call(t.cookie, 'GET', '')).body.canCreate, true);
    });
    it('renames a class, owner only', async () => {
      assert.strictEqual((await call(outsider.cookie, 'PATCH', `/${classId}`, { name: 'Hacked' })).status, 404);
      assert.strictEqual((await call(teacher.cookie, 'PATCH', `/${classId}`, { name: 'JEE 2027 B' })).body.name, 'JEE 2027 B');
      assert.strictEqual((await call(teacher.cookie, 'PATCH', `/${classId}`, { name: '' })).status, 400);
    });
    it('removes a deleted student from the dashboard and a deleted teacher\'s classes with them', async () => {
      const before = (await call(teacher.cookie, 'GET', `/${classId}/dashboard`)).body.members.length;
      await db.query('DELETE FROM users WHERE id = $1', [s1.id]);
      assert.strictEqual((await call(teacher.cookie, 'GET', `/${classId}/dashboard`)).body.members.length, before - 1);
      await db.query('DELETE FROM users WHERE id = $1', [teacher.id]);
      assert.strictEqual((await db.query('SELECT 1 FROM classes WHERE id = $1', [classId])).rowCount, 0);
      assert.strictEqual((await db.query('SELECT 1 FROM class_members WHERE class_id = $1', [classId])).rowCount, 0);
    });
  });
});
