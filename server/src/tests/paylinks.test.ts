/**
 * Integration tests for parent pay links: only a consented minor can make one,
 * a parent pays without an account, access still arrives only by webhook, the
 * parent can cancel from the link. Runs the real routes in-process against the
 * database with injected providers (no network).
 * Run with: npx tsx --test src/tests/paylinks.test.ts
 */
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { createHmac } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { pool, initDatabase } from '../db.js';
import { jwtSecret } from '../middleware/auth.js';
import billingRoutes from '../routes/billing.js';
import payLinkRoutes from '../routes/payLinks.js';
import webhookRoutes from '../routes/webhooks.js';
import { __resetProviders, __setProvider } from '../payments/index.js';
import { createStripeProvider } from '../payments/stripe.js';
import { createRazorpayProvider } from '../payments/razorpay.js';
import type { FetchLike } from '../payments/types.js';

const STRIPE_SECRET = 'whsec_test_paylinks';
let server: Server;
let base = '';
const suffix = Date.now();
const created: number[] = [];

async function makeUser(name: string, consent: string, named = true) {
  const username = `pl_${name}_${suffix}`;
  const r = await pool.query(`INSERT INTO users (username, password_hash, name, name_set, consent_status) VALUES ($1, 'x', $2, $3, $4) RETURNING id`, [username, `Hunter ${name}`, named, consent]);
  const id = r.rows[0].id as number;
  created.push(id);
  return { id, username, cookie: `token=${jwt.sign({ id, username }, jwtSecret(), { expiresIn: '1h' })}` };
}
const call = async (path: string, body: unknown, cookie?: string, headers: Record<string, string> = {}) => {
  const res = await fetch(`${base}/api${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...headers }, body: JSON.stringify(body) });
  return { status: res.status, body: (await res.json().catch(() => null)) as any };
};
const tokenOf = (url: string) => new URLSearchParams(url.split('#')[1]).get('token')!;
const stripeSub = (userId: number, id: string) => ({
  id, customer: `cus_${id}`, status: 'active', cancel_at_period_end: false, metadata: { userId: String(userId), plan: 'pro' },
  items: { data: [{ price: { currency: 'usd', unit_amount: 399, recurring: { interval: 'month' } }, current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400 }] },
});
const postStripe = (evt: unknown) => {
  const raw = JSON.stringify(evt);
  const t = Math.floor(Date.now() / 1000);
  const sig = createHmac('sha256', STRIPE_SECRET).update(`${t}.${raw}`).digest('hex');
  return fetch(`${base}/api/webhooks/stripe`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Stripe-Signature': `t=${t},v1=${sig}` }, body: raw });
};
function recordingFetch(respond: (url: string) => unknown) {
  const calls: { url: string; body: string }[] = [];
  const impl: FetchLike = async (url, init) => { calls.push({ url, body: init.body ?? '' }); const out = respond(url); return { ok: true, status: 200, json: async () => out, text: async () => JSON.stringify(out) }; };
  return { impl, calls };
}

describe('Parent pay links', () => {
  let stripeFetch: ReturnType<typeof recordingFetch>;
  before(async () => {
    await initDatabase();
    const app = express();
    app.use(cookieParser());
    app.use(express.json({ verify: (req, _res, buf) => { (req as any).rawBody = buf; } }));
    app.use('/api/billing', billingRoutes);
    app.use('/api/pay-links', payLinkRoutes);
    app.use('/api/webhooks', webhookRoutes);
    server = await new Promise<Server>(r => { const s = app.listen(0, () => r(s)); });
    base = `http://localhost:${(server.address() as AddressInfo).port}`;
  });
  beforeEach(() => {
    __resetProviders();
    stripeFetch = recordingFetch(() => ({ url: 'https://checkout.stripe.test/parent' }));
    __setProvider('stripe', createStripeProvider({ secretKey: 'sk_test_x', webhookSecret: STRIPE_SECRET, fetchImpl: stripeFetch.impl }));
    __setProvider('razorpay', createRazorpayProvider({ keyId: 'rzp_test_x', keySecret: 's', webhookSecret: 'w', fetchImpl: recordingFetch(() => ({ id: 'plan_x', short_url: 'https://rzp.io/i/x' })).impl }));
  });
  after(async () => {
    __resetProviders();
    await pool.query('DELETE FROM users WHERE id = ANY($1)', [created]);
    await pool.query(`DELETE FROM payment_events WHERE event_id LIKE $1`, [`%_${suffix}`]);
    await new Promise(r => server.close(r));
    await pool.end();
  });

  describe('creating a link', () => {
    it('is only for a signed-in hunter under 18 whose parent has consented', async () => {
      assert.strictEqual((await call('/pay-links', { interval: 'month' })).status, 401);
      const adult = await makeUser('adult', 'not_required');
      assert.strictEqual((await call('/pay-links', { interval: 'month' }, adult.cookie)).body.code, 'not_a_minor');
      const pending = await makeUser('pending', 'pending');
      assert.strictEqual((await call('/pay-links', { interval: 'month' }, pending.cookie)).body.code, 'not_a_minor');
      const teen = await makeUser('teen_bad', 'granted');
      assert.strictEqual((await call('/pay-links', { interval: 'week' }, teen.cookie)).status, 400);
    });
    it('returns a shareable link with the token in the fragment, priced for the market, with a 7-day life', async () => {
      const teen = await makeUser('teen_ok', 'granted');
      const r = await call('/pay-links', { interval: 'year', region: 'IN' }, teen.cookie);
      assert.strictEqual(r.status, 201);
      assert.match(r.body.url, /\/pay#token=[\w-]{40,}$/);
      assert.deepStrictEqual({ c: r.body.currency, a: r.body.amountMinor, i: r.body.interval }, { c: 'INR', a: 59900, i: 'year' });
      const days = (new Date(r.body.expiresAt).getTime() - Date.now()) / 86_400_000;
      assert.ok(days > 6.9 && days <= 7.01);
    });
    it('stores only a hash of the token', async () => {
      const teen = await makeUser('teen_hash', 'granted');
      const token = tokenOf((await call('/pay-links', { interval: 'month' }, teen.cookie)).body.url);
      const rows = (await pool.query('SELECT token_hash FROM pay_links WHERE user_id = $1', [teen.id])).rows;
      assert.strictEqual(rows.length, 1);
      assert.notStrictEqual(rows[0].token_hash, token);
      assert.ok(!rows[0].token_hash.includes(token));
    });
    it('refuses a second subscription', async () => {
      const teen = await makeUser('teen_sub', 'granted');
      await postStripe({ id: `evt_plsub_${suffix}`, type: 'customer.subscription.created', created: Math.floor(Date.now() / 1000), data: { object: stripeSub(teen.id, `sub_plsub_${suffix}`) } });
      assert.strictEqual((await call('/pay-links', { interval: 'month' }, teen.cookie)).body.code, 'already_subscribed');
    });
  });

  describe('the parent, with no account', () => {
    let teen: Awaited<ReturnType<typeof makeUser>>;
    let token: string;
    before(async () => {
      teen = await makeUser('child', 'granted');
      token = tokenOf((await call('/pay-links', { interval: 'month', region: 'US' }, teen.cookie)).body.url);
    });

    it('sees what they would pay and for whom, and nothing private', async () => {
      const r = await call('/pay-links/lookup', { token });
      assert.strictEqual(r.status, 200);
      assert.deepStrictEqual({ name: r.body.name, a: r.body.amountMinor, c: r.body.currency, i: r.body.interval, expired: r.body.expired, subscribed: r.body.subscribed }, { name: 'Hunter child', a: 399, c: 'USD', i: 'month', expired: false, subscribed: false });
      const text = JSON.stringify(r.body);
      for (const secret of [teen.username, 'password', 'consent', 'birth', 'email', String(teen.id)]) assert.ok(!text.includes(secret), `leaked: ${secret}`);
    });
    it('is not shown a login username when the child never chose a Hunter name', async () => {
      const anon = await makeUser('anon', 'granted', false);
      const t = tokenOf((await call('/pay-links', { interval: 'month' }, anon.cookie)).body.url);
      const r = await call('/pay-links/lookup', { token: t });
      assert.strictEqual(r.body.name, null);
      assert.ok(!JSON.stringify(r.body).includes(anon.username));
    });
    it('rejects unknown and malformed tokens', async () => {
      for (const bad of ['', 'short', 'x'.repeat(60), null, 42]) assert.strictEqual((await call('/pay-links/lookup', { token: bad })).status, 404, String(bad));
      assert.strictEqual((await call('/pay-links/checkout', { token: 'nope-nope-nope-nope-nope' })).status, 404);
    });
    it('starts checkout for the CHILD\'s account, at the snapshotted price, without sending the token to the provider', async () => {
      const r = await call('/pay-links/checkout', { token });
      assert.strictEqual(r.status, 200);
      assert.strictEqual(r.body.url, 'https://checkout.stripe.test/parent');
      const sent = new URLSearchParams(stripeFetch.calls[0].body);
      assert.strictEqual(sent.get('subscription_data[metadata][userId]'), String(teen.id));
      assert.strictEqual(sent.get('line_items[0][price_data][unit_amount]'), '399');
      assert.ok(!stripeFetch.calls[0].body.includes(token), 'the link token never goes to the provider');
      assert.match(sent.get('success_url')!, /\/pay\?done=1$/);
    });
    it('grants Pro to the child only when the verified webhook arrives', async () => {
      const me = async () => (await (await fetch(`${base}/api/billing/me`, { headers: { Cookie: teen.cookie } })).json()) as any;
      assert.strictEqual((await me()).plan, 'free', 'starting checkout grants nothing');
      const res = await postStripe({ id: `evt_plchild_${suffix}`, type: 'customer.subscription.created', created: Math.floor(Date.now() / 1000), data: { object: stripeSub(teen.id, `sub_plchild_${suffix}`) } });
      assert.strictEqual(res.status, 200);
      assert.strictEqual((await me()).plan, 'pro');
    });
    it('blocks a second checkout once Pro is active, and shows the subscription on the link', async () => {
      assert.strictEqual((await call('/pay-links/checkout', { token })).body.code, 'already_subscribed');
      const r = await call('/pay-links/lookup', { token });
      assert.strictEqual(r.body.subscribed, true);
      assert.strictEqual(r.body.subscription.cancelAtPeriodEnd, false);
    });
    it('lets the parent cancel from the same link, idempotently', async () => {
      const r = await call('/pay-links/cancel', { token });
      assert.strictEqual(r.status, 200);
      const cancelCall = stripeFetch.calls.find(c => c.url.includes('/subscriptions/sub_plchild_'))!;
      assert.strictEqual(new URLSearchParams(cancelCall.body).get('cancel_at_period_end'), 'true');
      const n = stripeFetch.calls.length;
      assert.strictEqual((await call('/pay-links/cancel', { token })).status, 200);
      assert.strictEqual(stripeFetch.calls.length, n, 'the provider is not asked twice');
      assert.strictEqual((await call('/pay-links/lookup', { token })).body.subscription.cancelAtPeriodEnd, true);
    });
    it('cannot cancel someone else\'s subscription with another child\'s link', async () => {
      const other = await makeUser('other', 'granted');
      const t = tokenOf((await call('/pay-links', { interval: 'month' }, other.cookie)).body.url);
      assert.strictEqual((await call('/pay-links/cancel', { token: t })).body.code, 'no_subscription');
    });
  });

  describe('expiry and failures', () => {
    it('refuses to start checkout from an expired link, but can still look at it', async () => {
      const teen = await makeUser('expired', 'granted');
      const token = tokenOf((await call('/pay-links', { interval: 'month' }, teen.cookie)).body.url);
      await pool.query(`UPDATE pay_links SET expires_at = NOW() - INTERVAL '1 hour' WHERE user_id = $1`, [teen.id]);
      assert.strictEqual((await call('/pay-links/lookup', { token })).body.expired, true);
      const r = await call('/pay-links/checkout', { token });
      assert.deepStrictEqual({ s: r.status, c: r.body.code }, { s: 410, c: 'expired' });
    });
    it('answers 503 with no provider and 502 when the provider fails', async () => {
      const teen = await makeUser('fail', 'granted');
      const token = tokenOf((await call('/pay-links', { interval: 'month', region: 'US' }, teen.cookie)).body.url);
      __setProvider('stripe', null);
      assert.strictEqual((await call('/pay-links/checkout', { token })).body.code, 'payments_not_configured');
      const failing: FetchLike = async () => ({ ok: false, status: 500, json: async () => ({ error: { message: 'boom' } }), text: async () => '' });
      __setProvider('stripe', createStripeProvider({ secretKey: 'sk_test_x', webhookSecret: STRIPE_SECRET, fetchImpl: failing }));
      const r = await call('/pay-links/checkout', { token });
      assert.deepStrictEqual({ s: r.status, c: r.body.code }, { s: 502, c: 'provider_error' });
      assert.ok(!JSON.stringify(r.body).includes('boom'));
    });
    it('is removed with the child\'s account', async () => {
      const teen = await makeUser('gone', 'granted');
      await call('/pay-links', { interval: 'month' }, teen.cookie);
      await pool.query('DELETE FROM users WHERE id = $1', [teen.id]);
      assert.strictEqual((await pool.query('SELECT 1 FROM pay_links WHERE user_id = $1', [teen.id])).rowCount, 0);
    });
  });
});
