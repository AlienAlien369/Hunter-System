// ─── Sound Pack Definitions ─────────────────────────────────────────────────
// Each pack defines SFX parameters and a theme chord progression.

export type SoundPackId = 'solo-leveling' | 'dark-souls' | 'celeste' | 'no-sfx';

export interface SfxParams {
  /** Base frequency (Hz). */
  freq: number;
  /** Oscillator type. */
  type: OscillatorType;
  /** Volume 0–1. */
  vol: number;
  /** Duration in seconds. */
  dur: number;
  /** Optional glide-to frequency. */
  glideTo?: number;
  /** Delay before playing (seconds). */
  delay?: number;
}

export interface ThemeChord {
  drone: number;
  root: number;
  pad: number[];
  choir: number[];
  /** BPM for this pack's theme. */
  bpm: number;
}

export interface SoundPackConfig {
  id: SoundPackId;
  label: string;
  icon: string;
  description: string;
  /** If true, all SFX are silenced (only theme music plays, if enabled). */
  sfxDisabled?: boolean;

  // ── SFX parameters ──
  click: SfxParams[];
  complete: SfxParams[];
  undo: SfxParams[];
  levelUp: SfxParams[];
  rankUp: SfxParams[];
  redo: SfxParams[];
  login: SfxParams[];
  logout: SfxParams[];
  hiddenQuest: SfxParams[];
  penalty: SfxParams[];
  recovery: SfxParams[];
  notification: SfxParams[];

  // ── Theme music ──
  themeChords: Omit<ThemeChord, 'bpm'>[];
  themeBpm: number;
}

// ═════════════════════════════════════════════════════════════════════════════
//  SOLO LEVELING — default epic dark orchestral
// ═════════════════════════════════════════════════════════════════════════════

