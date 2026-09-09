import { create } from 'zustand';
import type { Quest, Stats, RankProgress, Level, PenaltyInfo, RecoveryInfo } from '../lib/api';
import { api } from '../lib/api';
import { useAuthStore } from './authStore';
import { calculateLevel, calculateRank, getAvailableStatPoints, getActiveBuffs, BASE_STATS } from '../utils/xp';
import { sfx } from '../utils/sounds';
import { todayKey } from '../data/hiddenQuests';
import { ITEMS, rollDrop, createInstanceId, type InventoryItem, type EquippedLoadout, DEFAULT_LOADOUT, getScrollXpBonus, getPotionHeal, getStoneXp, getTitleName } from '../data/items';
import { ACHIEVEMENTS } from '../data/achievements';

export interface HunterProfile {
  name: string;
  rank: 'E' | 'D' | 'C' | 'B' | 'A' | 'S';
  level: number;
  xp: number;
  hp: number;
  mp: number;
  stats: { str: number; agi: number; vit: number; int: number; sen: number };
  createdAt: string;
  lastActive: string;
  // Diet/Calorie tracking
  weightKg?: number;
  heightCm?: number;
  age?: number;
  sex?: 'male' | 'female' | 'other';
  activityLevel?: 'sedentary' | 'light' | 'moderate' | 'active' | 'athlete';
  goal?: 'lose' | 'maintain' | 'gain';
}

export interface DailyQuest {
  id: string;
  title: string;
  xpReward: number;
  category: 'discipline' | 'skill' | 'physical' | 'nutrition' | 'saas' | 'mindset' | 'spiritual' | 'health' | 'architecture';
  completedDates: string[];
}

