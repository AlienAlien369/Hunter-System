export const LEVEL_XP = 1000; // XP required per level

export function calculateLevel(xp: number): number {
  return Math.floor(xp / LEVEL_XP) + 1;
}

export function calculateRank(xp: number): 'E' | 'D' | 'C' | 'B' | 'A' | 'S' {
  if (xp >= 1750) return 'S';
  if (xp >= 1400) return 'A';
  if (xp >= 1050) return 'B';
  if (xp >= 700) return 'C';
  if (xp >= 350) return 'D';
  return 'E';
}

export function getNextLevelXP(level: number): number {
  return level * LEVEL_XP;
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