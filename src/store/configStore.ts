import { create } from 'zustand';
import { api, type PublicConfig } from '../lib/api';
import { DEFAULT_APP_NAME, appName, setAppName } from '../i18n';

// The platform's public settings — product name, tagline and prices — owned by
// the super admin and fetched once per visit. Until they arrive, the build-time
// default name is shown, so nothing ever blanks.

interface ConfigState {
  config: PublicConfig | null;
  load: () => Promise<void>;
  /** Apply settings the super admin just saved, without a reload. */
  apply: (config: PublicConfig) => void;
}

/** Swap the product name inside a page title ("Pricing · Old Name" → "Pricing · New Name"). */
export function retitle(title: string, from: string, to: string): string {
  if (!from || from === to || !title.includes(from)) return title;
  return title.split(from).join(to);
}

function applyBrand(name: string) {
  const previous = appName();
  setAppName(name);
  if (typeof document !== 'undefined') {
    document.title = retitle(retitle(document.title, previous, name), DEFAULT_APP_NAME, name);
    document.querySelector('meta[name="application-name"]')?.setAttribute('content', name);
    document.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute('content', name);
  }
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  config: null,
  load: async () => {
    if (get().config) return;
    try {
      const config = await api.getPublicConfig();
      get().apply(config);
    } catch {
      // Offline or API down: keep the build-time name and the plan page's own prices.
    }
  },
  apply: config => {
    applyBrand(config.brand.name);
    set({ config });
  },
}));
