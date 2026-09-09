import { Router, Request, Response } from 'express';
import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { logActivity } from '../activity.js';
import { calculateRank } from '../progression.js';

const router = Router();

// GET /api/stats - Get all stats
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    const userRow = userResult.rows[0] || null;

    if (!userRow) {
      return res.status(404).json({ error: 'No user found' });
    }

    // Get today's stats
    const today = new Date().toISOString().split('T')[0];
    const todayStats = await pool.query(
      `SELECT COALESCE(SUM(q.xp_reward), 0) as daily_xp,
              COUNT(qc.id) as quests_completed
       FROM quest_completions qc
       JOIN quests q ON qc.quest_id = q.id
       WHERE qc.completion_date = $1 AND qc.user_id = $2`,
      [today, userId]
    );

    // Get weekly stats
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weeklyStats = await pool.query(
      `SELECT COALESCE(SUM(q.xp_reward), 0) as weekly_xp,
              COUNT(DISTINCT qc.completion_date) as active_days,
              COUNT(qc.id) as total_quests
       FROM quest_completions qc
       JOIN quests q ON qc.quest_id = q.id
       WHERE qc.completion_date >= $1 AND qc.user_id = $2`,
      [weekAgo.toISOString().split('T')[0], userId]
    );

    // Get streak (scoped to this user)
    const streakResult = await pool.query(
      `WITH date_series AS (
        SELECT generate_series(
          COALESCE((SELECT MAX(completion_date) FROM quest_completions WHERE user_id = $1), CURRENT_DATE),
          CURRENT_DATE,
          INTERVAL '1 day'
        )::date AS date
      ),
      completed_dates AS (
        SELECT DISTINCT completion_date FROM quest_completions WHERE user_id = $1
      )
      SELECT COUNT(*) as streak
      FROM date_series ds
      JOIN completed_dates cd ON ds.date = cd.completion_date`,
      [userId]
    );

    const streak = streakResult.rows[0] ? parseInt(streakResult.rows[0].streak) : 0;

    // Missed-daily-quest penalty (scaled by the broken streak) + recovery
    // bonus for rebuilding a 3-day streak (both applied lazily on check-in).
    const { penalty, recovery } = await checkPenaltiesAndRecovery(pool, userId);

    // The penalty/recovery may have adjusted XP/HP — serve the fresh row.
    const fresh = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    const { password_hash: _ph, ...freshUser } = fresh.rows[0];

    res.json({
      user: freshUser,
      daily: todayStats.rows[0],
      weekly: weeklyStats.rows[0],
      streak,
      rank: calculateRank(freshUser.xp),
      penalty,
      recovery,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// PATCH /api/stats - Update user stats
router.patch('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const updates = req.body;
    const allowedFields = ['hp', 'mp', 'str', 'agi', 'vit', 'int', 'sen'];
    const setClauses = allowedFields
      .filter(f => updates[f] !== undefined)
      .map((f, i) => `${f} = $${i + 1}`);
    const values = allowedFields.filter(f => updates[f] !== undefined).map(f => updates[f]);

    if (setClauses.length > 0) {
      values.push(userId);
      await pool.query(
        `UPDATE users SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${setClauses.length + 1}`,
        values
      );
    }

    const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    const { password_hash: _passwordHash, ...user } = result.rows[0];
    await logActivity(userId, 'stats_update', 'profile', updates);
    res.json(user);
  } catch (error) {
    console.error('Error updating stats:', error);
    res.status(500).json({ error: 'Failed to update stats' });
  }
});

