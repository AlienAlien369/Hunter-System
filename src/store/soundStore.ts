import { create } from 'zustand';

const SOUND_KEY = 'hunter_sound_muted';
const CELEBRATE_KEY = 'hunter_celebrate_sound';

interface SoundState {
  /** Master mute — silences every effect. */
  muted: boolean;
  /** Milestone chimes — level-up / rank-up fanfares (independent of master mute). */
  celebrateSound: boolean;
  toggleMuted: () => void;
  toggleCelebrateSound: () => void;
}

export const useSoundStore = create<SoundState>(set => ({
  muted: localStorage.getItem(SOUND_KEY) === '1',
  celebrateSound: localStorage.getItem(CELEBRATE_KEY) !== '0', // default ON
  toggleMuted: () =>
    set(state => {
      const muted = !state.muted;
      localStorage.setItem(SOUND_KEY, muted ? '1' : '0');
      return { muted };
    }),
  toggleCelebrateSound: () =>
    set(state => {
      const celebrateSound = !state.celebrateSound;
      localStorage.setItem(CELEBRATE_KEY, celebrateSound ? '1' : '0');
      return { celebrateSound };
    }),
}));