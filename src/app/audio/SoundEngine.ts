export type SoundId =
  | 'yourTurn'
  | 'actionDeclared'
  | 'coup'
  | 'challengeWindow'
  | 'blockOpportunity'
  | 'assassinationAlert'
  | 'block'
  | 'influenceLoss'
  | 'challengeRevealSuccess'
  | 'challengeRevealFail'
  | 'coinsGained'
  | 'coinsLost'
  | 'timerWarning'
  | 'gameOverWin'
  | 'gameOverLose'
  | 'playerEliminated'
  | 'exchange'
  | 'cardShuffle'
  | 'reaction'
  | 'chatMessage';

const MUSIC_URL = '/audio/velvet-court.mp3';
const MUSIC_GAIN = 0.18;
const MUSIC_DUCK_GAIN = 0.055;
const HERO_CLIPS: Partial<Record<SoundId, { url: string; gain: number }>> = {
  gameOverWin: { url: '/audio/court-crowned.mp3', gain: 0.72 },
  gameOverLose: { url: '/audio/plot-unraveled.mp3', gain: 0.82 },
};

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicBuffer: AudioBuffer | null = null;
  private musicBufferPromise: Promise<AudioBuffer> | null = null;
  private musicSource: AudioBufferSourceNode | null = null;
  private clipBuffers = new Map<string, AudioBuffer>();
  private clipBufferPromises = new Map<string, Promise<AudioBuffer>>();
  private fadingMusicSource: AudioBufferSourceNode | null = null;
  private musicRequestVersion = 0;
  private musicStopTimer: ReturnType<typeof setTimeout> | null = null;
  private duckRestoreTimer: ReturnType<typeof setTimeout> | null = null;
  private ducked = false;
  private _muted: boolean;
  private _musicEnabled: boolean;

  constructor() {
    this._muted = typeof window !== 'undefined'
      && localStorage.getItem('coup_sound_muted') === 'true';
    this._musicEnabled = typeof window === 'undefined'
      || localStorage.getItem('coup_music_enabled') !== 'false';
  }

  get muted(): boolean {
    return this._muted;
  }

  set muted(value: boolean) {
    this.setMuted(value);
  }

  get musicEnabled(): boolean {
    return this._musicEnabled;
  }

  private getCtx(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();

      this.masterGain.gain.value = 1;
      this.sfxGain.gain.value = this._muted ? 0 : 1;
      this.musicGain.gain.value = 0;

      this.sfxGain.connect(this.masterGain);
      this.musicGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  private rampGain(gainNode: GainNode | null, target: number, durationMs: number): void {
    if (!this.ctx || !gainNode) return;
    const now = this.ctx.currentTime;
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(gainNode.gain.value, now);
    gainNode.gain.linearRampToValueAtTime(target, now + durationMs / 1000);
  }

  /** Call from a user gesture to unlock AudioContext on mobile Safari. */
  unlock(): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      void ctx.resume().then(() => {
        this.preloadHeroClips(ctx);
        if (this._musicEnabled) this.startMusic();
      }).catch(() => undefined);
    } else {
      this.preloadHeroClips(ctx);
      if (this._musicEnabled) this.startMusic();
    }
  }

  setMuted(muted: boolean): void {
    this._muted = muted;
    this.rampGain(this.sfxGain, muted ? 0 : 1, 80);
  }

  setMusicEnabled(enabled: boolean): void {
    this._musicEnabled = enabled;
    if (typeof window !== 'undefined') {
      localStorage.setItem('coup_music_enabled', String(enabled));
    }
    if (enabled) {
      this.startMusic();
    } else {
      this.stopMusic(350);
    }
  }

  private async loadMusic(ctx: AudioContext): Promise<AudioBuffer> {
    if (this.musicBuffer) return this.musicBuffer;
    if (!this.musicBufferPromise) {
      this.musicBufferPromise = fetch(MUSIC_URL)
        .then((response) => {
          if (!response.ok) throw new Error(`Music request failed: ${response.status}`);
          return response.arrayBuffer();
        })
        .then(audio => ctx.decodeAudioData(audio))
        .then((buffer) => {
          this.musicBuffer = buffer;
          return buffer;
        })
        .catch((error: unknown) => {
          this.musicBufferPromise = null;
          throw error;
        });
    }
    return this.musicBufferPromise;
  }

  private loadClip(ctx: AudioContext, url: string): Promise<AudioBuffer> {
    const buffer = this.clipBuffers.get(url);
    if (buffer) return Promise.resolve(buffer);

    const existing = this.clipBufferPromises.get(url);
    if (existing) return existing;

    const promise = fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`Audio clip request failed: ${response.status}`);
        return response.arrayBuffer();
      })
      .then(audio => ctx.decodeAudioData(audio))
      .then((decoded) => {
        this.clipBuffers.set(url, decoded);
        return decoded;
      })
      .catch((error: unknown) => {
        this.clipBufferPromises.delete(url);
        throw error;
      });
    this.clipBufferPromises.set(url, promise);
    return promise;
  }

  private preloadHeroClips(ctx: AudioContext): void {
    for (const clip of Object.values(HERO_CLIPS)) {
      if (clip) void this.loadClip(ctx, clip.url).catch(() => undefined);
    }
  }

  private playClip(
    ctx: AudioContext,
    destination: AudioNode,
    clip: { url: string; gain: number },
    fallback: SoundDefinition,
  ): void {
    void this.loadClip(ctx, clip.url).then((buffer) => {
      if (this._muted || ctx.state !== 'running') return;
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      source.buffer = buffer;
      gain.gain.value = clip.gain;
      source.connect(gain).connect(destination);
      source.start();
    }).catch(() => {
      if (!this._muted) fallback(ctx, destination);
    });
  }

  startMusic(): void {
    if (!this._musicEnabled || this.musicSource) return;
    const ctx = this.getCtx();
    if (!ctx || ctx.state !== 'running') return;

    if (this.musicStopTimer) {
      clearTimeout(this.musicStopTimer);
      this.musicStopTimer = null;
    }
    if (this.fadingMusicSource) {
      try { this.fadingMusicSource.stop(); } catch { /* already stopped */ }
      this.fadingMusicSource = null;
    }

    const requestVersion = ++this.musicRequestVersion;
    void this.loadMusic(ctx).then((buffer) => {
      if (
        requestVersion !== this.musicRequestVersion
        || !this._musicEnabled
        || this.musicSource
        || ctx.state !== 'running'
      ) return;

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(this.musicGain!);
      source.onended = () => {
        if (this.musicSource === source) this.musicSource = null;
        if (this.fadingMusicSource === source) this.fadingMusicSource = null;
      };
      this.musicSource = source;
      this.musicGain!.gain.setValueAtTime(0, ctx.currentTime);
      source.start();
      this.rampGain(this.musicGain, this.ducked ? MUSIC_DUCK_GAIN : MUSIC_GAIN, 900);
    }).catch((error: unknown) => {
      console.warn('Unable to start background music', error);
    });
  }

  stopMusic(fadeMs = 500): void {
    this.musicRequestVersion += 1;
    if (this.duckRestoreTimer) {
      clearTimeout(this.duckRestoreTimer);
      this.duckRestoreTimer = null;
    }
    this.ducked = false;

    const source = this.musicSource;
    if (!source) return;
    this.musicSource = null;
    this.fadingMusicSource = source;
    this.rampGain(this.musicGain, 0, fadeMs);
    if (this.musicStopTimer) clearTimeout(this.musicStopTimer);
    this.musicStopTimer = setTimeout(() => {
      try { source.stop(); } catch { /* already stopped */ }
      if (this.fadingMusicSource === source) this.fadingMusicSource = null;
      this.musicStopTimer = null;
    }, fadeMs + 50);
  }

  duckMusic(durationMs = 1400): void {
    if (!this._musicEnabled || !this.musicSource) return;
    this.ducked = true;
    this.rampGain(this.musicGain, MUSIC_DUCK_GAIN, 120);
    if (this.duckRestoreTimer) clearTimeout(this.duckRestoreTimer);
    this.duckRestoreTimer = setTimeout(() => {
      this.ducked = false;
      this.duckRestoreTimer = null;
      if (this._musicEnabled && this.musicSource) {
        this.rampGain(this.musicGain, MUSIC_GAIN, 500);
      }
    }, durationMs);
  }

  play(id: SoundId): void {
    if (this._muted) return;
    const ctx = this.getCtx();
    if (!ctx || !this.sfxGain || ctx.state !== 'running') return;

    if (id === 'coup') this.duckMusic(1200);
    else if (id === 'challengeWindow') this.duckMusic(900);
    else if (id === 'challengeRevealSuccess' || id === 'challengeRevealFail') this.duckMusic(2400);
    else if (id === 'gameOverWin' || id === 'gameOverLose') this.duckMusic(3000);

    const fn = sounds[id];
    if (!fn) return;
    const heroClip = HERO_CLIPS[id];
    if (heroClip) {
      this.playClip(ctx, this.sfxGain, heroClip, fn);
    } else {
      fn(ctx, this.sfxGain);
    }
  }
}

