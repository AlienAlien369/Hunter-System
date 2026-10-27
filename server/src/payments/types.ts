import type { Interval, Provider } from '../pricing.js';
import type { NormalizedEvent } from '../billing.js';

export interface CheckoutRequest {
  userId: number;
  username: string;
  plan: 'pro' | 'teams';
  interval: Interval;
  currency: string;
  amountMinor: number;
  successUrl: string;
  cancelUrl: string;
  /** Institution seat purchases (plan 'teams'): which institution, how many seats. */
  orgId?: number;
  seats?: number;
}

/** The product name on the provider's checkout page and receipts. */
export const productName = (brand: string, plan: 'pro' | 'teams') => `${brand} ${plan === 'teams' ? 'Institution seats' : 'Pro'}`;

export interface PaymentProvider {
  name: Provider;
  /** Hosted checkout page the browser is sent to. Granting access is the webhook's job, never the redirect's. */
  createCheckout(req: CheckoutRequest): Promise<{ url: string }>;
  /** Ask the provider to stop renewing at the end of the paid period. */
  cancelAtPeriodEnd(providerSubscriptionId: string): Promise<void>;
  /** Verify the signature on a raw webhook body and reduce it to our event shape. Throws on a bad signature. */
  parseWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>, now?: Date): { event: NormalizedEvent; payload: unknown };
}

export class WebhookSignatureError extends Error {}
export class ProviderError extends Error {}

export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown>; text(): Promise<string> }>;
