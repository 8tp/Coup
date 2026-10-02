/**
 * ── RECORDED OFFLINE-RENDER MEASUREMENTS ────────────────────────────────────
 *
 * Every number in this file came out of `tests/app/audio/harness.html`, which
 * renders each cue through `renderSoundOffline()` — the same `buildGraph()`,
 * `startVoice()` and `voiceGain()` the live `play()` path uses. Nothing here was
 * calculated by hand, and nothing here is an estimate. The data blocks below
 * are pasted verbatim from `artifacts/measurements-snippet.ts`, which
 * `npx tsx scripts/render-audio-mix.ts` writes from the report.
 *
 *   date          2026-10-01 (whole bank re-rendered: ElevenLabs hero clips
 *                 for every cue, `cardDeal` added)
 *   renderer      HeadlessChrome 153.0.0.0 / macOS, OfflineAudioContext,
 *                 2ch @ 48kHz. Every synth row that existed on 2026-08-10
 *                 (Chrome 151) came back identical to 0.01dB.
 *   pre-roll      1.0s of silence before each cue, so the master compressor's
 *                 makeup gain has settled — see RENDER_PRE_ROLL_S. Without it
 *                 every figure is up to 6.5dB low and short cues are biased
 *                 differently from long ones.
 *   perspective   mine = true (centred, unfiltered), nominal pitch, flam run 0
 *
 * DO NOT hand-edit a level in this file. Change MIX_DB or a HERO_CLIPS gain,
 * re-run the harness, paste the new blocks. `MEASURED_TRIM_DB` and
 * `MEASURED_HERO_CLIP_GAIN` exist to enforce exactly that: the gate fails if
 * either has moved since these were taken.
 *
 * The blocks:
 *
 *   MEASURED                the synth voice of every cue. For a hero cue this
 *                           is the FALLBACK — what plays when the fetch fails.
 *   MEASURED_HERO_CLIP      every mastered clip, one row per round-robin
 *                           variant, rendered through the same head as its
 *                           fallback. `activeMs` is how long it sounds.
 *   MEASURED_PAIRS          beats a real game produces, as one summed render,
 *                           synth voices.
 *   MEASURED_CLIP_PAIRS     the same beats with every hero cue as its clip
 *                           (variant 0) — the beats the player actually hears.
 *   MEASURED_CONTRAST       octave-band energy NORMALISED TO EACH CUE'S OWN
 *                           TOTAL — timbre, not level — for the four cues that
 *                           must never be confused. Synth voices.
 *   MEASURED_CLIP_CONTRAST  the same, for their clips.
 *   MEASURED_BEDS           each music bed rendered through the same chain at
 *                           MUSIC_GAIN, on the cues' own 300ms-RMS axis:
 *                           median / p90 / max over 30s, and octave levels.
 *   MEASURED_MASKING        each cue (as shipped) in its OWN loudest octave,
 *                           against each bed's level in that octave — the
 *                           masking question a broadband number cannot answer.
 *   MEASURED_TRIM_DB        MIX_DB as it stood for this render.
 *   MEASURED_HERO_CLIP_GAIN HERO_CLIPS gains, one per variant, as rendered.
 *
 * Regeneration procedure: docs/AUDIO-MIX.md.
 */
import type { SoundId } from '../../../src/app/audio/SoundEngine';

export const MEASURED_AT = '2026-10-01';
export const MEASURED_WITH =
  'HeadlessChrome 153.0.0.0 / macOS · OfflineAudioContext 2ch 48kHz · 1.0s pre-roll';

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

/** A clip row also records how long it sounds — the voice budget must cover it. */
export interface ClipLevels extends CueLevels {
  /** Active window (within 45dB of peak), ms. */
  readonly activeMs: number;
}

/**
 * A two-cue beat. `limiterDb` is how much the master chain pulls the sum down:
 * near zero means the two cues do not add into the limiter.
 */
export interface PairLevels extends CueLevels {
  readonly label: string;
}

export interface BedLevels {
  /** 300ms-window RMS through the chain at MUSIC_GAIN, dBFS. */
  readonly medianDb: number;
  readonly p90Db: number;
  readonly maxDb: number;
  readonly peakDb: number;
  /** Octave levels (63 125 250 500 1k 2k 4k 8k Hz), dBFS on the same axis. */
  readonly bandsDb: readonly number[];
}

