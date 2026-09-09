/**
 * The hidden quest pool (200+ tiered challenges) lives on the SERVER
 * (server/src/data/hiddenQuests.ts) — it is the single source of truth and
 * also seeds the `quests` table so completing a hidden quest awards XP through
 * the normal flow. The client fetches today's quest from
 * GET /api/quests/hidden/today, which picks a level-appropriate challenge and
 * returns the level-scaled XP reward.
 *
 * Only the shared date helper stays client-side.
 */

/** Today's date key (YYYY-MM-DD, UTC — matches the server's completion dates). */
export function todayKey(): string {
  return new Date().toISOString().split('T')[0];
}