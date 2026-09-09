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

export function getStreak(completedDates: string[], freezeDates: string[] = []): number {
  if (!completedDates.length && !freezeDates.length) return 0;
  const allDays = new Set([...completedDates, ...freezeDates]);
  const sorted = [...allDays].sort().reverse();
  if (!sorted.length) return 0;
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

/** Compute the longest streak from a set of active days (completions + freezes). */
export function getLongestStreak(completedDates: string[], freezeDates: string[] = []): number {
  const allDays = new Set([...completedDates, ...freezeDates]);
  if (!allDays.size) return 0;
  const sorted = [...allDays].sort();
  let longest = 1;
  let current = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const curr = new Date(sorted[i]);
    const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
    if (diff === 1) {
      current++;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }
  return Math.max(longest, current);
}

/** Total unique days with at least one quest completion. */
export function getTotalActiveDays(completedDates: string[]): number {
  return new Set(completedDates).size;
}

/** How many dailies the hunter completed on a specific date (0-15). */
export function getDayIntensity(date: string, completedDates: string[]): number {
  return completedDates.filter(d => d === date).length;
}

/** Max completions per day (total daily quests). */
export const MAX_DAILY_COMPLETIONS = 15;

// ─── Stat System ───────────────────────────────────────────────────────────

/** Stat points granted per level-up. */
export const STAT_POINTS_PER_LEVEL = 2;

/** Starting stats (10 each, 50 total). */
export const BASE_STATS = { str: 10, agi: 10, vit: 10, int: 10, sen: 10 } as const;

export interface StatThreshold {
  min: number;       // stat value required
  label: string;     // buff name
  description: string; // what it does
  icon: string;      // emoji
  color: string;     // Tailwind text colour class
}

/** Thresholds per stat — each tier unlocks a passive buff. */
export const STAT_CONFIG: Record<string, StatThreshold[]> = {
  str: [
    { min: 20, label: 'Power Strike',     description: '+5% quest XP',            icon: '⚔️', color: 'text-red-400' },
    { min: 40, label: 'Brute Force',      description: '+10% quest XP',           icon: '💥', color: 'text-red-500' },
    { min: 60, label: 'Might',            description: '+15% quest XP',           icon: '🔱', color: 'text-orange-400' },
    { min: 80, label: 'Titan Strength',   description: '+25% quest XP',           icon: '🐉', color: 'text-yellow-400' },
  ],
  agi: [
    { min: 20, label: 'Swift Feet',       description: '+10% extra daily slots',  icon: '👟', color: 'text-green-400' },
    { min: 40, label: 'Shadow Step',      description: '+1 hidden quest hint',    icon: '🌀', color: 'text-teal-400' },
    { min: 60, label: 'Phantom',          description: '+2 hidden quest hints',   icon: '👻', color: 'text-cyan-400' },
    { min: 80, label: 'Lightning Reflex', description: '+3 hidden quest hints',   icon: '⚡', color: 'text-yellow-300' },
  ],
  vit: [
    { min: 20, label: 'Thick Skin',       description: '20% penalty reduction',   icon: '🛡️', color: 'text-green-400' },
    { min: 40, label: 'Iron Will',        description: '35% penalty reduction',   icon: '🔰', color: 'text-emerald-400' },
    { min: 60, label: 'Unbreakable',      description: '50% penalty reduction',   icon: '🏰', color: 'text-gold' },
    { min: 80, label: 'Immortal',         description: '75% penalty reduction',   icon: '💎', color: 'text-yellow-300' },
  ],
  int: [
    { min: 20, label: 'Quick Study',      description: '+5% quest XP',            icon: '📖', color: 'text-blue-400' },
    { min: 40, label: 'Scholar',          description: '+10% quest XP',           icon: '🎓', color: 'text-blue-500' },
    { min: 60, label: 'Sage',             description: '+15% quest XP',           icon: '🧙', color: 'text-indigo-400' },
    { min: 80, label: 'Grand Sage',       description: '+25% quest XP',           icon: '🌟', color: 'text-purple-400' },
  ],
  sen: [
    { min: 20, label: 'Heightened Senses', description: '10% hidden quest chance', icon: '👁️', color: 'text-purple-400' },
    { min: 40, label: 'Premonition',       description: '20% hidden quest chance', icon: '🔮', color: 'text-pink-400' },
    { min: 60, label: 'Sixth Sense',       description: '35% hidden quest chance', icon: '🧠', color: 'text-fuchsia-400' },
    { min: 80, label: 'Omniscience',      description: '50% hidden quest chance',  icon: '👁️‍🗨️', color: 'text-amber-400' },
  ],
};

/** Return the highest buff unlocked for a stat, or null if below first tier. */
export function getStatBuff(statName: string, value: number): StatThreshold | null {
  const tiers = STAT_CONFIG[statName];
  if (!tiers) return null;
  let best: StatThreshold | null = null;
  for (const t of tiers) {
    if (value >= t.min) best = t;
  }
  return best;
}

export interface ActiveBuffs {
  xpMultiplier: number;      // multiplied onto quest XP (e.g. 1.15 = +15%)
  penaltyReduction: number;  // fraction removed from penalties (0.5 = 50% off)
  hiddenQuestHints: number;  // extra hints about the hidden quest
  hiddenQuestChance: number; // bonus % chance to get a hidden quest
  buffs: { stat: string; threshold: StatThreshold }[];
}

/** Compute all active passive buffs from the hunter's stat spread. */
export function getActiveBuffs(stats: { str: number; agi: number; vit: number; int: number; sen: number }): ActiveBuffs {
  let xpMultiplier = 1;
  let penaltyReduction = 0;
  let hiddenQuestHints = 0;
  let hiddenQuestChance = 0;
  const buffs: { stat: string; threshold: StatThreshold }[] = [];

  // STR → XP multiplier
  const strBuff = getStatBuff('str', stats.str);
  if (strBuff) {
    const strBonus = stats.str >= 80 ? 0.25 : stats.str >= 60 ? 0.15 : stats.str >= 40 ? 0.10 : 0.05;
    xpMultiplier += strBonus;
    buffs.push({ stat: 'str', threshold: strBuff });
  }

  // INT → XP multiplier (stacks additively with STR)
  const intBuff = getStatBuff('int', stats.int);
  if (intBuff) {
    const intBonus = stats.int >= 80 ? 0.25 : stats.int >= 60 ? 0.15 : stats.int >= 40 ? 0.10 : 0.05;
    xpMultiplier += intBonus;
    buffs.push({ stat: 'int', threshold: intBuff });
  }

  // VIT → penalty reduction
  const vitBuff = getStatBuff('vit', stats.vit);
  if (vitBuff) {
    penaltyReduction = stats.vit >= 80 ? 0.75 : stats.vit >= 60 ? 0.50 : stats.vit >= 40 ? 0.35 : 0.20;
    buffs.push({ stat: 'vit', threshold: vitBuff });
  }

  // AGI → hidden quest hints
  const agiBuff = getStatBuff('agi', stats.agi);
  if (agiBuff) {
    hiddenQuestHints = stats.agi >= 80 ? 3 : stats.agi >= 60 ? 2 : stats.agi >= 40 ? 1 : 0;
    buffs.push({ stat: 'agi', threshold: agiBuff });
  }

  // SEN → hidden quest chance
  const senBuff = getStatBuff('sen', stats.sen);
  if (senBuff) {
    hiddenQuestChance = stats.sen >= 80 ? 50 : stats.sen >= 60 ? 35 : stats.sen >= 40 ? 20 : 10;
    buffs.push({ stat: 'sen', threshold: senBuff });
  }

  return { xpMultiplier, penaltyReduction, hiddenQuestHints, hiddenQuestChance, buffs };
}

/** Total stat points earned from leveling (2 per level, minus 10 base allocation). */
export function getTotalStatPoints(level: number): number {
  return Math.max(0, (level - 1) * STAT_POINTS_PER_LEVEL);
}

/** Stat points currently available to spend. */
export function getAvailableStatPoints(level: number, stats: { str: number; agi: number; vit: number; int: number; sen: number }): number {
  const earned = getTotalStatPoints(level);
  const allocated = (stats.str + stats.agi + stats.vit + stats.int + stats.sen) - 50; // minus base 10 each
  return Math.max(0, earned - allocated);
}