const SOLO_LEVELING: SoundPackConfig = {
  id: 'solo-leveling',
  label: 'Solo Leveling',
  icon: '⚔️',
  description: 'Epic dark orchestral — the System awakens.',
  click: [{ freq: 880, type: 'triangle', vol: 0.35, dur: 0.06 }],
  complete: [
    { freq: 659.25, type: 'sine', vol: 0.9, dur: 0.12 },
    { freq: 987.77, type: 'sine', vol: 0.9, dur: 0.22, delay: 0.09 },
    { freq: 1318.51, type: 'sine', vol: 0.55, dur: 0.3, delay: 0.18 },
  ],
  undo: [
    { freq: 523.25, type: 'triangle', vol: 0.55, dur: 0.1 },
    { freq: 392, type: 'triangle', vol: 0.5, dur: 0.2, delay: 0.08, glideTo: 311.13 },
  ],
  levelUp: [
    { freq: 523.25, type: 'sine', vol: 0.75, dur: 0.28, delay: 0 },
    { freq: 659.25, type: 'sine', vol: 0.75, dur: 0.28, delay: 0.09 },
    { freq: 783.99, type: 'sine', vol: 0.75, dur: 0.28, delay: 0.18 },
    { freq: 1046.5, type: 'sine', vol: 0.75, dur: 0.28, delay: 0.27 },
    { freq: 2093, type: 'sine', vol: 0.45, dur: 0.5, delay: 0.36 },
  ],
  rankUp: [
    { freq: 220, type: 'sine', vol: 0.7, dur: 0.55, delay: 0 },
    { freq: 277.18, type: 'sine', vol: 0.7, dur: 0.55, delay: 0.02 },
    { freq: 329.63, type: 'sine', vol: 0.7, dur: 0.55, delay: 0.04 },
    { freq: 440, type: 'sine', vol: 0.7, dur: 0.55, delay: 0.06 },
    { freq: 880, type: 'sine', vol: 0.55, dur: 0.5, delay: 0.25 },
    { freq: 1760, type: 'sine', vol: 0.35, dur: 0.45, delay: 0.45 },
  ],
  redo: [
    { freq: 640, type: 'sawtooth', vol: 0.16, dur: 0.5, glideTo: 110 },
    { freq: 320, type: 'triangle', vol: 0.3, dur: 0.5, delay: 0.06, glideTo: 55 },
  ],
  login: [
    { freq: 220, type: 'triangle', vol: 0.5, dur: 0.16, delay: 0 },
    { freq: 277.18, type: 'triangle', vol: 0.5, dur: 0.16, delay: 0.07 },
    { freq: 329.63, type: 'triangle', vol: 0.5, dur: 0.16, delay: 0.14 },
    { freq: 440, type: 'triangle', vol: 0.5, dur: 0.16, delay: 0.21 },
    { freq: 554.37, type: 'triangle', vol: 0.5, dur: 0.16, delay: 0.28 },
    { freq: 659.25, type: 'triangle', vol: 0.5, dur: 0.16, delay: 0.35 },
    { freq: 880, type: 'sine', vol: 0.6, dur: 0.45, delay: 0.44 },
  ],
  logout: [
    { freq: 659.25, type: 'triangle', vol: 0.4, dur: 0.22, delay: 0 },
    { freq: 554.37, type: 'triangle', vol: 0.4, dur: 0.22, delay: 0.08 },
    { freq: 440, type: 'triangle', vol: 0.4, dur: 0.22, delay: 0.16 },
    { freq: 329.63, type: 'triangle', vol: 0.4, dur: 0.22, delay: 0.24 },
    { freq: 220, type: 'triangle', vol: 0.4, dur: 0.22, delay: 0.32 },
  ],
  hiddenQuest: [
    { freq: 220, type: 'sine', vol: 0.4, dur: 0.25, delay: 0 },
    { freq: 277.18, type: 'sine', vol: 0.4, dur: 0.25, delay: 0.05 },
    { freq: 329.63, type: 'sine', vol: 0.4, dur: 0.25, delay: 0.10 },
    { freq: 440, type: 'sine', vol: 0.4, dur: 0.25, delay: 0.15 },
    { freq: 587.33, type: 'sine', vol: 0.4, dur: 0.25, delay: 0.20 },
  ],
  penalty: [
    { freq: 220, type: 'sawtooth', vol: 0.2, dur: 0.8, glideTo: 110 },
    { freq: 110, type: 'sine', vol: 0.5, dur: 1.0, glideTo: 55 },
    { freq: 554.37, type: 'triangle', vol: 0.3, dur: 0.4, delay: 0.1, glideTo: 220 },
    { freq: 174.61, type: 'sine', vol: 0.4, dur: 0.5, delay: 0.5, glideTo: 87.31 },
  ],
  recovery: [
    { freq: 523.25, type: 'sine', vol: 0.5, dur: 0.3, delay: 0 },
    { freq: 659.25, type: 'sine', vol: 0.5, dur: 0.3, delay: 0.07 },
    { freq: 783.99, type: 'sine', vol: 0.5, dur: 0.3, delay: 0.14 },
    { freq: 1046.5, type: 'sine', vol: 0.5, dur: 0.3, delay: 0.21 },
    { freq: 1318.51, type: 'sine', vol: 0.5, dur: 0.3, delay: 0.28 },
    { freq: 2093, type: 'sine', vol: 0.35, dur: 0.6, delay: 0.42 },
  ],
  notification: [
    { freq: 783.99, type: 'sine', vol: 0.35, dur: 0.12 },
    { freq: 1046.5, type: 'sine', vol: 0.3, dur: 0.25, delay: 0.09 },
  ],
  themeBpm: 92,
  themeChords: [
    { drone: 36.71, root: 73.42, pad: [87.31, 110, 146.83, 220], choir: [293.66, 349.23, 440] },
    { drone: 58.27, root: 116.54, pad: [146.83, 174.61, 233.08], choir: [293.66, 349.23, 466.16] },
    { drone: 43.65, root: 87.31, pad: [110, 130.81, 174.61, 220], choir: [220, 261.63, 349.23] },
    { drone: 65.41, root: 130.81, pad: [164.81, 196, 261.63], choir: [261.63, 329.63, 392] },
  ],
};

