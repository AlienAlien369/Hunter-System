/**
 * Pure unit tests for the Hunter rules engine (no server/DB needed).
 * Run with: npx tsx --test src/tests/rules.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  XP_RULES, diffRoutine, isEstablished, sanitizeRoutineItems, similarity, taskXp,
  unplannedXp, validateUnplannedAnalysis, validateRoutineSuggestion, RoutineItem, DAYS,
  diffModuleTasks, moduleRemovalChange, modulePauseChange, validateModuleDraft, sanitizeModuleTask, slugify, type ModuleTask,
} from '../rules.js';
import { calculateLevel } from '../progression.js';
import { toGeminiSchema, structuredCompletion } from '../ai.js';

const H = 3600_000;
const T0 = new Date('2026-09-01T10:00:00Z');
const at = (hours: number) => new Date(T0.getTime() + hours * H);
const ALL = [...DAYS];
const item = (id: string, module: string, title: string, time = '09:00', durationMin = 60, days = ALL, createdAt = T0.toISOString()): RoutineItem =>
  ({ id, module, title, time, durationMin, days, createdAt });
const base = [
  item('a', 'Deep Work', 'Deep Work', '09:00', 120),
  item('b', 'Reading', 'Read', '21:00', 30),
  item('c', 'Workout', 'Gym', '18:00', 60),
];
const diff = (after: RoutineItem[], hours: number, rewardedModules: string[] = []) =>
  diffRoutine(base, after, { now: at(hours), confirmedAt: T0.toISOString(), rewardedModules });

describe('grace period boundary (48h after creation, >= is established)', () => {
  it('is setup until exactly 48h, established at 48h', () => {
    assert.strictEqual(isEstablished(T0.toISOString(), at(0)), false);
    assert.strictEqual(isEstablished(T0.toISOString(), at(47.99)), false);
    assert.strictEqual(isEstablished(T0.toISOString(), at(48)), true);
  });

  it('changes inside the setup period have no XP impact', () => {
    const d = diff([base[0], base[2]], 47);
    assert.strictEqual(d.established, false);
    assert.strictEqual(d.netXp, 0);
    assert.strictEqual(d.changes[0].kind, 'module_removed');
  });
});

describe('routine diff after the setup period', () => {
  it('removing an established module applies the removal penalty', () => {
    const d = diff([base[0], base[2]], 72);
    assert.deepStrictEqual(d.changes.map(c => [c.kind, c.xp]), [['module_removed', XP_RULES.routine.moduleRemoved]]);
  });

  it('adding a module gives the reward once per module name', () => {
    const added = [...base, item('d', 'Content Creation', 'Film', '20:00', 60, ALL, at(72).toISOString())];
    const d = diff(added, 72);
    assert.strictEqual(d.netXp, XP_RULES.routine.moduleAdded);
    assert.deepStrictEqual(d.rewardModules, ['Content Creation']);
    assert.strictEqual(diff(added, 72, ['content creation']).netXp, 0);
  });

  it('remove + add in one save is a replacement, not a reward', () => {
    const d = diff([base[0], base[1], item('d', 'Content Creation', 'Film', '18:00', 60, ALL, at(72).toISOString())], 72);
    assert.deepStrictEqual(d.changes.map(c => [c.kind, c.xp]), [['module_replaced', XP_RULES.routine.moduleReplaced]]);
    assert.match(d.changes[0].label, /Workout replaced with Content Creation/);
  });

  it('removing a module added less than 48h ago is free', () => {
    const before = [...base, item('d', 'Content', 'Film', '20:00', 60, ALL, at(70).toISOString())];
    const d = diffRoutine(before, base, { now: at(72), confirmedAt: T0.toISOString(), rewardedModules: [] });
    assert.strictEqual(d.netXp, 0);
  });

  it('classifies minor vs major timing changes', () => {
    const minor = diff([{ ...base[0], time: '09:30' }, base[1], base[2]], 72);
    assert.strictEqual(minor.changes[0].severity, 'minor');
    assert.strictEqual(minor.netXp, XP_RULES.routine.minorChange);
    assert.match(minor.changes[0].detail!, /9:00 AM → 9:30 AM/);

    const major = diff([{ ...base[0], time: '10:00' }, base[1], base[2]], 72);
    assert.strictEqual(major.changes[0].severity, 'major');
    assert.strictEqual(major.netXp, XP_RULES.routine.majorChange);

    const freq = diff([{ ...base[0], days: ['MON', 'WED'] }, base[1], base[2]], 72);
    assert.strictEqual(freq.changes[0].kind, 'frequency_changed');
    assert.strictEqual(freq.changes[0].severity, 'major');
  });

  it('removing an established task inside a kept module is penalised; adding one is free', () => {
    const before = [...base, item('e', 'Deep Work', 'Review')];
    const removed = diffRoutine(before, base, { now: at(72), confirmedAt: T0.toISOString(), rewardedModules: [] });
    assert.strictEqual(removed.netXp, XP_RULES.routine.taskRemoved);
    const added = diff([...base, item('e', 'Deep Work', 'Review', '11:00', 30, ALL, at(72).toISOString())], 72);
    assert.deepStrictEqual(added.changes.map(c => [c.kind, c.xp]), [['task_added', 0]]);
  });

  it('caps time/duration/frequency penalties per save', () => {
    const many = Array.from({ length: 8 }, (_, i) => item(`x${i}`, 'Deep Work', `Block ${i}`, `0${i}:00`));
    const shifted = many.map(i => ({ ...i, time: `${String(parseInt(i.time) + 2).padStart(2, '0')}:00` }));
    const d = diffRoutine(many, shifted, { now: at(72), confirmedAt: T0.toISOString(), rewardedModules: [] });
    assert.strictEqual(d.netXp, XP_RULES.routine.editPenaltyCap);
  });

  it('no changes → no impact', () => {
    assert.deepStrictEqual(diff(base, 72).changes, []);
  });
});

describe('sanitizeRoutineItems', () => {
  it('keeps stored createdAt for existing ids and stamps new ids with now (client value ignored)', () => {
    const out = sanitizeRoutineItems(
      [{ ...base[0], createdAt: '2000-01-01T00:00:00Z' }, { id: 'n', module: 'M', title: 'T', time: '07:00', durationMin: 30, days: ['MON'], createdAt: '2000-01-01T00:00:00Z' }],
      base, at(100),
    ) as RoutineItem[];
    assert.strictEqual(out[0].createdAt, T0.toISOString());
    assert.strictEqual(out[1].createdAt, at(100).toISOString());
  });

  it('rejects invalid slots', () => {
    assert.match(sanitizeRoutineItems([{ id: 'a', module: 'M', title: 'T', time: '25:00', durationMin: 30, days: ALL }], [], T0) as string, /Invalid time/);
    assert.match(sanitizeRoutineItems([{ id: 'a', module: 'M', title: 'T', time: '07:00', durationMin: 30, days: [] }], [], T0) as string, /at least one day/);
  });
});

describe('XP engine', () => {
  it('derives task XP from difficulty only', () => {
    assert.deepStrictEqual([taskXp(1), taskXp(2), taskXp(3), taskXp(99)], [10, 20, 30, 30]);
  });

  it('scores unplanned work deterministically with caps', () => {
    const hard2h = { difficulty: 'hard' as const, estimatedMinutes: 120, goalRelevance: 1, trivial: false, meaningful: true };
    assert.strictEqual(unplannedXp(hard2h), 90);
    assert.strictEqual(unplannedXp({ ...hard2h, trivial: true }), XP_RULES.unplanned.trivialCap);
    assert.strictEqual(unplannedXp({ ...hard2h, estimatedMinutes: 900, difficulty: 'extreme' }), XP_RULES.unplanned.maxXp);
    assert.strictEqual(unplannedXp(hard2h, 1), 45); // repeat decay
    assert.ok(unplannedXp(hard2h, 10) <= 1);
  });
});

describe('AI output validation', () => {
  const good = { title: 'Debugged API', category: 'work', difficulty: 'hard', estimatedMinutes: 120, goalRelevance: 0.9, meaningful: true, trivial: false, duplicate: false, xpSuggestion: 80, reason: 'x' };
  it('accepts a well-formed analysis and clamps ranges', () => {
    const v = validateUnplannedAnalysis({ ...good, goalRelevance: 7, xpSuggestion: 9999 })!;
    assert.strictEqual(v.goalRelevance, 1);
    assert.strictEqual(v.xpSuggestion, 500);
  });
  it('rejects malformed output', () => {
    assert.strictEqual(validateUnplannedAnalysis(null), null);
    assert.strictEqual(validateUnplannedAnalysis({ ...good, difficulty: 'legendary' }), null);
    assert.strictEqual(validateUnplannedAnalysis({ ...good, estimatedMinutes: 5000 }), null);
    assert.strictEqual(validateUnplannedAnalysis({ ...good, meaningful: 'yes' }), null);
  });
  it('validates routine suggestions and drops bad slots', () => {
    const v = validateRoutineSuggestion({ schedule: [{ time: '6:15', title: 'Skincare', module: 'Skincare', durationMin: 15 }, { time: 'noon', title: 'x', module: 'y' }], suggestions: ['a'] })!;
    assert.strictEqual(v.schedule.length, 1);
    assert.strictEqual(v.schedule[0].time, '06:15');
    assert.strictEqual(validateRoutineSuggestion({ schedule: [] }), null);
  });
});

describe('module commitment rules', () => {
  const task = (id: string, over: Partial<ModuleTask> = {}): ModuleTask =>
    ({ id, title: id, difficulty: 1, scheduleTime: '07:00', timeOfDay: 'morning', recurrence: null, subtasks: [], createdAt: T0.toISOString(), ...over });
  const mdiff = (before: ModuleTask[], after: ModuleTask[], hours: number) => diffModuleTasks(before, after, { now: at(hours), moduleName: 'Skincare' });

  it('edits within 48h of a task are free; established edits are classified', () => {
    assert.strictEqual(mdiff([task('a')], [], 47).netXp, 0);
    assert.strictEqual(mdiff([task('a')], [], 48).netXp, XP_RULES.routine.taskRemoved);
    assert.strictEqual(mdiff([task('a')], [task('a', { scheduleTime: '07:30' })], 72).netXp, XP_RULES.routine.minorChange);
    assert.strictEqual(mdiff([task('a')], [task('a', { scheduleTime: '09:00' })], 72).netXp, XP_RULES.routine.majorChange);
    assert.strictEqual(mdiff([task('a')], [task('a', { recurrence: ['MON'] })], 72).netXp, XP_RULES.routine.majorChange);
    assert.strictEqual(mdiff([task('a')], [task('a', { difficulty: 2 })], 72).netXp, XP_RULES.routine.minorChange);
  });

  it('title and subtask edits are cosmetic; new tasks are free', () => {
    assert.deepStrictEqual(mdiff([task('a')], [task('a', { title: 'Gentle cleanser', subtasks: ['x'] })], 72).changes, []);
    const d = mdiff([task('a')], [task('a'), { ...task('b'), id: undefined }], 72);
    assert.deepStrictEqual(d.changes.map(c => [c.kind, c.xp]), [['task_added', 0]]);
  });

  it('caps edit penalties per save', () => {
    const many = Array.from({ length: 8 }, (_, i) => task(`t${i}`));
    assert.strictEqual(mdiff(many, many.map(t => ({ ...t, recurrence: ['MON' as const] })), 72).netXp, XP_RULES.routine.editPenaltyCap);
  });

  it('module removal: refund inside grace, penalty after; replace and pause', () => {
    const m = { name: 'Reading', createdAt: T0.toISOString(), rewardXp: 15 };
    assert.strictEqual(moduleRemovalChange(m, at(10)).xp, -15);
    assert.strictEqual(moduleRemovalChange({ ...m, rewardXp: 0 }, at(10)).xp, 0);
    assert.strictEqual(moduleRemovalChange(m, at(48)).xp, XP_RULES.routine.moduleRemoved);
    const r = moduleRemovalChange(m, at(72), 'Content Creation');
    assert.strictEqual(r.kind, 'module_replaced');
    assert.strictEqual(r.xp, XP_RULES.routine.moduleReplaced);
    assert.strictEqual(modulePauseChange(m, at(10)).xp, 0);
    assert.strictEqual(modulePauseChange(m, at(72)).xp, XP_RULES.routine.majorChange);
  });

  it('validates AI module drafts and task specs', () => {
    const d = validateModuleDraft({ name: 'Skincare', icon: '🧴🧴🧴', goals: ['Clear skin'], tasks: [
      { title: 'Cleanser', difficulty: 1, timeOfDay: 'morning', scheduleTime: '07:00' },
      { title: '', difficulty: 1 }, // dropped
      { title: 'Retinol', difficulty: 2, timeOfDay: 'evening', recurrence: ['MON', 'WED', 'FRI'], subtasks: ['Pea-sized amount'] },
    ] })!;
    assert.strictEqual(d.tasks.length, 2);
    assert.deepStrictEqual(d.tasks[1].recurrence, ['MON', 'WED', 'FRI']);
    assert.strictEqual([...d.icon].length, 2);
    assert.strictEqual(validateModuleDraft({ name: 'x', tasks: [] }), null);
    assert.match(sanitizeModuleTask({ title: 'x', difficulty: 5 }) as string, /Difficulty/);
    assert.strictEqual((sanitizeModuleTask({ title: 'x', recurrence: [...DAYS] }) as ModuleTask).recurrence, null);
    assert.strictEqual(slugify('Content Creation!'), 'content-creation');
  });
});

describe('Gemini schema conversion', () => {
  it('uppercases types, keeps string enums and drops non-string enums', () => {
    const out = toGeminiSchema({
      type: 'object',
      properties: {
        difficulty: { type: 'string', enum: ['easy', 'hard'] },
        level: { type: 'integer', enum: [1, 2, 3] },
        tasks: { type: 'array', items: { type: 'object', properties: { title: { type: 'string', description: 'd' } }, required: ['title'] } },
      },
      required: ['difficulty'],
    });
    assert.deepStrictEqual(out, {
      type: 'OBJECT',
      required: ['difficulty'],
      properties: {
        difficulty: { type: 'STRING', enum: ['easy', 'hard'] },
        level: { type: 'INTEGER' },
        tasks: { type: 'ARRAY', items: { type: 'OBJECT', required: ['title'], properties: { title: { type: 'STRING', description: 'd' } } } },
      },
    });
  });
});

describe('Gemini provider', () => {
  it('skips a retired model (404) and parses the next model\'s JSON, ignoring thought parts', async () => {
    const saved = { fetch: globalThis.fetch, a: process.env.ANTHROPIC_API_KEY, g: process.env.GOOGLE_API_KEY, m: process.env.GEMINI_MODEL };
    delete process.env.ANTHROPIC_API_KEY;
    process.env.GOOGLE_API_KEY = 'test-key';
    process.env.GEMINI_MODEL = 'gemini-2.5-flash';
    const urls: string[] = [];
    globalThis.fetch = (async (url: string) => {
      urls.push(url);
      if (url.includes('gemini-2.5-flash')) return new Response('{"error":{"code":404}}', { status: 404 });
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'thinking…', thought: true }, { text: '{"a":"ok"}' }] } }] }), { status: 200 });
    }) as typeof fetch;
    try {
      const out = await structuredCompletion({ system: 's', prompt: 'p', toolName: 't', schema: { type: 'object', properties: { a: { type: 'string' } } } });
      assert.deepStrictEqual(out, { a: 'ok' });
      assert.match(urls[0], /gemini-2\.5-flash/);
      assert.match(urls[1], /gemini-3\.8-flash/);
    } finally {
      globalThis.fetch = saved.fetch;
      for (const [k, v] of [['ANTHROPIC_API_KEY', saved.a], ['GOOGLE_API_KEY', saved.g], ['GEMINI_MODEL', saved.m]] as const) {
        if (v === undefined) delete process.env[k]; else process.env[k] = v;
      }
    }
  });
});

describe('similarity & level floor', () => {
  it('detects near-duplicates but not unrelated text', () => {
    assert.ok(similarity('Drank water', 'drank water!') >= 0.99);
    assert.ok(similarity('Researched 15 badminton video ideas', 'Research badminton video ideas') >= 0.6);
    assert.ok(similarity('Debugged production API', 'Morning skincare routine') < 0.2);
  });
  it('level never drops below 1, even with negative XP', () => {
    assert.strictEqual(calculateLevel(-55), 1);
    assert.strictEqual(calculateLevel(-100000), 1);
    assert.strictEqual(calculateLevel(0), 1);
    assert.strictEqual(calculateLevel(1000), 2);
  });
});
