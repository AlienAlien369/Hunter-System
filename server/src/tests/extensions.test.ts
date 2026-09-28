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

async function register(username: string) {
  const res = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: 'ExtPass123!' }),
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
