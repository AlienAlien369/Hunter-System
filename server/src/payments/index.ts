import { createRazorpayProvider } from './razorpay.js';
import { createStripeProvider } from './stripe.js';
import type { PaymentProvider } from './types.js';
import type { Provider } from '../pricing.js';

// Which providers are configured, and the guard that keeps this deployment in
// TEST mode until the owner has confirmed the accounts and KYC exist.
//
// Environment (backend):
//   Stripe:   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_TAX=true (optional)
//   Razorpay: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET
//   PAYMENTS_LIVE=true  — required before any live key (sk_live_ / rzp_live_) is accepted.

export type KeyCheck = { ok: true; mode: 'test' | 'live' } | { ok: false; reason: string };

/** Refuse live keys unless PAYMENTS_LIVE=true. Pure; unit-tested. */
export function checkKey(provider: Provider, key: string | undefined, env: Record<string, string | undefined> = process.env): KeyCheck {
  if (!key) return { ok: false, reason: 'not configured' };
  const live = provider === 'stripe' ? /^(sk|rk)_live_/.test(key) : key.startsWith('rzp_live_');
  const test = provider === 'stripe' ? /^(sk|rk)_test_/.test(key) : key.startsWith('rzp_test_');
  if (!live && !test) return { ok: false, reason: 'unrecognised key format' };
  if (live && env.PAYMENTS_LIVE !== 'true') return { ok: false, reason: 'live key refused: set PAYMENTS_LIVE=true only after the accounts and KYC are confirmed' };
  return { ok: true, mode: live ? 'live' : 'test' };
}

let override: Partial<Record<Provider, PaymentProvider | null>> = {};
/** Test hook: inject a provider (or null to disable one). */
export function __setProvider(name: Provider, p: PaymentProvider | null) { override = { ...override, [name]: p }; }
export function __resetProviders() { override = {}; }

export function getProvider(name: Provider): PaymentProvider | null {
  if (name in override) return override[name] ?? null;
  const e = process.env;
  if (name === 'stripe') {
    if (!checkKey('stripe', e.STRIPE_SECRET_KEY).ok || !e.STRIPE_WEBHOOK_SECRET) return null;
    return createStripeProvider({ secretKey: e.STRIPE_SECRET_KEY!, webhookSecret: e.STRIPE_WEBHOOK_SECRET, tax: e.STRIPE_TAX === 'true' });
  }
  if (!checkKey('razorpay', e.RAZORPAY_KEY_ID).ok || !e.RAZORPAY_KEY_SECRET || !e.RAZORPAY_WEBHOOK_SECRET) return null;
  return createRazorpayProvider({ keyId: e.RAZORPAY_KEY_ID!, keySecret: e.RAZORPAY_KEY_SECRET, webhookSecret: e.RAZORPAY_WEBHOOK_SECRET });
}

export const paymentsMode = (): 'test' | 'live' | 'off' => {
  const s = checkKey('stripe', process.env.STRIPE_SECRET_KEY);
  const r = checkKey('razorpay', process.env.RAZORPAY_KEY_ID);
  const modes = [s, r].filter((c): c is Extract<KeyCheck, { ok: true }> => c.ok).map(c => c.mode);
  return modes.includes('live') ? 'live' : modes.length ? 'test' : 'off';
};
