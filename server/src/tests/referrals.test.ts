/**
 * Integration tests for referral rewards: an invite counts only after the
 * friend completes a quest; every third qualified invite grants 30 days of
 * Pro, capped; never XP. Requires the server on localhost:3000.
 * Run with: node --test src/tests/referrals.test.ts
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
const PASS = 'RefPass123!';
const made: number[] = [];

async function signUp(username: string, invite?: string) {
  const res = await fetch(`${BASE_URL}/api/auth/register`, { method: 'POST', headers: json, body: JSON.stringify({ username, password: PASS, birthMonth: '1995-01', acceptTerms: true, invite }) });
  assert.strictEqual(res.status, 201);
  const cookie = (res.headers.get('set-cookie') || '').split(';')[0];
  const id = (await (await fetch(`${BASE_URL}/api/auth/me`, { headers: { Cookie: cookie } })).json()).user.id as number;
  made.push(id);
  return { id, cookie, username };
}
const call = async (cookie: string, method: string, path: string, body?: unknown) => {
  const r = await fetch(`${BASE_URL}/api${path}`, { method, headers: { ...json, Cookie: cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: r.status, body: (await r.json().catch(() => null)) as any };
};
/** Completes one real quest for a hunter (a module task, like any hunter would). */
async function completeAQuest(h: { cookie: string }) {
  assert.strictEqual((await call(h.cookie, 'POST', '/modules', { name: 'Reading', icon: '📚', acknowledged: true })).status, 201);
  const q = await call(h.cookie, 'POST', '/quests/custom', { title: 'Read', module: 'reading', difficulty: 1 });
  assert.strictEqual(q.status, 201);
  const done = await call(h.cookie, 'PATCH', `/quests/${q.body.quest_id}/complete`);
  assert.strictEqual(done.body.action, 'completed');
}
const status = async (h: { cookie: string }) => (await call(h.cookie, 'GET', '/referrals/me')).body;
const plan = async (h: { cookie: string }) => (await call(h.cookie, 'GET', '/billing/me')).body;
async function named(h: { id: number; username: string }) {
  await db.query('UPDATE users SET name_set = true, name = $2 WHERE id = $1', [h.id, h.username]);
}
// Qualification can complete a moment after the response; poll briefly.
async function until<T>(fn: () => Promise<T>, ok: (v: T) => boolean) {
  let v = await fn();
  for (let i = 0; i < 25 && !ok(v); i++) { await new Promise(r => setTimeout(r, 120)); v = await fn(); }
  return v;
}

