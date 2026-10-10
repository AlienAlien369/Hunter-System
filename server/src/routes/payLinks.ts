import { Router, Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { hit, tooMany } from '../middleware/security.js';
import { detectRegion } from '../region.js';
import { appUrl } from '../mailer.js';
import { hashToken } from '../consent.js';
import { entitlementForUser } from '../billing.js';
import { priceFor, priceGroupFor, providerFor, type Interval } from '../pricing.js';
import { getProvider } from '../payments/index.js';
import { ProviderError } from '../payments/types.js';

// A parent pays for their child's Pro. Under-18s cannot purchase, so the child
// generates a link, shares it (WhatsApp, say), and the parent opens it WITHOUT
// an account, sees exactly what they would pay, and checks out. The parent can
// also cancel from the same link. As everywhere in billing, paying changes
// nothing until the provider's verified webhook arrives.
const router = Router();

export const PAY_LINK_DAYS = 7;

const regionFrom = (req: Request): string => {
  const q = String(req.body?.region ?? '').toUpperCase();
  return /^[A-Z]{2}$/.test(q) ? q : detectRegion(req) ?? 'US';
};

async function findLink(raw: unknown) {
  if (typeof raw !== 'string' || raw.length < 20 || raw.length > 100) return null;
  const r = await pool.query(
    `SELECT l.id, l.user_id, l.interval, l.currency, l.amount_minor, l.expires_at, u.name, u.name_set
     FROM pay_links l JOIN users u ON u.id = l.user_id WHERE l.token_hash = $1`,
    [hashToken(raw)],
  );
  return r.rows[0] ?? null;
}

// POST /api/pay-links { interval, region? } — the child creates a link to share with a parent.
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const wait = hit(`paylink-create:${userId}`, 10, 60 * 60_000);
    if (wait) return tooMany(res, wait, 'pay links');
    const interval: Interval | null = req.body?.interval === 'month' || req.body?.interval === 'year' ? req.body.interval : null;
    if (!interval) return res.status(400).json({ error: 'interval must be "month" or "year"' });
    const u = (await pool.query('SELECT consent_status FROM users WHERE id = $1', [userId])).rows[0];
    // Adults pay for themselves; a pay link is only for hunters under 18 whose parent has consented.
    if (u?.consent_status !== 'granted') return res.status(400).json({ error: 'Pay links are for hunters under 18. You can subscribe directly.', code: 'not_a_minor' });
    if ((await entitlementForUser(userId)).source === 'subscription') return res.status(409).json({ error: 'You already have an active subscription.', code: 'already_subscribed' });
    const group = priceGroupFor(regionFrom(req));
    const { currency, amountMinor } = priceFor('pro', interval, group);
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + PAY_LINK_DAYS * 86_400_000);
    await pool.query(
      'INSERT INTO pay_links (user_id, token_hash, interval, currency, amount_minor, expires_at) VALUES ($1, $2, $3, $4, $5, $6)',
      [userId, hashToken(token), interval, currency, amountMinor, expiresAt],
    );
    // The token lives in the URL fragment: it never reaches a server log or a Referer header.
    res.status(201).json({ url: `${appUrl()}/pay#token=${token}`, interval, currency, amountMinor, expiresAt });
  } catch (error) {
    console.error('Pay link create error:', error);
    res.status(500).json({ error: 'Failed to create the link' });
  }
});

