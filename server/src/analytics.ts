import { pool } from './db.js';
import { PLAN_LIMITS } from './pricing.js';

// Privacy-friendly measurement.
//  - No third parties, no cookies, no device or browser ids, no IP or
//    user-agent stored.
//  - The funnel is *derived from data the product already keeps* (users,
//    routines, quest_completions): accurate, backfilled, and nothing extra is
//    tracked about any individual to compute it.
//  - The events table only holds what cannot be derived (page views, paywall
//    views, upgrades). Anonymous events carry no identifier at all; signed-in
//    events carry user_id and are deleted with the account (ON DELETE CASCADE).
//  - Do Not Track / Global Privacy Control suppress client events entirely.

/** Events the browser may report. `upgrade_completed` is deliberately absent: only the payment webhook may emit it. */
export const CLIENT_EVENTS = [
  'landing_view', 'cta_click', 'login_view', 'profile_view', 'pricing_view', 'upgrade_click', 'share_click', 'invite_click',
] as const;
export type ClientEvent = (typeof CLIENT_EVENTS)[number];

export const EVENT_RETENTION_MONTHS = 13;

export function isClientEvent(name: unknown): name is ClientEvent {
  return typeof name === 'string' && (CLIENT_EVENTS as readonly string[]).includes(name);
}

/** Keep only small, boring props; anything else is dropped. */
export function sanitizeProps(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== 'object') return out;
  const { page, ref, lang } = raw as Record<string, unknown>;
  if (typeof page === 'string' && /^\/[\w\-./]{0,59}$/.test(page)) out.page = page;
  if (typeof ref === 'string' && /^[\w-]{1,30}$/.test(ref)) out.ref = ref;
  if (lang === 'en' || lang === 'hi' || lang === 'hi-Latn') out.lang = lang; // the page language, never free text
  return out;
}

/** Record an event. Never throws: measurement must not break a request. */
export async function track(userId: number | null, name: string, region: string | null, props: Record<string, unknown> = {}): Promise<void> {
  try {
    await pool.query('INSERT INTO events (user_id, name, region, props) VALUES ($1, $2, $3, $4)', [userId, name, region, JSON.stringify(props)]);
  } catch (error) {
    console.error('Failed to track event:', error);
  }
}

export async function purgeOldEvents(): Promise<void> {
  await pool.query(`DELETE FROM events WHERE created_at < NOW() - make_interval(months => $1)`, [EVENT_RETENTION_MONTHS]);
}

export interface FunnelRow {
  region: string;
  signups: number;
  timetable: number;
  firstQuest: number;
  d7Eligible: number;
  d7Returned: number;
  upgraded: number;
}

export interface FunnelReport {
  days: number;
  region: string | null;
  totals: FunnelRow;
  byRegion: FunnelRow[];
  visits: { landing: number; login: number; pricing: number; upgradeClicks: number };
  /** The same visit counts split by page language (events carry an allowlisted `lang`). */
  visitsByLang: { lang: string; landing: number; login: number; pricing: number; upgradeClicks: number }[];
}

const EMPTY: FunnelRow = { region: 'ALL', signups: 0, timetable: 0, firstQuest: 0, d7Eligible: 0, d7Returned: 0, upgraded: 0 };

/**
 * Funnel for the cohort that signed up in the last `days` days:
 *   signup → timetable built → first quest done → day-7 return → upgrade.
 * "Day-7 return" = completed a quest on or after the 7th day after signup,
 * counted only among hunters who signed up at least 7 days ago (`d7Eligible`),
 * so young cohorts do not drag the rate down. Dates are UTC; this is a funnel,
 * not a ledger, so a few hours of timezone fuzz is acceptable.
 * Aggregates only — the admin view never lists individual hunters.
 */
