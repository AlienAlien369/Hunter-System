import { Router, Request, Response } from 'express';
import type { Pool, PoolClient } from 'pg';
import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { logActivity } from '../activity.js';
import { applyXp } from '../xp.js';
import { structuredCompletion } from '../ai.js';
import { diffRoutine, sanitizeRoutineItems, validateRoutineSuggestion, XP_RULES, DAYS, RoutineItem } from '../rules.js';

// The Hunter Routine (timetable) contract. Confirming a routine starts a
// 48-hour setup period; afterwards, changes to established commitments carry
// XP consequences computed by rules.diffRoutine. The server always recomputes
// the diff — nothing the client sends about XP is trusted.
const router = Router();
router.use(authenticateToken);

const graceEndsAt = (confirmedAt: string | null) =>
  confirmedAt ? new Date(new Date(confirmedAt).getTime() + XP_RULES.routine.graceHours * 3600_000).toISOString() : null;

function serialize(row: any) {
  if (!row) return null;
  const confirmedAt = row.confirmed_at ? new Date(row.confirmed_at).toISOString() : null;
  const ends = graceEndsAt(confirmedAt);
  return {
    items: row.items as RoutineItem[],
    timezone: row.timezone,
    confirmedAt,
    graceEndsAt: ends,
    established: !!ends && Date.now() >= new Date(ends).getTime(),
  };
}

async function preview(userId: number, rawItems: unknown, db: Pool | PoolClient = pool, lock = false) {
  const row = (await db.query(`SELECT * FROM routines WHERE user_id = $1${lock ? ' FOR UPDATE' : ''}`, [userId])).rows[0];
  const now = new Date();
  const before: RoutineItem[] = row?.items ?? [];
  const items = sanitizeRoutineItems(rawItems, before, now);
  if (typeof items === 'string') return { error: items };
  const confirmedAt = row?.confirmed_at ? new Date(row.confirmed_at).toISOString() : null;
  const diff = diffRoutine(before, items, { now, confirmedAt, rewardedModules: row?.rewarded_modules ?? [] });
  const xp = (await db.query('SELECT xp FROM users WHERE id = $1', [userId])).rows[0].xp as number;
  return { row, items, diff, currentXp: xp, newXp: xp + diff.netXp, isInitial: !row };
}

// GET /api/routine
router.get('/', async (req: Request, res: Response) => {
  try {
    const row = (await pool.query('SELECT * FROM routines WHERE user_id = $1', [req.user!.id])).rows[0];
    res.json({ routine: serialize(row), graceHours: XP_RULES.routine.graceHours });
  } catch (error) {
    console.error('Error fetching routine:', error);
    res.status(500).json({ error: 'Failed to fetch routine' });
  }
});

// POST /api/routine/preview — diff + XP impact, no side effects
router.post('/preview', async (req: Request, res: Response) => {
  try {
    const p = await preview(req.user!.id, req.body.items);
    if ('error' in p) return res.status(400).json({ error: p.error });
    res.json({ changes: p.diff.changes, netXp: p.diff.netXp, established: p.diff.established, currentXp: p.currentXp, newXp: p.newXp, isInitial: p.isInitial });
  } catch (error) {
    console.error('Error previewing routine:', error);
    res.status(500).json({ error: 'Failed to preview routine' });
  }
});

// PUT /api/routine — confirm (first time) or change the routine.
// Body: { items, timezone?, acknowledged? (required first time), expectedNetXp? }
router.put('/', async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const p = await preview(userId, req.body.items, client, true);
    if ('error' in p) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: p.error });
    }
    if (p.isInitial && req.body.acknowledged !== true) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Please acknowledge the Hunter Routine rules before confirming' });
    }
    // The user must have seen (and agreed to) exactly this XP impact.
    if (p.diff.netXp !== 0 && req.body.expectedNetXp !== p.diff.netXp) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'The XP impact changed — please review again', netXp: p.diff.netXp, changes: p.diff.changes });
    }
    const timezone = typeof req.body.timezone === 'string' ? req.body.timezone.slice(0, 64) : null;
    const saved = await client.query(
      `INSERT INTO routines (user_id, items, timezone, confirmed_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         items = EXCLUDED.items,
         timezone = COALESCE(EXCLUDED.timezone, routines.timezone),
         rewarded_modules = routines.rewarded_modules || $4::text[],
         updated_at = NOW()
       RETURNING *`,
      [userId, JSON.stringify(p.items), timezone, p.diff.rewardModules]
    );

    let xpResult = null;
    if (p.isInitial) {
      await client.query(
        `INSERT INTO activity_log (user_id, action, entity, details) VALUES ($1, 'routine_confirm', 'routine', $2)`,
        [userId, JSON.stringify({ xp: 0, slots: p.items.length, modules: [...new Set(p.items.map(i => i.module))] })]
      );
    } else if (p.diff.changes.length) {
      xpResult = await applyXp(client, userId, p.diff.changes.map(c => ({
        delta: c.xp,
        action: 'routine_change',
        entity: c.module,
        details: { kind: c.kind, label: c.label, detail: c.detail, reason: c.reason },
      })));
    }
    await client.query('COMMIT');
    res.json({ routine: serialize(saved.rows[0]), changes: p.diff.changes, netXp: p.diff.netXp, xp: xpResult?.newXp ?? p.currentXp });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error saving routine:', error);
    res.status(500).json({ error: 'Failed to save routine' });
  } finally {
    client.release();
  }
});

// GET /api/routine/history — routine confirmations and changes (from the XP history)
router.get('/history', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id, action, entity, details, created_at FROM activity_log
       WHERE user_id = $1 AND action IN ('routine_confirm', 'routine_change')
       ORDER BY created_at DESC, id DESC LIMIT 100`,
      [req.user!.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching routine history:', error);
    res.status(500).json({ error: 'Failed to fetch routine history' });
  }
});

// POST /api/routine/suggest — AI turns a free-text day description into
// editable routine slots. Suggestions are never saved here.
router.post('/suggest', async (req: Request, res: Response) => {
  const description = typeof req.body.description === 'string' ? req.body.description.trim().slice(0, 1500) : '';
  if (description.length < 10) return res.status(400).json({ error: 'Describe your day in a sentence or two' });
  const raw = await structuredCompletion({
    system:
      'You design realistic daily routines for a gamified productivity app. Convert the user description into timetable slots. ' +
      'Use short module names (e.g. Wake, Skincare, Workout, Work, Coding, Content Creation, Reading, Wind Down). ' +
      'Times are 24h HH:MM. Only include what the user asked for plus sensible wake/wind-down anchors. Days use MON..SUN.',
    prompt: description,
    toolName: 'routine_suggestion',
    schema: {
      type: 'object',
      properties: {
        modules: { type: 'array', items: { type: 'string' } },
        schedule: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              time: { type: 'string', description: 'HH:MM 24h' },
              title: { type: 'string' },
              module: { type: 'string' },
              durationMin: { type: 'number' },
              days: { type: 'array', items: { type: 'string', enum: [...DAYS] } },
            },
            required: ['time', 'title', 'module', 'durationMin'],
          },
        },
        tasks: { type: 'array', items: { type: 'string' } },
        suggestions: { type: 'array', items: { type: 'string' } },
      },
      required: ['modules', 'schedule', 'suggestions'],
    },
  });
  const suggestion = validateRoutineSuggestion(raw);
  if (!suggestion) {
    return res.status(503).json({ error: "Hunter couldn't generate suggestions right now. You can build your routine manually." });
  }
  res.json(suggestion);
});

export default router;
