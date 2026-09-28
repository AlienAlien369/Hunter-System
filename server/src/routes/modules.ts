import { Router, Request, Response } from 'express';
import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { applyXp } from '../xp.js';
import { structuredCompletion } from '../ai.js';
import {
  XP_RULES, MODULE_KINDS, SINGLETON_KINDS, DAYS, isEstablished, slugify, taskXp,
  sanitizeModuleTask, diffModuleTasks, moduleRemovalChange, modulePauseChange, validateModuleDraft,
  type ModuleKind, type ModuleTask, type RoutineChange,
} from '../rules.js';
import { confirmGate, findModule, insertTask, moduleTaskRows, toModuleTask, xpEntries, type ModuleRow } from '../modules.js';
import { parseChannel } from './content.js';

// Dynamic user modules: everything outside the fixed core pages. Modules are
// added/renamed/paused/removed per user; their tasks are CQ-* quests. The
// 48h commitment rule and its XP consequences apply to modules and to each
// established task inside them. AI only drafts modules — saving is plain CRUD.
const router = Router();
router.use(authenticateToken);

const MAX_MODULES = 30;
const graceEnds = (m: ModuleRow) => new Date(new Date(m.created_at).getTime() + XP_RULES.routine.graceHours * 3600_000).toISOString();

function serialize(m: ModuleRow, taskCount?: number) {
  return {
    id: m.id, slug: m.slug, name: m.name, icon: m.icon, kind: m.kind, status: m.status, goals: m.goals,
    createdAt: new Date(m.created_at).toISOString(), graceEndsAt: graceEnds(m),
    established: isEstablished(new Date(m.created_at).toISOString(), new Date()),
    ...(taskCount !== undefined ? { taskCount } : {}),
  };
}

function parseMeta(body: any): { name?: string; icon?: string; goals?: string[] } | string {
  const out: { name?: string; icon?: string; goals?: string[] } = {};
  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name || name.length > 60) return 'Module name must be 1–60 characters';
    out.name = name;
  }
  if (body.icon !== undefined) out.icon = typeof body.icon === 'string' && body.icon.trim() ? [...body.icon.trim()].slice(0, 2).join('') : '✨';
  if (body.goals !== undefined) {
    if (!Array.isArray(body.goals)) return 'Goals must be a list';
    out.goals = body.goals.filter((g: unknown): g is string => typeof g === 'string' && !!g.trim()).map((g: string) => g.trim().slice(0, 200)).slice(0, 8);
  }
  return out;
}

function parseTasks(raw: unknown): ModuleTask[] | string {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) return 'tasks must be a list';
  if (raw.length > 40) return 'A module can have at most 40 tasks';
  const out: ModuleTask[] = [];
  for (const t of raw) {
    const s = sanitizeModuleTask(t);
    if (typeof s === 'string') return s;
    out.push(s);
  }
  return out;
}

// GET /api/modules
router.get('/', async (req: Request, res: Response) => {
  try {
    const r = await pool.query(
      `SELECT m.*, (SELECT COUNT(*)::int FROM quests q WHERE q.user_id = m.user_id AND q.category = m.slug AND NOT q.archived) AS task_count
       FROM user_modules m WHERE m.user_id = $1 ORDER BY m.created_at, m.id`,
      [req.user!.id]
    );
    res.json(r.rows.map((m: any) => serialize(m, m.task_count)));
  } catch (error) {
    console.error('Error listing modules:', error);
    res.status(500).json({ error: 'Failed to list modules' });
  }
});

// GET /api/modules/history — module XP changes (from the XP history)
router.get('/history', async (req: Request, res: Response) => {
  try {
    const r = await pool.query(
      `SELECT id, action, entity, details, created_at FROM activity_log
       WHERE user_id = $1 AND action = 'module_change' ORDER BY created_at DESC, id DESC LIMIT 100`,
      [req.user!.id]
    );
    res.json(r.rows);
  } catch (error) {
    console.error('Error fetching module history:', error);
    res.status(500).json({ error: 'Failed to fetch module history' });
  }
});