// ═════════════════════════════════════════════════════════════════════════════
//  DARK SOULS — heavy, ominous, resonant
// ═════════════════════════════════════════════════════════════════════════════

const DARK_SOULS: SoundPackConfig = {
  id: 'dark-souls',
  label: 'Dark Souls',
  icon: '💀',
  description: 'Heavy, ominous — death and rebirth.',
  click: [{ freq: 440, type: 'square', vol: 0.15, dur: 0.04 }],
  complete: [
    { freq: 329.63, type: 'sine', vol: 0.7, dur: 0.3 },
    { freq: 493.88, type: 'sine', vol: 0.7, dur: 0.4, delay: 0.2 },
    { freq: 659.25, type: 'sine', vol: 0.5, dur: 0.6, delay: 0.4 },
  ],
  undo: [
    { freq: 293.66, type: 'triangle', vol: 0.5, dur: 0.15 },
    { freq: 220, type: 'triangle', vol: 0.4, dur: 0.3, delay: 0.1, glideTo: 164.81 },
  ],
  levelUp: [
    { freq: 261.63, type: 'sine', vol: 0.6, dur: 0.4, delay: 0 },
    { freq: 329.63, type: 'sine', vol: 0.6, dur: 0.4, delay: 0.15 },
    { freq: 392, type: 'sine', vol: 0.6, dur: 0.4, delay: 0.30 },
    { freq: 523.25, type: 'sine', vol: 0.6, dur: 0.5, delay: 0.45 },
    { freq: 1046.5, type: 'sine', vol: 0.3, dur: 0.7, delay: 0.6 },
  ],
  rankUp: [
    { freq: 130.81, type: 'sawtooth', vol: 0.25, dur: 0.8, delay: 0 },
    { freq: 196, type: 'sawtooth', vol: 0.25, dur: 0.8, delay: 0.05 },
    { freq: 261.63, type: 'sawtooth', vol: 0.25, dur: 0.8, delay: 0.10 },
    { freq: 523.25, type: 'sine', vol: 0.5, dur: 0.6, delay: 0.4 },
    { freq: 1046.5, type: 'sine', vol: 0.3, dur: 0.8, delay: 0.6 },
  ],
  redo: [
    { freq: 440, type: 'sawtooth', vol: 0.2, dur: 0.6, glideTo: 55 },
    { freq: 220, type: 'triangle', vol: 0.3, dur: 0.7, delay: 0.05, glideTo: 40 },
  ],
  login: [
    { freq: 130.81, type: 'triangle', vol: 0.4, dur: 0.2, delay: 0 },
    { freq: 164.81, type: 'triangle', vol: 0.4, dur: 0.2, delay: 0.12 },
    { freq: 196, type: 'triangle', vol: 0.4, dur: 0.2, delay: 0.24 },
    { freq: 261.63, type: 'triangle', vol: 0.4, dur: 0.2, delay: 0.36 },
    { freq: 523.25, type: 'sine', vol: 0.5, dur: 0.5, delay: 0.48 },
  ],
  logout: [
    { freq: 392, type: 'triangle', vol: 0.35, dur: 0.3, delay: 0 },
    { freq: 329.63, type: 'triangle', vol: 0.35, dur: 0.3, delay: 0.12 },
    { freq: 261.63, type: 'triangle', vol: 0.35, dur: 0.3, delay: 0.24 },
    { freq: 196, type: 'triangle', vol: 0.35, dur: 0.4, delay: 0.36 },
  ],
  hiddenQuest: [
    { freq: 146.83, type: 'sine', vol: 0.3, dur: 0.4, delay: 0 },
    { freq: 174.61, type: 'sine', vol: 0.3, dur: 0.4, delay: 0.1 },
    { freq: 220, type: 'sine', vol: 0.3, dur: 0.4, delay: 0.2 },
    { freq: 293.66, type: 'sine', vol: 0.3, dur: 0.5, delay: 0.3 },
  ],
  penalty: [
    { freq: 110, type: 'sawtooth', vol: 0.3, dur: 1.2, glideTo: 40 },
    { freq: 55, type: 'sine', vol: 0.6, dur: 1.5, glideTo: 27.5 },
    { freq: 146.83, type: 'triangle', vol: 0.25, dur: 0.6, delay: 0.2, glideTo: 73.42 },
  ],
  recovery: [
    { freq: 261.63, type: 'sine', vol: 0.5, dur: 0.4, delay: 0 },
    { freq: 329.63, type: 'sine', vol: 0.5, dur: 0.4, delay: 0.12 },
    { freq: 392, type: 'sine', vol: 0.5, dur: 0.4, delay: 0.24 },
    { freq: 523.25, type: 'sine', vol: 0.5, dur: 0.5, delay: 0.36 },
    { freq: 783.99, type: 'sine', vol: 0.35, dur: 0.7, delay: 0.5 },
  ],
  notification: [
    { freq: 440, type: 'sine', vol: 0.25, dur: 0.2 },
    { freq: 554.37, type: 'sine', vol: 0.2, dur: 0.3, delay: 0.12 },
  ],
  themeBpm: 72,
  themeChords: [
    // E minor — deep, heavy
    { drone: 41.2, root: 82.41, pad: [98, 123.47, 164.81], choir: [246.94, 293.66, 329.63] },
    // C minor
    { drone: 32.7, root: 65.41, pad: [77.78, 98, 130.81], choir: [196, 233.08, 261.63] },
    // G minor
    { drone: 49, root: 98, pad: [116.54, 146.83, 196], choir: [293.66, 349.23, 392] },
    // D minor
    { drone: 36.71, root: 73.42, pad: [87.31, 110, 146.83], choir: [220, 261.63, 329.63] },
  ],
};

