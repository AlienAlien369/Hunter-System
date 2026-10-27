import { create } from 'zustand';
import { api, type OrgMe } from '../lib/api';

// The signed-in hunter's institution (B2B), its progress ledger and today's
// core tasks. Individuals (B2C) simply have `me.org === null`. Institution XP
// is kept apart from the personal XP in gameStore on purpose.

interface OrgState {
  me: OrgMe | null;
  loaded: boolean;
  busyTask: number | null;
  load: () => Promise<void>;
  toggle: (taskId: number) => Promise<{ action: 'completed' | 'undone'; orgXpGained: number } | null>;
  reset: () => void;
}

export const useOrgStore = create<OrgState>((set, get) => ({
  me: null,
  loaded: false,
  busyTask: null,
  load: async () => {
    try {
      set({ me: await api.getMyOrg(), loaded: true });
    } catch {
      set({ loaded: true });
    }
  },
  toggle: async taskId => {
    if (get().busyTask !== null) return null;
    set({ busyTask: taskId });
    try {
      const r = await api.toggleOrgTask(taskId);
      const me = get().me;
      if (me?.tasks && me.progress) {
        set({
          me: {
            ...me,
            tasks: me.tasks.map(t => (t.id === taskId ? { ...t, done: r.action === 'completed' } : t)),
            progress: { ...me.progress, ...r.progress, weekXp: me.progress.weekXp + r.orgXpGained, weekDone: me.progress.weekDone + (r.action === 'completed' ? 1 : -1) },
          },
        });
      }
      return r;
    } catch {
      await get().load();
      return null;
    } finally {
      set({ busyTask: null });
    }
  },
  reset: () => set({ me: null, loaded: false, busyTask: null }),
}));