// LeetCode 75 Questions for DSA
const LEETCODE_75 = [
  { id: 'LC-01', title: 'Two Sum', xpReward: 15, difficulty: 1 },
  { id: 'LC-02', title: 'Add Two Numbers', xpReward: 15, difficulty: 2 },
  { id: 'LC-03', title: 'Longest Substring Without Repeating Characters', xpReward: 20, difficulty: 2 },
  { id: 'LC-04', title: 'Median of Two Sorted Arrays', xpReward: 30, difficulty: 3 },
  { id: 'LC-05', title: 'Longest Palindromic Substring', xpReward: 20, difficulty: 2 },
  { id: 'LC-06', title: 'Zigzag Conversion', xpReward: 15, difficulty: 2 },
  { id: 'LC-07', title: 'Reverse Integer', xpReward: 15, difficulty: 2 },
  { id: 'LC-08', title: 'String to Integer (atoi)', xpReward: 20, difficulty: 2 },
  { id: 'LC-09', title: 'Palindrome Number', xpReward: 10, difficulty: 1 },
  { id: 'LC-10', title: 'Regular Expression Matching', xpReward: 30, difficulty: 3 },
  { id: 'LC-11', title: 'Container With Most Water', xpReward: 20, difficulty: 2 },
  { id: 'LC-12', title: 'Integer to Roman', xpReward: 15, difficulty: 2 },
  { id: 'LC-13', title: 'Roman to Integer', xpReward: 10, difficulty: 1 },
  { id: 'LC-14', title: 'Longest Common Prefix', xpReward: 10, difficulty: 1 },
  { id: 'LC-15', title: '3Sum', xpReward: 25, difficulty: 2 },
  { id: 'LC-16', title: '3Sum Closest', xpReward: 20, difficulty: 2 },
  { id: 'LC-17', title: 'Letter Combinations of a Phone Number', xpReward: 20, difficulty: 2 },
  { id: 'LC-18', title: '4Sum', xpReward: 25, difficulty: 2 },
  { id: 'LC-19', title: 'Remove Nth Node From End of List', xpReward: 15, difficulty: 2 },
  { id: 'LC-20', title: 'Valid Parentheses', xpReward: 10, difficulty: 1 },
  { id: 'LC-21', title: 'Merge Two Sorted Lists', xpReward: 10, difficulty: 1 },
  { id: 'LC-22', title: 'Generate Parentheses', xpReward: 20, difficulty: 2 },
  { id: 'LC-23', title: 'Merge k Sorted Lists', xpReward: 30, difficulty: 3 },
  { id: 'LC-24', title: 'Swap Nodes in Pairs', xpReward: 15, difficulty: 2 },
  { id: 'LC-25', title: 'Reverse Nodes in k-Group', xpReward: 30, difficulty: 3 },
  { id: 'LC-26', title: 'Remove Duplicates from Sorted Array', xpReward: 10, difficulty: 1 },
  { id: 'LC-27', title: 'Remove Element', xpReward: 10, difficulty: 1 },
  { id: 'LC-28', title: 'Find the Index of the First Occurrence in a String', xpReward: 15, difficulty: 1 },
  { id: 'LC-29', title: 'Divide Two Integers', xpReward: 20, difficulty: 2 },
  { id: 'LC-30', title: 'Substring with Concatenation of All Words', xpReward: 30, difficulty: 3 },
  { id: 'LC-31', title: 'Next Permutation', xpReward: 25, difficulty: 2 },
  { id: 'LC-32', title: 'Longest Valid Parentheses', xpReward: 30, difficulty: 3 },
  { id: 'LC-33', title: 'Search in Rotated Sorted Array', xpReward: 20, difficulty: 2 },
  { id: 'LC-34', title: 'Find First and Last Position of Element in Sorted Array', xpReward: 20, difficulty: 2 },
  { id: 'LC-35', title: 'Search Insert Position', xpReward: 10, difficulty: 1 },
  { id: 'LC-36', title: 'Valid Sudoku', xpReward: 20, difficulty: 2 },
  { id: 'LC-37', title: 'Sudoku Solver', xpReward: 30, difficulty: 3 },
  { id: 'LC-38', title: 'Count and Say', xpReward: 15, difficulty: 2 },
  { id: 'LC-39', title: 'Combination Sum', xpReward: 20, difficulty: 2 },
  { id: 'LC-40', title: 'Combination Sum II', xpReward: 20, difficulty: 2 },
  { id: 'LC-41', title: 'First Missing Positive', xpReward: 30, difficulty: 3 },
  { id: 'LC-42', title: 'Trapping Rain Water', xpReward: 30, difficulty: 3 },
  { id: 'LC-43', title: 'Multiply Strings', xpReward: 20, difficulty: 2 },
  { id: 'LC-44', title: 'Wildcard Matching', xpReward: 30, difficulty: 3 },
  { id: 'LC-45', title: 'Jump Game II', xpReward: 25, difficulty: 2 },
  { id: 'LC-46', title: 'Permutations', xpReward: 20, difficulty: 2 },
  { id: 'LC-47', title: 'Permutations II', xpReward: 20, difficulty: 2 },
  { id: 'LC-48', title: 'Rotate Image', xpReward: 20, difficulty: 2 },
  { id: 'LC-49', title: 'Group Anagrams', xpReward: 20, difficulty: 2 },
  { id: 'LC-50', title: 'Pow(x, n)', xpReward: 20, difficulty: 2 },
  { id: 'LC-51', title: 'N-Queens', xpReward: 30, difficulty: 3 },
  { id: 'LC-52', title: 'N-Queens II', xpReward: 30, difficulty: 3 },
  { id: 'LC-53', title: 'Maximum Subarray', xpReward: 15, difficulty: 1 },
  { id: 'LC-54', title: 'Spiral Matrix', xpReward: 20, difficulty: 2 },
  { id: 'LC-55', title: 'Jump Game', xpReward: 20, difficulty: 2 },
  { id: 'LC-56', title: 'Merge Intervals', xpReward: 25, difficulty: 2 },
  { id: 'LC-57', title: 'Insert Interval', xpReward: 25, difficulty: 2 },
  { id: 'LC-58', title: 'Length of Last Word', xpReward: 10, difficulty: 1 },
  { id: 'LC-59', title: 'Spiral Matrix II', xpReward: 20, difficulty: 2 },
  { id: 'LC-60', title: 'Permutation Sequence', xpReward: 30, difficulty: 3 },
  { id: 'LC-61', title: 'Rotate List', xpReward: 20, difficulty: 2 },
  { id: 'LC-62', title: 'Unique Paths', xpReward: 20, difficulty: 2 },
  { id: 'LC-63', title: 'Unique Paths II', xpReward: 20, difficulty: 2 },
  { id: 'LC-64', title: 'Minimum Path Sum', xpReward: 20, difficulty: 2 },
  { id: 'LC-65', title: 'Valid Number', xpReward: 30, difficulty: 3 },
  { id: 'LC-66', title: 'Plus One', xpReward: 10, difficulty: 1 },
  { id: 'LC-67', title: 'Add Binary', xpReward: 10, difficulty: 1 },
  { id: 'LC-68', title: 'Text Justification', xpReward: 30, difficulty: 3 },
  { id: 'LC-69', title: 'Sqrt(x)', xpReward: 15, difficulty: 1 },
  { id: 'LC-70', title: 'Climbing Stairs', xpReward: 10, difficulty: 1 },
  { id: 'LC-71', title: 'Simplify Path', xpReward: 20, difficulty: 2 },
  { id: 'LC-72', title: 'Edit Distance', xpReward: 25, difficulty: 2 },
  { id: 'LC-73', title: 'Set Matrix Zeroes', xpReward: 20, difficulty: 2 },
  { id: 'LC-74', title: 'Search a 2D Matrix', xpReward: 15, difficulty: 2 },
  { id: 'LC-75', title: 'Sort Colors', xpReward: 15, difficulty: 2 },
];