export interface MaskLevels {
  /** Centre of the cue's loudest octave. */
  readonly octaveHz: number;
  /** The cue's level in that octave at its loudest 300ms, dBFS. */
  readonly cueBandDb: number;
  /** cue − bed in that octave, dB, per bed. */
  readonly margins: Readonly<Record<string, number>>;
}

export interface ContrastLevels {
  /** Active-window length, ms. */
  readonly activeMs: number;
  /** Per-octave energy (63 125 250 500 1k 2k 4k 8k Hz), dB relative to the cue's own total. */
  readonly bandsDb: readonly number[];
  /** Energy under 160Hz, dB relative to total. */
  readonly lowDb: number;
  /** Power-weighted mean frequency, Hz. */
  readonly centroidHz: number;
}

export const MEASURED: Readonly<Record<SoundId, CueLevels>> = {
  gameOverLose: { peakDb: -8.58, rmsDb: -19.42, stRmsDb: -17.01, limiterDb: 0 },
  playerEliminated: { peakDb: -10.46, rmsDb: -18.17, stRmsDb: -17.04, limiterDb: 0 },
  gameOverWin: { peakDb: -5.63, rmsDb: -18.76, stRmsDb: -17.07, limiterDb: 0.42 },
  influenceLoss: { peakDb: -11.86, rmsDb: -19.58, stRmsDb: -18.97, limiterDb: 0 },
  challengeRevealFail: { peakDb: -10.46, rmsDb: -21.49, stRmsDb: -18.99, limiterDb: 0 },
  block: { peakDb: -4.13, rmsDb: -18.07, stRmsDb: -21.13, limiterDb: 2.11 },
  coup: { peakDb: -13.08, rmsDb: -25.79, stRmsDb: -22.97, limiterDb: 0 },
  challengeRevealSuccess: { peakDb: -13.8, rmsDb: -24.91, stRmsDb: -22.97, limiterDb: 0 },
  assassinationAlert: { peakDb: -12.75, rmsDb: -23.74, stRmsDb: -23, limiterDb: 0 },
  exchange: { peakDb: -10.18, rmsDb: -21.99, stRmsDb: -23.05, limiterDb: 0 },
  coinsGained: { peakDb: -14.2, rmsDb: -21.93, stRmsDb: -24.97, limiterDb: 0 },
  coinsLost: { peakDb: -14, rmsDb: -23.39, stRmsDb: -26.42, limiterDb: 0 },
  actionDeclared: { peakDb: -13.93, rmsDb: -23.29, stRmsDb: -29.06, limiterDb: 0 },
  cardDeal: { peakDb: -13.66, rmsDb: -33.21, stRmsDb: -32.53, limiterDb: 0 },
  cardShuffle: { peakDb: -14.01, rmsDb: -29.53, stRmsDb: -32.58, limiterDb: 0 },
  timerWarning: { peakDb: -21.67, rmsDb: -27.54, stRmsDb: -34.56, limiterDb: 0 },
  chatMessage: { peakDb: -22.85, rmsDb: -30.56, stRmsDb: -34.57, limiterDb: 0 },
  yourTurn: { peakDb: -25.89, rmsDb: -33.79, stRmsDb: -34.6, limiterDb: 0 },
  reaction: { peakDb: -21.13, rmsDb: -28.83, stRmsDb: -34.6, limiterDb: 0 },
  challengeWindow: { peakDb: -24.1, rmsDb: -34.58, stRmsDb: -34.61, limiterDb: 0 },
  blockOpportunity: { peakDb: -26.92, rmsDb: -33.28, stRmsDb: -34.64, limiterDb: 0 },
  denied: { peakDb: -21.56, rmsDb: -29.32, stRmsDb: -34.64, limiterDb: 0 },
};

