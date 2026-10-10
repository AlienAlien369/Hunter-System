import webpush from 'web-push';
import { pool } from './db.js';
import { addDays, currentStreak, localDate } from './time.js';
import { weekStart } from './routes/leaderboard.js';
import { activeDays } from './routes/stats.js';

// Web Push reminders. A Monday-morning weekly recap, and the nudge that matters most: at 8pm in the hunter's own
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

const localHour = (tz: string, now: Date) =>
  Number(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hourCycle: 'h23' }).format(now));

/** Is it nudge time for this device (8pm+ local, not yet nudged today)? Pure; unit-tested. */
export function nudgeDue(timezone: string, lastNudged: string | null, now = new Date()): { due: boolean; today: string } {
  const today = localDate(timezone, now);
  return { due: localHour(timezone, now) >= NUDGE_HOUR && lastNudged !== today, today };
}

/** Locales a notification can be written in; anything else is sent in English. */
export type PushLocale = 'en' | 'hi' | 'hi-Latn';
export const pushLocale = (v: unknown): PushLocale => (v === 'hi' || v === 'hi-Latn' ? v : 'en');

export function nudgeMessage(streak: number, locale: PushLocale = 'en'): { title: string; body: string } {
  if (locale === 'hi') {
    return streak > 0
      ? { title: `🔥 ${streak} दिन की स्ट्रीक ख़तरे में`, body: 'स्ट्रीक बचाने के लिए आधी रात से पहले एक क्वेस्ट पूरी करें।' }
      : { title: '⚔️ आपकी क्वेस्ट इंतज़ार कर रही हैं', body: 'आज एक क्वेस्ट से नई स्ट्रीक शुरू होती है। सिस्टम देख रहा है।' };
  }
  if (locale === 'hi-Latn') {
    return streak > 0
      ? { title: `🔥 ${streak} din ki streak khatre mein`, body: 'Streak bachane ke liye aadhi raat se pehle ek quest poori karo.' }
      : { title: '⚔️ Tumhari quests intezaar kar rahi hain', body: 'Aaj ek quest se nayi streak shuru hoti hai. System dekh raha hai.' };
  }
  return streak > 0
    ? { title: `🔥 ${streak}-day streak at risk`, body: 'Complete one quest before midnight to keep it alive.' }
    : { title: '⚔️ Your quests are waiting', body: 'One quest today starts a new streak. The System is watching.' };
}

/** Monday 9am+ local, not yet recapped today. Pure; unit-tested. */
export function recapDue(timezone: string, lastRecap: string | null, now = new Date()): { due: boolean; today: string } {
  const today = localDate(timezone, now);
  const monday = new Date(`${today}T00:00:00Z`).getUTCDay() === 1;
  return { due: monday && localHour(timezone, now) >= 9 && lastRecap !== today, today };
}

export function recapMessage(xp: number, position: number | null, circle: number, locale: PushLocale = 'en'): { title: string; body: string } {
  const withFriends = !!position && circle > 1;
  if (locale === 'hi') {
    const place = withFriends ? ` · ${circle} दोस्तों में #${position}` : '';
    return xp > 0
      ? { title: `📜 साप्ताहिक रिपोर्ट: +${xp.toLocaleString('en-IN')} XP${place}`, body: 'नया हफ़्ता शुरू हुआ। पिछला रिकॉर्ड तोड़िए।' }
      : { title: '📜 नया हफ़्ता शुरू', body: 'पिछला हफ़्ता शांत रहा। बोर्ड पर लौटने के लिए आज एक क्वेस्ट पूरी करें।' };
  }
  if (locale === 'hi-Latn') {
    const place = withFriends ? ` · ${circle} doston mein #${position}` : '';
    return xp > 0
      ? { title: `📜 Weekly report: +${xp.toLocaleString('en-IN')} XP${place}`, body: 'Naya hafta shuru hua. Pichhla record todo.' }
      : { title: '📜 Naya hafta shuru', body: 'Pichhla hafta shaant raha. Board par wapas aane ke liye aaj ek quest poori karo.' };
  }
  const place = withFriends ? ` · #${position} of ${circle} friends` : '';
  return xp > 0
    ? { title: `📜 Weekly report: +${xp.toLocaleString('en-US')} XP${place}`, body: 'A new week just started. Beat your last one.' }
    : { title: '📜 A new week begins', body: 'Last week was quiet. Clear one quest today to get back on the board.' };
}

