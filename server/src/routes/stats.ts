import { Router, Request, Response } from 'express';
import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { logActivity } from '../activity.js';

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

    // Never expose the password hash
    const { password_hash, ...user } = userRow;

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

    res.json({
      user,
      daily: todayStats.rows[0],
      weekly: weeklyStats.rows[0],
      streak,
      rank: calculateRank(user.xp),
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
    const { password_hash, ...user } = result.rows[0];
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

function calculateRank(xp: number): string {
  if (xp >= 1750) return 'S';
  if (xp >= 1400) return 'A';
  if (xp >= 1050) return 'B';
  if (xp >= 700) return 'C';
  if (xp >= 350) return 'D';
  return 'E';
}

export default router;