export const MEASURED_HERO_CLIP: Readonly<Partial<Record<SoundId, readonly ClipLevels[]>>> = {
  gameOverWin: [
    { peakDb: -4.58, rmsDb: -20.41, stRmsDb: -17.08, limiterDb: 1.59, activeMs: 5889.35 },
  ],
  gameOverLose: [
    { peakDb: -7.23, rmsDb: -26.23, stRmsDb: -17.02, limiterDb: 0, activeMs: 6075.6 },
  ],
  playerEliminated: [
    { peakDb: -7.77, rmsDb: -21.2, stRmsDb: -17.04, limiterDb: 0, activeMs: 1452.38 },
  ],
  block: [
    { peakDb: -6.84, rmsDb: -20.16, stRmsDb: -21.12, limiterDb: 0.03, activeMs: 240.54 },
  ],
  influenceLoss: [
    { peakDb: -6.07, rmsDb: -20.54, stRmsDb: -18.96, limiterDb: 0.22, activeMs: 489.6 },
  ],
  challengeRevealFail: [
    { peakDb: -6.08, rmsDb: -21.73, stRmsDb: -18.99, limiterDb: 0.22, activeMs: 603.31 },
  ],
  coup: [
    { peakDb: -9.09, rmsDb: -22.11, stRmsDb: -22.97, limiterDb: 0, activeMs: 246.5 },
  ],
  assassinationAlert: [
    { peakDb: -8.59, rmsDb: -24.31, stRmsDb: -22.99, limiterDb: 0, activeMs: 406.85 },
  ],
  challengeRevealSuccess: [
    { peakDb: -8.52, rmsDb: -24.54, stRmsDb: -22.97, limiterDb: 0, activeMs: 434.44 },
  ],
  exchange: [
    { peakDb: -6.92, rmsDb: -25.73, stRmsDb: -23.06, limiterDb: 0.02, activeMs: 653.19 },
  ],
  actionDeclared: [
    { peakDb: -9.71, rmsDb: -25.47, stRmsDb: -29.08, limiterDb: 0, activeMs: 130.9 },
    { peakDb: -11.08, rmsDb: -24.79, stRmsDb: -29.04, limiterDb: 0, activeMs: 112.79 },
    { peakDb: -9.86, rmsDb: -25.9, stRmsDb: -29.05, limiterDb: 0, activeMs: 145.5 },
  ],
  coinsGained: [
    { peakDb: -9.89, rmsDb: -24.12, stRmsDb: -24.95, limiterDb: 0, activeMs: 247.73 },
    { peakDb: -9.9, rmsDb: -25.15, stRmsDb: -24.96, limiterDb: 0, activeMs: 313.4 },
  ],
  coinsLost: [
    { peakDb: -10.2, rmsDb: -24.1, stRmsDb: -26.43, limiterDb: 0, activeMs: 175.56 },
    { peakDb: -9.66, rmsDb: -25.62, stRmsDb: -26.42, limiterDb: 0, activeMs: 249.63 },
  ],
  cardShuffle: [
    { peakDb: -9.8, rmsDb: -29.5, stRmsDb: -32.56, limiterDb: 0, activeMs: 148.42 },
    { peakDb: -9.7, rmsDb: -31.17, stRmsDb: -32.57, limiterDb: 0, activeMs: 217.04 },
    { peakDb: -9.67, rmsDb: -31.05, stRmsDb: -32.56, limiterDb: 0, activeMs: 211.81 },
  ],
  cardDeal: [
    { peakDb: -9.91, rmsDb: -34.22, stRmsDb: -32.51, limiterDb: 0, activeMs: 965.6 },
  ],
  yourTurn: [
    { peakDb: -23.77, rmsDb: -36.8, stRmsDb: -34.61, limiterDb: 0, activeMs: 514.65 },
  ],
  challengeWindow: [
    { peakDb: -10.48, rmsDb: -27.39, stRmsDb: -34.61, limiterDb: 0, activeMs: 56.88 },
  ],
  blockOpportunity: [
    { peakDb: -10.01, rmsDb: -30.38, stRmsDb: -34.64, limiterDb: 0, activeMs: 112.58 },
  ],
  timerWarning: [
    { peakDb: -10.74, rmsDb: -29.33, stRmsDb: -34.56, limiterDb: 0, activeMs: 89.83 },
  ],
  denied: [
    { peakDb: -9.98, rmsDb: -29.06, stRmsDb: -34.63, limiterDb: 0, activeMs: 83.08 },
  ],
  reaction: [
    { peakDb: -13.91, rmsDb: -33.77, stRmsDb: -34.61, limiterDb: 0, activeMs: 247.5 },
  ],
  chatMessage: [
    { peakDb: -10.45, rmsDb: -29.63, stRmsDb: -34.58, limiterDb: 0, activeMs: 96 },
  ],
};

