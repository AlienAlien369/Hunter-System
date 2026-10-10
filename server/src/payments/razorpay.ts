import { createHmac, timingSafeEqual } from 'crypto';
import { pool } from '../db.js';
import type { NormalizedEvent, SubStatus } from '../billing.js';
import type { Interval } from '../pricing.js';
import { ProviderError, WebhookSignatureError, type CheckoutRequest, type FetchLike, type PaymentProvider } from './types.js';

// Razorpay over plain HTTPS (no SDK): UPI, UPI AutoPay, cards and netbanking
// through its hosted subscription page. Plans are created on demand (one per
// price) and cached in app_settings, so nothing needs pre-creating.

const API = 'https://api.razorpay.com/v1';

/** `X-Razorpay-Signature` is the hex HMAC-SHA256 of the raw body with the webhook secret. */
export function verifyRazorpaySignature(rawBody: Buffer, header: string | undefined, secret: string): void {
  if (!header) throw new WebhookSignatureError('missing signature');
  const expected = createHmac('sha256', secret).update(rawBody).digest();
  const given = Buffer.from(header, 'hex');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw new WebhookSignatureError('bad signature');
}

const STATUS: Record<string, SubStatus | undefined> = {
  active: 'active', pending: 'past_due', halted: 'expired', cancelled: 'canceled', completed: 'expired', expired: 'expired',
};

/** Reduce a verified Razorpay event to our shape. Pure; unit-tested. */
export function normalizeRazorpayEvent(evt: any, eventId: string): NormalizedEvent {
  const type = String(evt.event);
  const base = { provider: 'razorpay' as const, eventId, type, createdAt: new Date((typeof evt.created_at === 'number' ? evt.created_at : 0) * 1000) };
  const sub = evt.payload?.subscription?.entity;
  const payment = evt.payload?.payment?.entity;

  if (type === 'refund.processed' || type === 'payment.refunded') {
    const p = payment ?? {};
    // Only a full refund revokes access.
    if (p.refund_status === 'full' || (p.amount_refunded && p.amount_refunded >= p.amount)) return { ...base, kind: 'refund', paymentId: typeof p.id === 'string' ? p.id : undefined };
    return { ...base, kind: 'ignored' };
  }
  if (type.startsWith('subscription.') && sub) {
    const status = STATUS[sub.status as string];
    const notes = sub.notes ?? {};
    if (!status) return { ...base, kind: 'ignored' }; // authenticated, created, paused…
    const interval: Interval = notes.interval === 'year' ? 'year' : 'month';
    const endSec = typeof sub.current_end === 'number' ? sub.current_end : undefined;
    return {
      ...base, kind: 'subscription',
      subscriptionId: String(sub.id),
      customerId: typeof sub.customer_id === 'string' ? sub.customer_id : undefined,
      paymentId: typeof payment?.id === 'string' ? payment.id : undefined,
      userId: Number(notes.userId) || undefined,
      plan: notes.plan === 'teams' ? 'teams' : 'pro',
      interval, status,
      currency: String(notes.currency ?? 'INR').toUpperCase(),
      amountMinor: Number(notes.amountMinor) || 0,
      periodEnd: endSec ? new Date(endSec * 1000) : null,
      cancelAtPeriodEnd: !!sub.has_scheduled_changes || type === 'subscription.cancelled',
    };
  }
  return { ...base, kind: 'ignored' };
}

export function createRazorpayProvider(opts: { keyId: string; keySecret: string; webhookSecret: string; fetchImpl?: FetchLike }): PaymentProvider {
  const doFetch: FetchLike = opts.fetchImpl ?? ((url, init) => fetch(url, init));
  const auth = `Basic ${Buffer.from(`${opts.keyId}:${opts.keySecret}`).toString('base64')}`;
  const call = async (path: string, body: unknown) => {
    const res = await doFetch(`${API}${path}`, { method: 'POST', headers: { Authorization: auth, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15_000) });
    const json = (await res.json().catch(() => ({}))) as any;
    if (!res.ok) throw new ProviderError(`Razorpay ${res.status}: ${json?.error?.description ?? 'request failed'}`);
    return json;
  };
  async function ensurePlan(plan: string, interval: Interval, currency: string, amountMinor: number): Promise<string> {
    const key = `razorpay_plan:${plan}:${interval}:${currency}:${amountMinor}`;
    const cached = await pool.query('SELECT value FROM app_settings WHERE key = $1', [key]);
    if (cached.rows[0]) return cached.rows[0].value;
    const created = await call('/plans', {
      period: interval === 'year' ? 'yearly' : 'monthly', interval: 1,
      item: { name: plan === 'teams' ? 'Hunter System Teams' : 'Hunter System Pro', amount: amountMinor, currency },
    });
    await pool.query('INSERT INTO app_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING', [key, String(created.id)]);
    return String(created.id);
  }
  return {
    name: 'razorpay',
    async createCheckout(r: CheckoutRequest) {
      const planId = await ensurePlan(r.plan, r.interval, r.currency, r.amountMinor);
      const sub = await call('/subscriptions', {
        plan_id: planId,
        // Razorpay needs a bounded count; this is 10 years, after which the customer simply renews.
        total_count: r.interval === 'year' ? 10 : 120,
        customer_notify: 1,
        notes: { userId: String(r.userId), plan: r.plan, interval: r.interval, currency: r.currency, amountMinor: String(r.amountMinor) },
      });
      if (typeof sub.short_url !== 'string') throw new ProviderError('Razorpay returned no checkout URL');
      return { url: sub.short_url };
    },
    async cancelAtPeriodEnd(id: string) {
      await call(`/subscriptions/${encodeURIComponent(id)}/cancel`, { cancel_at_cycle_end: 1 });
    },
    parseWebhook(rawBody, headers) {
      const sig = headers['x-razorpay-signature'];
      verifyRazorpaySignature(rawBody, Array.isArray(sig) ? sig[0] : sig, opts.webhookSecret);
      const payload = JSON.parse(rawBody.toString('utf8'));
      const idHeader = headers['x-razorpay-event-id'];
      const eventId = (Array.isArray(idHeader) ? idHeader[0] : idHeader) || `${payload.event}:${payload.payload?.subscription?.entity?.id ?? payload.payload?.payment?.entity?.id}:${payload.created_at}`;
      return { event: normalizeRazorpayEvent(payload, eventId), payload };
    },
  };
}
