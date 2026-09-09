import { create } from 'zustand';
import type { SoundPackId } from '../data/soundPacks';

const SOUND_KEY = 'hunter_sound_muted';
const CELEBRATE_KEY = 'hunter_celebrate_sound';
const THEME_KEY = 'hunter_theme_music';
const PACK_KEY = 'hunter_sound_pack';

interface SoundState {
  /** Master mute — silences every effect. */
  muted: boolean;
  /** Milestone chimes — level-up / rank-up fanfares (independent of master mute). */
  celebrateSound: boolean;
  /** Background theme music — epic Solo Leveling-style loop. */
  themeMusic: boolean;
  /** Active sound pack. */
  soundPack: SoundPackId;
  toggleMuted: () => void;
  toggleCelebrateSound: () => void;
  toggleThemeMusic: () => void;
  setSoundPack: (pack: SoundPackId) => void;
}

export const useSoundStore = create<SoundState>(set => ({
  muted: localStorage.getItem(SOUND_KEY) === '1',
  celebrateSound: localStorage.getItem(CELEBRATE_KEY) !== '0', // default ON
  themeMusic: localStorage.getItem(THEME_KEY) !== '0', // default ON
  soundPack: (localStorage.getItem(PACK_KEY) as SoundPackId) || 'solo-leveling',
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
  toggleThemeMusic: () =>
    set(state => {
      const themeMusic = !state.themeMusic;
      localStorage.setItem(THEME_KEY, themeMusic ? '1' : '0');
      return { themeMusic };
    }),
  setSoundPack: (pack) => {
    localStorage.setItem(PACK_KEY, pack);
    set({ soundPack: pack });
  },
}));