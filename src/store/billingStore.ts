import { create } from 'zustand';
import { api } from '../lib/api';

// The signed-in hunter's plan, for UI courtesies (premium themes, "Pro" badges).
// The server decides what a plan really allows; nothing here is access control.
interface BillingState {
  loaded: boolean;
  plan: 'free' | 'pro' | 'teams';
  premiumCosmetics: boolean;
  load: () => Promise<void>;
  reset: () => void;
}

export const useBillingStore = create<BillingState>(set => ({
  loaded: false,
  plan: 'free',
  premiumCosmetics: false,
  load: async () => {
    try {
      const b = await api.getBilling();
      set({ loaded: true, plan: b.plan, premiumCosmetics: b.limits.premiumCosmetics });
    } catch {
      // Billing unavailable: treat as free but do not claim to know, so a Pro hunter's theme is not reset on a blip.
      set({ loaded: false });
    }
  },
  reset: () => set({ loaded: false, plan: 'free', premiumCosmetics: false }),
}));
