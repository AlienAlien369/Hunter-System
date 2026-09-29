import webpush from 'web-push';
import { pool } from './db.js';
import { currentStreak, localDate } from './time.js';

// Web Push reminders. The one nudge that matters: at 8pm in the hunter's own
// timezone, if they haven't completed a quest today, remind them before the
// day (and their streak) resets at midnight. At most one per device per day.

export const NUDGE_HOUR = 20;

let publicKey: string | null = null;

/** VAPID keys from the environment, else generated once and kept in app_settings. */
export async function initPush(): Promise<string> {
  if (publicKey) return publicKey;
  let pub = process.env.VAPID_PUBLIC_KEY;
  let priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) {
    const stored = await pool.query(`SELECT key, value FROM app_settings WHERE key IN ('vapid_public', 'vapid_private')`);
    const get = (k: string) => stored.rows.find((r: any) => r.key === k)?.value;
    pub = get('vapid_public');
    priv = get('vapid_private');
    if (!pub || !priv) {
      const keys = webpush.generateVAPIDKeys();
      // First writer wins if two instances race; re-read so every instance agrees.
      await pool.query(
        `INSERT INTO app_settings (key, value) VALUES ('vapid_public', $1), ('vapid_private', $2) ON CONFLICT (key) DO NOTHING`,
        [keys.publicKey, keys.privateKey],
      );
      const again = await pool.query(`SELECT key, value FROM app_settings WHERE key IN ('vapid_public', 'vapid_private')`);
      pub = again.rows.find((r: any) => r.key === 'vapid_public').value;
      priv = again.rows.find((r: any) => r.key === 'vapid_private').value;
    }
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'https://hunters-system.vercel.app', pub!, priv!);
  publicKey = pub!;
  return publicKey;
}

/** Is it nudge time for this device (8pm+ local, not yet nudged today)? Pure; unit-tested. */
export function nudgeDue(timezone: string, lastNudged: string | null, now = new Date()): { due: boolean; today: string } {
  const today = localDate(timezone, now);
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', hourCycle: 'h23' }).format(now));
  return { due: hour >= NUDGE_HOUR && lastNudged !== today, today };
}

export function nudgeMessage(streak: number): { title: string; body: string } {
  return streak > 0
    ? { title: `🔥 ${streak}-day streak at risk`, body: 'Complete one quest before midnight to keep it alive.' }
    : { title: '⚔️ Your quests are waiting', body: 'One quest today starts a new streak. The System is watching.' };
}

export async function runStreakNudges(now = new Date()): Promise<number> {
  await initPush();
  const subs = (await pool.query(`SELECT id, user_id, endpoint, keys, timezone, last_nudged::text FROM push_subscriptions`)).rows;
  let sent = 0;
  for (const s of subs) {
    const { due, today } = nudgeDue(s.timezone, s.last_nudged, now);
    if (!due) continue;
    // Claim the slot first so overlapping runs never double-send.
    const claimed = await pool.query(
      `UPDATE push_subscriptions SET last_nudged = $2::date WHERE id = $1 AND last_nudged IS DISTINCT FROM $2::date`,
      [s.id, today],
    );
    if (!claimed.rowCount) continue;
    const days = new Set((await pool.query(
      `SELECT DISTINCT completion_date::text AS d FROM quest_completions WHERE user_id = $1 AND completion_date >= $2::date - 400`,
      [s.user_id, today],
    )).rows.map((r: any) => r.d));
    if (days.has(today)) continue; // already played today — no nudge
    const { title, body } = nudgeMessage(currentStreak(days, today));
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify({ title, body, url: '/quests' }), { TTL: 4 * 3600 });
      sent++;
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.statusCode === 410) await pool.query('DELETE FROM push_subscriptions WHERE id = $1', [s.id]);
      else console.error('Push send failed:', e?.statusCode ?? e);
    }
  }
  return sent;
}

// ponytail: in-process timer — a sleeping free-tier instance skips nudges; move to a Render cron job if that matters.
export function startPushScheduler() {
  const tick = () => runStreakNudges().catch(e => console.error('Streak nudges failed:', e));
  setInterval(tick, 10 * 60_000).unref();
}
