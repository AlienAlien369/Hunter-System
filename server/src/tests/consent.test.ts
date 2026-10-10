/**
 * Integration tests for the age gate and parental consent: under-13 refusal,
 * adult and minor signup, the server-side gate, the parent's grant/decline,
 * the one-time age question for legacy accounts, and data rights.
 * Requires the server running on localhost:3000 (mail is not configured, so
 * no email is sent). The parent's token is set directly in the database
 * because the real one only ever exists in the parent's inbox.
 * Run with: node --test src/tests/consent.test.ts
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { createHash } from 'node:crypto';
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
const PASS = 'ConsentPass123!';
const sha = (t: string) => createHash('sha256').update(t).digest('hex');

const monthsAgo = (years: number, extraMonths = 0) => {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - years);
  d.setUTCMonth(d.getUTCMonth() - extraMonths);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};
// Comfortably inside each band so the test never straddles a birthday.
const ADULT = monthsAgo(30);
const TEEN = monthsAgo(15, 5);
const CHILD = monthsAgo(10);

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(`${BASE_URL}/api${path}`, { method: 'POST', headers: { ...json, ...headers }, body: JSON.stringify(body) });
const get = (path: string, cookie?: string) => fetch(`${BASE_URL}/api${path}`, { headers: cookie ? { Cookie: cookie } : {} });
const cookieOf = (res: Response) => (res.headers.get('set-cookie') || '').split(';')[0];

describe('Age gate and parental consent', () => {
  const suffix = Date.now();
  const made: number[] = [];
  const register = async (name: string, extra: Record<string, unknown>) => {
    const res = await post('/auth/register', { username: `${name}_${suffix}`, password: PASS, acceptTerms: true, ...extra });
    const body = await res.json();
    const cookie = cookieOf(res);
    if (res.status === 201) {
      const me = await (await get('/auth/me', cookie)).json();
      made.push(me.user.id);
      return { res, body, cookie, id: me.user.id as number, me: me.user };
    }
    return { res, body, cookie, id: 0, me: null };
  };

  after(async () => {
    await db.query('DELETE FROM users WHERE id = ANY($1)', [made]);
    await db.end();
  });

  describe('registration', () => {
    it('refuses under-13s and stores nothing', async () => {
      const r = await register('kid', { birthMonth: CHILD });
      assert.strictEqual(r.res.status, 403);
      assert.strictEqual(r.body.code, 'under_age');
      const rows = await db.query('SELECT 1 FROM users WHERE username = $1', [`kid_${suffix}`]);
      assert.strictEqual(rows.rowCount, 0);
    });
    it('requires a valid birth month and accepted terms', async () => {
      assert.strictEqual((await register('nob', {})).body.code, 'birth_month_required');
      assert.strictEqual((await register('nob', { birthMonth: '2999-01' })).res.status, 400);
      const noTerms = await post('/auth/register', { username: `nt_${suffix}`, password: PASS, birthMonth: ADULT });
      assert.strictEqual((await noTerms.json()).code, 'terms_required');
    });
    it('signs adults up with no consent step and records what they accepted', async () => {
      const a = await register('adult', { birthMonth: ADULT });
      assert.strictEqual(a.res.status, 201);
      assert.strictEqual(a.body.consentStatus, 'not_required');
      assert.strictEqual(a.me.consentStatus, 'not_required');
      const c = await db.query('SELECT kind FROM consents WHERE user_id = $1 ORDER BY id', [a.id]);
      assert.deepStrictEqual(c.rows.map(x => x.kind), ['terms', 'privacy']);
      assert.strictEqual((await get('/quests', a.cookie)).status, 200);
    });
    it('stores only the birth month, never a day', async () => {
      const a = await register('month', { birthMonth: ADULT });
      const r = await db.query(`SELECT to_char(birth_month, 'DD') AS d FROM users WHERE id = $1`, [a.id]);
      assert.strictEqual(r.rows[0].d, '01');
    });
    it('needs a parent email for 13 to 17, and puts the account on hold', async () => {
      assert.strictEqual((await register('teen0', { birthMonth: TEEN })).body.code, 'parent_email_required');
      assert.strictEqual((await register('teen0', { birthMonth: TEEN, parentEmail: 'not-an-email' })).res.status, 400);
      const t = await register('teen', { birthMonth: TEEN, parentEmail: `parent_${suffix}@example.com` });
      assert.strictEqual(t.res.status, 201);
      assert.strictEqual(t.body.consentStatus, 'pending');
      assert.strictEqual(t.body.parentMailSent, false, 'mail is not configured in tests, and the API says so');
      assert.strictEqual(t.me.consentStatus, 'pending');
      assert.match(t.me.parentEmailMasked, /^p\*+@example\.com$/);
      assert.ok(!JSON.stringify(t.body).includes('token') && !JSON.stringify(t.me).includes('token'), 'the child never sees the parent token');
      assert.ok(!JSON.stringify(t.me).includes(`parent_${suffix}`), 'the full parent address is not echoed back');
    });
    it('does not let the form spam one inbox', async () => {
      const email = `spam_${suffix}@example.com`;
      for (let i = 0; i < 3; i++) assert.strictEqual((await register(`sp${i}`, { birthMonth: TEEN, parentEmail: email })).res.status, 201);
      assert.strictEqual((await register('sp3', { birthMonth: TEEN, parentEmail: email })).res.status, 429);
    });
  });

  describe('the server-side gate', () => {
    let teen: Awaited<ReturnType<typeof register>>;
    const token = `known-parent-token-${Date.now()}-abcdefghij`;
    before(async () => {
      teen = await register('gate', { birthMonth: TEEN, parentEmail: `gate_${suffix}@example.com` });
      await db.query('UPDATE users SET parent_token_hash = $2 WHERE id = $1', [teen.id, sha(token)]);
    });

    it('blocks a minor from the product until a parent consents', async () => {
      const r = await get('/quests', teen.cookie);
      assert.strictEqual(r.status, 403);
      assert.strictEqual((await r.json()).code, 'consent_required');
      assert.strictEqual((await get('/stats', teen.cookie)).status, 403);
    });
    it('still lets them sign in, see their status and log out', async () => {
      assert.strictEqual((await get('/auth/me', teen.cookie)).status, 200);
      assert.strictEqual((await post('/auth/logout', {}, { Cookie: teen.cookie })).status, 200);
    });
    it('does not let the child approve themselves', async () => {
      const r = await post('/consent/parent', { token: 'guess-guess-guess-guess-guess', decision: 'grant' });
      assert.strictEqual(r.status, 404);
      const me = await (await get('/auth/me', teen.cookie)).json();
      assert.strictEqual(me.user.consentStatus, 'pending');
    });
    it('shows the parent only the username, with a bad link rejected', async () => {
      assert.strictEqual((await post('/consent/parent/lookup', { token: 'short' })).status, 404);
      const viaUrl = await get(`/consent/parent?token=${token}`);
      assert.ok(!(viaUrl.headers.get('content-type') || '').includes('json'), 'a token in the URL is not accepted: no data comes back');
      assert.ok(!(await viaUrl.text()).includes(`gate_${suffix}`), 'and the username is not revealed');
      const r = await post('/consent/parent/lookup', { token });
      assert.strictEqual(r.status, 200);
      assert.deepStrictEqual(await r.json(), { username: `gate_${suffix}`, status: 'pending' });
    });
    it('opens the product as soon as the parent grants consent', async () => {
      const g = await post('/consent/parent', { token, decision: 'grant' });
      assert.strictEqual(g.status, 200);
      assert.strictEqual((await g.json()).status, 'granted');
      assert.strictEqual((await get('/quests', teen.cookie)).status, 200);
      const c = await db.query(`SELECT 1 FROM consents WHERE user_id = $1 AND kind = 'parental'`, [teen.id]);
      assert.strictEqual(c.rowCount, 1, 'the grant is recorded');
    });
    it('deletes the account when the parent withdraws consent', async () => {
      const d = await post('/consent/parent', { token, decision: 'decline' });
      assert.strictEqual((await d.json()).status, 'deleted');
      assert.strictEqual((await db.query('SELECT 1 FROM users WHERE id = $1', [teen.id])).rowCount, 0);
      assert.strictEqual((await post('/auth/login', { username: `gate_${suffix}`, password: PASS })).status, 401);
      assert.strictEqual((await post('/consent/parent/lookup', { token })).status, 404, 'the link is dead afterwards');
    });
  });

  describe('declining before approval', () => {
    it('deletes everything', async () => {
      const t = await register('decl', { birthMonth: TEEN, parentEmail: `decl_${suffix}@example.com` });
      const token = `decline-token-${Date.now()}-abcdefghijkl`;
      await db.query('UPDATE users SET parent_token_hash = $2 WHERE id = $1', [t.id, sha(token)]);
      assert.strictEqual((await post('/consent/parent', { token, decision: 'maybe' })).status, 400);
      assert.strictEqual((await (await post('/consent/parent', { token, decision: 'decline' })).json()).status, 'deleted');
      assert.strictEqual((await db.query('SELECT 1 FROM users WHERE id = $1', [t.id])).rowCount, 0);
      assert.strictEqual((await db.query('SELECT 1 FROM consents WHERE user_id = $1', [t.id])).rowCount, 0);
    });
  });

  describe('resending the request', () => {
    it('works only while consent is pending, and rotates the token', async () => {
      const adult = await register('rs_a', { birthMonth: ADULT });
      assert.strictEqual((await post('/auth/parent-email', {}, { Cookie: adult.cookie })).status, 409);
      const t = await register('rs_t', { birthMonth: TEEN, parentEmail: `rs_${suffix}@example.com` });
      const before = (await db.query('SELECT parent_token_hash AS h FROM users WHERE id = $1', [t.id])).rows[0].h;
      const r = await post('/auth/parent-email', { parentEmail: `rs2_${suffix}@example.com` }, { Cookie: t.cookie });
      assert.strictEqual(r.status, 200);
      assert.match((await r.json()).parentEmailMasked, /^r\*+@example\.com$/);
      const after = (await db.query('SELECT parent_token_hash AS h FROM users WHERE id = $1', [t.id])).rows[0].h;
      assert.notStrictEqual(after, before, 'the old link stops working');
    });
  });

  describe('accounts that predate the age gate', () => {
    const legacy = async (name: string) => {
      const u = await register(name, { birthMonth: ADULT });
      await db.query(`UPDATE users SET consent_status = 'needs_age', birth_month = NULL WHERE id = $1`, [u.id]);
      return u;
    };
    it('are asked once, and blocked from the product until they answer', async () => {
      const u = await legacy('leg1');
      assert.strictEqual((await get('/quests', u.cookie)).status, 403);
      assert.strictEqual((await (await get('/auth/me', u.cookie)).json()).user.consentStatus, 'needs_age');
      const r = await post('/auth/age', { birthMonth: ADULT }, { Cookie: u.cookie });
      assert.strictEqual((await r.json()).consentStatus, 'not_required');
      assert.strictEqual((await get('/quests', u.cookie)).status, 200);
    });
    it('cannot change their answer afterwards', async () => {
      const u = await legacy('leg2');
      assert.strictEqual((await post('/auth/age', { birthMonth: TEEN, parentEmail: `leg2_${suffix}@example.com` }, { Cookie: u.cookie })).status, 200);
      assert.strictEqual((await post('/auth/age', { birthMonth: ADULT }, { Cookie: u.cookie })).status, 409);
    });
    it('go on hold if they turn out to be 13 to 17', async () => {
      const u = await legacy('leg3');
      const r = await (await post('/auth/age', { birthMonth: TEEN, parentEmail: `leg3_${suffix}@example.com` }, { Cookie: u.cookie })).json();
      assert.strictEqual(r.consentStatus, 'pending');
      assert.strictEqual((await get('/quests', u.cookie)).status, 403);
    });
    it('are deleted if they turn out to be under 13', async () => {
      const u = await legacy('leg4');
      const r = await post('/auth/age', { birthMonth: CHILD }, { Cookie: u.cookie });
      assert.strictEqual(r.status, 403);
      assert.strictEqual((await db.query('SELECT 1 FROM users WHERE id = $1', [u.id])).rowCount, 0);
    });
  });

  describe('data rights', () => {
    it('exports consent records and removes them on deletion', async () => {
      const u = await register('rights', { birthMonth: ADULT });
      const exp = await (await get('/auth/export', u.cookie)).json();
      assert.deepStrictEqual(exp.consents.map((c: any) => c.kind), ['terms', 'privacy']);
      assert.ok(exp.profile.birth_month, 'birth month is in the export');
      assert.deepStrictEqual(exp.subscriptions, [], 'billing records are part of the export');
      const del = await fetch(`${BASE_URL}/api/auth/account`, { method: 'DELETE', headers: { ...json, Cookie: u.cookie }, body: JSON.stringify({ password: PASS, confirm: `rights_${suffix}` }) });
      assert.strictEqual(del.status, 200);
      assert.strictEqual((await db.query('SELECT 1 FROM consents WHERE user_id = $1', [u.id])).rowCount, 0);
    });
  });
});
