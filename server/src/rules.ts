// Hunter rules: every configurable XP value plus the pure logic that uses it
// (task XP, unplanned-activity XP, routine diffing, similarity). No DB access
// here, so all of it is unit-tested in tests/rules.test.ts.
// The frontend never hard-codes these numbers — it renders server previews.

export const XP_RULES = {
  /** Custom (per-user) tasks: XP is derived from difficulty, never client-supplied. */
  taskXpByDifficulty: { 1: 10, 2: 20, 3: 30 } as Record<number, number>,

  routine: {
    /**
     * A commitment becomes "established" exactly `graceHours` after it was
     * created (>= is established). The routine's first items are created at
     * confirmation, so the setup period is the first 48 hours after the hunter
     * confirms their routine. Elapsed absolute time is timezone-independent,
     * so the boundary is identical for every timezone (the stored timezone is
     * only used to display the local end time).
     */
    graceHours: 48,
    moduleAdded: 15, // once per module name, only after the setup period
    moduleRemoved: -75,
    moduleReplaced: -75,
    taskRemoved: -20,
    majorChange: -25,
    minorChange: -10,
    /** Shifting a slot by at least this many minutes is a major change. */
    majorShiftMinutes: 60,
    /** Changing duration by at least this fraction is a major change. */
    majorDurationRatio: 0.5,
    /** Cap on time/duration/frequency penalties in a single save. */
    editPenaltyCap: -100,
  },

  /** Completing every timetable quest scheduled today (at least minQuests) pays a one-time bonus. */
  perfectDay: { bonus: 25, minQuests: 3 },

  unplanned: {
    xpPerHour: { easy: 15, medium: 30, hard: 45, extreme: 60 } as Record<Difficulty, number>,
    minMinutes: 5,
    maxCreditedMinutes: 240, // longer sessions are credited as 4h
    maxMinutes: 16 * 60, // anything longer is unrealistic and rejected
    maxXp: 150,
    manualMaxXp: 60, // manual entries (AI unavailable) are unverified → lower ceiling
    editBoostCap: 1.5, // editing an AI analysis can raise XP by at most 50%
    trivialCap: 5,
    dailyXpCap: 200,
    dailyAcceptLimit: 8,
    hourlyAnalyzeLimit: 10,
    repeatWindowDays: 7,
    repeatDecay: 0.5, // each similar accepted activity in the window halves XP
    similarityThreshold: 0.6,
    defaultRelevance: 0.5, // manual entries (no AI) sit mid-scale
  },
} as const;