// GET /api/stats/progress?period=week|month|quarter|year
// Aggregated progress for the current calendar period, scoped to the user.
// Returns per-bucket (day or month) quest/xp totals plus period totals.
router.get('/progress', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const period = (req.query.period as string) || 'week';
    const now = new Date();

    let start: Date;
    let granularity: 'day' | 'month';
    switch (period) {
      case 'week': {
        const dow = now.getDay(); // 0 = Sunday
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((dow + 6) % 7));
        granularity = 'day';
        break;
      }
      case 'month': {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        granularity = 'day';
        break;
      }
      case 'quarter': {
        const q = Math.floor(now.getMonth() / 3);
        start = new Date(now.getFullYear(), q * 3, 1);
        granularity = 'month';
        break;
      }
      case 'year': {
        start = new Date(now.getFullYear(), 0, 1);
        granularity = 'month';
        break;
      }
      default:
        return res.status(400).json({ error: "period must be 'week', 'month', 'quarter' or 'year'" });
    }

    const startKey = localDateKey(start);
    const rows = await pool.query(
      `SELECT qc.completion_date::text AS date,
              COUNT(qc.id)::int AS quests,
              COALESCE(SUM(q.xp_reward), 0)::int AS xp
       FROM quest_completions qc
       JOIN quests q ON qc.quest_id = q.id
       WHERE qc.user_id = $1 AND qc.completion_date >= $2::date
       GROUP BY qc.completion_date
       ORDER BY qc.completion_date`,
      [userId, startKey]
    );

    const byDate = new Map<string, { quests: number; xp: number }>();
    for (const r of rows.rows) {
      byDate.set(String(r.date), { quests: r.quests, xp: r.xp });
    }

    const buckets: { label: string; quests: number; xp: number }[] = [];
    let questsCompleted = 0;
    let xpEarned = 0;
    const activeDates = new Set<string>();

    if (granularity === 'day') {
      const isWeek = period === 'week';
      for (let d = new Date(start); d <= now; d.setDate(d.getDate() + 1)) {
        const key = localDateKey(d);
        const agg = byDate.get(key) || { quests: 0, xp: 0 };
        buckets.push({
          label: isWeek
            ? d.toLocaleDateString('en-US', { weekday: 'short' })
            : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          quests: agg.quests,
          xp: agg.xp,
        });
        questsCompleted += agg.quests;
        xpEarned += agg.xp;
        if (agg.quests > 0) activeDates.add(key);
      }
    } else {
      const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
      while (cursor <= now) {
        const monthKey = localDateKey(cursor).slice(0, 7);
        let quests = 0;
        let xp = 0;
        for (const [k, v] of byDate) {
          if (k.startsWith(monthKey)) {
            quests += v.quests;
            xp += v.xp;
            if (v.quests > 0) activeDates.add(k);
          }
        }
        buckets.push({
          label: cursor.toLocaleDateString('en-US', { month: 'short' }),
          quests,
          xp,
        });
        questsCompleted += quests;
        xpEarned += xp;
        cursor.setMonth(cursor.getMonth() + 1);
      }
    }

    const daysElapsed = Math.max(1, Math.round((now.getTime() - start.getTime()) / 86400000) + 1);
    res.json({
      period,
      start: startKey,
      granularity,
      buckets,
      totals: {
        quests_completed: questsCompleted,
        xp_earned: xpEarned,
        active_days: activeDates.size,
        days_elapsed: daysElapsed,
        completion_rate: Math.round((activeDates.size / daysElapsed) * 1000) / 10,
      },
    });
  } catch (error) {
    console.error('Error fetching period progress:', error);
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

// GET /api/stats/tracks - Leaderboard-style lifetime stats per permanent track
// (DSA/SaaS/Arch). Counters accrue across redo-alls; quests_done reflects
// the current completion state.
const TRACK_META: { track: string; label: string; icon: string; prefix: string }[] = [
  { track: 'dsa', label: 'DSA', icon: '💻', prefix: 'LC-%' },
  { track: 'saas', label: 'SaaS', icon: '🚀', prefix: 'SS-%' },
  { track: 'arch', label: 'Architecture', icon: '📐', prefix: 'AR-%' },
];

router.get('/tracks', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    const progressRows = await pool.query(
      'SELECT track, total_completions, total_xp, passes FROM track_progress WHERE user_id = $1',
      [userId]
    );
    const progressByTrack = new Map<string, any>();
    for (const r of progressRows.rows) progressByTrack.set(r.track, r);

    const tracks: any[] = [];
    for (const meta of TRACK_META) {
      const total = await pool.query(
        'SELECT COUNT(*)::int AS total FROM quests WHERE quest_id LIKE $1',
        [meta.prefix]
      );
      const done = await pool.query(
        `SELECT COUNT(DISTINCT qc.quest_id)::int AS done,
                MAX(qc.completed_at) AS last
         FROM quest_completions qc
         JOIN quests q ON qc.quest_id = q.id
         WHERE qc.user_id = $1 AND q.quest_id LIKE $2`,
        [userId, meta.prefix]
      );
      const progress = progressByTrack.get(meta.track);
      tracks.push({
        track: meta.track,
        label: meta.label,
        icon: meta.icon,
        total_quests: total.rows[0].total,
        quests_done: done.rows[0].done,
        completions: progress ? parseInt(progress.total_completions) : 0,
        passes: progress ? parseInt(progress.passes) : 0,
        xp_earned: progress ? parseInt(progress.total_xp) : 0,
        last_completed_at: done.rows[0].last ? new Date(done.rows[0].last).toISOString() : null,
      });
    }

    res.json({ tracks });
  } catch (error) {
    console.error('Error fetching track stats:', error);
    res.status(500).json({ error: 'Failed to fetch track stats' });
  }
});

