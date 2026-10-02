/**
 * Browser entry point for the offline audio render.
 *
 * `OfflineAudioContext` does not exist in Node, and node-web-audio-api is a
 * DIFFERENT DSP implementation from the one shipping to players — a compressor
 * and a WaveShaper measured there are somebody else's compressor and somebody
 * else's WaveShaper, and the ceiling this mix is gated against (−0.645 dBFS)
 * is a Chrome number. So the render happens in a real Chrome, through
 * `renderSoundOffline()`, which is exported from `SoundEngine.ts` and shares
 * `buildGraph()`, `startVoice()` and `voiceGain()` with the live `play()` path.
 * There is one graph implementation; this file only drives it and does the
 * arithmetic.
 *
 * Bundled and served by `scripts/render-audio-mix.ts` (or by hand — see
 * `docs/AUDIO-MIX.md`).
 */
import {
  getSoundEngine,
  heroClips,
  renderMusicOffline,
  renderSoundOffline,
  softClipCeiling,
  soundIds,
  MIX_TIER_OF,
  MUSIC_BEDS,
  MIX_TRIM_DB,
  type RenderOptions,
  type SoundId,
} from '../../../src/app/audio/SoundEngine';
import { measure, spectrumOf, toDbfs, type CueMeasurement, type Spectrum } from './analysis';

/** Hero stingers are ~7s; every synth voice's longest tail is 1.85s. */
const STINGER_SECONDS = 9;
const SYNTH_SECONDS = 4;

export interface Row extends CueMeasurement {
  id: SoundId;
  trimDb: number;
  tier: number;
  /** Hero cues appear more than once: the synth fallback, then each clip variant. */
  source: 'synth' | 'clip';
  /** HERO_CLIPS variant index for a clip row; absent on synth rows. */
  variant?: number;
  /** The variant's pre-trim HERO_CLIPS gain at render time. */
  heroGain?: number;
  /**
   * dB of gain reduction the compressor + soft clip apply to this cue at its
   * shipped trim. 0.00 means the master chain is linear here; a large number
   * means the cue is riding the limiter and its level is being set by the
   * limiter rather than by MIX_DB. See `RenderOptions.trimOffsetDb`.
   */
  limiterDb: number;
  /**
   * The same probe on the 300ms loudness figure. Peak reduction and sustained
   * reduction are different numbers — a 4ms attack lets transients through
   * while the body of the cue is squashed — and the sustained one is the one
   * that moves a cue's place in the tier ordering.
   */
  limiterStDb: number;
}

/** Level offset for the linearity probe. Far enough below the knee to be linear. */
const PROBE_DB = -20;

