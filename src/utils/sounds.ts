import { useSoundStore } from '../store/soundStore';

type OscType = OscillatorType;

/**
 * Synthesized sound effects via the Web Audio API — no audio assets needed.
 * The context is created lazily on the first play (which happens inside a
 * user gesture), satisfying browser autoplay policies. Every play respects
 * the global mute toggle in the sound store.
 */
class SFXEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;

  private ensure(): AudioContext | null {
    if (useSoundStore.getState().muted) return null;
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.22;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private tone(
    freq: number,
    startAt: number,
    dur: number,
    opts: { type?: OscType; vol?: number; glideTo?: number } = {},
  ) {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const { type = 'sine', vol = 1, glideTo } = opts;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t = ctx.currentTime + startAt;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (glideTo) {
      osc.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
    }
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  /** Subtle UI tick for navigation and button presses. */
  click() {
    this.tone(880, 0, 0.06, { type: 'triangle', vol: 0.35 });
  }

  /** Quest completed — bright two-note chime with a sparkle tail. */
  complete() {
    this.tone(659.25, 0, 0.12, { type: 'sine', vol: 0.9 }); // E5
    this.tone(987.77, 0.09, 0.22, { type: 'sine', vol: 0.9 }); // B5
    this.tone(1318.51, 0.18, 0.3, { type: 'sine', vol: 0.55 }); // E6
  }

  /** Quest un-marked — short descending blip. */
  undo() {
    this.tone(523.25, 0, 0.1, { type: 'triangle', vol: 0.55 }); // C5
    this.tone(392, 0.08, 0.2, { type: 'triangle', vol: 0.5, glideTo: 311.13 }); // G4 → D#4
  }

  /** Level up — rising C-major fanfare. */
  levelUp() {
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    notes.forEach((f, i) => this.tone(f, i * 0.09, 0.28, { type: 'sine', vol: 0.75 }));
    this.tone(2093, 0.36, 0.5, { type: 'sine', vol: 0.45 }); // C7 tail
  }

  /** Rank up — deep triumphant chord + octave stab. */
  rankUp() {
    const chord = [220, 277.18, 329.63, 440]; // A3 C#4 E4 A4
    chord.forEach((f, i) => this.tone(f, i * 0.02, 0.55, { type: 'sine', vol: 0.7 }));
    chord.forEach((f, i) => this.tone(f, i * 0.02, 0.35, { type: 'sawtooth', vol: 0.14 }));
    this.tone(880, 0.25, 0.5, { type: 'sine', vol: 0.55 }); // A5 stab
    this.tone(1760, 0.45, 0.45, { type: 'sine', vol: 0.35 }); // A6 shimmer
  }

  /** Level + rank at once — rank chord rolling into a level-up arpeggio. */
  doubleUp() {
    const chord = [110, 164.81, 220, 277.18]; // A2 E3 A3 C#4
    chord.forEach((f, i) => this.tone(f, i * 0.02, 0.6, { type: 'sawtooth', vol: 0.16 }));
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => this.tone(f, 0.28 + i * 0.09, 0.28, { type: 'sine', vol: 0.75 }));
    this.tone(2093, 0.68, 0.55, { type: 'sine', vol: 0.5 });
  }

  /** Track reset — power-down frequency sweep. */
  redo() {
    this.tone(640, 0, 0.5, { type: 'sawtooth', vol: 0.16, glideTo: 110 });
    this.tone(320, 0.06, 0.5, { type: 'triangle', vol: 0.3, glideTo: 55 });
  }

  /** Successful login — rising system-boot glissando. */
  login() {
    const notes = [220, 277.18, 329.63, 440, 554.37, 659.25];
    notes.forEach((f, i) => this.tone(f, i * 0.07, 0.16, { type: 'triangle', vol: 0.5 }));
    this.tone(880, 0.44, 0.45, { type: 'sine', vol: 0.6 });
  }

  /** Logout — power-down cascade. */
  logout() {
    const notes = [659.25, 554.37, 440, 329.63, 220];
    notes.forEach((f, i) => this.tone(f, i * 0.08, 0.22, { type: 'triangle', vol: 0.4 }));
  }
}

export const sfx = new SFXEngine();