function osc(
  ctx: AudioContext,
  destination: AudioNode,
  type: OscillatorType,
  freq: number,
  gain: number,
  start: number,
  stop: number,
  freqEnd?: number,
): void {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, ctx.currentTime + start);
  if (freqEnd !== undefined) {
    o.frequency.linearRampToValueAtTime(freqEnd, ctx.currentTime + stop);
  }
  g.gain.setValueAtTime(gain, ctx.currentTime + start);
  g.gain.linearRampToValueAtTime(0, ctx.currentTime + stop);
  o.connect(g).connect(destination);
  o.start(ctx.currentTime + start);
  o.stop(ctx.currentTime + stop + 0.05);
}

function noiseBurst(
  ctx: AudioContext,
  destination: AudioNode,
  gain: number,
  start: number,
  duration: number,
  frequency = 3000,
): void {
  const sr = ctx.sampleRate;
  const len = sr * duration;
  const buf = ctx.createBuffer(1, len, sr);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = frequency;
  bp.Q.value = 0.8;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, ctx.currentTime + start);
  g.gain.linearRampToValueAtTime(0, ctx.currentTime + start + duration);
  src.connect(bp).connect(g).connect(destination);
  src.start(ctx.currentTime + start);
  src.stop(ctx.currentTime + start + duration + 0.05);
}

