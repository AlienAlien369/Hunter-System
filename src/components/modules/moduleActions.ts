import { api, type HunterModule, type ModuleTaskSpec, type Quest } from '../../lib/api';
import { useModuleStore, withXpConfirm } from '../../store/moduleStore';
import { useGameStore } from '../../store/gameStore';

const reload = () => Promise.all([useModuleStore.getState().load(), useGameStore.getState().loadDashboard()]);

/** Pause or resume. Pausing an established module asks to confirm its XP impact. Returns false if cancelled. */
export async function toggleModulePause(m: HunterModule): Promise<boolean> {
  const status = m.status === 'paused' ? 'active' : 'paused';
  const res = await withXpConfirm(exp => api.updateModule(m.id, { status }, exp));
  if (res === null) return false;
  await reload();
  return true;
}

/** Remove a module (its tasks are archived; earned XP stays). Returns false if cancelled. */
export async function removeModule(m: HunterModule): Promise<boolean> {
  if (!confirm(`Remove ${m.name}? Its tasks are archived; XP you already earned is kept.`)) return false;
  const res = await withXpConfirm(exp => api.deleteModule(m.id, exp));
  if (res === null) return false;
  await reload();
  return true;
}

export const graceLabel = (m: HunterModule) =>
  m.established
    ? 'Established'
    : `Setup period until ${new Date(m.graceEndsAt).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}`;

export const toTaskSpec = (q: Quest): ModuleTaskSpec => ({
  id: q.quest_id,
  title: q.title,
  difficulty: q.difficulty as 1 | 2 | 3,
  scheduleTime: q.schedule_time ?? null,
  timeOfDay: q.time_of_day === 'morning' || q.time_of_day === 'evening' ? q.time_of_day : null,
  recurrence: q.recurrence ?? null,
  subtasks: q.metadata?.subtasks ?? [],
  xp: q.xp_reward,
});
