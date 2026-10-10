// Plans, regional prices and what each plan unlocks. One catalogue, priced by
// the visitor's market (purchasing-power adjusted), shown and charged in the
// same currency. Nothing here ever sells XP, rank or leaderboard position:
// paid plans buy convenience, AI headroom and cosmetics only.

export type PlanId = 'free' | 'pro' | 'teams';
export type Interval = 'month' | 'year';
export type PriceGroup = 'IN' | 'US' | 'EU' | 'GB' | 'AE' | 'LOW';
export type Provider = 'razorpay' | 'stripe';

export const PRICE_GROUP_CURRENCY: Record<PriceGroup, string> = { IN: 'INR', US: 'USD', EU: 'EUR', GB: 'GBP', AE: 'AED', LOW: 'USD' };

// Amounts are in minor units (paise / cents). Annual is ~2.5 months free.
const PRICES: Record<'pro' | 'teams', Record<PriceGroup, Record<Interval, number>>> = {
  pro: {
    IN: { month: 7900, year: 59900 },
    US: { month: 399, year: 3499 },
    EU: { month: 399, year: 3499 },
    GB: { month: 349, year: 2999 },
    AE: { month: 1499, year: 12900 },
    LOW: { month: 199, year: 1799 },
  },
  // Per class / institute. Not purchasable until the Teams dashboard ships.
  teams: {
    IN: { month: 49900, year: 499900 },
    US: { month: 799, year: 6900 },
    EU: { month: 799, year: 6900 },
    GB: { month: 699, year: 5900 },
    AE: { month: 2999, year: 25900 },
    LOW: { month: 399, year: 3499 },
  },
};

const EU = new Set('AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE IS LI NO CH'.split(' '));
const GULF = new Set('AE SA QA KW BH OM'.split(' '));
// Markets where $3.99 is out of reach for students; the same product at a fair local price.
const LOW = new Set('BR ID PH VN NG EG PK BD LK NP TR MX CO AR PE ZA KE GH MA TN UA'.split(' '));

export function priceGroupFor(region: string | null | undefined): PriceGroup {
  const r = (region ?? '').toUpperCase();
  if (r === 'IN') return 'IN';
  if (r === 'GB') return 'GB';
  if (EU.has(r)) return 'EU';
  if (GULF.has(r)) return 'AE';
  if (LOW.has(r)) return 'LOW';
  return 'US';
}

export interface Price {
  currency: string;
  amountMinor: number;
}

export function priceFor(plan: 'pro' | 'teams', interval: Interval, group: PriceGroup): Price {
  return { currency: PRICE_GROUP_CURRENCY[group], amountMinor: PRICES[plan][group][interval] };
}

/** Rupees go through Razorpay (UPI, UPI AutoPay, cards); everything else through Stripe. */
export function providerFor(currency: string): Provider {
  return currency === 'INR' ? 'razorpay' : 'stripe';
}

/** Whole-number percentage the yearly price saves versus twelve monthly payments. */
export function yearlySavingsPct(plan: 'pro' | 'teams', group: PriceGroup): number {
  const p = PRICES[plan][group];
  return Math.round((1 - p.year / (p.month * 12)) * 100);
}

export interface PlanLimits {
  /** AI actions per day (unplanned analysis, module builder, timetable suggestions, coach). The XP rules never depend on this. */
  aiPerDay: number;
  /** Premium cosmetic themes and sound packs. */
  premiumCosmetics: boolean;
}

// Free keeps everything it has today; the AI cap exists because AI costs real money.
export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: { aiPerDay: 10, premiumCosmetics: false },
  pro: { aiPerDay: 150, premiumCosmetics: true },
  teams: { aiPerDay: 150, premiumCosmetics: true },
};

/** The free tier is real and stays free. */
export const PLAN_FEATURES: Record<'free' | 'pro', string[]> = {
  free: ['Unlimited quests, XP, ranks and streaks', 'Timetable, modules and the weekly report', 'Leaderboard, friends and shareable cards', '10 AI suggestions per day'],
  pro: ['Everything in Free', '150 AI suggestions per day', 'Premium themes', 'Helps keep Hunter free and ad-free for everyone'],
};