export async function computeFunnel(days: number, region: string | null): Promise<FunnelReport> {
  const rows = (await pool.query(
    `SELECT COALESCE(u.region, '??') AS region,
            COUNT(*)::int AS signups,
            COUNT(*) FILTER (WHERE r.confirmed_at IS NOT NULL)::int AS timetable,
            COUNT(*) FILTER (WHERE fq.user_id IS NOT NULL)::int AS first_quest,
            COUNT(*) FILTER (WHERE u.created_at <= NOW() - INTERVAL '7 days')::int AS d7_eligible,
            COUNT(*) FILTER (WHERE u.created_at <= NOW() - INTERVAL '7 days' AND d7.user_id IS NOT NULL)::int AS d7_returned,
            COUNT(*) FILTER (WHERE up.user_id IS NOT NULL)::int AS upgraded
     FROM users u
     LEFT JOIN routines r ON r.user_id = u.id
     LEFT JOIN LATERAL (SELECT qc.user_id FROM quest_completions qc WHERE qc.user_id = u.id LIMIT 1) fq ON true
     LEFT JOIN LATERAL (
       SELECT qc.user_id FROM quest_completions qc
       WHERE qc.user_id = u.id AND qc.completion_date >= (u.created_at AT TIME ZONE 'UTC')::date + 7 LIMIT 1
     ) d7 ON true
     LEFT JOIN LATERAL (SELECT e.user_id FROM events e WHERE e.user_id = u.id AND e.name = 'upgrade_completed' LIMIT 1) up ON true
     WHERE u.created_at >= NOW() - make_interval(days => $1)
       AND ($2::text IS NULL OR COALESCE(u.region, '??') = $2)
     GROUP BY 1 ORDER BY signups DESC`,
    [days, region],
  )).rows;

  const byRegion: FunnelRow[] = rows.map((x: any) => ({
    region: x.region, signups: x.signups, timetable: x.timetable, firstQuest: x.first_quest,
    d7Eligible: x.d7_eligible, d7Returned: x.d7_returned, upgraded: x.upgraded,
  }));
  const totals = byRegion.reduce((t, r) => ({
    region: 'ALL', signups: t.signups + r.signups, timetable: t.timetable + r.timetable, firstQuest: t.firstQuest + r.firstQuest,
    d7Eligible: t.d7Eligible + r.d7Eligible, d7Returned: t.d7Returned + r.d7Returned, upgraded: t.upgraded + r.upgraded,
  }), EMPTY);

  const v = (await pool.query(
    `SELECT name, COUNT(*)::int AS n FROM events
     WHERE name IN ('landing_view', 'login_view', 'pricing_view', 'upgrade_click')
       AND created_at >= NOW() - make_interval(days => $1)
       AND ($2::text IS NULL OR COALESCE(region, '??') = $2)
     GROUP BY name`,
    [days, region],
  )).rows;
  const n = (name: string) => v.find((x: any) => x.name === name)?.n ?? 0;
  const l = (await pool.query(
    `SELECT COALESCE(props->>'lang', 'unknown') AS lang, name, COUNT(*)::int AS n FROM events
     WHERE name IN ('landing_view', 'login_view', 'pricing_view', 'upgrade_click')
       AND created_at >= NOW() - make_interval(days => $1)
       AND ($2::text IS NULL OR COALESCE(region, '??') = $2)
     GROUP BY 1, 2`,
    [days, region],
  )).rows;
  const byLang = new Map<string, { lang: string; landing: number; login: number; pricing: number; upgradeClicks: number }>();
  for (const x of l as { lang: string; name: string; n: number }[]) {
    const row = byLang.get(x.lang) ?? { lang: x.lang, landing: 0, login: 0, pricing: 0, upgradeClicks: 0 };
    if (x.name === 'landing_view') row.landing = x.n;
    else if (x.name === 'login_view') row.login = x.n;
    else if (x.name === 'pricing_view') row.pricing = x.n;
    else if (x.name === 'upgrade_click') row.upgradeClicks = x.n;
    byLang.set(x.lang, row);
  }
  const visitsByLang = [...byLang.values()].sort((a, b) => b.landing + b.login - (a.landing + a.login));
  return { days, region, totals, byRegion, visits: { landing: n('landing_view'), login: n('login_view'), pricing: n('pricing_view'), upgradeClicks: n('upgrade_click') }, visitsByLang };
}

