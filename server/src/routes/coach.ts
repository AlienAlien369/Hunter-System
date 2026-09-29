import { Router, Request, Response } from 'express';
import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { structuredCompletion } from '../ai.js';
import { hit } from '../middleware/security.js';
import { weekStart } from './leaderboard.js';
import { requestToday } from '../time.js';

// Weekly AI coach (Weekly Report page). The server computes every number;
// the AI only writes the narrative, and a deterministic review is used when
// AI is unavailable. One review is cached per hunter per week; regenerating
// is rate-limited to keep AI cost bounded.
const router = Router();
router.use(authenticateToken);

export interface WeekStats {
  weekStart: string;
  daysElapsed: number;
  xpEarned: number;
  completions: number;
  activeDays: number;
  byDay: { date: string; completions: number; xp: number }[];
  byArea: { area: string; completions: number }[];
  unplanned: string[];
}

export interface CoachReview {
  headline: string;
  wins: string[];
  focus: string[];
  nextWeek: string[];
  source: 'ai' | 'rules';
}

const AREA_LABELS: Record<string, string> = { routine: 'Timetable', hidden: 'Hidden quests', skill: 'Skills', physical: 'Physical', nutrition: 'Nutrition', discipline: 'Discipline', mindset: 'Mindset', health: 'Health', saas: 'SaaS', spiritual: 'Spiritual', architecture: 'Architecture' };
const DAY = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** Aggregate raw completion rows into week stats (pure, unit-tested). */
export function buildWeekStats(
  rows: { date: string; area: string; xp: number }[],
  unplanned: { title: string; xp: number }[],
  start: string,
  today: string,
): WeekStats {
  const days: WeekStats['byDay'] = [];
  const d = new Date(`${start}T00:00:00Z`);
  const end = new Date(`${today}T00:00:00Z`);
  while (d <= end) {
    const key = d.toISOString().split('T')[0];
    const dayRows = rows.filter(r => r.date === key);
    days.push({ date: key, completions: dayRows.length, xp: dayRows.reduce((s, r) => s + r.xp, 0) });
    d.setUTCDate(d.getUTCDate() + 1);
  }
  const areas = new Map<string, number>();
  for (const r of rows) {
    const label = AREA_LABELS[r.area] ?? r.area.charAt(0).toUpperCase() + r.area.slice(1);
    areas.set(label, (areas.get(label) ?? 0) + 1);
  }
  return {
    weekStart: start,
    daysElapsed: days.length,
    xpEarned: rows.reduce((s, r) => s + r.xp, 0) + unplanned.reduce((s, u) => s + u.xp, 0),
    completions: rows.length,
    activeDays: days.filter(x => x.completions > 0).length,
    byDay: days,
    byArea: [...areas].map(([area, completions]) => ({ area, completions })).sort((a, b) => b.completions - a.completions),
    unplanned: unplanned.map(u => u.title).slice(0, 10),
  };
}

const dayName = (date: string) => DAY[(new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7];

/** Deterministic review — used when AI is unavailable (pure, unit-tested). */
export function rulesReview(s: WeekStats): CoachReview {
  if (s.completions === 0 && !s.unplanned.length) {
    return {
      headline: 'A quiet week — every S-Rank started at zero.',
      wins: ['You showed up to check your report. That counts.'],
      focus: ['Pick one quest you can finish in under 10 minutes and do it today.'],
      nextWeek: ['Set up (or trim) your timetable so each day has 2–3 achievable quests.', 'Turn on timetable reminders in Settings.'],
      source: 'rules',
    };
  }
  const best = [...s.byDay].sort((a, b) => b.xp - a.xp)[0];
  const missed = s.byDay.filter(d => d.completions === 0).map(d => dayName(d.date));
  const top = s.byArea[0];
  const weakest = s.byArea.length > 1 ? s.byArea[s.byArea.length - 1] : null;
  const wins = [
    `${s.xpEarned} XP earned across ${s.completions} completed quests.`,
    best && best.xp > 0 ? `${dayName(best.date)} was your strongest day (+${best.xp} XP).` : '',
    top ? `Most consistent area: ${top.area} (${top.completions} completion${top.completions === 1 ? '' : 's'}).` : '',
    s.unplanned.length ? `You logged ${s.unplanned.length} extra activit${s.unplanned.length === 1 ? 'y' : 'ies'} beyond the plan.` : '',
  ].filter(Boolean);
  const focus = [
    missed.length ? `No quests completed on ${missed.join(', ')} — protect those days with one small quest.` : 'You were active every day so far — keep the chain unbroken.',
    weakest && weakest.completions < (top?.completions ?? 0) ? `${weakest.area} got the least attention (${weakest.completions}).` : '',
  ].filter(Boolean);
  return {
    headline: s.activeDays === s.daysElapsed ? `Perfect attendance: ${s.activeDays}/${s.daysElapsed} days active.` : `${s.activeDays} of ${s.daysElapsed} days active — solid ground to build on.`,
    wins,
    focus,
    nextWeek: [
      missed.length ? `Schedule an easy anchor quest on ${missed[0]}.` : 'Raise the bar on one quest (longer session or harder difficulty).',
      'Review your timetable on Sunday evening and adjust what felt heavy.',
    ],
    source: 'rules',
  };
}

function validateReview(raw: unknown): CoachReview | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const list = (v: unknown, max: number) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim()).map(x => x.trim().slice(0, 240)).slice(0, max) : []);
  const headline = typeof o.headline === 'string' ? o.headline.trim().slice(0, 160) : '';
  const review = { headline, wins: list(o.wins, 4), focus: list(o.focus, 3), nextWeek: list(o.nextWeek, 3), source: 'ai' as const };
  return headline && review.wins.length && review.focus.length && review.nextWeek.length ? review : null;
}

