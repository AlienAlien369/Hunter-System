// Shared rank/level math for the server (mirrors src/utils/xp.ts on the frontend).
// S-Rank is intentionally hard: 25,000 XP, requiring many full passes of the
// permanent tracks (a full DSA pass is 1,500 XP).

export const RANK_THRESHOLDS = [
  { rank: 'E', minXP: 0 },
  { rank: 'D', minXP: 500 },
  { rank: 'C', minXP: 1500 },
  { rank: 'B', minXP: 4000 },
  { rank: 'A', minXP: 10000 },
  { rank: 'S', minXP: 25000 },
] as const;

export function calculateRank(xp: number): string {
  let rank = 'E';
  for (const t of RANK_THRESHOLDS) {
    if (xp >= t.minXP) rank = t.rank;
  }
  return rank;
}

// Infinite level curve: reaching level L costs 500·L·(L−1) cumulative XP.
export function calculateLevel(xp: number): number {
  return Math.floor((1 + Math.sqrt(1 + (4 * xp) / 500)) / 2);
}

/** Cumulative XP required to reach a given level. */
export function levelThreshold(level: number): number {
  return 500 * level * (level - 1);
}