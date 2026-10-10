import { createHash, randomBytes } from 'crypto';
import { pool } from './db.js';
import { appUrl, sendMail } from './mailer.js';
import { canUseApp } from './age.js';

// Parental consent for hunters aged 13 to 17, and the record of what every
// hunter accepted. The consent token is a bearer link emailed to the parent;
// only its hash is stored and it is never returned to the child's browser, so
// the child cannot approve themselves.

export const TERMS_VERSION = '2026-10-10';
export const PRIVACY_VERSION = '2026-10-10';

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/** Record that the hunter accepted a document version (append-only evidence). */
export async function recordConsent(userId: number, kind: string, version: string, granted = true): Promise<void> {
  await pool.query('INSERT INTO consents (user_id, kind, version, granted) VALUES ($1, $2, $3, $4)', [userId, kind, version, granted]);
}

/** Issue a fresh token for the hunter's parent and email it. Returns whether the email went out. */
export async function issueParentConsent(userId: number, username: string, parentEmail: string): Promise<boolean> {
  const token = randomBytes(32).toString('base64url');
  await pool.query(
    `UPDATE users SET parent_email = $2, parent_token_hash = $3, parent_requested_at = NOW() WHERE id = $1`,
    [userId, parentEmail, hashToken(token)],
  );
  invalidateStatus(userId);
  const link = `${appUrl()}/parent-consent?token=${token}`;
  return sendMail({
    to: parentEmail,
    subject: 'Your child asked to join Hunter System — parental consent needed',
    text:
`Hello,

Someone using the name "${username}" says they are your child and signed up for Hunter System, a productivity app that turns a daily timetable into quests, XP and ranks.

Because they are under 18, we need your permission before they can use it. Nothing is active until you decide.

Review what we collect and decide here:
${link}

You can approve or decline. Declining deletes the account and everything in it. You can use the same link later to withdraw consent, which also deletes the account.

If you do not know who this is, ignore this email: nothing will be activated and the request expires on its own.

Hunter System does not show ads and does not sell personal data.`,
  });
}

// The gate runs on every API request, so the status is cached briefly. The
// cache is per process; this app runs one instance (see security.ts).
const cache = new Map<number, { status: string; until: number }>();
const TTL_MS = 10_000;

export function invalidateStatus(userId: number) {
  cache.delete(userId);
}

export async function consentStatusOf(userId: number, now = Date.now()): Promise<string | null> {
  const hit = cache.get(userId);
  if (hit && hit.until > now) return hit.status;
  const r = await pool.query('SELECT consent_status FROM users WHERE id = $1', [userId]);
  const status: string | null = r.rows[0]?.consent_status ?? null;
  if (status) cache.set(userId, { status, until: now + TTL_MS });
  return status;
}

export { canUseApp };

/** Permanently delete a hunter and everything stored about them (single transaction). */
export async function deleteUserData(userId: number): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // These two tables reference users without ON DELETE CASCADE.
    await client.query('DELETE FROM rank_history WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM daily_stats WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM users WHERE id = $1', [userId]); // everything else cascades
    await client.query('COMMIT');
    invalidateStatus(userId);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export const CONSENT_REQUEST_DAYS = 14;

/** A minor whose parent has not answered within 14 days is removed, as the consent email promises. */
export async function purgeExpiredConsentRequests(): Promise<number> {
  const r = await pool.query(
    `SELECT id FROM users WHERE consent_status = 'pending' AND parent_requested_at < NOW() - make_interval(days => $1)`,
    [CONSENT_REQUEST_DAYS],
  );
  for (const row of r.rows) await deleteUserData(row.id);
  return r.rowCount ?? 0;
}
