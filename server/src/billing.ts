import { pool } from './db.js';
import { track } from './analytics.js';
import { PLAN_LIMITS, type Interval, type PlanId, type Provider } from './pricing.js';

// Entitlements and the effect of payment-provider events. This is the ONLY
// code that changes a subscription, and it is reached only from verified
// webhooks (routes/webhooks.ts) or the cancel endpoint after the provider
// itself confirmed the cancellation.

/** After a failed renewal the provider retries for a few days; Pro stays on meanwhile. */
export const PAST_DUE_GRACE_DAYS = 3;
const DAY_MS = 86_400_000;
const PAST_DUE_GRACE_MS = PAST_DUE_GRACE_DAYS * DAY_MS;

export type SubStatus = 'active' | 'past_due' | 'canceled' | 'expired' | 'refunded';

export interface SubscriptionRow {
  status: SubStatus;
  current_period_end: Date | string | null;
  cancel_at_period_end?: boolean;
}

/** Does this subscription currently entitle its owner to the paid plan? Pure; unit-tested. */
export function subscriptionEntitles(sub: SubscriptionRow, now = new Date()): boolean {
  const end = sub.current_period_end ? new Date(sub.current_period_end).getTime() : 0;
  switch (sub.status) {
    case 'active': return end > now.getTime();
    // Cancelled subscriptions keep what was paid for until the period ends.
    case 'canceled': return end > now.getTime();
    case 'past_due': return end + PAST_DUE_GRACE_MS > now.getTime();
    default: return false; // expired, refunded
  }
}

export interface EntitlementInput {
  subscriptions: SubscriptionRow[];
  proUntil?: Date | string | null;
}

export interface Entitlement {
  plan: PlanId;
  source: 'subscription' | 'grant' | null;
  /** When paid access ends (or renews), if known. */
  until: Date | null;
}

/** The plan a hunter is on right now: a valid subscription, or an unexpired grant (referral, class pilot), else free. */
export function entitlementOf(input: EntitlementInput, now = new Date()): Entitlement {
  const live = input.subscriptions.filter(s => subscriptionEntitles(s, now));
  const subEnd = live.reduce<Date | null>((best, s) => {
    const e = s.current_period_end ? new Date(s.current_period_end) : null;
    return e && (!best || e > best) ? e : best;
  }, null);
  const grant = input.proUntil ? new Date(input.proUntil) : null;
  const grantLive = !!grant && grant > now;
  if (live.length && (!grantLive || (subEnd && subEnd >= grant!))) return { plan: 'pro', source: 'subscription', until: subEnd };
  if (grantLive) return { plan: 'pro', source: 'grant', until: grant };
  return { plan: 'free', source: null, until: null };
}

export async function entitlementForUser(userId: number, now = new Date()): Promise<Entitlement> {
  const [subs, u] = await Promise.all([
    pool.query('SELECT status, current_period_end, cancel_at_period_end FROM subscriptions WHERE user_id = $1', [userId]),
    pool.query('SELECT pro_until FROM users WHERE id = $1', [userId]),
  ]);
  return entitlementOf({ subscriptions: subs.rows, proUntil: u.rows[0]?.pro_until }, now);
}

export const limitsFor = (plan: PlanId) => PLAN_LIMITS[plan];

/** Extend a hunter's Pro grant (never shortens one). Used by referral rewards and class pilots. */
export async function grantPro(userId: number, days: number, now = new Date()): Promise<Date> {
  const r = await pool.query(
    `UPDATE users SET pro_until = GREATEST(COALESCE(pro_until, $2::timestamptz), $2::timestamptz) + make_interval(days => $3) WHERE id = $1 RETURNING pro_until`,
    [userId, now, days],
  );
  return r.rows[0].pro_until;
}

// ── Provider events, normalized ─────────────────────────────────────────────

/** What every provider adapter reduces a webhook to. */
export interface NormalizedEvent {
  provider: Provider;
  eventId: string;
  type: string;
  /** Provider-side time of the event, to ignore stale deliveries. */
  createdAt: Date;
  kind: 'subscription' | 'refund' | 'ignored';
  subscriptionId?: string;
  customerId?: string;
  /** Latest successful payment (lets a later refund find its subscription). */
  paymentId?: string;
  userId?: number;
  plan?: 'pro' | 'teams';
  interval?: Interval;
  status?: SubStatus;
  currency?: string;
  amountMinor?: number;
  periodEnd?: Date | null;
  cancelAtPeriodEnd?: boolean;
}