type SoundDefinition = (ctx: AudioContext, destination: AudioNode) => void;

const sounds: Record<SoundId, SoundDefinition> = {
  yourTurn(ctx, out) {
    osc(ctx, out, 'sine', 523, 0.15, 0, 0.12);
    osc(ctx, out, 'sine', 698, 0.15, 0.13, 0.25);
  },

  actionDeclared(ctx, out) {
    osc(ctx, out, 'triangle', 900, 0.1, 0, 0.08);
  },

  // Layered low impact with a brief card-snap transient.
  coup(ctx, out) {
    noiseBurst(ctx, out, 0.16, 0, 0.09, 1100);
    osc(ctx, out, 'sine', 130, 0.26, 0, 0.42, 48);
    osc(ctx, out, 'triangle', 72, 0.18, 0.03, 0.62, 38);
    osc(ctx, out, 'sine', 680, 0.07, 0.02, 0.16, 310);
  },

  // A crisp challenge marker: card snap, rising accusation, low answer.
  challengeWindow(ctx, out) {
    noiseBurst(ctx, out, 0.08, 0, 0.045, 2200);
    osc(ctx, out, 'triangle', 330, 0.11, 0, 0.18, 660);
    osc(ctx, out, 'sine', 165, 0.09, 0.08, 0.3, 110);
  },

  blockOpportunity(ctx, out) {
    osc(ctx, out, 'square', 600, 0.08, 0, 0.1);
    osc(ctx, out, 'square', 800, 0.08, 0.12, 0.22);
  },

  assassinationAlert(ctx, out) {
    osc(ctx, out, 'sawtooth', 880, 0.15, 0, 0.1);
    osc(ctx, out, 'sawtooth', 660, 0.15, 0.12, 0.22);
    osc(ctx, out, 'sawtooth', 440, 0.15, 0.24, 0.4);
  },

  block(ctx, out) {
    osc(ctx, out, 'triangle', 1200, 0.12, 0, 0.05);
    osc(ctx, out, 'triangle', 2400, 0.08, 0, 0.15);
  },

  influenceLoss(ctx, out) {
    osc(ctx, out, 'sine', 300, 0.15, 0, 0.35, 150);
  },

  challengeRevealSuccess(ctx, out) {
    noiseBurst(ctx, out, 0.065, 0, 0.04, 2600);
    osc(ctx, out, 'sine', 392, 0.11, 0, 0.18);
    osc(ctx, out, 'triangle', 523, 0.11, 0.11, 0.31);
    osc(ctx, out, 'sine', 784, 0.13, 0.23, 0.55);
    osc(ctx, out, 'sine', 1568, 0.045, 0.25, 0.65);
  },

  challengeRevealFail(ctx, out) {
    noiseBurst(ctx, out, 0.08, 0, 0.06, 900);
    osc(ctx, out, 'sawtooth', 360, 0.1, 0, 0.24, 210);
    osc(ctx, out, 'triangle', 180, 0.12, 0.13, 0.48, 82);
    osc(ctx, out, 'sine', 92, 0.12, 0.28, 0.72, 52);
  },

  coinsGained(ctx, out) {
    osc(ctx, out, 'sine', 1200, 0.1, 0, 0.15);
  },

  coinsLost(ctx, out) {
    osc(ctx, out, 'triangle', 600, 0.1, 0, 0.15);
  },

  timerWarning(ctx, out) {
    osc(ctx, out, 'square', 880, 0.12, 0, 0.06);
  },

  gameOverWin(ctx, out) {
    osc(ctx, out, 'sine', 523, 0.15, 0, 0.2);
    osc(ctx, out, 'sine', 659, 0.15, 0.15, 0.35);
    osc(ctx, out, 'sine', 784, 0.15, 0.3, 0.5);
    osc(ctx, out, 'sine', 1047, 0.18, 0.45, 0.75);
  },

  gameOverLose(ctx, out) {
    osc(ctx, out, 'sine', 440, 0.12, 0, 0.25);
    osc(ctx, out, 'sine', 370, 0.12, 0.2, 0.45);
    osc(ctx, out, 'sine', 311, 0.12, 0.4, 0.7);
  },

  playerEliminated(ctx, out) {
    osc(ctx, out, 'sine', 200, 0.2, 0, 0.4, 80);
  },

  exchange(ctx, out) {
    osc(ctx, out, 'sine', 500, 0.08, 0, 0.25);
    osc(ctx, out, 'sine', 507, 0.08, 0, 0.25);
    osc(ctx, out, 'sine', 493, 0.08, 0, 0.25);
  },

  cardShuffle(ctx, out) {
    noiseBurst(ctx, out, 0.12, 0, 0.15);
  },

  reaction(ctx, out) {
    osc(ctx, out, 'sine', 800, 0.1, 0, 0.08, 1200);
  },

  chatMessage(ctx, out) {
    osc(ctx, out, 'sine', 660, 0.08, 0, 0.12);
  },
};

let instance: SoundEngine | null = null;

export function getSoundEngine(): SoundEngine {
  if (!instance) instance = new SoundEngine();
  return instance;
}