export interface PairRow extends CueMeasurement {
  label: string;
  /** True when every hero cue in the beat was rendered as its clip (variant 0). */
  clips: boolean;
  limiterDb: number;
  limiterStDb: number;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/**
 * Timbre, not level. A cue can be correctly levelled and still be the wrong
 * SOUND — `timerWarning` stood in for a refusal for exactly that reason, at the
 * right weight and the wrong shape. `CONTRAST_IDS` is the set where "these two
 * must never be confused" is a design requirement, and this is the evidence —
 * for the synth bank AND for the shipped clips.
 */
export interface ContrastRow extends Spectrum {
  id: SoundId;
  source: 'synth' | 'clip';
  /** Length of the cue's own active window, ms. Duration is half the contrast. */
  activeMs: number;
}

const CONTRAST_IDS: readonly SoundId[] = [
  'denied', 'timerWarning', 'influenceLoss', 'challengeRevealFail',
];

/** A music bed through the chain at MUSIC_GAIN, on the cues' 300ms-RMS axis. */
export interface BedRow {
  track: string;
  medianDb: number;
  p90Db: number;
  maxDb: number;
  peakDb: number;
  /** Octave levels (63…8k Hz), absolute dBFS on the 300ms axis. */
  bandsDb: number[];
}

/** A cue's loudest octave against each bed's level in that octave. */
export interface MaskRow {
  id: SoundId;
  octaveHz: number;
  cueBandDb: number;
  /** cue − bed in that octave, dB, per bed. */
  margins: Record<string, number>;
}

export interface HarnessReport {
  generated: string;
  userAgent: string;
  sampleRate: number;
  ceilingDb: number;
  rows: Row[];
  pairs: PairRow[];
  contrast: ContrastRow[];
  beds: BedRow[];
  masking: MaskRow[];
}

/** Solved pre-trim gain per clip variant, and how close it landed. */
export interface SolveRow {
  id: SoundId;
  variant: number;
  url: string;
  gain: number;
  synthStRmsDb: number;
  clipStRmsDb: number;
  deltaDb: number;
}

interface HarnessApi {
  ids(): readonly SoundId[];
  run(): Promise<HarnessReport>;
  /** Re-solve every hero clip's gain against its synth fallback. */
  solve(onlyNew?: boolean): Promise<SolveRow[]>;
  /** Each decoded clip, measured raw (no graph). */
  inspectClips(): Promise<Record<string, unknown>[]>;
  /** Drive the live engine end to end; returns errors and a music trace. */
  liveSmoke(): Promise<Record<string, unknown>>;
  /** Ad-hoc single render, for probing one cue from the devtools console. */
  probe(id: SoundId, opts?: RenderOptions): Promise<CueMeasurement>;
}

declare global {
  interface Window { __COUP_AUDIO?: HarnessApi }
}

const SAMPLE_RATE = 48000;

/**
 * Beats a real Coup game produces, for the do-two-cues-sum-into-the-limiter
 * check. Each is a cue plus a second cue at a real offset.
 */
const PAIRS: readonly { label: string; a: SoundId; b: SoundId; gapMs: number }[] = [
  { label: 'challengeRevealFail + cardShuffle @400ms', a: 'challengeRevealFail', b: 'cardShuffle', gapMs: 400 },
  { label: 'challengeRevealFail + influenceLoss @120ms', a: 'challengeRevealFail', b: 'influenceLoss', gapMs: 120 },
  { label: 'influenceLoss + playerEliminated @150ms', a: 'influenceLoss', b: 'playerEliminated', gapMs: 150 },
  { label: 'coup + influenceLoss @250ms', a: 'coup', b: 'influenceLoss', gapMs: 250 },
  { label: 'exchange + cardShuffle @0ms', a: 'exchange', b: 'cardShuffle', gapMs: 0 },
  { label: 'cardShuffle x2 @90ms', a: 'cardShuffle', b: 'cardShuffle', gapMs: 90 },
  { label: 'coinsGained + actionDeclared @60ms', a: 'coinsGained', b: 'actionDeclared', gapMs: 60 },
  // A player tapping a refused control twice. 90ms is the tightest a real
  // double-tap can be: RATE_DEFAULT drops a repeat inside 80ms, and 90ms is
  // still inside FLAM_WINDOW (190ms), so the live second tap arrives at
  // FLAM_DB[1] = −2.5dB. This render gives both taps FULL gain, so it is a
  // bound on the real beat rather than a picture of it.
  { label: 'denied x2 @90ms', a: 'denied', b: 'denied', gapMs: 90 },
  // The opening deal lands while the first player's turn chime sounds.
  { label: 'cardDeal + yourTurn @300ms', a: 'cardDeal', b: 'yourTurn', gapMs: 300 },
];

const decoded = new Map<string, AudioBuffer>();

/** Decode every hero clip variant once, in a throwaway context. */
async function loadHeroBuffers(): Promise<void> {
  const ctx = new OfflineAudioContext(2, 128, SAMPLE_RATE);
  for (const clips of Object.values(heroClips())) {
    for (const clip of clips ?? []) {
      if (decoded.has(clip.url)) continue;
      const response = await fetch(clip.url);
      if (!response.ok) throw new Error(`${clip.url}: ${response.status}`);
      decoded.set(clip.url, await ctx.decodeAudioData(await response.arrayBuffer()));
    }
  }
}

/** The decoded buffer for `id`'s variant, or null when it has no clip. */
function heroBuffer(id: SoundId, variant = 0): AudioBuffer | null {
  const clip = heroClips()[id]?.[variant];
  return clip ? decoded.get(clip.url) ?? null : null;
}

/** Long enough for the synth tail and for the longest clip variant, plus room. */
function secondsFor(id: SoundId): number {
  let s = SYNTH_SECONDS;
  for (const clip of heroClips()[id] ?? []) {
    const b = decoded.get(clip.url);
    if (b) s = Math.max(s, b.duration + 2);
  }
  return Math.min(s, STINGER_SECONDS);
}

function channelsOf(buffer: AudioBuffer): Float32Array[] {
  const out: Float32Array[] = [];
  for (let c = 0; c < buffer.numberOfChannels; c++) out.push(buffer.getChannelData(c));
  return out;
}

async function measureRender(id: SoundId, opts: RenderOptions): Promise<CueMeasurement> {
  const rendered = await renderSoundOffline(id, opts);
  return measure(channelsOf(rendered), rendered.sampleRate);
}

async function run(): Promise<HarnessReport> {
  await loadHeroBuffers();
  const rows: Row[] = [];

  /** One cue, at its shipped trim, plus how hard it is hitting the limiter. */
  async function row(
    id: SoundId,
    source: 'synth' | 'clip',
    variant: number | undefined,
    seconds: number,
  ): Promise<Row> {
    const opts: RenderOptions = {
      seconds,
      sampleRate: SAMPLE_RATE,
      heroBuffer: source === 'clip' ? heroBuffer(id, variant) : null,
      heroVariant: variant,
    };
    const m = await measureRender(id, opts);
    const linear = await measureRender(id, { ...opts, trimOffsetDb: PROBE_DB });
    return {
      id,
      trimDb: MIX_TRIM_DB[id],
      tier: MIX_TIER_OF[id],
      source,
      ...(variant === undefined ? {} : { variant, heroGain: heroClips()[id]?.[variant]?.gain }),
      limiterDb: round2(linear.peakDb - PROBE_DB - m.peakDb),
      limiterStDb: round2(linear.stRmsDb - PROBE_DB - m.stRmsDb),
      ...m,
    };
  }

  for (const id of soundIds()) {
    const seconds = secondsFor(id);
    rows.push(await row(id, 'synth', undefined, seconds));
    const clips = heroClips()[id] ?? [];
    for (let v = 0; v < clips.length; v++) {
      if (heroBuffer(id, v)) rows.push(await row(id, 'clip', v, seconds));
    }
  }

  const pairs: PairRow[] = [];
  for (const clips of [false, true]) {
    for (const p of PAIRS) {
      if (clips && !heroBuffer(p.a) && !heroBuffer(p.b)) continue;
      const opts: RenderOptions = {
        seconds: Math.max(secondsFor(p.a), secondsFor(p.b)),
        sampleRate: SAMPLE_RATE,
        heroBuffer: clips ? heroBuffer(p.a) : null,
        layers: [{ id: p.b, at: p.gapMs / 1000, heroBuffer: clips ? heroBuffer(p.b) : null }],
      };
      const m = await measureRender(p.a, opts);
      const linear = await measureRender(p.a, { ...opts, trimOffsetDb: PROBE_DB });
      pairs.push({
        label: p.label,
        clips,
        limiterDb: round2(linear.peakDb - PROBE_DB - m.peakDb),
        limiterStDb: round2(linear.stRmsDb - PROBE_DB - m.stRmsDb),
        ...m,
      });
    }
  }

  // The beds, on the cues' own axis: 300ms-window RMS through the same chain,
  // sampled every 50ms over 30s of each loop (after the compressor pre-roll).
  const beds: BedRow[] = [];
  for (const [track, bed] of Object.entries(MUSIC_BEDS)) {
    const response = await fetch(bed.url);
    const ctx = new OfflineAudioContext(2, 128, SAMPLE_RATE);
    const buffer = await ctx.decodeAudioData(await response.arrayBuffer());
    const rendered = await renderMusicOffline(buffer, { seconds: 30, sampleRate: SAMPLE_RATE, offsetS: bed.loopStart });
    const ch = channelsOf(rendered).map(c => c.subarray(SAMPLE_RATE));
    const w = Math.round(0.3 * SAMPLE_RATE);
    const step = Math.round(0.05 * SAMPLE_RATE);
    const levels: number[] = [];
    for (let s = 0; s + w <= ch[0].length; s += step) {
      let sum = 0;
      for (const c of ch) for (let i = s; i < s + w; i++) sum += c[i] * c[i];
      levels.push(toDbfs(Math.sqrt(sum / (w * ch.length))));
    }
    levels.sort((a, b) => a - b);
    const q = (p: number): number => round2(levels[Math.min(levels.length - 1, Math.floor(levels.length * p))]);
    const sp = spectrumOf(ch, SAMPLE_RATE, -90);
    beds.push({
      track, medianDb: q(0.5), p90Db: q(0.9), maxDb: q(1), peakDb: measure(ch, SAMPLE_RATE).peakDb,
      // Absolute octave levels on the same 300ms axis: shape × the median level.
      bandsDb: sp.bandsDb.map(b => round2(b + q(0.5))),
    });
  }

  // Cue vs bed, in the cue's OWN loudest octave — the masking question, which
  // a broadband level cannot answer (a bass-heavy bed can measure louder than
  // a coin and still leave the coin's 2–4kHz octave clear). Each cue as
  // shipped (clip variant 0, or synth), its octave shape scaled to its 300ms
  // loudness, against each bed's median octave level.
  const masking: MaskRow[] = [];
  for (const id of soundIds()) {
    const buffer = heroBuffer(id);
    const rendered = await renderSoundOffline(id, { seconds: secondsFor(id), sampleRate: SAMPLE_RATE, heroBuffer: buffer });
    const ch = channelsOf(rendered);
    const m = measure(ch, SAMPLE_RATE);
    const sp = spectrumOf(ch, SAMPLE_RATE);
    let k = 0;
    for (let i = 1; i < sp.bandsDb.length; i++) if (sp.bandsDb[i] > sp.bandsDb[k]) k = i;
    const cueBand = sp.bandsDb[k] + m.stRmsDb;
    const margins: Record<string, number> = {};
    for (const b of beds) margins[b.track] = round2(cueBand - b.bandsDb[k]);
    masking.push({ id, octaveHz: [63, 125, 250, 500, 1000, 2000, 4000, 8000][k], cueBandDb: round2(cueBand), margins });
  }

  const contrast: ContrastRow[] = [];
  for (const source of ['synth', 'clip'] as const) {
    for (const id of CONTRAST_IDS) {
      const buffer = source === 'clip' ? heroBuffer(id) : null;
      if (source === 'clip' && !buffer) continue;
      const rendered = await renderSoundOffline(id, {
        seconds: secondsFor(id), sampleRate: SAMPLE_RATE, heroBuffer: buffer,
      });
      const ch = channelsOf(rendered);
      contrast.push({
        id,
        source,
        activeMs: measure(ch, rendered.sampleRate).activeMs,
        ...spectrumOf(ch, rendered.sampleRate),
      });
    }
  }

  return {
    generated: new Date().toISOString(),
    userAgent: navigator.userAgent,
    sampleRate: SAMPLE_RATE,
    ceilingDb: Math.round(toDbfs(softClipCeiling(0.7)) * 1000) / 1000,
    rows,
    pairs,
    contrast,
    beds,
    masking,
  };
}

/**
 * Solve each clip's pre-trim gain so it lands on its synth fallback's 300ms
 * loudness. Iterated, not computed once: near the compressor's knee the chain
 * is not linear, so a first correction overshoots or undershoots by a little.
 * Five passes converge to well under 0.05dB for every clip in the bank.
 */
async function solve(onlyNew = false): Promise<SolveRow[]> {
  await loadHeroBuffers();
  const out: SolveRow[] = [];
  for (const id of soundIds()) {
    const clips = heroClips()[id] ?? [];
    if (!clips.length) continue;
    const seconds = secondsFor(id);
    const synth = await measureRender(id, { seconds, sampleRate: SAMPLE_RATE });
    for (let v = 0; v < clips.length; v++) {
      const buffer = heroBuffer(id, v);
      if (!buffer) continue;
      let gain = clips[v].gain;
      if (onlyNew && gain !== 1) {
        const m = await measureRender(id, { seconds, sampleRate: SAMPLE_RATE, heroBuffer: buffer, heroVariant: v });
        out.push({ id, variant: v, url: clips[v].url, gain, synthStRmsDb: synth.stRmsDb, clipStRmsDb: m.stRmsDb, deltaDb: round2(m.stRmsDb - synth.stRmsDb) });
        continue;
      }
      let m: CueMeasurement = synth;
      for (let pass = 0; pass < 5; pass++) {
        m = await measureRender(id, {
          seconds, sampleRate: SAMPLE_RATE, heroBuffer: buffer, heroVariant: v, heroGainOverride: gain,
        });
        const delta = synth.stRmsDb - m.stRmsDb;
        if (Math.abs(delta) < 0.02) break;
        gain *= Math.pow(10, delta / 20);
      }
      gain = Math.round(gain * 1000) / 1000;
      m = await measureRender(id, {
        seconds, sampleRate: SAMPLE_RATE, heroBuffer: buffer, heroVariant: v, heroGainOverride: gain,
      });
      out.push({
        id, variant: v, url: clips[v].url, gain,
        synthStRmsDb: synth.stRmsDb, clipStRmsDb: m.stRmsDb, deltaDb: round2(m.stRmsDb - synth.stRmsDb),
      });
    }
  }
  return out;
}

/**
 * Each clip as Chrome DECODES it, outside the graph: length, how many samples
 * of encoder priming precede the onset, and raw peak / loudness. This is what
 * shows whether the browser trims MP3 encoder delay (a hero clip that starts
 * 25ms late lands behind its animation) and what resampling did to the peak.
 */
async function inspectClips(): Promise<Record<string, unknown>[]> {
  await loadHeroBuffers();
  const out: Record<string, unknown>[] = [];
  for (const [url, b] of decoded) {
    const ch = channelsOf(b);
    const m = measure(ch, b.sampleRate);
    let lead = 0;
    const thr = Math.pow(10, (m.peakDb - 40) / 20);
    while (lead < ch[0].length && Math.abs(ch[0][lead]) < thr) lead++;
    out.push({ url, seconds: round2(b.duration * 1000) / 1000, channels: b.numberOfChannels,
      leadMs: round2((lead / b.sampleRate) * 1000), ...m, crestDb: round2(m.peakDb - m.stRmsDb) });
  }
  return out;
}

/**
 * A smoke run of the LIVE engine — the real `getSoundEngine()` singleton on a
 * real AudioContext (the runner launches Chrome with autoplay allowed, so no
 * gesture is needed): unlock, preload, fire every cue twice (so a round-robin
 * picks a second variant), walk the music through lobby → table → endgame,
 * switch again mid-load, and stop. It measures nothing; it proves the paths
 * the offline render does not take (clip cache, variant pick, crossfade
 * automation, loop regions) run without throwing.
 */
async function liveSmoke(): Promise<Record<string, unknown>> {
  const errors: string[] = [];
  const onError = (e: ErrorEvent | PromiseRejectionEvent): void => {
    errors.push(String('reason' in e ? e.reason : e.message));
  };
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onError);
  const origWarn = console.warn;
  console.warn = (...a: unknown[]) => { errors.push(a.map(String).join(' ')); origWarn(...a); };
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
  const sound = getSoundEngine();
  const trace: string[] = [];
  const mark = (label: string) => trace.push(`${label}: chose ${sound.currentMusicTrack}, playing ${sound.playingMusicTrack}`);

