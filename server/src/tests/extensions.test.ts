/**
 * Integration tests for the Hunter extensions: custom module tasks (skincare,
 * content), content channels, the routine contract (grace period, penalties,
 * negative XP), unplanned activities (manual fallback path) and isolation.
 * Requires the server running on localhost:3000 and DB env vars (the DB is
 * used only to backdate a routine past its 48h setup period).
 * Run with: node --test src/tests/extensions.test.ts
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import pg from 'pg';

const BASE_URL = 'http://localhost:3000';
const db = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'hunter',
  password: process.env.DB_PASSWORD || 'hunterpass',
  database: process.env.DB_NAME || 'hunter_system',
});

async function register(username: string, invite?: string) {
  const res = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: 'ExtPass123!', invite }),
  });
  assert.strictEqual(res.status, 201);
  const cookie = (res.headers.get('set-cookie') || '').split(';')[0];
  const me = await (await fetch(`${BASE_URL}/api/auth/me`, { headers: { Cookie: cookie } })).json();
  return { cookie, id: me.user.id as number };
}

function client(cookie: string) {
  const call = async (method: string, path: string, body?: unknown) => {
    const res = await fetch(`${BASE_URL}/api${path}`, {
      method,
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  return {
    get: (p: string) => call('GET', p),
    post: (p: string, b?: unknown) => call('POST', p, b ?? {}),
    patch: (p: string, b?: unknown) => call('PATCH', p, b ?? {}),
    put: (p: string, b?: unknown) => call('PUT', p, b ?? {}),
    del: (p: string) => call('DELETE', p),
    xp: async () => (await call('GET', '/auth/me')).body.user as { xp: number; level: number },
  };
}

const ALL_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const todayCode = ALL_DAYS[(new Date(new Date().toISOString().split('T')[0]).getUTCDay() + 6) % 7];
const slot = (id: string, module: string, time = '09:00', durationMin = 60) => ({ id, module, title: module, time, durationMin, days: ALL_DAYS });

describe('Hunter extensions', () => {
  const suffix = Date.now();
  let A: ReturnType<typeof client>;
  let B: ReturnType<typeof client>;
  let aId: number;

  before(async () => {
    const a = await register('ext_a_' + suffix);
    const b = await register('ext_b_' + suffix);
    A = client(a.cookie);
    B = client(b.cookie);
    aId = a.id;
    // Tasks live in modules: A gets Skincare + Content Creation modules.
    assert.strictEqual((await A.post('/modules', { name: 'Skincare', icon: '🧴', acknowledged: true })).status, 201);
    assert.strictEqual((await A.post('/modules', { name: 'Content Creation', kind: 'content', acknowledged: true })).status, 201);
  });
  after(() => db.end());

  describe('skincare tasks (custom module tasks)', () => {
    let questId: string;

    it('creates a task with server-derived XP (client xp ignored)', async () => {
      const r = await A.post('/quests/custom', { title: 'Cleanser', module: 'skincare', difficulty: 1, timeOfDay: 'morning', scheduleTime: '07:00', xp_reward: 9999 });
      assert.strictEqual(r.status, 201);
      assert.match(r.body.quest_id, /^CQ-\d+$/);
      assert.strictEqual(r.body.xp_reward, 10);
      assert.strictEqual(r.body.category, 'skincare');
      questId = r.body.quest_id;
    });

    it('is visible only to its owner', async () => {
      const mine = (await A.get('/quests')).body;
      const theirs = (await B.get('/quests')).body;
      assert.ok(mine.some((q: any) => q.quest_id === questId));
      assert.ok(!theirs.some((q: any) => q.quest_id === questId));
      assert.strictEqual((await B.get(`/quests/${questId}`)).status, 404);
    });

    it('edits difficulty and recalculates XP', async () => {
      const r = await A.patch(`/quests/custom/${questId}`, { difficulty: 2, title: 'Gentle Cleanser' });
      assert.strictEqual(r.status, 200);
      assert.strictEqual(r.body.xp_reward, 20);
    });

    it('completes through the existing quest flow, awards XP, and counts toward the module streak', async () => {
      const before = (await A.xp()).xp;
      const r = await A.patch(`/quests/${questId}/complete`);
      assert.strictEqual(r.body.action, 'completed');
      assert.strictEqual(r.body.xpGained, 20);
      assert.strictEqual((await A.xp()).xp, before + 20);
      const summary = (await A.get('/quests/modules/skincare/summary')).body;
      assert.strictEqual(summary.completedToday, 1);
      assert.strictEqual(summary.streak, 1);
      assert.strictEqual(summary.xpEarned, 20);
      const log = (await A.get('/activity?limit=5')).body;
      assert.ok(log.some((e: any) => e.action === 'quest_complete' && e.entity === questId && e.details.xp === 20));
    });

    it('other users cannot complete, edit or delete it', async () => {
      assert.strictEqual((await B.patch(`/quests/${questId}/complete`)).status, 404);
      assert.strictEqual((await B.patch(`/quests/custom/${questId}`, { title: 'hacked' })).status, 404);
      assert.strictEqual((await B.del(`/quests/custom/${questId}`)).status, 404);
    });

    it('respects recurrence: cannot complete on a non-scheduled day', async () => {
      const other = ALL_DAYS.filter(d => d !== todayCode);
      const r = await A.post('/quests/custom', { title: 'Retinol', module: 'skincare', difficulty: 1, timeOfDay: 'evening', recurrence: other });
      assert.deepStrictEqual(r.body.recurrence, other);
      const c = await A.patch(`/quests/${r.body.quest_id}/complete`);
      assert.strictEqual(c.status, 400);
    });

    it('deletes (archives) the task; it disappears from the list', async () => {
      assert.strictEqual((await A.del(`/quests/custom/${questId}`)).status, 200);
      assert.ok(!(await A.get('/quests')).body.some((q: any) => q.quest_id === questId));
    });

    it('rejects invalid input', async () => {
      assert.strictEqual((await A.post('/quests/custom', { title: '', module: 'skincare' })).status, 400);
      assert.strictEqual((await A.post('/quests/custom', { title: 'x', module: 'hidden' })).status, 400);
      assert.strictEqual((await A.post('/quests/custom', { title: 'x', module: 'skincare', difficulty: 7 })).status, 400);
    });
  });

  describe('content channels & content tasks', () => {
    let channelId: number;

    it('adds, edits and lists channels with an open platform list', async () => {
      const r = await A.post('/content/channels', { name: 'Badminton Instagram #1', platform: 'Instagram', category: 'Badminton', postingFrequency: '3x/week', targetPerWeek: 3 });
      assert.strictEqual(r.status, 201);
      assert.strictEqual(r.body.platform, 'instagram');
      channelId = r.body.id;
      const other = await A.post('/content/channels', { name: 'Threads', platform: 'threads', targetPerWeek: 1 });
      assert.strictEqual(other.status, 201, 'new platforms need no schema change');
      const e = await A.patch(`/content/channels/${channelId}`, { targetPerWeek: 4 });
      assert.strictEqual(e.body.target_per_week, 4);
      assert.strictEqual((await A.get('/content/channels')).body.length, 2);
    });

    it('isolates channels between users', async () => {
      assert.strictEqual((await B.get('/content/channels')).body.length, 0);
      assert.strictEqual((await B.patch(`/content/channels/${channelId}`, { name: 'x' })).status, 404);
      assert.strictEqual((await B.del(`/content/channels/${channelId}`)).status, 404);
      // B cannot attach a task to A's channel
      const t = await B.post('/quests/custom', { title: 'x', module: 'content', metadata: { channelId, stage: 'research' } });
      assert.strictEqual(t.status, 400);
    });

    it('content task completion awards XP and counts toward weekly progress', async () => {
      const t = await A.post('/quests/custom', { title: 'Publish reel', module: 'content', difficulty: 2, metadata: { channelId, stage: 'publishing' } });
      assert.strictEqual(t.status, 201);
      const c = await A.patch(`/quests/${t.body.quest_id}/complete`);
      assert.strictEqual(c.body.xpGained, 20);
      const progress = (await A.get('/content/progress')).body.find((p: any) => p.id === channelId);
      assert.strictEqual(progress.published, 1);
    });

    it('deleting a channel archives its tasks', async () => {
      assert.strictEqual((await A.del(`/content/channels/${channelId}`)).status, 200);
      const quests = (await A.get('/quests')).body;
      assert.ok(!quests.some((q: any) => q.metadata?.channelId === channelId));
    });
  });

  describe('routine contract', () => {
    const initial = [slot('s1', 'Deep Work', '09:00', 120), slot('s2', 'Reading', '21:00', 30), slot('s3', 'Workout', '18:00')];

    it('requires acknowledging the rules before the first confirmation', async () => {
      assert.strictEqual((await A.put('/routine', { items: initial })).status, 400);
      const r = await A.put('/routine', { items: initial, acknowledged: true, timezone: 'Asia/Kolkata' });
      assert.strictEqual(r.status, 200);
      assert.strictEqual(r.body.routine.established, false);
      assert.ok(r.body.routine.graceEndsAt);
    });

    it('the Quest Log follows the timetable: one daily quest per slot', async () => {
      const q = (await A.get('/quests')).body.filter((x: any) => x.category === 'routine');
      assert.deepStrictEqual(q.map((x: any) => x.title).sort(), ['Deep Work', 'Reading', 'Workout']);
      const deep = q.find((x: any) => x.title === 'Deep Work');
      assert.strictEqual(deep.schedule_time, '09:00');
      assert.strictEqual(deep.xp_reward, 30, '120-minute slot → hard');
      assert.strictEqual(q.find((x: any) => x.title === 'Reading').xp_reward, 10, '30-minute slot → easy');
      // Completing a timetable quest uses the normal quest/XP flow
      const before = (await A.xp()).xp;
      assert.strictEqual((await A.patch(`/quests/${deep.quest_id}/complete`)).body.xpGained, 30);
      assert.strictEqual((await A.xp()).xp, before + 30);
      await A.patch(`/quests/${deep.quest_id}/complete`); // undo
      // Timetable quests can only be changed through the timetable
      assert.strictEqual((await A.patch(`/quests/custom/${deep.quest_id}`, { title: 'x' })).status, 400);
      assert.strictEqual((await A.del(`/quests/custom/${deep.quest_id}`)).status, 400);
      assert.ok(!(await B.get('/quests')).body.some((x: any) => x.category === 'routine'));
    });

    it('edits during the 48h setup period are free', async () => {
      const before = (await A.xp()).xp;
      const p = (await A.post('/routine/preview', { items: [initial[0], initial[2]] })).body;
      assert.strictEqual(p.netXp, 0);
      assert.strictEqual(p.established, false);
      await A.put('/routine', { items: initial });
      assert.strictEqual((await A.xp()).xp, before);
    });

    it('after 48h: removal penalty can take XP negative, level stays 1, history records it', async () => {
      await db.query(
        `UPDATE routines SET confirmed_at = confirmed_at - INTERVAL '72 hours',
           items = (SELECT jsonb_agg(i || jsonb_build_object('createdAt', to_char((NOW() - INTERVAL '72 hours') AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))) FROM jsonb_array_elements(items) i)
         WHERE user_id = $1`,
        [aId]
      );
      // Start from a known balance: A currently has quest XP; neutralise to 20.
      const cur = (await A.xp()).xp;
      await db.query('UPDATE users SET xp = 20 WHERE id = $1', [aId]);

      const items = [initial[0], initial[2]]; // remove Reading
      const p = (await A.post('/routine/preview', { items })).body;
      assert.strictEqual(p.established, true);
      assert.strictEqual(p.netXp, -75);
      assert.strictEqual(p.newXp, -55);

      // Must confirm the exact impact that was shown
      assert.strictEqual((await A.put('/routine', { items })).status, 409);
      assert.strictEqual((await A.put('/routine', { items, expectedNetXp: -10 })).status, 409);
      const r = await A.put('/routine', { items, expectedNetXp: -75 });
      assert.strictEqual(r.status, 200);
      const me = await A.xp();
      assert.strictEqual(me.xp, -55);
      assert.strictEqual(me.level, 1);
      // Removed slot → its quest leaves the Quest Log
      const titles = (await A.get('/quests')).body.filter((x: any) => x.category === 'routine').map((x: any) => x.title).sort();
      assert.deepStrictEqual(titles, ['Deep Work', 'Workout']);

      const history = (await A.get('/routine/history')).body;
      assert.ok(history.some((h: any) => h.action === 'routine_change' && h.details.xp === -75 && /Reading/.test(h.details.label)));
      assert.ok(cur >= 0);
    });

    it('complete → undo at negative XP reverses exactly (no XP minted)', async () => {
      await A.patch('/quests/DQ-02/complete');
      assert.strictEqual((await A.xp()).xp, -45);
      await A.patch('/quests/DQ-02/complete');
      assert.strictEqual((await A.xp()).xp, -55);
    });

    it('replace, add (+15 once), minor and major changes', async () => {
      const cur = [slot('s1', 'Deep Work', '09:00', 120), slot('s3', 'Workout', '18:00')];
      // Replace Workout with Content Creation
      const replaced = [cur[0], slot('s4', 'Content Creation', '18:00')];
      let p = (await A.post('/routine/preview', { items: replaced })).body;
      assert.deepStrictEqual(p.changes.map((c: any) => [c.kind, c.xp]), [['module_replaced', -75]]);

      // Add a module → +15, only once per module name
      const added = [...cur, slot('s5', 'Skincare', '07:00', 15)];
      p = (await A.post('/routine/preview', { items: added })).body;
      assert.strictEqual(p.netXp, 15);
      await A.put('/routine', { items: added, expectedNetXp: 15 });
      await A.put('/routine', { items: cur }); // removing a <48h-old module is free
      p = (await A.post('/routine/preview', { items: added })).body;
      assert.strictEqual(p.netXp, 0, 'module reward is not farmable');

      // Minor (30 min) vs major (2h) shift of an established slot
      p = (await A.post('/routine/preview', { items: [{ ...cur[0], time: '09:30' }, cur[1]] })).body;
      assert.strictEqual(p.netXp, -10);
      p = (await A.post('/routine/preview', { items: [{ ...cur[0], time: '11:00' }, cur[1]] })).body;
      assert.strictEqual(p.netXp, -25);
    });

    it('client cannot fake a slot as new to dodge penalties', async () => {
      const cur = (await A.get('/routine')).body.routine.items;
      const faked = cur.map((i: any) => ({ ...i, createdAt: new Date().toISOString(), time: i.time === '09:00' ? '11:00' : i.time }));
      const p = (await A.post('/routine/preview', { items: faked })).body;
      assert.strictEqual(p.netXp, -25);
    });

    it('routine is isolated per user', async () => {
      assert.strictEqual((await B.get('/routine')).body.routine, null);
    });
  });

  describe('dynamic modules & the 2-day module commitment', () => {
    let C: ReturnType<typeof client>;
    let cId: number;
    let readingId: number;
    const backdate = async (slug: string) => {
      await db.query(`UPDATE user_modules SET created_at = NOW() - INTERVAL '72 hours' WHERE user_id = $1 AND slug = $2`, [cId, slug]);
      await db.query(`UPDATE quests SET created_at = NOW() - INTERVAL '72 hours' WHERE user_id = $1 AND category = $2`, [cId, slug]);
    };
    const tasksOf = async (slug: string) => (await C.get('/quests')).body.filter((q: any) => q.category === slug);

    before(async () => {
      const c = await register('ext_c_' + suffix);
      C = client(c.cookie);
      cId = c.id;
    });

    it('requires acknowledging the 2-day rule; adding a module gives +15 XP', async () => {
      const body = { name: 'Reading', icon: '📖', goals: ['Read 12 books this year'], tasks: [
        { title: 'Read 20 pages', difficulty: 2, scheduleTime: '21:00', timeOfDay: 'evening' },
        { title: 'Write notes', difficulty: 1, recurrence: ['SUN'], subtasks: ['3 key ideas'] },
      ] };
      assert.strictEqual((await C.post('/modules', body)).status, 400);
      const r = await C.post('/modules', { ...body, acknowledged: true });
      assert.strictEqual(r.status, 201);
      assert.strictEqual(r.body.module.slug, 'reading');
      assert.strictEqual(r.body.module.established, false);
      assert.strictEqual(r.body.xp, 15);
      readingId = r.body.module.id;
      const tasks = await tasksOf('reading');
      assert.strictEqual(tasks.length, 2);
      assert.deepStrictEqual(tasks.find((t: any) => t.title === 'Write notes').metadata.subtasks, ['3 key ideas']);
      const history = (await C.get('/modules/history')).body;
      assert.ok(history.some((h: any) => h.details.kind === 'module_added' && h.details.xp === 15));
    });

    it('supports unlimited custom modules, unique slugs, and one content module', async () => {
      assert.strictEqual((await C.post('/modules', { name: 'Reading', acknowledged: true })).body.module.slug, 'reading-2');
      assert.strictEqual((await C.post('/modules', { name: 'Content Creation', kind: 'content', acknowledged: true, channels: [{ name: 'Badminton YouTube #1', platform: 'youtube', targetPerWeek: 1 }] })).status, 201);
      assert.strictEqual((await C.get('/content/channels')).body.length, 1);
      assert.strictEqual((await C.post('/modules', { name: 'More content', kind: 'content', acknowledged: true })).status, 409);
      assert.strictEqual((await C.post('/modules', { name: 'x', kind: 'rocket', acknowledged: true })).status, 400);
    });

    it('within 48h: task edits are free and removing the module returns its reward', async () => {
      const r2 = (await C.get('/modules')).body.find((m: any) => m.slug === 'reading-2');
      const before = (await C.xp()).xp;
      const put = await C.put(`/modules/${r2.id}/tasks`, { tasks: [{ title: 'Audiobook', difficulty: 1 }] });
      assert.strictEqual(put.body.netXp, 0);
      const del = await C.del(`/modules/${r2.id}`);
      assert.strictEqual(del.status, 409, 'refund must be confirmed');
      assert.strictEqual(del.body.netXp, -15);
      assert.strictEqual((await C.del(`/modules/${r2.id}?expectedXp=-15`)).status, 200);
      assert.strictEqual((await C.xp()).xp, before - 15);
    });

    it('after 48h: removing, changing and deleting established tasks needs confirmation and costs XP', async () => {
      await backdate('reading');
      const [read, notes] = (await tasksOf('reading')).sort((a: any, b: any) => a.title.localeCompare(b.title));
      let xp = (await C.xp()).xp;

      const minor = await C.patch(`/quests/custom/${read.quest_id}`, { scheduleTime: '21:30' });
      assert.strictEqual(minor.status, 409);
      assert.strictEqual(minor.body.requiresConfirmation, true);
      assert.strictEqual(minor.body.netXp, -10);
      assert.strictEqual(minor.body.newXp, xp - 10);
      assert.strictEqual((await C.patch(`/quests/custom/${read.quest_id}`, { scheduleTime: '21:30', expectedXp: -10 })).status, 200);
      assert.strictEqual((await C.xp()).xp, (xp -= 10));

      // Cosmetic rename is free
      assert.strictEqual((await C.patch(`/quests/custom/${read.quest_id}`, { title: 'Read 25 pages' })).status, 200);

      // Bulk editor: frequency change (major) + delete established task (-20)
      const reading = { id: readingId };
      const tasks = [{ id: read.quest_id, title: 'Read 25 pages', difficulty: 2, scheduleTime: '21:30', timeOfDay: 'evening', recurrence: ['MON', 'TUE', 'WED'] }];
      const p = await C.put(`/modules/${reading.id}/tasks`, { tasks });
      assert.strictEqual(p.status, 409);
      assert.deepStrictEqual(p.body.changes.map((c: any) => [c.kind, c.xp]).sort(), [['frequency_changed', -25], ['task_removed', -20]]);
      assert.strictEqual((await C.put(`/modules/${reading.id}/tasks`, { tasks, expectedXp: -45 })).status, 200);
      assert.strictEqual((await C.xp()).xp, (xp -= 45));
      assert.ok(!(await tasksOf('reading')).some((t: any) => t.quest_id === notes.quest_id));
    });

    it('pausing an established module costs XP, blocks completion, and resuming is free', async () => {
      await db.query(`UPDATE users SET xp = 20 WHERE id = $1`, [cId]);
      const pause = await C.patch(`/modules/${readingId}`, { status: 'paused' });
      assert.strictEqual(pause.status, 409);
      assert.strictEqual((await C.patch(`/modules/${readingId}`, { status: 'paused', expectedXp: -25 })).status, 200);
      const me = await C.xp();
      assert.strictEqual(me.xp, -5, 'XP may go negative');
      assert.strictEqual(me.level, 1, 'level never drops below 1');
      const [task] = await tasksOf('reading');
      assert.strictEqual((await C.patch(`/quests/${task.quest_id}/complete`)).status, 400);
      assert.strictEqual((await C.patch(`/modules/${readingId}`, { status: 'active', name: 'Deep Reading' })).status, 200);
      assert.strictEqual((await C.xp()).xp, -5);
    });

    it('replacing an established module costs -75 and gives no add reward', async () => {
      const before = (await C.xp()).xp;
      const r = await C.post('/modules', { name: 'Fitness', icon: '💪', acknowledged: true, replaceModuleId: readingId, tasks: [{ title: 'Workout', difficulty: 3 }] });
      assert.strictEqual(r.status, 409);
      assert.strictEqual(r.body.changes[0].kind, 'module_replaced');
      const ok = await C.post('/modules', { name: 'Fitness', icon: '💪', acknowledged: true, replaceModuleId: readingId, expectedXp: -75, tasks: [{ title: 'Workout', difficulty: 3 }] });
      assert.strictEqual(ok.status, 201);
      assert.strictEqual((await C.xp()).xp, before - 75);
      const mods = (await C.get('/modules')).body.map((m: any) => m.slug);
      assert.ok(mods.includes('fitness') && !mods.includes('reading'));
      assert.strictEqual((await tasksOf('reading')).length, 0);
    });

    it('removing an established module costs -75; history explains every change', async () => {
      await backdate('fitness');
      const fit = (await C.get('/modules')).body.find((m: any) => m.slug === 'fitness');
      assert.strictEqual((await C.del(`/modules/${fit.id}`)).body.netXp, -75);
      assert.strictEqual((await C.del(`/modules/${fit.id}?expectedXp=-75`)).status, 200);
      const kinds = (await C.get('/modules/history')).body.map((h: any) => h.details.kind);
      for (const k of ['module_added', 'module_removed', 'module_replaced', 'task_removed', 'frequency_changed', 'time_changed']) {
        assert.ok(kinds.includes(k), `history has ${k}`);
      }
    });

    it('modules are isolated per user', async () => {
      const content = (await C.get('/modules')).body.find((m: any) => m.kind === 'content');
      assert.strictEqual((await B.patch(`/modules/${content.id}`, { name: 'x' })).status, 404);
      assert.strictEqual((await B.put(`/modules/${content.id}/tasks`, { tasks: [] })).status, 404);
      assert.strictEqual((await B.del(`/modules/${content.id}`)).status, 404);
      assert.ok(!(await B.get('/modules')).body.some((m: any) => m.id === content.id));
      assert.strictEqual((await B.post('/quests/custom', { title: 'x', module: 'content' })).status, 400);
    });

    it('AI Module Builder degrades gracefully without AI', async () => {
      const r = await C.post('/modules/ai/draft', { prompt: 'Create a skincare module for my morning and night routine' });
      if (r.status === 200) assert.ok(Array.isArray(r.body.tasks)); // AI configured locally
      else assert.strictEqual(r.status, 503);
    });
  });

  describe('leaderboard', () => {
    let L1: ReturnType<typeof client>;
    let L2: ReturnType<typeof client>;
    const n1 = 'Lead' + String(suffix).slice(-6);
    const n2 = 'Chase' + String(suffix).slice(-6);

    before(async () => {
      L1 = client((await register('ext_l1_' + suffix)).cookie);
      L2 = client((await register('ext_l2_' + suffix)).cookie);
      assert.strictEqual((await L1.post('/auth/set-name', { name: n1 })).status, 200);
      assert.strictEqual((await L2.post('/auth/set-name', { name: n2 })).status, 200);
      await L1.patch('/quests/DQ-03/complete'); // 25 XP
      await L1.patch('/quests/DQ-01/complete'); // 10 XP
      await L2.patch('/quests/DQ-01/complete'); // 10 XP
    });

    it("ranks this week's earned XP by Hunter name only", async () => {
      const r = (await L2.get('/leaderboard?period=week')).body;
      // Only the top 50 are listed (a reused test DB may push n2 out), so check n2 via `me`.
      const lead = r.entries.find((e: any) => e.name === n1);
      assert.strictEqual(lead.score, 35);
      const chase = r.entries.find((e: any) => e.name === n2);
      if (chase) assert.strictEqual(chase.isMe, true);
      assert.strictEqual(r.me.score, 10);
      assert.ok(lead.position < r.me.position);
      assert.ok(r.entries.every((e: any) => !('username' in e) && !('id' in e)), 'no usernames or ids leak');
    });

    it('excludes hunters without a chosen name (e.g. user A)', async () => {
      const r = (await A.get('/leaderboard?period=all')).body;
      assert.strictEqual(r.me.nameSet, false);
      assert.strictEqual(r.me.position, null);
    });

    it('lets hunters opt out and back in', async () => {
      assert.strictEqual((await L1.patch('/leaderboard/visibility', { visible: false })).status, 200);
      let r = (await L2.get('/leaderboard?period=week')).body;
      assert.ok(!r.entries.some((e: any) => e.name === n1));
      assert.strictEqual((await L1.get('/leaderboard?period=week')).body.me.position, null);
      assert.strictEqual((await L1.patch('/leaderboard/visibility', { visible: 'no' })).status, 400);
      await L1.patch('/leaderboard/visibility', { visible: true });
      r = (await L2.get('/leaderboard?period=week')).body;
      assert.ok(r.entries.some((e: any) => e.name === n1));
    });
  });

  describe('weekly coach', () => {
    it('generates a grounded review (rules fallback without AI), caches it, and rate-limits refreshes', async () => {
      const C2 = client((await register('ext_coach_' + suffix)).cookie);
      await C2.patch('/quests/DQ-03/complete');
      const before = (await C2.get('/coach/weekly')).body;
      assert.strictEqual(before.review, null);
      assert.strictEqual(before.stats.completions, 1);
      const gen = await C2.post('/coach/weekly');
      assert.strictEqual(gen.status, 200);
      assert.ok(gen.body.review.headline);
      assert.ok(gen.body.review.wins.length && gen.body.review.focus.length && gen.body.review.nextWeek.length);
      assert.strictEqual((await C2.get('/coach/weekly')).body.review.headline, gen.body.review.headline, 'cached');
      await C2.post('/coach/weekly');
      await C2.post('/coach/weekly');
      assert.strictEqual((await C2.post('/coach/weekly')).status, 429);
      assert.strictEqual((await B.get('/coach/weekly')).body.review, null, 'reviews are per user');
    });
  });

  describe('account: change password & delete account', () => {
    const uname = 'ext_acct_' + suffix;
    const login = (password: string) => fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: uname, password }),
    });
    let U: ReturnType<typeof client>;
    let uId: number;

    before(async () => {
      const r = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: uname, password: 'OldPass123!' }),
      });
      const cookie = (r.headers.get('set-cookie') || '').split(';')[0];
      U = client(cookie);
      uId = (await U.get('/auth/me')).body.user.id;
      await U.patch('/quests/DQ-01/complete');
      await U.post('/modules', { name: 'Reading', acknowledged: true, tasks: [{ title: 'Read', difficulty: 1 }] });
    });

    it('changes the password only with the correct current password', async () => {
      assert.strictEqual((await U.post('/auth/change-password', { currentPassword: 'wrong', newPassword: 'NewPass123!' })).status, 401);
      assert.strictEqual((await U.post('/auth/change-password', { currentPassword: 'OldPass123!', newPassword: '123' })).status, 400);
      assert.strictEqual((await U.post('/auth/change-password', { currentPassword: 'OldPass123!', newPassword: 'NewPass123!' })).status, 200);
      assert.strictEqual((await login('OldPass123!')).status, 401);
      assert.strictEqual((await login('NewPass123!')).status, 200);
    });

    it('deletes the account and all its data after password + username confirmation', async () => {
      assert.strictEqual((await U.del('/auth/account')).status, 401);
      const wrongConfirm = await fetch(`${BASE_URL}/api/auth/account`, {
        method: 'DELETE', headers: { Cookie: await loginCookie(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'NewPass123!', confirm: 'nope' }),
      });
      assert.strictEqual(wrongConfirm.status, 400);
      const res = await fetch(`${BASE_URL}/api/auth/account`, {
        method: 'DELETE', headers: { Cookie: (await loginCookie()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'NewPass123!', confirm: uname }),
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual((await login('NewPass123!')).status, 401);
      const left = await db.query(
        `SELECT (SELECT COUNT(*) FROM users WHERE id = $1) + (SELECT COUNT(*) FROM quest_completions WHERE user_id = $1)
              + (SELECT COUNT(*) FROM user_modules WHERE user_id = $1) + (SELECT COUNT(*) FROM activity_log WHERE user_id = $1) AS n`,
        [uId],
      );
      assert.strictEqual(Number(left.rows[0].n), 0);
    });

    async function loginCookie() {
      const r = await login('NewPass123!');
      return (r.headers.get('set-cookie') || '').split(';')[0];
    }
  });

  describe('hunter initiation checklist', () => {
    it('tracks real progress and pays the bonus exactly once', async () => {
      const N = client((await register('ext_init_' + suffix)).cookie);
      let o = (await N.get('/onboarding')).body;
      assert.deepStrictEqual(o.steps.map((s: any) => s.done), [false, false, false, false, false]);
      assert.strictEqual((await N.post('/onboarding/claim')).status, 400, 'cannot claim early');

      await N.post('/auth/set-name', { name: 'Init' + String(suffix).slice(-6) });
      await N.put('/routine', { items: [slot('i1', 'Wake', '06:00', 15)], acknowledged: true });
      await N.post('/modules', { name: 'Reading', acknowledged: true });
      await N.patch('/quests/DQ-01/complete');
      const m = await N.post('/unplanned/manual', { description: 'Organised my whole desk', title: 'Organised desk', category: 'chores', difficulty: 'easy', estimatedMinutes: 20 });
      await N.post(`/unplanned/${m.body.id}/accept`);

      o = (await N.get('/onboarding')).body;
      assert.ok(o.steps.every((s: any) => s.done));
      const before = (await N.xp()).xp;
      const claim = await N.post('/onboarding/claim');
      assert.strictEqual(claim.status, 200);
      assert.strictEqual(claim.body.xpGained, 50);
      assert.strictEqual((await N.xp()).xp, before + 50);
      assert.strictEqual((await N.post('/onboarding/claim')).status, 409, 'only once');
      assert.strictEqual((await N.get('/onboarding')).body.claimed, true);
    });
  });

  describe('friends', () => {
    it('follows by Hunter name, ranks the circle by weekly XP, respects opt-out, unfollows', async () => {
      const F1 = client((await register('ext_f1_' + suffix)).cookie);
      const F2 = client((await register('ext_f2_' + suffix)).cookie);
      const F3 = client((await register('ext_f3_' + suffix)).cookie);
      const [n1, n2, n3] = ['Ally', 'Bolt', 'Cove'].map(p => p + String(suffix).slice(-6));
      await F1.post('/auth/set-name', { name: n1 });
      await F2.post('/auth/set-name', { name: n2 });
      await F3.post('/auth/set-name', { name: n3 });
      await F2.patch('/quests/DQ-03/complete'); // F2: 25 XP this week

      assert.strictEqual((await F1.post('/friends', { name: n2.toLowerCase() })).status, 201, 'case-insensitive');
      assert.strictEqual((await F1.post('/friends', { name: n1 })).status, 400, 'cannot follow yourself');
      assert.strictEqual((await F1.post('/friends', { name: 'nobody-' + suffix })).status, 404);
      const circle = (await F1.get('/friends')).body.friends;
      assert.deepStrictEqual(circle.map((f: any) => [f.name, f.weeklyXp, f.isMe]), [[n2, 25, false], [n1, 0, true]]);
      assert.ok(circle.every((f: any) => !('id' in f) && !('username' in f)));

      await F3.patch('/leaderboard/visibility', { visible: false });
      assert.strictEqual((await F1.post('/friends', { name: n3 })).status, 404, 'opted-out hunters cannot be found');

      assert.strictEqual((await F1.del(`/friends/${encodeURIComponent(n2)}`)).status, 200);
      assert.deepStrictEqual((await F1.get('/friends')).body.friends.map((f: any) => f.name), [n1]);
      assert.strictEqual((await F1.del(`/friends/${encodeURIComponent(n2)}`)).status, 404);
    });
  });

  describe('perfect day bonus', () => {
    it("pays once all of today's timetable quests are done, revokes on undo, cannot be farmed", async () => {
      const P = client((await register('ext_pd_' + suffix)).cookie);
      await P.put('/routine', { items: [slot('p1', 'Wake', '06:00', 15), slot('p2', 'Work', '09:00', 60), slot('p3', 'Read', '21:00', 30)], acknowledged: true });
      const qs = (await P.get('/quests')).body.filter((q: any) => q.category === 'routine');
      const ids = qs.map((q: any) => q.quest_id);
      const total = qs.reduce((s: number, q: any) => s + q.xp_reward, 0);
      assert.strictEqual(ids.length, 3);
      const start = (await P.xp()).xp;
      assert.strictEqual((await P.patch(`/quests/${ids[0]}/complete`)).body.perfectDay, null);
      await P.patch(`/quests/${ids[1]}/complete`);
      const last = (await P.patch(`/quests/${ids[2]}/complete`)).body;
      assert.deepStrictEqual(last.perfectDay, { status: 'awarded', xp: 25 });
      const withBonus = (await P.xp()).xp;
      assert.strictEqual(withBonus, start + total + 25);
      const undo = (await P.patch(`/quests/${ids[2]}/complete`)).body;
      assert.deepStrictEqual(undo.perfectDay, { status: 'revoked', xp: -25 });
      assert.strictEqual((await P.xp()).xp, start + total - qs[2].xp_reward);
      await P.patch(`/quests/${ids[2]}/complete`); // redo → bonus again, no net gain from cycling
      assert.strictEqual((await P.xp()).xp, withBonus);
      assert.strictEqual((await P.patch(`/quests/${ids[1]}/complete`)).body.perfectDay.status, 'revoked');
    });

    it('needs at least 3 timetable quests today', async () => {
      const Q = client((await register('ext_pd2_' + suffix)).cookie);
      await Q.put('/routine', { items: [slot('q1', 'Wake', '06:00', 15), slot('q2', 'Read', '21:00', 30)], acknowledged: true });
      const ids = (await Q.get('/quests')).body.filter((q: any) => q.category === 'routine').map((q: any) => q.quest_id);
      await Q.patch(`/quests/${ids[0]}/complete`);
      assert.strictEqual((await Q.patch(`/quests/${ids[1]}/complete`)).body.perfectDay, null);
    });
  });

  describe('per-hunter timezones', () => {
    it('records completions on the hunter’s local calendar day', async () => {
      const { cookie } = await register('ext_tz_' + suffix);
      const complete = (tz: string) => fetch(`${BASE_URL}/api/quests/DQ-01/complete`, { method: 'PATCH', headers: { Cookie: cookie, 'X-Timezone': tz } }).then(r => r.json());
      const local = (tz: string) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      // UTC+14 and UTC-12 are always on different calendar dates.
      assert.strictEqual((await complete('Pacific/Kiritimati')).action, 'completed');
      assert.strictEqual((await complete('Etc/GMT+12')).action, 'completed', 'a different local day is a fresh daily quest');
      const quests = await (await fetch(`${BASE_URL}/api/quests`, { headers: { Cookie: cookie } })).json();
      const dates = quests.find((q: any) => q.quest_id === 'DQ-01').completions.map((c: any) => c.completion_date).sort();
      assert.deepStrictEqual(dates, [local('Etc/GMT+12'), local('Pacific/Kiritimati')].sort());
    });
  });

  describe('client error reporting', () => {
    it('accepts capped crash reports without auth and validates input', async () => {
      const post = (body: unknown) => fetch(`${BASE_URL}/api/client-errors`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      assert.strictEqual((await post({ message: 'TypeError: x is undefined', stack: 'at Foo', url: '/quests', kind: 'render' })).status, 204);
      assert.strictEqual((await post({ message: 'y'.repeat(100000) })).status, 204, 'oversized reports are clipped, not rejected');
      assert.strictEqual((await post({})).status, 400);
    });
  });

  describe('data export', () => {
    it('exports the hunter’s own data without secrets', async () => {
      const E = client((await register('ext_exp_' + suffix)).cookie);
      await E.patch('/quests/DQ-01/complete');
      await E.post('/modules', { name: 'Reading', acknowledged: true, tasks: [{ title: 'Read', difficulty: 1 }] });
      const res = await fetch(`${BASE_URL}/api/auth/export`, { headers: { Cookie: (await register('ext_exp2_' + suffix)).cookie } });
      assert.strictEqual(res.status, 200);
      const mine = await E.get('/auth/export');
      assert.strictEqual(mine.status, 200);
      const d = mine.body;
      assert.strictEqual(d.format, 'hunter-system-export/v1');
      assert.strictEqual(d.profile.username, 'ext_exp_' + suffix);
      assert.ok(!JSON.stringify(d).includes('password_hash'), 'no password hash');
      assert.ok(d.completions.some((c: any) => c.quest_id === 'DQ-01'));
      assert.deepStrictEqual(d.modules.map((m: any) => m.slug), ['reading']);
      assert.ok(d.xpHistory.some((h: any) => h.action === 'quest_complete'));
      const other = await res.json();
      assert.strictEqual(other.completions.length, 0, 'another hunter sees only their own data');
    });
  });

  describe('invite links', () => {
    it('signing up via an invite makes both hunters follow each other', async () => {
      const Inv = client((await register('ext_inv_' + suffix)).cookie);
      const invName = 'Inviter' + String(suffix).slice(-6);
      await Inv.post('/auth/set-name', { name: invName });
      const New = client((await register('ext_new_' + suffix, invName.toUpperCase())).cookie);
      const newName = 'Newbie' + String(suffix).slice(-6);
      await New.post('/auth/set-name', { name: newName });
      const names = (c: typeof Inv) => c.get('/friends').then(r => r.body.friends.map((f: any) => f.name).sort());
      assert.deepStrictEqual(await names(New), [invName, newName].sort());
      assert.deepStrictEqual(await names(Inv), [invName, newName].sort());
      // Unknown inviter: sign-up still succeeds, nobody followed
      const Solo = client((await register('ext_solo_' + suffix, 'NoSuchHunter')).cookie);
      assert.strictEqual((await Solo.get('/friends')).body.friends.length, 1, 'only themselves');
    });
  });

  describe('public profiles', () => {
    it('shows named, visible hunters only — no private fields', async () => {
      const P = client((await register('ext_pub_' + suffix)).cookie);
      const pname = 'Public' + String(suffix).slice(-6);
      assert.strictEqual((await fetch(`${BASE_URL}/api/public/hunters/ext_pub_${suffix}`)).status, 404, 'no chosen name yet');
      await P.post('/auth/set-name', { name: pname });
      await P.patch('/quests/DQ-01/complete');
      const res = await fetch(`${BASE_URL}/api/public/hunters/${pname.toLowerCase()}`);
      assert.strictEqual(res.status, 200);
      const p = await res.json();
      assert.strictEqual(p.name, pname);
      assert.strictEqual(p.streak, 1);
      assert.ok(p.weeklyXp > 0 && p.level >= 1 && p.rank);
      assert.ok(!('username' in p) && !('id' in p), 'no username or id');
      await P.patch('/leaderboard/visibility', { visible: false });
      assert.strictEqual((await fetch(`${BASE_URL}/api/public/hunters/${pname}`)).status, 404, 'opted out');
    });
  });

  describe('account recovery codes', () => {
    it('resets a forgotten password with a single-use code', async () => {
      const uname = 'ext_rec_' + suffix;
      const R = client((await register(uname)).cookie);
      assert.strictEqual((await R.get('/auth/recovery-code')).body.createdAt, null);
      assert.strictEqual((await R.post('/auth/recovery-code', { password: 'wrong' })).status, 401);
      const { code } = (await R.post('/auth/recovery-code', { password: 'ExtPass123!' })).body;
      assert.match(code, /^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/);
      assert.ok((await R.get('/auth/recovery-code')).body.createdAt);
      for (const path of ['/stats', '/auth/me']) {
        const body = JSON.stringify((await R.get(path)).body);
        assert.ok(!body.includes('recovery_hash') && !body.includes('password_hash'), `${path} leaks no credential hashes`);
      }
      assert.ok(!JSON.stringify((await R.patch('/stats', { str: 11 })).body).includes('recovery_hash'));

      const recover = (body: object) => fetch(`${BASE_URL}/api/auth/recover`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      assert.strictEqual((await recover({ username: uname, code: 'AAAA-AAAA-AAAA-AAAA', newPassword: 'NewPass123!' })).status, 401);
      assert.strictEqual((await recover({ username: uname, code, newPassword: '123' })).status, 400);
      // Case/dash-insensitive entry works and signs the hunter in
      const ok = await recover({ username: uname, code: code.toLowerCase().replace(/-/g, ' '), newPassword: 'NewPass123!' });
      assert.strictEqual(ok.status, 200);
      assert.ok((ok.headers.get('set-cookie') || '').includes('token='));
      const login = (password: string) => fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: uname, password }),
      });
      assert.strictEqual((await login('NewPass123!')).status, 200);
      assert.strictEqual((await login('ExtPass123!')).status, 401);
      assert.strictEqual((await recover({ username: uname, code, newPassword: 'Other123!' })).status, 401, 'code is single-use');
    });
  });

  describe('web push reminders', () => {
    it('serves a VAPID key and manages device subscriptions', async () => {
      const key = await (await fetch(`${BASE_URL}/api/push/key`)).json();
      assert.match(key.publicKey, /^[A-Za-z0-9_-]{80,}$/);
      const W = client((await register('ext_push_' + suffix)).cookie);
      const sub = { endpoint: `https://push.example.com/ext_${suffix}`, keys: { p256dh: 'BPk', auth: 'au' } };
      assert.strictEqual((await W.post('/push/subscribe', { subscription: { ...sub, endpoint: 'http://insecure' } })).status, 400);
      assert.strictEqual((await W.post('/push/subscribe', { subscription: { endpoint: sub.endpoint } })).status, 400);
      assert.strictEqual((await W.post('/push/subscribe', { subscription: sub })).status, 201);
      assert.strictEqual((await W.post('/push/subscribe', { subscription: sub })).status, 201, 'idempotent');
      const res = await fetch(`${BASE_URL}/api/push/subscribe`, {
        method: 'DELETE', headers: { Cookie: (await register('ext_push2_' + suffix)).cookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      assert.strictEqual(res.status, 204);
      assert.strictEqual((await fetch(`${BASE_URL}/api/push/subscribe`, { method: 'POST' })).status, 401);
    });
  });

  describe('streak freezes (server-owned)', () => {
    const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10); // UTC, like the server without X-Timezone

    it('costs real XP and is capped', async () => {
      const { cookie, id } = await register('ext_frz_' + suffix);
      const F = client(cookie);
      await db.query('UPDATE users SET xp = 150 WHERE id = $1', [id]);
      const buy = await F.post('/stats/freeze/buy');
      assert.strictEqual(buy.status, 200);
      assert.deepStrictEqual(buy.body, { xp: 50, freezeCount: 1 });
      assert.strictEqual((await F.xp()).xp, 50, 'XP really spent on the server');
      assert.strictEqual((await F.post('/stats/freeze/buy')).status, 400, 'not enough XP');
      await db.query('UPDATE users SET xp = 10000, freeze_count = 5 WHERE id = $1', [id]);
      assert.strictEqual((await F.post('/stats/freeze/buy')).status, 400, 'max 5 held');
    });

    it('auto-covers a missed gap it can fully cover, otherwise the penalty applies', async () => {
      const setup = async (name: string, freezes: number) => {
        const { cookie, id } = await register(name);
        const C = client(cookie);
        await C.patch('/quests/DQ-01/complete');
        await db.query('UPDATE quest_completions SET completion_date = $2 WHERE user_id = $1', [id, day(-3)]);
        await db.query('UPDATE users SET freeze_count = $2 WHERE id = $1', [id, freezes]);
        return { C, id };
      };
      const { C: A } = await setup('ext_frza_' + suffix, 2); // missed day(-2) and day(-1)
      const a = (await A.get('/stats')).body;
      assert.strictEqual(a.penalty, null);
      assert.strictEqual(a.freeze.used, 2);
      assert.strictEqual(a.freezeCount, 0);
      assert.deepStrictEqual(a.freezeDates, [day(-2), day(-1)]);
      assert.strictEqual(a.streak, 3, 'done day + two frozen days');
      assert.strictEqual((await A.get('/stats')).body.freeze, null, 'spent once');

      const { C: B, id: bId } = await setup('ext_frzb_' + suffix, 1); // 1 freeze can't cover 2 days
      const b = (await B.get('/stats')).body;
      assert.strictEqual(b.penalty.applied, true);
      assert.strictEqual(b.freeze, null);
      assert.strictEqual((await db.query('SELECT freeze_count FROM users WHERE id = $1', [bId])).rows[0].freeze_count, 1, 'kept');
    });

    it('can be placed by hand on a recent missed day', async () => {
      const { cookie, id } = await register('ext_frzm_' + suffix);
      const M = client(cookie);
      assert.strictEqual((await M.post('/stats/freeze/use', { date: day(-1) })).status, 400, 'none owned');
      await db.query('UPDATE users SET freeze_count = 1 WHERE id = $1', [id]);
      assert.strictEqual((await M.post('/stats/freeze/use', { date: day(0) })).status, 400, 'not today');
      assert.strictEqual((await M.post('/stats/freeze/use', { date: day(-30) })).status, 400, 'too old');
      const used = await M.post('/stats/freeze/use', { date: day(-1) });
      assert.deepStrictEqual(used.body, { freezeCount: 0, date: day(-1) });
      await M.patch('/quests/DQ-01/complete');
      assert.strictEqual((await M.get('/stats')).body.streak, 2);
    });
  });

  describe('cloud game state', () => {
    it('saves whitelisted progress per hunter and caps size', async () => {
      const S = client((await register('ext_st_' + suffix)).cookie);
      const empty = await S.get('/state');
      assert.strictEqual(empty.status, 200);
      assert.strictEqual(empty.body.state, null);
      const put = await S.put('/state', { state: { inventory: [{ itemId: 'potion', instanceId: 'a1' }], freezeCount: 2, unlockedTitles: ['Shadow'], xp: 99999 } });
      assert.strictEqual(put.status, 200);
      const got = await S.get('/state');
      assert.deepStrictEqual(got.body.state, { inventory: [{ itemId: 'potion', instanceId: 'a1' }], unlockedTitles: ['Shadow'] }, 'freezes/xp are server-owned, dropped');
      const other = client((await register('ext_st2_' + suffix)).cookie);
      assert.strictEqual((await other.get('/state')).body.state, null, 'isolated per hunter');
      assert.strictEqual((await S.put('/state', { state: { inventory: ['x'.repeat(70_000)] } })).status, 413);
      assert.strictEqual((await S.put('/state', { state: [1] })).status, 400);
      assert.deepStrictEqual((await S.get('/auth/export')).body.gameState.state.unlockedTitles, ['Shadow']);
    });
  });

  describe('launch hardening: sessions, CORS, CSRF origin guard, login lockout', () => {
    const uname = 'ext_sec_' + suffix;

    it('issues a 7-day session cookie', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: uname, password: 'SecPass123!' }),
      });
      assert.strictEqual(res.status, 201);
      assert.match(res.headers.get('set-cookie') || '', /Max-Age=604800/);
    });

    it('sends CORS headers only to Hunter origins', async () => {
      const good = await fetch(`${BASE_URL}/api/health`, { headers: { Origin: 'https://hunters-system.vercel.app' } });
      assert.strictEqual(good.headers.get('access-control-allow-origin'), 'https://hunters-system.vercel.app');
      const bad = await fetch(`${BASE_URL}/api/health`, { headers: { Origin: 'https://evil.example' } });
      assert.strictEqual(bad.headers.get('access-control-allow-origin'), null);
    });

    it('rejects state-changing requests from foreign origins', async () => {
      const bad = await fetch(`${BASE_URL}/api/auth/logout`, { method: 'POST', headers: { Origin: 'https://evil.example' } });
      assert.strictEqual(bad.status, 403);
      const good = await fetch(`${BASE_URL}/api/auth/logout`, { method: 'POST', headers: { Origin: 'http://localhost:5173' } });
      assert.strictEqual(good.status, 200);
    });

    it('locks an account on this network after 10 failed logins, even for the right password', async () => {
      const login = (password: string) => fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: uname, password }),
      });
      for (let i = 0; i < 10; i++) assert.strictEqual((await login('wrong-password')).status, 401);
      const locked = await login('SecPass123!');
      assert.strictEqual(locked.status, 429);
      assert.ok(Number(locked.headers.get('retry-after')) > 0);
    });
  });

  describe('unplanned activities (manual/fallback path, AI not configured in tests)', () => {
    it('falls back to manual when AI is unavailable', async () => {
      const r = await A.post('/unplanned/analyze', { description: 'I spent 2 hours debugging a production issue' });
      assert.strictEqual(r.status, 200);
      if (r.body.status === 'analyzed') await A.post(`/unplanned/${r.body.id}/reject`); // AI configured locally
      else assert.strictEqual(r.body.status, 'manual');
    });

    it('manual entry → engine XP → accept updates XP and history', async () => {
      const r = await A.post('/unplanned/manual', { description: 'Debugged a production API issue for 2 hours', title: 'Debugged production API issue', category: 'work', difficulty: 'hard', estimatedMinutes: 120 });
      assert.strictEqual(r.status, 200);
      assert.strictEqual(r.body.xp, 60, 'manual entries are capped at 60 XP');
      const before = (await A.xp()).xp;
      const acc = await A.post(`/unplanned/${r.body.id}/accept`);
      assert.strictEqual(acc.status, 200);
      assert.strictEqual(acc.body.xpGained, 60);
      assert.strictEqual((await A.xp()).xp, before + 60);
      const log = (await A.get('/activity?limit=5')).body;
      assert.ok(log.some((e: any) => e.action === 'unplanned_accept' && e.details.xp === 60));
      // Already resolved → cannot be accepted twice
      assert.strictEqual((await A.post(`/unplanned/${r.body.id}/accept`)).status, 404);
    });

    it('identical description on the same day is rejected; similar ones decay', async () => {
      const dup = await A.post('/unplanned/manual', { description: 'Debugged a production API issue for 2 hours', title: 'x', category: 'work', difficulty: 'hard', estimatedMinutes: 120 });
      assert.strictEqual(dup.status, 409);
      const similar = await A.post('/unplanned/manual', { description: 'More debugging on production API issue', title: 'Debugged production API issue again', category: 'work', difficulty: 'hard', estimatedMinutes: 120 });
      assert.strictEqual(similar.body.repeats, 1);
      assert.ok(similar.body.xp < 60);
      await A.post(`/unplanned/${similar.body.id}/reject`);
    });

    it('edit recalculates XP through the engine; reject awards nothing', async () => {
      const r = await A.post('/unplanned/manual', { description: 'Completed a technical course module', title: 'Technical course', category: 'learning', difficulty: 'medium', estimatedMinutes: 30 });
      const pv = await A.post(`/unplanned/${r.body.id}/preview`, { edits: { estimatedMinutes: 90 } });
      assert.ok(pv.body.xp > r.body.xp);
      assert.strictEqual((await A.post(`/unplanned/${r.body.id}/preview`, { edits: { estimatedMinutes: 99999 } })).status, 400);
      const before = (await A.xp()).xp;
      assert.strictEqual((await A.post(`/unplanned/${r.body.id}/reject`)).status, 200);
      assert.strictEqual((await A.xp()).xp, before);
    });

    it('flags activities that match an existing Hunter task', async () => {
      const r = await A.post('/unplanned/manual', { description: 'did my meditation today', title: 'Meditation 15 min', category: 'mindset', difficulty: 'easy', estimatedMinutes: 15 });
      assert.strictEqual(r.body.similarTask?.questId, 'DQ-02');
      await A.post(`/unplanned/${r.body.id}/reject`);
    });

    it('users cannot accept or reject another user\'s activity, and cannot submit XP', async () => {
      const r = await A.post('/unplanned/manual', { description: 'Wrote a blog post draft', title: 'Blog draft', category: 'content', difficulty: 'medium', estimatedMinutes: 60, xp: 10000 });
      assert.ok(r.body.xp <= 60);
      assert.strictEqual((await B.post(`/unplanned/${r.body.id}/accept`)).status, 404);
      assert.strictEqual((await B.post(`/unplanned/${r.body.id}/reject`)).status, 404);
      await A.post(`/unplanned/${r.body.id}/reject`);
    });

    it('the daily XP cap stops XP farming', async () => {
      const titles = ['Refactored billing module', 'Studied Rust ownership', 'Ran a 10k', 'Recorded badminton footwork video', 'Wrote system design notes'];
      let blocked = false;
      for (const t of titles) {
        const r = await A.post('/unplanned/manual', { description: `Extra work: ${t}`, title: t, category: 'work', difficulty: 'extreme', estimatedMinutes: 240 });
        if (r.status !== 200) break;
        const acc = await A.post(`/unplanned/${r.body.id}/accept`);
        if (acc.status === 429) { blocked = true; break; }
      }
      assert.ok(blocked, 'daily cap must block further XP');
    });

    it('legacy unauthenticated quest creation is gone', async () => {
      const res = await fetch(`${BASE_URL}/api/quests`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quest_id: 'EVIL', title: 'x', xp_reward: 100000, category: 'x' }) });
      assert.notStrictEqual(res.status, 201);
    });
  });
});