// Combine default quests with LeetCode 75
const DEFAULT_QUESTS: Omit<DailyQuest, 'completedDates'>[] = [
  // Discipline
  { id: 'DQ-01', title: 'Wake Up at 4:45 AM', xpReward: 10, category: 'discipline' },
  { id: 'DQ-02', title: 'Meditation 10-15 min', xpReward: 10, category: 'mindset' },
  // DSA - LeetCode 75
  ...LEETCODE_75.map(lc => ({
    id: lc.id,
    title: lc.title,
    xpReward: lc.xpReward,
    category: 'skill' as const,
  })),
  // Physical
  { id: 'DQ-04', title: 'Attend MMA Class (Mon-Fri)', xpReward: 20, category: 'physical' },
  // Nutrition
  { id: 'DQ-05', title: 'Consume Fit Feast Pouch', xpReward: 5, category: 'nutrition' },
  { id: 'DQ-06', title: 'Drink 500ml Milk', xpReward: 5, category: 'nutrition' },
  { id: 'DQ-07', title: 'Eat 50g Oats', xpReward: 5, category: 'nutrition' },
  { id: 'DQ-08', title: 'Eat 150g Paneer', xpReward: 5, category: 'nutrition' },
  { id: 'DQ-09', title: 'Eat 30g Roasted Chana', xpReward: 5, category: 'nutrition' },
  { id: 'DQ-10', title: 'Eat 20g Peanuts', xpReward: 5, category: 'nutrition' },
  // SaaS
  { id: 'DQ-11', title: 'SaaS Building Time', xpReward: 20, category: 'saas' },
  // Mindset/Spiritual/Health
  { id: 'DQ-12', title: 'System Design Practice', xpReward: 20, category: 'skill' },
  { id: 'DQ-13', title: 'Satsang Attendance', xpReward: 20, category: 'spiritual' },
  { id: 'DQ-14', title: 'Badminton/TT', xpReward: 25, category: 'physical' },
  { id: 'DQ-15', title: 'Sleep by 10:45 PM', xpReward: 10, category: 'health' },
];

interface GameState {
  // Data
  profile: HunterProfile;
  quests: Quest[];
  stats: Stats | null;
  rank: RankProgress | null;
  levels: Level[] | null;
  dailyQuests: DailyQuest[];
  nutritionEntries: Map<string, NutritionItem[]>;
  budgetItems: BudgetItem[];
  archChallenges: ArchChallenge[];

  // Solo Leveling-style hidden quest: one random challenge per day, only
  // completable that same day. Picked server-side from the 200+ tiered pool,
  // scaled to the hunter's level. `revealed` flips when the player accepts it.
  hiddenQuest: {
    questId: string;
    date: string;
    revealed: boolean;
    title: string;
    description: string;
    icon: string;
    baseXp: number;
    xpReward: number;
    difficulty: number;
    tierName: string;
    tierIndex: number;
    tierMinLevel: number;
    multiplier: number;
    completedToday: boolean;
  } | null;
  // Streak freezes: days that count as active even if no quests were completed.
  // Consumed automatically when a streak would otherwise break.
  freezeCount: number;
  freezeDates: string[]; // dates that were frozen

  // Inventory & loot system
  inventory: InventoryItem[];
  equipped: EquippedLoadout;
  /** Current loot drop to display (null = none). */
  lootDrop: { itemId: string; instanceId: string } | null;
  /** Titles unlocked from title scrolls. */
  unlockedTitles: string[];
  /** Achievement IDs that have been unlocked. */
  unlockedAchievements: string[];
  /** IDs of achievements newly unlocked this session (for notification). */
  newAchievements: string[];

  // Latest missed-daily-quest penalty info from the server (null = no penalty).
  penalty: PenaltyInfo | null;
  // Streak-recovery bonus granted after rebuilding 3 days post-penalty.
  recovery: RecoveryInfo | null;

  // Loading states
  loading: boolean;
  error: string | null;
  apiConnected: boolean;

  // Queue of celebrations: each level/rank crossing enqueues, the banner
  // plays them one at a time in order so rapid quest completions never
  // overwrite each other's fanfare.
  celebrations: Celebration[];

  // Floating XP notifications for every quest completion (not just milestones)
  xpFloats: XpFloat[];

