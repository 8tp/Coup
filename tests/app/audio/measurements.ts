/**
 * ── RECORDED OFFLINE-RENDER MEASUREMENTS ────────────────────────────────────
 *
 * Every number in this file came out of `tests/app/audio/harness.html`, which
 * renders each cue through `renderSoundOffline()` — the same `buildGraph()`,
 * `startVoice()` and `voiceGain()` the live `play()` path uses. Nothing here was
 * calculated by hand, and nothing here is an estimate.
 *
 *   date          2026-08-10 (re-rendered whole bank when `denied` was added)
 *   renderer      Chrome 151.0.0.0 / macOS, OfflineAudioContext, 2ch @ 48kHz
 *   pre-roll      1.0s of silence before each cue, so the master compressor's
 *                 makeup gain has settled — see RENDER_PRE_ROLL_S. Without it
 *                 every figure is up to 6.5dB low and short cues are biased
 *                 differently from long ones.
 *   perspective   mine = true (centred, unfiltered), nominal pitch, flam run 0
 *
 * DO NOT hand-edit a level in this file. Change MIX_DB, re-run the harness,
 * paste the new table. `MEASURED_TRIM_DB` below exists to enforce exactly that:
 * the gate fails if MIX_DB has moved since these were taken.
 *
 * Regeneration procedure: docs/AUDIO-MIX.md.
 */
import type { SoundId } from '../../../src/app/audio/SoundEngine';

export const MEASURED_AT = '2026-08-10';
export const MEASURED_WITH =
  'Chrome 151.0.0.0 / macOS · OfflineAudioContext 2ch 48kHz · 1.0s pre-roll';

/**
 * The soft-clip table maximum, in dBFS: 20·log10(0.7 + 0.3·tanh(1)).
 * Confirmed by the render — `softClipCeiling(0.7)` reported −0.645 in the
 * browser, matching the arithmetic.
 */
export const SOFT_CLIP_CEILING_DBFS = -0.645;

export interface CueLevels {
  /** True peak, dBFS. */
  readonly peakDb: number;
  /** RMS over the cue's own active window (−45dB below peak), dBFS. */
  readonly rmsDb: number;
  /** Loudest 300ms sliding-window RMS, dBFS. The tier-ordering axis. */
  readonly stRmsDb: number;
  /** dB of gain reduction the master chain applies to the peak at this trim. */
  readonly limiterDb: number;
}

/**
 * The synth voice for every cue. For `gameOverWin` and `gameOverLose` this is
 * the FALLBACK — the mastered clip is in `MEASURED_HERO_CLIP`.
 */
export const MEASURED: Readonly<Record<SoundId, CueLevels>> = {
  // tier 0 — the game turned
  gameOverWin: { peakDb: -5.63, rmsDb: -18.76, stRmsDb: -17.07, limiterDb: 0.42 },
  gameOverLose: { peakDb: -8.58, rmsDb: -19.42, stRmsDb: -17.01, limiterDb: 0 },
  playerEliminated: { peakDb: -10.46, rmsDb: -18.17, stRmsDb: -17.04, limiterDb: 0 },
  // tier 1 — you lost
  influenceLoss: { peakDb: -11.86, rmsDb: -19.58, stRmsDb: -18.97, limiterDb: 0 },
  challengeRevealFail: { peakDb: -10.46, rmsDb: -21.49, stRmsDb: -18.99, limiterDb: 0 },
  block: { peakDb: -4.13, rmsDb: -18.07, stRmsDb: -21.13, limiterDb: 2.11 },
  // tier 2 — a play resolved
  exchange: { peakDb: -10.18, rmsDb: -21.99, stRmsDb: -23.05, limiterDb: 0 },
  assassinationAlert: { peakDb: -12.75, rmsDb: -23.74, stRmsDb: -23.00, limiterDb: 0 },
  coup: { peakDb: -13.08, rmsDb: -25.79, stRmsDb: -22.97, limiterDb: 0 },
  challengeRevealSuccess: { peakDb: -13.80, rmsDb: -24.91, stRmsDb: -22.97, limiterDb: 0 },
  // tier 3 — cards being handled
  coinsGained: { peakDb: -14.20, rmsDb: -21.93, stRmsDb: -24.97, limiterDb: 0 },
  coinsLost: { peakDb: -14.00, rmsDb: -23.39, stRmsDb: -26.42, limiterDb: 0 },
  actionDeclared: { peakDb: -13.93, rmsDb: -23.29, stRmsDb: -29.06, limiterDb: 0 },
  cardShuffle: { peakDb: -14.01, rmsDb: -29.53, stRmsDb: -32.58, limiterDb: 0 },
  // tier 4 — chrome
  timerWarning: { peakDb: -21.67, rmsDb: -27.54, stRmsDb: -34.56, limiterDb: 0 },
  chatMessage: { peakDb: -22.85, rmsDb: -30.56, stRmsDb: -34.57, limiterDb: 0 },
  reaction: { peakDb: -21.13, rmsDb: -28.83, stRmsDb: -34.60, limiterDb: 0 },
  yourTurn: { peakDb: -25.89, rmsDb: -33.79, stRmsDb: -34.60, limiterDb: 0 },
  challengeWindow: { peakDb: -24.10, rmsDb: -34.58, stRmsDb: -34.61, limiterDb: 0 },
  blockOpportunity: { peakDb: -26.92, rmsDb: -33.28, stRmsDb: -34.64, limiterDb: 0 },
  denied: { peakDb: -21.56, rmsDb: -29.32, stRmsDb: -34.64, limiterDb: 0 },
};