export const DIFFICULTIES = ['easy', 'medium', 'hard', 'extreme'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const UNPLANNED_CATEGORIES = [
  'work', 'learning', 'fitness', 'health', 'skincare', 'content', 'mindset', 'chores', 'social', 'other',
] as const;

export const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;
export type Day = (typeof DAYS)[number];

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

// ─── Tasks ────────────────────────────────────────────────────────────────

export function taskXp(difficulty: number): number {
  return XP_RULES.taskXpByDifficulty[clamp(Math.round(difficulty) || 1, 1, 3)];
}

/** Timetable slots become daily quests; their difficulty follows the slot length. */
export function routineDifficulty(durationMin: number): 1 | 2 | 3 {
  return durationMin <= 30 ? 1 : durationMin <= 90 ? 2 : 3;
}

// ─── Unplanned activities ─────────────────────────────────────────────────

export interface UnplannedFields {
  title: string;
  category: string;
  difficulty: Difficulty;
  estimatedMinutes: number;
}

export interface UnplannedAnalysis extends UnplannedFields {
  goalRelevance: number; // 0..1
  meaningful: boolean;
  trivial: boolean;
  duplicate: boolean;
  xpSuggestion: number;
  reason: string;
}

/**
 * Deterministic XP engine for unplanned work. The AI only supplies inputs
 * (difficulty, minutes, relevance, triviality); this function decides.
 * `repeats` = similar activities already accepted in the repeat window.
 */
export function unplannedXp(
  a: Pick<UnplannedAnalysis, 'difficulty' | 'estimatedMinutes' | 'goalRelevance' | 'trivial' | 'meaningful'>,
  repeats = 0,
): number {
  const r = XP_RULES.unplanned;
  const minutes = clamp(a.estimatedMinutes, r.minMinutes, r.maxCreditedMinutes);
  let xp = (r.xpPerHour[a.difficulty] * minutes) / 60;
  xp *= 0.7 + 0.3 * clamp(a.goalRelevance, 0, 1);
  if (a.trivial || !a.meaningful || a.estimatedMinutes < r.minMinutes) xp = Math.min(xp, r.trivialCap);
  xp *= r.repeatDecay ** repeats;
  return clamp(Math.round(xp), 1, r.maxXp);
}

/** Validate user- or AI-supplied fields; returns an error message or null. */
export function unplannedFieldsError(f: Partial<UnplannedFields>): string | null {
  if (typeof f.title !== 'string' || !f.title.trim() || f.title.length > 120) return 'Title must be 1–120 characters';
  if (!DIFFICULTIES.includes(f.difficulty as Difficulty)) return `Difficulty must be one of ${DIFFICULTIES.join(', ')}`;
  if (!UNPLANNED_CATEGORIES.includes(f.category as (typeof UNPLANNED_CATEGORIES)[number])) return 'Unknown category';
  const m = f.estimatedMinutes;
  if (typeof m !== 'number' || !Number.isFinite(m) || m < 1) return 'Estimated time must be at least 1 minute';
  if (m > XP_RULES.unplanned.maxMinutes) return 'Estimated time is unrealistic (max 16 hours)';
  return null;
}

/** Strictly validate the AI's structured output. Anything off → null (manual fallback). */
export function validateUnplannedAnalysis(raw: unknown): UnplannedAnalysis | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const fields = {
    title: typeof o.title === 'string' ? o.title.trim().slice(0, 120) : '',
    category: UNPLANNED_CATEGORIES.includes(o.category as never) ? (o.category as string) : 'other',
    difficulty: o.difficulty as Difficulty,
    estimatedMinutes: typeof o.estimatedMinutes === 'number' ? Math.round(o.estimatedMinutes) : NaN,
  };
  if (unplannedFieldsError(fields)) return null;
  if (typeof o.goalRelevance !== 'number' || !Number.isFinite(o.goalRelevance)) return null;
  if (typeof o.meaningful !== 'boolean' || typeof o.trivial !== 'boolean') return null;
  return {
    ...fields,
    goalRelevance: clamp(o.goalRelevance, 0, 1),
    meaningful: o.meaningful,
    trivial: o.trivial,
    duplicate: o.duplicate === true,
    xpSuggestion: typeof o.xpSuggestion === 'number' ? clamp(Math.round(o.xpSuggestion), 0, 500) : 0,
    reason: typeof o.reason === 'string' ? o.reason.slice(0, 400) : '',
  };
}

// ─── Similarity (duplicate + existing-task detection) ─────────────────────

const STOPWORDS = new Set(['the', 'and', 'for', 'with', 'did', 'was', 'spent', 'hour', 'hours', 'minutes', 'min', 'some', 'about', 'from', 'into', 'that', 'this', 'one', 'two']);

