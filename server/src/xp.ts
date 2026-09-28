import type { Pool, PoolClient } from 'pg';
import { calculateLevel } from './progression.js';

export interface XpEntry {
  delta: number;
  action: string;
  entity?: string;
  /** Logged to activity_log; `xp` defaults to `delta` unless the caller sets it. */
  details?: Record<string, unknown>;
}

/**
 * The single XP authority: every XP change (quest completion/undo, unplanned
 * activity, routine change) goes through here, so users.xp and the
 * activity_log XP history can never disagree. XP may go negative; the level
 * floor is handled by calculateLevel.
 */
export async function applyXp(db: Pool | PoolClient, userId: number, entries: XpEntry[]) {
  const total = entries.reduce((s, e) => s + e.delta, 0);
  const res = await db.query('UPDATE users SET xp = xp + $1, updated_at = NOW() WHERE id = $2 RETURNING xp', [total, userId]);
  for (const e of entries) {
    await db.query(
      'INSERT INTO activity_log (user_id, action, entity, details) VALUES ($1, $2, $3, $4)',
      [userId, e.action, e.entity ?? null, JSON.stringify({ xp: e.delta, ...e.details })],
    );
  }
  const newXp: number = res.rows[0].xp;
  return { previousXp: newXp - total, newXp, delta: total, level: calculateLevel(newXp) };
}