  sound.setMusicTrack('lobby');
  sound.unlock();
  for (let i = 0; i < 40 && !sound.running; i++) await sleep(50);
  await sleep(1500); // hero clips + lobby bed load
  mark('after unlock');
  for (const id of soundIds()) {
    sound.play(id);
    await sleep(120);
    sound.play(id, { mine: false, playerId: 'p2' });
    await sleep(120);
  }
  sound.setMusicTrack('table');
  await sleep(800);
  mark('table requested +0.8s');
  await sleep(2500);
  mark('table +3.3s');
  sound.setMusicTrack('endgame');
  sound.setMusicTrack('table'); // a switch that lands while the first is loading
  await sleep(1200);
  mark('endgame then table');
  sound.setMusicTrack('endgame');
  await sleep(3000);
  mark('endgame +3s');
  sound.stopMusic(300);
  await sleep(500);
  mark('stopped');
  sound.setMusicTrack('lobby');
  sound.startMusic();
  await sleep(1500);
  mark('restarted lobby');
  sound.stopMusic(100);

  window.removeEventListener('error', onError);
  window.removeEventListener('unhandledrejection', onError);
  console.warn = origWarn;
  return { errors, trace, stats: sound.stats() };
}

async function probe(id: SoundId, opts: RenderOptions = {}): Promise<CueMeasurement> {
  return measureRender(id, { seconds: SYNTH_SECONDS, sampleRate: SAMPLE_RATE, ...opts });
}

window.__COUP_AUDIO = { ids: soundIds, run, solve, probe, inspectClips, liveSmoke };
