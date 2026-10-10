// Age gate rules. One policy everywhere (one product, not per-country forks):
//   under 13  → cannot create an account (COPPA; below every digital-consent age)
//   13 to 17  → needs a parent's or guardian's consent before use. This is the
//               strictest common denominator: India (DPDP, under 18),
//               EU/UK (digital-consent age 13 to 16), US (COPPA line at 13).
//   18+       → adult.
// We store only the birth *month*, not the day (data minimisation), and when
// the exact day matters we assume the youngest possible age.
// ponytail: age is self-declared; a determined child can lie. The mitigation
// is proportionate (no ads, no data sale, no public contact), not verification.

export type AgeClass = 'blocked' | 'minor' | 'adult';
export type ConsentStatus = 'needs_age' | 'not_required' | 'pending' | 'granted';

export const MIN_AGE = 13;
export const ADULT_AGE = 18;

/** "YYYY-MM" → first day of that month as a Date (UTC), or null if invalid / in the future / implausible. */
export function parseBirthMonth(raw: unknown, now = new Date()): Date | null {
  if (typeof raw !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(raw)) return null;
  const [y, m] = raw.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  if (d.getTime() > now.getTime()) return null;
  if (y < now.getUTCFullYear() - 110) return null;
  return d;
}

/** Whole years of age, assuming the person was born on the last day of their birth month (the youngest case). */
export function ageFromBirthMonth(birth: Date, now = new Date()): number {
  const lastDay = new Date(Date.UTC(birth.getUTCFullYear(), birth.getUTCMonth() + 1, 0));
  let age = now.getUTCFullYear() - lastDay.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < lastDay.getUTCMonth() ||
    (now.getUTCMonth() === lastDay.getUTCMonth() && now.getUTCDate() < lastDay.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export function classifyAge(age: number): AgeClass {
  if (age < MIN_AGE) return 'blocked';
  return age < ADULT_AGE ? 'minor' : 'adult';
}

export function initialConsentStatus(cls: Exclude<AgeClass, 'blocked'>): ConsentStatus {
  return cls === 'minor' ? 'pending' : 'not_required';
}

/** Statuses that may use the product. */
export const canUseApp = (s: ConsentStatus | string) => s === 'not_required' || s === 'granted';

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
export function isValidEmail(raw: unknown): raw is string {
  return typeof raw === 'string' && raw.length <= 254 && EMAIL.test(raw.trim());
}

/** "parent@example.com" → "p****@example.com" — shown back to the child so a wrong address is noticed. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  return `${local.slice(0, 1)}${'*'.repeat(Math.min(8, Math.max(3, local.length - 1)))}@${domain}`;
}
