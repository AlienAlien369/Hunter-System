import { create } from 'zustand';
import { api, ApiError, type HunterModule, type XpConfirmation } from '../lib/api';

interface ModuleState {
  modules: HunterModule[];
  loaded: boolean;
  load: () => Promise<void>;
  /** XP-impact preview awaiting the hunter's decision (rendered by XpConfirmHost). */
  pending: XpConfirmation | null;
  resolver: ((ok: boolean) => void) | null;
  ask: (preview: XpConfirmation) => Promise<boolean>;
  answer: (ok: boolean) => void;
}

export const useModuleStore = create<ModuleState>((set, get) => ({
  modules: [],
  loaded: false,
  load: async () => {
    try {
      set({ modules: await api.getModules(), loaded: true });
    } catch {
      set({ loaded: true });
    }
  },
  pending: null,
  resolver: null,
  ask: preview => new Promise<boolean>(resolve => set({ pending: preview, resolver: resolve })),
  answer: ok => {
    get().resolver?.(ok);
    set({ pending: null, resolver: null });
  },
}));

/**
 * Run a change that may carry XP consequences. The server answers 409 with a
 * preview when it does; we show it, and on confirm retry with the exact net XP
 * the hunter saw. Returns null if the hunter cancelled.
 */
export async function withXpConfirm<T>(call: (expectedXp?: number) => Promise<T>): Promise<T | null> {
  try {
    return await call();
  } catch (e) {
    if (!(e instanceof ApiError) || e.status !== 409 || !e.data.requiresConfirmation) throw e;
    const preview = e.data as unknown as XpConfirmation;
    if (!(await useModuleStore.getState().ask(preview))) return null;
    return call(preview.netXp);
  }
}
