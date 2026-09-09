import { pool } from './db.js';

/**
 * Record an action in the per-user activity log.
 * Every meaningful user action (quest completes, stat edits, nutrition
 * updates, logins, DSA redos) gets written here so there is a full
 * history of "everything I do" in the DB.
 */
export async function logActivity(
  userId: number | undefined,
  action: string,
  entity?: string,
  details?: Record<string, unknown>
): Promise<void> {
  if (!userId) return;
  try {
    await pool.query(
      `INSERT INTO activity_log (user_id, action, entity, details)
       VALUES ($1, $2, $3, $4)`,
      [userId, action, entity || null, details ? JSON.stringify(details) : null]
    );
  } catch (error) {
    // Activity logging must never break the main request
    console.error('Failed to log activity:', error);
  }
}