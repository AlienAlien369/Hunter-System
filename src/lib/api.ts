import { browserTimeZone } from '../utils/date';

// Auto-detect API URL based on environment
const getApiUrl = (): string => {
  // Explicit env var (set in Docker/CI)
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;

  const host = window.location.hostname;

  // On Render deployment (same origin serves both frontend + backend)
  if (host.includes('onrender.com')) return '/api';

  // On Vercel — proxy to the Render backend
  if (host.includes('vercel.app')) return 'https://hunter-system-kss0.onrender.com/api';

  // Local development
  return 'http://localhost:3000/api';
};

const API_URL = getApiUrl();

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
  // Custom module tasks (CQ-*) only
  user_id?: number | null;
  schedule_time?: string | null;
  time_of_day?: 'morning' | 'evening' | 'anytime' | null;
  recurrence?: Day[] | null;
  metadata?: { channelId?: number; stage?: ContentStage; subtasks?: string[] } | null;
}

export type Day = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';
export const DAYS: Day[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
export type ContentStage = 'research' | 'planning' | 'production' | 'publishing' | 'analytics';

export interface CustomTaskInput {
  subtasks?: string[];
  title?: string;
  module?: string;
  difficulty?: 1 | 2 | 3;
  scheduleTime?: string | null;
  timeOfDay?: 'morning' | 'evening' | 'anytime' | null;
  recurrence?: Day[] | null;
  metadata?: { channelId?: number; stage?: ContentStage } | null;
}

export interface ModuleSummary {
  module: string;
  xpEarned: number;
  completedTotal: number;
  completedToday: number;
  completedThisWeek: number;
  streak: number;
}

export interface ContentChannel {
  id: number;
  name: string;
  platform: string;
  category: string;
  status: 'active' | 'paused' | 'archived';
  posting_frequency: string | null;
  target_per_week: number;
}

export interface ChannelInput {
  name?: string;
  platform?: string;
  category?: string;
  postingFrequency?: string;
  targetPerWeek?: number;
  status?: ContentChannel['status'];
}

export interface RoutineItem {
  id: string;
  module: string;
  title: string;
  time: string;
  durationMin: number;
  days: Day[];
  createdAt?: string;
}

export interface Routine {
  items: RoutineItem[];
  timezone: string | null;
  confirmedAt: string | null;
  graceEndsAt: string | null;
  established: boolean;
}

export interface RoutineChange {
  kind: string;
  label: string;
  module: string;
  detail?: string;
  severity?: 'major' | 'minor';
  xp: number;
  reason: string;
}

export interface RoutinePreview {
  changes: RoutineChange[];
  netXp: number;
  established: boolean;
  currentXp: number;
  newXp: number;
  isInitial: boolean;
}

export interface RoutineSuggestion {
  modules: string[];
  schedule: Omit<RoutineItem, 'id' | 'createdAt'>[];
  suggestions: string[];
}

export type UnplannedDifficulty = 'easy' | 'medium' | 'hard' | 'extreme';
export const UNPLANNED_CATEGORIES = ['work', 'learning', 'fitness', 'health', 'skincare', 'content', 'mindset', 'chores', 'social', 'other'] as const;

export interface UnplannedAnalysis {
  title: string;
  category: string;
  difficulty: UnplannedDifficulty;
  estimatedMinutes: number;
  goalRelevance: number;
  meaningful: boolean;
  trivial: boolean;
  duplicate: boolean;
  xpSuggestion: number;
  reason: string;
}

export interface UnplannedOffer {
  id: number;
  source: 'ai' | 'manual';
  analysis: UnplannedAnalysis;
  xp: number;
  repeats: number;
  dailyRemaining: number;
  acceptedToday: number;
  limitReached: boolean;
  similarTask: { questId: string; title: string; xpReward: number } | null;
}

export type UnplannedEdits = Partial<Pick<UnplannedAnalysis, 'title' | 'category' | 'difficulty' | 'estimatedMinutes'>>;

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

/** Error carrying the HTTP status and body (e.g. a 409 XP-confirmation preview). */
export class ApiError extends Error {
  status: number;
  data: Record<string, unknown>;
  constructor(message: string, status: number, data: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export type ModuleKind = 'tasks' | 'content' | 'diet' | 'dsa' | 'saas' | 'arch';

export interface HunterModule {
  id: number;
  slug: string;
  name: string;
  icon: string;
  kind: ModuleKind;
  status: 'active' | 'paused';
  goals: string[];
  createdAt: string;
  graceEndsAt: string;
  established: boolean;
  taskCount?: number;
}

export interface ModuleTaskSpec {
  id?: string;
  title: string;
  difficulty: 1 | 2 | 3;
  scheduleTime: string | null;
  timeOfDay: 'morning' | 'evening' | null;
  recurrence: Day[] | null;
  subtasks?: string[];
  xp?: number;
}

export interface ModuleInput {
  name: string;
  icon?: string;
  kind?: ModuleKind;
  goals?: string[];
  tasks?: ModuleTaskSpec[];
  channels?: ChannelInput[];
}

export interface ModuleDraft {
  name: string;
  icon: string;
  goals: string[];
  tasks: ModuleTaskSpec[];
  suggestions: string[];
}

export interface LeaderboardEntry {
  position: number;
  name: string;
  score: number;
  level: number;
  rank: string;
  isMe: boolean;
}

export interface Leaderboard {
  period: 'week' | 'all';
  weekStart: string;
  entries: LeaderboardEntry[];
  me: { score: number; position: number | null; visible: boolean; nameSet: boolean };
}

export interface CoachReview {
  headline: string;
  wins: string[];
  focus: string[];
  nextWeek: string[];
  source: 'ai' | 'rules';
}

export interface CoachWeekly {
  stats: { weekStart: string; daysElapsed: number; xpEarned: number; completions: number; activeDays: number };
  review: CoachReview | null;
  generatedAt: string | null;
}

/** Body of a 409 "confirm the XP impact" response. */
export type XpConfirmation = RoutinePreview & { requiresConfirmation: true };

// API Client with auth support
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    // X-Timezone: the server computes "today" (daily resets, streaks, bonuses) in the hunter's zone.
    headers: { 'Content-Type': 'application/json', 'X-Timezone': browserTimeZone() },
    credentials: 'include', // Send cookies
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new ApiError(error.error || `API error: ${response.status}`, response.status, error);
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
    request<{ action: string; xpGained?: number; perfectDay?: { status: 'awarded' | 'revoked'; xp: number } | null }>(`/quests/${id}/complete`, { method: 'PATCH' }),

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

  // Custom module tasks (skincare, content, …)
  createTask: (input: CustomTaskInput) =>
    request<Quest>('/quests/custom', { method: 'POST', body: JSON.stringify(input) }),

  updateTask: (questId: string, input: CustomTaskInput, expectedXp?: number) =>
    request<Quest>(`/quests/custom/${questId}`, { method: 'PATCH', body: JSON.stringify({ ...input, expectedXp }) }),

  deleteTask: (questId: string, expectedXp?: number) =>
    request<{ message: string }>(`/quests/custom/${questId}${expectedXp !== undefined ? `?expectedXp=${expectedXp}` : ''}`, { method: 'DELETE' }),

  getModuleSummary: (module: string) => request<ModuleSummary>(`/quests/modules/${encodeURIComponent(module)}/summary`),

  // Content channels
  getChannels: () => request<ContentChannel[]>('/content/channels'),

  createChannel: (input: ChannelInput) =>
    request<ContentChannel>('/content/channels', { method: 'POST', body: JSON.stringify(input) }),

  updateChannel: (id: number, input: ChannelInput) =>
    request<ContentChannel>(`/content/channels/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),

  deleteChannel: (id: number) =>
    request<{ message: string }>(`/content/channels/${id}`, { method: 'DELETE' }),

  getContentProgress: () =>
    request<{ id: number; target_per_week: number; published: number; completed: number }[]>('/content/progress'),

  // Routine (timetable contract)
  getRoutine: () => request<{ routine: Routine | null; graceHours: number }>('/routine'),

  previewRoutine: (items: RoutineItem[]) =>
    request<RoutinePreview>('/routine/preview', { method: 'POST', body: JSON.stringify({ items }) }),

  saveRoutine: (body: { items: RoutineItem[]; timezone?: string; acknowledged?: boolean; expectedNetXp?: number }) =>
    request<{ routine: Routine; changes: RoutineChange[]; netXp: number; xp: number }>('/routine', { method: 'PUT', body: JSON.stringify(body) }),

  getRoutineHistory: () => request<ActivityEntry[]>('/routine/history'),

  suggestRoutine: (description: string) =>
    request<RoutineSuggestion>('/routine/suggest', { method: 'POST', body: JSON.stringify({ description }) }),

  // Unplanned activities ("I did something else")
  analyzeActivity: (description: string) =>
    request<({ status: 'analyzed' } & UnplannedOffer) | { status: 'manual'; message: string }>('/unplanned/analyze', {
      method: 'POST', body: JSON.stringify({ description }),
    }),

  manualActivity: (description: string, fields: Required<UnplannedEdits>) =>
    request<{ status: 'analyzed' } & UnplannedOffer>('/unplanned/manual', { method: 'POST', body: JSON.stringify({ description, ...fields }) }),

  previewActivity: (id: number, edits: UnplannedEdits) =>
    request<Omit<UnplannedOffer, 'id' | 'source'>>(`/unplanned/${id}/preview`, { method: 'POST', body: JSON.stringify({ edits }) }),

  acceptActivity: (id: number, edits?: UnplannedEdits) =>
    request<{ xpGained: number; newXp: number; level: number }>(`/unplanned/${id}/accept`, { method: 'POST', body: JSON.stringify({ edits }) }),

  rejectActivity: (id: number) =>
    request<{ message: string }>(`/unplanned/${id}/reject`, { method: 'POST' }),

  // Dynamic modules
  getModules: () => request<HunterModule[]>('/modules'),

  getModuleHistory: () => request<ActivityEntry[]>('/modules/history'),

  createModule: (input: ModuleInput & { acknowledged: true; replaceModuleId?: number }, expectedXp?: number) =>
    request<{ module: HunterModule; xp: number }>('/modules', { method: 'POST', body: JSON.stringify({ ...input, expectedXp }) }),

  updateModule: (id: number, input: Partial<Pick<HunterModule, 'name' | 'icon' | 'goals' | 'status'>>, expectedXp?: number) =>
    request<{ module: HunterModule }>(`/modules/${id}`, { method: 'PATCH', body: JSON.stringify({ ...input, expectedXp }) }),

  saveModuleTasks: (id: number, tasks: ModuleTaskSpec[], expectedXp?: number) =>
    request<{ netXp: number }>(`/modules/${id}/tasks`, { method: 'PUT', body: JSON.stringify({ tasks, expectedXp }) }),

  deleteModule: (id: number, expectedXp?: number) =>
    request<{ message: string }>(`/modules/${id}${expectedXp !== undefined ? `?expectedXp=${expectedXp}` : ''}`, { method: 'DELETE' }),

  draftModule: (prompt: string, moduleId?: number) =>
    request<ModuleDraft>('/modules/ai/draft', { method: 'POST', body: JSON.stringify({ prompt, moduleId }) }),

  // Leaderboard
  getLeaderboard: (period: 'week' | 'all') => request<Leaderboard>(`/leaderboard?period=${period}`),

  setLeaderboardVisibility: (visible: boolean) =>
    request<{ visible: boolean }>('/leaderboard/visibility', { method: 'PATCH', body: JSON.stringify({ visible }) }),

  // Weekly AI coach
  getCoachWeekly: () => request<CoachWeekly>('/coach/weekly'),
  generateCoachWeekly: () => request<CoachWeekly>('/coach/weekly', { method: 'POST' }),

  // Account
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ message: string }>('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),

  exportData: () => request<Record<string, unknown>>('/auth/export'),

  // Cloud save for inventory / loadout / freezes / unlocks
  getGameState: () => request<{ state: Record<string, unknown> | null; updatedAt: string | null }>('/state'),
  saveGameState: (state: Record<string, unknown>) =>
    request<{ updatedAt: string }>('/state', { method: 'PUT', body: JSON.stringify({ state }) }),

  deleteAccount: (password: string, confirm: string) =>
    request<{ message: string }>('/auth/account', { method: 'DELETE', body: JSON.stringify({ password, confirm }) }),

  // Hunter Initiation (first-session checklist)
  getOnboarding: () => request<{ claimed: boolean; bonus: number; steps: { id: string; label: string; done: boolean }[] }>('/onboarding'),
  claimOnboarding: () => request<{ xpGained: number }>('/onboarding/claim', { method: 'POST' }),

  // Friends
  getFriends: () => request<{ weekStart: string; friends: { position: number; name: string; weeklyXp: number; level: number; rank: string; lastActive: string | null; isMe: boolean }[] }>('/friends'),
  addFriend: (name: string) => request<{ name: string }>('/friends', { method: 'POST', body: JSON.stringify({ name }) }),
  removeFriend: (name: string) => request<{ message: string }>(`/friends/${encodeURIComponent(name)}`, { method: 'DELETE' }),

  // Health
  health: () => request<{ status: string; timestamp: string }>('/health'),
};
