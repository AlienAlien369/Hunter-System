import { Router, Request, Response } from 'express';
import type { Pool, PoolClient } from 'pg';
import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { applyXp } from '../xp.js';
import { structuredCompletion } from '../ai.js';
import {
  XP_RULES, DIFFICULTIES, UNPLANNED_CATEGORIES, UnplannedAnalysis, UnplannedFields,
  normalizeText, similarity, unplannedFieldsError, unplannedXp, validateUnplannedAnalysis,
} from '../rules.js';

// "I did something else": unplanned activity → (AI analysis | manual entry)
// → deterministic XP engine + anti-abuse checks → user confirmation → applyXp.
// The AI never decides XP; the client never submits XP.
const router = Router();
router.use(authenticateToken);
const R = XP_RULES.unplanned;

type Db = Pool | PoolClient;

/** XP offer for an analysis, after repeat decay, edit ceiling and the daily cap. */
async function computeOffer(db: Db, userId: number, a: UnplannedAnalysis, source: string, original?: UnplannedAnalysis) {
  const recent = await db.query(
    `SELECT analysis->>'title' AS title, description, xp_awarded, created_at >= CURRENT_DATE AS today
     FROM unplanned_activities
     WHERE user_id = $1 AND status = 'accepted' AND created_at >= NOW() - make_interval(days => $2)`,
    [userId, R.repeatWindowDays]
  );
  const repeats = recent.rows.filter((r: any) => similarity(r.title, a.title) >= R.similarityThreshold).length;
  const acceptedToday = recent.rows.filter((r: any) => r.today);
  const dailyRemaining = Math.max(0, R.dailyXpCap - acceptedToday.reduce((s: number, r: any) => s + (r.xp_awarded ?? 0), 0));

  let xp = unplannedXp(a, repeats);
  if (source === 'manual') xp = Math.min(xp, R.manualMaxXp);
  if (original) xp = Math.min(xp, Math.round(unplannedXp(original, repeats) * R.editBoostCap));
  xp = Math.min(xp, dailyRemaining);

  // Does this look like one of the hunter's existing tasks?
  const quests = await db.query(
    `SELECT q.quest_id, q.title, q.xp_reward FROM quests q
     WHERE ((q.user_id IS NULL AND q.quest_id LIKE 'DQ-%') OR q.user_id = $1) AND NOT q.archived`,
    [userId]
  );
  let similarTask = null;
  let best: number = R.similarityThreshold;
  for (const q of quests.rows) {
    const s = similarity(q.title, a.title);
    if (s >= best) {
      best = s;
      similarTask = { questId: q.quest_id, title: q.title, xpReward: q.xp_reward };
    }
  }
  return {
    xp, repeats, dailyRemaining, similarTask,
    acceptedToday: acceptedToday.length,
    limitReached: acceptedToday.length >= R.dailyAcceptLimit || dailyRemaining === 0,
  };
}

async function exactDuplicateToday(db: Db, userId: number, description: string) {
  const r = await db.query(
    `SELECT description FROM unplanned_activities
     WHERE user_id = $1 AND status = 'accepted' AND created_at >= CURRENT_DATE`,
    [userId]
  );
  const norm = normalizeText(description);
  return r.rows.some((row: any) => normalizeText(row.description) === norm);
}

function readDescription(body: any): string | null {
  const d = typeof body.description === 'string' ? body.description.trim() : '';
  return d.length >= 5 && d.length <= 1000 ? d : null;
}

async function createPending(userId: number, description: string, analysis: UnplannedAnalysis, source: 'ai' | 'manual') {
  const row = await pool.query(
    `INSERT INTO unplanned_activities (user_id, description, analysis, source) VALUES ($1, $2, $3, $4) RETURNING id`,
    [userId, description, JSON.stringify(analysis), source]
  );
  const offer = await computeOffer(pool, userId, analysis, source);
  return { id: row.rows[0].id, source, analysis, ...offer };
}