export const MEASURED_PAIRS: readonly PairLevels[] = [
  { label: 'challengeRevealFail + cardShuffle @400ms', peakDb: -10.46, rmsDb: -21.35, stRmsDb: -18.88, limiterDb: 0 },
  { label: 'challengeRevealFail + influenceLoss @120ms', peakDb: -6.79, rmsDb: -19.12, stRmsDb: -16.1, limiterDb: 0.04 },
  { label: 'influenceLoss + playerEliminated @150ms', peakDb: -7.71, rmsDb: -17.54, stRmsDb: -15.63, limiterDb: 0 },
  { label: 'coup + influenceLoss @250ms', peakDb: -10.3, rmsDb: -20.46, stRmsDb: -18.71, limiterDb: 0 },
  { label: 'exchange + cardShuffle @0ms', peakDb: -6.92, rmsDb: -21.49, stRmsDb: -22.58, limiterDb: 0.02 },
  { label: 'cardShuffle x2 @90ms', peakDb: -14.01, rmsDb: -28.74, stRmsDb: -29.74, limiterDb: 0 },
  { label: 'coinsGained + actionDeclared @60ms', peakDb: -10.24, rmsDb: -20.48, stRmsDb: -23.53, limiterDb: 0 },
  { label: 'denied x2 @90ms', peakDb: -21.56, rmsDb: -29.36, stRmsDb: -31.63, limiterDb: 0 },
  { label: 'cardDeal + yourTurn @300ms', peakDb: -13.66, rmsDb: -32.47, stRmsDb: -31.95, limiterDb: 0 },
];

export const MEASURED_CLIP_PAIRS: readonly PairLevels[] = [
  { label: 'challengeRevealFail + cardShuffle @400ms', peakDb: -6.08, rmsDb: -21.56, stRmsDb: -18.99, limiterDb: 0.22 },
  { label: 'challengeRevealFail + influenceLoss @120ms', peakDb: -5.52, rmsDb: -18.63, stRmsDb: -18.29, limiterDb: 0.47 },
  { label: 'influenceLoss + playerEliminated @150ms', peakDb: -5.03, rmsDb: -20.42, stRmsDb: -15.38, limiterDb: 0.94 },
  { label: 'coup + influenceLoss @250ms', peakDb: -6.07, rmsDb: -21.03, stRmsDb: -18.96, limiterDb: 0.22 },
  { label: 'exchange + cardShuffle @0ms', peakDb: -6.92, rmsDb: -25.33, stRmsDb: -23.06, limiterDb: 0.02 },
  { label: 'cardShuffle x2 @90ms', peakDb: -9.8, rmsDb: -28.54, stRmsDb: -29.53, limiterDb: 0 },
  { label: 'coinsGained + actionDeclared @60ms', peakDb: -9.6, rmsDb: -22.72, stRmsDb: -23.55, limiterDb: 0 },
  { label: 'denied x2 @90ms', peakDb: -9.98, rmsDb: -29.23, stRmsDb: -31.62, limiterDb: 0 },
  { label: 'cardDeal + yourTurn @300ms', peakDb: -9.91, rmsDb: -33.09, stRmsDb: -31.5, limiterDb: 0 },
];

export const MEASURED_CONTRAST: Readonly<Record<string, ContrastLevels>> = {
  denied: {
    activeMs: 88.1,
    bandsDb: [-29.38, -16.41, -0.97, -8.79, -14.16, -22.74, -38.29, -56.1],
    lowDb: -19.04,
    centroidHz: 320.36,
  },
  timerWarning: {
    activeMs: 59.6,
    bandsDb: [-89.62, -82.63, -74.83, -65.51, -0.83, -10.37, -14.8, -14.7],
    lowDb: -82.78,
    centroidHz: 1561.43,
  },
  influenceLoss: {
    activeMs: 346.46,
    bandsDb: [-114, -32.13, 0, -82.76, -114.31, -128.84, -134.73, -133.5],
    lowDb: -51.49,
    centroidHz: 236.57,
  },
  challengeRevealFail: {
    activeMs: 714.81,
    bandsDb: [-2.09, -4.11, -19.19, -21.99, -29.06, -34.99, -38.56, -41.75],
    lowDb: -0.3,
    centroidHz: 105.02,
  },
};

