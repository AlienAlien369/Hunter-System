import { createHmac, timingSafeEqual } from 'crypto';
import type { NormalizedEvent, SubStatus } from '../billing.js';
import type { Interval } from '../pricing.js';
import { ProviderError, WebhookSignatureError, productName, type CheckoutRequest, type FetchLike, type PaymentProvider } from './types.js';
import { brandName } from '../platform.js';

// Stripe over plain HTTPS (no SDK). Checkout Sessions with inline prices, so
// there is nothing to pre-create in the dashboard apart from the webhook.

const API = 'https://api.stripe.com/v1';
const TOLERANCE_SECONDS = 5 * 60;

const form = (obj: Record<string, string>) => new URLSearchParams(obj).toString();
const num = (v: unknown) => (typeof v === 'number' ? v : undefined);
const str = (v: unknown) => (typeof v === 'string' ? v : undefined);

/** Verify `Stripe-Signature: t=…,v1=…` over `${t}.${rawBody}` (HMAC-SHA256, constant-time, 5 min tolerance). */
export function verifyStripeSignature(rawBody: Buffer, header: string | undefined, secret: string, now = new Date()): void {
  if (!header) throw new WebhookSignatureError('missing signature');
  const parts = Object.fromEntries(header.split(',').map(p => { const i = p.indexOf('='); return [p.slice(0, i), p.slice(i + 1)]; }));
  const t = Number(parts.t);
  if (!t || !parts.v1) throw new WebhookSignatureError('malformed signature');
  if (Math.abs(now.getTime() / 1000 - t) > TOLERANCE_SECONDS) throw new WebhookSignatureError('signature timestamp outside tolerance');
  const expected = createHmac('sha256', secret).update(`${t}.`).update(rawBody).digest();
  const given = Buffer.from(parts.v1, 'hex');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw new WebhookSignatureError('bad signature');
}

const STATUS: Record<string, SubStatus | undefined> = {
  active: 'active', trialing: 'active', past_due: 'past_due', unpaid: 'expired', canceled: 'expired', incomplete_expired: 'expired',
};

/** Reduce a verified Stripe event to our shape. Pure; unit-tested with real-shaped payloads. */
export function normalizeStripeEvent(evt: any): NormalizedEvent {
  const base = { provider: 'stripe' as const, eventId: String(evt.id), type: String(evt.type), createdAt: new Date((num(evt.created) ?? 0) * 1000) };
  const obj = evt.data?.object ?? {};

  if (evt.type?.startsWith('customer.subscription.')) {
    const status = STATUS[obj.status as string];
    const item = obj.items?.data?.[0];
    const price = item?.price;
    // Newer API versions moved the period end onto the subscription item.
    const periodEndSec = num(obj.current_period_end) ?? num(item?.current_period_end);
    if (!status || !price) return { ...base, kind: 'ignored' };
    return {
      ...base, kind: 'subscription',
      subscriptionId: str(obj.id), customerId: str(obj.customer),
      userId: Number(obj.metadata?.userId) || undefined,
      plan: obj.metadata?.plan === 'teams' ? 'teams' : 'pro',
      orgId: Number(obj.metadata?.orgId) || undefined,
      seats: Number(obj.metadata?.seats) || undefined,
      interval: (price.recurring?.interval === 'year' ? 'year' : 'month') as Interval,
      status, currency: String(price.currency ?? '').toUpperCase(), amountMinor: num(price.unit_amount) ?? 0,
      periodEnd: periodEndSec ? new Date(periodEndSec * 1000) : null,
      cancelAtPeriodEnd: !!obj.cancel_at_period_end,
    };
  }
  // A fully refunded charge: the money went back, so access ends.
  if (evt.type === 'charge.refunded' && obj.refunded === true) {
    return { ...base, kind: 'refund', customerId: str(obj.customer) };
  }
  return { ...base, kind: 'ignored' };
}

export function createStripeProvider(opts: { secretKey: string; webhookSecret: string; tax?: boolean; fetchImpl?: FetchLike }): PaymentProvider {
  const doFetch: FetchLike = opts.fetchImpl ?? ((url, init) => fetch(url, init));
  const call = async (path: string, body: Record<string, string>) => {
    const res = await doFetch(`${API}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${opts.secretKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form(body),
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await res.json().catch(() => ({}))) as any;
    if (!res.ok) throw new ProviderError(`Stripe ${res.status}: ${json?.error?.message ?? 'request failed'}`);
    return json;
  };
  return {
    name: 'stripe',
    async createCheckout(r: CheckoutRequest) {
      const meta = { userId: String(r.userId), plan: r.plan, interval: r.interval };
      const body: Record<string, string> = {
        mode: 'subscription',
        success_url: r.successUrl,
        cancel_url: r.cancelUrl,
        client_reference_id: String(r.userId),
        'line_items[0][quantity]': '1',
        'line_items[0][price_data][currency]': r.currency.toLowerCase(),
        'line_items[0][price_data][unit_amount]': String(r.amountMinor),
        'line_items[0][price_data][recurring][interval]': r.interval,
        'line_items[0][price_data][product_data][name]': productName(brandName(), r.plan),
        'subscription_data[metadata][userId]': meta.userId,
        'subscription_data[metadata][plan]': meta.plan,
        'metadata[userId]': meta.userId,
        ...(r.orgId ? { 'subscription_data[metadata][orgId]': String(r.orgId), 'subscription_data[metadata][seats]': String(r.seats ?? 0) } : {}),
        allow_promotion_codes: 'false',
      };
      if (opts.tax) { body['automatic_tax[enabled]'] = 'true'; body.billing_address_collection = 'required'; }
      const session = await call('/checkout/sessions', body);
      if (typeof session.url !== 'string') throw new ProviderError('Stripe returned no checkout URL');
      return { url: session.url };
    },
    async cancelAtPeriodEnd(id: string) {
      await call(`/subscriptions/${encodeURIComponent(id)}`, { cancel_at_period_end: 'true' });
    },
    parseWebhook(rawBody, headers, now = new Date()) {
      const sig = headers['stripe-signature'];
      verifyStripeSignature(rawBody, Array.isArray(sig) ? sig[0] : sig, opts.webhookSecret, now);
      const payload = JSON.parse(rawBody.toString('utf8'));
      return { event: normalizeStripeEvent(payload), payload };
    },
  };
}