export function normalizeText(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokens(s: string): Set<string> {
  return new Set(normalizeText(s).split(' ').filter(w => w.length > 2 && !STOPWORDS.has(w) && !/^\d+$/.test(w)));
}

/** 0..1: max of Jaccard and containment (containment needs ≥2 shared-side tokens). */
export function similarity(a: string, b: string): number {
  const A = tokens(a);
  const B = tokens(b);
  if (!A.size || !B.size) return normalizeText(a) === normalizeText(b) ? 1 : 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  const jaccard = inter / (A.size + B.size - inter);
  const minSize = Math.min(A.size, B.size);
  const containment = minSize >= 2 ? inter / minSize : 0;
  return Math.max(jaccard, containment);
}

// ─── Routine ──────────────────────────────────────────────────────────────

export interface RoutineItem {
  id: string;
  module: string;
  title: string;
  time: string; // HH:MM, 24h
  durationMin: number;
  days: Day[];
  createdAt: string; // ISO — always set by the server
}

export type RoutineChangeKind =
  | 'module_added' | 'module_removed' | 'module_replaced'
  | 'task_added' | 'task_removed'
  | 'time_changed' | 'duration_changed' | 'frequency_changed';

export interface RoutineChange {
  kind: RoutineChangeKind;
  label: string;
  module: string;
  detail?: string;
  severity?: 'major' | 'minor';
  xp: number;
  reason: string;
}

export interface RoutineDiff {
  changes: RoutineChange[];
  netXp: number;
  /** Modules that earn the one-time "added" reward with this save. */
  rewardModules: string[];
  established: boolean;
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Validate client items and stamp createdAt server-side: existing ids keep
 * their stored createdAt, new ids get `now`. A client can therefore never
 * make an established commitment look new (or vice versa).
 */
export function sanitizeRoutineItems(raw: unknown, previous: RoutineItem[], now: Date): RoutineItem[] | string {
  if (!Array.isArray(raw)) return 'items must be an array';
  if (raw.length > 60) return 'A routine can have at most 60 slots';
  const prevById = new Map(previous.map(i => [i.id, i]));
  const seen = new Set<string>();
  const out: RoutineItem[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') return 'Invalid routine slot';
    const o = r as Record<string, unknown>;
    const id = typeof o.id === 'string' ? o.id.trim().slice(0, 64) : '';
    const module = typeof o.module === 'string' ? o.module.trim().slice(0, 40) : '';
    const title = typeof o.title === 'string' ? o.title.trim().slice(0, 80) : '';
    const time = typeof o.time === 'string' ? o.time : '';
    const durationMin = typeof o.durationMin === 'number' ? Math.round(o.durationMin) : NaN;
    const days = Array.isArray(o.days) ? DAYS.filter(d => (o.days as unknown[]).includes(d)) : [];
    if (!id || seen.has(id)) return 'Every slot needs a unique id';
    if (!module) return 'Every slot needs a module';
    if (!title) return 'Every slot needs a title';
    if (!TIME_RE.test(time)) return `Invalid time "${time}" (use HH:MM)`;
    if (!(durationMin >= 5 && durationMin <= 720)) return 'Duration must be 5–720 minutes';
    if (!days.length) return `"${title}" must repeat on at least one day`;
    seen.add(id);
    out.push({ id, module, title, time, durationMin, days, createdAt: prevById.get(id)?.createdAt ?? now.toISOString() });
  }
  return out;
}

export function isEstablished(createdAt: string, now: Date): boolean {
  return now.getTime() - new Date(createdAt).getTime() >= XP_RULES.routine.graceHours * 3600_000;
}

const toMinutes = (t: string) => parseInt(t.slice(0, 2)) * 60 + parseInt(t.slice(3, 5));
const fmt12 = (t: string) => {
  const m = toMinutes(t);
  const h = Math.floor(m / 60);
  return `${((h + 11) % 12) + 1}:${String(m % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};
const moduleKey = (m: string) => m.trim().toLowerCase();

/**
 * Structural diff between two routines + its XP impact. Modules are the
 * normalized `module` names; slots are matched by id. A slot whose module or
 * title changed counts as removed + added.
 */
export function diffRoutine(
  before: RoutineItem[],
  after: RoutineItem[],
  opts: { now: Date; confirmedAt: string | null; rewardedModules: string[] },
): RoutineDiff {
  const R = XP_RULES.routine;
  const { now } = opts;
  const established = !!opts.confirmedAt && isEstablished(opts.confirmedAt, now);
  const changes: RoutineChange[] = [];

  const group = (items: RoutineItem[]) => {
    const m = new Map<string, RoutineItem[]>();
    for (const i of items) m.set(moduleKey(i.module), [...(m.get(moduleKey(i.module)) ?? []), i]);
    return m;
  };
  const oldMods = group(before);
  const newMods = group(after);
  const nameOf = (key: string) => (newMods.get(key) ?? oldMods.get(key))![0].module;
  const moduleEstablished = (key: string) => (oldMods.get(key) ?? []).some(i => isEstablished(i.createdAt, now));

  const removed = [...oldMods.keys()].filter(k => !newMods.has(k));
  const added = [...newMods.keys()].filter(k => !oldMods.has(k));
  const removedEst = removed.filter(moduleEstablished);
  const removedNew = removed.filter(k => !moduleEstablished(k));
  const rewarded = new Set(opts.rewardedModules.map(moduleKey));
  const rewardModules: string[] = [];

  // Pair established removals with additions → replacements.
  const pairs = Math.min(removedEst.length, added.length);
  for (let i = 0; i < pairs; i++) {
    const from = nameOf(removedEst[i]);
    const to = nameOf(added[i]);
    changes.push({
      kind: 'module_replaced', module: to, label: `${from} replaced with ${to}`,
      xp: established ? R.moduleReplaced : 0,
      reason: established ? 'An established module was replaced' : 'Setup period — no XP impact',
    });
  }
  for (const k of removedEst.slice(pairs)) {
    changes.push({
      kind: 'module_removed', module: nameOf(k), label: `Removed ${nameOf(k)}`,
      xp: established ? R.moduleRemoved : 0,
      reason: established ? 'An established module was removed' : 'Setup period — no XP impact',
    });
  }
  for (const k of removedNew) {
    changes.push({
      kind: 'module_removed', module: nameOf(k), label: `Removed ${nameOf(k)}`, xp: 0,
      reason: 'Module was added less than 48 hours ago — no XP impact',
    });
  }
  for (const k of added.slice(pairs)) {
    const earns = established && !rewarded.has(k);
    if (earns) rewardModules.push(nameOf(k));
    changes.push({
      kind: 'module_added', module: nameOf(k), label: `New module added: ${nameOf(k)}`,
      xp: earns ? R.moduleAdded : 0,
      reason: earns ? 'Expanding your routine' : established ? 'Module reward already claimed once' : 'Setup period — no XP impact',
    });
  }

  // Slot-level changes inside modules that exist on both sides.
  const newById = new Map(after.map(i => [i.id, i]));
  const oldById = new Map(before.map(i => [i.id, i]));
  let editPenalty = 0;
  const editChanges: RoutineChange[] = [];
  for (const o of before) {
    if (!newMods.has(moduleKey(o.module))) continue;
    const n = newById.get(o.id);
    const est = established && isEstablished(o.createdAt, now);
    if (!n || moduleKey(n.module) !== moduleKey(o.module) || n.title !== o.title) {
      changes.push({
        kind: 'task_removed', module: o.module, label: `Removed ${o.title}`,
        xp: est ? R.taskRemoved : 0,
        reason: est ? 'An established commitment was removed' : 'Commitment is less than 48 hours old — no XP impact',
      });
      continue;
    }
    const parts: string[] = [];
    let kind: RoutineChangeKind | null = null;
    let major = false;
    if (n.time !== o.time) {
      kind = 'time_changed';
      parts.push(`${fmt12(o.time)} → ${fmt12(n.time)}`);
      if (Math.abs(toMinutes(n.time) - toMinutes(o.time)) >= R.majorShiftMinutes) major = true;
    }
    if (n.durationMin !== o.durationMin) {
      kind ??= 'duration_changed';
      parts.push(`${o.durationMin} → ${n.durationMin} min`);
      if (Math.abs(n.durationMin - o.durationMin) / o.durationMin >= R.majorDurationRatio) major = true;
    }
    if (n.days.join() !== o.days.join()) {
      kind ??= 'frequency_changed';
      parts.push(`${o.days.length === 7 ? 'daily' : o.days.join(' ')} → ${n.days.length === 7 ? 'daily' : n.days.join(' ')}`);
      major = true;
    }
    if (!kind) continue;
    const xp = est ? (major ? R.majorChange : R.minorChange) : 0;
    editPenalty += xp;
    editChanges.push({
      kind, module: n.module, label: `Changed ${n.title}`, detail: parts.join(' · '),
      severity: major ? 'major' : 'minor', xp,
      reason: !est ? 'Commitment is less than 48 hours old — no XP impact'
        : major ? 'Major schedule change to an established commitment' : 'Minor timing adjustment',
    });
  }
  // Enforce the per-save cap by refunding from the last edits first.
  if (editPenalty < R.editPenaltyCap) {
    let excess = R.editPenaltyCap - editPenalty; // positive amount to give back
    for (const c of [...editChanges].reverse()) {
      if (excess <= 0) break;
      const give = Math.min(excess, -c.xp);
      c.xp += give;
      excess -= give;
      if (give) c.reason += ' (capped per save)';
    }
  }
  changes.push(...editChanges);

  for (const n of after) {
    if (!oldMods.has(moduleKey(n.module))) continue; // covered by module_added
    const o = oldById.get(n.id);
    if (!o || moduleKey(o.module) !== moduleKey(n.module) || o.title !== n.title) {
      changes.push({ kind: 'task_added', module: n.module, label: `Added ${n.title}`, xp: 0, reason: 'New commitment' });
    }
  }

  return { changes, netXp: changes.reduce((s, c) => s + c.xp, 0), rewardModules, established };
}

// ─── User modules (Skincare, Content Creation, Fitness, custom…) ─────────
// A module's commitments follow the same 48h rule as the routine: the module
// (and each task inside it) is freely editable for 48h after creation, then
// changes carry the XP_RULES.routine consequences.

export const MODULE_KINDS = ['tasks', 'content', 'diet', 'dsa', 'saas', 'arch'] as const;
export type ModuleKind = (typeof MODULE_KINDS)[number];
/** Kinds that render an existing Hunter page and can exist once per user. */
export const SINGLETON_KINDS: ModuleKind[] = ['content', 'diet', 'dsa', 'saas', 'arch'];

export interface ModuleTask {
  id?: string; // quest_id for existing tasks
  title: string;
  difficulty: number;
  scheduleTime: string | null;
  timeOfDay: string | null;
  recurrence: Day[] | null;
  subtasks?: string[];
  createdAt?: string;
}

export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 36) || 'module';
}

/** Validate one task spec from the client or the AI. */
export function sanitizeModuleTask(raw: unknown): ModuleTask | string {
  if (!raw || typeof raw !== 'object') return 'Invalid task';
  const o = raw as Record<string, unknown>;
  const title = typeof o.title === 'string' ? o.title.trim() : '';
  if (!title || title.length > 120) return 'Task titles must be 1–120 characters';
  const difficulty = Number(o.difficulty ?? 1);
  if (![1, 2, 3].includes(difficulty)) return 'Difficulty must be 1, 2 or 3';
  const scheduleTime = o.scheduleTime == null || o.scheduleTime === '' ? null : String(o.scheduleTime);
  if (scheduleTime !== null && !TIME_RE.test(scheduleTime)) return `Invalid time "${scheduleTime}"`;
  const timeOfDay = o.timeOfDay == null || o.timeOfDay === '' || o.timeOfDay === 'anytime' ? null : String(o.timeOfDay);
  if (timeOfDay !== null && !['morning', 'evening'].includes(timeOfDay)) return 'timeOfDay must be morning, evening or anytime';
  let recurrence: Day[] | null = null;
  if (Array.isArray(o.recurrence)) {
    recurrence = DAYS.filter(d => (o.recurrence as unknown[]).includes(d));
    if (!recurrence.length) return `"${title}" must repeat on at least one day`;
    if (recurrence.length === 7) recurrence = null;
  }
  const subtasks = Array.isArray(o.subtasks)
    ? o.subtasks.filter((s): s is string => typeof s === 'string' && !!s.trim()).map(s => s.trim().slice(0, 80)).slice(0, 12)
    : [];
  return { id: typeof o.id === 'string' ? o.id : undefined, title, difficulty, scheduleTime, timeOfDay, recurrence, subtasks };
}

/**
 * Diff a module's task list. `before` tasks carry id + createdAt (from the DB);
 * `after` tasks reference existing ones by id. Title/subtask edits are
 * cosmetic (free); timing/frequency are major; difficulty/part-of-day/small
 * shifts are minor. Only established (≥48h old) tasks carry XP impact.
 */
export function diffModuleTasks(before: ModuleTask[], after: ModuleTask[], opts: { now: Date; moduleName: string }): { changes: RoutineChange[]; netXp: number } {
  const R = XP_RULES.routine;
  const { now, moduleName } = opts;
  const afterById = new Map(after.filter(t => t.id).map(t => [t.id!, t]));
  const changes: RoutineChange[] = [];
  const edits: RoutineChange[] = [];
  for (const o of before) {
    const est = isEstablished(o.createdAt!, now);
    const n = afterById.get(o.id!);
    if (!n) {
      changes.push({
        kind: 'task_removed', module: moduleName, label: `Removed ${o.title} from ${moduleName}`,
        xp: est ? R.taskRemoved : 0,
        reason: est ? 'An established commitment was removed' : 'Task is less than 48 hours old — no XP impact',
      });
      continue;
    }
    const parts: string[] = [];
    let major = false;
    let kind: RoutineChangeKind | null = null;
    const days = (t: ModuleTask) => (t.recurrence?.length ? t.recurrence.join(' ') : 'daily');
    if ((o.scheduleTime ?? '') !== (n.scheduleTime ?? '')) {
      kind = 'time_changed';
      parts.push(`${o.scheduleTime ? fmt12(o.scheduleTime) : 'no time'} → ${n.scheduleTime ? fmt12(n.scheduleTime) : 'no time'}`);
      if (o.scheduleTime && n.scheduleTime && Math.abs(toMinutes(n.scheduleTime) - toMinutes(o.scheduleTime)) >= R.majorShiftMinutes) major = true;
    }
    if (days(o) !== days(n)) {
      kind ??= 'frequency_changed';
      parts.push(`${days(o)} → ${days(n)}`);
      major = true;
    }
    if (o.difficulty !== n.difficulty) {
      kind ??= 'duration_changed';
      parts.push(`difficulty ${o.difficulty} → ${n.difficulty}`);
    }
    if ((o.timeOfDay ?? '') !== (n.timeOfDay ?? '')) {
      kind ??= 'time_changed';
      parts.push(`${o.timeOfDay ?? 'anytime'} → ${n.timeOfDay ?? 'anytime'}`);
    }
    if (!kind) continue; // cosmetic only (title / subtasks)
    const xp = est ? (major ? R.majorChange : R.minorChange) : 0;
    edits.push({
      kind, module: moduleName, label: `Changed ${n.title}`, detail: parts.join(' · '), severity: major ? 'major' : 'minor', xp,
      reason: !est ? 'Task is less than 48 hours old — no XP impact' : major ? 'Major change to an established commitment' : 'Minor adjustment',
    });
  }
  let editPenalty = edits.reduce((s, c) => s + c.xp, 0);
  for (const c of [...edits].reverse()) {
    if (editPenalty >= R.editPenaltyCap) break;
    const give = Math.min(R.editPenaltyCap - editPenalty, -c.xp);
    c.xp += give;
    editPenalty += give;
    if (give) c.reason += ' (capped per save)';
  }
  changes.push(...edits);
  for (const n of after) {
    if (!n.id) changes.push({ kind: 'task_added', module: moduleName, label: `Added ${n.title} to ${moduleName}`, xp: 0, reason: 'New commitment' });
  }
  return { changes, netXp: changes.reduce((s, c) => s + c.xp, 0) };
}

/** XP consequence of removing a module (also used for the old side of a replace). */
export function moduleRemovalChange(m: { name: string; createdAt: string; rewardXp: number }, now: Date, replacedBy?: string): RoutineChange {
  const est = isEstablished(m.createdAt, now);
  const R = XP_RULES.routine;
  const label = replacedBy ? `${m.name} replaced with ${replacedBy}` : `Removed module ${m.name}`;
  if (est) {
    return {
      kind: replacedBy ? 'module_replaced' : 'module_removed', module: m.name, label,
      xp: replacedBy ? R.moduleReplaced : R.moduleRemoved,
      reason: replacedBy ? 'An established module was replaced' : 'An established module was removed',
    };
  }
  return {
    kind: replacedBy ? 'module_replaced' : 'module_removed', module: m.name, label, xp: m.rewardXp ? -m.rewardXp : 0,
    reason: m.rewardXp ? 'Removed within 48 hours — the module reward is returned' : 'Setup period — no XP impact',
  };
}

export function modulePauseChange(m: { name: string; createdAt: string }, now: Date): RoutineChange {
  const est = isEstablished(m.createdAt, now);
  return {
    kind: 'frequency_changed', module: m.name, label: `Paused ${m.name}`, severity: 'major',
    xp: est ? XP_RULES.routine.majorChange : 0,
    reason: est ? 'Pausing an established module is a major change' : 'Setup period — no XP impact',
  };
}

export interface ModuleDraft {
  name: string;
  icon: string;
  goals: string[];
  tasks: ModuleTask[];
  suggestions: string[];
}

/** Validate an AI Module Builder proposal; invalid tasks are dropped. */
export function validateModuleDraft(raw: unknown): ModuleDraft | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const name = typeof o.name === 'string' ? o.name.trim().slice(0, 60) : '';
  if (!name || !Array.isArray(o.tasks)) return null;
  const tasks: ModuleTask[] = [];
  for (const t of o.tasks.slice(0, 30)) {
    const s = sanitizeModuleTask(t); // ids are kept; callers must check them against real tasks
    if (typeof s !== 'string') tasks.push(s);
  }
  if (!tasks.length) return null;
  const strings = (v: unknown, max: number) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').map(x => x.slice(0, 200)).slice(0, max) : []);
  const icon = typeof o.icon === 'string' && o.icon.trim() ? [...o.icon.trim()].slice(0, 2).join('') : '✨';
  return { name, icon, goals: strings(o.goals, 8), tasks, suggestions: strings(o.suggestions, 6) };
}

// ─── Onboarding AI suggestion validation ─────────────────────────────────

export interface RoutineSuggestion {
  modules: string[];
  schedule: Omit<RoutineItem, 'id' | 'createdAt'>[];
  suggestions: string[];
}

export function validateRoutineSuggestion(raw: unknown): RoutineSuggestion | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.schedule)) return null;
  const schedule: RoutineSuggestion['schedule'] = [];
  for (const s of o.schedule.slice(0, 40)) {
    if (!s || typeof s !== 'object') continue;
    const r = s as Record<string, unknown>;
    const time = typeof r.time === 'string' ? r.time.padStart(5, '0') : '';
    const title = typeof r.title === 'string' ? r.title.trim().slice(0, 80) : '';
    const module = typeof r.module === 'string' ? r.module.trim().slice(0, 40) : '';
    const durationMin = typeof r.durationMin === 'number' ? clamp(Math.round(r.durationMin), 5, 720) : 30;
    const days = Array.isArray(r.days) ? DAYS.filter(d => (r.days as unknown[]).includes(d)) : [];
    if (!TIME_RE.test(time) || !title || !module) continue;
    schedule.push({ time, title, module, durationMin, days: days.length ? days : [...DAYS] });
  }
  if (!schedule.length) return null;
  schedule.sort((a, b) => a.time.localeCompare(b.time));
  const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').map(x => x.slice(0, 200)).slice(0, 10) : []);
  return { modules: [...new Set(schedule.map(s => s.module))], schedule, suggestions: strings(o.suggestions) };
}
