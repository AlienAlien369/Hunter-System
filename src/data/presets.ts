import type { ChannelInput, ModuleKind, ModuleTaskSpec } from '../lib/api';

// Module templates: one-click starting points for the Module Builder. They
// only pre-fill the editor — every module and task stays fully editable, and
// nothing in the data model depends on them.

export interface ModuleTemplate {
  key: string;
  name: string;
  icon: string;
  kind: ModuleKind;
  description: string;
  goals: string[];
  tasks: ModuleTaskSpec[];
  channels?: ChannelInput[];
}

const t = (title: string, over: Partial<ModuleTaskSpec> = {}): ModuleTaskSpec =>
  ({ title, difficulty: 1, scheduleTime: null, timeOfDay: null, recurrence: null, subtasks: [], ...over });

export const MODULE_TEMPLATES: ModuleTemplate[] = [
  {
    key: 'skincare', name: 'Skincare', icon: '🧴', kind: 'tasks', description: 'Morning and night routine',
    goals: ['Consistent daily skincare'],
    tasks: [
      t('Cleanser', { timeOfDay: 'morning', scheduleTime: '07:00' }),
      t('Serum', { timeOfDay: 'morning', scheduleTime: '07:05' }),
      t('Moisturizer', { timeOfDay: 'morning', scheduleTime: '07:10' }),
      t('Sunscreen', { timeOfDay: 'morning', scheduleTime: '07:15' }),
      t('Cleanser', { timeOfDay: 'evening', scheduleTime: '22:00' }),
      t('Treatment', { timeOfDay: 'evening', scheduleTime: '22:05' }),
      t('Moisturizer', { timeOfDay: 'evening', scheduleTime: '22:10' }),
    ],
  },
  {
    key: 'content', name: 'Content Creation', icon: '🎬', kind: 'content', description: 'Channels, pipeline and weekly targets',
    goals: ['Publish consistently on every channel'],
    tasks: [
      t('Find content idea', { difficulty: 1 }),
      t('Write script', { difficulty: 2, recurrence: ['MON', 'THU'] }),
      t('Record & edit', { difficulty: 3, recurrence: ['TUE', 'FRI'] }),
      t('Publish', { difficulty: 2, recurrence: ['WED', 'SAT'] }),
      t('Review analytics', { difficulty: 1, recurrence: ['SUN'] }),
    ],
    channels: [
      { name: 'Badminton Instagram #1', platform: 'instagram', category: 'Badminton', targetPerWeek: 3 },
      { name: 'Badminton Instagram #2', platform: 'instagram', category: 'Badminton', targetPerWeek: 3 },
      { name: 'Badminton YouTube #1', platform: 'youtube', category: 'Badminton', targetPerWeek: 1 },
      { name: 'Badminton YouTube #2', platform: 'youtube', category: 'Badminton', targetPerWeek: 1 },
      { name: 'Business / Tech Instagram', platform: 'instagram', category: 'Business / Tech', targetPerWeek: 3 },
      { name: 'Business / Tech YouTube', platform: 'youtube', category: 'Business / Tech', targetPerWeek: 1 },
    ],
  },
  {
    key: 'fitness', name: 'Fitness', icon: '💪', kind: 'tasks', description: 'Training and recovery',
    goals: ['Train 4× a week'],
    tasks: [
      t('Strength workout', { difficulty: 3, scheduleTime: '18:00', recurrence: ['MON', 'TUE', 'THU', 'FRI'] }),
      t('Mobility / stretching', { scheduleTime: '21:30' }),
      t('10k steps', { difficulty: 2 }),
    ],
  },
  {
    key: 'reading', name: 'Reading', icon: '📖', kind: 'tasks', description: 'Daily pages and notes',
    goals: ['Read 12 books this year'],
    tasks: [t('Read 20 pages', { difficulty: 2, scheduleTime: '21:00', timeOfDay: 'evening' }), t('Write book notes', { recurrence: ['SUN'] })],
  },
  {
    key: 'finance', name: 'Finance', icon: '💰', kind: 'tasks', description: 'Tracking, budgeting, investing',
    goals: ['Track every expense'],
    tasks: [t('Log expenses'), t('Weekly budget review', { difficulty: 2, recurrence: ['SUN'] })],
  },
  {
    key: 'learning', name: 'Learning', icon: '🎓', kind: 'tasks', description: 'Courses and deliberate practice',
    goals: ['Finish one course per month'],
    tasks: [t('Course session', { difficulty: 2, scheduleTime: '19:00', recurrence: ['MON', 'TUE', 'WED', 'THU', 'FRI'] }), t('Practice project', { difficulty: 3, recurrence: ['SAT'] })],
  },
  {
    key: 'meditation', name: 'Meditation', icon: '🧘', kind: 'tasks', description: 'Mindfulness practice',
    goals: ['Meditate daily'],
    tasks: [t('Morning meditation', { timeOfDay: 'morning', scheduleTime: '06:15' }), t('Evening reflection', { timeOfDay: 'evening' })],
  },
  // Existing Hunter pages, available as optional modules
  { key: 'diet', name: 'Diet', icon: '🥗', kind: 'diet', description: 'Nutrition budget tracker', goals: [], tasks: [] },
  { key: 'dsa', name: 'DSA Roadmap', icon: '📚', kind: 'dsa', description: 'LeetCode roadmap', goals: [], tasks: [] },
  { key: 'saas', name: 'SaaS', icon: '🚀', kind: 'saas', description: 'SaaS milestones', goals: [], tasks: [] },
  { key: 'arch', name: 'Architecture', icon: '🧠', kind: 'arch', description: 'System design challenges', goals: [], tasks: [] },
];

/** Built-in module kinds render an existing Hunter page. */
export const BUILTIN_ROUTES: Partial<Record<ModuleKind, string>> = { diet: '/diet', dsa: '/dsa-roadmap', saas: '/saas', arch: '/arch' };

export const moduleHref = (m: { kind: ModuleKind; slug: string }) => BUILTIN_ROUTES[m.kind] ?? `/m/${m.slug}`;
