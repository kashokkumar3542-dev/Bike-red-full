import { AudioSettings, EngineAudioProfile, RoadZone } from './types';

interface EngineProfileTuning {
  idleFreq: number;
  rpmSpan: number;
  gearStep: number;
  subRatio: number;
  harmRatio: number;
  harmGain: number;
  subGain: number;
  mainType: OscillatorType;
  harmType: OscillatorType;
  filterBase: number;
  filterSpan: number;
  filterQ: number;
  hasSupercharger: boolean;
}

const ENGINE_PROFILES: Record<EngineAudioProfile, EngineProfileTuning> = {
  single_sport: {
    idleFreq: 38,
    rpmSpan: 118,
    gearStep: 9,
    subRatio: 0.5,
    harmRatio: 2.0,
    harmGain: 0.24,
    subGain: 0.78,
    mainType: 'sawtooth',
    harmType: 'square',
    filterBase: 320,
    filterSpan: 1650,
    filterQ: 2.8,
    hasSupercharger: false,
  },
  single_street: {
    idleFreq: 35,
    rpmSpan: 108,
    gearStep: 8.5,
    subRatio: 0.5,
    harmRatio: 1.5,
    harmGain: 0.22,
    subGain: 0.85,
    mainType: 'sawtooth',
    harmType: 'triangle',
    filterBase: 280,
    filterSpan: 1450,
    filterQ: 3.1,
    hasSupercharger: false,
  },
  single_thumper: {
    idleFreq: 26,
    rpmSpan: 82,
    gearStep: 7,
    subRatio: 0.5,
    harmRatio: 1.5,
    harmGain: 0.18,
    subGain: 1.05,
    mainType: 'sawtooth',
    harmType: 'triangle',
    filterBase: 205,
    filterSpan: 980,
    filterQ: 3.8,
    hasSupercharger: false,
  },
  inline4_torque: {
    idleFreq: 46,
    rpmSpan: 170,
    gearStep: 12,
    subRatio: 0.5,
    harmRatio: 2.01,
    harmGain: 0.28,
    subGain: 0.72,
    mainType: 'sawtooth',
    harmType: 'sawtooth',
    filterBase: 390,
    filterSpan: 2150,
    filterQ: 2.6,
    hasSupercharger: false,
  },
  inline4_screamer: {
    idleFreq: 54,
    rpmSpan: 218,
    gearStep: 15,
    subRatio: 0.5,
    harmRatio: 2.03,
    harmGain: 0.34,
    subGain: 0.54,
    mainType: 'sawtooth',
    harmType: 'square',
    filterBase: 460,
    filterSpan: 2850,
    filterQ: 2.4,
    hasSupercharger: false,
  },
  v4_bark: {
    idleFreq: 42,
    rpmSpan: 185,
    gearStep: 13.5,
    subRatio: 0.5,
    harmRatio: 1.498, // Asymmetric V4 firing-order fifth harmonic growl
    harmGain: 0.42,
    subGain: 0.82,
    mainType: 'sawtooth',
    harmType: 'sawtooth',
    filterBase: 360,
    filterSpan: 2450,
    filterQ: 3.6,
    hasSupercharger: false,
  },
  supercharged_h2r: {
    idleFreq: 52,
    rpmSpan: 224,
    gearStep: 16,
    subRatio: 0.5,
    harmRatio: 2.02,
    harmGain: 0.32,
    subGain: 0.64,
    mainType: 'sawtooth',
    harmType: 'square',
    filterBase: 470,
    filterSpan: 2950,
    filterQ: 2.9,
    hasSupercharger: true,
  },
};

/**
 * 100% Procedural Web Audio Engine for BIKE RED PULL
 * - 7 Real-World Motorcycle Engine Profiles (Single, Thumper, Inline-4 Screamer, 65°/90° V4 Bark, Supercharged H2R Whine)
 * - Realistic metallic/concrete divider collision crunch + thud
 * - Funny Old Man formant-synthesized "HA HA!" voice laughs
 * - Optional highway background music with granular Settings toggles
 */
