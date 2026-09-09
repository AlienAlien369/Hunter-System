import { create } from 'zustand';

const SOUND_KEY = 'hunter_sound_muted';

interface SoundState {
  muted: boolean;
  toggleMuted: () => void;
}

export const useSoundStore = create<SoundState>(set => ({
  muted: localStorage.getItem(SOUND_KEY) === '1',
  toggleMuted: () =>
    set(state => {
      const muted = !state.muted;
      localStorage.setItem(SOUND_KEY, muted ? '1' : '0');
      return { muted };
    }),
}));