// POST /api/modules — create (or replace) a module.
// Body: { name, icon?, kind?, goals?, tasks?, channels?, acknowledged: true, replaceModuleId?, expectedXp? }
router.post('/', async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const client = await pool.connect();
  try {
    if (req.body.acknowledged !== true) {
      return res.status(400).json({ error: 'Please acknowledge the 2-day module commitment before activating' });
    }
    const meta = parseMeta({ ...req.body, name: req.body.name ?? '' });
    if (typeof meta === 'string') return res.status(400).json({ error: meta });
    const kind = (req.body.kind ?? 'tasks') as ModuleKind;
    if (!MODULE_KINDS.includes(kind)) return res.status(400).json({ error: 'Unknown module type' });
    const tasks = parseTasks(req.body.tasks);
    if (typeof tasks === 'string') return res.status(400).json({ error: tasks });
    const channels = Array.isArray(req.body.channels) && kind === 'content' ? req.body.channels.slice(0, 30).map((c: any) => parseChannel(c, false)) : [];
    const badChannel = channels.find((c: unknown) => typeof c === 'string');
    if (badChannel) return res.status(400).json({ error: badChannel });

    await client.query('BEGIN');
    await client.query('SELECT 1 FROM users WHERE id = $1 FOR UPDATE', [userId]);
    const replaced = req.body.replaceModuleId ? await findModule(client, userId, req.body.replaceModuleId, true) : undefined;
    if (req.body.replaceModuleId && !replaced) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Module to replace not found' });
    }
    const existing: ModuleRow[] = (await client.query('SELECT * FROM user_modules WHERE user_id = $1', [userId])).rows;
    const others = existing.filter(m => m.id !== replaced?.id);
    if (others.length >= MAX_MODULES) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Module limit reached (${MAX_MODULES})` });
    }
    if (SINGLETON_KINDS.includes(kind) && others.some(m => m.kind === kind)) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'You already have this module' });
    }
    // Built-in kinds keep a fixed slug; custom modules get a unique slug from their name.
    let slug = kind === 'tasks' ? slugify(meta.name!) : kind;
    if (kind === 'tasks') {
      if ((MODULE_KINDS as readonly string[]).includes(slug) || slug === 'hidden') slug += '-m';
      const taken = new Set(others.map(m => m.slug));
      for (let i = 2; taken.has(slug); i++) slug = `${slugify(meta.name!).slice(0, 32)}-${i}`;
    }

    const now = new Date();
    const changes: RoutineChange[] = replaced
      ? [moduleRemovalChange({ name: replaced.name, createdAt: new Date(replaced.created_at).toISOString(), rewardXp: replaced.reward_xp }, now, meta.name)]
      : [{ kind: 'module_added', module: meta.name!, label: `New module added: ${meta.name}`, xp: XP_RULES.routine.moduleAdded, reason: 'Expanding your Hunter routine' }];
    if (!(await confirmGate(client, res, userId, changes, req.body.expectedXp))) {
      await client.query('ROLLBACK');
      return;
    }

    if (replaced) {
      await client.query('UPDATE quests SET archived = true WHERE user_id = $1 AND category = $2', [userId, replaced.slug]);
      await client.query('DELETE FROM user_modules WHERE id = $1', [replaced.id]);
    }
    const mod: ModuleRow = (await client.query(
      `INSERT INTO user_modules (user_id, slug, name, icon, kind, goals, reward_xp)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [userId, slug, meta.name, meta.icon ?? '✨', kind, JSON.stringify(meta.goals ?? []), replaced ? 0 : XP_RULES.routine.moduleAdded]
    )).rows[0];
    for (const t of tasks) await insertTask(client, userId, slug, t);
    for (const c of channels as Record<string, unknown>[]) {
      const cols = Object.keys(c);
      await client.query(
        `INSERT INTO content_channels (user_id, ${cols.join(', ')}) VALUES ($1, ${cols.map((_, i) => `$${i + 2}`).join(', ')})`,
        [userId, ...Object.values(c)]
      );
    }
    const xp = await applyXp(client, userId, xpEntries(changes));
    await client.query('COMMIT');
    res.status(201).json({ module: serialize(mod, tasks.length), changes, xp: xp.newXp });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error creating module:', error);
    res.status(500).json({ error: 'Failed to create module' });
  } finally {
    client.release();
  }
});