// POST /api/pay-links/lookup { token } — what the parent sees before paying. Public; the token is the credential.
router.post('/lookup', async (req: Request, res: Response) => {
  if (hit(`paylink:${req.ip}`, 40, 60 * 60_000)) return res.status(429).json({ error: 'Too many requests' });
  try {
    const l = await findLink(req.body?.token);
    if (!l) return res.status(404).json({ error: 'This link is not valid.' });
    const ent = await entitlementForUser(l.user_id);
    const sub = (await pool.query(
      `SELECT interval, currency, amount_minor, current_period_end, cancel_at_period_end FROM subscriptions
       WHERE user_id = $1 AND status IN ('active', 'past_due') ORDER BY updated_at DESC LIMIT 1`, [l.user_id])).rows[0];
    res.set('Cache-Control', 'no-store');
    res.json({
      // The hunter name only if they chose one; never a login username.
      name: l.name_set ? l.name : null,
      interval: l.interval, currency: l.currency, amountMinor: l.amount_minor,
      expired: new Date(l.expires_at) < new Date(),
      expiresAt: l.expires_at,
      subscribed: ent.source === 'subscription',
      subscription: sub ? { interval: sub.interval, currency: sub.currency, amountMinor: sub.amount_minor, currentPeriodEnd: sub.current_period_end, cancelAtPeriodEnd: sub.cancel_at_period_end } : null,
    });
  } catch (error) {
    console.error('Pay link lookup error:', error);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// POST /api/pay-links/checkout { token } → { url }
router.post('/checkout', async (req: Request, res: Response) => {
  if (hit(`paylink:${req.ip}`, 40, 60 * 60_000)) return res.status(429).json({ error: 'Too many requests' });
  try {
    const l = await findLink(req.body?.token);
    if (!l) return res.status(404).json({ error: 'This link is not valid.' });
    if (new Date(l.expires_at) < new Date()) return res.status(410).json({ error: 'This link has expired. Ask your child for a new one.', code: 'expired' });
    if ((await entitlementForUser(l.user_id)).source === 'subscription') return res.status(409).json({ error: 'Pro is already active.', code: 'already_subscribed' });
    const provider = getProvider(providerFor(l.currency));
    if (!provider) return res.status(503).json({ error: 'Payments are not available yet.', code: 'payments_not_configured' });
    const { url } = await provider.createCheckout({
      userId: l.user_id, username: l.name, plan: 'pro', interval: l.interval, currency: l.currency, amountMinor: l.amount_minor,
      // The link's token is deliberately NOT passed to the provider: the return pages are generic and the
      // parent reopens their original link (from their chat) to manage the subscription.
      successUrl: `${appUrl()}/pay?done=1`,
      cancelUrl: `${appUrl()}/pay?cancelled=1`,
    });
    res.json({ url });
  } catch (error) {
    if (error instanceof ProviderError) {
      console.error('Pay link provider error:', error.message);
      return res.status(502).json({ error: 'The payment provider could not start checkout. Please try again.', code: 'provider_error' });
    }
    console.error('Pay link checkout error:', error);
    res.status(500).json({ error: 'Failed to start checkout' });
  }
});

// POST /api/pay-links/cancel { token } — the parent stops renewal, from the same link.
router.post('/cancel', async (req: Request, res: Response) => {
  if (hit(`paylink:${req.ip}`, 40, 60 * 60_000)) return res.status(429).json({ error: 'Too many requests' });
  try {
    const l = await findLink(req.body?.token);
    if (!l) return res.status(404).json({ error: 'This link is not valid.' });
    const sub = (await pool.query(
      `SELECT id, provider, provider_subscription_id, cancel_at_period_end FROM subscriptions
       WHERE user_id = $1 AND status IN ('active', 'past_due') ORDER BY updated_at DESC LIMIT 1`, [l.user_id])).rows[0];
    if (!sub) return res.status(404).json({ error: 'There is no active subscription.', code: 'no_subscription' });
    if (!sub.cancel_at_period_end) {
      const provider = getProvider(sub.provider);
      if (!provider) return res.status(503).json({ error: 'Cancellation is temporarily unavailable. Please try again shortly.', code: 'payments_not_configured' });
      await provider.cancelAtPeriodEnd(sub.provider_subscription_id);
      await pool.query('UPDATE subscriptions SET cancel_at_period_end = true, updated_at = NOW() WHERE id = $1', [sub.id]);
    }
    res.json({ cancelled: true });
  } catch (error) {
    if (error instanceof ProviderError) return res.status(502).json({ error: 'The payment provider could not cancel right now. Please try again.', code: 'provider_error' });
    console.error('Pay link cancel error:', error);
    res.status(500).json({ error: 'Failed to cancel' });
  }
});

export default router;