// GET /api/stats/history - Get stat history for charts
router.get('/history', async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const result = await pool.query(
      `SELECT qc.completion_date,
              COUNT(qc.id) as quests_completed,
              COALESCE(SUM(q.xp_reward), 0) as xp_gained
       FROM quest_completions qc
       JOIN quests q ON qc.quest_id = q.id
       WHERE qc.completion_date >= $1 AND qc.user_id = $2
       GROUP BY qc.completion_date
       ORDER BY qc.completion_date ASC`,
      [startDate.toISOString().split('T')[0], req.user?.id ?? null]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

interface PenaltyInfo {
  applied: boolean;
  missed_days: number;
  xp_lost: number;
  hp_lost: number;
  message: string;
}

interface RecoveryInfo {
  applied: boolean;
  bonus_xp: number;
  streak: number;
  message: string;
}

interface PenaltyOutcome {
  penalty: PenaltyInfo | null;
  recovery: RecoveryInfo | null;
}

/**
 * Lazy penalty + recovery check, called from GET /api/stats.
 *
 * Penalty rule: a day "counts" as missed when no daily quest (DQ-*) was
 * completed that day. Once 2+ consecutive full days are missed, the hunter
 * takes a penalty (XP and HP), applied once per gap — the first time the
 * check runs after the gap reaches 2 days. Today's in-progress day never
 * counts for or against the gap, and days before the user's first-ever
 * completion don't count, so a brand-new hunter is never retroactively
 * penalized.
 *
 * Streak scaling: each day of the streak broken by the gap softens the
 * penalty by 5% (up to 60%) — disciplined veterans lose less than newcomers.
 *
 * Recovery rule: after a penalty, rebuilding a 3-day daily-quest streak
 * pays back half the lost XP (25–100 XP), once per penalty.
 */
async function checkPenaltiesAndRecovery(pool: any, userId: number | undefined): Promise<PenaltyOutcome> {
  if (!userId) return { penalty: null, recovery: null };
  // Gate: only hunters who have completed at least one quest are "in the system".
  const first = await pool.query(
    'SELECT MIN(completion_date)::text AS first_date FROM quest_completions WHERE user_id = $1',
    [userId]
  );
  const firstDate = first.rows[0]?.first_date;
  if (!firstDate) return { penalty: null, recovery: null };

  const done = await pool.query(
    `SELECT DISTINCT qc.completion_date::text AS d
     FROM quest_completions qc
     JOIN quests q ON qc.quest_id = q.id
     WHERE qc.user_id = $1 AND q.quest_id LIKE 'DQ-%'`,
    [userId]
  );
  const doneSet: Set<string> = new Set(done.rows.map((r: any) => String(r.d)));

  // Walk backward from yesterday (today is still in progress) and count
  // consecutive full days with zero daily-quest completions.
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  let missed = 0;
  const cursor = new Date(yesterday);
  while (!doneSet.has(localDateKey(cursor))) {
    if (localDateKey(cursor) < firstDate) break; // gap can't start before they began
    missed += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  let penalty: PenaltyInfo | null = null;
  let recovery: RecoveryInfo | null = null;

  if (missed > 0) {
    const missedDays = missed;
    const gapStart = new Date(cursor);
    gapStart.setDate(gapStart.getDate() + 1);
    const gapStartKey = localDateKey(gapStart);
    // The streak the hunter is about to lose (done days right before the gap).
    const brokenStreak = countStreakEndingAt(doneSet, cursor);

    // Already penalized for this exact gap? (A penalty is issued once per gap.)
    const prev = await pool.query(
      'SELECT xp_lost, hp_lost FROM penalties WHERE user_id = $1 AND penalty_date >= $2::date ORDER BY penalty_date DESC LIMIT 1',
      [userId, gapStartKey]
    );
    if (prev.rows.length > 0) {
      penalty = {
        applied: false,
        missed_days: missedDays,
        xp_lost: prev.rows[0].xp_lost,
        hp_lost: prev.rows[0].hp_lost,
        message: `Penalty in effect — you missed ${missedDays} day(s) of daily quests (-${prev.rows[0].xp_lost} XP, -${prev.rows[0].hp_lost} HP).`,
      };
    } else if (missedDays < 2) {
      // One missed day: warn, don't punish yet.
      penalty = {
        applied: false,
        missed_days: 1,
        xp_lost: 0,
        hp_lost: 0,
        message: 'You skipped yesterday\u2019s daily quests. Miss today too and the penalty hits: -50 XP, -15 HP.',
      };
    } else {
      // Streak protection: 5% per day of the broken streak, capped at 60%.
      const protection = Math.min(0.6, brokenStreak * 0.05);
      const xpLost = Math.min(Math.round(25 * missedDays * (1 - protection)), 150);
      const hpLost = Math.max(5, Math.round(15 * (1 - protection)));
      await pool.query(
        'UPDATE users SET xp = GREATEST(0, xp - $1), hp = GREATEST(1, hp - $2), updated_at = NOW() WHERE id = $3',
        [xpLost, hpLost, userId]
      );
      await pool.query(
        `INSERT INTO penalties (user_id, penalty_date, missed_days, broken_streak, xp_lost, hp_lost)
         VALUES ($1, CURRENT_DATE, $2, $3, $4, $5)
         ON CONFLICT (user_id, penalty_date) DO NOTHING`,
        [userId, missedDays, brokenStreak, xpLost, hpLost]
      );
      await logActivity(userId, 'penalty_applied', 'penalty', {
        missed_days: missedDays,
        broken_streak: brokenStreak,
        xp_lost: xpLost,
        hp_lost: hpLost,
      });

      const softened = protection > 0 ? ` Your ${brokenStreak}-day streak softened the blow.` : '';
      penalty = {
        applied: true,
        missed_days: missedDays,
        xp_lost: xpLost,
        hp_lost: hpLost,
        message: `You missed ${missedDays} day(s) of daily quests. -${xpLost} XP, -${hpLost} HP.${softened} The System demands discipline.`,
      };
    }
  }

  // Recovery bonus: rebuild a 3-day daily-quest streak after a penalty and
  // the System pays back half the lost XP (25–100 XP), once per penalty.
  // While the streak holds, the reward keeps being surfaced (applied: false)
  // so the client can show it until the hunter dismisses it.
  const today = new Date();
  const currentStreak = countStreakEndingAt(doneSet, today);
  if (currentStreak >= 3) {
    const pending = await pool.query(
      'SELECT id, xp_lost FROM penalties WHERE user_id = $1 AND recovered = false ORDER BY penalty_date DESC LIMIT 1',
      [userId]
    );
    if (pending.rows.length > 0) {
      const bonusXp = Math.min(100, Math.max(25, Math.round(0.5 * pending.rows[0].xp_lost)));
      await pool.query('UPDATE users SET xp = xp + $1, updated_at = NOW() WHERE id = $2', [bonusXp, userId]);
      await pool.query('UPDATE penalties SET recovered = true WHERE id = $1', [pending.rows[0].id]);
      await logActivity(userId, 'penalty_recovered', 'penalty', { bonus_xp: bonusXp, streak: currentStreak });
      recovery = {
        applied: true,
        bonus_xp: bonusXp,
        streak: currentStreak,
        message: `You rebuilt a ${currentStreak}-day quest streak after your penalty. The System rewards your return: +${bonusXp} XP.`,
      };
    } else {
      const last = await pool.query(
        'SELECT xp_lost FROM penalties WHERE user_id = $1 AND recovered = true ORDER BY penalty_date DESC LIMIT 1',
        [userId]
      );
      if (last.rows.length > 0) {
        const bonusXp = Math.min(100, Math.max(25, Math.round(0.5 * last.rows[0].xp_lost)));
        recovery = {
          applied: false,
          bonus_xp: bonusXp,
          streak: currentStreak,
          message: `You rebuilt a ${currentStreak}-day quest streak after your penalty. The System rewards your return: +${bonusXp} XP.`,
        };
      }
    }
  }

  return { penalty, recovery };
}

/** Consecutive days with a completion ending on (and including) `endDate`. */
function countStreakEndingAt(doneSet: Set<string>, endDate: Date): number {
  let streak = 0;
  const d = new Date(endDate);
  while (doneSet.has(localDateKey(d))) {
    streak += 1;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}


export default router;
