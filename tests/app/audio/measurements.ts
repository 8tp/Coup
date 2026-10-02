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
 *   date          2026-10-02 (the adaptive score: 15 pieces in six state
 *                 pools, the music-bus EQ, MUSIC_GAIN solved 0.243 → 0.052).
 *                 Every effects block was re-rendered and came back
 *                 byte-identical to the 2026-10-01 pass (whole bank:
 *                 ElevenLabs hero clips for every cue, `cardDeal` added).
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
 *   MEASURED_BEDS           every music piece of every state pool, decoded at
 *                           MUSIC_DECODE_RATE and rendered through the same
 *                           chain (so the music-bus EQ) at MUSIC_GAIN over its
 *                           body (entryS → handoffS), on the cues' own
 *                           300ms-RMS axis: median / p90 / max, p90 octave
 *                           levels, and its energy share under 150Hz before
 *                           (file) and after (bus) the EQ.
 *   MEASURED_MASKING        each cue (as shipped) in its OWN loudest octave,
 *                           and its margin over each piece's p90 level in that
 *                           octave — the masking question a broadband number
 *                           cannot answer.
 *   MEASURED_MUSIC_GAIN     MUSIC_GAIN as it stood for this render.
 *   MEASURED_MUSIC_EQ       MUSIC_EQ as it stood for this render.
 *   MEASURED_TRIM_DB        MIX_DB as it stood for this render.
 *   MEASURED_HERO_CLIP_GAIN HERO_CLIPS gains, one per variant, as rendered.
 *
 * Regeneration procedure: docs/AUDIO-MIX.md.
 */
import type { MusicState, SoundId } from '../../../src/app/audio/SoundEngine';

export const MEASURED_AT = '2026-10-02';
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
  /** Which music state's pool the piece is in. */
  readonly state: MusicState;
  /**
   * 300ms-window RMS through the chain at MUSIC_GAIN (so after the music-bus
   * EQ), over the piece's body (entryS → handoffS), dBFS.
   */
  readonly medianDb: number;
  readonly p90Db: number;
  readonly maxDb: number;
  readonly peakDb: number;
  /**
   * Octave levels (63 125 250 500 1k 2k 4k 8k Hz), dBFS on the same axis — the
   * 90th percentile over ~340ms frames: the piece's LOUD moments per octave.
   */
  readonly bandsDb: readonly number[];
  /** Linear % of energy below 150Hz in the file, before the bus EQ. */
  readonly lowPctFile: number;
  /** The same through the chain, after the bus EQ. */
  readonly lowPctBus: number;
  /** Linear % of energy in 1–4kHz through the chain. */
  readonly presencePctBus: number;
}