/**
 * ── TIMBRE, NOT LEVEL ───────────────────────────────────────────────────────
 *
 * Octave-band energy NORMALISED TO EACH CUE'S OWN TOTAL, so these numbers say
 * nothing about how loud a cue is and everything about what it sounds like.
 * `MEASURED` above already gates level; this gates the other half.
 *
 * It exists because `denied` was added into a bank that already contains two
 * falling low cues about losing, and "correctly levelled" is not the same claim
 * as "cannot be confused with a lost influence". Getting the level right and
 * the shape wrong is precisely what `timerWarning` standing in for a refusal
 * was: tier-4 weight, alarm-clock timbre.
 *
 * Bands are the ISO octave centres in `OCTAVE_CENTRES`: 63 125 250 500 1k 2k
 * 4k 8k Hz. `lowDb` is everything under 160Hz. `centroidHz` is the
 * power-weighted mean frequency.
 */
export interface ContrastLevels {
  /** Active-window length, ms. */
  readonly activeMs: number;
  /** Per-octave energy, dB relative to the cue's own total. */
  readonly bandsDb: readonly number[];
  /** Energy under 160Hz, dB relative to total. */
  readonly lowDb: number;
  /** Power-weighted mean frequency, Hz. */
  readonly centroidHz: number;
}

export const MEASURED_CONTRAST: Readonly<Record<string, ContrastLevels>> = {
  denied: {
    activeMs: 88.10,
    bandsDb: [-29.38, -16.41, -0.97, -8.79, -14.16, -22.74, -38.29, -56.10],
    lowDb: -19.04,
    centroidHz: 320.36,
  },
  timerWarning: {
    activeMs: 59.60,
    bandsDb: [-89.66, -82.64, -74.82, -65.51, -0.83, -10.37, -14.80, -14.70],
    lowDb: -82.78,
    centroidHz: 1561.43,
  },
  influenceLoss: {
    activeMs: 346.46,
    bandsDb: [-113.15, -32.13, 0, -82.76, -107.86, -104.66, -101.23, -94.78],
    lowDb: -51.49,
    centroidHz: 236.57,
  },
  challengeRevealFail: {
    activeMs: 714.81,
    bandsDb: [-2.09, -4.11, -19.19, -21.99, -29.06, -34.99, -38.56, -41.75],
    lowDb: -0.30,
    centroidHz: 105.02,
  },
};

/**
 * The mastered mp3 stingers, rendered through the same head as their fallbacks.
 * The active-window RMS is far below the synth's because a 6-second stinger
 * averages in five seconds of ring-out that a 0.9s fanfare does not have — which
 * is exactly why the parity check runs on `stRmsDb`, not on `rmsDb`.
 */
export const MEASURED_HERO_CLIP: Readonly<Partial<Record<SoundId, CueLevels>>> = {
  gameOverWin: { peakDb: -4.61, rmsDb: -20.48, stRmsDb: -17.15, limiterDb: 1.54 },
  gameOverLose: { peakDb: -7.23, rmsDb: -26.23, stRmsDb: -17.02, limiterDb: 0 },
};

