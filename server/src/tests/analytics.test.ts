/**
 * Integration tests for measurement: anonymous + signed-in events, privacy
 * opt-outs, the admin funnel and its access control, export and deletion.
 * Requires the server running on localhost:3000 with ADMIN_USERNAMES=admin_e2e.
 * Run with: node --test src/tests/analytics.test.ts
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

const ADMIN = process.env.ADMIN_E2E_USER || 'admin_e2e';
const PASS = 'AnalyticsPass123!';
const json = { 'Content-Type': 'application/json' };

async function signIn(username: string, extra: Record<string, string> = {}) {
  let res = await fetch(`${BASE_URL}/api/auth/register`, { method: 'POST', headers: { ...json, ...extra }, body: JSON.stringify({ username, password: PASS, birthMonth: '1990-01', acceptTerms: true }) });
  if (res.status === 409) res = await fetch(`${BASE_URL}/api/auth/login`, { method: 'POST', headers: json, body: JSON.stringify({ username, password: PASS }) });
  assert.ok(res.ok, `sign-in failed for ${username}: ${res.status}`);
  const cookie = (res.headers.get('set-cookie') || '').split(';')[0];
  let me = (await (await fetch(`${BASE_URL}/api/auth/me`, { headers: { Cookie: cookie } })).json()).user;
  if (me.consentStatus === 'needs_age') {
    // An account from before the age gate: answer the one-time age question.
    await fetch(`${BASE_URL}/api/auth/age`, { method: 'POST', headers: { ...json, Cookie: cookie }, body: JSON.stringify({ birthMonth: '1990-01' }) });
    me = (await (await fetch(`${BASE_URL}/api/auth/me`, { headers: { Cookie: cookie } })).json()).user;
  }
  return { cookie, id: me.id as number, me };
}

const postEvent = (body: unknown, headers: Record<string, string> = {}) =>
  fetch(`${BASE_URL}/api/events`, { method: 'POST', headers: { ...json, ...headers }, body: JSON.stringify(body) });

describe('Measurement', () => {
  const suffix = Date.now();
  // A region unique to this run so the funnel assertions see only our cohort.
  const L = () => String.fromCharCode(65 + Math.floor(Math.random() * 26));
  const REGION = `${L()}${L()}`;
  const lang = { 'Accept-Language': `en-${REGION}` };
  let admin: Awaited<ReturnType<typeof signIn>>;
  let u1: Awaited<ReturnType<typeof signIn>>;
  let u2: Awaited<ReturnType<typeof signIn>>;
  let u3: Awaited<ReturnType<typeof signIn>>;

  before(async () => {
    admin = await signIn(ADMIN);
    u1 = await signIn(`an1_${suffix}`, lang);
    u2 = await signIn(`an2_${suffix}`, lang);
    u3 = await signIn(`an3_${suffix}`, lang);
  });
  after(async () => {
    await db.query('DELETE FROM users WHERE id = ANY($1)', [[u1.id, u2.id, u3.id]]);
    await db.query('DELETE FROM quests WHERE quest_id = $1', [`AN-${suffix}`]);
    await db.end();
  });

  it('records the market at signup from Accept-Language', async () => {
    const r = await db.query('SELECT region FROM users WHERE id = $1', [u1.id]);
    assert.strictEqual(r.rows[0].region, REGION);
  });

  describe('events endpoint', () => {
    it('stores an anonymous page event with no identifier', async () => {
      const res = await postEvent({ name: 'landing_view', props: { page: '/login', ref: 'tw', email: 'leak@x.y' } }, lang);
      assert.strictEqual(res.status, 204);
      const r = await db.query(`SELECT user_id, region, props FROM events WHERE name = 'landing_view' AND region = $1`, [REGION]);
      assert.strictEqual(r.rowCount, 1);
      assert.strictEqual(r.rows[0].user_id, null);
      assert.deepStrictEqual(r.rows[0].props, { page: '/login', ref: 'tw' }, 'unlisted props are dropped');
    });
    it('links the event to the hunter only when signed in', async () => {
      assert.strictEqual((await postEvent({ name: 'pricing_view' }, { ...lang, Cookie: u1.cookie })).status, 204);
      const r = await db.query(`SELECT user_id FROM events WHERE name = 'pricing_view' AND region = $1`, [REGION]);
      assert.strictEqual(r.rows[0].user_id, u1.id);
    });
    it('honors Do Not Track and Global Privacy Control', async () => {
      assert.strictEqual((await postEvent({ name: 'login_view' }, { ...lang, DNT: '1' })).status, 204);
      assert.strictEqual((await postEvent({ name: 'login_view' }, { ...lang, 'Sec-GPC': '1' })).status, 204);
      const r = await db.query(`SELECT 1 FROM events WHERE name = 'login_view' AND region = $1`, [REGION]);
      assert.strictEqual(r.rowCount, 0);
    });
    it('rejects unknown events, and upgrades from the browser', async () => {
      assert.strictEqual((await postEvent({ name: 'made_up' })).status, 400);
      assert.strictEqual((await postEvent({ name: 'upgrade_completed' }, { Cookie: u1.cookie })).status, 400);
      assert.strictEqual((await postEvent({})).status, 400);
    });
  });

  describe('admin funnel', () => {
    it('is closed to anonymous visitors and ordinary hunters', async () => {
      assert.strictEqual((await fetch(`${BASE_URL}/api/admin/funnel`)).status, 401);
      assert.strictEqual((await fetch(`${BASE_URL}/api/admin/funnel`, { headers: { Cookie: u1.cookie } })).status, 403);
      assert.strictEqual(u1.me.isAdmin, false);
      assert.strictEqual(admin.me.isAdmin, true);
    });

    it('counts signup → timetable → first quest → day-7 return → upgrade', async () => {
      await db.query(`INSERT INTO quests (quest_id, title, xp_reward, category) VALUES ($1, 'AN', 10, 'test')`, [`AN-${suffix}`]);
      const qid = (await db.query('SELECT id FROM quests WHERE quest_id = $1', [`AN-${suffix}`])).rows[0].id;
      // u2: built a timetable only. u3: timetable, signed up 10 days ago, quest on day 8, upgraded.
      for (const u of [u2, u3]) await db.query(`INSERT INTO routines (user_id, items, confirmed_at) VALUES ($1, '[]', NOW())`, [u.id]);
      await db.query(`UPDATE users SET created_at = NOW() - INTERVAL '10 days' WHERE id = $1`, [u3.id]);
      await db.query(`INSERT INTO quest_completions (user_id, quest_id, completion_date) VALUES ($1, $2, (NOW() - INTERVAL '2 days')::date)`, [u3.id, qid]);
      await db.query(`INSERT INTO events (user_id, name, region) VALUES ($1, 'upgrade_completed', $2)`, [u3.id, REGION]);

      const res = await fetch(`${BASE_URL}/api/admin/funnel?days=30&region=${REGION}`, { headers: { Cookie: admin.cookie } });
      assert.strictEqual(res.status, 200);
      const f = await res.json();
      assert.deepStrictEqual(
        { ...f.totals },
        { region: 'ALL', signups: 3, timetable: 2, firstQuest: 1, d7Eligible: 1, d7Returned: 1, upgraded: 1 },
      );
      assert.strictEqual(f.byRegion.length, 1);
      assert.strictEqual(f.byRegion[0].region, REGION);
      assert.ok(f.visits.landing >= 1 && f.visits.pricing >= 1);
    });

    it('excludes cohorts outside the window and lists no individuals', async () => {
      const f = await (await fetch(`${BASE_URL}/api/admin/funnel?days=5&region=${REGION}`, { headers: { Cookie: admin.cookie } })).json();
      assert.strictEqual(f.totals.signups, 2, 'u3 signed up 10 days ago');
      assert.ok(!JSON.stringify(f).includes('an1_'), 'no usernames in the report');
    });
  });

  describe('data rights', () => {
    it('includes events in the export', async () => {
      const exp = await (await fetch(`${BASE_URL}/api/auth/export`, { headers: { Cookie: u1.cookie } })).json();
      assert.ok(exp.events.some((e: any) => e.name === 'pricing_view'));
      assert.strictEqual(exp.profile.region, REGION);
    });
    it('deletes events with the account', async () => {
      const del = await fetch(`${BASE_URL}/api/auth/account`, { method: 'DELETE', headers: { Cookie: u1.cookie, ...json }, body: JSON.stringify({ password: PASS, confirm: `an1_${suffix}` }) });
      assert.strictEqual(del.status, 200);
      const r = await db.query('SELECT 1 FROM events WHERE user_id = $1', [u1.id]);
      assert.strictEqual(r.rowCount, 0);
    });
  });
});
