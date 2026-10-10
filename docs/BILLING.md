# Billing: how it works and how to switch it on

Plans: **Free** (everything that exists today stays free) and **Pro** (more AI
suggestions per day, premium cosmetics). Paid plans never sell XP, rank or
leaderboard position. **Teams** is priced in the catalogue but not purchasable
until the class dashboard ships.

## Design rules

- **Webhooks are the only way to a paid plan.** Checkout only sends the browser
  to the provider's hosted page; the success redirect grants nothing. Access
  appears when a *signature-verified* webhook is processed.
- **Entitlements live on the server** (`server/src/billing.ts`): a valid
  subscription, or an unexpired grant (`users.pro_until`, used by referral
  rewards and class pilots). A failed renewal keeps Pro for 3 days; a cancelled
  subscription keeps Pro until the paid period ends; a full refund ends it at
  once and cannot be revived by a later event.
- **Idempotent and ordered:** every delivery is stored once
  (`payment_events`), re-deliveries are no-ops, older events never overwrite
  newer state.
- **Under-18s cannot buy.** A parent or guardian subscribes. A hunter under 18
  (with parental consent on file) can generate a **pay link** from the Pricing
  page and share it (WhatsApp button included). The parent opens `/pay#token=…`
  with no account, sees the exact price and who it is for, confirms they are the
  parent or guardian, and is sent to the provider's hosted checkout. The
  subscription is tied to the child's account; access still arrives only through
  the verified webhook. The parent can cancel from the same link. The link
  lives 7 days for checkout, only a hash of its token is stored, the token sits
  in the URL fragment (never in server logs) and is never given to the provider.
- **Test mode is the default.** A live key (`sk_live_`, `rzp_live_`) is refused
  unless `PAYMENTS_LIVE=true` is also set. Do not set it until your accounts and
  KYC are confirmed.
- **Prices:** `server/src/pricing.ts`. India is rupees via Razorpay (UPI, UPI
  AutoPay, cards); everywhere else is Stripe. Regions: India, US, UK, EU, UAE &
  Gulf, and a lower-price group for markets where $3.99 is out of reach.

## Switch on test mode

Backend (Render) environment variables:

| Variable | Value |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_…` from Stripe (Developers → API keys) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` of the webhook endpoint below |
| `STRIPE_TAX` | `true` to let Stripe Tax calculate VAT/GST (optional, needs Stripe Tax set up) |
| `RAZORPAY_KEY_ID` | `rzp_test_…` |
| `RAZORPAY_KEY_SECRET` | the matching secret |
| `RAZORPAY_WEBHOOK_SECRET` | the secret you choose for the Razorpay webhook |
| `APP_URL` | `https://hunters-system.vercel.app` (checkout return links) |

Webhook endpoints to register:

- Stripe → `https://<backend>/api/webhooks/stripe`, events:
  `customer.subscription.created`, `customer.subscription.updated`,
  `customer.subscription.deleted`, `charge.refunded`.
- Razorpay → `https://<backend>/api/webhooks/razorpay`, events:
  `subscription.activated`, `subscription.charged`, `subscription.pending`,
  `subscription.halted`, `subscription.cancelled`, `subscription.completed`,
  `refund.processed`.

Until a provider is configured, `/pricing` shows "Payments are coming soon" and
checkout answers 503; nothing is charged.

## Before going live (owner checklist)

1. Stripe account and Razorpay account activated, KYC complete, bank account
   connected. Razorpay Subscriptions enabled on the account.
2. Decide the tax model. **Stripe is not a merchant of record**: you would be
   responsible for VAT/OSS in the EU/UK, GST in India, and US sales tax. For
   selling globally without registering for each, a merchant of record (Paddle
   or Lemon Squeezy) is usually simpler; it can be added as a third adapter
   behind `PaymentProvider` (`server/src/payments/types.ts`) without touching
   the rest. See `docs/LEGAL_REVIEW.md`.
3. Operator details filled in on the legal pages; Refund policy reviewed.
4. Run a full test purchase, a failed renewal, a cancellation and a refund in
   test mode and watch `payment_events`.
5. Only then set live keys **and** `PAYMENTS_LIVE=true`.

## Refunds

Refund in the provider's dashboard. A full refund fires the refund webhook and
Pro ends immediately. Also cancel the subscription in the dashboard so it does
not renew again (Stripe does not cancel automatically on refund).