/**
 * Beats a real Coup game produces, rendered as one summed pass. `limiterDb` is
 * how much the master chain pulls the sum down: near zero means the two cues do
 * not add into the limiter.
 */
export interface PairLevels extends CueLevels {
  readonly label: string;
}

export const MEASURED_PAIRS: readonly PairLevels[] = [
  { label: 'challengeRevealFail + cardShuffle @400ms', peakDb: -10.46, rmsDb: -21.35, stRmsDb: -18.88, limiterDb: 0 },
  { label: 'challengeRevealFail + influenceLoss @120ms', peakDb: -6.79, rmsDb: -19.12, stRmsDb: -16.10, limiterDb: 0.04 },
  { label: 'influenceLoss + playerEliminated @150ms', peakDb: -7.71, rmsDb: -17.54, stRmsDb: -15.63, limiterDb: 0.01 },
  { label: 'coup + influenceLoss @250ms', peakDb: -10.30, rmsDb: -20.46, stRmsDb: -18.71, limiterDb: 0 },
  { label: 'exchange + cardShuffle @0ms', peakDb: -6.92, rmsDb: -21.49, stRmsDb: -22.58, limiterDb: 0.02 },
  { label: 'cardShuffle x2 @90ms', peakDb: -14.01, rmsDb: -28.74, stRmsDb: -29.74, limiterDb: 0 },
  { label: 'coinsGained + actionDeclared @60ms', peakDb: -10.25, rmsDb: -20.48, stRmsDb: -23.53, limiterDb: 0 },
  // The realistic double-tap. RATE_DEFAULT drops a repeat inside 80ms, so 90ms
  // is the tightest a second tap can physically land; it is still inside
  // FLAM_WINDOW, so live the second arrives at FLAM_DB[1] = −2.5dB. This render
  // gives BOTH taps full gain, which makes it an upper bound on the real beat.
  // Peak is identical to one tap (−21.56): the two do not overlap at all.
  { label: 'denied x2 @90ms', peakDb: -21.56, rmsDb: -29.37, stRmsDb: -31.63, limiterDb: 0 },
];

/**
 * ── THE STALENESS GUARD ─────────────────────────────────────────────────────
 * MIX_DB as it stood when the table above was rendered. The gate asserts this
 * still equals the live MIX_DB, so a trim edited without a re-render fails the
 * build rather than silently invalidating every level in this file. It is the
 * mechanism that makes "measured" mean measured.
 */
export const MEASURED_TRIM_DB: Readonly<Record<SoundId, number>> = {
  gameOverWin: -2.8,
  gameOverLose: -5,
  playerEliminated: -3,
  challengeRevealFail: -2.1,
  influenceLoss: -1.9,
  block: 5.6,
  assassinationAlert: -2.3,
  coup: -12.9,
  challengeRevealSuccess: -5.6,
  exchange: -4.3,
  cardShuffle: 1.2,
  actionDeclared: -0.3,
  coinsGained: -0.7,
  coinsLost: -0.4,
  yourTurn: -15.9,
  challengeWindow: -13.7,
  blockOpportunity: -11.2,
  timerWarning: -9.4,
  denied: -12,
  reaction: -7.6,
  chatMessage: -7.4,
};

/** HERO_CLIPS pre-trim gains as they stood for the render above. */
export const MEASURED_HERO_CLIP_GAIN: Readonly<Partial<Record<SoundId, number>>> = {
  gameOverWin: 0.808,
  gameOverLose: 0.557,
};

function pick(key: 'peakDb' | 'rmsDb' | 'stRmsDb'): Record<SoundId, number> {
  const out = {} as Record<SoundId, number>;
  for (const id of Object.keys(MEASURED) as SoundId[]) out[id] = MEASURED[id][key];
  return out;
}

/** Convenience views over `MEASURED`. Same numbers, one source. */
export const MEASURED_PEAK_DBFS: Readonly<Record<SoundId, number>> = pick('peakDb');
export const MEASURED_RMS_DBFS: Readonly<Record<SoundId, number>> = pick('rmsDb');
export const MEASURED_ST_RMS_DBFS: Readonly<Record<SoundId, number>> = pick('stRmsDb');
