import { Router, Request, Response } from 'express';
import { pool } from '../db.js';
import { hit } from '../middleware/security.js';
import { calculateLevel, calculateRank } from '../progression.js';
import { weekStart } from './leaderboard.js';
import { activeDays } from './stats.js';
import { currentStreak, isValidTimeZone, localDate } from '../time.js';
import { brandName, publicConfig } from '../platform.js';
import { verifyUnsubscribeToken } from '../reports.js';

// Public hunter profiles (/h/<name>) — the landing page for shared cards and
// invite links. Same privacy as the leaderboard: only hunters who chose a name
// and haven't opted out, and only name, level/rank, streak and XP totals.
const router = Router();

// GET /api/public/hunters/:name
router.get('/hunters/:name', async (req: Request, res: Response) => {
  if (hit(`public-profile:${req.ip}`, 120, 60_000)) return res.status(429).json({ error: 'Too many requests' });
  try {
    const u = (await pool.query(
      `SELECT u.id, u.name, u.xp, u.created_at, r.timezone FROM users u LEFT JOIN routines r ON r.user_id = u.id
       WHERE LOWER(u.name) = LOWER($1) AND u.name_set AND u.show_on_leaderboard`,
      [String(req.params.name).slice(0, 30)],
    )).rows[0];
    if (!u) return res.status(404).json({ error: 'No hunter with that name' });
    const tz = u.timezone && isValidTimeZone(u.timezone) ? u.timezone : 'UTC';
    const [days, week, modules] = await Promise.all([
      activeDays(u.id),
      pool.query(
        `SELECT COALESCE(SUM(xp), 0)::int AS xp FROM (
           SELECT COALESCE(xp_awarded, 0) AS xp FROM quest_completions WHERE user_id = $1 AND completion_date >= $2::date
           UNION ALL
           SELECT COALESCE(xp_awarded, 0) FROM unplanned_activities WHERE user_id = $1 AND status = 'accepted' AND resolved_at >= $2::date
         ) e`,
        [u.id, weekStart()],
      ),
      pool.query(`SELECT icon, name FROM user_modules WHERE user_id = $1 AND status = 'active' ORDER BY id LIMIT 8`, [u.id]),
    ]);
    res.set('Cache-Control', 'public, max-age=60');
    res.json({
      name: u.name,
      level: calculateLevel(u.xp),
      rank: calculateRank(u.xp),
      xp: u.xp,
      weeklyXp: week.rows[0].xp,
      streak: currentStreak(days, localDate(tz)),
      modules: modules.rows.map((m: any) => `${m.icon} ${m.name}`),
      joined: u.created_at,
    });
  } catch (error) {
    console.error('Public profile error:', error);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

// GET /api/public/config — the product's name, tagline and prices (set by the super admin).
// Revalidated on every load (a cheap 304 via ETag) so a rename or price change shows at once.
router.get('/config', (_req: Request, res: Response) => {
  res.set('Cache-Control', 'no-cache');
  res.json(publicConfig());
});

const page = (title: string, body: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f9fafb;color:#111827"><main style="max-width:480px;margin:15vh auto;padding:24px;text-align:center">${body}</main></body></html>`;
const escHtml = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** One-click unsubscribe from a weekly report (link in every email; also the RFC 8058 POST). */
async function unsubscribe(req: Request, res: Response) {
  if (hit(`unsub:${req.ip}`, 60, 60 * 60_000)) return res.status(429).send('Too many requests');
  const id = verifyUnsubscribeToken(req.query.token ?? req.body?.token);
  const brand = escHtml(brandName());
  if (!id) return res.status(400).type('html').send(page('Link not valid', `<h1 style="font-size:20px">This unsubscribe link is not valid.</h1><p style="color:#6b7280">${brand}</p>`));
  try {
    const r = await pool.query('UPDATE report_recipients SET active = false WHERE id = $1 RETURNING email', [id]);
    const email = r.rows[0]?.email ? escHtml(r.rows[0].email) : 'This address';
    res.type('html').send(page('Unsubscribed', `<h1 style="font-size:20px">Unsubscribed</h1><p style="color:#6b7280">${email} will no longer receive this weekly report from ${brand}.</p>`));
  } catch (error) {
    console.error('Unsubscribe error:', error);
    res.status(500).type('html').send(page('Error', '<h1 style="font-size:20px">Something went wrong. Please try again.</h1>'));
  }
}
router.get('/report-unsubscribe', unsubscribe);
router.post('/report-unsubscribe', unsubscribe);

export default router;
