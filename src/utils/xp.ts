/** XP needed to go from level 1 to level 2 (the base step). */
export const LEVEL_XP = 1000;

/**
 * Rank thresholds — tuned so S-Rank is genuinely hard to reach.
 * E→D→C→B→A are roughly 3x steps; S requires 25,000 XP, which takes
 * many full passes of the permanent tracks (a full DSA pass = 1,500 XP).
 */
export const RANK_THRESHOLDS = [
  { rank: 'E', minXP: 0 },
  { rank: 'D', minXP: 500 },
  { rank: 'C', minXP: 1500 },
  { rank: 'B', minXP: 4000 },
  { rank: 'A', minXP: 10000 },
  { rank: 'S', minXP: 25000 },
] as const;

export type Rank = 'E' | 'D' | 'C' | 'B' | 'A' | 'S';

export interface LevelInfo {
  level: number;
  /** XP at the start of this level. */
  currentLevelXP: number;
  /** XP needed to reach the next level. */
  nextLevelXP: number;
  /** XP earned within the current level. */
  intoLevel: number;
  /** XP still needed for the next level. */
  toNext: number;
}

/**
 * Infinite level curve: reaching level L costs 500·L·(L−1) cumulative XP,
 * so each level is harder than the last and there is no cap.
 *   L1=0 · L2=1,000 · L3=3,000 · L4=6,000 · L5=10,000 · L10=45,000 · L50=1.2M
 */
export function getLevelInfo(xp: number): LevelInfo {
  const level = Math.floor((1 + Math.sqrt(1 + (4 * xp) / 500)) / 2);
  const currentLevelXP = 500 * level * (level - 1);
  const nextLevelXP = 500 * (level + 1) * level;
  return {
    level,
    currentLevelXP,
    nextLevelXP,
    intoLevel: xp - currentLevelXP,
    toNext: nextLevelXP - xp,
  };
}

export function calculateLevel(xp: number): number {
  return getLevelInfo(xp).level;
}

export function calculateRank(xp: number): Rank {
  let rank: Rank = 'E';
  for (const t of RANK_THRESHOLDS) {
    if (xp >= t.minXP) rank = t.rank;
  }
  return rank;
}

/** XP threshold for the next rank, or null at max rank. */
export function getNextRankXP(xp: number): number | null {
  const current = calculateRank(xp);
  const idx = RANK_THRESHOLDS.findIndex(t => t.rank === current);
  const next = RANK_THRESHOLDS[idx + 1];
  return next ? next.minXP : null;
}

/** XP needed to advance from `level` to `level + 1`. */
export function getNextLevelXP(level: number): number {
  return 500 * (level + 1) * level;
}

export function getStreak(completedDates: string[]): number {
  if (!completedDates.length) return 0;
  const sorted = [...completedDates].sort().reverse();
  let streak = 1;
  const today = new Date().toISOString().split('T')[0];

  if (sorted[0] !== today) return 0;

  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const curr = new Date(sorted[i]);
    const diff = (prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24);
    if (diff === 1) streak++;
    else break;
  }
  return streak;
}