/** Last week's XP for the hunter and their followed circle (same sources as the weekly leaderboard). */
async function lastWeekStanding(userId: number, now: Date): Promise<{ xp: number; position: number | null; circle: number }> {
  const until = weekStart(now);
  const since = addDays(until, -7);
  const r = await pool.query(
    `WITH circle AS (
       SELECT $1::int AS id
       UNION SELECT f.followee_id FROM friendships f JOIN users u ON u.id = f.followee_id
         WHERE f.follower_id = $1 AND u.name_set AND u.show_on_leaderboard
     )
     SELECT c.id, COALESCE((SELECT SUM(COALESCE(xp_awarded, 0)) FROM quest_completions
                             WHERE user_id = c.id AND completion_date >= $2::date AND completion_date < $3::date), 0)
                + COALESCE((SELECT SUM(COALESCE(xp_awarded, 0)) FROM unplanned_activities
                             WHERE user_id = c.id AND status = 'accepted' AND resolved_at >= $2::date AND resolved_at < $3::date), 0) AS xp
     FROM circle c ORDER BY xp DESC, c.id`,
    [userId, since, until],
  );
  const idx = r.rows.findIndex((x: any) => x.id === userId);
  return { xp: Number(r.rows[idx]?.xp ?? 0), position: idx + 1 || null, circle: r.rows.length };
}

export async function runStreakNudges(now = new Date()): Promise<number> {
  await initPush();
  const subs = (await pool.query(`SELECT id, user_id, endpoint, keys, timezone, locale, last_nudged::text, last_recap::text FROM push_subscriptions`)).rows;
  let sent = 0;
  const send = async (s: any, msg: { title: string; body: string }, url: string) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify({ ...msg, url }), { TTL: 4 * 3600 });
      sent++;
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.statusCode === 410) await pool.query('DELETE FROM push_subscriptions WHERE id = $1', [s.id]);
      else console.error('Push send failed:', e?.statusCode ?? e?.message ?? e);
    }
  };
  for (const s of subs) {
    // Monday weekly recap (claimed per device per day, like the nudge)
    const recap = recapDue(s.timezone, s.last_recap, now);
    if (recap.due) {
      const claimed = await pool.query(
        `UPDATE push_subscriptions SET last_recap = $2::date WHERE id = $1 AND last_recap IS DISTINCT FROM $2::date`,
        [s.id, recap.today],
      );
      if (claimed.rowCount) {
        const st = await lastWeekStanding(s.user_id, now);
        await send(s, recapMessage(st.xp, st.position, st.circle, pushLocale(s.locale)), '/rank');
      }
    }

    const { due, today } = nudgeDue(s.timezone, s.last_nudged, now);
    if (!due) continue;
    // Claim the slot first so overlapping runs never double-send.
    const claimed = await pool.query(
      `UPDATE push_subscriptions SET last_nudged = $2::date WHERE id = $1 AND last_nudged IS DISTINCT FROM $2::date`,
      [s.id, today],
    );
    if (!claimed.rowCount) continue;
    const days = await activeDays(s.user_id);
    if (days.has(today)) continue; // already played today — no nudge
    await send(s, nudgeMessage(currentStreak(days, today), pushLocale(s.locale)), '/quests');
  }
  return sent;
}

// ponytail: in-process timer — a sleeping free-tier instance skips nudges; move to a Render cron job if that matters.
export function startPushScheduler() {
  const tick = () => runStreakNudges().catch(e => console.error('Streak nudges failed:', e));
  setInterval(tick, 10 * 60_000).unref();
}