describe('Referral rewards', () => {
  const suffix = Date.now();
  let inviter: Awaited<ReturnType<typeof signUp>>;
  const friends: Awaited<ReturnType<typeof signUp>>[] = [];

  before(async () => {
    inviter = await signUp(`ref_in_${suffix}`);
    await named(inviter);
  });
  after(async () => { await db.query('DELETE FROM users WHERE id = ANY($1)', [made]); await db.end(); });

  it('starts at zero', async () => {
    assert.deepStrictEqual(await status(inviter), { qualified: 0, pending: 0, monthsEarned: 0, invitesPerReward: 3, nextRewardIn: 3, maxMonths: 12, capped: false });
  });

  it('records an invited sign-up as pending, not yet rewarded', async () => {
    friends.push(await signUp(`ref_f1_${suffix}`, inviter.username));
    const s = await status(inviter);
    assert.deepStrictEqual({ q: s.qualified, p: s.pending }, { q: 0, p: 1 });
    assert.strictEqual((await plan(inviter)).plan, 'free');
  });

  it('counts the invite only after the friend completes a real quest', async () => {
    await completeAQuest(friends[0]);
    const s = await until(() => status(inviter), x => x.qualified === 1);
    assert.deepStrictEqual({ q: s.qualified, p: s.pending, next: s.nextRewardIn }, { q: 1, p: 0, next: 2 });
    assert.strictEqual((await plan(inviter)).plan, 'free', 'one friend is not enough');
  });

  it('grants a month of Pro on the third qualified friend, and no XP', async () => {
    const before = (await call(inviter.cookie, 'GET', '/auth/me')).body.user.xp;
    for (const n of [2, 3]) {
      const f = await signUp(`ref_f${n}_${suffix}`, inviter.username);
      friends.push(f);
      await completeAQuest(f);
    }
    const s = await until(() => status(inviter), x => x.monthsEarned === 1);
    assert.deepStrictEqual({ q: s.qualified, months: s.monthsEarned, next: s.nextRewardIn }, { q: 3, months: 1, next: 3 });
    const p = await plan(inviter);
    assert.deepStrictEqual({ plan: p.plan, source: p.source }, { plan: 'pro', source: 'grant' });
    const days = (new Date(p.until).getTime() - Date.now()) / 86_400_000;
    assert.ok(days > 29 && days <= 30.01, `about 30 days, got ${days.toFixed(2)}`);
    assert.strictEqual((await call(inviter.cookie, 'GET', '/auth/me')).body.user.xp, before, 'referrals never touch XP');
  });

  it('does not double-count a friend or re-grant on later completions', async () => {
    await call(friends[0].cookie, 'POST', '/quests/custom', { title: 'More', module: 'reading', difficulty: 1 }).then(r => call(friends[0].cookie, 'PATCH', `/quests/${r.body.quest_id}/complete`));
    await new Promise(r => setTimeout(r, 400));
    const s = await status(inviter);
    assert.deepStrictEqual({ q: s.qualified, months: s.monthsEarned }, { q: 3, months: 1 });
  });

  it('ignores self-invites and unknown inviters', async () => {
    const lone = await signUp(`ref_lone_${suffix}`, `nobody_${suffix}`);
    assert.deepStrictEqual((await db.query('SELECT 1 FROM referrals WHERE invitee_id = $1', [lone.id])).rowCount, 0);
    await db.query('UPDATE users SET name_set = true, name = $2 WHERE id = $1', [lone.id, lone.username]);
    // an invitee cannot be recorded twice, nor as their own inviter
    await db.query(`INSERT INTO referrals (inviter_id, invitee_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [inviter.id, lone.id]);
    await assert.rejects(db.query(`INSERT INTO referrals (inviter_id, invitee_id) VALUES ($1, $1)`, [lone.id]));
  });

  it('stops rewarding at the cap', async () => {
    const capped = await signUp(`ref_cap_${suffix}`);
    await named(capped);
    await db.query(`INSERT INTO referral_grants (inviter_id, batch) SELECT $1, g FROM generate_series(1, 12) g`, [capped.id]);
    await db.query('UPDATE users SET pro_until = NOW() + INTERVAL \'30 days\' WHERE id = $1', [capped.id]);
    const before = (await plan(capped)).until;
    for (let n = 0; n < 3; n++) { const f = await signUp(`ref_capf${n}_${suffix}`, capped.username); await completeAQuest(f); }
    const s = await until(() => status(capped), x => x.qualified === 3);
    assert.deepStrictEqual({ q: s.qualified, months: s.monthsEarned, capped: s.capped, next: s.nextRewardIn }, { q: 3, months: 12, capped: true, next: null });
    assert.strictEqual((await plan(capped)).until, before, 'no further time is granted past the cap');
  });

  it('deleting the inviter removes their referral records', async () => {
    const x = await signUp(`ref_del_${suffix}`);
    await named(x);
    await signUp(`ref_delf_${suffix}`, x.username);
    await db.query('DELETE FROM users WHERE id = $1', [x.id]);
    assert.strictEqual((await db.query('SELECT 1 FROM referrals WHERE inviter_id = $1', [x.id])).rowCount, 0);
  });

  it('requires a session', async () => {
    assert.strictEqual((await fetch(`${BASE_URL}/api/referrals/me`)).status, 401);
  });
});
