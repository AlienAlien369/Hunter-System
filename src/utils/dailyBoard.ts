import type { DailyQuest } from '../store/gameStore';

// The daily quest board follows the hunter's own Timetable: every timetable
// slot is a daily quest (CQ-*, category 'routine', synced by the server).
// Hunters without a timetable keep the default DQ-* quests.

const DAY_CODES = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const todayCode = () => DAY_CODES[(new Date(new Date().toISOString().split('T')[0]).getUTCDay() + 6) % 7];

export const isTimetableQuest = (q: DailyQuest) => q.id.startsWith('CQ-') && q.category === 'routine';

/** All board quests: the timetable's quests if the hunter has a timetable, else the defaults. */
export function dailyBoard(quests: DailyQuest[]): DailyQuest[] {
  const timetable = quests.filter(isTimetableQuest);
  return timetable.length ? timetable : quests.filter(q => q.id.startsWith('DQ-'));
}

/** Today's board, in timetable order (only quests scheduled for today). */
export function todaysBoard(quests: DailyQuest[]): DailyQuest[] {
  return dailyBoard(quests)
    .filter(q => !q.recurrence?.length || q.recurrence.includes(todayCode()))
    .sort((a, b) => (a.time ?? '99').localeCompare(b.time ?? '99'));
}

/** For history (streaks, weekly reports): default and timetable quests both count. */
export const dailyHistoryQuests = (quests: DailyQuest[]) => quests.filter(q => q.id.startsWith('DQ-') || isTimetableQuest(q));