// ═════════════════════════════════════════════════════════════════════════════
//  CELESTE — gentle, melodic, chill piano feel
// ═════════════════════════════════════════════════════════════════════════════

const CELESTE: SoundPackConfig = {
  id: 'celeste',
  label: 'Celeste',
  icon: '🎹',
  description: 'Gentle, melodic — chill piano vibes.',
  click: [{ freq: 1200, type: 'sine', vol: 0.2, dur: 0.05 }],
  complete: [
    { freq: 783.99, type: 'sine', vol: 0.6, dur: 0.2 },
    { freq: 987.77, type: 'sine', vol: 0.6, dur: 0.25, delay: 0.12 },
    { freq: 1174.66, type: 'sine', vol: 0.4, dur: 0.35, delay: 0.24 },
  ],
  undo: [
    { freq: 659.25, type: 'sine', vol: 0.4, dur: 0.12 },
    { freq: 523.25, type: 'sine', vol: 0.35, dur: 0.2, delay: 0.08 },
  ],
  levelUp: [
    { freq: 523.25, type: 'sine', vol: 0.5, dur: 0.2, delay: 0 },
    { freq: 659.25, type: 'sine', vol: 0.5, dur: 0.2, delay: 0.1 },
    { freq: 783.99, type: 'sine', vol: 0.5, dur: 0.2, delay: 0.2 },
    { freq: 1046.5, type: 'sine', vol: 0.5, dur: 0.3, delay: 0.3 },
    { freq: 1568, type: 'sine', vol: 0.25, dur: 0.5, delay: 0.4 },
  ],
  rankUp: [
    { freq: 440, type: 'sine', vol: 0.5, dur: 0.4, delay: 0 },
    { freq: 554.37, type: 'sine', vol: 0.5, dur: 0.4, delay: 0.08 },
    { freq: 659.25, type: 'sine', vol: 0.5, dur: 0.4, delay: 0.16 },
    { freq: 880, type: 'sine', vol: 0.5, dur: 0.5, delay: 0.28 },
    { freq: 1320, type: 'sine', vol: 0.25, dur: 0.6, delay: 0.42 },
  ],
  redo: [
    { freq: 659.25, type: 'sine', vol: 0.25, dur: 0.4, glideTo: 330 },
    { freq: 440, type: 'sine', vol: 0.2, dur: 0.5, delay: 0.05, glideTo: 220 },
  ],
  login: [
    { freq: 523.25, type: 'sine', vol: 0.35, dur: 0.12, delay: 0 },
    { freq: 659.25, type: 'sine', vol: 0.35, dur: 0.12, delay: 0.08 },
    { freq: 783.99, type: 'sine', vol: 0.35, dur: 0.12, delay: 0.16 },
    { freq: 1046.5, type: 'sine', vol: 0.4, dur: 0.3, delay: 0.24 },
  ],
  logout: [
    { freq: 783.99, type: 'sine', vol: 0.3, dur: 0.15, delay: 0 },
    { freq: 659.25, type: 'sine', vol: 0.3, dur: 0.15, delay: 0.1 },
    { freq: 523.25, type: 'sine', vol: 0.3, dur: 0.2, delay: 0.2 },
  ],
  hiddenQuest: [
    { freq: 659.25, type: 'sine', vol: 0.25, dur: 0.3, delay: 0 },
    { freq: 783.99, type: 'sine', vol: 0.25, dur: 0.3, delay: 0.08 },
    { freq: 987.77, type: 'sine', vol: 0.25, dur: 0.3, delay: 0.16 },
    { freq: 1174.66, type: 'sine', vol: 0.2, dur: 0.4, delay: 0.24 },
  ],
  penalty: [
    { freq: 330, type: 'sine', vol: 0.3, dur: 0.6, glideTo: 220 },
    { freq: 220, type: 'sine', vol: 0.35, dur: 0.8, glideTo: 165 },
  ],
  recovery: [
    { freq: 523.25, type: 'sine', vol: 0.4, dur: 0.2, delay: 0 },
    { freq: 659.25, type: 'sine', vol: 0.4, dur: 0.2, delay: 0.1 },
    { freq: 783.99, type: 'sine', vol: 0.4, dur: 0.2, delay: 0.2 },
    { freq: 1046.5, type: 'sine', vol: 0.35, dur: 0.4, delay: 0.3 },
  ],
  notification: [
    { freq: 880, type: 'sine', vol: 0.2, dur: 0.1 },
    { freq: 1108.73, type: 'sine', vol: 0.18, dur: 0.2, delay: 0.08 },
  ],
  themeBpm: 80,
  themeChords: [
    // C major — bright, open
    { drone: 65.41, root: 130.81, pad: [164.81, 196, 261.63], choir: [329.63, 392, 523.25] },
    // G major
    { drone: 49, root: 98, pad: [123.47, 146.83, 196], choir: [246.94, 293.66, 392] },
    // A minor
    { drone: 55, root: 110, pad: [130.81, 164.81, 220], choir: [261.63, 329.63, 440] },
    // F major
    { drone: 43.65, root: 87.31, pad: [110, 130.81, 174.61], choir: [220, 261.63, 349.23] },
  ],
};

// ═════════════════════════════════════════════════════════════════════════════
//  NO SFX — all SFX silenced, only theme music plays
// ═════════════════════════════════════════════════════════════════════════════

const NO_SFX: SoundPackConfig = {
  id: 'no-sfx',
  label: 'No SFX',
  icon: '🔇',
  description: 'Silence all effects — theme music only.',
  sfxDisabled: true,
  click: [],
  complete: [],
  undo: [],
  levelUp: [],
  rankUp: [],
  redo: [],
  login: [],
  logout: [],
  hiddenQuest: [],
  penalty: [],
  recovery: [],
  notification: [],
  themeBpm: 92,
  themeChords: SOLO_LEVELING.themeChords, // reuse Solo Leveling theme
};

// ─── Registry ───────────────────────────────────────────────────────────────

export const SOUND_PACKS: Record<SoundPackId, SoundPackConfig> = {
  'solo-leveling': SOLO_LEVELING,
  'dark-souls': DARK_SOULS,
  'celeste': CELESTE,
  'no-sfx': NO_SFX,
};

export const SOUND_PACK_LIST = Object.values(SOUND_PACKS);