export class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;

  private engineMainOsc: OscillatorNode | null = null;
  private engineSubOsc: OscillatorNode | null = null;
  private engineHarmOsc: OscillatorNode | null = null;
  private subGainNode: GainNode | null = null;
  private harmGainNode: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;

  // Kawasaki Ninja H2R centrifugal supercharger impeller whine nodes
  private scOsc: OscillatorNode | null = null;
  private scFilter: BiquadFilterNode | null = null;
  private scGain: GainNode | null = null;

  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private settings: AudioSettings;
  private engineProfile: EngineAudioProfile = 'single_sport';
  private initialized = false;
  private engineRunning = false;
  private musicTimer: number | null = null;
  private musicStep = 0;
  private lastGear = 1;
  private lastZone: RoadZone = 'normal';
  private wasAccelerating = false;

  constructor(initialSettings: AudioSettings) {
    this.settings = { ...initialSettings };
  }

  public init(): void {
    if (this.initialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.settings.soundEnabled ? 0.88 : 0;
    this.masterGain.connect(this.ctx.destination);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.92;
    this.sfxGain.connect(this.masterGain);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.settings.musicEnabled ? 0.24 : 0;
    this.musicGain.connect(this.masterGain);

    // 2 seconds of white noise for wind, exhaust bark, collision crunch, and old man breath
    const sampleRate = this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, sampleRate * 2, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;

    this.setupEngineNodes();
    this.applyProfileToNodes();
    this.startMusicLoop();
    this.initialized = true;
  }

  private setupEngineNodes(): void {
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer) return;

    const shaper = this.ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i * 2) / 256 - 1;
      curve[i] = ((3 + 15) * x * 20 * (Math.PI / 180)) / (Math.PI + 15 * Math.abs(x));
    }
    shaper.curve = curve;

    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 240;
    this.engineFilter.Q.value = 3.0;

    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;

    this.engineMainOsc = this.ctx.createOscillator();
    this.engineMainOsc.type = 'sawtooth';
    this.engineMainOsc.frequency.value = 48;

    this.engineSubOsc = this.ctx.createOscillator();
    this.engineSubOsc.type = 'triangle';
    this.engineSubOsc.frequency.value = 24;

    this.engineHarmOsc = this.ctx.createOscillator();
    this.engineHarmOsc.type = 'square';
    this.engineHarmOsc.frequency.value = 96;

    this.harmGainNode = this.ctx.createGain();
    this.harmGainNode.gain.value = 0.24;

    this.subGainNode = this.ctx.createGain();
    this.subGainNode.gain.value = 0.74;

    this.engineMainOsc.connect(shaper);
    this.engineSubOsc.connect(this.subGainNode);
    this.subGainNode.connect(shaper);
    this.engineHarmOsc.connect(this.harmGainNode);
    this.harmGainNode.connect(shaper);

    shaper.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.sfxGain);

    this.engineMainOsc.start();
    this.engineSubOsc.start();
    this.engineHarmOsc.start();

    // Supercharger centrifugal whine chain (only audible on Ninja H2R!)
    this.scOsc = this.ctx.createOscillator();
    this.scOsc.type = 'sine';
    this.scOsc.frequency.value = 1400;

    this.scFilter = this.ctx.createBiquadFilter();
    this.scFilter.type = 'bandpass';
    this.scFilter.frequency.value = 2400;
    this.scFilter.Q.value = 4.2;

    this.scGain = this.ctx.createGain();
    this.scGain.gain.value = 0;

    this.scOsc.connect(this.scFilter);
    this.scFilter.connect(this.scGain);
    this.scGain.connect(this.sfxGain);
    this.scOsc.start();

    // High-speed aerodynamic wind rush
    const windSrc = this.ctx.createBufferSource();
    windSrc.buffer = this.noiseBuffer;
    windSrc.loop = true;

    this.windFilter = this.ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 380;
    this.windFilter.Q.value = 0.75;

    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0;

    windSrc.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.sfxGain);
    windSrc.start();
  }

  public setEngineProfile(profile: EngineAudioProfile): void {
    this.engineProfile = profile;
    this.applyProfileToNodes();
  }

  private applyProfileToNodes(): void {
    if (!this.ctx) return;
    const cfg = ENGINE_PROFILES[this.engineProfile];
    const now = this.ctx.currentTime;
    if (this.engineMainOsc) this.engineMainOsc.type = cfg.mainType;
    if (this.engineHarmOsc) this.engineHarmOsc.type = cfg.harmType;
    if (this.harmGainNode) this.harmGainNode.gain.setTargetAtTime(cfg.harmGain, now, 0.04);
    if (this.subGainNode) this.subGainNode.gain.setTargetAtTime(cfg.subGain, now, 0.04);
    if (this.engineFilter) this.engineFilter.Q.setTargetAtTime(cfg.filterQ, now, 0.04);
    if (this.scGain && !cfg.hasSupercharger) {
      this.scGain.gain.setTargetAtTime(0, now, 0.04);
    }
  }

  public applySettings(next: AudioSettings): void {
    this.settings = { ...next };
    if (!this.ctx || !this.masterGain || !this.musicGain) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setTargetAtTime(next.soundEnabled ? 0.88 : 0, now, 0.04);
    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.setTargetAtTime(next.musicEnabled ? 0.24 : 0, now, 0.05);
  }

  public setEngineActive(active: boolean): void {
    this.engineRunning = active;
    if (!this.ctx || !this.engineGain || !this.windGain || !this.scGain) return;
    if (!active) {
      const now = this.ctx.currentTime;
      this.engineGain.gain.setTargetAtTime(0, now, 0.08);
      this.windGain.gain.setTargetAtTime(0, now, 0.08);
      this.scGain.gain.setTargetAtTime(0, now, 0.06);
    }
  }

  public updateEngine(
    speedKmh: number,
    rpmRatio: number,
    gear: number,
    isAccelerating: boolean,
    roadZone: RoadZone
  ): void {
    if (!this.initialized || !this.ctx || !this.engineRunning) return;
    if (this.ctx.state === 'suspended') return;

    const cfg = ENGINE_PROFILES[this.engineProfile];
    const now = this.ctx.currentTime;
    const clampedRpm = Math.max(0.08, Math.min(1, rpmRatio));
    const baseFreq =
      speedKmh < 1
        ? cfg.idleFreq
        : cfg.idleFreq + 4 + clampedRpm * cfg.rpmSpan + gear * cfg.gearStep;

    this.engineMainOsc?.frequency.setTargetAtTime(baseFreq, now, 0.032);
    this.engineSubOsc?.frequency.setTargetAtTime(baseFreq * cfg.subRatio, now, 0.032);
    this.engineHarmOsc?.frequency.setTargetAtTime(baseFreq * cfg.harmRatio, now, 0.032);

    const filterCutoff = isAccelerating
      ? cfg.filterBase +
        clampedRpm * cfg.filterSpan +
        (roadZone === 'black' ? 550 : roadZone === 'red' ? 280 : 0)
      : speedKmh < 2
        ? Math.max(135, cfg.filterBase * 0.58)
        : cfg.filterBase * 0.72 + clampedRpm * 520;
    this.engineFilter?.frequency.setTargetAtTime(filterCutoff, now, 0.05);

    const targetVol = isAccelerating
      ? 0.14 + clampedRpm * 0.165
      : speedKmh < 2
        ? 0.055
        : 0.065 + clampedRpm * 0.065;
    this.engineGain?.gain.setTargetAtTime(targetVol, now, 0.05);

    // Kawasaki Ninja H2R supercharger whine + off-throttle impeller chirp!
    if (cfg.hasSupercharger && this.scOsc && this.scFilter && this.scGain) {
      const scFreq = 1180 + clampedRpm * 3400 + gear * 180;
      this.scOsc.frequency.setTargetAtTime(scFreq, now, 0.04);
      this.scFilter.frequency.setTargetAtTime(scFreq * 1.05, now, 0.04);
      const scLevel = isAccelerating && speedKmh > 18 ? 0.018 + clampedRpm * 0.058 : 0.002;
      this.scGain.gain.setTargetAtTime(scLevel, now, 0.05);

      if (this.wasAccelerating && !isAccelerating && speedKmh > 110) {
        this.playSuperchargerFlutter();
      }
    } else if (this.scGain) {
      this.scGain.gain.setTargetAtTime(0, now, 0.05);
    }

    const windLevel = Math.max(0, (speedKmh - 45) / 250);
    this.windGain?.gain.setTargetAtTime(Math.min(0.24, windLevel * 0.22), now, 0.08);
    this.windFilter?.frequency.setTargetAtTime(300 + speedKmh * 4.8, now, 0.08);

    if (gear > this.lastGear && isAccelerating && speedKmh > 28) {
      this.playExhaustPop(cfg.hasSupercharger);
    }
    this.lastGear = gear;
    this.wasAccelerating = isAccelerating;

    if (roadZone !== this.lastZone) {
      if (roadZone === 'red' && this.lastZone === 'normal') {
        this.playZoneSurge('red');
      } else if (roadZone === 'black') {
        this.playZoneSurge('black');
      }
      this.lastZone = roadZone;
    }
  }

  private playSuperchargerFlutter(): void {
    if (!this.ctx || !this.sfxGain || !this.settings.soundEnabled) return;
    const now = this.ctx.currentTime;
    // Signature Kawasaki H2R off-throttle chirp-chirp impeller flutter
    [0, 0.068, 0.135].forEach((offset, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const t = now + offset;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      const startF = 3400 - idx * 420;
      osc.frequency.setValueAtTime(startF, t);
      osc.frequency.exponentialRampToValueAtTime(startF * 0.55, t + 0.055);
      gain.gain.setValueAtTime(0.065 - idx * 0.015, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.065);
    });
  }

  private playExhaustPop(withChirp = false): void {
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer || !this.settings.soundEnabled) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(240, now);
    filter.Q.value = 1.6;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    src.start(now);
    src.stop(now + 0.09);

    if (withChirp) {
      this.playSuperchargerFlutter();
    }
  }

  /**
   * Realistic concrete divider / barrier impact sound (deep impact thud + metallic scrape burst)
   */
  public playCollision(): void {
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer || !this.settings.soundEnabled) return;
    const now = this.ctx.currentTime;

    const thudOsc = this.ctx.createOscillator();
    const thudGain = this.ctx.createGain();
    thudOsc.type = 'triangle';
    thudOsc.frequency.setValueAtTime(145, now);
    thudOsc.frequency.exponentialRampToValueAtTime(34, now + 0.22);
    thudGain.gain.setValueAtTime(0.58, now);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
    thudOsc.connect(thudGain);
    thudGain.connect(this.sfxGain);
    thudOsc.start(now);
    thudOsc.stop(now + 0.28);

    const scrape = this.ctx.createBufferSource();
    scrape.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(920, now);
    bp.frequency.exponentialRampToValueAtTime(320, now + 0.3);
    bp.Q.value = 1.2;

    const scrapeGain = this.ctx.createGain();
    scrapeGain.gain.setValueAtTime(0.45, now);
    scrapeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

    scrape.connect(bp);
    bp.connect(scrapeGain);
    scrapeGain.connect(this.sfxGain);
    scrape.start(now);
    scrape.stop(now + 0.34);

    const clang = this.ctx.createOscillator();
    const clangGain = this.ctx.createGain();
    clang.type = 'square';
    clang.frequency.setValueAtTime(520, now);
    clang.frequency.exponentialRampToValueAtTime(190, now + 0.14);
    clangGain.gain.setValueAtTime(0.18, now);
    clangGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    clang.connect(clangGain);
    clangGain.connect(this.sfxGain);
    clang.start(now);
    clang.stop(now + 0.17);
  }

  private playZoneSurge(zone: 'red' | 'black'): void {
    if (!this.ctx || !this.sfxGain || !this.settings.soundEnabled) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = zone === 'black' ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(zone === 'black' ? 140 : 180, now);
    osc.frequency.exponentialRampToValueAtTime(zone === 'black' ? 520 : 420, now + 0.34);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.44);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.46);
  }

  /**
   * Funny Old Man "HA HA!" formant-synthesized vocal chuckle
   */
  public playOldManLaugh(intensity: 'mild' | 'excited' | 'turbo'): void {
    if (
      !this.ctx ||
      !this.sfxGain ||
      !this.noiseBuffer ||
      !this.settings.soundEnabled ||
      !this.settings.oldManVoiceEnabled
    ) {
      return;
    }
    if (this.ctx.state === 'suspended') return;

    const now = this.ctx.currentTime;
    const syllables = intensity === 'turbo' ? 3 : 2;
    const spacing = intensity === 'turbo' ? 0.145 : intensity === 'excited' ? 0.17 : 0.2;
    const basePitch = intensity === 'turbo' ? 250 : intensity === 'excited' ? 215 : 185;

    for (let i = 0; i < syllables; i++) {
      const t = now + i * spacing;
      const pitchOffset = i === 0 ? 1.0 : i === 1 ? 0.88 : 1.08;
      const f0 = basePitch * pitchOffset + (Math.random() * 14 - 7);

      const breathSrc = this.ctx.createBufferSource();
      breathSrc.buffer = this.noiseBuffer;
      const breathFilter = this.ctx.createBiquadFilter();
      breathFilter.type = 'bandpass';
      breathFilter.frequency.value = 1450;
      breathFilter.Q.value = 1.8;
      const breathGain = this.ctx.createGain();
      breathGain.gain.setValueAtTime(0.001, t);
      breathGain.gain.linearRampToValueAtTime(0.18, t + 0.015);
      breathGain.gain.exponentialRampToValueAtTime(0.001, t + 0.065);
      breathSrc.connect(breathFilter);
      breathFilter.connect(breathGain);
      breathGain.connect(this.sfxGain);
      breathSrc.start(t);
      breathSrc.stop(t + 0.075);

      const voiceOsc = this.ctx.createOscillator();
      voiceOsc.type = 'sawtooth';
      voiceOsc.frequency.setValueAtTime(f0 * 1.15, t + 0.015);
      voiceOsc.frequency.exponentialRampToValueAtTime(f0 * 0.82, t + 0.135);

      const vib = this.ctx.createOscillator();
      vib.frequency.value = 22;
      const vibDepth = this.ctx.createGain();
      vibDepth.gain.value = 9;
      vib.connect(vibDepth);
      vibDepth.connect(voiceOsc.frequency);

      const voiceEnv = this.ctx.createGain();
      voiceEnv.gain.setValueAtTime(0.001, t + 0.012);
      voiceEnv.gain.linearRampToValueAtTime(0.35, t + 0.032);
      voiceEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

      voiceOsc.connect(voiceEnv);

      const formants = [
        { freq: 760, q: 5.5, gain: 1.0 },
        { freq: 1280, q: 7.0, gain: 0.75 },
        { freq: 2550, q: 8.5, gain: 0.35 },
      ];

      for (const fm of formants) {
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(fm.freq, t);
        bp.Q.value = fm.q;

        const fg = this.ctx.createGain();
        fg.gain.value = fm.gain;

        voiceEnv.connect(bp);
        bp.connect(fg);
        fg.connect(this.sfxGain);
      }

      voiceOsc.start(t + 0.01);
      vib.start(t + 0.01);
      voiceOsc.stop(t + 0.155);
      vib.stop(t + 0.155);
    }
  }

  public playPassWhoosh(): void {
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer || !this.settings.soundEnabled) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(920, now);
    filter.frequency.exponentialRampToValueAtTime(220, now + 0.22);
    filter.Q.value = 1.5;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    src.start(now);
    src.stop(now + 0.25);
  }

  public playCheckpoint(): void {
    if (!this.ctx || !this.sfxGain || !this.settings.soundEnabled) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const t = now + idx * 0.065;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.17, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }

  public playUnlock(): void {
    if (!this.ctx || !this.sfxGain || !this.settings.soundEnabled) return;
    const now = this.ctx.currentTime;
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const t = now + idx * 0.07;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.27);
    });
  }

  public playUiSelect(): void {
    if (!this.ctx || !this.sfxGain || !this.settings.soundEnabled) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.06);
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  public playGameOver(): void {
    if (!this.ctx || !this.sfxGain || !this.settings.soundEnabled) return;
    const now = this.ctx.currentTime;
    const notes = [392.0, 349.23, 311.13, 261.63];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const t = now + idx * 0.12;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.35);
    });
  }

  private startMusicLoop(): void {
    if (this.musicTimer !== null) return;
    const bassPattern = [
      82.41, 82.41, 164.81, 82.41, 98.0, 82.41, 110.0, 82.41,
      73.42, 73.42, 146.83, 73.42, 98.0, 98.0, 110.0, 123.47,
    ];
    const leadPattern = [
      329.63, 0, 392.0, 0, 440.0, 0, 392.0, 329.63,
      293.66, 0, 329.63, 0, 392.0, 0, 493.88, 0,
    ];

    this.musicTimer = window.setInterval(() => {
      if (
        !this.ctx ||
        !this.musicGain ||
        !this.settings.soundEnabled ||
        !this.settings.musicEnabled
      ) {
        return;
      }
      if (this.ctx.state !== 'running') return;

      const now = this.ctx.currentTime;
      const step = this.musicStep % 16;
      this.musicStep++;

      const bassFreq = bassPattern[step];
      const bassOsc = this.ctx.createOscillator();
      const bassFilter = this.ctx.createBiquadFilter();
      const bassEnv = this.ctx.createGain();
      bassOsc.type = 'sawtooth';
      bassOsc.frequency.setValueAtTime(bassFreq, now);
      bassFilter.type = 'lowpass';
      bassFilter.frequency.setValueAtTime(420, now);
      bassEnv.gain.setValueAtTime(0.2, now);
      bassEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.105);
      bassOsc.connect(bassFilter);
      bassFilter.connect(bassEnv);
      bassEnv.connect(this.musicGain);
      bassOsc.start(now);
      bassOsc.stop(now + 0.11);

      if (step % 4 === 0) {
        const kick = this.ctx.createOscillator();
        const kickEnv = this.ctx.createGain();
        kick.type = 'sine';
        kick.frequency.setValueAtTime(126, now);
        kick.frequency.exponentialRampToValueAtTime(38, now + 0.09);
        kickEnv.gain.setValueAtTime(0.32, now);
        kickEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
        kick.connect(kickEnv);
        kickEnv.connect(this.musicGain);
        kick.start(now);
        kick.stop(now + 0.12);
      }

      if (step % 2 === 1 && this.noiseBuffer) {
        const hat = this.ctx.createBufferSource();
        hat.buffer = this.noiseBuffer;
        const hp = this.ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 6500;
        const hatEnv = this.ctx.createGain();
        hatEnv.gain.setValueAtTime(0.05, now);
        hatEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
        hat.connect(hp);
        hp.connect(hatEnv);
        hatEnv.connect(this.musicGain);
        hat.start(now);
        hat.stop(now + 0.04);
      }

      const leadFreq = leadPattern[step];
      if (leadFreq > 0) {
        const lead = this.ctx.createOscillator();
        const leadEnv = this.ctx.createGain();
        lead.type = 'triangle';
        lead.frequency.setValueAtTime(leadFreq, now);
        leadEnv.gain.setValueAtTime(0.095, now);
        leadEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        lead.connect(leadEnv);
        leadEnv.connect(this.musicGain);
        lead.start(now);
        lead.stop(now + 0.2);
      }
    }, 115);
  }

  public dispose(): void {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    try {
      this.engineMainOsc?.stop();
      this.engineSubOsc?.stop();
      this.engineHarmOsc?.stop();
      this.scOsc?.stop();
      void this.ctx?.close();
    } catch {
      // ignore
    }
    this.ctx = null;
    this.initialized = false;
  }
}
