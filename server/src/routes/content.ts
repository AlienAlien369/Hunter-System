import { Router, Request, Response } from 'express';
import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { logActivity } from '../activity.js';
import { addDays, requestToday } from '../time.js';

// Content Creation module: channels are plain per-user rows. Content tasks
// are regular custom quests (module 'content', metadata {channelId, stage}),
// so completing them uses the existing quest/XP flow.
const router = Router();
router.use(authenticateToken);

const STATUSES = ['active', 'paused', 'archived'];

export function parseChannel(body: any, partial: boolean): Record<string, unknown> | string {
  const out: Record<string, unknown> = {};
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  if (!partial || body.name !== undefined) {
    out.name = str(body.name, 100);
    if (!out.name) return 'Channel name is required';
  }
  if (!partial || body.platform !== undefined) {
    // Platforms are an open, lowercase slug (instagram, youtube, linkedin, tiktok, x, facebook, other, …)
    out.platform = str(body.platform, 30).toLowerCase();
    if (!/^[a-z0-9][a-z0-9 ._-]*$/.test(out.platform as string)) return 'Platform is required';
  }
  if (body.category !== undefined) out.category = str(body.category, 50) || 'general';
  if (body.postingFrequency !== undefined) out.posting_frequency = str(body.postingFrequency, 50) || null;
  if (body.targetPerWeek !== undefined) {
    const t = Number(body.targetPerWeek);
    if (!Number.isInteger(t) || t < 0 || t > 50) return 'Weekly target must be 0–50';
    out.target_per_week = t;
  }
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) return 'Status must be active, paused or archived';
    out.status = body.status;
  }
  return out;
}

// GET /api/content/channels
router.get('/channels', async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM content_channels WHERE user_id = $1 ORDER BY platform, id', [req.user!.id]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error listing channels:', error);
    res.status(500).json({ error: 'Failed to list channels' });
  }
});

// POST /api/content/channels
router.post('/channels', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const count = await pool.query('SELECT COUNT(*)::int AS n FROM content_channels WHERE user_id = $1', [userId]);
    if (count.rows[0].n >= 30) return res.status(400).json({ error: 'Channel limit reached (30)' });
    const fields = parseChannel(req.body, false);
    if (typeof fields === 'string') return res.status(400).json({ error: fields });
    const cols = Object.keys(fields);
    const result = await pool.query(
      `INSERT INTO content_channels (user_id, ${cols.join(', ')})
       VALUES ($1, ${cols.map((_, i) => `$${i + 2}`).join(', ')}) RETURNING *`,
      [userId, ...Object.values(fields)]
    );
    await logActivity(userId, 'channel_create', result.rows[0].name, { platform: result.rows[0].platform });
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating channel:', error);
    res.status(500).json({ error: 'Failed to create channel' });
  }
});

// PATCH /api/content/channels/:id
router.patch('/channels/:id', async (req: Request, res: Response) => {
  try {
    const fields = parseChannel(req.body, true);
    if (typeof fields === 'string') return res.status(400).json({ error: fields });
    const cols = Object.keys(fields);
    if (!cols.length) return res.status(400).json({ error: 'Nothing to update' });
    const result = await pool.query(
      `UPDATE content_channels SET ${cols.map((c, i) => `${c} = $${i + 3}`).join(', ')}, updated_at = NOW()
       WHERE id = $1 AND user_id = $2 RETURNING *`,
      [req.params.id, req.user!.id, ...Object.values(fields)]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Channel not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating channel:', error);
    res.status(500).json({ error: 'Failed to update channel' });
  }
});

// DELETE /api/content/channels/:id — also archives the channel's content tasks
router.delete('/channels/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const result = await pool.query('DELETE FROM content_channels WHERE id = $1 AND user_id = $2 RETURNING name', [req.params.id, userId]);
    if (!result.rows.length) return res.status(404).json({ error: 'Channel not found' });
    await pool.query(
      `UPDATE quests SET archived = true WHERE user_id = $1 AND metadata->>'channelId' = $2`,
      [userId, String(req.params.id)]
    );
    await logActivity(userId, 'channel_delete', result.rows[0].name);
    res.json({ message: 'Channel deleted' });
  } catch (error) {
    console.error('Error deleting channel:', error);
    res.status(500).json({ error: 'Failed to delete channel' });
  }
});

// GET /api/content/progress — per-channel published count for the last 7 days
// vs the weekly target (a "publishing" stage completion counts as a post).
router.get('/progress', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.target_per_week,
              COUNT(qc.id) FILTER (WHERE q.metadata->>'stage' = 'publishing')::int AS published,
              COUNT(qc.id)::int AS completed
       FROM content_channels c
       LEFT JOIN quests q ON q.user_id = c.user_id AND q.metadata->>'channelId' = c.id::text
       LEFT JOIN quest_completions qc ON qc.quest_id = q.id AND qc.user_id = c.user_id
            AND qc.completion_date >= $2::date
       WHERE c.user_id = $1
       GROUP BY c.id`,
      [req.user!.id, addDays(requestToday(req), -6)]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching content progress:', error);
    res.status(500).json({ error: 'Failed to fetch content progress' });
  }
});

export default router;