export interface MaskLevels {
  /** Centre of the cue's loudest octave. */
  readonly octaveHz: number;
  /** The cue's level in that octave at its loudest 300ms, dBFS. */
  readonly cueBandDb: number;
  /** cue − piece in that octave (the piece's p90), dB, per piece. */
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
  'lobby-antechamber-waltz': { state: 'lobby', medianDb: -43.03, p90Db: -39.85, maxDb: -35.39, peakDb: -23.9, lowPctFile: 1.2, lowPctBus: 0.6, presencePctBus: 8.2, bandsDb: [-81.03, -53.34, -41.97, -45.35, -47.11, -52.95, -59.95, -63.53] },
  'lobby-petitioners-bench': { state: 'lobby', medianDb: -50.1, p90Db: -39.46, maxDb: -33.5, peakDb: -22.01, lowPctFile: 0.9, lowPctBus: 0.3, presencePctBus: 0.3, bandsDb: [-73.12, -64.22, -40.1, -47.13, -57.78, -70.86, -81.38, -85.49] },
  'court-whispering-gallery': { state: 'court', medianDb: -45.28, p90Db: -37.53, maxDb: -35.24, peakDb: -21.94, lowPctFile: 9, lowPctBus: 5.9, presencePctBus: 1.7, bandsDb: [-75.97, -48.97, -42.24, -40, -48.6, -61.32, -74.96, -78.31] },
  'court-ministry-minuet': { state: 'court', medianDb: -43.21, p90Db: -41.46, maxDb: -38.96, peakDb: -27.64, lowPctFile: 1.1, lowPctBus: 0.6, presencePctBus: 11.1, bandsDb: [-81.63, -55.92, -44.44, -45.19, -51.17, -51.41, -56.58, -57.31] },
  'court-ledger-and-quill': { state: 'court', medianDb: -43.46, p90Db: -40.02, maxDb: -37.95, peakDb: -23.37, lowPctFile: 11.8, lowPctBus: 3.9, presencePctBus: 15.1, bandsDb: [-57.92, -52.41, -42.99, -46.24, -45.66, -52.81, -65.84, -74.1] },
  'court-velvet-procession': { state: 'court', medianDb: -43.71, p90Db: -39.33, maxDb: -35.51, peakDb: -24.2, lowPctFile: 0.9, lowPctBus: 0.6, presencePctBus: 12.3, bandsDb: [-88.89, -55.11, -42.24, -45.1, -48.27, -49.59, -58.79, -64.32] },
  'tension-counting-house': { state: 'tension', medianDb: -42.74, p90Db: -39.81, maxDb: -37.22, peakDb: -25.63, lowPctFile: 0.1, lowPctBus: 0, presencePctBus: 15.6, bandsDb: [-90.59, -72.29, -44.09, -44.33, -46.48, -49.48, -58.49, -69.91] },
  'tension-quiet-knife': { state: 'tension', medianDb: -43.8, p90Db: -43.43, maxDb: -43.04, peakDb: -25.34, lowPctFile: 0.2, lowPctBus: 0.1, presencePctBus: 36.8, bandsDb: [-90.5, -70.46, -48.68, -49.57, -48.96, -49.63, -55.03, -61.22] },
  'duel-two-chairs-remain': { state: 'duel', medianDb: -41.61, p90Db: -38.84, maxDb: -36.15, peakDb: -21.97, lowPctFile: 27, lowPctBus: 12.6, presencePctBus: 3.9, bandsDb: [-54.08, -45.46, -40.79, -46.6, -50.59, -55.32, -66.58, -78.96] },
  'duel-audience-of-one': { state: 'duel', medianDb: -42.37, p90Db: -39.95, maxDb: -38.39, peakDb: -23.96, lowPctFile: 23.9, lowPctBus: 11.4, presencePctBus: 16.6, bandsDb: [-56.25, -47.11, -45.87, -45.1, -47.26, -49.83, -53.56, -57.05] },
  'duel-crossed-signets': { state: 'duel', medianDb: -40.96, p90Db: -38.13, maxDb: -35, peakDb: -22.74, lowPctFile: 0.5, lowPctBus: 0.3, presencePctBus: 8.5, bandsDb: [-89.19, -61.64, -43.41, -40.35, -46.82, -49.22, -57.09, -70.03] },
  'sudden-death-one-card-each': { state: 'sudden_death', medianDb: -43.56, p90Db: -38.58, maxDb: -33.78, peakDb: -21.42, lowPctFile: 35.5, lowPctBus: 16.3, presencePctBus: 11.9, bandsDb: [-52.1, -45.09, -44.53, -44.79, -46.4, -50.28, -58.34, -64.95] },
  'sudden-death-final-wager': { state: 'sudden_death', medianDb: -41.86, p90Db: -38.6, maxDb: -34.61, peakDb: -21.87, lowPctFile: 23.4, lowPctBus: 9.7, presencePctBus: 11.7, bandsDb: [-53.46, -46.07, -44.93, -42.87, -47.49, -49.97, -57.61, -60.78] },
  'fallen-from-the-gallery': { state: 'fallen', medianDb: -49.44, p90Db: -38.55, maxDb: -35.04, peakDb: -26.17, lowPctFile: 0, lowPctBus: 0, presencePctBus: 0.7, bandsDb: [-92.69, -72.08, -38.95, -47.74, -63.99, -60.48, -77.78, -79.17] },
  'fallen-after-the-verdict': { state: 'fallen', medianDb: -46.25, p90Db: -38.05, maxDb: -33.19, peakDb: -21.99, lowPctFile: 1.9, lowPctBus: 1.1, presencePctBus: 7.6, bandsDb: [-77.98, -54.53, -43.19, -40.07, -51.16, -63.23, -75.86, -85.78] },
};