export const MEASURED_CLIP_CONTRAST: Readonly<Record<string, ContrastLevels>> = {
  denied: {
    activeMs: 83.08,
    bandsDb: [-30.59, -18.76, -6.22, -2.54, -7.43, -21.05, -36.66, -33.22],
    lowDb: -20.98,
    centroidHz: 551.64,
  },
  timerWarning: {
    activeMs: 89.83,
    bandsDb: [-40.67, -35.44, -31.45, -31.55, -8.44, -1.07, -14.39, -14.65],
    lowDb: -35.35,
    centroidHz: 1917.37,
  },
  influenceLoss: {
    activeMs: 489.6,
    bandsDb: [-22.27, -12.69, -17.88, -22.44, -15.57, -8.6, -7.16, -2.91],
    lowDb: -12.31,
    centroidHz: 5984.94,
  },
  challengeRevealFail: {
    activeMs: 603.31,
    bandsDb: [-21.9, -0.64, -9.58, -17.49, -28.56, -35.65, -41.46, -38.88],
    lowDb: -0.61,
    centroidHz: 120.51,
  },
};

export const MEASURED_BEDS: Readonly<Record<string, BedLevels>> = {
  lobby: { medianDb: -28.49, p90Db: -27.06, maxDb: -25.23, peakDb: -13.01, bandsDb: [-62.39, -37.41, -30.57, -35.28, -42.7, -52.02, -62.9, -69.54] },
  table: { medianDb: -26.42, p90Db: -25.88, maxDb: -23.97, peakDb: -13.35, bandsDb: [-29.13, -31.88, -35.13, -40.29, -51.46, -68.07, -83.34, -92.48] },
  endgame: { medianDb: -29.37, p90Db: -21.74, maxDb: -18.82, peakDb: -7.96, bandsDb: [-30.52, -36.65, -44.84, -53.19, -55.33, -52.96, -56.56, -63.55] },
};

export const MEASURED_MASKING: Readonly<Record<SoundId, MaskLevels>> = {
  yourTurn: { octaveHz: 1000, cueBandDb: -35.35, margins: { lobby: 7.35, table: 16.11, endgame: 19.98 } },
  actionDeclared: { octaveHz: 2000, cueBandDb: -35.16, margins: { lobby: 16.86, table: 32.91, endgame: 17.8 } },
  coup: { octaveHz: 125, cueBandDb: -25.87, margins: { lobby: 11.54, table: 6.01, endgame: 10.78 } },
  challengeWindow: { octaveHz: 2000, cueBandDb: -39.6, margins: { lobby: 12.42, table: 28.47, endgame: 13.36 } },
  blockOpportunity: { octaveHz: 8000, cueBandDb: -35.39, margins: { lobby: 34.15, table: 57.09, endgame: 28.16 } },
  assassinationAlert: { octaveHz: 8000, cueBandDb: -25.57, margins: { lobby: 43.97, table: 66.91, endgame: 37.98 } },
  block: { octaveHz: 63, cueBandDb: -24.11, margins: { lobby: 38.28, table: 5.02, endgame: 6.41 } },
  influenceLoss: { octaveHz: 8000, cueBandDb: -21.87, margins: { lobby: 47.67, table: 70.61, endgame: 41.68 } },
  challengeRevealSuccess: { octaveHz: 500, cueBandDb: -25.17, margins: { lobby: 10.11, table: 15.12, endgame: 28.02 } },
  challengeRevealFail: { octaveHz: 125, cueBandDb: -19.63, margins: { lobby: 17.78, table: 12.25, endgame: 17.02 } },
  coinsGained: { octaveHz: 2000, cueBandDb: -25.72, margins: { lobby: 26.3, table: 42.35, endgame: 27.24 } },
  coinsLost: { octaveHz: 2000, cueBandDb: -29.95, margins: { lobby: 22.07, table: 38.12, endgame: 23.01 } },
  timerWarning: { octaveHz: 2000, cueBandDb: -35.63, margins: { lobby: 16.39, table: 32.44, endgame: 17.33 } },
  denied: { octaveHz: 500, cueBandDb: -37.17, margins: { lobby: -1.89, table: 3.12, endgame: 16.02 } },
  gameOverWin: { octaveHz: 500, cueBandDb: -20.39, margins: { lobby: 14.89, table: 19.9, endgame: 32.8 } },
  gameOverLose: { octaveHz: 125, cueBandDb: -18.01, margins: { lobby: 19.4, table: 13.87, endgame: 18.64 } },
  playerEliminated: { octaveHz: 500, cueBandDb: -18.37, margins: { lobby: 16.91, table: 21.92, endgame: 34.82 } },
  exchange: { octaveHz: 8000, cueBandDb: -28.07, margins: { lobby: 41.47, table: 64.41, endgame: 35.48 } },
  cardShuffle: { octaveHz: 2000, cueBandDb: -34.55, margins: { lobby: 17.47, table: 33.52, endgame: 18.41 } },
  cardDeal: { octaveHz: 8000, cueBandDb: -39.45, margins: { lobby: 30.09, table: 53.03, endgame: 24.1 } },
  reaction: { octaveHz: 4000, cueBandDb: -39.79, margins: { lobby: 23.11, table: 43.55, endgame: 16.77 } },
  chatMessage: { octaveHz: 1000, cueBandDb: -40.19, margins: { lobby: 2.51, table: 11.27, endgame: 15.14 } },
};