export type ApplyResult = 'applied' | 'duplicate' | 'stale' | 'unknown_user' | 'ignored';

/**
 * Apply one verified, normalized event. Idempotent (providers retry) and
 * order-safe (an older event never overwrites newer state).
 */
export async function applyProviderEvent(ev: NormalizedEvent, rawPayload: unknown): Promise<ApplyResult> {
  const stored = await pool.query(
    'INSERT INTO payment_events (provider, event_id, type, payload) VALUES ($1, $2, $3, $4) ON CONFLICT (provider, event_id) DO NOTHING RETURNING id',
    [ev.provider, ev.eventId, ev.type, JSON.stringify(rawPayload)],
  );
  if (!stored.rowCount) return 'duplicate';
  if (ev.kind === 'ignored') return 'ignored';

  if (ev.kind === 'refund') {
    // Refunds name a payment or customer, not a subscription.
    const target = (await pool.query(
      `SELECT id FROM subscriptions
       WHERE ($1::text IS NOT NULL AND provider = $4 AND provider_subscription_id = $1)
          OR ($2::text IS NOT NULL AND provider = $4 AND last_payment_id = $2)
          OR ($3::text IS NOT NULL AND provider = $4 AND provider_customer_id = $3)
       ORDER BY updated_at DESC LIMIT 1`,
      [ev.subscriptionId ?? null, ev.paymentId ?? null, ev.customerId ?? null, ev.provider],
    )).rows[0];
    if (!target) return 'unknown_user';
    await pool.query(`UPDATE subscriptions SET status = 'refunded', current_period_end = NOW(), cancel_at_period_end = false, updated_at = NOW() WHERE id = $1`, [target.id]);
    return 'applied';
  }

  if (!ev.subscriptionId) return 'ignored';
  const existing = (await pool.query(
    'SELECT id, user_id, status, last_event_at FROM subscriptions WHERE provider = $1 AND provider_subscription_id = $2',
    [ev.provider, ev.subscriptionId],
  )).rows[0];

  if (existing?.last_event_at && ev.createdAt < new Date(existing.last_event_at)) return 'stale';
  const userId = ev.userId ?? existing?.user_id;
  if (!userId) return 'unknown_user';
  if (!ev.status || !ev.interval || !ev.currency || ev.amountMinor === undefined) return 'ignored';

  const became = await pool.query(
    `INSERT INTO subscriptions (user_id, provider, provider_subscription_id, provider_customer_id, plan, interval, status, currency, amount_minor, current_period_end, cancel_at_period_end, last_event_at, last_payment_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     ON CONFLICT (provider, provider_subscription_id) DO UPDATE SET
       provider_customer_id = COALESCE(EXCLUDED.provider_customer_id, subscriptions.provider_customer_id),
       status = EXCLUDED.status,
       current_period_end = COALESCE(EXCLUDED.current_period_end, subscriptions.current_period_end),
       cancel_at_period_end = EXCLUDED.cancel_at_period_end,
       amount_minor = EXCLUDED.amount_minor,
       currency = EXCLUDED.currency,
       interval = EXCLUDED.interval,
       last_event_at = EXCLUDED.last_event_at,
       last_payment_id = COALESCE(EXCLUDED.last_payment_id, subscriptions.last_payment_id),
       updated_at = NOW()
     WHERE subscriptions.status <> 'refunded' -- a refund is final: later provider events must not revive it
     RETURNING (xmax = 0) AS inserted`,
    [userId, ev.provider, ev.subscriptionId, ev.customerId ?? null, ev.plan ?? 'pro', ev.interval, ev.status, ev.currency, ev.amountMinor, ev.periodEnd ?? null, ev.cancelAtPeriodEnd ?? false, ev.createdAt, ev.paymentId ?? null],
  );
  // First time this hunter pays: the funnel's "upgrade" step. Only a verified payment gets here.
  if (became.rows[0]?.inserted && ev.status === 'active') await track(userId, 'upgrade_completed', null, { plan: ev.plan ?? 'pro' });
  return 'applied';
}