export const MEASURED_MASKING: Readonly<Record<SoundId, MaskLevels>> = {
  yourTurn: {
    octaveHz: 1000,
    cueBandDb: -35.35,
    margins: {
      'lobby-antechamber-waltz': 11.76,
      'lobby-petitioners-bench': 22.43,
      'court-whispering-gallery': 13.25,
      'court-ministry-minuet': 15.82,
      'court-ledger-and-quill': 10.31,
      'court-velvet-procession': 12.92,
      'tension-counting-house': 11.13,
      'tension-quiet-knife': 13.61,
      'duel-two-chairs-remain': 15.24,
      'duel-audience-of-one': 11.91,
      'duel-crossed-signets': 11.47,
      'sudden-death-one-card-each': 11.05,
      'sudden-death-final-wager': 12.14,
      'fallen-from-the-gallery': 28.64,
      'fallen-after-the-verdict': 15.81,
    },
  },
  actionDeclared: {
    octaveHz: 2000,
    cueBandDb: -35.16,
    margins: {
      'lobby-antechamber-waltz': 17.79,
      'lobby-petitioners-bench': 35.7,
      'court-whispering-gallery': 26.16,
      'court-ministry-minuet': 16.25,
      'court-ledger-and-quill': 17.65,
      'court-velvet-procession': 14.43,
      'tension-counting-house': 14.32,
      'tension-quiet-knife': 14.47,
      'duel-two-chairs-remain': 20.16,
      'duel-audience-of-one': 14.67,
      'duel-crossed-signets': 14.06,
      'sudden-death-one-card-each': 15.12,
      'sudden-death-final-wager': 14.81,
      'fallen-from-the-gallery': 25.32,
      'fallen-after-the-verdict': 28.07,
    },
  },
  coup: {
    octaveHz: 125,
    cueBandDb: -25.87,
    margins: {
      'lobby-antechamber-waltz': 27.47,
      'lobby-petitioners-bench': 38.35,
      'court-whispering-gallery': 23.1,
      'court-ministry-minuet': 30.05,
      'court-ledger-and-quill': 26.54,
      'court-velvet-procession': 29.24,
      'tension-counting-house': 46.42,
      'tension-quiet-knife': 44.59,
      'duel-two-chairs-remain': 19.59,
      'duel-audience-of-one': 21.24,
      'duel-crossed-signets': 35.77,
      'sudden-death-one-card-each': 19.22,
      'sudden-death-final-wager': 20.2,
      'fallen-from-the-gallery': 46.21,
      'fallen-after-the-verdict': 28.66,
    },
  },
  challengeWindow: {
    octaveHz: 2000,
    cueBandDb: -39.6,
    margins: {
      'lobby-antechamber-waltz': 13.35,
      'lobby-petitioners-bench': 31.26,
      'court-whispering-gallery': 21.72,
      'court-ministry-minuet': 11.81,
      'court-ledger-and-quill': 13.21,
      'court-velvet-procession': 9.99,
      'tension-counting-house': 9.88,
      'tension-quiet-knife': 10.03,
      'duel-two-chairs-remain': 15.72,
      'duel-audience-of-one': 10.23,
      'duel-crossed-signets': 9.62,
      'sudden-death-one-card-each': 10.68,
      'sudden-death-final-wager': 10.37,
      'fallen-from-the-gallery': 20.88,
      'fallen-after-the-verdict': 23.63,
    },
  },
  blockOpportunity: {
    octaveHz: 8000,
    cueBandDb: -35.39,
    margins: {
      'lobby-antechamber-waltz': 28.14,
      'lobby-petitioners-bench': 50.1,
      'court-whispering-gallery': 42.92,
      'court-ministry-minuet': 21.92,
      'court-ledger-and-quill': 38.71,
      'court-velvet-procession': 28.93,
      'tension-counting-house': 34.52,
      'tension-quiet-knife': 25.83,
      'duel-two-chairs-remain': 43.57,
      'duel-audience-of-one': 21.66,
      'duel-crossed-signets': 34.64,
      'sudden-death-one-card-each': 29.56,
      'sudden-death-final-wager': 25.39,
      'fallen-from-the-gallery': 43.78,
      'fallen-after-the-verdict': 50.39,
    },
  },
  assassinationAlert: {
    octaveHz: 8000,
    cueBandDb: -25.57,
    margins: {
      'lobby-antechamber-waltz': 37.96,
      'lobby-petitioners-bench': 59.92,
      'court-whispering-gallery': 52.74,
      'court-ministry-minuet': 31.74,
      'court-ledger-and-quill': 48.53,
      'court-velvet-procession': 38.75,
      'tension-counting-house': 44.34,
      'tension-quiet-knife': 35.65,
      'duel-two-chairs-remain': 53.39,
      'duel-audience-of-one': 31.48,
      'duel-crossed-signets': 44.46,
      'sudden-death-one-card-each': 39.38,
      'sudden-death-final-wager': 35.21,
      'fallen-from-the-gallery': 53.6,
      'fallen-after-the-verdict': 60.21,
    },
  },
  block: {
    octaveHz: 63,
    cueBandDb: -24.11,
    margins: {
      'lobby-antechamber-waltz': 56.92,
      'lobby-petitioners-bench': 49.01,
      'court-whispering-gallery': 51.86,
      'court-ministry-minuet': 57.52,
      'court-ledger-and-quill': 33.81,
      'court-velvet-procession': 64.78,
      'tension-counting-house': 66.48,
      'tension-quiet-knife': 66.39,
      'duel-two-chairs-remain': 29.97,
      'duel-audience-of-one': 32.14,
      'duel-crossed-signets': 65.08,
      'sudden-death-one-card-each': 27.99,
      'sudden-death-final-wager': 29.35,
      'fallen-from-the-gallery': 68.58,
      'fallen-after-the-verdict': 53.87,
    },
  },
  influenceLoss: {
    octaveHz: 8000,
    cueBandDb: -21.87,
    margins: {
      'lobby-antechamber-waltz': 41.66,
      'lobby-petitioners-bench': 63.62,
      'court-whispering-gallery': 56.44,
      'court-ministry-minuet': 35.44,
      'court-ledger-and-quill': 52.23,
      'court-velvet-procession': 42.45,
      'tension-counting-house': 48.04,
      'tension-quiet-knife': 39.35,
      'duel-two-chairs-remain': 57.09,
      'duel-audience-of-one': 35.18,
      'duel-crossed-signets': 48.16,
      'sudden-death-one-card-each': 43.08,
      'sudden-death-final-wager': 38.91,
      'fallen-from-the-gallery': 57.3,
      'fallen-after-the-verdict': 63.91,
    },
  },
  challengeRevealSuccess: {
    octaveHz: 500,
    cueBandDb: -25.17,
    margins: {
      'lobby-antechamber-waltz': 20.18,
      'lobby-petitioners-bench': 21.96,
      'court-whispering-gallery': 14.83,
      'court-ministry-minuet': 20.02,
      'court-ledger-and-quill': 21.07,
      'court-velvet-procession': 19.93,
      'tension-counting-house': 19.16,
      'tension-quiet-knife': 24.4,
      'duel-two-chairs-remain': 21.43,
      'duel-audience-of-one': 19.93,
      'duel-crossed-signets': 15.18,
      'sudden-death-one-card-each': 19.62,
      'sudden-death-final-wager': 17.7,
      'fallen-from-the-gallery': 22.57,
      'fallen-after-the-verdict': 14.9,
    },
  },
  challengeRevealFail: {
    octaveHz: 125,
    cueBandDb: -19.63,
    margins: {
      'lobby-antechamber-waltz': 33.71,
      'lobby-petitioners-bench': 44.59,
      'court-whispering-gallery': 29.34,
      'court-ministry-minuet': 36.29,
      'court-ledger-and-quill': 32.78,
      'court-velvet-procession': 35.48,
      'tension-counting-house': 52.66,
      'tension-quiet-knife': 50.83,
      'duel-two-chairs-remain': 25.83,
      'duel-audience-of-one': 27.48,
      'duel-crossed-signets': 42.01,
      'sudden-death-one-card-each': 25.46,
      'sudden-death-final-wager': 26.44,
      'fallen-from-the-gallery': 52.45,
      'fallen-after-the-verdict': 34.9,
    },
  },
  coinsGained: {
    octaveHz: 2000,
    cueBandDb: -25.72,
    margins: {
      'lobby-antechamber-waltz': 27.23,
      'lobby-petitioners-bench': 45.14,
      'court-whispering-gallery': 35.6,
      'court-ministry-minuet': 25.69,
      'court-ledger-and-quill': 27.09,
      'court-velvet-procession': 23.87,
      'tension-counting-house': 23.76,
      'tension-quiet-knife': 23.91,
      'duel-two-chairs-remain': 29.6,
      'duel-audience-of-one': 24.11,
      'duel-crossed-signets': 23.5,
      'sudden-death-one-card-each': 24.56,
      'sudden-death-final-wager': 24.25,
      'fallen-from-the-gallery': 34.76,
      'fallen-after-the-verdict': 37.51,
    },
  },
  coinsLost: {
    octaveHz: 2000,
    cueBandDb: -29.95,
    margins: {
      'lobby-antechamber-waltz': 23,
      'lobby-petitioners-bench': 40.91,
      'court-whispering-gallery': 31.37,
      'court-ministry-minuet': 21.46,
      'court-ledger-and-quill': 22.86,
      'court-velvet-procession': 19.64,
      'tension-counting-house': 19.53,
      'tension-quiet-knife': 19.68,
      'duel-two-chairs-remain': 25.37,
      'duel-audience-of-one': 19.88,
      'duel-crossed-signets': 19.27,
      'sudden-death-one-card-each': 20.33,
      'sudden-death-final-wager': 20.02,
      'fallen-from-the-gallery': 30.53,
      'fallen-after-the-verdict': 33.28,
    },
  },
  timerWarning: {
    octaveHz: 2000,
    cueBandDb: -35.63,
    margins: {
      'lobby-antechamber-waltz': 17.32,
      'lobby-petitioners-bench': 35.23,
      'court-whispering-gallery': 25.69,
      'court-ministry-minuet': 15.78,
      'court-ledger-and-quill': 17.18,
      'court-velvet-procession': 13.96,
      'tension-counting-house': 13.85,
      'tension-quiet-knife': 14,
      'duel-two-chairs-remain': 19.69,
      'duel-audience-of-one': 14.2,
      'duel-crossed-signets': 13.59,
      'sudden-death-one-card-each': 14.65,
      'sudden-death-final-wager': 14.34,
      'fallen-from-the-gallery': 24.85,
      'fallen-after-the-verdict': 27.6,
    },
  },
  denied: {
    octaveHz: 500,
    cueBandDb: -37.17,
    margins: {
      'lobby-antechamber-waltz': 8.18,
      'lobby-petitioners-bench': 9.96,
      'court-whispering-gallery': 2.83,
      'court-ministry-minuet': 8.02,
      'court-ledger-and-quill': 9.07,
      'court-velvet-procession': 7.93,
      'tension-counting-house': 7.16,
      'tension-quiet-knife': 12.4,
      'duel-two-chairs-remain': 9.43,
      'duel-audience-of-one': 7.93,
      'duel-crossed-signets': 3.18,
      'sudden-death-one-card-each': 7.62,
      'sudden-death-final-wager': 5.7,
      'fallen-from-the-gallery': 10.57,
      'fallen-after-the-verdict': 2.9,
    },
  },
  gameOverWin: {
    octaveHz: 500,
    cueBandDb: -20.39,
    margins: {
      'lobby-antechamber-waltz': 24.96,
      'lobby-petitioners-bench': 26.74,
      'court-whispering-gallery': 19.61,
      'court-ministry-minuet': 24.8,
      'court-ledger-and-quill': 25.85,
      'court-velvet-procession': 24.71,
      'tension-counting-house': 23.94,
      'tension-quiet-knife': 29.18,
      'duel-two-chairs-remain': 26.21,
      'duel-audience-of-one': 24.71,
      'duel-crossed-signets': 19.96,
      'sudden-death-one-card-each': 24.4,
      'sudden-death-final-wager': 22.48,
      'fallen-from-the-gallery': 27.35,
      'fallen-after-the-verdict': 19.68,
    },
  },
  gameOverLose: {
    octaveHz: 125,
    cueBandDb: -18.01,
    margins: {
      'lobby-antechamber-waltz': 35.33,
      'lobby-petitioners-bench': 46.21,
      'court-whispering-gallery': 30.96,
      'court-ministry-minuet': 37.91,
      'court-ledger-and-quill': 34.4,
      'court-velvet-procession': 37.1,
      'tension-counting-house': 54.28,
      'tension-quiet-knife': 52.45,
      'duel-two-chairs-remain': 27.45,
      'duel-audience-of-one': 29.1,
      'duel-crossed-signets': 43.63,
      'sudden-death-one-card-each': 27.08,
      'sudden-death-final-wager': 28.06,
      'fallen-from-the-gallery': 54.07,
      'fallen-after-the-verdict': 36.52,
    },
  },
  playerEliminated: {
    octaveHz: 500,
    cueBandDb: -18.37,
    margins: {
      'lobby-antechamber-waltz': 26.98,
      'lobby-petitioners-bench': 28.76,
      'court-whispering-gallery': 21.63,
      'court-ministry-minuet': 26.82,
      'court-ledger-and-quill': 27.87,
      'court-velvet-procession': 26.73,
      'tension-counting-house': 25.96,
      'tension-quiet-knife': 31.2,
      'duel-two-chairs-remain': 28.23,
      'duel-audience-of-one': 26.73,
      'duel-crossed-signets': 21.98,
      'sudden-death-one-card-each': 26.42,
      'sudden-death-final-wager': 24.5,
      'fallen-from-the-gallery': 29.37,
      'fallen-after-the-verdict': 21.7,
    },
  },
  exchange: {
    octaveHz: 8000,
    cueBandDb: -28.07,
    margins: {
      'lobby-antechamber-waltz': 35.46,
      'lobby-petitioners-bench': 57.42,
      'court-whispering-gallery': 50.24,
      'court-ministry-minuet': 29.24,
      'court-ledger-and-quill': 46.03,
      'court-velvet-procession': 36.25,
      'tension-counting-house': 41.84,
      'tension-quiet-knife': 33.15,
      'duel-two-chairs-remain': 50.89,
      'duel-audience-of-one': 28.98,
      'duel-crossed-signets': 41.96,
      'sudden-death-one-card-each': 36.88,
      'sudden-death-final-wager': 32.71,
      'fallen-from-the-gallery': 51.1,
      'fallen-after-the-verdict': 57.71,
    },
  },
  cardShuffle: {
    octaveHz: 2000,
    cueBandDb: -34.55,
    margins: {
      'lobby-antechamber-waltz': 18.4,
      'lobby-petitioners-bench': 36.31,
      'court-whispering-gallery': 26.77,
      'court-ministry-minuet': 16.86,
      'court-ledger-and-quill': 18.26,
      'court-velvet-procession': 15.04,
      'tension-counting-house': 14.93,
      'tension-quiet-knife': 15.08,
      'duel-two-chairs-remain': 20.77,
      'duel-audience-of-one': 15.28,
      'duel-crossed-signets': 14.67,
      'sudden-death-one-card-each': 15.73,
      'sudden-death-final-wager': 15.42,
      'fallen-from-the-gallery': 25.93,
      'fallen-after-the-verdict': 28.68,
    },
  },
  cardDeal: {
    octaveHz: 8000,
    cueBandDb: -39.45,
    margins: {
      'lobby-antechamber-waltz': 24.08,
      'lobby-petitioners-bench': 46.04,
      'court-whispering-gallery': 38.86,
      'court-ministry-minuet': 17.86,
      'court-ledger-and-quill': 34.65,
      'court-velvet-procession': 24.87,
      'tension-counting-house': 30.46,
      'tension-quiet-knife': 21.77,
      'duel-two-chairs-remain': 39.51,
      'duel-audience-of-one': 17.6,
      'duel-crossed-signets': 30.58,
      'sudden-death-one-card-each': 25.5,
      'sudden-death-final-wager': 21.33,
      'fallen-from-the-gallery': 39.72,
      'fallen-after-the-verdict': 46.33,
    },
  },
  reaction: {
    octaveHz: 4000,
    cueBandDb: -39.79,
    margins: {
      'lobby-antechamber-waltz': 20.16,
      'lobby-petitioners-bench': 41.59,
      'court-whispering-gallery': 35.17,
      'court-ministry-minuet': 16.79,
      'court-ledger-and-quill': 26.05,
      'court-velvet-procession': 19,
      'tension-counting-house': 18.7,
      'tension-quiet-knife': 15.24,
      'duel-two-chairs-remain': 26.79,
      'duel-audience-of-one': 13.77,
      'duel-crossed-signets': 17.3,
      'sudden-death-one-card-each': 18.55,
      'sudden-death-final-wager': 17.82,
      'fallen-from-the-gallery': 37.99,
      'fallen-after-the-verdict': 36.07,
    },
  },
  chatMessage: {
    octaveHz: 1000,
    cueBandDb: -40.19,
    margins: {
      'lobby-antechamber-waltz': 6.92,
      'lobby-petitioners-bench': 17.59,
      'court-whispering-gallery': 8.41,
      'court-ministry-minuet': 10.98,
      'court-ledger-and-quill': 5.47,
      'court-velvet-procession': 8.08,
      'tension-counting-house': 6.29,
      'tension-quiet-knife': 8.77,
      'duel-two-chairs-remain': 10.4,
      'duel-audience-of-one': 7.07,
      'duel-crossed-signets': 6.63,
      'sudden-death-one-card-each': 6.21,
      'sudden-death-final-wager': 7.3,
      'fallen-from-the-gallery': 23.8,
      'fallen-after-the-verdict': 10.97,
    },
  },
};

export const MEASURED_MUSIC_GAIN = 0.052;

export const MEASURED_MUSIC_EQ = { highpassHz: 110, highpassQ: 0.707, lowShelfHz: 220, lowShelfDb: -5, presenceHz: 3000, presenceDb: -3, presenceQ: 1 };

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
