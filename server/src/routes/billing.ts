import { Router, Request, Response } from 'express';
import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { hit, tooMany } from '../middleware/security.js';
import { detectRegion } from '../region.js';
import { appUrl } from '../mailer.js';
import { entitlementForUser, limitsFor } from '../billing.js';
import { aiUsedToday } from '../aiQuota.js';
import { requestToday } from '../time.js';
import { PLAN_FEATURES, PRICE_GROUP_CURRENCY, priceFor, priceGroupFor, providerFor, yearlySavingsPct, type Interval } from '../pricing.js';
import { getProvider, paymentsMode } from '../payments/index.js';
import { ProviderError } from '../payments/types.js';

const router = Router();

const regionFrom = (req: Request): string => {
  const q = String(req.query.region ?? req.body?.region ?? '').toUpperCase();
  return /^[A-Z]{2}$/.test(q) ? q : detectRegion(req) ?? 'US';
};

// GET /api/billing/plans?region=IN — public: the catalogue priced for a market.
router.get('/plans', (req: Request, res: Response) => {
  const region = regionFrom(req);
  const group = priceGroupFor(region);
  const currency = PRICE_GROUP_CURRENCY[group];
  const provider = providerFor(currency);
  const price = (interval: Interval) => priceFor('pro', interval, group);
  res.set('Cache-Control', 'public, max-age=300');
  res.json({
    region, group, currency,
    checkoutEnabled: !!getProvider(provider),
    mode: paymentsMode(),
    plans: [
      { id: 'free', features: PLAN_FEATURES.free, limits: limitsFor('free') },
      {
        id: 'pro', features: PLAN_FEATURES.pro, limits: limitsFor('pro'),
        prices: { month: price('month'), year: price('year') },
        yearlySavingsPct: yearlySavingsPct('pro', group),
      },
    ],
  });
});

async function subscriptionState(userId: number, day: string) {
  const ent = await entitlementForUser(userId);
  const sub = (await pool.query(
    `SELECT provider, interval, status, currency, amount_minor, current_period_end, cancel_at_period_end
     FROM subscriptions WHERE user_id = $1 ORDER BY (status IN ('active','past_due')) DESC, updated_at DESC LIMIT 1`,
    [userId],
  )).rows[0];
  return {
    plan: ent.plan,
    source: ent.source,
    until: ent.until,
    limits: limitsFor(ent.plan),
    aiUsedToday: await aiUsedToday(userId, day),
    subscription: sub ? {
      provider: sub.provider, interval: sub.interval, status: sub.status, currency: sub.currency, amountMinor: sub.amount_minor,
      currentPeriodEnd: sub.current_period_end, cancelAtPeriodEnd: sub.cancel_at_period_end,
    } : null,
  };
}

// GET /api/billing/me
router.get('/me', authenticateToken, async (req: Request, res: Response) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json(await subscriptionState(req.user!.id, requestToday(req)));
  } catch (error) {
    console.error('Billing state error:', error);
    res.status(500).json({ error: 'Failed to load billing' });
  }
});

// POST /api/billing/checkout { plan: 'pro', interval, region? } → { url }
// The browser is sent to the provider's hosted page. Paying changes nothing
// here: only the verified webhook grants access.
router.post('/checkout', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const wait = hit(`checkout:${userId}`, 10, 60 * 60_000);
    if (wait) return tooMany(res, wait, 'checkout attempts');
    if (req.body?.plan !== 'pro') return res.status(400).json({ error: 'That plan is not available yet.', code: 'plan_unavailable' });
    const interval: Interval | null = req.body?.interval === 'month' || req.body?.interval === 'year' ? req.body.interval : null;
    if (!interval) return res.status(400).json({ error: 'interval must be "month" or "year"' });

    const u = (await pool.query('SELECT username, consent_status FROM users WHERE id = $1', [userId])).rows[0];
    if (!u) return res.status(404).json({ error: 'User not found' });
    // Under-18s do not enter into purchases: a parent or guardian pays.
    if (u.consent_status !== 'not_required') {
      return res.status(403).json({ error: 'A parent or guardian needs to subscribe on your behalf.', code: 'adult_required' });
    }
    const state = await subscriptionState(userId, requestToday(req));
    if (state.source === 'subscription') return res.status(409).json({ error: 'You already have an active subscription.', code: 'already_subscribed' });

    const group = priceGroupFor(regionFrom(req));
    const { currency, amountMinor } = priceFor('pro', interval, group);
    const provider = getProvider(providerFor(currency));
    if (!provider) return res.status(503).json({ error: 'Payments are not available yet.', code: 'payments_not_configured' });

    const { url } = await provider.createCheckout({
      userId, username: u.username, plan: 'pro', interval, currency, amountMinor,
      successUrl: `${appUrl()}/pricing?checkout=success`,
      cancelUrl: `${appUrl()}/pricing?checkout=cancelled`,
    });
    res.json({ url, currency, amountMinor, interval });
  } catch (error) {
    if (error instanceof ProviderError) {
      console.error('Checkout provider error:', error.message);
      return res.status(502).json({ error: 'The payment provider could not start checkout. Please try again.', code: 'provider_error' });
    }
    console.error('Checkout error:', error);
    res.status(500).json({ error: 'Failed to start checkout' });
  }
});

// POST /api/billing/cancel — stop renewing at the end of the paid period. One tap, no questions.
router.post('/cancel', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const sub = (await pool.query(
      `SELECT id, provider, provider_subscription_id, cancel_at_period_end FROM subscriptions
       WHERE user_id = $1 AND status IN ('active', 'past_due') ORDER BY updated_at DESC LIMIT 1`,
      [userId],
    )).rows[0];
    if (!sub) return res.status(404).json({ error: 'You have no active subscription.', code: 'no_subscription' });
    if (!sub.cancel_at_period_end) {
      const provider = getProvider(sub.provider);
      if (!provider) return res.status(503).json({ error: 'Cancellation is temporarily unavailable. Please try again shortly.', code: 'payments_not_configured' });
      await provider.cancelAtPeriodEnd(sub.provider_subscription_id);
      await pool.query('UPDATE subscriptions SET cancel_at_period_end = true, updated_at = NOW() WHERE id = $1', [sub.id]);
    }
    res.json(await subscriptionState(userId, requestToday(req)));
  } catch (error) {
    if (error instanceof ProviderError) {
      console.error('Cancel provider error:', error.message);
      return res.status(502).json({ error: 'The payment provider could not cancel right now. Please try again.', code: 'provider_error' });
    }
    console.error('Cancel error:', error);
    res.status(500).json({ error: 'Failed to cancel' });
  }
});

export default router;
