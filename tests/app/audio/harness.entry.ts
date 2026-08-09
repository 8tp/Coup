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
 * Bundled and served by the procedure in `docs/AUDIO-MIX.md`.
 */
import {
  heroClips,
  renderSoundOffline,
  softClipCeiling,
  soundIds,
  MIX_TRIM_DB,
  type RenderOptions,
  type SoundId,
} from '../../../src/app/audio/SoundEngine';
import { measure, spectrumOf, toDbfs, type CueMeasurement, type Spectrum } from './analysis';

/** Hero clips are ~7s; every synth voice's longest tail is 1.85s. */
const HERO_SECONDS = 9;
const SYNTH_SECONDS = 4;

export interface Row extends CueMeasurement {
  id: SoundId;
  trimDb: number;
  /** Hero cues appear twice: once as the mastered clip, once as the fallback. */
  source: 'synth' | 'clip';
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
 * must never be confused" is a design requirement, and this is the evidence.
 */
export interface ContrastRow extends Spectrum {
  id: SoundId;
  /** Length of the cue's own active window, ms. Duration is half the contrast. */
  activeMs: number;
}

const CONTRAST_IDS: readonly SoundId[] = [
  'denied', 'timerWarning', 'influenceLoss', 'challengeRevealFail',
];

export interface HarnessReport {
  generated: string;
  userAgent: string;
  sampleRate: number;
  ceilingDb: number;
  rows: Row[];
  pairs: PairRow[];
  contrast: ContrastRow[];
}

interface HarnessApi {
  ids(): readonly SoundId[];
  run(): Promise<HarnessReport>;
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
];

const decoded = new Map<string, AudioBuffer>();

/** Decode the mastered stingers once, in a throwaway context. */
async function loadHeroBuffers(): Promise<void> {
  const ctx = new OfflineAudioContext(2, 128, SAMPLE_RATE);
  for (const clip of Object.values(heroClips())) {
    if (!clip || decoded.has(clip.url)) continue;
    const response = await fetch(clip.url);
    if (!response.ok) throw new Error(`${clip.url}: ${response.status}`);
    decoded.set(clip.url, await ctx.decodeAudioData(await response.arrayBuffer()));
  }
}

function channelsOf(buffer: AudioBuffer): Float32Array[] {
  const out: Float32Array[] = [];
  for (let c = 0; c < buffer.numberOfChannels; c++) out.push(buffer.getChannelData(c));
  return out;
}

async function run(): Promise<HarnessReport> {
  await loadHeroBuffers();
  const rows: Row[] = [];

  /** One cue, at its shipped trim, plus how hard it is hitting the limiter. */
  async function row(
    id: SoundId,
    source: 'synth' | 'clip',
    heroBuffer: AudioBuffer | null,
    seconds: number,
  ): Promise<Row> {
    const opts = { seconds, sampleRate: SAMPLE_RATE, heroBuffer };
    const shipped = await renderSoundOffline(id, opts);
    const probe = await renderSoundOffline(id, { ...opts, trimOffsetDb: PROBE_DB });
    const m = measure(channelsOf(shipped), shipped.sampleRate);
    const linear = measure(channelsOf(probe), probe.sampleRate);
    return {
      id,
      trimDb: MIX_TRIM_DB[id],
      source,
      limiterDb: round2(linear.peakDb - PROBE_DB - m.peakDb),
      limiterStDb: round2(linear.stRmsDb - PROBE_DB - m.stRmsDb),
      ...m,
    };
  }

  for (const id of soundIds()) {
    const clip = heroClips()[id];
    const seconds = clip ? HERO_SECONDS : SYNTH_SECONDS;
    rows.push(await row(id, 'synth', null, seconds));
    const buffer = clip ? decoded.get(clip.url) : undefined;
    if (buffer) rows.push(await row(id, 'clip', buffer, seconds));
  }

  const pairs: PairRow[] = [];
  for (const p of PAIRS) {
    const opts = {
      seconds: SYNTH_SECONDS,
      sampleRate: SAMPLE_RATE,
      layers: [{ id: p.b, at: p.gapMs / 1000 }],
    };
    const rendered = await renderSoundOffline(p.a, opts);
    const probe = await renderSoundOffline(p.a, { ...opts, trimOffsetDb: PROBE_DB });
    const m = measure(channelsOf(rendered), rendered.sampleRate);
    const linear = measure(channelsOf(probe), probe.sampleRate);
    pairs.push({
      label: p.label,
      limiterDb: round2(linear.peakDb - PROBE_DB - m.peakDb),
      limiterStDb: round2(linear.stRmsDb - PROBE_DB - m.stRmsDb),
      ...m,
    });
  }

  const contrast: ContrastRow[] = [];
  for (const id of CONTRAST_IDS) {
    const rendered = await renderSoundOffline(id, { seconds: SYNTH_SECONDS, sampleRate: SAMPLE_RATE });
    const ch = channelsOf(rendered);
    contrast.push({
      id,
      activeMs: measure(ch, rendered.sampleRate).activeMs,
      ...spectrumOf(ch, rendered.sampleRate),
    });
  }

  return {
    generated: new Date().toISOString(),
    userAgent: navigator.userAgent,
    sampleRate: SAMPLE_RATE,
    ceilingDb: Math.round(toDbfs(softClipCeiling(0.7)) * 1000) / 1000,
    rows,
    pairs,
    contrast,
  };
}

async function probe(id: SoundId, opts: RenderOptions = {}): Promise<CueMeasurement> {
  const rendered = await renderSoundOffline(id, { seconds: SYNTH_SECONDS, sampleRate: SAMPLE_RATE, ...opts });
  return measure(channelsOf(rendered), rendered.sampleRate);
}

window.__COUP_AUDIO = { ids: soundIds, run, probe };