export interface BusinessReport {
  days: number;
  subscriptions: {
    active: number;
    pastDue: number;
    cancelling: number;
    refundedOrEnded: number;
    /** Monthly recurring revenue per currency in minor units (yearly plans spread over 12 months). Not converted between currencies. */
    mrrMinorByCurrency: Record<string, number>;
    activeByRegion: { region: string; count: number }[];
  };
  referrals: { invites: number; qualified: number; rewardMonthsGranted: number; hunterOnReferralPro: number };
  classes: { active: number; students: number; avgSize: number };
  /** Free hunters who used their whole daily AI allowance on at least one day in the last 7: a signal of upgrade interest. */
  aiLimitHitters7d: number;
}

/** Aggregate business numbers for the admin view. No individual hunters, ever. */
export async function computeBusiness(days: number): Promise<BusinessReport> {
  const subs = (await pool.query(
    `SELECT s.status, s.interval, s.currency, s.cancel_at_period_end AS cancelling, s.amount_minor, COALESCE(u.region, '??') AS region
     FROM subscriptions s JOIN users u ON u.id = s.user_id`,
  )).rows;
  const active = subs.filter((r: any) => r.status === 'active');
  const mrr: Record<string, number> = {};
  for (const r of active) mrr[r.currency] = (mrr[r.currency] ?? 0) + Math.round(r.interval === 'year' ? r.amount_minor / 12 : r.amount_minor);
  const byRegion = new Map<string, number>();
  for (const r of active) byRegion.set(r.region, (byRegion.get(r.region) ?? 0) + 1);

  const ref = (await pool.query(
    `SELECT (SELECT COUNT(*)::int FROM referrals WHERE created_at >= NOW() - make_interval(days => $1)) AS invites,
            (SELECT COUNT(*)::int FROM referrals WHERE qualified_at >= NOW() - make_interval(days => $1)) AS qualified,
            (SELECT COUNT(*)::int FROM referral_grants WHERE granted_at >= NOW() - make_interval(days => $1)) AS months,
            (SELECT COUNT(*)::int FROM users WHERE pro_until > NOW()) AS on_pro`, [days])).rows[0];
  const cls = (await pool.query(
    `SELECT (SELECT COUNT(*)::int FROM classes WHERE NOT archived) AS active,
            (SELECT COUNT(*)::int FROM class_members m JOIN classes c ON c.id = m.class_id WHERE NOT c.archived) AS students`)).rows[0];
  const hitters = (await pool.query(
    `SELECT COUNT(DISTINCT a.user_id)::int AS n FROM ai_usage a
     WHERE a.day >= CURRENT_DATE - 7 AND a.count >= $1
       AND NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.user_id = a.user_id AND s.status IN ('active', 'past_due'))
       AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = a.user_id AND u.pro_until > NOW())`,
    [PLAN_LIMITS.free.aiPerDay])).rows[0];

  return {
    days,
    subscriptions: {
      active: active.length,
      pastDue: subs.filter((r: any) => r.status === 'past_due').length,
      cancelling: active.filter((r: any) => r.cancelling).length,
      refundedOrEnded: subs.filter((r: any) => ['refunded', 'expired', 'canceled'].includes(r.status)).length,
      mrrMinorByCurrency: mrr,
      activeByRegion: [...byRegion.entries()].map(([region, count]) => ({ region, count })).sort((a, b) => b.count - a.count),
    },
    referrals: { invites: ref.invites, qualified: ref.qualified, rewardMonthsGranted: ref.months, hunterOnReferralPro: ref.on_pro },
    classes: { active: cls.active, students: cls.students, avgSize: cls.active ? Math.round((cls.students / cls.active) * 10) / 10 : 0 },
    aiLimitHitters7d: hitters.n,
  };
}