export const MEASURED_TRIM_DB: Readonly<Record<SoundId, number>> = {
  yourTurn: -15.9,
  actionDeclared: -0.3,
  coup: -12.9,
  challengeWindow: -13.7,
  blockOpportunity: -11.2,
  assassinationAlert: -2.3,
  block: 5.6,
  influenceLoss: -1.9,
  challengeRevealSuccess: -5.6,
  challengeRevealFail: -2.1,
  coinsGained: -0.7,
  coinsLost: -0.4,
  timerWarning: -9.4,
  denied: -12,
  gameOverWin: -2.8,
  gameOverLose: -5,
  playerEliminated: -3,
  exchange: -4.3,
  cardShuffle: 1.2,
  cardDeal: 0.7,
  reaction: -7.6,
  chatMessage: -7.4,
};

export const MEASURED_HERO_CLIP_GAIN: Readonly<Partial<Record<SoundId, readonly number[]>>> = {
  yourTurn: [0.252],
  actionDeclared: [0.176, 0.159, 0.196],
  coup: [0.989],
  challengeWindow: [0.924],
  blockOpportunity: [0.708],
  assassinationAlert: [0.328],
  block: [0.15],
  influenceLoss: [0.361],
  challengeRevealSuccess: [0.446],
  challengeRevealFail: [0.364],
  coinsGained: [0.2, 0.201],
  coinsLost: [0.163, 0.187],
  timerWarning: [0.536],
  denied: [0.79],
  gameOverWin: [0.815],
  gameOverLose: [0.557],
  playerEliminated: [0.36],
  exchange: [0.461],
  cardShuffle: [0.173, 0.168, 0.177],
  cardDeal: [0.149],
  reaction: [0.303],
  chatMessage: [0.46],
};

function pick(key: 'peakDb' | 'rmsDb' | 'stRmsDb'): Record<SoundId, number> {
  const out = {} as Record<SoundId, number>;
  for (const id of Object.keys(MEASURED) as SoundId[]) out[id] = MEASURED[id][key];
  return out;
}

/** Convenience views over `MEASURED` (the synth bank). Same numbers, one source. */
export const MEASURED_PEAK_DBFS: Readonly<Record<SoundId, number>> = pick('peakDb');
export const MEASURED_RMS_DBFS: Readonly<Record<SoundId, number>> = pick('rmsDb');
export const MEASURED_ST_RMS_DBFS: Readonly<Record<SoundId, number>> = pick('stRmsDb');

/**
 * THE SHIPPED LADDER: every cue as the player hears it when the fetch
 * succeeds — its clip variants where it has any, its synth voice where it does
 * not. A cue with variants contributes each of them, so a round-robin can
 * never hide a hot take behind a quiet one.
 */
export function shippedLevels(id: SoundId): readonly CueLevels[] {
  return MEASURED_HERO_CLIP[id] ?? [MEASURED[id]];
}
