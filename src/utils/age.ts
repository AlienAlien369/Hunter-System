// Age gate helpers for the sign-up form. The server is the authority (see
// server/src/age.ts) — this only decides which fields to show. Same rules:
// under 13 blocked, 13 to 17 need a parent's consent, 18+ adult; birth month
// only, and the youngest possible age is assumed.

export type AgeClass = 'blocked' | 'minor' | 'adult';

export function ageFromBirthMonth(ym: string, now = new Date()): number | null {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(ym);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (y > now.getUTCFullYear() || (y === now.getUTCFullYear() && mo > now.getUTCMonth() + 1) || y < now.getUTCFullYear() - 110) return null;
  const lastDay = new Date(Date.UTC(y, mo, 0));
  let age = now.getUTCFullYear() - y;
  if (now.getUTCMonth() < lastDay.getUTCMonth() || (now.getUTCMonth() === lastDay.getUTCMonth() && now.getUTCDate() < lastDay.getUTCDate())) age -= 1;
  return age;
}

export function classifyBirthMonth(ym: string, now = new Date()): AgeClass | null {
  const age = ageFromBirthMonth(ym, now);
  if (age === null) return null;
  return age < 13 ? 'blocked' : age < 18 ? 'minor' : 'adult';
}

export const looksLikeEmail = (v: string) => /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(v.trim());
