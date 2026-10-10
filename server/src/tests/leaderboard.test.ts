/**
 * Integration tests for the segmented leaderboard (world / country) and the
 * hunter's country setting. Requires the server on localhost:3000.
 * Run with: node --test src/tests/leaderboard.test.ts
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
const PASS = 'BoardPass123!';

async function hunter(name: string, region: string | null, xp: number) {
  const res = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { ...json, ...(region ? { 'Accept-Language': `en-${region}` } : {}) },
    body: JSON.stringify({ username: name, password: PASS, birthMonth: '1995-01', acceptTerms: true }),
  });
  assert.strictEqual(res.status, 201);
  const cookie = (res.headers.get('set-cookie') || '').split(';')[0];
  const id = (await (await fetch(`${BASE_URL}/api/auth/me`, { headers: { Cookie: cookie } })).json()).user.id as number;
  await db.query('UPDATE users SET name_set = true, name = $2, xp = $3 WHERE id = $1', [id, name, xp]);
  return { id, cookie, name };
}
const board = (cookie: string, q: string) => fetch(`${BASE_URL}/api/leaderboard?${q}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, body: (await r.json()) as any }));

describe('Segmented leaderboard', () => {
  const suffix = Date.now();
  // Real, distinct ISO regions so the PUT validation accepts them; unique players per run keep assertions exact.
  const HOME = 'NZ';
  const AWAY = 'IS';
  const made: number[] = [];
  let a: Awaited<ReturnType<typeof hunter>>;
  let b: Awaited<ReturnType<typeof hunter>>;
  let c: Awaited<ReturnType<typeof hunter>>;
  let nowhere: Awaited<ReturnType<typeof hunter>>;

  before(async () => {
    // Wipe previous runs' hunters from the two test countries so rankings are deterministic.
    await db.query(`DELETE FROM users WHERE region IN ($1, $2) AND username LIKE 'lb_%'`, [HOME, AWAY]);
    a = await hunter(`lb_a_${suffix}`, HOME, 500);
    b = await hunter(`lb_b_${suffix}`, HOME, 900);
    c = await hunter(`lb_c_${suffix}`, AWAY, 99_999);
    nowhere = await hunter(`lb_n_${suffix}`, null, 10);
    made.push(a.id, b.id, c.id, nowhere.id);
  });
  after(async () => {
    await db.query('DELETE FROM users WHERE id = ANY($1)', [made]);
    await db.end();
  });

  it('the world board mixes countries', async () => {
    const r = (await board(a.cookie, 'period=all&scope=global')).body;
    assert.strictEqual(r.scope, 'global');
    assert.ok(r.entries.some((e: any) => e.name === c.name), 'a hunter from another country is on the world board');
  });

  it('the country board shows only hunters from your own country, ranked among themselves', async () => {
    const r = (await board(a.cookie, 'period=all&scope=country')).body;
    assert.strictEqual(r.region, HOME);
    assert.deepStrictEqual(r.entries.map((e: any) => e.name), [b.name, a.name]);
    assert.deepStrictEqual(r.entries.map((e: any) => e.position), [1, 2]);
    assert.strictEqual(r.me.position, 2);
    assert.ok(!r.entries.some((e: any) => e.name === c.name), 'the high scorer from elsewhere is excluded');
  });

  it('a different country gets its own board', async () => {
    const r = (await board(c.cookie, 'period=all&scope=country')).body;
    assert.deepStrictEqual(r.entries.map((e: any) => e.name), [c.name]);
    assert.strictEqual(r.me.position, 1);
  });

  it('asks for a country instead of guessing when there is none', async () => {
    const r = (await board(nowhere.cookie, 'period=all&scope=country')).body;
    assert.deepStrictEqual({ needs: r.needsRegion, region: r.region, n: r.entries.length }, { needs: true, region: null, n: 0 });
  });

  it('works for the weekly period too', async () => {
    const r = (await board(a.cookie, 'period=week&scope=country')).body;
    assert.strictEqual(r.scope, 'country');
    assert.strictEqual(r.period, 'week');
    assert.ok(Array.isArray(r.entries));
  });

  it('never exposes usernames, regions or other hunters\' private data', async () => {
    const raw = JSON.stringify((await board(a.cookie, 'period=all&scope=country')).body);
    assert.ok(!raw.includes('region":"IS'), 'no one else\'s country');
    assert.ok(!raw.includes('password'));
    for (const e of (JSON.parse(raw)).entries) assert.deepStrictEqual(Object.keys(e).sort(), ['isMe', 'level', 'name', 'position', 'rank', 'score']);
  });

  it('respects the opt-out inside a country board', async () => {
    await fetch(`${BASE_URL}/api/leaderboard/visibility`, { method: 'PATCH', headers: { ...json, Cookie: b.cookie }, body: JSON.stringify({ visible: false }) });
    const r = (await board(a.cookie, 'period=all&scope=country')).body;
    assert.deepStrictEqual(r.entries.map((e: any) => e.name), [a.name]);
  });

  describe('class board', () => {
    let teacher: Awaited<ReturnType<typeof hunter>>;
    let classId: number;
    it('ranks only the members of a class, visible to members and the teacher', async () => {
      teacher = await hunter('lbteach', null, 0);
      made.push(teacher.id);
      const cls = await (await fetch(`${BASE_URL}/api/classes`, { method: 'POST', headers: { ...json, Cookie: teacher.cookie }, body: JSON.stringify({ name: 'Board class' }) })).json();
      classId = cls.id;
      await db.query('INSERT INTO class_members (class_id, user_id) VALUES ($1, $2), ($1, $3)', [classId, a.id, c.id]);
      const asMember = (await board(a.cookie, `period=all&scope=class&classId=${classId}`)).body;
      assert.strictEqual(asMember.scope, 'class');
      assert.deepStrictEqual(asMember.entries.map((e: any) => e.name), [c.name, a.name], 'only classmates, ranked among themselves');
      assert.ok(!asMember.entries.some((e: any) => e.name === b.name), 'a hunter outside the class is not shown');
      assert.strictEqual(asMember.me.position, 2);
      const asTeacher = (await board(teacher.cookie, `period=all&scope=class&classId=${classId}`)).body;
      assert.deepStrictEqual(asTeacher.entries.map((e: any) => e.name), [c.name, a.name]);
    });
    it('is closed to outsiders and bad ids', async () => {
      assert.strictEqual((await board(b.cookie, `period=all&scope=class&classId=${classId}`)).status, 404, 'not a member');
      assert.strictEqual((await board(a.cookie, 'period=all&scope=class&classId=999999')).status, 404);
      assert.strictEqual((await board(a.cookie, 'period=all&scope=class&classId=abc')).status, 404);
      assert.strictEqual((await board(a.cookie, 'period=all&scope=class')).status, 404);
    });
    it('respects a classmate\'s opt-out and works for the weekly period', async () => {
      await db.query('UPDATE users SET show_on_leaderboard = false WHERE id = $1', [c.id]);
      const r = (await board(a.cookie, `period=all&scope=class&classId=${classId}`)).body;
      assert.deepStrictEqual(r.entries.map((e: any) => e.name), [a.name]);
      assert.strictEqual((await board(a.cookie, `period=week&scope=class&classId=${classId}`)).status, 200);
      await db.query('UPDATE users SET show_on_leaderboard = true WHERE id = $1', [c.id]);
    });
    it('stops showing a class that was archived', async () => {
      await db.query('UPDATE classes SET archived = true WHERE id = $1', [classId]);
      assert.strictEqual((await board(a.cookie, `period=all&scope=class&classId=${classId}`)).status, 404);
    });
  });

  describe('country setting', () => {
    const put = (cookie: string, region: unknown) => fetch(`${BASE_URL}/api/auth/region`, { method: 'PUT', headers: { ...json, Cookie: cookie }, body: JSON.stringify({ region }) }).then(async r => ({ status: r.status, body: (await r.json()) as any }));
    it('lets a hunter set their own country, which moves them to that board', async () => {
      assert.strictEqual((await put(nowhere.cookie, 'is')).status, 200, 'lower-case is accepted');
      const r = (await board(nowhere.cookie, 'period=all&scope=country')).body;
      assert.strictEqual(r.region, 'IS');
      assert.ok(r.entries.some((e: any) => e.name === c.name));
      const me = (await (await fetch(`${BASE_URL}/api/auth/me`, { headers: { Cookie: nowhere.cookie } })).json()).user;
      assert.strictEqual(me.region, 'IS');
    });
    it('rejects made-up and malformed countries', async () => {
      for (const bad of ['ZZ', 'QQ', 'USA', '', 'U', 42, null, 'IN; DROP']) assert.strictEqual((await put(a.cookie, bad)).status, 400, String(bad));
    });
    it('requires a session', async () => {
      assert.strictEqual((await fetch(`${BASE_URL}/api/auth/region`, { method: 'PUT', headers: json, body: JSON.stringify({ region: 'IN' }) })).status, 401);
    });
  });
});