// POST /api/unplanned/analyze { description }
// → { status: 'analyzed', ... } or { status: 'manual' } when AI can't help.
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const description = readDescription(req.body);
    if (!description) return res.status(400).json({ error: 'Describe what you did (5–1000 characters)' });

    const hourly = await pool.query(
      `SELECT COUNT(*)::int AS n FROM unplanned_activities WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '1 hour'`,
      [userId]
    );
    if (hourly.rows[0].n >= R.hourlyAnalyzeLimit) {
      return res.status(429).json({ error: 'Too many submissions this hour. Try again later.' });
    }
    if (await exactDuplicateToday(pool, userId, description)) {
      return res.status(409).json({ error: 'You already logged this activity today.', duplicate: true });
    }

    const context = await pool.query(
      `SELECT analysis->>'title' AS title FROM unplanned_activities
       WHERE user_id = $1 AND status = 'accepted' ORDER BY created_at DESC LIMIT 10`,
      [userId]
    );
    const modules = await pool.query(
      `SELECT DISTINCT category FROM quests WHERE user_id = $1 AND NOT archived`,
      [userId]
    );
    const raw = await structuredCompletion({
      system:
        'You evaluate activities a user did outside their planned tasks in a gamified self-improvement app. ' +
        'Be honest and conservative: trivial everyday actions (drinking water, scrolling, eating a meal) are trivial and not meaningful. ' +
        'Estimate realistic effort. goalRelevance is 0..1 relative to self-improvement (skills, health, work, content creation). ' +
        'Set duplicate=true if it clearly repeats one of the recent activities. xpSuggestion is your opinion only (0-150).',
      prompt: JSON.stringify({
        activity: description,
        userModules: modules.rows.map((r: any) => r.category),
        recentActivities: context.rows.map((r: any) => r.title),
      }),
      toolName: 'activity_analysis',
      schema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Short task title, max 80 chars' },
          category: { type: 'string', enum: [...UNPLANNED_CATEGORIES] },
          difficulty: { type: 'string', enum: [...DIFFICULTIES] },
          estimatedMinutes: { type: 'number' },
          goalRelevance: { type: 'number' },
          meaningful: { type: 'boolean' },
          trivial: { type: 'boolean' },
          duplicate: { type: 'boolean' },
          xpSuggestion: { type: 'number' },
          reason: { type: 'string', description: 'One sentence explaining the assessment' },
        },
        required: ['title', 'category', 'difficulty', 'estimatedMinutes', 'goalRelevance', 'meaningful', 'trivial', 'duplicate', 'xpSuggestion', 'reason'],
      },
    });
    const analysis = validateUnplannedAnalysis(raw);
    if (!analysis) return res.json({ status: 'manual', message: "Hunter couldn't analyze this activity automatically. You can add it manually." });

    res.json({ status: 'analyzed', ...(await createPending(userId, description, analysis, 'ai')) });
  } catch (error) {
    console.error('Error analyzing unplanned activity:', error);
    res.status(500).json({ error: 'Failed to analyze activity' });
  }
});

// POST /api/unplanned/manual { description, title, category, difficulty, estimatedMinutes }
router.post('/manual', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const description = readDescription(req.body);
    if (!description) return res.status(400).json({ error: 'Describe what you did (5–1000 characters)' });
    const fields: UnplannedFields = {
      title: typeof req.body.title === 'string' ? req.body.title.trim() : '',
      category: req.body.category,
      difficulty: req.body.difficulty,
      estimatedMinutes: Number(req.body.estimatedMinutes),
    };
    const err = unplannedFieldsError(fields);
    if (err) return res.status(400).json({ error: err });
    if (await exactDuplicateToday(pool, userId, description)) {
      return res.status(409).json({ error: 'You already logged this activity today.', duplicate: true });
    }
    const analysis: UnplannedAnalysis = {
      ...fields, goalRelevance: R.defaultRelevance, meaningful: true,
      trivial: fields.estimatedMinutes < R.minMinutes, duplicate: false, xpSuggestion: 0, reason: 'Added manually',
    };
    res.json({ status: 'analyzed', ...(await createPending(userId, description, analysis, 'manual')) });
  } catch (error) {
    console.error('Error creating manual activity:', error);
    res.status(500).json({ error: 'Failed to create activity' });
  }
});