async function weekStatsFor(userId: number, today: string): Promise<WeekStats> {
  const start = weekStart(new Date(`${today}T12:00:00Z`)); // the hunter's local week
  const rows = await pool.query(
    `SELECT qc.completion_date::text AS date, q.category AS area, COALESCE(qc.xp_awarded, q.xp_reward)::int AS xp
     FROM quest_completions qc JOIN quests q ON q.id = qc.quest_id
     WHERE qc.user_id = $1 AND qc.completion_date >= $2::date`,
    [userId, start],
  );
  const unplanned = await pool.query(
    `SELECT analysis->>'title' AS title, xp_awarded::int AS xp FROM unplanned_activities
     WHERE user_id = $1 AND status = 'accepted' AND resolved_at >= $2::date ORDER BY resolved_at`,
    [userId, start],
  );
  return buildWeekStats(rows.rows, unplanned.rows, start, today);
}

// GET /api/coach/weekly — this week's cached review (if any) + live stats
router.get('/weekly', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const stats = await weekStatsFor(userId, requestToday(req));
    const cached = await pool.query('SELECT review, created_at FROM coach_reviews WHERE user_id = $1 AND week_start = $2', [userId, stats.weekStart]);
    res.json({ stats, review: cached.rows[0]?.review ?? null, generatedAt: cached.rows[0]?.created_at ?? null });
  } catch (error) {
    console.error('Error fetching coach review:', error);
    res.status(500).json({ error: 'Failed to fetch weekly review' });
  }
});

// POST /api/coach/weekly — generate (or regenerate) this week's review
router.post('/weekly', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const wait = hit(`coach:${userId}`, 3, 24 * 3600_000);
    if (wait) return res.status(429).json({ error: 'You can refresh your review 3 times a day. Try again tomorrow.' });
    const stats = await weekStatsFor(userId, requestToday(req));
    const name = (await pool.query('SELECT name FROM users WHERE id = $1', [userId])).rows[0]?.name ?? 'Hunter';
    const raw = stats.completions + stats.unplanned.length === 0 ? null : await structuredCompletion({
      system:
        'You are the Hunter System coach in a gamified self-improvement app inspired by Solo Leveling. ' +
        'Write a short, specific, encouraging-but-honest weekly review from the stats provided. Reference real numbers and days. ' +
        'Never invent activities that are not in the data. Keep each bullet under 25 words. Address the hunter directly.',
      prompt: JSON.stringify({ hunter: name, ...stats, byDay: stats.byDay.map(d => ({ ...d, day: dayName(d.date) })) }),
      toolName: 'weekly_review',
      schema: {
        type: 'object',
        properties: {
          headline: { type: 'string', description: 'One punchy sentence summarising the week' },
          wins: { type: 'array', items: { type: 'string' }, description: '2-4 concrete wins' },
          focus: { type: 'array', items: { type: 'string' }, description: '1-3 honest areas to improve' },
          nextWeek: { type: 'array', items: { type: 'string' }, description: '2-3 specific actions for next week' },
        },
        required: ['headline', 'wins', 'focus', 'nextWeek'],
      },
    });
    const review = validateReview(raw) ?? rulesReview(stats);
    const saved = await pool.query(
      `INSERT INTO coach_reviews (user_id, week_start, review) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, week_start) DO UPDATE SET review = EXCLUDED.review, created_at = NOW()
       RETURNING created_at`,
      [userId, stats.weekStart, JSON.stringify(review)],
    );
    res.json({ stats, review, generatedAt: saved.rows[0].created_at });
  } catch (error) {
    console.error('Error generating coach review:', error);
    res.status(500).json({ error: 'Failed to generate weekly review' });
  }
});

export default router;
