import { randomInt } from 'crypto';
import { addDays, currentStreak } from './time.js';

// Classes: a teacher (or institute) creates a class and students join with a code.
//
// What a teacher sees is deliberately narrow: the student's Hunter name,
// level/rank, streak, how many days this week and in the last four weeks they
// were active, and when they were last active. Never their tasks, notes,
// modules, XP history, unplanned activities, region or account details.
// Joining is the student's own action after seeing that list, and leaving
// removes the teacher's view at once.

/** Free pilot class: the first class a teacher makes. More classes come with the Teams plan. */
export const FREE_CLASS_CAPACITY = 60;
export const MAX_FREE_CLASSES = 1;
export const MAX_JOINED_CLASSES = 3;
export const CONSISTENCY_WINDOW_DAYS = 28;

// No 0/O/1/I so a code read aloud or off a whiteboard is hard to get wrong.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 6;

export function generateJoinCode(): string {
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

/** "abc-d e2" → "ABCDE2"; null unless it is a well-formed code. */
export function normalizeJoinCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.toUpperCase().replace(/[\s-]/g, '');
  return code.length === CODE_LENGTH && [...code].every(c => ALPHABET.includes(c)) ? code : null;
}

export interface Consistency {
  streak: number;
  activeDaysThisWeek: number;
  activeDays28: number;
  consistencyPct: number;
  lastActive: string | null;
}

/** Consistency figures from a hunter's set of active days (YYYY-MM-DD) as of `today`. Pure; unit-tested. */
export function consistencyOf(days: Set<string>, today: string): Consistency {
  let week = 0;
  let month = 0;
  for (let i = 0; i < CONSISTENCY_WINDOW_DAYS; i++) {
    if (days.has(addDays(today, -i))) {
      month += 1;
      if (i < 7) week += 1;
    }
  }
  let last: string | null = null;
  for (const d of days) if (d <= today && (!last || d > last)) last = d;
  return {
    streak: currentStreak(days, today),
    activeDaysThisWeek: week,
    activeDays28: month,
    consistencyPct: Math.round((month / CONSISTENCY_WINDOW_DAYS) * 100),
    lastActive: last,
  };
}

export const validClassName = (raw: unknown): string | null => {
  if (typeof raw !== 'string') return null;
  const name = raw.trim().replace(/\s+/g, ' ');
  return name.length >= 2 && name.length <= 60 ? name : null;
};