/** Load a pending activity owned by the user and apply optional edits. */
async function loadWithEdits(db: Db, userId: number, id: string, edits: any, lock: boolean) {
  const r = await db.query(
    `SELECT * FROM unplanned_activities WHERE id = $1 AND user_id = $2 AND status = 'pending'${lock ? ' FOR UPDATE' : ''}`,
    [id, userId]
  );
  const row = r.rows[0];
  if (!row) return { error: 'Activity not found', status: 404 };
  const original = row.analysis as UnplannedAnalysis;
  if (!edits) return { row, analysis: original, original: undefined };
  const edited = {
    ...original,
    title: edits.title ?? original.title,
    category: edits.category ?? original.category,
    difficulty: edits.difficulty ?? original.difficulty,
    estimatedMinutes: edits.estimatedMinutes !== undefined ? Number(edits.estimatedMinutes) : original.estimatedMinutes,
  };
  const err = unplannedFieldsError(edited);
  if (err) return { error: err, status: 400 };
  return { row, analysis: edited, original };
}

// POST /api/unplanned/:id/preview { edits } — recompute XP for edited fields
router.post('/:id/preview', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const loaded = await loadWithEdits(pool, userId, req.params.id, req.body.edits, false);
    if ('error' in loaded) return res.status(loaded.status!).json({ error: loaded.error });
    res.json({ analysis: loaded.analysis, ...(await computeOffer(pool, userId, loaded.analysis, loaded.row.source, loaded.original)) });
  } catch (error) {
    console.error('Error previewing activity:', error);
    res.status(500).json({ error: 'Failed to preview activity' });
  }
});

// POST /api/unplanned/:id/accept { edits? } — award XP through the XP authority
router.post('/:id/accept', async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Per-user lock: parallel accepts can't both slip under the daily cap.
    await client.query('SELECT 1 FROM users WHERE id = $1 FOR UPDATE', [userId]);
    const loaded = await loadWithEdits(client, userId, req.params.id, req.body.edits, true);
    if ('error' in loaded) {
      await client.query('ROLLBACK');
      return res.status(loaded.status!).json({ error: loaded.error });
    }
    if (await exactDuplicateToday(client, userId, loaded.row.description)) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'You already logged this activity today.', duplicate: true });
    }
    const offer = await computeOffer(client, userId, loaded.analysis, loaded.row.source, loaded.original);
    if (offer.limitReached || offer.xp <= 0) {
      await client.query('ROLLBACK');
      return res.status(429).json({ error: 'Daily limit for unplanned activities reached. Come back tomorrow!' });
    }
    const result = await applyXp(client, userId, [{
      delta: offer.xp,
      action: 'unplanned_accept',
      entity: loaded.analysis.title,
      details: {
        title: loaded.analysis.title, category: loaded.analysis.category, difficulty: loaded.analysis.difficulty,
        minutes: loaded.analysis.estimatedMinutes, source: loaded.row.source, edited: !!loaded.original,
        repeats: offer.repeats, unplannedId: loaded.row.id,
      },
    }]);
    await client.query(
      `UPDATE unplanned_activities SET status = 'accepted', xp_awarded = $1, analysis = $2, resolved_at = NOW() WHERE id = $3`,
      [offer.xp, JSON.stringify(loaded.analysis), loaded.row.id]
    );
    await client.query('COMMIT');
    res.json({ xpGained: offer.xp, ...result });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error accepting activity:', error);
    res.status(500).json({ error: 'Failed to accept activity' });
  } finally {
    client.release();
  }
});

// POST /api/unplanned/:id/reject
router.post('/:id/reject', async (req: Request, res: Response) => {
  try {
    const r = await pool.query(
      `UPDATE unplanned_activities SET status = 'rejected', resolved_at = NOW()
       WHERE id = $1 AND user_id = $2 AND status = 'pending' RETURNING id`,
      [req.params.id, req.user!.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Activity not found' });
    res.json({ message: 'Activity discarded' });
  } catch (error) {
    console.error('Error rejecting activity:', error);
    res.status(500).json({ error: 'Failed to reject activity' });
  }
});

export default router;
