import type { Pool, PoolClient } from 'pg';
import type { Response } from 'express';
import { taskXp, type ModuleTask, type RoutineChange } from './rules.js';

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
