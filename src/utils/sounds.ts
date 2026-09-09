import { useSoundStore } from '../store/soundStore';
import { SOUND_PACKS, type SoundPackId, type SfxParams } from '../data/soundPacks';

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
  private themeGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private themeTimer: number | null = null;
  private themeChordIndex = 0;
  private themeNextBarTime = 0;

  /** Get the currently active sound pack config. */
  private getPack() {
    return SOUND_PACKS[useSoundStore.getState().soundPack] || SOUND_PACKS['solo-leveling'];
  }

  /** Play a list of SFX params from the current pack. */
  private playPackSfx(params: SfxParams[]) {
    const pack = this.getPack();
    if (pack.sfxDisabled) return;
    params.forEach(p => {
      this.tone(p.freq, p.delay ?? 0, p.dur, { type: p.type, vol: p.vol, glideTo: p.glideTo });
    });
  }

  /** Create (and resume) the AudioContext, ignoring the mute toggle. */
  private rawCtx(): AudioContext | null {
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.22;
      this.master.connect(this.ctx.destination);

      // Dedicated bus for the background theme (fades in/out independently).
      this.themeGain = this.ctx.createGain();
      this.themeGain.gain.value = 0;
      this.themeGain.connect(this.master);

      // 1s of white noise, reused for percussion + the system-window whoosh.
      const buf = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buf;
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private ensure(): AudioContext | null {
    if (useSoundStore.getState().muted) return null;
    return this.rawCtx();
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
  click() { this.playPackSfx(this.getPack().click); }

  /** Quest completed. */
  complete() { this.playPackSfx(this.getPack().complete); }

  /** Quest un-marked. */
  undo() { this.playPackSfx(this.getPack().undo); }

  /** Level up. */
  levelUp() { this.playPackSfx(this.getPack().levelUp); }

  /** Rank up. */
  rankUp() { this.playPackSfx(this.getPack().rankUp); }

  /** Level + rank at once — plays both rankUp and levelUp. */
  doubleUp() { this.rankUp(); setTimeout(() => this.levelUp(), 300); }

  /** Track reset. */
  redo() { this.playPackSfx(this.getPack().redo); }

  /** Successful login. */
  login() {
    this.playPackSfx(this.getPack().login);
    this.systemWindow(0.45);
  }

  /** Logout. */
  logout() { this.playPackSfx(this.getPack().logout); }

  /** Hidden quest reveal. */
  hiddenQuest() {
    this.playPackSfx(this.getPack().hiddenQuest);
    const ctx = this.ensure();
    if (ctx) this.bell(1318.51, ctx.currentTime + 0.3, [1, 2.4, 3.1], 0.35);
  }

  /** Penalty. */
  penalty() { this.playPackSfx(this.getPack().penalty); }

  /** Penalty recovered. */
  recovery() { this.playPackSfx(this.getPack().recovery); }

  /** New notification. */
  notification() { this.playPackSfx(this.getPack().notification); }

  /**
   * Solo Leveling-style "system window" opening — a soft airy whoosh that
   * resolves into the iconic bright metallic chime.
   */
  systemWindow(startAt = 0) {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime + startAt;

    // Whoosh: filtered noise sweeping upward as the window materializes.
    if (this.noiseBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.Q.value = 1.2;
      f.frequency.setValueAtTime(350, t);
      f.frequency.exponentialRampToValueAtTime(2600, t + 0.3);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16, t + 0.08);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
      src.connect(f).connect(g).connect(this.master);
      src.start(t);
      src.stop(t + 0.35);
    }

    // The iconic chime: C6 bell with inharmonic partials (FM-style metallic tone).
    this.bell(1046.5, t, [1, 2.0, 2.76, 4.16], 0.5);
  }

  /** Metallic bell — fundamental + inharmonic partials with fast decay. */
  private bell(base: number, t: number, partials: number[], vol: number) {
    const ctx = this.ctx;
    const out = this.master;
    if (!ctx || !out) return;
    partials.forEach((ratio, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = base * ratio;
      const g = ctx.createGain();
      const pVol = vol / (1 + i * 0.55);
      const decay = 1.3 - i * 0.18;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(pVol, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
      osc.connect(g).connect(out);
      osc.start(t);
      osc.stop(t + decay + 0.05);
    });
  }

  // ------------------------------------------------------------------
  // Background theme music — dark epic "Solo Leveling" style loop
  // ------------------------------------------------------------------

  get themePlaying(): boolean {
    return this.themeTimer !== null;
  }

  /** Start the epic background theme loop (no-op if already playing). */
  startTheme() {
    const ctx = this.rawCtx();
    if (!ctx || this.themePlaying) return;
    this.themeChordIndex = 0;
    this.themeNextBarTime = ctx.currentTime + 0.15;
    if (this.themeGain) {
      this.themeGain.gain.cancelScheduledValues(ctx.currentTime);
      this.themeGain.gain.setValueAtTime(0.0001, ctx.currentTime);
      this.themeGain.gain.exponentialRampToValueAtTime(0.6, ctx.currentTime + 2.5);
    }
    this.scheduleThemeBar();
  }

  /** Fade out and stop the background theme loop. */
  stopTheme() {
    if (this.themeTimer !== null) {
      window.clearTimeout(this.themeTimer);
      this.themeTimer = null;
    }
    const ctx = this.ctx;
    if (ctx && this.themeGain) {
      this.themeGain.gain.cancelScheduledValues(ctx.currentTime);
      this.themeGain.gain.setValueAtTime(Math.max(this.themeGain.gain.value, 0.0001), ctx.currentTime);
      this.themeGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.8);
    }
  }

  /** Lookahead scheduler — fires just before each bar is due. */
  private scheduleThemeBar = () => {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (this.themeNextBarTime < now) {
      this.themeNextBarTime = now + 0.08;
    }
    const { muted, themeMusic } = useSoundStore.getState();
    if (!muted && themeMusic) {
      this.playThemeChord(this.themeChordIndex, this.themeNextBarTime);
    }
    const pack = this.getPack();
    const barDur = (60 / pack.themeBpm) * 4;
    this.themeNextBarTime += barDur;
    this.themeChordIndex += 1;
    const delay = Math.max(0, (this.themeNextBarTime - 0.35 - this.ctx.currentTime) * 1000);
    this.themeTimer = window.setTimeout(this.scheduleThemeBar, delay);
  };

  /** Schedule one bar of the theme at absolute time `t`. */
  private playThemeChord(index: number, t: number) {
    const pack = this.getPack();
    const chord = pack.themeChords[index % pack.themeChords.length];
    const barDur = (60 / pack.themeBpm) * 4;
    const twoBars = barDur * 2;

    // Harmony: deep drone, bass, string pads and choral "ahh".
    this.themeDrone(chord.drone, t, twoBars + 0.4);
    this.themeBass(chord.root, t, twoBars);
    chord.pad.forEach(f => this.themePad(f, t, twoBars));
    chord.choir.forEach(f => this.themeChoir(f, t, twoBars));

    // Orchestral hit on every harmony change.
    this.themeHit(t);

    // Percussion enters after the 4-chord intro (one full loop).
    if (index >= 4) {
      const barDur = (60 / pack.themeBpm) * 4;
      for (let b = 0; b < 2; b++) {
        const bt = t + b * barDur;
        this.themeKick(bt);
        this.themeKick(bt + barDur / 2, 0.55);
        this.themeSnare(bt + barDur / 4);
        this.themeSnare(bt + (barDur * 3) / 4);
        for (let h = 0; h < 4; h++) this.themeHat(bt + (h * barDur) / 4);
      }
    }
  }

  private themeDrone(freq: number, t: number, dur: number) {
    const ctx = this.ctx;
    const out = this.themeGain;
    if (!ctx || !out) return;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 1.2);
    g.gain.setValueAtTime(0.5, t + dur - 0.8);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  private themeBass(freq: number, t: number, dur: number) {
    const ctx = this.ctx;
    const out = this.themeGain;
    if (!ctx || !out) return;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 320;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.28, t + 0.25);
    g.gain.setValueAtTime(0.28, t + dur - 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(f).connect(g).connect(out);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  private themePad(freq: number, t: number, dur: number) {
    const ctx = this.ctx;
    const out = this.themeGain;
    if (!ctx || !out) return;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = Math.min(1400, freq * 5);
    f.Q.value = 0.5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.9);
    g.gain.setValueAtTime(0.16, t + dur - 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    [1.003, 0.997].forEach(det => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq * det;
      osc.connect(f);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    });
    f.connect(g).connect(out);
  }

  private themeChoir(freq: number, t: number, dur: number) {
    const ctx = this.ctx;
    const out = this.themeGain;
    if (!ctx || !out) return;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 5.2;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 3.5;
    lfo.connect(lfoGain).connect(osc.frequency);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq * 2.2;
    f.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.11, t + 1.0);
    g.gain.setValueAtTime(0.11, t + dur - 0.8);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(f).connect(g).connect(out);
    osc.start(t);
    osc.stop(t + dur + 0.05);
    lfo.start(t);
    lfo.stop(t + dur + 0.05);
  }

  private themeHit(t: number) {
    const ctx = this.ctx;
    const out = this.themeGain;
    if (!ctx || !out) return;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(55, t + 0.5);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    osc.connect(f).connect(g).connect(out);
    osc.start(t);
    osc.stop(t + 0.75);
  }

  private themeKick(t: number, vol = 0.9) {
    const ctx = this.ctx;
    const out = this.themeGain;
    if (!ctx || !out) return;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(48, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + 0.3);
  }

  private themeSnare(t: number) {
    const ctx = this.ctx;
    const out = this.themeGain;
    if (!ctx || !out || !this.noiseBuffer) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1800;
    f.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    src.connect(f).connect(g).connect(out);
    src.start(t);
    src.stop(t + 0.16);
  }

  private themeHat(t: number) {
    const ctx = this.ctx;
    const out = this.themeGain;
    if (!ctx || !out || !this.noiseBuffer) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 6000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.05, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    src.connect(f).connect(g).connect(out);
    src.start(t);
    src.stop(t + 0.06);
  }
}

export const sfx = new SFXEngine();