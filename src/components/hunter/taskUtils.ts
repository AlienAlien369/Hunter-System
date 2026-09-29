import type { ContentStage, Quest } from '../../lib/api';
import { useGameStore } from '../../store/gameStore';
import { localDateKey } from '../../utils/date';

export const todayKey = () => localDateKey();
export const todayCode = () => (['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const)[(new Date(todayKey()).getUTCDay() + 6) % 7];

export const STAGES: { id: ContentStage; label: string; examples: string[] }[] = [
  { id: 'research', label: 'Research', examples: ['Find content idea', 'Research topic', 'Competitor research'] },
  { id: 'planning', label: 'Planning', examples: ['Write script', 'Create outline', 'Create content plan'] },
  { id: 'production', label: 'Production', examples: ['Record', 'Edit', 'Thumbnail', 'Caption', 'Title'] },
  { id: 'publishing', label: 'Publishing', examples: ['Upload', 'Schedule', 'Publish'] },
  { id: 'analytics', label: 'Analytics', examples: ['Check analytics', 'Analyze retention', 'Analyze engagement', 'Review performance'] },
];

export const isDoneToday = (q: Quest) => !!q.completions?.some(c => String(c.completion_date).startsWith(todayKey()));
export const isScheduledToday = (q: Quest) => !q.recurrence?.length || q.recurrence.includes(todayCode());

/** Reload quests (and XP) after a task mutation. */
export const refresh = () => useGameStore.getState().loadDashboard();