// PATCH /api/modules/:id — rename / icon / goals (free) or status (pause = major change)
router.patch('/:id', async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const client = await pool.connect();
  try {
    const meta = parseMeta(req.body);
    if (typeof meta === 'string') return res.status(400).json({ error: meta });
    const status = req.body.status;
    if (status !== undefined && !['active', 'paused'].includes(status)) return res.status(400).json({ error: 'Status must be active or paused' });
    await client.query('BEGIN');
    const mod = await findModule(client, userId, req.params.id, true);
    if (!mod) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Module not found' });
    }
    const changes = status === 'paused' && mod.status !== 'paused'
      ? [modulePauseChange({ name: mod.name, createdAt: new Date(mod.created_at).toISOString() }, new Date())]
      : [];
    if (!(await confirmGate(client, res, userId, changes, req.body.expectedXp))) {
      await client.query('ROLLBACK');
      return;
    }
    const updated: ModuleRow = (await client.query(
      `UPDATE user_modules SET name = COALESCE($2, name), icon = COALESCE($3, icon), goals = COALESCE($4, goals),
         status = COALESCE($5, status), updated_at = NOW() WHERE id = $1 RETURNING *`,
      [mod.id, meta.name ?? null, meta.icon ?? null, meta.goals ? JSON.stringify(meta.goals) : null, status ?? null]
    )).rows[0];
    const entries = xpEntries(changes);
    const xp = entries.length ? await applyXp(client, userId, entries) : null;
    await client.query('COMMIT');
    res.json({ module: serialize(updated), changes, xp: xp?.newXp });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error updating module:', error);
    res.status(500).json({ error: 'Failed to update module' });
  } finally {
    client.release();
  }
});

