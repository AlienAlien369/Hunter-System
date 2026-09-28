import { api, DAYS, type RoutineItem } from '../../lib/api';

export const newSlot = (p: Partial<RoutineItem> = {}): RoutineItem => ({
  id: crypto.randomUUID(), module: '', title: '', time: '09:00', durationMin: 30, days: [...DAYS], ...p,
});

export const fmtTime = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

export const slotsValid = (items: RoutineItem[]) =>
  items.length > 0 && items.every(i => i.module.trim() && i.title.trim() && i.days.length && i.durationMin >= 5);

/**
 * Save flow shared by the timetable page: preview → (setup period: save
 * directly | established: confirm dialog) → save with the exact XP shown.
 */
export async function previewRoutineChange(items: RoutineItem[]) {
  const preview = await api.previewRoutine(items);
  const needsConfirm = preview.established && preview.changes.length > 0;
  return { preview, needsConfirm };
}
