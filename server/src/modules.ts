import type { Pool, PoolClient } from 'pg';
import type { Response } from 'express';
import { routineDifficulty, taskXp, type ModuleTask, type RoutineChange, type RoutineItem } from './rules.js';

type Db = Pool | PoolClient;

export interface ModuleRow {
  id: number;
  slug: string;
  name: string;
  icon: string;
  kind: string;
  status: string;
  goals: string[];
  reward_xp: number;
  created_at: Date;
}

export async function findModule(db: Db, userId: number, key: string | number, lock = false): Promise<ModuleRow | undefined> {
  const byId = /^\d+$/.test(String(key));
  const r = await db.query(
    `SELECT * FROM user_modules WHERE user_id = $1 AND ${byId ? 'id = $2' : 'slug = $2'}${lock ? ' FOR UPDATE' : ''}`,
    [userId, byId ? Number(key) : String(key)],
  );
  return r.rows[0];
}

export const toModuleTask = (q: any): ModuleTask => ({
  id: q.quest_id,
  title: q.title,
  difficulty: q.difficulty,
  scheduleTime: q.schedule_time,
  timeOfDay: q.time_of_day,
  recurrence: q.recurrence,
  subtasks: q.metadata?.subtasks ?? [],
  createdAt: new Date(q.created_at).toISOString(),
});

export async function moduleTaskRows(db: Db, userId: number, slug: string) {
  const r = await db.query(
    `SELECT * FROM quests WHERE user_id = $1 AND category = $2 AND NOT archived ORDER BY schedule_time NULLS LAST, id`,
    [userId, slug],
  );
  return r.rows;
}

/** Insert a CQ-* task (XP always derived from difficulty). */
export async function insertTask(db: Db, userId: number, slug: string, t: ModuleTask, metadata: Record<string, unknown> = {}) {
  const meta = { ...metadata, ...(t.subtasks?.length ? { subtasks: t.subtasks } : {}) };
  const r = await db.query(
    `WITH n AS (SELECT nextval(pg_get_serial_sequence('quests', 'id')) AS id)
     INSERT INTO quests (id, quest_id, user_id, is_daily, title, category, difficulty, xp_reward, schedule_time, time_of_day, recurrence, metadata)
     SELECT n.id, 'CQ-' || n.id, $1, true, $2, $3, $4, $5, $6, $7, $8, $9 FROM n
     RETURNING *`,
    [userId, t.title, slug, t.difficulty, taskXp(t.difficulty), t.scheduleTime, t.timeOfDay, t.recurrence, Object.keys(meta).length ? JSON.stringify(meta) : null],
  );
  return r.rows[0];
}

/**
 * Commitment gate: if a change costs XP, the client must echo the exact net
 * XP it showed the user. Otherwise respond 409 with the preview so the client
 * can ask for confirmation. Pure gains (the module-added reward) need no
 * confirmation. Returns true when the caller may proceed.
 */
export async function confirmGate(db: Db, res: Response, userId: number, changes: RoutineChange[], expected: unknown): Promise<boolean> {
  const netXp = changes.reduce((s, c) => s + c.xp, 0);
  if (netXp >= 0 || Number(expected) === netXp) return true;
  const xp = (await db.query('SELECT xp FROM users WHERE id = $1', [userId])).rows[0].xp as number;
  res.status(409).json({
    error: 'Please confirm the XP impact of this change',
    requiresConfirmation: true,
    changes,
    netXp,
    currentXp: xp,
    newXp: xp + netXp,
  });
  return false;
}

export const xpEntries = (changes: RoutineChange[], action = 'module_change') =>
  changes.filter(c => c.xp !== 0).map(c => ({
    delta: c.xp,
    action,
    entity: c.module,
    details: { kind: c.kind, label: c.label, detail: c.detail, reason: c.reason },
  }));

/**
 * Keep the hunter's timetable quests (CQ-*, category 'routine') in sync with
 * their routine slots: one daily quest per slot, scheduled on the slot's days.
 * Removed slots are archived (completion history and XP stay). XP
 * consequences of timetable changes are handled by the routine diff, so this
 * sync itself never changes XP.
 */
export async function syncRoutineQuests(db: Db, userId: number, items: RoutineItem[]) {
  const rows = (await db.query(
    `SELECT id, metadata->>'routineItemId' AS rid FROM quests WHERE user_id = $1 AND category = 'routine' AND NOT archived`,
    [userId],
  )).rows;
  const byRid = new Map<string, number>(rows.map((r: any) => [r.rid, r.id]));
  for (const it of items) {
    const difficulty = routineDifficulty(it.durationMin);
    const recurrence = it.days.length === 7 ? null : it.days;
    const meta = { routineItemId: it.id, module: it.module, durationMin: it.durationMin };
    const id = byRid.get(it.id);
    if (id) {
      await db.query(
        `UPDATE quests SET title = $2, difficulty = $3, xp_reward = $4, schedule_time = $5, recurrence = $6, metadata = $7 WHERE id = $1`,
        [id, it.title, difficulty, taskXp(difficulty), it.time, recurrence, JSON.stringify(meta)],
      );
      byRid.delete(it.id);
    } else {
      await insertTask(db, userId, 'routine', { title: it.title, difficulty, scheduleTime: it.time, timeOfDay: null, recurrence }, meta);
    }
  }
  for (const id of byRid.values()) await db.query('UPDATE quests SET archived = true WHERE id = $1', [id]);
}
