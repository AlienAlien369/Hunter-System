import type { Request } from 'express';
import { pool } from './db.js';
import { aiAvailable, structuredCompletion, type StructuredRequest } from './ai.js';
import { entitlementForUser, limitsFor } from './billing.js';
import { requestToday } from './time.js';

// AI costs real money, so it has a daily allowance per hunter that depends on
// the plan. The allowance only gates the AI *suggestion*: every feature that
// uses AI already has a manual fallback, and XP is decided by the fixed rules
// either way, so running out never blocks a hunter or changes what they earn.

declare global {
  namespace Express {
    interface Request {
      /** Set when the last AI call was skipped because today's allowance is used up. */
      aiLimited?: boolean;
    }
  }
}

type Completer = (opts: StructuredRequest) => Promise<unknown | null>;
let completer: Completer = structuredCompletion;
/** Test hook. */
export function __setCompleter(fn: Completer | null) { completer = fn ?? structuredCompletion; }

/** Take one unit of today's allowance. Atomic: concurrent requests cannot overshoot the limit. */
export async function takeAiUnit(userId: number, day: string, limit: number): Promise<boolean> {
  const r = await pool.query(
    `INSERT INTO ai_usage (user_id, day, count) VALUES ($1, $2, 1)
     ON CONFLICT (user_id, day) DO UPDATE SET count = ai_usage.count + 1 WHERE ai_usage.count < $3
     RETURNING count`,
    [userId, day, limit],
  );
  return (r.rowCount ?? 0) > 0;
}

async function giveBackAiUnit(userId: number, day: string) {
  await pool.query('UPDATE ai_usage SET count = GREATEST(count - 1, 0) WHERE user_id = $1 AND day = $2', [userId, day]);
}

export async function aiUsedToday(userId: number, day: string): Promise<number> {
  const r = await pool.query('SELECT count FROM ai_usage WHERE user_id = $1 AND day = $2', [userId, day]);
  return r.rows[0]?.count ?? 0;
}

/**
 * Structured AI completion on behalf of the signed-in hunter. Returns null
 * when AI is not configured, the call fails, or the allowance is used up
 * (then `req.aiLimited` is true). A failed call does not use up allowance.
 */
export async function aiCompletion(req: Request, opts: StructuredRequest): Promise<unknown | null> {
  req.aiLimited = false;
  if (!aiAvailable()) return null;
  const userId = req.user!.id;
  const day = requestToday(req);
  const { plan } = await entitlementForUser(userId);
  if (!(await takeAiUnit(userId, day, limitsFor(plan).aiPerDay))) {
    req.aiLimited = true;
    return null;
  }
  const out = await completer(opts);
  if (out === null) await giveBackAiUnit(userId, day);
  return out;
}

/** What to tell the hunter when the allowance is gone. */
export const AI_LIMIT_MESSAGE = "You've used today's AI suggestions. You can still do this manually, and the allowance resets tomorrow (Pro has a much bigger one).";
