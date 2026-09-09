const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Type Definitions
export interface Quest {
  id: number;
  quest_id: string;
  title: string;
  xp_reward: number;
  category: string;
  difficulty: number;
  is_daily: boolean;
  completions?: { completion_date: string }[];
}

export interface User {
  id: number;
  username: string;
  name: string;
  name_set?: boolean;
  rank: string;
  xp: number;
  hp: number;
  mp: number;
  str: number;
  agi: number;
  vit: number;
  int: number;
  sen: number;
  created_at: string;
  updated_at: string;
}

export interface PenaltyInfo {
  applied: boolean;
  missed_days: number;
  xp_lost: number;
  hp_lost: number;
  message: string;
}

export interface RecoveryInfo {
  applied: boolean;
  bonus_xp: number;
  streak: number;
  message: string;
}

export interface Stats {
  user: User;
  daily: { daily_xp: number; quests_completed: number };
  weekly: { weekly_xp: number; active_days: number; total_quests: number };
  streak: number;
  rank: string;
  penalty?: PenaltyInfo | null;
  recovery?: RecoveryInfo | null;
}

export interface RankProgress {
  user: { name: string; rank: string; xp: number; level: number };
  currentRank: { name: string; minXP: number; maxXP: number; color: string; progress: number };
  nextRank: { name: string; minXP: number; maxXP: number; color: string; xpRequired: number } | null;
  history: { rank: string; xp_at_rank: number; achieved_at: string }[];
}

export interface Level {
  level: number;
  xpRequired: number;
  isCompleted: boolean;
  progress: number;
  isCurrent: boolean;
}

export interface StatHistory {
  completion_date: string;
  quests_completed: number;
  xp_gained: number;
}

export interface QuestStats {
  today: { completed: number; total: number; xp: number };
  weekly: { weekly_xp: number; active_days: number; total_completions: number };
  categories: { category: string; completed_count: number; total_count: number }[];
}

export interface NutritionEntry {
  id: number;
  date: string;
  name: string;
  protein: number;
  cost: number;
}

export interface NutritionPayload {
  month: string;
  entries: NutritionEntry[];
  totals: { protein: number; cost: number };
}

export interface NutritionItemInput {
  name: string;
  protein: number;
  cost: number;
}

export interface HiddenQuestToday {
  id: string;
  title: string;
  description: string;
  icon: string;
  baseXp: number;
  /** Level-scaled XP the server will actually award on completion. */
  xpReward: number;
  difficulty: 1 | 2 | 3;
  tier: { index: number; name: string; minLevel: number; multiplier: number };
  level: number;
  date: string;
  completedToday: boolean;
}

export interface ActivityEntry {
  id: number;
  action: string;
  entity: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export type ProgressPeriod = 'week' | 'month' | 'quarter' | 'year';

export interface ProgressBucket {
  label: string;
  quests: number;
  xp: number;
}

export interface ProgressReport {
  period: ProgressPeriod;
  start: string;
  granularity: 'day' | 'month';
  buckets: ProgressBucket[];
  totals: {
    quests_completed: number;
    xp_earned: number;
    active_days: number;
    days_elapsed: number;
    completion_rate: number;
  };
}

export interface TrackStats {
  track: 'dsa' | 'saas' | 'arch';
  label: string;
  icon: string;
  total_quests: number;
  quests_done: number;
  completions: number;
  passes: number;
  xp_earned: number;
  last_completed_at: string | null;
}

export interface AuthResponse {
  message: string;
  user: { id: number; username: string; name: string; name_set?: boolean };
}

export interface LoginResponse {
  message: string;
  user: { id: number; username: string; name: string; name_set?: boolean };
}

export interface SetNameResponse {
  message: string;
  name: string;
}

// API Client with auth support
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', // Send cookies
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `API error: ${response.status}`);
  }

  return response.json();
}

export const api = {
  // Auth
  login: (username: string, password: string) =>
    request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  register: (username: string, password: string) =>
    request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  logout: () =>
    request<{ message: string }>('/auth/logout', {
      method: 'POST',
    }),

  getMe: () =>
    request<{ user: User & { name_set?: boolean } }>('/auth/me'),

  setHunterName: (name: string) =>
    request<SetNameResponse>('/auth/set-name', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  // Quests
  getQuests: (category?: string, completed?: boolean) =>
    request<Quest[]>(`/quests${category ? `?category=${category}&completed=${completed}` : ''}`),

  getQuest: (id: string) => request<Quest>(`/quests/${id}`),

  getTodaysHiddenQuest: () => request<HiddenQuestToday>('/quests/hidden/today'),

  completeQuest: (id: string) =>
    request<{ action: string; xpGained: number }>(`/quests/${id}/complete`, { method: 'PATCH' }),

  getQuestStats: () => request<QuestStats>('/quests/stats'),

  redoTrack: (track: 'dsa' | 'saas' | 'arch') =>
    request<{ action: string; track: string; deleted: number; message: string }>(`/quests/redo/${track}`, { method: 'POST' }),

  // Nutrition
  getNutrition: (month?: string) =>
    request<NutritionPayload>(`/nutrition${month ? `?month=${month}` : ''}`),

  saveNutritionDay: (date: string, items: NutritionItemInput[]) =>
    request<{ message: string; date: string; count: number }>('/nutrition/day', {
      method: 'POST',
      body: JSON.stringify({ date, items }),
    }),

  // Activity log
  getActivity: (limit = 50) => request<ActivityEntry[]>(`/activity?limit=${limit}`),

  // Stats
  getStats: () => request<Stats>('/stats'),

  updateStats: (updates: Partial<{ hp: number; mp: number; str: number; agi: number; vit: number; int: number; sen: number }>) =>
    request<User>('/stats', { method: 'PATCH', body: JSON.stringify(updates) }),

  getStatsHistory: (days = 30) =>
    request<StatHistory[]>(`/stats/history?days=${days}`),

  getProgress: (period: ProgressPeriod = 'month') =>
    request<ProgressReport>(`/stats/progress?period=${period}`),

  getTracks: () => request<{ tracks: TrackStats[] }>('/stats/tracks'),

  // Rank
  getRank: () => request<RankProgress>('/rank'),

  getLevels: () => request<{ levels: Level[]; currentLevel: number }>('/rank/levels'),

  // Health
  health: () => request<{ status: string; timestamp: string }>('/health'),
};
