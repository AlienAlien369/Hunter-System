import { pool } from './db.js';
import { grantPro } from './billing.js';

// Invite 3 friends who each complete a quest and you get a month of Pro.
//  - The friend must do something real (complete a quest) before the invite counts.
//  - Rewards are Pro time only: never XP, rank or leaderboard position.
//  - Capped, so a farm of throwaway accounts earns at most a year of Pro.
export const INVITES_PER_REWARD = 3;
export const REWARD_DAYS = 30;
export const MAX_REWARDS = 12;

/** Called at sign-up when the new hunter arrived through an invite link. Self-invites and repeats are ignored. */
export async function recordReferral(inviterName: string, inviteeId: number): Promise<void> {
  await pool.query(
    `INSERT INTO referrals (inviter_id, invitee_id)
     SELECT t.id, $2 FROM users t WHERE LOWER(t.name) = LOWER($1) AND t.name_set AND t.id <> $2
     ON CONFLICT (invitee_id) DO NOTHING`,
    [inviterName, inviteeId],
  );
}

/** How many reward batches `qualified` invites earn, within the cap. Pure; unit-tested. */
export function rewardsEarned(qualified: number): number {
  return Math.min(MAX_REWARDS, Math.floor(qualified / INVITES_PER_REWARD));
}

/**
 * Called when a hunter completes a quest. The first time, if they were invited,
 * the invite qualifies and the inviter may earn their next month of Pro.
 * Idempotent: each reward batch is granted exactly once even under concurrency.
 */
export async function qualifyReferral(inviteeId: number): Promise<{ inviterId: number; granted: number } | null> {
  const q = await pool.query(
    `UPDATE referrals SET qualified_at = NOW() WHERE invitee_id = $1 AND qualified_at IS NULL RETURNING inviter_id`,
    [inviteeId],
  );
  const inviterId: number | undefined = q.rows[0]?.inviter_id;
  if (!inviterId) return null;
  const qualified = (await pool.query('SELECT COUNT(*)::int AS n FROM referrals WHERE inviter_id = $1 AND qualified_at IS NOT NULL', [inviterId])).rows[0].n as number;
  let granted = 0;
  for (let batch = 1; batch <= rewardsEarned(qualified); batch++) {
    const inserted = await pool.query('INSERT INTO referral_grants (inviter_id, batch) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING batch', [inviterId, batch]);
    if (inserted.rowCount) { await grantPro(inviterId, REWARD_DAYS); granted += 1; }
  }
  return { inviterId, granted };
}

export async function referralStatus(userId: number) {
  const r = (await pool.query(
    `SELECT COUNT(*) FILTER (WHERE qualified_at IS NOT NULL)::int AS qualified,
            COUNT(*) FILTER (WHERE qualified_at IS NULL)::int AS pending
     FROM referrals WHERE inviter_id = $1`,
    [userId],
  )).rows[0];
  const monthsEarned = (await pool.query('SELECT COUNT(*)::int AS n FROM referral_grants WHERE inviter_id = $1', [userId])).rows[0].n as number;
  const capped = monthsEarned >= MAX_REWARDS;
  return {
    qualified: r.qualified as number,
    pending: r.pending as number,
    monthsEarned,
    invitesPerReward: INVITES_PER_REWARD,
    // How many more qualified friends until the next free month (null once the cap is reached).
    nextRewardIn: capped ? null : INVITES_PER_REWARD - (r.qualified % INVITES_PER_REWARD),
    maxMonths: MAX_REWARDS,
    capped,
  };
}
