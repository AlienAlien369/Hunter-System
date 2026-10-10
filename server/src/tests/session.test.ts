/**
 * /api/auth/session: "nobody is signed in" is a normal 200 answer, not a 401.
 * Requires the server on localhost:3000.
 * Run with: node --test src/tests/session.test.ts
 */
import { describe, it, after } from 'node:test';
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
const get = (path: string, cookie?: string) => fetch(`${BASE_URL}/api${path}`, { headers: cookie ? { Cookie: cookie } : {} }).then(async r => ({ status: r.status, body: (await r.json()) as any }));

describe('session endpoint', () => {
  const made: number[] = [];
  after(async () => { await db.query('DELETE FROM users WHERE id = ANY($1)', [made]); await db.end(); });

  it('answers 200 with no user when nobody is signed in', async () => {
    assert.deepStrictEqual(await get('/auth/session'), { status: 200, body: { user: null } });
  });
  it('treats a garbage or expired cookie as signed out, not as an error', async () => {
    assert.deepStrictEqual(await get('/auth/session', 'token=not-a-jwt'), { status: 200, body: { user: null } });
  });
  it('returns the signed-in hunter, the same shape as /me', async () => {
    const username = `sess_${Date.now()}`;
    const reg = await fetch(`${BASE_URL}/api/auth/register`, { method: 'POST', headers: json, body: JSON.stringify({ username, password: 'SessPass123!', birthMonth: '1990-01', acceptTerms: true }) });
    assert.strictEqual(reg.status, 201);
    const cookie = (reg.headers.get('set-cookie') || '').split(';')[0];
    const session = await get('/auth/session', cookie);
    const me = await get('/auth/me', cookie);
    made.push(me.body.user.id);
    assert.strictEqual(session.status, 200);
    assert.deepStrictEqual(session.body, me.body);
    assert.strictEqual(session.body.user.username, username);
    assert.ok(!JSON.stringify(session.body).includes('password'));
  });
  it('still reports a pending minor so the consent screen can show', async () => {
    const reg = await fetch(`${BASE_URL}/api/auth/register`, { method: 'POST', headers: json, body: JSON.stringify({ username: `sess_minor_${Date.now()}`, password: 'SessPass123!', birthMonth: `${new Date().getUTCFullYear() - 15}-01`, acceptTerms: true, parentEmail: `p_${Date.now()}@example.com` }) });
    const cookie = (reg.headers.get('set-cookie') || '').split(';')[0];
    const s = await get('/auth/session', cookie);
    made.push(s.body.user.id);
    assert.strictEqual(s.body.user.consentStatus, 'pending');
  });
  it('/me itself still refuses anonymous callers', async () => {
    assert.strictEqual((await get('/auth/me')).status, 401);
  });
});
