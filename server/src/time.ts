import type { Request } from 'express';

// Per-hunter calendar days. The client sends its IANA timezone in the
// X-Timezone header; every "today" (daily resets, streaks, penalties, hidden
// quest, Perfect Day, caps) is computed in that zone so a hunter's day ends at
// *their* midnight, not UTC's. Invalid/missing zones fall back to UTC.
// ponytail: the zone is trusted per request; spoofing it can only shift which
// calendar date a completion lands on (each date still completes once).

const validZones = new Map<string, boolean>();

export function isValidTimeZone(tz: string): boolean {
  if (!tz || tz.length > 64) return false;
  if (!validZones.has(tz)) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: tz });
      validZones.set(tz, true);
    } catch {
      validZones.set(tz, false);
    }
  }
  return validZones.get(tz)!;
}

export function requestTimeZone(req: Request): string {
  const tz = String(req.headers['x-timezone'] || '');
  return isValidTimeZone(tz) ? tz : 'UTC';
}

/** YYYY-MM-DD for `date` in `tz`. */
export function localDate(tz: string, date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

/** The hunter's "today" for this request. */
export const requestToday = (req: Request) => localDate(requestTimeZone(req));

/** Shift a YYYY-MM-DD date by whole days. */
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split('T')[0];
}
