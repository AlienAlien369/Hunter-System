import type { GameState } from '../store/gameStore';

// ─── Achievement Definition ─────────────────────────────────────────────────

export type AchievementCategory =
  | 'milestone'    // First completions, firsts
  | 'streak'       // Streak-related
  | 'rank'         // Rank progression
  | 'quest'        // Quest completion counts
  | 'stats'        // Stat allocation
  | 'hidden'       // Hidden quest related
  | 'inventory'    // Loot & inventory
  | 'title'        // Title unlocks
  | 'special'      // Secret / hard-to-get
  | 'daily'        // Daily quest habits
  | 'track'        // Permanent track progress
  | 'penalty'      // Penalty & recovery
  | 'social';      // Profile / meta

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  /** XP bonus awarded on unlock. */
  xpReward: number;
  /** Whether this is a hidden (secret) achievement — description hidden until unlocked. */
  hidden?: boolean;
  /** Condition function — receives full game state, returns true if unlocked. */
  check: (state: GameState) => boolean;
}

// ─── Helper: count completions ──────────────────────────────────────────────

function countCompletions(dailyQuests: GameState['dailyQuests'], prefix?: string, category?: string): number {
  return dailyQuests
    .filter(q => {
      if (prefix && !q.id.startsWith(prefix)) return false;
      if (category && q.category !== category) return false;
      return true;
    })
    .reduce((sum, q) => sum + q.completedDates.length, 0);
}

function countDailyQuestsCompletedOnAnyDay(dailyQuests: GameState['dailyQuests']): number {
  return dailyQuests
    .filter(q => q.id.startsWith('DQ-'))
    .reduce((sum, q) => sum + q.completedDates.length, 0);
}

/** Count how many DQ quests were completed on a specific date. */
function dqCompletedOnDate(dailyQuests: GameState['dailyQuests'], date: string): number {
  return dailyQuests
    .filter(q => q.id.startsWith('DQ-'))
    .filter(q => q.completedDates.includes(date)).length;
}

/** Count total LeetCode problems completed. */
function lcCompleted(dailyQuests: GameState['dailyQuests']): number {
  return dailyQuests.filter(q => q.id.startsWith('LC-') && q.completedDates.length > 0).length;
}

/** Count total SaaS milestones completed. */
function ssCompleted(dailyQuests: GameState['dailyQuests']): number {
  return dailyQuests.filter(q => q.id.startsWith('SS-') && q.completedDates.length > 0).length;
}

/** Count total Arch challenges completed. */
function archCompleted(dailyQuests: GameState['dailyQuests']): number {
  return dailyQuests.filter(q => q.id.startsWith('AR-') && q.completedDates.length > 0).length;
}

// ─── 50+ Achievements ──────────────────────────────────────────────────────

