import { addDays, localDate } from './time.js';
import { DAYS, sanitizeModuleTask, taskXp, type Day } from './rules.js';

// Organizations (B2B). Pure rules, unit-tested; the routes in routes/orgs.ts
// apply them.
//
// Two XP ledgers. A member of an institution earns *institution XP* for the
// core tasks staff assign (org_members.xp, org_task_completions) and keeps
// earning *personal XP* for their own modules and timetable (users.xp,
// quest_completions). The two never mix: staff see institution progress only,
// never personal tasks, and a member's personal level is untouched by
// institution work. Individuals (B2C) have only the personal ledger.

export type OrgRole = 'admin' | 'teacher' | 'student';
export const ORG_ROLES: OrgRole[] = ['admin', 'teacher', 'student'];
export const ORG_KINDS = ['school', 'coaching', 'college', 'university', 'company', 'other'] as const;
export type OrgKind = (typeof ORG_KINDS)[number];

export const MAX_ORG_TASKS = 60;
export const MAX_REPORT_EMAILS = 10;
export const ORG_WINDOW_DAYS = 28;

export const isStaff = (role: string | null | undefined): role is 'admin' | 'teacher' => role === 'admin' || role === 'teacher';

/** Who may do what. Admins run the institution; teachers manage the timetable and students; students take part. */
export const can = {
  manageTasks: (role: string | null | undefined) => isStaff(role),
  viewMembers: (role: string | null | undefined) => isStaff(role),
  removeMember: (actor: string | null | undefined, target: string) => actor === 'admin' ? target !== 'admin' : actor === 'teacher' && target === 'student',
  changeRoles: (role: string | null | undefined) => role === 'admin',
  editSettings: (role: string | null | undefined) => role === 'admin',
  manageBilling: (role: string | null | undefined) => role === 'admin',
  addGuardian: (role: string | null | undefined) => isStaff(role),
};

export function validOrgName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = raw.trim().replace(/\s+/g, ' ');
  return name.length >= 2 && name.length <= 80 && !/[<>]/.test(name) ? name : null;
}

export const validOrgKind = (raw: unknown): OrgKind | null =>
  typeof raw === 'string' && (ORG_KINDS as readonly string[]).includes(raw) ? (raw as OrgKind) : null;

export interface OrgTaskInput {
  title: string;
  description: string | null;
  difficulty: number;
  xpReward: number;
  scheduleTime: string | null;
  recurrence: Day[] | null;
}

/** Validate a core task. XP always follows difficulty, so staff cannot inflate a ledger. */
export function sanitizeOrgTask(raw: unknown): OrgTaskInput | string {
  const t = sanitizeModuleTask(raw);
  if (typeof t === 'string') return t;
  const o = raw as Record<string, unknown>;
  const description = typeof o.description === 'string' && o.description.trim() ? o.description.trim().slice(0, 500) : null;
  return { title: t.title, description, difficulty: t.difficulty, xpReward: taskXp(t.difficulty), scheduleTime: t.scheduleTime, recurrence: t.recurrence as Day[] | null };
}

/** MON…SUN for a YYYY-MM-DD date. */
export const dayCode = (date: string): Day => DAYS[(new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7];

export const scheduledOn = (recurrence: string[] | null | undefined, date: string) => !recurrence?.length || recurrence.includes(dayCode(date));

/**
 * The calendar day (in `tz`) a core task started to count. It must be the same
 * zone as "today", or a task created just after local midnight would count the
 * day before it existed as missed.
 */
export const taskSince = (createdAt: Date | string, tz: string) => localDate(tz, new Date(createdAt));

export interface PlanStatus {
  /** Paid or trial access is live. */
  active: boolean;
  /** Seats available to students right now. */
  seats: number;
  trial: boolean;
  until: Date | null;
}

/**
 * An institution's plan: its trial/manual grant (organizations.plan_until +
 * seats) and any live seat subscriptions, whichever give more seats. Pure; unit-tested.
 */
export function orgPlanStatus(
  grant: { seats: number; planUntil: Date | string | null },
  subscriptions: { seats: number | null; currentPeriodEnd: Date | string | null; live: boolean }[],
  now = new Date(),
): PlanStatus {
  const grantUntil = grant.planUntil ? new Date(grant.planUntil) : null;
  const grantLive = !!grantUntil && grantUntil > now;
  const subs = subscriptions.filter(s => s.live);
  const paidSeats = subs.reduce((n, s) => n + (s.seats ?? 0), 0);
  const subEnd = subs.reduce<Date | null>((best, s) => {
    const e = s.currentPeriodEnd ? new Date(s.currentPeriodEnd) : null;
    return e && (!best || e > best) ? e : best;
  }, null);
  if (paidSeats > 0 && (!grantLive || paidSeats >= grant.seats)) return { active: true, seats: paidSeats, trial: false, until: subEnd };
  if (grantLive) return { active: true, seats: grant.seats, trial: true, until: grantUntil };
  return { active: false, seats: 0, trial: false, until: grantUntil ?? subEnd };
}

/** Can one more student join? Staff never use a seat. */
export function seatAvailable(plan: PlanStatus, students: number): boolean {
  return plan.active && students < plan.seats;
}

export interface MemberProgress {
  activeDays7: number;
  activeDays28: number;
  /** Share of scheduled core tasks done in the last 28 days (0–100), null if none were scheduled. */
  completionPct: number | null;
  lastActive: string | null;
}

/**
 * Institution progress for one member from their core-task completions and the
 * institution's task schedule. `tasks` carry the day each task started to count. Pure; unit-tested.
 */
export function memberProgress(
  completions: { date: string; taskId: number }[],
  tasks: { id: number; recurrence: string[] | null; since: string }[],
  today: string,
  windowDays = ORG_WINDOW_DAYS,
): MemberProgress {
  const from = addDays(today, -(windowDays - 1));
  const days = new Set<string>();
  let done = 0;
  for (const c of completions) {
    if (c.date < from || c.date > today) continue;
    days.add(c.date);
    done += 1;
  }
  let scheduled = 0;
  for (let i = 0; i < windowDays; i++) {
    const d = addDays(today, -i);
    for (const t of tasks) if (t.since <= d && scheduledOn(t.recurrence, d)) scheduled += 1;
  }
  let week = 0;
  for (let i = 0; i < 7; i++) if (days.has(addDays(today, -i))) week += 1;
  let last: string | null = null;
  for (const c of completions) if (c.date <= today && (!last || c.date > last)) last = c.date;
  return {
    activeDays7: week,
    activeDays28: days.size,
    completionPct: scheduled ? Math.min(100, Math.round((done / scheduled) * 100)) : null,
    lastActive: last,
  };
}
