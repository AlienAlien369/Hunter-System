/**
 * Integration tests for billing: the plan catalogue, checkout rules, the
 * webhook-only path to a paid plan, idempotency and ordering, refunds,
 * cancellation, grants and data rights. Runs the real routes in-process
 * against the database, with payment providers injected (no network).
 * Run with: npx tsx --test src/tests/billing.test.ts
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
import webhookRoutes from '../routes/webhooks.js';
import { __resetProviders, __setProvider } from '../payments/index.js';
import { createStripeProvider } from '../payments/stripe.js';
import { createRazorpayProvider } from '../payments/razorpay.js';
import { grantPro } from '../billing.js';
import { authenticateToken } from '../middleware/auth.js';
import { __setCompleter, aiCompletion } from '../aiQuota.js';
import type { FetchLike } from '../payments/types.js';

const STRIPE_SECRET = 'whsec_test_billing';
const RAZORPAY_SECRET = 'rzp_test_webhook';
let server: Server;
let base = '';
const suffix = Date.now();
const created: number[] = [];

async function makeUser(name: string, consent = 'not_required'): Promise<{ id: number; cookie: string }> {
  const r = await pool.query(
    `INSERT INTO users (username, password_hash, name, consent_status) VALUES ($1, 'x', $1, $2) RETURNING id`,
    [`${name}_${suffix}`, consent],
  );
  const id = r.rows[0].id as number;
  created.push(id);
  return { id, cookie: `token=${jwt.sign({ id, username: `${name}_${suffix}` }, jwtSecret(), { expiresIn: '1h' })}` };
}

const api = async (method: string, path: string, opts: { cookie?: string; body?: unknown; headers?: Record<string, string> } = {}) => {
  const res = await fetch(`${base}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(opts.cookie ? { Cookie: opts.cookie } : {}), ...opts.headers },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  return { status: res.status, body: (await res.json().catch(() => null)) as any };
};

// ── signed webhook helpers ──────────────────────────────────────────────────
const stripeEvent = (id: string, type: string, created: number, sub: any) => ({ id, type, created, data: { object: sub } });
const stripeSub = (userId: number, id: string, over: any = {}) => ({
  id, customer: `cus_${id}`, status: 'active', cancel_at_period_end: false, metadata: { userId: String(userId), plan: 'pro' },
  items: { data: [{ price: { currency: 'usd', unit_amount: 399, recurring: { interval: 'month' } }, current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400 }] },
  ...over,
});
const postStripe = (evt: unknown, secret = STRIPE_SECRET) => {
  const raw = JSON.stringify(evt);
  const t = Math.floor(Date.now() / 1000);
  const sig = createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex');
  return fetch(`${base}/api/webhooks/stripe`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Stripe-Signature': `t=${t},v1=${sig}` }, body: raw })
    .then(async r => ({ status: r.status, body: (await r.json().catch(() => null)) as any }));
};
const postRazorpay = (evt: unknown, eventId: string, secret = RAZORPAY_SECRET) => {
  const raw = JSON.stringify(evt);
  const sig = createHmac('sha256', secret).update(raw).digest('hex');
  return fetch(`${base}/api/webhooks/razorpay`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Razorpay-Signature': sig, 'X-Razorpay-Event-Id': eventId }, body: raw })
    .then(async r => ({ status: r.status, body: (await r.json().catch(() => null)) as any }));
};
const planOf = async (u: { cookie: string }) => (await api('GET', '/billing/me', { cookie: u.cookie })).body;
const now = () => Math.floor(Date.now() / 1000);

// A recording fake of the HTTP the providers make, so checkout/cancel are tested without a network.
function recordingFetch(respond: (url: string, body: string) => unknown) {
  const calls: { url: string; body: string; headers: Record<string, string> }[] = [];
  const impl: FetchLike = async (url, init) => {
    calls.push({ url, body: init.body ?? '', headers: init.headers });
    const out = respond(url, init.body ?? '');
    return { ok: true, status: 200, json: async () => out, text: async () => JSON.stringify(out) };
  };
  return { impl, calls };
}

describe('Billing', () => {
  let stripeFetch: ReturnType<typeof recordingFetch>;
  let razorpayFetch: ReturnType<typeof recordingFetch>;

  before(async () => {
    await initDatabase();
    const app = express();
    app.use(cookieParser());
    app.use(express.json({ verify: (req, _res, buf) => { (req as any).rawBody = buf; } }));
    app.use('/api/billing', billingRoutes);
    app.use('/api/webhooks', webhookRoutes);
    // A stand-in for any AI-backed route: the quota logic is the same helper they all use.
    app.post('/api/ai-test', authenticateToken, async (req, res) => {
      const raw = await aiCompletion(req, { system: 's', prompt: 'p', toolName: 't', schema: {} });
      res.json({ raw, limited: !!req.aiLimited });
    });
    server = await new Promise<Server>(r => { const s = app.listen(0, () => r(s)); });
    base = `http://localhost:${(server.address() as AddressInfo).port}`;
  });
  beforeEach(() => {
    __resetProviders();
    stripeFetch = recordingFetch(() => ({ url: 'https://checkout.stripe.test/session' }));
    razorpayFetch = recordingFetch(url => (url.endsWith('/plans') ? { id: 'plan_test_1' } : { id: 'sub_new', short_url: 'https://rzp.io/i/test' }));
    __setProvider('stripe', createStripeProvider({ secretKey: 'sk_test_x', webhookSecret: STRIPE_SECRET, fetchImpl: stripeFetch.impl }));
    __setProvider('razorpay', createRazorpayProvider({ keyId: 'rzp_test_x', keySecret: 'secret', webhookSecret: RAZORPAY_SECRET, fetchImpl: razorpayFetch.impl }));
  });
  after(async () => {
    __resetProviders();
    await pool.query('DELETE FROM users WHERE id = ANY($1)', [created]);
    await pool.query(`DELETE FROM payment_events WHERE event_id LIKE $1 OR event_id LIKE $2`, [`%${suffix}%`, `%_${suffix}`]);
    await pool.query(`DELETE FROM app_settings WHERE key LIKE 'razorpay_plan:%'`);
    await new Promise(r => server.close(r));
    await pool.end();
  });

  describe('plan catalogue', () => {
    it('prices India in rupees through Razorpay and the US in dollars', async () => {
      const inr = (await api('GET', '/billing/plans?region=IN')).body;
      assert.deepStrictEqual({ g: inr.group, c: inr.currency }, { g: 'IN', c: 'INR' });
      assert.deepStrictEqual(inr.plans[1].prices.month, { currency: 'INR', amountMinor: 7900 });
      const us = (await api('GET', '/billing/plans?region=US')).body;
      assert.deepStrictEqual(us.plans[1].prices.year, { currency: 'USD', amountMinor: 3499 });
      assert.ok(us.plans[1].yearlySavingsPct > 15);
    });
    it('detects the market from the browser language and honours an explicit region', async () => {
      assert.strictEqual((await api('GET', '/billing/plans', { headers: { 'Accept-Language': 'hi-IN' } })).body.region, 'IN');
      assert.strictEqual((await api('GET', '/billing/plans', { headers: { 'Accept-Language': 'hi-IN' } })).body.currency, 'INR');
      assert.strictEqual((await api('GET', '/billing/plans?region=ID')).body.group, 'LOW');
      assert.strictEqual((await api('GET', '/billing/plans?region=junk')).body.region, 'US');
    });
    it('keeps the free plan genuinely useful and lists no XP for sale', async () => {
      const p = (await api('GET', '/billing/plans?region=IN')).body.plans;
      assert.strictEqual(p[0].id, 'free');
      assert.ok(p[0].features.some((f: string) => /Unlimited quests/.test(f)));
      assert.ok(!JSON.stringify(p).toLowerCase().match(/buy xp|xp pack|rank boost/));
    });
    it('reports whether checkout is available', async () => {
      assert.strictEqual((await api('GET', '/billing/plans?region=US')).body.checkoutEnabled, true);
      __setProvider('stripe', null);
      assert.strictEqual((await api('GET', '/billing/plans?region=US')).body.checkoutEnabled, false);
    });
  });

  describe('checkout', () => {
    it('requires a signed-in hunter, a valid plan and interval', async () => {
      assert.strictEqual((await api('POST', '/billing/checkout', { body: { plan: 'pro', interval: 'month' } })).status, 401);
      const u = await makeUser('co_valid');
      assert.strictEqual((await api('POST', '/billing/checkout', { cookie: u.cookie, body: { plan: 'teams', interval: 'month' } })).body.code, 'plan_unavailable');
      assert.strictEqual((await api('POST', '/billing/checkout', { cookie: u.cookie, body: { plan: 'pro', interval: 'week' } })).status, 400);
    });
    it('sends dollar customers to Stripe at the catalogue price, tagged with their id', async () => {
      const u = await makeUser('co_us');
      const r = await api('POST', '/billing/checkout', { cookie: u.cookie, body: { plan: 'pro', interval: 'year', region: 'US' } });
      assert.strictEqual(r.status, 200);
      assert.strictEqual(r.body.url, 'https://checkout.stripe.test/session');
      const sent = new URLSearchParams(stripeFetch.calls[0].body);
      assert.strictEqual(sent.get('mode'), 'subscription');
      assert.strictEqual(sent.get('line_items[0][price_data][unit_amount]'), '3499');
      assert.strictEqual(sent.get('line_items[0][price_data][currency]'), 'usd');
      assert.strictEqual(sent.get('line_items[0][price_data][recurring][interval]'), 'year');
      assert.strictEqual(sent.get('subscription_data[metadata][userId]'), String(u.id));
      assert.match(sent.get('success_url')!, /\/pricing\?checkout=success$/);
      assert.strictEqual(stripeFetch.calls[0].headers.Authorization, 'Bearer sk_test_x');
    });
    it('sends rupee customers to Razorpay, creating the plan once', async () => {
      const u = await makeUser('co_in');
      const r = await api('POST', '/billing/checkout', { cookie: u.cookie, body: { plan: 'pro', interval: 'month', region: 'IN' } });
      assert.strictEqual(r.status, 200);
      assert.strictEqual(r.body.url, 'https://rzp.io/i/test');
      const plan = JSON.parse(razorpayFetch.calls[0].body);
      assert.deepStrictEqual({ period: plan.period, amount: plan.item.amount, currency: plan.item.currency }, { period: 'monthly', amount: 7900, currency: 'INR' });
      const sub = JSON.parse(razorpayFetch.calls[1].body);
      assert.strictEqual(sub.notes.userId, String(u.id));
      assert.strictEqual(sub.notes.amountMinor, '7900');
      // A second checkout at the same price reuses the cached plan.
      const again = recordingFetch(url => (url.endsWith('/plans') ? { id: 'plan_other' } : { id: 's2', short_url: 'https://rzp.io/i/2' }));
      __setProvider('razorpay', createRazorpayProvider({ keyId: 'rzp_test_x', keySecret: 's', webhookSecret: RAZORPAY_SECRET, fetchImpl: again.impl }));
      await api('POST', '/billing/checkout', { cookie: u.cookie, body: { plan: 'pro', interval: 'month', region: 'IN' } });
      assert.ok(!again.calls.some(c => c.url.endsWith('/plans')), 'no second plan created');
    });
    it('does not let under-18s buy: a parent or guardian pays', async () => {
      const teen = await makeUser('co_teen', 'granted');
      const r = await api('POST', '/billing/checkout', { cookie: teen.cookie, body: { plan: 'pro', interval: 'month', region: 'IN' } });
      assert.deepStrictEqual({ s: r.status, c: r.body.code }, { s: 403, c: 'adult_required' });
      assert.strictEqual(razorpayFetch.calls.length, 0);
    });
    it('answers 503 when no provider is configured and 502 when the provider fails', async () => {
      const u = await makeUser('co_503');
      __setProvider('stripe', null);
      assert.strictEqual((await api('POST', '/billing/checkout', { cookie: u.cookie, body: { plan: 'pro', interval: 'month', region: 'US' } })).body.code, 'payments_not_configured');
      const failing: FetchLike = async () => ({ ok: false, status: 500, json: async () => ({ error: { message: 'boom' } }), text: async () => '' });
      __setProvider('stripe', createStripeProvider({ secretKey: 'sk_test_x', webhookSecret: STRIPE_SECRET, fetchImpl: failing }));
      const r = await api('POST', '/billing/checkout', { cookie: u.cookie, body: { plan: 'pro', interval: 'month', region: 'US' } });
      assert.deepStrictEqual({ s: r.status, c: r.body.code }, { s: 502, c: 'provider_error' });
      assert.ok(!JSON.stringify(r.body).includes('boom'), 'provider internals are not leaked');
    });
    it('does not grant anything just because checkout was started', async () => {
      const u = await makeUser('co_nogrant');
      await api('POST', '/billing/checkout', { cookie: u.cookie, body: { plan: 'pro', interval: 'month', region: 'US' } });
      assert.strictEqual((await planOf(u)).plan, 'free');
    });
  });

  describe('webhooks: the only way to a paid plan', () => {
    it('rejects a bad signature and changes nothing', async () => {
      const u = await makeUser('wh_bad');
      const r = await postStripe(stripeEvent(`evt_bad_${suffix}`, 'customer.subscription.created', now(), stripeSub(u.id, `sub_bad_${suffix}`)), 'whsec_wrong');
      assert.strictEqual(r.status, 400);
      assert.strictEqual((await planOf(u)).plan, 'free');
    });
    it('answers 503 while a provider is unconfigured, so it keeps retrying', async () => {
      __setProvider('stripe', null);
      assert.strictEqual((await postStripe({ id: 'x', type: 'y', created: 1, data: { object: {} } })).status, 503);
    });
    it('turns a hunter Pro when a verified subscription event arrives, and counts the upgrade once', async () => {
      const u = await makeUser('wh_pro');
      const sid = `sub_pro_${suffix}`;
      const r = await postStripe(stripeEvent(`evt_pro1_${suffix}`, 'customer.subscription.created', now(), stripeSub(u.id, sid)));
      assert.deepStrictEqual({ s: r.status, r: r.body.result }, { s: 200, r: 'applied' });
      const me = await planOf(u);
      assert.deepStrictEqual({ plan: me.plan, source: me.source, aiPerDay: me.limits.aiPerDay, status: me.subscription.status }, { plan: 'pro', source: 'subscription', aiPerDay: 150, status: 'active' });
      await postStripe(stripeEvent(`evt_pro2_${suffix}`, 'customer.subscription.updated', now() + 5, stripeSub(u.id, sid)));
      const ups = await pool.query(`SELECT 1 FROM events WHERE user_id = $1 AND name = 'upgrade_completed'`, [u.id]);
      assert.strictEqual(ups.rowCount, 1, 'renewals do not count as new upgrades');
    });
    it('is idempotent: a re-delivered event changes nothing', async () => {
      const u = await makeUser('wh_dup');
      const evt = stripeEvent(`evt_dup_${suffix}`, 'customer.subscription.created', now(), stripeSub(u.id, `sub_dup_${suffix}`));
      assert.strictEqual((await postStripe(evt)).body.result, 'applied');
      assert.strictEqual((await postStripe(evt)).body.result, 'duplicate');
      assert.strictEqual((await pool.query('SELECT 1 FROM subscriptions WHERE user_id = $1', [u.id])).rowCount, 1);
    });
    it('ignores a stale event that arrives after a newer one', async () => {
      const u = await makeUser('wh_stale');
      const sid = `sub_stale_${suffix}`;
      await postStripe(stripeEvent(`evt_st2_${suffix}`, 'customer.subscription.updated', now() + 100, stripeSub(u.id, sid, { cancel_at_period_end: true })));
      const old = await postStripe(stripeEvent(`evt_st1_${suffix}`, 'customer.subscription.updated', now() - 100, stripeSub(u.id, sid, { cancel_at_period_end: false })));
      assert.strictEqual(old.body.result, 'stale');
      assert.strictEqual((await planOf(u)).subscription.cancelAtPeriodEnd, true, 'the newer state wins');
    });
    it('keeps Pro through a failed renewal grace period, then drops it', async () => {
      const u = await makeUser('wh_pastdue');
      const sid = `sub_pd_${suffix}`;
      const ended = Math.floor(Date.now() / 1000) - 86400; // renewal was due yesterday
      await postStripe(stripeEvent(`evt_pd_${suffix}`, 'customer.subscription.updated', now(), stripeSub(u.id, sid, { status: 'past_due', items: { data: [{ price: { currency: 'usd', unit_amount: 399, recurring: { interval: 'month' } }, current_period_end: ended }] } })));
      assert.strictEqual((await planOf(u)).plan, 'pro', 'inside the 3-day grace');
      await postStripe(stripeEvent(`evt_pd2_${suffix}`, 'customer.subscription.deleted', now() + 10, stripeSub(u.id, sid, { status: 'canceled' })));
      assert.strictEqual((await planOf(u)).plan, 'free');
    });
    it('keeps a cancelled subscription active until the paid period ends', async () => {
      const u = await makeUser('wh_cancelflag');
      await postStripe(stripeEvent(`evt_cf_${suffix}`, 'customer.subscription.updated', now(), stripeSub(u.id, `sub_cf_${suffix}`, { cancel_at_period_end: true })));
      const me = await planOf(u);
      assert.deepStrictEqual({ plan: me.plan, c: me.subscription.cancelAtPeriodEnd }, { plan: 'pro', c: true });
    });
    it('ends access at once on a full refund, and a later event cannot revive it', async () => {
      const u = await makeUser('wh_refund');
      const sid = `sub_rf_${suffix}`;
      await postStripe(stripeEvent(`evt_rf1_${suffix}`, 'customer.subscription.created', now(), stripeSub(u.id, sid)));
      assert.strictEqual((await planOf(u)).plan, 'pro');
      const r = await postStripe({ id: `evt_rf2_${suffix}`, type: 'charge.refunded', created: now() + 5, data: { object: { refunded: true, customer: `cus_${sid}` } } });
      assert.strictEqual(r.body.result, 'applied');
      assert.strictEqual((await planOf(u)).plan, 'free');
      await postStripe(stripeEvent(`evt_rf3_${suffix}`, 'customer.subscription.updated', now() + 50, stripeSub(u.id, sid)));
      assert.strictEqual((await planOf(u)).plan, 'free', 'refund is final');
    });
    it('does not revoke on a partial refund', async () => {
      const u = await makeUser('wh_partial');
      const sid = `sub_pr_${suffix}`;
      await postStripe(stripeEvent(`evt_pr1_${suffix}`, 'customer.subscription.created', now(), stripeSub(u.id, sid)));
      await postStripe({ id: `evt_pr2_${suffix}`, type: 'charge.refunded', created: now() + 5, data: { object: { refunded: false, customer: `cus_${sid}` } } });
      assert.strictEqual((await planOf(u)).plan, 'pro');
    });
    it('stores events for unknown hunters without inventing a subscription', async () => {
      const r = await postStripe(stripeEvent(`evt_unk_${suffix}`, 'customer.subscription.created', now(), stripeSub(999_999_999, `sub_unk_${suffix}`, { metadata: {} })));
      assert.strictEqual(r.body.result, 'unknown_user');
      assert.strictEqual((await pool.query('SELECT 1 FROM subscriptions WHERE provider_subscription_id = $1', [`sub_unk_${suffix}`])).rowCount, 0);
    });
    it('handles Razorpay: activation, renewal, then a full refund', async () => {
      const u = await makeUser('wh_rzp');
      const sid = `sub_rzp_${suffix}`;
      const sub = (event: string, status: string, pay = `pay_${suffix}`) => ({
        event, created_at: now(),
        payload: { subscription: { entity: { id: sid, status, customer_id: 'cust_r', current_end: now() + 30 * 86400, notes: { userId: String(u.id), plan: 'pro', interval: 'month', currency: 'INR', amountMinor: '7900' } } }, payment: { entity: { id: pay } } },
      });
      assert.strictEqual((await postRazorpay(sub('subscription.activated', 'active'), `evt_rz1_${suffix}`)).body.result, 'applied');
      const me = await planOf(u);
      assert.deepStrictEqual({ plan: me.plan, cur: me.subscription.currency, amt: me.subscription.amountMinor, p: me.subscription.provider }, { plan: 'pro', cur: 'INR', amt: 7900, p: 'razorpay' });
      assert.strictEqual((await postRazorpay({ ...sub('subscription.charged', 'active'), created_at: now() + 5 }, `evt_rz2_${suffix}`)).body.result, 'applied');
      assert.strictEqual((await postRazorpay({ event: 'refund.processed', created_at: now() + 9, payload: { payment: { entity: { id: `pay_${suffix}`, amount: 7900, refund_status: 'full' } } } }, `evt_rz3_${suffix}`)).body.result, 'applied');
      assert.strictEqual((await planOf(u)).plan, 'free');
    });
    it('rejects a Razorpay webhook with a wrong signature', async () => {
      assert.strictEqual((await postRazorpay({ event: 'subscription.activated', payload: {} }, `evt_rzbad_${suffix}`, 'wrong')).status, 400);
    });
  });

  describe('cancellation', () => {
    it('says so when there is nothing to cancel', async () => {
      const u = await makeUser('cx_none');
      assert.strictEqual((await api('POST', '/billing/cancel', { cookie: u.cookie })).body.code, 'no_subscription');
    });
    it('asks the provider to stop renewing, keeps access until the period ends, and is idempotent', async () => {
      const u = await makeUser('cx_ok');
      const sid = `sub_cx_${suffix}`;
      await postStripe(stripeEvent(`evt_cx_${suffix}`, 'customer.subscription.created', now(), stripeSub(u.id, sid)));
      const r = await api('POST', '/billing/cancel', { cookie: u.cookie });
      assert.strictEqual(r.status, 200);
      assert.deepStrictEqual({ plan: r.body.plan, cancel: r.body.subscription.cancelAtPeriodEnd }, { plan: 'pro', cancel: true });
      const call = stripeFetch.calls.find(c => c.url.includes(`/subscriptions/${sid}`))!;
      assert.strictEqual(new URLSearchParams(call.body).get('cancel_at_period_end'), 'true');
      const before = stripeFetch.calls.length;
      assert.strictEqual((await api('POST', '/billing/cancel', { cookie: u.cookie })).status, 200);
      assert.strictEqual(stripeFetch.calls.length, before, 'the provider is not asked twice');
    });
    it('only cancels the signed-in hunter\'s own subscription', async () => {
      const owner = await makeUser('cx_owner');
      const other = await makeUser('cx_other');
      await postStripe(stripeEvent(`evt_cxo_${suffix}`, 'customer.subscription.created', now(), stripeSub(owner.id, `sub_cxo_${suffix}`)));
      assert.strictEqual((await api('POST', '/billing/cancel', { cookie: other.cookie })).body.code, 'no_subscription');
      assert.strictEqual((await planOf(owner)).subscription.cancelAtPeriodEnd, false);
    });
    it('refuses a second subscription while one is active', async () => {
      const u = await makeUser('cx_double');
      await postStripe(stripeEvent(`evt_cxd_${suffix}`, 'customer.subscription.created', now(), stripeSub(u.id, `sub_cxd_${suffix}`)));
      const r = await api('POST', '/billing/checkout', { cookie: u.cookie, body: { plan: 'pro', interval: 'month', region: 'US' } });
      assert.strictEqual(r.body.code, 'already_subscribed');
    });
  });

  describe('grants (referrals, class pilots)', () => {
    it('make a hunter Pro until the grant ends, and only ever extend', async () => {
      const u = await makeUser('gr_ok');
      const first = await grantPro(u.id, 30);
      const me = await planOf(u);
      assert.deepStrictEqual({ plan: me.plan, source: me.source }, { plan: 'pro', source: 'grant' });
      const second = await grantPro(u.id, 30);
      assert.ok(second.getTime() > first.getTime() + 29 * 86_400_000, 'a second grant stacks onto the first');
    });
    it('lapse back to free', async () => {
      const u = await makeUser('gr_lapse');
      await pool.query(`UPDATE users SET pro_until = NOW() - INTERVAL '1 day' WHERE id = $1`, [u.id]);
      assert.strictEqual((await planOf(u)).plan, 'free');
    });
  });

  describe('daily AI allowance', () => {
    let calls = 0;
    const prevKey = process.env.GEMINI_API_KEY;
    before(() => { process.env.GEMINI_API_KEY = 'test-key-not-used'; });
    after(() => { __setCompleter(null); if (prevKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = prevKey; });
    beforeEach(() => { calls = 0; __setCompleter(async () => { calls += 1; return { ok: true }; }); });
    const ask = (u: { cookie: string }) => api('POST', '/ai-test', { cookie: u.cookie });
    const used = async (id: number) => (await pool.query(`SELECT COALESCE(SUM(count), 0)::int AS n FROM ai_usage WHERE user_id = $1`, [id])).rows[0].n as number;

    it('lets a free hunter use 10 AI suggestions a day, then falls back honestly', async () => {
      const u = await makeUser('ai_free');
      for (let i = 0; i < 10; i++) assert.deepStrictEqual((await ask(u)).body, { raw: { ok: true }, limited: false });
      const eleventh = (await ask(u)).body;
      assert.deepStrictEqual(eleventh, { raw: null, limited: true });
      assert.strictEqual(calls, 10, 'the provider is not called once the allowance is gone');
      assert.strictEqual(await used(u.id), 10);
    });
    it('gives Pro hunters a much bigger allowance', async () => {
      const u = await makeUser('ai_pro');
      await grantPro(u.id, 30);
      for (let i = 0; i < 12; i++) assert.strictEqual((await ask(u)).body.limited, false);
      assert.strictEqual((await planOf(u)).limits.aiPerDay, 150);
    });
    it('does not charge the allowance for a call that fails', async () => {
      const u = await makeUser('ai_fail');
      __setCompleter(async () => null);
      for (let i = 0; i < 15; i++) assert.deepStrictEqual((await ask(u)).body, { raw: null, limited: false });
      assert.strictEqual(await used(u.id), 0);
    });
    it('cannot be overshot by simultaneous requests', async () => {
      const u = await makeUser('ai_race');
      const results = await Promise.all(Array.from({ length: 15 }, () => ask(u)));
      assert.strictEqual(results.filter(r => r.body.limited === false).length, 10);
      assert.strictEqual(results.filter(r => r.body.limited === true).length, 5);
      assert.strictEqual(calls, 10);
    });
    it('counts each day separately', async () => {
      const u = await makeUser('ai_day');
      await pool.query(`INSERT INTO ai_usage (user_id, day, count) VALUES ($1, CURRENT_DATE - 1, 10)`, [u.id]);
      assert.strictEqual((await ask(u)).body.limited, false);
    });
    it('shows today\'s use in the billing state', async () => {
      const u = await makeUser('ai_state');
      await ask(u); await ask(u); await ask(u);
      assert.strictEqual((await planOf(u)).aiUsedToday, 3);
    });
    it('does nothing when AI is not configured at all', async () => {
      const u = await makeUser('ai_off');
      const key = process.env.GEMINI_API_KEY;
      delete process.env.GEMINI_API_KEY;
      try {
        assert.deepStrictEqual((await ask(u)).body, { raw: null, limited: false });
        assert.strictEqual(await used(u.id), 0, 'no allowance is used when there is nothing to call');
      } finally { process.env.GEMINI_API_KEY = key; }
    });
  });

  describe('data rights', () => {
    it('removes a hunter\'s subscriptions with their account', async () => {
      const u = await makeUser('dr_del');
      await postStripe(stripeEvent(`evt_dr_${suffix}`, 'customer.subscription.created', now(), stripeSub(u.id, `sub_dr_${suffix}`)));
      await pool.query('DELETE FROM users WHERE id = $1', [u.id]);
      assert.strictEqual((await pool.query('SELECT 1 FROM subscriptions WHERE user_id = $1', [u.id])).rowCount, 0);
    });
  });
});
