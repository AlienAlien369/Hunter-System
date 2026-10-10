import { pool } from './db.js';

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
  const { page, ref } = raw as Record<string, unknown>;
  if (typeof page === 'string' && /^\/[\w\-./]{0,59}$/.test(page)) out.page = page;
  if (typeof ref === 'string' && /^[\w-]{1,30}$/.test(ref)) out.ref = ref;
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
  return { days, region, totals, byRegion, visits: { landing: n('landing_view'), login: n('login_view'), pricing: n('pricing_view'), upgradeClicks: n('upgrade_click') } };
}