  // Actions
  loadDashboard: () => Promise<void>;
  completeQuest: (questId: string, date: string) => Promise<void>;
  redoTrack: (track: 'dsa' | 'saas' | 'arch') => Promise<void>;
  dismissCelebration: () => void;
  pushXpFloat: (amount: number) => void;
  removeXpFloat: (id: number) => void;
  updateProfile: (updates: Partial<HunterProfile>) => void;
  loadNutrition: (month: string) => Promise<void>;
  logNutrition: (date: string, items: NutritionItem[]) => void;
  saveArchDecision: (week: number, data: Partial<ArchChallenge>) => void;
  toggleApiConnection: (connected: boolean) => void;
  /** Reveal today's hidden quest (once per day). */
  revealHiddenQuest: () => void;
  /** Purchase a streak freeze for the given XP cost. */
  buyFreeze: (cost: number) => void;
  /** Use a freeze on a specific date to preserve the streak. */
  useFreeze: (date: string) => void;
  /** Allocate a stat point (str/agi/vit/int/sen). */
  allocateStat: (stat: 'str' | 'agi' | 'vit' | 'int' | 'sen') => void;
  /** Deallocate a stat point (refund). */
  deallocateStat: (stat: 'str' | 'agi' | 'vit' | 'int' | 'sen') => void;
  /** Add an item to inventory after a loot drop. */
  addItem: (itemId: string) => void;
  /** Use a consumable item from inventory. */
  useItem: (instanceId: string) => void;
  /** Equip a title scroll. */
  equipTitle: (itemId: string) => void;
  /** Unequip current title. */
  unequipTitle: () => void;
  /** Activate an XP boost scroll (lasts N quests). */
  equipXpBoost: (itemId: string) => void;
  /** Deactivate the current XP boost. */
  deactivateXpBoost: () => void;
  /** Set the current loot drop notification (null to dismiss). */
  setLootDrop: (drop: { itemId: string; instanceId: string } | null) => void;
  /** Check all achievements against current state, return newly unlocked. */
  checkAchievements: () => string[];
  /** Dismiss the new-achievement notification. */
  dismissNewAchievements: () => void;
}

export interface NutritionItem {
  name: string;
  protein: number;
  cost: number;
  consumed: boolean;
}

export interface BudgetItem {
  category: string;
  target: number;
  actual: number;
}

export interface ArchChallenge {
  week: number;
  scenario: string;
  scale: string;
  decision: string;
  why: string;
  tradeoffs: string;
  done: boolean;
}

export interface Celebration {
  type: 'level' | 'rank' | 'both';
  level: number;
  rank: string;
  newXp: number;
  /** Big milestones (rank changes, every-5th level) get the full-screen overlay. */
  big: boolean;
}

/** Transient floating XP notification (positive = gain, negative = undo). */
export interface XpFloat {
  id: number;
  amount: number;
}

// Local storage keys (scoped per user so accounts never see each other's data)
const STORAGE_KEY = 'hunter_system_v1';

function getStorageKey(): string {
  const username = useAuthStore.getState().user?.username;
  return username ? `${STORAGE_KEY}_${username}` : STORAGE_KEY;
}

function loadFromLocalStorage(): Partial<GameState> | null {
  try {
    const data = localStorage.getItem(getStorageKey());
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Failed to load from localStorage:', e);
  }
  return null;
}

function saveToLocalStorage(state: Partial<GameState>) {
  try {
    const { dailyQuests, profile, hiddenQuest, freezeCount, freezeDates, inventory, equipped, unlockedTitles, unlockedAchievements } = state;
    localStorage.setItem(getStorageKey(), JSON.stringify({
      dailyQuests,
      profile,
      hiddenQuest,
      freezeCount,
      freezeDates,
      inventory,
      equipped,
      unlockedTitles,
      unlockedAchievements,
    }));
  } catch (e) {
    console.error('Failed to save to localStorage:', e);
  }
}

let floatId = 0;

