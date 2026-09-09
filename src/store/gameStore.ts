import { create } from 'zustand';
import type { Quest, Stats, RankProgress, Level } from '../lib/api';
import { api } from '../lib/api';
import { useAuthStore } from './authStore';
import { calculateLevel, calculateRank } from '../utils/xp';
import { sfx } from '../utils/sounds';

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

  // Loading states
  loading: boolean;
  error: string | null;
  apiConnected: boolean;

  // Queue of celebrations: each level/rank crossing enqueues, the banner
  // plays them one at a time in order so rapid quest completions never
  // overwrite each other's fanfare.
  celebrations: Celebration[];

  // Actions
  loadDashboard: () => Promise<void>;
  completeQuest: (questId: string, date: string) => Promise<void>;
  redoTrack: (track: 'dsa' | 'saas' | 'arch') => Promise<void>;
  dismissCelebration: () => void;
  updateProfile: (updates: Partial<HunterProfile>) => void;
  loadNutrition: (month: string) => Promise<void>;
  logNutrition: (date: string, items: NutritionItem[]) => void;
  saveArchDecision: (week: number, data: Partial<ArchChallenge>) => void;
  toggleApiConnection: (connected: boolean) => void;
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
    const { dailyQuests, profile } = state;
    localStorage.setItem(getStorageKey(), JSON.stringify({
      dailyQuests,
      profile,
    }));
  } catch (e) {
    console.error('Failed to save to localStorage:', e);
  }
}

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
  loading: false,
  error: null,
  apiConnected: false,
  celebrations: [],

  loadDashboard: async () => {
    set({ loading: true, error: null });
    try {
      const [statsData, rankData, questsData] = await Promise.all([
        api.getStats(),
        api.getRank(),
        api.getQuests(),
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
          };
        }
      }

      set({
        stats: statsData,
        rank: rankData,
        quests: questsData,
        dailyQuests: updatedQuests,
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
      saveToLocalStorage({ dailyQuests: updatedQuests, profile: get().profile });
    } catch (error) {
      console.error('Failed to load dashboard:', error);
      // Fallback to localStorage
      const localData = loadFromLocalStorage();
      if (localData) {
        set({
          dailyQuests: localData.dailyQuests || get().dailyQuests,
          profile: localData.profile || get().profile,
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
    const quest = dailyQuests.find(q => q.id === questId);

    if (!quest) return;

    // Permanent tracks (LC-*, SS-*, AR-*) are done = any completion ever.
    // Daily quests (DQ-*) reset each day: done = completed today.
    const isDaily = questId.startsWith('DQ-');
    const isCompleted = !isDaily
      ? quest.completedDates.length > 0
      : quest.completedDates.includes(date);

    // Sound feedback for the toggle direction
    if (isCompleted) sfx.undo();
    else sfx.complete();

    // Optimistic update
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
    saveToLocalStorage({ dailyQuests: updatedQuests });

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

  // Local storage methods
  loadFromStorage: () => {
    const saved = loadFromLocalStorage();
    if (saved) {
      set(saved);
    }
  },

  saveToStorage: () => {
    const state = get();
    saveToLocalStorage({ dailyQuests: state.dailyQuests, profile: state.profile });
  },
}));