// PUT /api/modules/:id/tasks — replace the module's task list (manual editor or
// an accepted AI edit). Tasks with an `id` update existing ones; others are new.
router.put('/:id/tasks', async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const client = await pool.connect();
  try {
    const tasks = parseTasks(req.body.tasks);
    if (typeof tasks === 'string') return res.status(400).json({ error: tasks });
    await client.query('BEGIN');
    const mod = await findModule(client, userId, req.params.id, true);
    if (!mod) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Module not found' });
    }
    const rows = await moduleTaskRows(client, userId, mod.slug);
    const byId = new Map(rows.map((r: any) => [r.quest_id, r]));
    const unknown = tasks.find(t => t.id && !byId.has(t.id));
    if (unknown) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Unknown task ${unknown.id}` });
    }
    const { changes } = diffModuleTasks(rows.map(toModuleTask), tasks, { now: new Date(), moduleName: mod.name });
    if (!(await confirmGate(client, res, userId, changes, req.body.expectedXp))) {
      await client.query('ROLLBACK');
      return;
    }
    const keep = new Set(tasks.filter(t => t.id).map(t => t.id));
    for (const r of rows) if (!keep.has(r.quest_id)) await client.query('UPDATE quests SET archived = true WHERE id = $1', [r.id]);
    for (const t of tasks) {
      if (!t.id) {
        await insertTask(client, userId, mod.slug, t);
        continue;
      }
      const r: any = byId.get(t.id);
      const m = { ...(r.metadata ?? {}), subtasks: t.subtasks };
      if (!t.subtasks?.length) delete m.subtasks;
      await client.query(
        `UPDATE quests SET title = $2, difficulty = $3, xp_reward = $4, schedule_time = $5, time_of_day = $6, recurrence = $7, metadata = $8 WHERE id = $1`,
        [r.id, t.title, t.difficulty, taskXp(t.difficulty), t.scheduleTime, t.timeOfDay, t.recurrence, Object.keys(m).length ? JSON.stringify(m) : null]
      );
    }
    const entries = xpEntries(changes);
    const xp = entries.length ? await applyXp(client, userId, entries) : null;
    await client.query('UPDATE user_modules SET updated_at = NOW() WHERE id = $1', [mod.id]);
    await client.query('COMMIT');
    res.json({ changes, netXp: changes.reduce((s, c) => s + c.xp, 0), xp: xp?.newXp });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error saving module tasks:', error);
    res.status(500).json({ error: 'Failed to save module' });
  } finally {
    client.release();
  }
});

// DELETE /api/modules/:id?expectedXp= — remove a module (its tasks are archived; earned XP stays)
router.delete('/:id', async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const mod = await findModule(client, userId, req.params.id, true);
    if (!mod) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Module not found' });
    }
    const changes = [moduleRemovalChange({ name: mod.name, createdAt: new Date(mod.created_at).toISOString(), rewardXp: mod.reward_xp }, new Date())];
    if (!(await confirmGate(client, res, userId, changes, req.query.expectedXp ?? req.body?.expectedXp))) {
      await client.query('ROLLBACK');
      return;
    }
    await client.query('UPDATE quests SET archived = true WHERE user_id = $1 AND category = $2', [userId, mod.slug]);
    await client.query('DELETE FROM user_modules WHERE id = $1', [mod.id]);
    const entries = xpEntries(changes);
    // Log the removal in the XP history even when it's free, for transparency.
    const xp = await applyXp(client, userId, entries.length ? entries : [{ delta: 0, action: 'module_change', entity: mod.name, details: { kind: 'module_removed', label: changes[0].label, reason: changes[0].reason } }]);
    await client.query('COMMIT');
    res.json({ message: 'Module removed', changes, xp: xp.newXp });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error removing module:', error);
    res.status(500).json({ error: 'Failed to remove module' });
  } finally {
    client.release();
  }
});

// POST /api/modules/ai/draft { prompt, moduleId? } — AI Module Builder.
// Returns an editable proposal; nothing is saved here.
router.post('/ai/draft', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const prompt = typeof req.body.prompt === 'string' ? req.body.prompt.trim().slice(0, 1500) : '';
    if (prompt.length < 5) return res.status(400).json({ error: 'Describe the module you want' });
    let current: unknown = null;
    if (req.body.moduleId) {
      const mod = await findModule(pool, userId, req.body.moduleId);
      if (!mod) return res.status(404).json({ error: 'Module not found' });
      current = { name: mod.name, icon: mod.icon, goals: mod.goals, tasks: (await moduleTaskRows(pool, userId, mod.slug)).map(toModuleTask).map(({ createdAt: _c, ...t }) => t) };
    }
    const raw = await structuredCompletion({
      system:
        'You design habit modules for a gamified self-improvement app ("Hunter"). A module has a short name, one emoji icon, ' +
        'a few concrete goals, and recurring tasks. Tasks: short title, difficulty 1 (easy) to 3 (hard), optional 24h scheduleTime HH:MM, ' +
        'timeOfDay morning/evening/anytime, recurrence as a list of days (MON..SUN; omit for daily), optional short subtasks. ' +
        'Keep it realistic (3–10 tasks). When editing an existing module, return the full updated module and keep the "id" of tasks you keep.',
      prompt: JSON.stringify({ request: prompt, currentModule: current }),
      toolName: 'module_draft',
      schema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          icon: { type: 'string', description: 'A single emoji' },
          goals: { type: 'array', items: { type: 'string' } },
          tasks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'Existing task id when keeping a task' },
                title: { type: 'string' },
                difficulty: { type: 'integer', enum: [1, 2, 3] },
                scheduleTime: { type: 'string' },
                timeOfDay: { type: 'string', enum: ['morning', 'evening', 'anytime'] },
                recurrence: { type: 'array', items: { type: 'string', enum: [...DAYS] } },
                subtasks: { type: 'array', items: { type: 'string' } },
              },
              required: ['title', 'difficulty'],
            },
          },
          suggestions: { type: 'array', items: { type: 'string' } },
        },
        required: ['name', 'icon', 'goals', 'tasks'],
      },
    });
    const draft = validateModuleDraft(raw);
    if (!draft) return res.status(503).json({ error: "Hunter couldn't draft this module right now. You can build it manually." });
    // Only keep ids that really belong to the module being edited.
    const ids = new Set(current ? (current as { tasks: { id?: string }[] }).tasks.map(t => t.id) : []);
    for (const t of draft.tasks) if (t.id && !ids.has(t.id)) t.id = undefined;
    res.json({ ...draft, tasks: draft.tasks.map(t => ({ ...t, xp: taskXp(t.difficulty) })) });
  } catch (error) {
    console.error('Error drafting module:', error);
    res.status(500).json({ error: 'Failed to draft module' });
  }
});

export default router;