export const useGameStore = create<GameState>((set, get) => ({
  profile: {
    name: 'Hunter',
    rank: 'E',
    level: 1,
    xp: 0,
    hp: 80,
    mp: 60,
    stats: { str: 10, agi: 10, vit: 10, int: 10, sen: 10 },
    createdAt: new Date().toISOString(),
    lastActive: new Date().toISOString(),
  },
  quests: [],
  stats: null,
  rank: null,
  levels: null,
  dailyQuests: DEFAULT_QUESTS.map(q => ({ ...q, completedDates: [] })),
  nutritionEntries: new Map(),
  budgetItems: [],
  archChallenges: [],
  freezeCount: 0,
  freezeDates: [],
  inventory: [],
  equipped: { ...DEFAULT_LOADOUT },
  lootDrop: null,
  unlockedTitles: [],
  unlockedAchievements: [],
  newAchievements: [],
  hiddenQuest: null,
  penalty: null,
  recovery: null,
  loading: false,
  error: null,
  apiConnected: false,
  celebrations: [],
  xpFloats: [],

  loadDashboard: async () => {
    set({ loading: true, error: null });
    try {
      const [statsData, rankData, questsData, hqToday] = await Promise.all([
        api.getStats(),
        api.getRank(),
        api.getQuests(),
        api.getTodaysHiddenQuest(),
      ]);

      // Update daily quests with API data
      const updatedQuests: DailyQuest[] = questsData.map(q => ({
        id: q.quest_id,
        title: q.title,
        xpReward: q.xp_reward,
        category: q.category as DailyQuest['category'],
        completedDates: q.completions?.map(c => c.completion_date) || [],
      }));

      // Detect level/rank milestones crossed by this XP gain (skip initial load: prevXp 0)
      const prevXp = get().profile.xp;
      const newXp = statsData.user.xp;
      let celebration: Celebration | null = null;
      if (prevXp > 0 && newXp > prevXp) {
        const newLevel = calculateLevel(newXp);
        const prevRank = calculateRank(prevXp);
        const newRank = calculateRank(newXp);
        const levelUp = newLevel > calculateLevel(prevXp);
        const rankUp = newRank !== prevRank;
        if (levelUp || rankUp) {
          celebration = {
            type: levelUp && rankUp ? 'both' : levelUp ? 'level' : 'rank',
            level: newLevel,
            rank: newRank,
            newXp,
            // Rank changes are always big; pure level-ups celebrate every 5th level
            big: rankUp || (levelUp && newLevel % 5 === 0),
          };
        }
      }

      // Keep today's hidden quest stable: same challenge all day, resets tomorrow.
      // The quest itself comes from the server (level-tiered pool, scaled XP).
      const storedHq = get().hiddenQuest;
      const hq = {
        questId: hqToday.id,
        date: todayKey(),
        title: hqToday.title,
        description: hqToday.description,
        icon: hqToday.icon,
        baseXp: hqToday.baseXp,
        xpReward: hqToday.xpReward,
        difficulty: hqToday.difficulty,
        tierName: hqToday.tier.name,
        tierIndex: hqToday.tier.index,
        tierMinLevel: hqToday.tier.minLevel,
        multiplier: hqToday.tier.multiplier,
        completedToday: hqToday.completedToday,
      };
      const hiddenQuest =
        storedHq && storedHq.date === todayKey() && storedHq.questId === hq.questId
          ? { ...hq, revealed: storedHq.revealed }
          : { ...hq, revealed: false };

      set({
        stats: statsData,
        rank: rankData,
        quests: questsData,
        dailyQuests: updatedQuests,
        hiddenQuest,
        penalty: statsData.penalty ?? null,
        recovery: statsData.recovery ?? null,
        profile: {
          ...get().profile,
          name: statsData.user.name || get().profile.name,
          xp: newXp,
          rank: (statsData.rank || statsData.user.rank) as HunterProfile['rank'],
          level: calculateLevel(newXp),
          hp: statsData.user.hp,
          mp: statsData.user.mp,
          stats: {
            str: statsData.user.str,
            agi: statsData.user.agi,
            vit: statsData.user.vit,
            int: statsData.user.int,
            sen: statsData.user.sen,
          },
        },
        // Enqueue any newly crossed milestone; the banner plays the queue in order
        celebrations: celebration ? [...get().celebrations, celebration] : get().celebrations,
        apiConnected: true,
        loading: false,
      });

      // Save to localStorage as fallback
      saveToLocalStorage({ dailyQuests: updatedQuests, profile: get().profile, hiddenQuest, freezeCount: get().freezeCount, freezeDates: get().freezeDates });

      // Check achievements after state is updated
      get().checkAchievements();
    } catch (error) {
      console.error('Failed to load dashboard:', error);
      // Fallback to localStorage
      const localData = loadFromLocalStorage();
      if (localData) {
        set({
          dailyQuests: localData.dailyQuests || get().dailyQuests,
          profile: localData.profile || get().profile,
          freezeCount: localData.freezeCount || 0,
          freezeDates: localData.freezeDates || [],
          inventory: localData.inventory || [],
          equipped: localData.equipped || { ...DEFAULT_LOADOUT },
          unlockedTitles: localData.unlockedTitles || [],
          unlockedAchievements: localData.unlockedAchievements || [],
          apiConnected: false,
          loading: false,
          error: 'Backend unavailable. Using local storage.'
        });
      } else {
        set({ error: (error as Error).message, loading: false, apiConnected: false });
      }
    }
  },

  completeQuest: async (questId: string, date: string) => {
    const { dailyQuests } = get();
    // Hidden quests are not part of the quest board listing — the store's
    // `hiddenQuest` carries their (level-scaled) reward.
    const hq = questId.startsWith('HQ-') ? get().hiddenQuest : null;
    const quest = hq
      ? { id: hq.questId, xpReward: hq.xpReward, completedToday: hq.completedToday }
      : dailyQuests.find(q => q.id === questId);

    if (!quest) return;

    // Permanent tracks (LC-*, SS-*, AR-*) are done = any completion ever.
    // Daily quests (DQ-*) and hidden quests (HQ-*) reset each day: done = completed today.
    const isDaily = questId.startsWith('DQ-') || questId.startsWith('HQ-');
    const isCompleted = hq
      ? hq.completedToday
      : !isDaily
        ? (quest as { completedDates: string[] }).completedDates.length > 0
        : (quest as { completedDates: string[] }).completedDates.includes(date);

    // Sound + floating XP feedback for the toggle direction
    if (isCompleted) sfx.undo();
    else sfx.complete();

    // Apply STR/INT XP multiplier for display (server awards base XP separately)
    const { xpMultiplier } = getActiveBuffs(get().profile.stats);
    const displayXp = Math.round(quest.xpReward * xpMultiplier);
    get().pushXpFloat(isCompleted ? -displayXp : displayXp);

    // Optimistic update — skipped for hidden quests, whose state (and reward)
    // always comes from the server response.
    if (!hq) {
      const updatedQuests = dailyQuests.map(q => {
        if (q.id === questId) {
          const completedDates = isCompleted
            ? []
            : !isDaily
              ? [date]
              : [...q.completedDates, date];
          return { ...q, completedDates };
        }
        return q;
      });

      set({ dailyQuests: updatedQuests });
    saveToLocalStorage({ dailyQuests: updatedQuests, freezeCount: get().freezeCount, freezeDates: get().freezeDates });
  }

    // Apply active XP boost if equipped
    const { equipped } = get();
    if (equipped.xpBoost > 1 && equipped.xpBoostQuestsLeft > 0 && !isCompleted) {
      const boostXp = Math.round(quest.xpReward * (equipped.xpBoost - 1));
      get().pushXpFloat(boostXp);
      set({ equipped: { ...equipped, xpBoostQuestsLeft: equipped.xpBoostQuestsLeft - 1 } });
      if (equipped.xpBoostQuestsLeft - 1 <= 0) {
        set({ equipped: { ...get().equipped, xpBoost: 1, xpBoostQuestsLeft: 0 } });
      }
    }

    // Loot drop: roll for item on completion (not on undo)
    if (!isCompleted) {
      const isHidden = questId.startsWith('HQ-');
      const apiQuest = get().quests.find(q => q.quest_id === questId);
      const difficulty = isHidden ? 3 : (apiQuest?.difficulty ?? 1);
      const droppedItemId = rollDrop(difficulty, isHidden);
      if (droppedItemId) {
        get().addItem(droppedItemId);
        const instanceId = get().inventory[get().inventory.length - 1].instanceId;
        get().setLootDrop({ itemId: droppedItemId, instanceId });
        sfx.notification();
      }
    }

    // Always try to sync with the server; fall back to local-only on failure
    try {
      await api.completeQuest(questId);
      await get().loadDashboard();
    } catch (error) {
      console.error('Failed to sync with server:', error);
      set({ error: 'Quest saved locally. Server sync failed.' });
    }
  },

  redoTrack: async (track: 'dsa' | 'saas' | 'arch') => {
    try {
      await api.redoTrack(track);
      sfx.redo();
      await get().loadDashboard();
    } catch (error) {
      console.error(`Failed to reset ${track} track:`, error);
      set({ error: `Failed to reset ${track} track.` });
    }
  },

  dismissCelebration: () => set(s => ({ celebrations: s.celebrations.slice(1) })),

  pushXpFloat: (amount: number) => {
    floatId += 1;
    set(s => ({ xpFloats: [...s.xpFloats, { id: floatId, amount }] }));
  },

  removeXpFloat: (id: number) =>
    set(s => ({ xpFloats: s.xpFloats.filter(f => f.id !== id) })),

  updateProfile: (updates: Partial<HunterProfile>) => {
    set(state => {
      const newProfile = { ...state.profile, ...updates };
      saveToLocalStorage({ profile: newProfile, dailyQuests: state.dailyQuests });
      return { profile: newProfile };
    });

    // Persist stat/HP/MP changes to the server
    const serverUpdates: Record<string, number> = {};
    if (updates.stats) {
      for (const f of ['str', 'agi', 'vit', 'int', 'sen'] as const) {
        serverUpdates[f] = updates.stats[f];
      }
    }
    if (updates.hp !== undefined) serverUpdates.hp = updates.hp;
    if (updates.mp !== undefined) serverUpdates.mp = updates.mp;
    if (Object.keys(serverUpdates).length > 0) {
      api.updateStats(serverUpdates).catch(err => console.error('Failed to sync stats:', err));
    }
  },

  loadNutrition: async (month: string) => {
    try {
      const data = await api.getNutrition(month);
      const entries = new Map<string, NutritionItem[]>();
      for (const entry of data.entries) {
        const items = entries.get(entry.date) || [];
        items.push({ name: entry.name, protein: entry.protein, cost: entry.cost, consumed: true });
        entries.set(entry.date, items);
      }
      set({ nutritionEntries: entries });
    } catch (error) {
      console.error('Failed to load nutrition:', error);
      set({ error: 'Failed to load nutrition data.' });
    }
  },

  logNutrition: (date: string, items: NutritionItem[]) => {
    // Optimistic update: today's marks reset each day, month rows persist
    set(state => {
      const nutritionEntries = new Map(state.nutritionEntries);
      nutritionEntries.set(date, items);
      return { nutritionEntries };
    });

    api.saveNutritionDay(date, items.map(({ name, protein, cost }) => ({ name, protein, cost })))
      .catch(err => console.error('Failed to sync nutrition:', err));
  },

  saveArchDecision: (week: number, data: Partial<ArchChallenge>) => {
    set(state => {
      const archChallenges = [...state.archChallenges];
      const index = archChallenges.findIndex(c => c.week === week);
      if (index !== -1) {
        archChallenges[index] = { ...archChallenges[index], ...data };
      }
      return { archChallenges };
    });
  },

  toggleApiConnection: (connected: boolean) => {
    set({ apiConnected: connected });
  },

  revealHiddenQuest: () => {
    const { hiddenQuest } = get();
    if (!hiddenQuest || hiddenQuest.date !== todayKey() || hiddenQuest.revealed) return;
    const updated = { ...hiddenQuest, revealed: true };
    set({ hiddenQuest: updated });
    saveToLocalStorage({ hiddenQuest: updated });
    sfx.hiddenQuest();
  },

  buyFreeze: (cost: number) => {
    const { profile, freezeCount } = get();
    if (profile.xp < cost) return;
    const newProfile = { ...profile, xp: profile.xp - cost };
    set({ profile: newProfile, freezeCount: freezeCount + 1 });
    saveToLocalStorage({ profile: newProfile, freezeCount: freezeCount + 1, freezeDates: get().freezeDates });
    api.updateStats({}).catch(() => {});
  },

  useFreeze: (date: string) => {
    const { freezeCount, freezeDates } = get();
    if (freezeCount <= 0 || freezeDates.includes(date)) return;
    const newFreezeDates = [...freezeDates, date];
    set({ freezeCount: freezeCount - 1, freezeDates: newFreezeDates });
    saveToLocalStorage({ freezeCount: freezeCount - 1, freezeDates: newFreezeDates });
  },

  allocateStat: (stat) => {
    const { profile } = get();
    const available = getAvailableStatPoints(profile.level, profile.stats);
    if (available <= 0) return;
    const newStats = { ...profile.stats, [stat]: profile.stats[stat] + 1 };
    set({ profile: { ...profile, stats: newStats } });
    saveToLocalStorage({ profile: { ...profile, stats: newStats } });
    api.updateStats({ [stat]: newStats[stat] }).catch(() => {});
    sfx.click();
  },

  deallocateStat: (stat) => {
    const { profile } = get();
    if (profile.stats[stat] <= (BASE_STATS as Record<string, number>)[stat]) return;
    const newStats = { ...profile.stats, [stat]: profile.stats[stat] - 1 };
    set({ profile: { ...profile, stats: newStats } });
    saveToLocalStorage({ profile: { ...profile, stats: newStats } });
    api.updateStats({ [stat]: newStats[stat] }).catch(() => {});
    sfx.click();
  },

  addItem: (itemId: string) => {
    const item = ITEMS[itemId];
    if (!item) return;
    const newItem: InventoryItem = {
      instanceId: createInstanceId(),
      itemId,
      obtainedAt: new Date().toISOString(),
    };
    set(s => ({ inventory: [...s.inventory, newItem] }));
    saveToLocalStorage({ inventory: get().inventory });
  },

  useItem: (instanceId: string) => {
    const { inventory, profile, equipped } = get();
    const idx = inventory.findIndex(i => i.instanceId === instanceId);
    if (idx === -1) return;
    const invItem = inventory[idx];
    const def = ITEMS[invItem.itemId];
    if (!def) return;

    // Apply effect based on category
    if (def.category === 'consumable') {
      const heal = getPotionHeal(invItem.itemId);
      if (heal > 0) {
        const newHp = Math.min(100, profile.hp + heal);
        set({ profile: { ...profile, hp: newHp } });
        saveToLocalStorage({ profile: { ...profile, hp: newHp } });
        api.updateStats({ hp: newHp }).catch(() => {});
      }
    } else if (def.category === 'stone') {
      const stoneXp = getStoneXp(invItem.itemId);
      if (stoneXp > 0) {
        const newXp = profile.xp + stoneXp;
        const newProfile = { ...profile, xp: newXp, level: calculateLevel(newXp), rank: calculateRank(newXp) };
        set({ profile: newProfile });
        saveToLocalStorage({ profile: newProfile });
        api.updateStats({}).catch(() => {});
      }
    } else if (def.category === 'title') {
      // Title scrolls unlock the title (don't consume, just equip)
      const titleName = getTitleName(invItem.itemId);
      if (titleName && !get().unlockedTitles.includes(titleName)) {
        set(s => ({ unlockedTitles: [...s.unlockedTitles, titleName] }));
        saveToLocalStorage({ unlockedTitles: get().unlockedTitles });
      }
      // Auto-equip the title
      set({ equipped: { ...equipped, title: titleName } });
      saveToLocalStorage({ equipped: { ...get().equipped, title: titleName } });
    } else if (def.category === 'scroll') {
      const boost = getScrollXpBonus(invItem.itemId);
      if (boost > 0) {
        set({ equipped: { ...equipped, xpBoost: 1 + boost, xpBoostQuestsLeft: 3 } });
        saveToLocalStorage({ equipped: { ...get().equipped, xpBoost: 1 + boost, xpBoostQuestsLeft: 3 } });
      }
    }

    // Remove from inventory (consumables/scrolls/stone are consumed; titles stay)
    if (def.category !== 'title') {
      const newInventory = inventory.filter(i => i.instanceId !== instanceId);
      set({ inventory: newInventory });
      saveToLocalStorage({ inventory: newInventory });
    }
    sfx.complete();
  },

  equipTitle: (itemId: string) => {
    const titleName = getTitleName(itemId);
    if (!titleName) return;
    set(s => ({ equipped: { ...s.equipped, title: titleName } }));
    saveToLocalStorage({ equipped: get().equipped });
    sfx.click();
  },

  unequipTitle: () => {
    set(s => ({ equipped: { ...s.equipped, title: null } }));
    saveToLocalStorage({ equipped: get().equipped });
    sfx.click();
  },

  equipXpBoost: (itemId: string) => {
    const boost = getScrollXpBonus(itemId);
    if (boost <= 0) return;
    set(s => ({ equipped: { ...s.equipped, xpBoost: 1 + boost, xpBoostQuestsLeft: 3 } }));
    saveToLocalStorage({ equipped: get().equipped });
    sfx.click();
  },

  deactivateXpBoost: () => {
    set(s => ({ equipped: { ...s.equipped, xpBoost: 1, xpBoostQuestsLeft: 0 } }));
    saveToLocalStorage({ equipped: get().equipped });
    sfx.click();
  },

  setLootDrop: (drop) => {
    set({ lootDrop: drop });
  },

  checkAchievements: () => {
    const state = get();
    const alreadyUnlocked = new Set(state.unlockedAchievements);
    const newlyUnlocked: string[] = [];

    for (const ach of ACHIEVEMENTS) {
      if (alreadyUnlocked.has(ach.id)) continue;
      try {
        if (ach.check(state)) {
          newlyUnlocked.push(ach.id);
        }
      } catch {
        // condition threw — skip
      }
    }

    if (newlyUnlocked.length > 0) {
      const updated = [...state.unlockedAchievements, ...newlyUnlocked];
      set({
        unlockedAchievements: updated,
        newAchievements: [...state.newAchievements, ...newlyUnlocked],
      });
      saveToLocalStorage({ unlockedAchievements: updated });
      sfx.notification();
    }

    return newlyUnlocked;
  },

  dismissNewAchievements: () => {
    set({ newAchievements: [] });
  },

  // Local storage methods
  loadFromStorage: () => {
    const saved = loadFromLocalStorage();
    if (saved) {
      set(saved);
    }
  },

  saveToStorage: () => {
    const state = get();
    saveToLocalStorage({ dailyQuests: state.dailyQuests, profile: state.profile, hiddenQuest: state.hiddenQuest, freezeCount: state.freezeCount, freezeDates: state.freezeDates, inventory: state.inventory, equipped: state.equipped, unlockedTitles: state.unlockedTitles, unlockedAchievements: state.unlockedAchievements });
  },
}));
