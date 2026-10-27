/**
 * Unit tests for pricing, entitlements, the live-key guard, webhook signature
 * verification and provider event normalization. No network, no database.
 * Run with: npx tsx --test src/tests/billing.unit.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createHmac } from 'node:crypto';
import { priceFor, priceGroupFor, providerFor, yearlySavingsPct, PRICE_GROUP_CURRENCY, PLAN_LIMITS } from '../pricing.js';
import { entitlementOf, subscriptionEntitles } from '../billing.js';
import { checkKey } from '../payments/index.js';
import { normalizeStripeEvent, verifyStripeSignature } from '../payments/stripe.js';
import { normalizeRazorpayEvent, verifyRazorpaySignature } from '../payments/razorpay.js';
import { WebhookSignatureError } from '../payments/types.js';
import { rewardsEarned, MAX_REWARDS } from '../referrals.js';

const NOW = new Date('2026-10-10T12:00:00Z');
const inDays = (n: number) => new Date(NOW.getTime() + n * 86_400_000);

describe('regional pricing', () => {
  it('maps markets to price groups', () => {
    assert.strictEqual(priceGroupFor('IN'), 'IN');
    assert.strictEqual(priceGroupFor('in'), 'IN');
    assert.strictEqual(priceGroupFor('GB'), 'GB');
    assert.strictEqual(priceGroupFor('DE'), 'EU');
    assert.strictEqual(priceGroupFor('FR'), 'EU');
    assert.strictEqual(priceGroupFor('AE'), 'AE');
    assert.strictEqual(priceGroupFor('SA'), 'AE');
    assert.strictEqual(priceGroupFor('ID'), 'LOW');
    assert.strictEqual(priceGroupFor('BR'), 'LOW');
    assert.strictEqual(priceGroupFor('US'), 'US');
    assert.strictEqual(priceGroupFor('SG'), 'US');
    assert.strictEqual(priceGroupFor(null), 'US');
    assert.strictEqual(priceGroupFor('nonsense'), 'US');
  });
  it('prices India for students and the West at a few dollars', () => {
    assert.deepStrictEqual(priceFor('pro', 'month', 'IN'), { currency: 'INR', amountMinor: 7900 });
    assert.deepStrictEqual(priceFor('pro', 'year', 'IN'), { currency: 'INR', amountMinor: 60000 });
    assert.deepStrictEqual(priceFor('pro', 'month', 'US'), { currency: 'USD', amountMinor: 399 });
    assert.deepStrictEqual(priceFor('pro', 'year', 'US'), { currency: 'USD', amountMinor: 3499 });
    assert.deepStrictEqual(priceFor('pro', 'month', 'LOW'), { currency: 'USD', amountMinor: 199 });
  });
  it('keeps every price inside the intended bands and yearly cheaper than monthly x12', () => {
    for (const g of Object.keys(PRICE_GROUP_CURRENCY) as (keyof typeof PRICE_GROUP_CURRENCY)[]) {
      const m = priceFor('pro', 'month', g).amountMinor;
      const y = priceFor('pro', 'year', g).amountMinor;
      assert.ok(y < m * 12, `${g}: yearly must save money`);
      assert.ok(yearlySavingsPct('pro', g) >= 15, `${g}: meaningful annual saving`);
    }
    assert.ok(priceFor('pro', 'month', 'IN').amountMinor <= 9900 && priceFor('pro', 'month', 'IN').amountMinor >= 4900, 'India ₹49–99/mo');
    assert.ok(priceFor('pro', 'year', 'IN').amountMinor <= 79900 && priceFor('pro', 'year', 'IN').amountMinor >= 49900, 'India ₹499–799/yr');
    assert.ok(priceFor('pro', 'month', 'US').amountMinor <= 500 && priceFor('pro', 'month', 'US').amountMinor >= 300, 'US $3–5/mo');
    assert.ok(priceFor('pro', 'year', 'US').amountMinor <= 3900 && priceFor('pro', 'year', 'US').amountMinor >= 2900, 'US $29–39/yr');
  });
  it('sends rupees to Razorpay and everything else to Stripe', () => {
    assert.strictEqual(providerFor('INR'), 'razorpay');
    for (const c of ['USD', 'EUR', 'GBP', 'AED']) assert.strictEqual(providerFor(c), 'stripe');
  });
  it('never gates XP behind a plan: limits only cover AI headroom and cosmetics', () => {
    assert.deepStrictEqual(Object.keys(PLAN_LIMITS.free).sort(), ['aiPerDay', 'premiumCosmetics']);
    assert.ok(PLAN_LIMITS.pro.aiPerDay > PLAN_LIMITS.free.aiPerDay);
  });
});

describe('entitlements', () => {
  const sub = (status: any, end: Date | null) => ({ status, current_period_end: end });
  it('active subscriptions entitle until their period ends', () => {
    assert.ok(subscriptionEntitles(sub('active', inDays(10)), NOW));
    assert.ok(!subscriptionEntitles(sub('active', inDays(-1)), NOW));
  });
  it('cancelled subscriptions keep what was paid for, then stop', () => {
    assert.ok(subscriptionEntitles(sub('canceled', inDays(5)), NOW));
    assert.ok(!subscriptionEntitles(sub('canceled', inDays(-1)), NOW));
  });
  it('failed renewals get a 3-day grace period', () => {
    assert.ok(subscriptionEntitles(sub('past_due', inDays(-2)), NOW));
    assert.ok(!subscriptionEntitles(sub('past_due', inDays(-4)), NOW));
  });
  it('expired and refunded never entitle', () => {
    assert.ok(!subscriptionEntitles(sub('expired', inDays(30)), NOW));
    assert.ok(!subscriptionEntitles(sub('refunded', inDays(30)), NOW));
  });
  it('picks the plan and its source', () => {
    assert.deepStrictEqual(entitlementOf({ subscriptions: [] }, NOW), { plan: 'free', source: null, until: null });
    assert.strictEqual(entitlementOf({ subscriptions: [sub('active', inDays(10))] }, NOW).source, 'subscription');
    assert.deepStrictEqual(entitlementOf({ subscriptions: [], proUntil: inDays(7) }, NOW), { plan: 'pro', source: 'grant', until: inDays(7) });
    assert.strictEqual(entitlementOf({ subscriptions: [], proUntil: inDays(-1) }, NOW).plan, 'free');
  });
  it('prefers whichever of a subscription and a grant lasts longer', () => {
    assert.strictEqual(entitlementOf({ subscriptions: [sub('active', inDays(5))], proUntil: inDays(30) }, NOW).source, 'grant');
    assert.strictEqual(entitlementOf({ subscriptions: [sub('active', inDays(30))], proUntil: inDays(5) }, NOW).source, 'subscription');
  });
});

describe('live-payment guard', () => {
  it('accepts test keys', () => {
    assert.deepStrictEqual(checkKey('stripe', 'sk_test_abc', {}), { ok: true, mode: 'test' });
    assert.deepStrictEqual(checkKey('razorpay', 'rzp_test_abc', {}), { ok: true, mode: 'test' });
  });
  it('refuses live keys until PAYMENTS_LIVE=true', () => {
    for (const [p, k] of [['stripe', 'sk_live_abc'], ['stripe', 'rk_live_abc'], ['razorpay', 'rzp_live_abc']] as const) {
      const r = checkKey(p, k, {});
      assert.strictEqual(r.ok, false);
      assert.match((r as any).reason, /PAYMENTS_LIVE/);
      assert.deepStrictEqual(checkKey(p, k, { PAYMENTS_LIVE: 'true' }), { ok: true, mode: 'live' });
    }
    assert.strictEqual(checkKey('stripe', 'sk_live_abc', { PAYMENTS_LIVE: 'yes' }).ok, false, 'only the exact value "true" counts');
  });
  it('rejects missing and malformed keys', () => {
    assert.strictEqual(checkKey('stripe', undefined, {}).ok, false);
    assert.strictEqual(checkKey('stripe', 'pk_test_abc', {}).ok, false, 'a publishable key is not a secret key');
    assert.strictEqual(checkKey('razorpay', 'sk_test_abc', {}).ok, false);
  });
});

describe('Stripe webhook signature', () => {
  const secret = 'whsec_unit';
  const body = Buffer.from(JSON.stringify({ id: 'evt_1', type: 'x' }));
  const sign = (t: number, b = body, s = secret) => `t=${t},v1=${createHmac('sha256', s).update(`${t}.`).update(b).digest('hex')}`;
  const t = Math.floor(NOW.getTime() / 1000);
  it('accepts a correct signature', () => { verifyStripeSignature(body, sign(t), secret, NOW); });
  it('rejects a wrong secret, a tampered body, a stale timestamp and junk', () => {
    assert.throws(() => verifyStripeSignature(body, sign(t, body, 'whsec_other'), secret, NOW), WebhookSignatureError);
    assert.throws(() => verifyStripeSignature(Buffer.from('{"id":"evt_1","type":"y"}'), sign(t), secret, NOW), WebhookSignatureError);
    assert.throws(() => verifyStripeSignature(body, sign(t - 3600), secret, NOW), WebhookSignatureError);
    assert.throws(() => verifyStripeSignature(body, undefined, secret, NOW), WebhookSignatureError);
    assert.throws(() => verifyStripeSignature(body, 'garbage', secret, NOW), WebhookSignatureError);
    assert.throws(() => verifyStripeSignature(body, `t=${t},v1=zz`, secret, NOW), WebhookSignatureError);
  });
});

describe('Razorpay webhook signature', () => {
  const secret = 'rzp_whsec';
  const body = Buffer.from('{"event":"subscription.activated"}');
  const sig = createHmac('sha256', secret).update(body).digest('hex');
  it('accepts a correct signature and rejects everything else', () => {
    verifyRazorpaySignature(body, sig, secret);
    assert.throws(() => verifyRazorpaySignature(body, sig, 'other'), WebhookSignatureError);
    assert.throws(() => verifyRazorpaySignature(Buffer.from('{"event":"x"}'), sig, secret), WebhookSignatureError);
    assert.throws(() => verifyRazorpaySignature(body, undefined, secret), WebhookSignatureError);
    assert.throws(() => verifyRazorpaySignature(body, 'nothex', secret), WebhookSignatureError);
  });
});

describe('Stripe event normalization', () => {
  const subEvent = (over: any = {}, type = 'customer.subscription.updated') => ({
    id: 'evt_s', type, created: 1_800_000_000,
    data: { object: {
      id: 'sub_1', customer: 'cus_1', status: 'active', cancel_at_period_end: false,
      metadata: { userId: '42', plan: 'pro' },
      items: { data: [{ price: { currency: 'usd', unit_amount: 399, recurring: { interval: 'month' } }, current_period_end: 1_802_000_000 }] },
      ...over,
    } },
  });
  it('maps an active monthly subscription (period end on the item, as in newer API versions)', () => {
    const e = normalizeStripeEvent(subEvent());
    assert.deepStrictEqual(
      { kind: e.kind, sid: e.subscriptionId, user: e.userId, status: e.status, interval: e.interval, cur: e.currency, amt: e.amountMinor, end: e.periodEnd?.getTime(), cancel: e.cancelAtPeriodEnd },
      { kind: 'subscription', sid: 'sub_1', user: 42, status: 'active', interval: 'month', cur: 'USD', amt: 399, end: 1_802_000_000_000, cancel: false },
    );
  });
  it('reads the period end from the subscription on older API versions', () => {
    const e = normalizeStripeEvent(subEvent({ current_period_end: 1_801_000_000, items: { data: [{ price: { currency: 'eur', unit_amount: 3499, recurring: { interval: 'year' } } }] } }));
    assert.strictEqual(e.periodEnd?.getTime(), 1_801_000_000_000);
    assert.strictEqual(e.interval, 'year');
    assert.strictEqual(e.currency, 'EUR');
  });
  it('maps statuses', () => {
    assert.strictEqual(normalizeStripeEvent(subEvent({ status: 'trialing' })).status, 'active');
    assert.strictEqual(normalizeStripeEvent(subEvent({ status: 'past_due' })).status, 'past_due');
    assert.strictEqual(normalizeStripeEvent(subEvent({ status: 'canceled' }, 'customer.subscription.deleted')).status, 'expired');
    assert.strictEqual(normalizeStripeEvent(subEvent({ status: 'incomplete' })).kind, 'ignored');
  });
  it('flags a scheduled cancellation', () => {
    assert.strictEqual(normalizeStripeEvent(subEvent({ cancel_at_period_end: true })).cancelAtPeriodEnd, true);
  });
  it('treats only a fully refunded charge as a refund', () => {
    const refund = (refunded: boolean) => ({ id: 'evt_r', type: 'charge.refunded', created: 1, data: { object: { refunded, customer: 'cus_1' } } });
    assert.deepStrictEqual({ k: normalizeStripeEvent(refund(true)).kind, c: normalizeStripeEvent(refund(true)).customerId }, { k: 'refund', c: 'cus_1' });
    assert.strictEqual(normalizeStripeEvent(refund(false)).kind, 'ignored');
  });
  it('ignores events it does not care about', () => {
    assert.strictEqual(normalizeStripeEvent({ id: 'e', type: 'invoice.created', created: 1, data: { object: {} } }).kind, 'ignored');
  });
});

describe('Razorpay event normalization', () => {
  const sub = (event: string, status: string, extra: any = {}) => ({
    event, created_at: 1_800_000_000,
    payload: {
      subscription: { entity: { id: 'sub_rz', status, customer_id: 'cust_1', current_end: 1_802_000_000, notes: { userId: '7', plan: 'pro', interval: 'year', currency: 'INR', amountMinor: '59900' }, ...extra } },
      payment: { entity: { id: 'pay_1' } },
    },
  });
  it('maps activation and renewal to active with the note-carried price', () => {
    for (const ev of ['subscription.activated', 'subscription.charged']) {
      const e = normalizeRazorpayEvent(sub(ev, 'active'), 'evt');
      assert.deepStrictEqual(
        { kind: e.kind, sid: e.subscriptionId, user: e.userId, status: e.status, interval: e.interval, cur: e.currency, amt: e.amountMinor, pay: e.paymentId, end: e.periodEnd?.getTime() },
        { kind: 'subscription', sid: 'sub_rz', user: 7, status: 'active', interval: 'year', cur: 'INR', amt: 59900, pay: 'pay_1', end: 1_802_000_000_000 },
      );
    }
  });
  it('maps failure, cancellation and completion', () => {
    assert.strictEqual(normalizeRazorpayEvent(sub('subscription.pending', 'pending'), 'e').status, 'past_due');
    assert.strictEqual(normalizeRazorpayEvent(sub('subscription.halted', 'halted'), 'e').status, 'expired');
    const c = normalizeRazorpayEvent(sub('subscription.cancelled', 'cancelled'), 'e');
    assert.deepStrictEqual({ s: c.status, f: c.cancelAtPeriodEnd }, { s: 'canceled', f: true });
    assert.strictEqual(normalizeRazorpayEvent(sub('subscription.completed', 'completed'), 'e').status, 'expired');
  });
  it('ignores authentication and other noise', () => {
    assert.strictEqual(normalizeRazorpayEvent(sub('subscription.authenticated', 'authenticated'), 'e').kind, 'ignored');
    assert.strictEqual(normalizeRazorpayEvent({ event: 'order.paid', payload: {} }, 'e').kind, 'ignored');
  });
  it('revokes only on a full refund', () => {
    const refund = (p: any) => ({ event: 'refund.processed', created_at: 1, payload: { payment: { entity: { id: 'pay_9', amount: 7900, ...p } } } });
    const full = normalizeRazorpayEvent(refund({ refund_status: 'full' }), 'e');
    assert.deepStrictEqual({ k: full.kind, p: full.paymentId }, { k: 'refund', p: 'pay_9' });
    assert.strictEqual(normalizeRazorpayEvent(refund({ refund_status: 'partial', amount_refunded: 1000 }), 'e').kind, 'ignored');
    assert.strictEqual(normalizeRazorpayEvent(refund({ amount_refunded: 7900 }), 'e').kind, 'refund');
  });
});

describe('referral rewards', () => {
  it('earns one month per three qualified friends, up to the cap', () => {
    assert.deepStrictEqual([0, 1, 2, 3, 5, 6, 8, 9].map(rewardsEarned), [0, 0, 0, 1, 1, 2, 2, 3]);
    assert.strictEqual(rewardsEarned(36), MAX_REWARDS);
    assert.strictEqual(rewardsEarned(3000), MAX_REWARDS);
  });
});