export const ACHIEVEMENTS: AchievementDef[] = [
  // ══════════════════════════════════════════════════════════════════════════
  //  MILESTONE — Firsts & thresholds
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'ACH-001', title: 'First Blood', icon: '🩸', category: 'milestone', xpReward: 50,
    description: 'Complete your very first quest',
    check: (s) => s.dailyQuests.some(q => q.completedDates.length > 0),
  },
  {
    id: 'ACH-002', title: 'Getting Started', icon: '🚀', category: 'milestone', xpReward: 75,
    description: 'Complete 10 quests total',
    check: (s) => countDailyQuestsCompletedOnAnyDay(s.dailyQuests) + lcCompleted(s.dailyQuests) + ssCompleted(s.dailyQuests) + archCompleted(s.dailyQuests) >= 10,
  },
  {
    id: 'ACH-003', title: 'Quest Veteran', icon: '🎖️', category: 'milestone', xpReward: 150,
    description: 'Complete 50 quests total',
    check: (s) => countDailyQuestsCompletedOnAnyDay(s.dailyQuests) + lcCompleted(s.dailyQuests) + ssCompleted(s.dailyQuests) + archCompleted(s.dailyQuests) >= 50,
  },
  {
    id: 'ACH-004', title: 'Quest Master', icon: '🏅', category: 'milestone', xpReward: 300,
    description: 'Complete 100 quests total',
    check: (s) => countDailyQuestsCompletedOnAnyDay(s.dailyQuests) + lcCompleted(s.dailyQuests) + ssCompleted(s.dailyQuests) + archCompleted(s.dailyQuests) >= 100,
  },
  {
    id: 'ACH-005', title: 'Century Club', icon: '💎', category: 'milestone', xpReward: 500,
    description: 'Complete 250 quests total',
    check: (s) => countDailyQuestsCompletedOnAnyDay(s.dailyQuests) + lcCompleted(s.dailyQuests) + ssCompleted(s.dailyQuests) + archCompleted(s.dailyQuests) >= 250,
  },
  {
    id: 'ACH-006', title: 'XP Hoarder', icon: '⚡', category: 'milestone', xpReward: 100,
    description: 'Earn 1,000 total XP',
    check: (s) => s.profile.xp >= 1000,
  },
  {
    id: 'ACH-007', title: 'XP Whale', icon: '🐋', category: 'milestone', xpReward: 250,
    description: 'Earn 5,000 total XP',
    check: (s) => s.profile.xp >= 5000,
  },
  {
    id: 'ACH-008', title: 'XP Titan', icon: '🗿', category: 'milestone', xpReward: 500,
    description: 'Earn 10,000 total XP',
    check: (s) => s.profile.xp >= 10000,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  STREAK — Fire & consistency
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'ACH-101', title: 'On Fire', icon: '🔥', category: 'streak', xpReward: 75,
    description: 'Maintain a 3-day streak',
    check: (s) => {
      const dates = s.dailyQuests.filter(q => q.id.startsWith('DQ-')).flatMap(q => q.completedDates);
      const sorted = [...new Set(dates)].sort().reverse();
      if (!sorted.length || sorted[0] !== new Date().toISOString().split('T')[0]) return false;
      let streak = 1;
      for (let i = 1; i < sorted.length; i++) {
        const diff = (new Date(sorted[i-1]).getTime() - new Date(sorted[i]).getTime()) / 86400000;
        if (diff === 1) streak++; else break;
      }
      return streak >= 3;
    },
  },
  {
    id: 'ACH-102', title: 'Week Warrior', icon: '🗓️', category: 'streak', xpReward: 150,
    description: 'Maintain a 7-day streak',
    check: (s) => {
      const dates = s.dailyQuests.filter(q => q.id.startsWith('DQ-')).flatMap(q => q.completedDates);
      const sorted = [...new Set(dates)].sort().reverse();
      if (!sorted.length || sorted[0] !== new Date().toISOString().split('T')[0]) return false;
      let streak = 1;
      for (let i = 1; i < sorted.length; i++) {
        const diff = (new Date(sorted[i-1]).getTime() - new Date(sorted[i]).getTime()) / 86400000;
        if (diff === 1) streak++; else break;
      }
      return streak >= 7;
    },
  },
  {
    id: 'ACH-103', title: 'Night Owl', icon: '🦉', category: 'streak', xpReward: 200,
    description: 'Wake up at 4:45 AM for 7 different days',
    check: (s) => {
      const wakeUp = s.dailyQuests.find(q => q.id === 'DQ-01');
      return wakeUp ? wakeUp.completedDates.length >= 7 : false;
    },
  },
  {
    id: 'ACH-104', title: 'Iron Will', icon: '🛡️', category: 'streak', xpReward: 300,
    description: 'Maintain a 30-day streak',
    check: (s) => {
      const dates = s.dailyQuests.filter(q => q.id.startsWith('DQ-')).flatMap(q => q.completedDates);
      const allDays = new Set([...dates, ...s.freezeDates]);
      const sorted = [...allDays].sort().reverse();
      if (!sorted.length || sorted[0] !== new Date().toISOString().split('T')[0]) return false;
      let streak = 1;
      for (let i = 1; i < sorted.length; i++) {
        const diff = (new Date(sorted[i-1]).getTime() - new Date(sorted[i]).getTime()) / 86400000;
        if (diff === 1) streak++; else break;
      }
      return streak >= 30;
    },
  },
  {
    id: 'ACH-105', title: 'Unstoppable', icon: '💪', category: 'streak', xpReward: 500,
    description: 'Maintain a 60-day streak',
    hidden: true,
    check: (s) => {
      const dates = s.dailyQuests.filter(q => q.id.startsWith('DQ-')).flatMap(q => q.completedDates);
      const allDays = new Set([...dates, ...s.freezeDates]);
      const sorted = [...allDays].sort().reverse();
      if (!sorted.length || sorted[0] !== new Date().toISOString().split('T')[0]) return false;
      let streak = 1;
      for (let i = 1; i < sorted.length; i++) {
        const diff = (new Date(sorted[i-1]).getTime() - new Date(sorted[i]).getTime()) / 86400000;
        if (diff === 1) streak++; else break;
      }
      return streak >= 60;
    },
  },
  {
    id: 'ACH-106', title: 'Frozen Streak', icon: '❄️', category: 'streak', xpReward: 100,
    description: 'Use a streak freeze for the first time',
    check: (s) => s.freezeDates.length >= 1,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  RANK — Rank progression
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'ACH-201', title: 'Promoted', icon: '📈', category: 'rank', xpReward: 50,
    description: 'Reach D-Rank',
    check: (s) => ['D','C','B','A','S'].includes(s.profile.rank),
  },
  {
    id: 'ACH-202', title: 'C-Rank Hunter', icon: '🔵', category: 'rank', xpReward: 100,
    description: 'Reach C-Rank',
    check: (s) => ['C','B','A','S'].includes(s.profile.rank),
  },
  {
    id: 'ACH-203', title: 'Elite Hunter', icon: '🏆', category: 'rank', xpReward: 200,
    description: 'Reach B-Rank',
    check: (s) => ['B','A','S'].includes(s.profile.rank),
  },
  {
    id: 'ACH-204', title: 'A-Rank Agent', icon: '🌟', category: 'rank', xpReward: 350,
    description: 'Reach A-Rank',
    check: (s) => ['A','S'].includes(s.profile.rank),
  },
  {
    id: 'ACH-205', title: 'S-Rank Legend', icon: '👑', category: 'rank', xpReward: 1000,
    description: 'Reach S-Rank — the pinnacle of hunters',
    check: (s) => s.profile.rank === 'S',
  },
  {
    id: 'ACH-206', title: 'Level 10', icon: '🔟', category: 'rank', xpReward: 100,
    description: 'Reach Level 10',
    check: (s) => s.profile.level >= 10,
  },
  {
    id: 'ACH-207', title: 'Level 25', icon: '🎯', category: 'rank', xpReward: 200,
    description: 'Reach Level 25',
    check: (s) => s.profile.level >= 25,
  },
  {
    id: 'ACH-208', title: 'Level 50', icon: '🔮', category: 'rank', xpReward: 500,
    description: 'Reach Level 50',
    hidden: true,
    check: (s) => s.profile.level >= 50,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  QUEST — Category completions
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'ACH-301', title: 'Disciplined Initiate', icon: '⚔️', category: 'quest', xpReward: 100,
    description: 'Complete 5 discipline quests',
    check: (s) => countCompletions(s.dailyQuests, undefined, 'discipline') >= 5,
  },
  {
    id: 'ACH-302', title: 'Skill Seeker', icon: '📚', category: 'quest', xpReward: 100,
    description: 'Complete 5 skill quests',
    check: (s) => countCompletions(s.dailyQuests, undefined, 'skill') >= 5,
  },
  {
    id: 'ACH-303', title: 'Physical Prowess', icon: '💪', category: 'quest', xpReward: 100,
    description: 'Complete 5 physical quests',
    check: (s) => countCompletions(s.dailyQuests, undefined, 'physical') >= 5,
  },
  {
    id: 'ACH-304', title: 'Nutrition Master', icon: '🥗', category: 'quest', xpReward: 100,
    description: 'Complete 5 nutrition quests',
    check: (s) => countCompletions(s.dailyQuests, undefined, 'nutrition') >= 5,
  },
  {
    id: 'ACH-305', title: 'SaaS Builder', icon: '💻', category: 'quest', xpReward: 150,
    description: 'Complete 5 SaaS quests',
    check: (s) => countCompletions(s.dailyQuests, undefined, 'saas') >= 5,
  },
  {
    id: 'ACH-306', title: 'Mindset Warrior', icon: '🧘', category: 'quest', xpReward: 100,
    description: 'Complete 5 mindset quests',
    check: (s) => countCompletions(s.dailyQuests, undefined, 'mindset') >= 5,
  },
  {
    id: 'ACH-307', title: 'Spiritual Sage', icon: '🕯️', category: 'quest', xpReward: 100,
    description: 'Complete 5 spiritual quests',
    check: (s) => countCompletions(s.dailyQuests, undefined, 'spiritual') >= 5,
  },
  {
    id: 'ACH-308', title: 'Health Guardian', icon: '❤️', category: 'quest', xpReward: 100,
    description: 'Complete 5 health quests',
    check: (s) => countCompletions(s.dailyQuests, undefined, 'health') >= 5,
  },
  {
    id: 'ACH-309', title: 'Daily Devotee', icon: '📅', category: 'quest', xpReward: 200,
    description: 'Complete all 15 daily quests in a single day',
    check: (s) => {
      const today = new Date().toISOString().split('T')[0];
      return dqCompletedOnDate(s.dailyQuests, today) >= 15;
    },
  },
  {
    id: 'ACH-310', title: 'Perfect Day', icon: '✨', category: 'quest', xpReward: 150,
    description: 'Complete 10+ daily quests in a single day',
    check: (s) => {
      const allDates = new Set(s.dailyQuests.filter((q: GameState['dailyQuests'][number]) => q.id.startsWith('DQ-')).flatMap((q: GameState['dailyQuests'][number]) => q.completedDates));
      for (const d of allDates) {
        if (dqCompletedOnDate(s.dailyQuests, d) >= 10) return true;
      }
      return false;
    },
  },
  {
    id: 'ACH-311', title: 'Early Riser', icon: '🌅', category: 'quest', xpReward: 100,
    description: 'Wake up at 4:45 AM for 3 different days',
    check: (s) => {
      const wakeUp = s.dailyQuests.find(q => q.id === 'DQ-01');
      return wakeUp ? wakeUp.completedDates.length >= 3 : false;
    },
  },
  {
    id: 'ACH-312', title: 'Meditation Master', icon: '🧘', category: 'quest', xpReward: 150,
    description: 'Complete meditation 10 times',
    check: (s) => {
      const med = s.dailyQuests.find(q => q.id === 'DQ-02');
      return med ? med.completedDates.length >= 10 : false;
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  TRACK — Permanent track progress
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'ACH-401', title: 'Bug Slayer', icon: '🐛', category: 'track', xpReward: 500,
    description: 'Complete all 75 LeetCode problems',
    check: (s) => lcCompleted(s.dailyQuests) >= 75,
  },
  {
    id: 'ACH-402', title: 'DSA Halfway', icon: '📐', category: 'track', xpReward: 200,
    description: 'Complete 37+ LeetCode problems',
    check: (s) => lcCompleted(s.dailyQuests) >= 37,
  },
  {
    id: 'ACH-403', title: 'SaaS Pioneer', icon: '🚀', category: 'track', xpReward: 300,
    description: 'Complete all SaaS milestones',
    check: (s) => ssCompleted(s.dailyQuests) >= 10, // approximate
  },
  {
    id: 'ACH-404', title: 'Architect', icon: '🧠', category: 'track', xpReward: 300,
    description: 'Complete all Architecture challenges',
    check: (s) => archCompleted(s.dailyQuests) >= 12,
  },
  {
    id: 'ACH-405', title: 'Redo Master', icon: '🔄', category: 'track', xpReward: 200,
    description: 'Redo a permanent track and re-complete it',
    hidden: true,
    check: (s) => {
      // If any LC/SS/AR quest has more than 1 completion event (indicating a redo was done)
      return s.dailyQuests.some(q => (q.id.startsWith('LC-') || q.id.startsWith('SS-') || q.id.startsWith('AR-')) && q.completedDates.length >= 2);
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  STATS — Skill tree allocation
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'ACH-501', title: 'Powerhouse', icon: '💥', category: 'stats', xpReward: 100,
    description: 'Reach STR 40',
    check: (s) => s.profile.stats.str >= 40,
  },
  {
    id: 'ACH-502', title: 'Speed Demon', icon: '⚡', category: 'stats', xpReward: 100,
    description: 'Reach AGI 40',
    check: (s) => s.profile.stats.agi >= 40,
  },
  {
    id: 'ACH-503', title: 'Unbreakable', icon: '🛡️', category: 'stats', xpReward: 100,
    description: 'Reach VIT 40',
    check: (s) => s.profile.stats.vit >= 40,
  },
  {
    id: 'ACH-504', title: 'Grand Sage', icon: '🧙', category: 'stats', xpReward: 100,
    description: 'Reach INT 40',
    check: (s) => s.profile.stats.int >= 40,
  },
  {
    id: 'ACH-505', title: 'Omniscient', icon: '👁️', category: 'stats', xpReward: 100,
    description: 'Reach SEN 40',
    check: (s) => s.profile.stats.sen >= 40,
  },
  {
    id: 'ACH-506', title: 'Maxed Out', icon: '🌟', category: 'stats', xpReward: 500,
    description: 'Reach 80+ in any single stat',
    hidden: true,
    check: (s) => Object.values(s.profile.stats).some(v => v >= 80),
  },
  {
    id: 'ACH-507', title: 'Balanced Build', icon: '⚖️', category: 'stats', xpReward: 200,
    description: 'Have all stats at 20+',
    check: (s) => Object.values(s.profile.stats).every(v => v >= 20),
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  HIDDEN — Hidden quest achievements
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'ACH-601', title: 'Shadow Hunter', icon: '🌑', category: 'hidden', xpReward: 150,
    description: 'Complete a hidden quest',
    check: (s) => s.hiddenQuest?.completedToday === true || s.dailyQuests.some((q: GameState['dailyQuests'][number]) => q.id.startsWith('HQ-') && q.completedDates.length > 0),
  },
  {
    id: 'ACH-602', title: 'Hidden Elite', icon: '🔮', category: 'hidden', xpReward: 300,
    description: 'Complete 5 hidden quests',
    hidden: true,
    check: (s) => s.dailyQuests.filter((q: GameState['dailyQuests'][number]) => q.id.startsWith('HQ-')).reduce((sum, q) => sum + q.completedDates.length, 0) >= 5,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  INVENTORY — Loot collection
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'ACH-701', title: 'Lucky Find', icon: '🍀', category: 'inventory', xpReward: 50,
    description: 'Find your first item drop',
    check: (s) => s.inventory.length >= 1,
  },
  {
    id: 'ACH-702', title: 'Collector', icon: '🎒', category: 'inventory', xpReward: 100,
    description: 'Collect 10 items total',
    check: (s) => s.inventory.length >= 10,
  },
  {
    id: 'ACH-703', title: 'Hoarder', icon: '📦', category: 'inventory', xpReward: 200,
    description: 'Collect 50 items total',
    hidden: true,
    check: (s) => s.inventory.length >= 50,
  },
  {
    id: 'ACH-704', title: 'Legendary Find', icon: '🌟', category: 'inventory', xpReward: 300,
    description: 'Find a Legendary item',
    check: (s) => s.inventory.some((i: GameState['inventory'][number]) => ['supreme_rank_stone', 'title_scroll_legend', 'title_scroll_hunterking'].includes(i.itemId)),
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  TITLE — Title unlocks
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'ACH-801', title: 'Name Dropper', icon: '🏷️', category: 'title', xpReward: 75,
    description: 'Unlock your first title',
    check: (s) => s.unlockedTitles.length >= 1,
  },
  {
    id: 'ACH-802', title: 'Title Collector', icon: '📜', category: 'title', xpReward: 200,
    description: 'Unlock 3 different titles',
    check: (s) => s.unlockedTitles.length >= 3,
  },
  {
    id: 'ACH-803', title: 'Living Legend', icon: '🌟', category: 'title', xpReward: 500,
    description: 'Unlock the Living Legend title',
    check: (s) => s.unlockedTitles.includes('Living Legend'),
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  DAILY — Daily quest habits
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'ACH-901', title: 'Balanced Diet', icon: '🍽️', category: 'daily', xpReward: 100,
    description: 'Complete all 6 nutrition quests in one day',
    check: (s) => {
      const allDates = new Set(s.dailyQuests.filter((q: GameState['dailyQuests'][number]) => q.id.startsWith('DQ-')).flatMap((q: GameState['dailyQuests'][number]) => q.completedDates));
      for (const d of allDates) {
        const nutritionDone = s.dailyQuests
          .filter((q: GameState['dailyQuests'][number]) => q.id.startsWith('DQ-') && q.category === 'nutrition')
          .filter((q: GameState['dailyQuests'][number]) => q.completedDates.includes(d)).length;
        if (nutritionDone >= 6) return true;
      }
      return false;
    },
  },
  {
    id: 'ACH-902', title: 'Martial Artist', icon: '🥋', category: 'daily', xpReward: 150,
    description: 'Attend MMA class 10 times',
    check: (s) => {
      const mma = s.dailyQuests.find((q: GameState['dailyQuests'][number]) => q.id === 'DQ-04');
      return mma ? mma.completedDates.length >= 10 : false;
    },
  },
  {
    id: 'ACH-903', title: 'Sleep disciplined', icon: '🌙', category: 'daily', xpReward: 100,
    description: 'Sleep by 10:45 PM for 7 days',
    check: (s) => {
      const sleep = s.dailyQuests.find((q: GameState['dailyQuests'][number]) => q.id === 'DQ-15');
      return sleep ? sleep.completedDates.length >= 7 : false;
    },
  },
  {
    id: 'ACH-904', title: 'SaaS Marathon', icon: '💻', category: 'daily', xpReward: 200,
    description: 'Log SaaS building time 10 times',
    check: (s) => {
      const saas = s.dailyQuests.find((q: GameState['dailyQuests'][number]) => q.id === 'DQ-11');
      return saas ? saas.completedDates.length >= 10 : false;
    },
  },
  {
    id: 'ACH-905', title: 'System Architect', icon: '📐', category: 'daily', xpReward: 150,
    description: 'Practice system design 10 times',
    check: (s) => {
      const sd = s.dailyQuests.find((q: GameState['dailyQuests'][number]) => q.id === 'DQ-12');
      return sd ? sd.completedDates.length >= 10 : false;
    },
  },
  {
    id: 'ACH-906', title: 'Sportsman', icon: '🏓', category: 'daily', xpReward: 100,
    description: 'Play badminton/table tennis 10 times',
    check: (s) => {
      const sport = s.dailyQuests.find((q: GameState['dailyQuests'][number]) => q.id === 'DQ-14');
      return sport ? sport.completedDates.length >= 10 : false;
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  PENALTY — Penalty & recovery
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'ACH-1001', title: 'Survivor', icon: '🩹', category: 'penalty', xpReward: 75,
    description: 'Recover from a penalty',
    check: (s) => s.recovery !== null,
  },
  {
    id: 'ACH-1002', title: 'Phoenix', icon: '🔥', category: 'penalty', xpReward: 200,
    description: 'Recover from 3 different penalties',
    hidden: true,
    check: (s) => s.recovery !== null && (s.recovery?.streak ?? 0) >= 3,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  SPECIAL — Secret / hard-to-get
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'ACH-1101', title: 'The Chosen One', icon: '✨', category: 'special', xpReward: 1000,
    description: 'Reach S-Rank with all stats at 30+',
    hidden: true,
    check: (s) => s.profile.rank === 'S' && Object.values(s.profile.stats).every(v => Number(v) >= 30),
  },
  {
    id: 'ACH-1102', title: 'Speedrun', icon: '⏩', category: 'special', xpReward: 300,
    description: 'Reach Level 10 in under 7 days of account creation',
    hidden: true,
    check: (s) => {
      const created = new Date(s.profile.createdAt);
      const now = new Date();
      const daysSince = (now.getTime() - created.getTime()) / 86400000;
      return s.profile.level >= 10 && daysSince <= 7;
    },
  },
  {
    id: 'ACH-1103', title: 'True Hunter', icon: '🗡️', category: 'special', xpReward: 500,
    description: 'Complete every quest category at least once',
    check: (s) => {
      const cats = new Set(s.dailyQuests.filter((q: GameState['dailyQuests'][number]) => q.id.startsWith('DQ-')).map((q: GameState['dailyQuests'][number]) => q.category));
      return cats.size >= 8; // discipline, skill, physical, nutrition, saas, mindset, spiritual, health
    },
  },
];

// ─── Utility ────────────────────────────────────────────────────────────────

/** Category display config. */
export const CATEGORY_CONFIG: Record<AchievementCategory, { label: string; icon: string; color: string }> = {
  milestone: { label: 'Milestones',     icon: '🏅', color: 'text-yellow-400' },
  streak:    { label: 'Streaks',        icon: '🔥', color: 'text-orange-400' },
  rank:      { label: 'Rank',           icon: '👑', color: 'text-purple-400' },
  quest:     { label: 'Quests',         icon: '✅', color: 'text-green-400' },
  stats:     { label: 'Stats',          icon: '📊', color: 'text-blue-400' },
  hidden:    { label: 'Hidden Quests',  icon: '🌑', color: 'text-gray-400' },
  inventory: { label: 'Inventory',      icon: '🎒', color: 'text-cyan-400' },
  title:     { label: 'Titles',         icon: '🏷️', color: 'text-pink-400' },
  special:   { label: 'Special',        icon: '✨', color: 'text-amber-400' },
  daily:     { label: 'Daily Habits',   icon: '📅', color: 'text-teal-400' },
  track:     { label: 'Tracks',         icon: '📚', color: 'text-indigo-400' },
  penalty:   { label: 'Recovery',       icon: '🩹', color: 'text-red-400' },
  social:    { label: 'Profile',        icon: '👤', color: 'text-gray-300' },
};
