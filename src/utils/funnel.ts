import type { FunnelReport, FunnelRow } from '../lib/api';

export interface FunnelStep {
  key: string;
  label: string;
  count: number;
  /** Share of the previous step (null for the first step or when the base is 0). */
  fromPrev: number | null;
  /** Share of all signups. */
  ofSignups: number | null;
  note?: string;
}

const pct = (n: number, d: number) => (d > 0 ? n / d : null);

/** Turn a funnel row into display steps. Day-7 is measured only among hunters old enough to have had a day 7. */
export function funnelSteps(t: FunnelRow): FunnelStep[] {
  const steps: Omit<FunnelStep, 'fromPrev' | 'ofSignups'>[] = [
    { key: 'signups', label: 'Signed up', count: t.signups },
    { key: 'timetable', label: 'Built a timetable', count: t.timetable },
    { key: 'firstQuest', label: 'Completed a first quest', count: t.firstQuest },
    { key: 'd7', label: 'Returned on day 7+', count: t.d7Returned, note: `of ${t.d7Eligible} signed up 7+ days ago` },
    { key: 'upgraded', label: 'Upgraded', count: t.upgraded },
  ];
  return steps.map((s, i) => {
    // Day 7 compares against its own eligible base, and upgrade against signups.
    const base = s.key === 'd7' ? t.d7Eligible : i === 0 ? 0 : s.key === 'upgraded' ? t.signups : steps[i - 1].count;
    return { ...s, fromPrev: i === 0 ? null : pct(s.count, base), ofSignups: pct(s.count, t.signups) };
  });
}

/** "12.3%" or an em dash when there is nothing to divide by. */
export const fmtPct = (v: number | null) => (v === null ? '—' : `${(v * 100).toFixed(1)}%`);

/** Visit → signup conversion, only meaningful once there are visits. */
export const visitToSignup = (r: FunnelReport) => pct(r.totals.signups, r.visits.login + r.visits.landing);
