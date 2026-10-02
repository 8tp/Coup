/* ─────────────────────────────────────────────────────────────────────────────
 * SoundEngine — the graph, the mix, and the voice bank.
 *
 *   sfx voices ─┐
 *               ├→ preMaster → compressor → softClip → master → destination
 *   music → EQ ─┘   (musicGain → highpass → low shelf → presence dip → musicDuck)
 *
 * Nothing in this module constructs an AudioContext at import time. That is
 * structural, not stylistic: this file is imported by React components long
 * before the page has a user gesture, and a module that builds a context on
 * import is exactly how an autoplay violation ships. The context appears on the
 * first getGraph() call, which only happens from unlock() or play().
 *
 * Everything is a silent no-op when the context is null or not running.
 * ────────────────────────────────────────────────────────────────────────── */

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
  | 'denied'
  | 'gameOverWin'
  | 'gameOverLose'
  | 'playerEliminated'
  | 'exchange'
  | 'cardShuffle'
  | 'cardDeal'
  | 'reaction'
  | 'chatMessage';

/** Perspective for a cue. `mine` defaults to true so old call sites are unchanged. */
export interface PlayOptions {
  /** False when the event happened to somebody else — see `makeHead()`. */
  mine?: boolean;
  /** Seeds which side of the stereo field an opponent's cue sits on. */
  playerId?: string;
}

export interface SoundStats {
  peakVoiceLoad: number;
  voiceLoad: number;
  droppedVoices: number;
  /** Must read 0 after a game — see `take()`. */
  droppedPriority: number;
  gatedVoices: number;
  /** Hero cues played as their recording. */
  heroClipVoices: number;
  /** Hero cues that fell back to the synth because the clip was not decoded yet. */
  heroFallbackVoices: number;
}

/* ── music ────────────────────────────────────────────────────────────────── */

/**
 * The adaptive score: a POOL of through-composed pieces per state, not a loop.
 * See docs/AUDIO.md for the pieces, how each was chosen, and the state machine
 * (src/app/hooks/useMusicDirector.ts decides which state; this file plays it).
 *
 *   lobby         home + lobby, after the first gesture unlocks audio
 *   court         ≥3 alive and calm — sly court intrigue
 *   tension       ≥3 alive and someone on their last card, or a Coup affordable
 *   duel          two alive
 *   sudden_death  two alive, both on their last card
 *   fallen        the local player is out and the game goes on
 */
export type MusicState = 'lobby' | 'court' | 'tension' | 'duel' | 'sudden_death' | 'fallen';

export const MUSIC_STATES: readonly MusicState[] = ['lobby', 'court', 'tension', 'duel', 'sudden_death', 'fallen'];

/**
 * One mastered piece. Every time is in seconds from the start of the file and
 * is printed by `scripts/generate-music.ts master` — a property of the file,
 * not a tuning. `entryS`, `leadInS` and `handoffS` sit on the piece's bar grid.
 */
export interface MusicPiece {
  readonly url: string;
  readonly durationS: number;
  /** Where a handoff WITHIN the pool starts this piece: a short run-up of its own. */
  readonly leadInS: number;
  /** Where a STATE CHANGE enters this piece: the bar where its body has arrived. */
  readonly entryS: number;
  /** Where the next piece of the pool starts and this one fades out: just after its final cadence. */
  readonly handoffS: number;
  /** Measured pulse, folded onto the prompt's tempo. Informational. */
  readonly bpm: number;
}

const MUSIC = '/audio/music/';

export const MUSIC_POOLS: Readonly<Record<MusicState, readonly MusicPiece[]>> = {
  lobby: [
    { url: `${MUSIC}lobby-antechamber-waltz.mp3`, durationS: 117.783, leadInS: 0, entryS: 0, handoffS: 105.831, bpm: 80 },
    { url: `${MUSIC}lobby-petitioners-bench.mp3`, durationS: 109.078, leadInS: 0, entryS: 0, handoffS: 103.956, bpm: 72.1 },
  ],
  court: [
    { url: `${MUSIC}court-whispering-gallery.mp3`, durationS: 142.897, leadInS: 0, entryS: 4.003, handoffS: 116.421, bpm: 91.8 },
    { url: `${MUSIC}court-ministry-minuet.mp3`, durationS: 148.497, leadInS: 0, entryS: 1.321, handoffS: 143.426, bpm: 95 },
    { url: `${MUSIC}court-ledger-and-quill.mp3`, durationS: 138.642, leadInS: 3.6, entryS: 13.2, handoffS: 116.4, bpm: 100 },
    { url: `${MUSIC}court-velvet-procession.mp3`, durationS: 133.692, leadInS: 7.163, entryS: 16.637, handoffS: 127.163, bpm: 76 },
  ],
  tension: [
    { url: `${MUSIC}tension-counting-house.mp3`, durationS: 122.648, leadInS: 18.462, entryS: 27.692, handoffS: 110.769, bpm: 104 },
    { url: `${MUSIC}tension-quiet-knife.mp3`, durationS: 108.498, leadInS: 0, entryS: 0, handoffS: 99.793, bpm: 96 },
  ],
  duel: [
    { url: `${MUSIC}duel-two-chairs-remain.mp3`, durationS: 116.683, leadInS: 0, entryS: 6.216, handoffS: 103.993, bpm: 108 },
    { url: `${MUSIC}duel-audience-of-one.mp3`, durationS: 108.578, leadInS: 0, entryS: 0, handoffS: 102.414, bpm: 112 },
    { url: `${MUSIC}duel-crossed-signets.mp3`, durationS: 112.193, leadInS: 10.353, entryS: 18.43, handoffS: 102.661, bpm: 104 },
  ],
  sudden_death: [
    { url: `${MUSIC}sudden-death-one-card-each.mp3`, durationS: 108.378, leadInS: 1.688, entryS: 10.26, handoffS: 102.403, bpm: 112 },
    { url: `${MUSIC}sudden-death-final-wager.mp3`, durationS: 98.699, leadInS: 0, entryS: 8.196, handoffS: 81.529, bpm: 108 },
  ],
  fallen: [
    { url: `${MUSIC}fallen-from-the-gallery.mp3`, durationS: 109.328, leadInS: 0, entryS: 0, handoffS: 101.24, bpm: 72 },
    { url: `${MUSIC}fallen-after-the-verdict.mp3`, durationS: 102.588, leadInS: 0, entryS: 9.241, handoffS: 96.873, bpm: 76 },
  ],
};

/**
 * Integrated loudness each state's pieces are mastered to. Duel and sudden
 * death sit 1.5 LU hotter; the masking gate (tests/app/audio/mix.test.ts)
 * checks that even they leave every cue audible in its own octave.
 */
export const MUSIC_LUFS: Readonly<Record<MusicState, number>> = {
  lobby: -20, court: -20, tension: -20, fallen: -20, duel: -18.5, sudden_death: -18.5,
};

/**
 * The music bus level, before the EQ below. SOLVED, not chosen (2026-10-02,
 * docs/AUDIO-MIX.md "Cue over music"): the highest level at which every cue
 * still clears every in-match piece's LOUD moments (p90) in the cue's own
 * loudest octave — tier 0–3 by 4dB, tier 4 by 2.5dB — with 0.3dB to spare.
 *
 * It went 0.243 → 0.052 (−13.4dB). The old table bed was 72% energy under
 * 150Hz and nearly silent above 500Hz, so it buried nothing in the cue
 * octaves while sitting on top of the whole mix as rumble. The new pieces put
 * their weight where instruments do — 250Hz–2kHz — which is where the chrome
 * cues live too: `denied` (500Hz knock) and `chatMessage` / `yourTurn` (1kHz)
 * are what bind. The gate pins this number to its render (MEASURED_MUSIC_GAIN).
 */
const MUSIC_GAIN = 0.052;

/**
 * The music-bus EQ, on the music path only (musicGain → here → musicDuck):
 *
 *   highpass   100Hz, Q 0.707   — nothing under the card thuds; phones play
 *                                 none of it and headphones made it the mix
 *   low shelf  220Hz, −4dB      — the chest of the low strings, down a step
 *   presence   3kHz, −3dB, Q 1  — a dip where the coin, card and chrome cues
 *                                 put their weight
 *
 * Measured, not assumed: the harness renders every piece through this chain
 * and records its share of energy below 150Hz before and after (AUDIO-MIX.md).
 */
export const MUSIC_EQ = {
  highpassHz: 110,
  highpassQ: 0.707,
  lowShelfHz: 220,
  lowShelfDb: -5,
  presenceHz: 3000,
  presenceDb: -3,
  presenceQ: 1,
} as const;

/** Equal-power crossfade when the STATE changes. Long enough to read as a decision. */
const MUSIC_XFADE_STATE_S = 3;
/** At a handoff within a pool: the outgoing piece's fade (at most) … */
const MUSIC_XFADE_POOL_S = 8;
/** … and the incoming piece's fade-in from its lead-in. */
const MUSIC_FADE_IN_POOL_S = 4;
/** Fetch + decode the next piece of the pool this long before its handoff. */
export const MUSIC_PREFETCH_S = 20;
/**
 * Music is decoded at 32kHz, not the context's 44.1/48kHz: a decoded 150s
 * stereo piece is 38MB of float32 instead of 58MB, and up to three can be
 * resident at once (outgoing, sounding, prefetched). The MP3s are encoded with
 * LAME's ~16–17kHz lowpass, so 32kHz (16kHz Nyquist) loses nothing audible.
 * The harness decodes the same way, so the measurements describe this.
 */
export const MUSIC_DECODE_RATE = 32000;

/**
 * The shuffle bag. `bag` is what is left of the current cycle; when it is
 * empty a new cycle is dealt in random order, and if that order would start
 * with the piece just played it is swapped with another. So a piece never
 * plays twice in a row and every piece in the pool plays once before any
 * plays twice. Pure — `rng` is passed in — so it is tested directly.
 */
export function drawFromBag(
  bag: readonly number[], size: number, last: number | undefined, rng: () => number,
): { pick: number; bag: number[] } {
  let queue = [...bag];
  if (queue.length === 0) {
    queue = Array.from({ length: size }, (_, i) => i);
    for (let i = size - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }
    if (size > 1 && queue[0] === last) {
      const j = 1 + Math.floor(rng() * (size - 1));
      [queue[0], queue[j]] = [queue[j], queue[0]];
    }
  }
  return { pick: queue[0], bag: queue.slice(1) };
}

/* ── hero clips ───────────────────────────────────────────────────────────── */

/** One mastered recording of a cue. `gain` is PRE-TRIM — see HERO_CLIPS. */
export interface HeroClip {
  readonly url: string;
  readonly gain: number;
}

/**
 * Mastered recordings, with the synth voices below as fallbacks when the fetch
 * fails or has not finished. These gains are PRE-TRIM: MIX_DB is applied to the
 * whole voice at the head gain (the single choke point), and this number sets
 * the clip's level RELATIVE TO its synth fallback.
 *
 * ── WHY EVERY GAIN HERE IS MEASURED, NOT CHOSEN ─────────────────────────────
 * A fallback at a different level from the clip it replaces is a bug nobody
 * notices until the fetch fails and the cue arrives 8dB off. Each gain was
 * solved for from the offline render: the clip and its synth land within 0.1dB
 * of each other on 300ms loudness, so the tier ladder the gate measures on the
 * synth bank IS the ladder the player hears from the clips. The shipped-ladder
 * gate in tests/app/audio/mix.test.ts also checks the clips directly.
 *
 * ── VARIANTS ────────────────────────────────────────────────────────────────
 * More than one entry is a round-robin: `play()` picks one at random, never
 * the one it played last. Only the cues a game fires dozens of times have them
 * — coins, the card on the table, the card landing. Each variant has its OWN
 * solved gain, so a variant can never be the loud one.
 *
 * The recordings are ElevenLabs sound-generation output, chosen by analysis and
 * mastered (trimmed to onset, crest-limited, peak-normalised) by
 * scripts/generate-sfx.ts. Re-solve whenever a trim moves — docs/AUDIO-MIX.md.
 */
const SFX = '/audio/sfx/';

const HERO_CLIPS: Partial<Record<SoundId, readonly HeroClip[]>> = {
  // tier 0
  gameOverWin: [{ url: '/audio/court-crowned.mp3', gain: 0.815 }],
  gameOverLose: [{ url: '/audio/plot-unraveled.mp3', gain: 0.557 }],
  playerEliminated: [{ url: `${SFX}playerEliminated.mp3`, gain: 0.36 }],
  // tier 1
  influenceLoss: [{ url: `${SFX}influenceLoss.mp3`, gain: 0.361 }],
  challengeRevealFail: [{ url: `${SFX}challengeRevealFail.mp3`, gain: 0.364 }],
  block: [{ url: `${SFX}block.mp3`, gain: 0.15 }],
  // tier 2
  coup: [{ url: `${SFX}coup.mp3`, gain: 0.989 }],
  challengeRevealSuccess: [{ url: `${SFX}challengeRevealSuccess.mp3`, gain: 0.446 }],
  assassinationAlert: [{ url: `${SFX}assassinationAlert.mp3`, gain: 0.328 }],
  exchange: [{ url: `${SFX}exchange.mp3`, gain: 0.461 }],
  // tier 3 — the round-robin cues
  coinsGained: [
    { url: `${SFX}coinsGained-1.mp3`, gain: 0.2 },
    { url: `${SFX}coinsGained-2.mp3`, gain: 0.201 },
  ],
  coinsLost: [
    { url: `${SFX}coinsLost-1.mp3`, gain: 0.163 },
    { url: `${SFX}coinsLost-2.mp3`, gain: 0.187 },
  ],
  actionDeclared: [
    { url: `${SFX}actionDeclared-1.mp3`, gain: 0.176 },
    { url: `${SFX}actionDeclared-2.mp3`, gain: 0.159 },
    { url: `${SFX}actionDeclared-3.mp3`, gain: 0.196 },
  ],
  cardShuffle: [
    { url: `${SFX}cardShuffle-1.mp3`, gain: 0.173 },
    { url: `${SFX}cardShuffle-2.mp3`, gain: 0.168 },
    { url: `${SFX}cardShuffle-3.mp3`, gain: 0.177 },
  ],
  cardDeal: [{ url: `${SFX}cardDeal.mp3`, gain: 0.149 }],
  // tier 4 — chrome
  yourTurn: [{ url: `${SFX}yourTurn.mp3`, gain: 0.252 }],
  challengeWindow: [{ url: `${SFX}challengeWindow.mp3`, gain: 0.924 }],
  blockOpportunity: [{ url: `${SFX}blockOpportunity.mp3`, gain: 0.708 }],
  timerWarning: [{ url: `${SFX}timerWarning.mp3`, gain: 0.536 }],
  denied: [{ url: `${SFX}denied.mp3`, gain: 0.79 }],
  reaction: [{ url: `${SFX}reaction.mp3`, gain: 0.303 }],
  chatMessage: [{ url: `${SFX}chatMessage.mp3`, gain: 0.46 }],
};

/* ── pure DSP helpers ─────────────────────────────────────────────────────── */

/** AudioParam exponential ramps are undefined at zero; this is "silence". -100dB. */
const EPS = 1e-5;

function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Soft-clip curve for the master safety stage. Identity below `knee`, tanh
 * above it.
 *
 * The bound is the entire point: a WaveShaper clamps its INPUT to [-1,1] before
 * the table lookup, so whatever the mix does the output cannot exceed
 * curve[last] = knee + (1-knee)·tanh(1) = 0.7 + 0.3 × 0.76159 = 0.9285 at knee
 * 0.7 — that is 20·log10(0.9285) = −0.64 dBFS. "No clipping" is therefore a
 * property of the graph rather than an opinion about gain staging above it.
 *
 * `oversample` MUST stay 'none' at the call site: 2x/4x resampling filters ring,
 * and ringing overshoots the table maximum, which is the only thing making the
 * ceiling a bound.
 */
export function softClipCurve(n = 2048, knee = 0.7) {
  const c = new Float32Array(n);
  const span = 1 - knee;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    const a = Math.abs(x);
    const y = a <= knee ? a : knee + span * Math.tanh((a - knee) / span);
    c[i] = x < 0 ? -y : y;
  }
  return c;
}

/** Peak magnitude a `softClipCurve` can emit. 0.9285 at the default knee. */
export function softClipCeiling(knee = 0.7): number {
  return knee + (1 - knee) * Math.tanh(1);
}

/**
 * White noise, in place. Uniform rather than gaussian: for short bandpassed
 * bursts the difference is inaudible and uniform costs one rng draw per sample.
 */
function fillWhite(data: Float32Array, rng: () => number): Float32Array {
  for (let i = 0; i < data.length; i++) data[i] = rng() * 2 - 1;
  return data;
}

/**
 * Pink noise (−3dB/octave), in place. Paul Kellet's economy filter: three
 * one-poles summed. Pink is the right bed for paper and felt — white reads as
 * "hiss", pink reads as "a surface", and every noise in Coup is card stock.
 */
function fillPink(data: Float32Array, rng: () => number): Float32Array {
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let i = 0; i < data.length; i++) {
    const w = rng() * 2 - 1;
    b0 = 0.99765 * b0 + w * 0.0990460;
    b1 = 0.96300 * b1 + w * 0.2965164;
    b2 = 0.57000 * b2 + w * 1.0526913;
    data[i] = (b0 + b1 + b2 + w * 0.1848) * 0.28;
  }
  return data;
}

type NoiseKind = 'white' | 'pink';

/* ── seeded randomness ────────────────────────────────────────────────────── */

function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function sfc32(a: number, b: number, c: number, d: number): () => number {
  return () => {
    a |= 0; b |= 0; c |= 0; d |= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

function makeRng(seed: string): () => number {
  const h = xmur3(seed);
  const rand = sfc32(h(), h(), h(), h());
  for (let i = 0; i < 15; i++) rand();
  return rand;
}

/** Stable [0,1) for a string — used to pick which side an opponent sits on. */
function hash01(key: string): number {
  const h = xmur3(key)();
  return h / 4294967296;
}

/**
 * ── PITCH JITTER ───────────────────────────────────────────────────────────
 * A counter-based hash rather than a bare `Math.random()` call: the sequence is
 * a pure function of `jitterCounter`, so a test can reset the counter and get
 * the same run of detunes twice. `resetJitter()` exists for exactly that.
 *
 * ±2.5% on the fundamental. Coup plays `coinsGained` and `actionDeclared` dozens
 * of times a game, and a byte-identical retrigger is what makes a cue read as a
 * looped click rather than as a thing happening again.
 */
let jitterCounter = 0;

export function resetJitter(seed = 0): void {
  jitterCounter = seed >>> 0;
}

function jitter(amount: number): number {
  jitterCounter = (jitterCounter + 1) >>> 0;
  let h = Math.imul(jitterCounter ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  const u = (h >>> 0) / 4294967296;
  return 1 + (u * 2 - 1) * amount;
}

const JITTER_AMOUNT = 0.025;

/** The cues that repeat often enough to fatigue. One-shot stings stay exact. */
const JITTERED: ReadonlySet<SoundId> = new Set<SoundId>([
  'coinsGained', 'coinsLost', 'actionDeclared', 'cardShuffle', 'cardDeal',
  'reaction', 'chatMessage', 'block', 'denied',
]);

/* ── THE MIX TRIM ─────────────────────────────────────────────────────────────
 *
 * Per-sound level in dB, applied in voiceGain() and NOWHERE else, on a per-sound
 * GainNode sitting between the voice and sfxGain. One choke point, and
 * renderSoundOffline() reads it through the same function, so the offline render
 * and the live mix cannot disagree about what the player hears.
 *
 * It exists because the mix was INVERTED on the moments that matter. The rule
 * the numbers encode: CONSEQUENCE TRACKS LOUDNESS. Every routine sound sits
 * below every loss.
 *
 *   tier 0  the game turned      gameOverWin gameOverLose playerEliminated
 *   tier 1  you lost             influenceLoss challengeRevealFail block
 *   tier 2  a play resolved      coup challengeRevealSuccess assassinationAlert
 *                                exchange
 *   tier 3  cards being handled  cardShuffle actionDeclared coinsGained coinsLost
 *   tier 4  chrome               timerWarning denied chatMessage reaction
 *                                yourTurn blockOpportunity challengeWindow
 *
 * ── MEASURED 2026-10-01 (first pass 2026-08-10) ────────────────────────────
 * These trims are no longer estimates. Every figure below is an offline render
 * of THIS graph — buildGraph() → startVoice() → OfflineAudioContext, 48kHz,
 * Chrome 153 (151 for the first pass — every synth row came back identical to
 * 0.01dB), 1s compressor pre-roll — by tests/app/audio/harness.html. The
 * numbers are committed as data in tests/app/audio/measurements.ts and gated by
 * tests/app/audio/mix.test.ts. Regeneration: docs/AUDIO-MIX.md.
 *
 * "loud" below is the loudest 300ms sliding-window RMS. THAT is the ordering
 * axis, not peak: peak ranks a 150ms noise swish (18dB crest) above a sustained
 * sine (7dB crest) that is plainly louder to a listener, and ranking a mix by
 * peak is the specific mistake this exercise exists to undo. Peak is gated
 * separately — against the ceiling, and for the headline rule that no routine
 * cue may STAB above a loss.
 *
 *   id                      trim dB    peak dBFS   loud dBFS
 *   ─────────────────────── ────────── ─────────── ───────────
 *   gameOverWin (clip)        −2.8       −4.58      −17.08   ┐ tier 0
 *   gameOverWin (synth)       −2.8       −5.63      −17.07   │
 *   gameOverLose (clip)       −5.0       −7.23      −17.02   │
 *   gameOverLose (synth)      −5.0       −8.58      −17.01   │
 *   playerEliminated          −3.0      −10.46      −17.04   ┘
 *   influenceLoss             −1.9      −11.86      −18.97   ┐ tier 1
 *   challengeRevealFail       −2.1      −10.46      −18.99   │
 *   block                     +5.6       −4.13      −21.13   ┘
 *   exchange                  −4.3      −10.18      −23.05   ┐ tier 2
 *   assassinationAlert        −2.3      −12.75      −23.00   │
 *   coup                     −12.9      −13.08      −22.97   │
 *   challengeRevealSuccess    −5.6      −13.80      −22.97   ┘
 *   coinsGained               −0.7      −14.20      −24.97   ┐ tier 3
 *   coinsLost                 −0.4      −14.00      −26.42   │
 *   actionDeclared            −0.3      −13.93      −29.06   │
 *   cardDeal                  +0.7      −13.66      −32.53   │
 *   cardShuffle               +1.2      −14.01      −32.58   ┘
 *   timerWarning              −9.4      −21.67      −34.56   ┐ tier 4
 *   chatMessage               −7.4      −22.85      −34.57   │
 *   reaction                  −7.6      −21.13      −34.60   │
 *   yourTurn                 −15.9      −25.89      −34.60   │
 *   challengeWindow          −13.7      −24.10      −34.61   │
 *   blockOpportunity         −11.2      −26.92      −34.64   │
 *   denied                   −12.0      −21.56      −34.64   ┘
 *
 * Tier boundaries on loudness, quietest-above minus loudest-below:
 *   synth bank   0/1 = 1.90dB   1/2 = 1.84dB   2/3 = 1.92dB   3/4 = 1.98dB
 *   as shipped   0/1 = 1.88dB   1/2 = 1.85dB   2/3 = 1.89dB   3/4 = 1.99dB
 * ("as shipped" is every cue as its clip variants — HERO_CLIPS above; the
 * rows in this table are the synth fallbacks, which the clips are solved onto).
 * The headline rule on peak: the quietest loss (influenceLoss, −11.86) stabs
 * 1.80dB above the hottest routine cue (cardDeal, −13.66); as shipped, the
 * quietest loss clip (playerEliminated, −7.77) stabs 1.89dB above the hottest
 * routine clip (coinsLost variant 2, −9.66). Routine clips are crest-limited
 * in mastering for exactly this — scripts/generate-sfx.ts `crestDb`.
 *
 * `denied` was added in the 2026-08-10 pass and the whole bank was re-rendered
 * with it; every other figure above came back byte-identical. It was solved
 * onto the FLOOR of tier 4 rather than into the middle of it, because tier 4
 * tops out at −34.56 and the 3/4 margin is only 1.98dB — a new chrome cue that
 * landed above `timerWarning` would eat the boundary. −12.0 puts it level with
 * `blockOpportunity`, so the margin is exactly what it was. No other trim moved.
 *
 * `cardDeal` (2026-10-01) went in at the FLOOR of tier 3 for the same reason:
 * +0.7 puts it level with `cardShuffle`, so the 3/4 margin did not move, and
 * its synth peak (−13.66) still sits 1.80dB under the quietest loss. Again no
 * other trim moved — the clips were solved onto the trims, not the reverse.
 *
 * ── WHAT WAS ACTUALLY WRONG ─────────────────────────────────────────────────
 * The previous trims were hand-derived from summed oscillator gains. Measured,
 * three of the four tier boundaries were INVERTED — 0/1 by 5.64dB, 1/2 by
 * 7.82dB, 3/4 by 8.84dB — and five cues were riding 3–5dB of limiting, which
 * meant the compressor, not MIX_DB, was setting their level. The single worst
 * offender was `yourTurn`, tier 4 chrome, sitting 8.8dB LOUDER than `cardShuffle`
 * and only 1.3dB under a lost influence.
 *
 * ── STILL UNMEASURED ────────────────────────────────────────────────────────
 *  • (Measured since 2026-10-01: cue vs music; re-measured 2026-10-02 for
 *    the adaptive score. In its own loudest octave every cue clears every
 *    in-match piece's LOUD moments (p90) — the thinnest is `denied`, 2.83dB
 *    over court-whispering-gallery at 500Hz, which is what MUSIC_GAIN is
 *    solved against — and every piece's p90 sits ≥5dB under the quietest
 *    tier-3 cue. Gated in mix.test.ts; MEASURED_MASKING, MEASURED_BEDS.)
 *  • Perceptual weighting. The ladder is unweighted RMS. A 6kHz card tear and
 *    a 120Hz timpani at the same "loud" are not equally loud to a listener —
 *    K-weighting would put the tear ~4dB up. The tiers are 1.8–2dB apart, so
 *    on a weighted axis some neighbours could swap; not measured.
 *  • The mine/theirs treatment (−6dB + 5.2kHz lowpass + pan) is rendered only in
 *    the `mine` form. THEIRS_DB is a flat offset on the same head, so it moves
 *    the whole ladder together, but the lowpass's effect on loudness is not
 *    in the table.
 *  • Pitch jitter (±2.5%) is rendered at the nominal pitch.
 *  • The flam ladder (FLAM_DB) is rendered at run 0 only. The `denied x2 @90ms`
 *    pair renders BOTH taps at run 0, so it bounds the real double-tap (whose
 *    second tap is flammed to −2.5dB) rather than describing it.
 *  • Safari and Firefox. Their DynamicsCompressor makeup gain is not Chrome's,
 *    so the absolute dBFS figures are Chrome's. The ORDERING is a property of
 *    the trims and should survive; that has not been checked.
 */
const MIX_DB: Record<SoundId, number> = {
  // tier 0 — the game turned
  gameOverWin: -2.8,
  gameOverLose: -5,
  playerEliminated: -3,
  // tier 1 — you lost
  challengeRevealFail: -2.1,
  influenceLoss: -1.9,
  block: 5.6,
  // tier 2 — a play resolved
  assassinationAlert: -2.3,
  coup: -12.9,
  challengeRevealSuccess: -5.6,
  exchange: -4.3,
  // tier 3 — cards being handled. Down, all of it.
  cardShuffle: 1.2,
  cardDeal: 0.7,
  actionDeclared: -0.3,
  coinsGained: -0.7,
  coinsLost: -0.4,
  // tier 4 — chrome. A HUD countdown must never outrank a lost influence.
  yourTurn: -15.9,
  challengeWindow: -13.7,
  blockOpportunity: -11.2,
  timerWarning: -9.4,
  denied: -12,
  reaction: -7.6,
  chatMessage: -7.4,
};

/**
 * Which tier each cue belongs to. Data, not a comment, because the gate in
 * tests/app/audio/mix.test.ts asserts the ordering tier by tier — and a tier
 * that lived only in a comment could not be wrong in a way a test could catch.
 * Moving a cue between tiers is a change to THIS table.
 */
export type MixTier = 0 | 1 | 2 | 3 | 4;

const MIX_TIER: Record<SoundId, MixTier> = {
  gameOverWin: 0,
  gameOverLose: 0,
  playerEliminated: 0,
  challengeRevealFail: 1,
  influenceLoss: 1,
  block: 1,
  assassinationAlert: 2,
  coup: 2,
  challengeRevealSuccess: 2,
  exchange: 2,
  cardShuffle: 3,
  cardDeal: 3,
  actionDeclared: 3,
  coinsGained: 3,
  coinsLost: 3,
  yourTurn: 4,
  challengeWindow: 4,
  blockOpportunity: 4,
  timerWarning: 4,
  denied: 4,
  reaction: 4,
  chatMessage: 4,
};

/* ── the voice budget ─────────────────────────────────────────────────────── */

interface VoiceSpec {
  /** Scheduled tail in seconds — how long this voice occupies its budget slot. */
  tail: number;
  /** A "voice" is one envelope, not one node: gameOverWin is 8, a coin tick is 1. */
  weight: number;
  /** Priority voices bypass MAX_VOICES and duck the music. */
  priority: boolean;
}

/**
 * Hard ceiling on concurrent weighted voices. The worst beat a real Coup game
 * produces is a challenge reveal resolving into an influence loss and an
 * elimination while the deck shuffles — 4 + 4 + 6 + 2 = 16 weighted units.
 * 32 is double that.
 */
const MAX_VOICES = 32;

/**
 * Priority voices bypass MAX_VOICES because a win sting dropped for budget
 * reasons is a bug the player cannot un-hear. They do not bypass THIS, which is
 * only here so a pathological loop cannot build the graph without limit.
 *
 * The flag covers tier 0–2 — every once-per-event sting — rather than tier 0
 * alone. A lost influence dropped for budget is the same bug at a smaller
 * scale, and tier 3–4 (the coin ticks, the card handling, the chrome) is the
 * only layer that can actually produce enough voices to need governing. So the
 * 32-unit cap is, in practice, a cap on the routine layer, and 32 units of
 * routine noise can never be the reason a consequence goes unheard.
 */
const MAX_VOICES_PRIORITY = 64;

/**
 * `tail` is the LONGER of the synth voice and its longest hero clip — the
 * budget has to describe what is actually sounding, and since the clips landed
 * that is usually the recording. The gate checks every routine cue's tail
 * covers its clips (tests/app/audio/mix.test.ts). The two mastered stingers
 * keep their synth-length tails: they are priority, and the priority cap only
 * guards against a runaway loop.
 */
const VOICE: Record<SoundId, VoiceSpec> = {
  gameOverWin: { tail: 1.30, weight: 8, priority: true },
  gameOverLose: { tail: 1.85, weight: 8, priority: true },
  playerEliminated: { tail: 1.50, weight: 6, priority: true },
  influenceLoss: { tail: 0.56, weight: 4, priority: true },
  challengeRevealFail: { tail: 0.78, weight: 4, priority: true },
  challengeRevealSuccess: { tail: 0.70, weight: 4, priority: true },
  coup: { tail: 0.67, weight: 4, priority: true },
  block: { tail: 0.45, weight: 3, priority: true },
  assassinationAlert: { tail: 0.51, weight: 3, priority: true },
  exchange: { tail: 0.72, weight: 2, priority: true },
  cardShuffle: { tail: 0.26, weight: 2, priority: false },
  cardDeal: { tail: 1.00, weight: 2, priority: false },
  challengeWindow: { tail: 0.35, weight: 2, priority: false },
  yourTurn: { tail: 0.58, weight: 2, priority: false },
  actionDeclared: { tail: 0.26, weight: 1, priority: false },
  coinsGained: { tail: 0.42, weight: 1, priority: false },
  coinsLost: { tail: 0.28, weight: 1, priority: false },
  blockOpportunity: { tail: 0.27, weight: 1, priority: false },
  timerWarning: { tail: 0.12, weight: 1, priority: false },
  denied: { tail: 0.12, weight: 1, priority: false },
  reaction: { tail: 0.30, weight: 1, priority: false },
  chatMessage: { tail: 0.17, weight: 1, priority: false },
};

/**
 * Which cues step the music back. Tier 0 and tier 1, plus `coup` — the one tier
 * 2 event that is always a turn's whole point.
 *
 * The music yields to MEANING, not to activity. `challengeWindow` and the coin
 * ticks used to duck and no longer do: a cue that fires every few seconds
 * ducking the bed every few seconds is not sidechaining, it is a pumping bed.
 */
const DUCKS: ReadonlySet<SoundId> = new Set<SoundId>([
  'gameOverWin', 'gameOverLose', 'playerEliminated',
  'influenceLoss', 'challengeRevealFail', 'block',
  'coup',
]);

/**
 * Never more than one instance of the same sound per 80ms. Two identical voices
 * 8ms apart are one voice to a listener and 2x the amplitude to the mix.
 *
 * Priority stings get a much shorter floor: a challenge reveal can resolve into
 * an influence loss and an elimination inside one state broadcast, and dropping
 * the second of those is the same class of bug as dropping it for budget.
 */
const RATE_DEFAULT = 0.08;
const RATE_PRIORITY = 0.03;

/**
 * Retrigger attenuation on the tactile layer, in dB, by how many times this
 * sound has already fired inside FLAM_WINDOW. Attenuation, not deletion: a
 * two-card exchange must read as two cards, not as one card at 2x the
 * amplitude, which is what an unattenuated stack sounds like. Resets after
 * FLAM_WINDOW of silence.
 */
const FLAM_DB = [0, -2.5, -4.5, -6];
const FLAM_WINDOW = 0.19;
const FLAM: ReadonlySet<SoundId> = new Set<SoundId>([
  'cardShuffle', 'actionDeclared', 'coinsGained', 'coinsLost',
  'reaction', 'chatMessage', 'block', 'exchange', 'denied',
]);

/** Other players' cues: −6dB, off-centre, detuned, and lowpassed. See makeHead. */
const THEIRS_DB = -6;
const THEIRS_PAN = 0.34;
const THEIRS_DETUNE = 0.994; // ≈ −10 cents
const THEIRS_LP_HZ = 5200;

/* ── the graph ────────────────────────────────────────────────────────────── */

interface Graph {
  /**
   * `BaseAudioContext`, not `AudioContext`, so the OFFLINE render in
   * `renderSoundOffline()` can be handed the same builder. Everything the graph
   * itself needs (`createGain`, `currentTime`, `state`, `decodeAudioData`) is on
   * the base type; the two AudioContext-only calls the engine makes — `resume()`
   * and nothing else — go through `SoundEngine.liveCtx`.
   */
  ctx: BaseAudioContext;
  master: GainNode;
  preMaster: GainNode;
  sfxGain: GainNode;
  musicGain: GainNode;
  musicDuck: GainNode;
  noise: Record<NoiseKind, AudioBuffer>;
  rng: () => number;
}

/** Per-voice options. `gain` already carries the mix trim, theirs-trim and flam. */
interface VoiceOptions {
  mine: boolean;
  gain: number;
  pan: number;
  /** Frequency multiplier: opponent detune folded together with pitch jitter. */
  pitch: number;
}

/**
 * Noise sample data, cached per (kind, length, sampleRate). Filling two 1.2s
 * buffers is ~115k rng draws; without the cache `noiseBurst` did that on EVERY
 * call, which is both expensive and — because every call got the same
 * deterministic-sounding transient shape at offset zero — the reason repeated
 * cues read as one click looped.
 */
const noiseCache = new Map<string, Float32Array>();

function noiseBuffer(ctx: BaseAudioContext, kind: NoiseKind, seconds: number): AudioBuffer {
  const n = Math.max(1, Math.floor(seconds * ctx.sampleRate));
  const key = `${kind}:${n}:${ctx.sampleRate}`;
  let data = noiseCache.get(key);
  if (!data) {
    const fresh = new Float32Array(n);
    data = kind === 'pink' ? fillPink(fresh, makeRng(key)) : fillWhite(fresh, makeRng(key));
    noiseCache.set(key, data);
  }
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  buf.getChannelData(0).set(data);
  return buf;
}

/**
 * ── THE ONLY PLACE THE MINE/THEIRS TREATMENT LIVES ─────────────────────────
 *
 *   mine   → unity gain, dead centre, unfiltered.
 *   theirs → −6dB (folded into o.gain), pushed to ±0.34 of pan, and a 5.2kHz
 *            lowpass. The detune (o.pitch) is applied by each voice to its own
 *            frequencies via f().
 *
 * The LOWPASS is the part that matters. −6dB alone makes an opponent's cue
 * merely quieter, and a quiet copy of your own sound still competes for the
 * same place in the mix. Rolling off above 5.2kHz removes the transient edge
 * that pulls a sound forward, so it sits BEHIND yours instead — the same reason
 * distance sounds dull in a real room.
 *
 * The filter and panner are only allocated for other players' cues, so the
 * common case costs one GainNode.
 */
/**
 * The whole chain, from one `BaseAudioContext`.
 *
 *   sfx voices ─┐
 *               ├→ preMaster → compressor → softClip → master → destination
 *   music → EQ ─┘   (musicGain → highpass → low shelf → presence dip → musicDuck)
 *
 * ── ONE GRAPH IMPLEMENTATION ────────────────────────────────────────────────
 * This function is the only place the master chain is built. `getGraph()` calls
 * it with a live `AudioContext`; `renderSoundOffline()` calls it with an
 * `OfflineAudioContext`. There is no second chain for the test to measure, so a
 * measurement can never describe a mix the player does not hear.
 *
 * Music routes into the SAME compressor and soft clip as the effects: music that
 * could push the mix past the WaveShaper's table maximum would turn the ceiling
 * back into a mixing opinion instead of a property of the graph.
 */
function buildGraph(ctx: BaseAudioContext, sfxMuted: boolean): Graph {
  const master = ctx.createGain();
  master.gain.value = 1;
  master.connect(ctx.destination);

  const softClip = ctx.createWaveShaper();
  softClip.curve = softClipCurve(2048, 0.7);
  // MUST stay 'none': oversampling filters ring, and ringing overshoots the
  // table maximum, which is the only thing making the ceiling a bound.
  softClip.oversample = 'none';
  softClip.connect(master);

  // −14dB / 12:1 with a 4ms attack: fast enough to catch an elimination landing
  // under a challenge reveal, slow enough not to eat the 2ms card transients
  // that make a snap sound like paper.
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.knee.value = 6;
  comp.ratio.value = 12;
  comp.attack.value = 0.004;
  comp.release.value = 0.16;
  comp.connect(softClip);

  const preMaster = ctx.createGain();
  preMaster.gain.value = 1;
  preMaster.connect(comp);

  const sfxGain = ctx.createGain();
  sfxGain.gain.value = sfxMuted ? 0 : 1;
  sfxGain.connect(preMaster);

  // Two gains for the music on purpose: musicGain carries the level and the
  // fades, musicDuck carries the sidechain. One node doing both means a duck
  // that lands mid-fade-in cancels the fade.
  const musicDuck = ctx.createGain();
  musicDuck.gain.value = 1;
  musicDuck.connect(preMaster);

  // The music-bus EQ (MUSIC_EQ): the bed sits UNDER the game — no sub, less
  // chest, and a dip where the cues live. Music only; the effects are untouched.
  const presence = ctx.createBiquadFilter();
  presence.type = 'peaking';
  presence.frequency.value = MUSIC_EQ.presenceHz;
  presence.Q.value = MUSIC_EQ.presenceQ;
  presence.gain.value = MUSIC_EQ.presenceDb;
  presence.connect(musicDuck);
  const lowShelf = ctx.createBiquadFilter();
  lowShelf.type = 'lowshelf';
  lowShelf.frequency.value = MUSIC_EQ.lowShelfHz;
  lowShelf.gain.value = MUSIC_EQ.lowShelfDb;
  lowShelf.connect(presence);
  const highpass = ctx.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = MUSIC_EQ.highpassHz;
  highpass.Q.value = MUSIC_EQ.highpassQ;
  highpass.connect(lowShelf);

  const musicGain = ctx.createGain();
  musicGain.gain.value = 0;
  musicGain.connect(highpass);

  return {
    ctx,
    master,
    preMaster,
    sfxGain,
    musicGain,
    musicDuck,
    noise: {
      white: noiseBuffer(ctx, 'white', 1.2),
      pink: noiseBuffer(ctx, 'pink', 1.2),
    },
    rng: makeRng('coup-audio-voices'),
  };
}

function makeHead(g: Graph, o: VoiceOptions): GainNode {
  const h = g.ctx.createGain();
  h.gain.value = o.gain;
  if (o.mine) {
    h.connect(g.sfxGain);
    return h;
  }
  const lp = g.ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = THEIRS_LP_HZ;
  lp.Q.value = 0.7;
  const p = g.ctx.createStereoPanner();
  p.pan.value = clamp(o.pan, -1, 1);
  h.connect(lp);
  lp.connect(p);
  p.connect(g.sfxGain);
  return h;
}

/* ── envelope + voice primitives ──────────────────────────────────────────── */

/** A pitched frequency with the opponent detune and jitter applied. */
function f(o: VoiceOptions, hz: number): number {
  return hz * o.pitch;
}

/** Percussive AD envelope. Always ends at a hard 0 so the node can sleep. */
function perc(param: AudioParam, t0: number, peak: number, attack: number, decay: number): void {
  const p = Math.max(peak, EPS * 2);
  param.setValueAtTime(EPS, t0);
  param.exponentialRampToValueAtTime(p, t0 + attack);
  param.exponentialRampToValueAtTime(EPS, t0 + attack + decay);
  param.setValueAtTime(0, t0 + attack + decay);
}

/** Linear attack / exponential release — softer than `perc`, for held notes. */
function swell(
  param: AudioParam, t0: number, peak: number, attack: number, hold: number, release: number,
): void {
  const p = Math.max(peak, EPS * 2);
  param.setValueAtTime(EPS, t0);
  param.linearRampToValueAtTime(p, t0 + attack);
  param.setValueAtTime(p, t0 + attack + hold);
  param.exponentialRampToValueAtTime(EPS, t0 + attack + hold + release);
  param.setValueAtTime(0, t0 + attack + hold + release);
}

/** Exponential glide between two positive values. */
function glide(param: AudioParam, t0: number, from: number, to: number, dur: number): void {
  param.setValueAtTime(Math.max(from, EPS), t0);
  param.exponentialRampToValueAtTime(Math.max(to, EPS), t0 + dur);
}

function osc(
  g: Graph,
  destination: AudioNode,
  t0: number,
  type: OscillatorType,
  freq: number,
  gain: number,
  start: number,
  stop: number,
  freqEnd?: number,
): void {
  const o = g.ctx.createOscillator();
  const gn = g.ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0 + start);
  if (freqEnd !== undefined) {
    o.frequency.linearRampToValueAtTime(freqEnd, t0 + stop);
  }
  gn.gain.setValueAtTime(gain, t0 + start);
  gn.gain.linearRampToValueAtTime(0, t0 + stop);
  o.connect(gn).connect(destination);
  o.start(t0 + start);
  o.stop(t0 + stop + 0.05);
}

/**
 * A slice of the SHARED noise buffer, taken at a seeded random offset. The
 * offset is the whole point: a fixed offset means every burst has the same
 * sample-level transient, and five card sounds in a row become one click
 * repeated five times.
 */
function noiseSource(
  g: Graph, kind: NoiseKind, t0: number, dur: number, rate = 1,
): AudioBufferSourceNode {
  const src = g.ctx.createBufferSource();
  const buf = g.noise[kind];
  src.buffer = buf;
  src.playbackRate.value = rate;
  const maxOffset = Math.max(0, buf.duration - dur * rate - 0.01);
  src.start(t0, g.rng() * maxOffset, dur * rate + 0.01);
  src.stop(t0 + dur + 0.02);
  return src;
}

function noiseBurst(
  g: Graph,
  destination: AudioNode,
  t0: number,
  gain: number,
  start: number,
  duration: number,
  frequency = 3000,
  kind: NoiseKind = 'white',
): void {
  const src = noiseSource(g, kind, t0 + start, duration);
  const bp = g.ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = frequency;
  bp.Q.value = 0.8;
  const gn = g.ctx.createGain();
  gn.gain.setValueAtTime(gain, t0 + start);
  gn.gain.linearRampToValueAtTime(0, t0 + start + duration);
  src.connect(bp).connect(gn).connect(destination);
}

/** A body thump: a sine that falls. Timpani, table knocks, dull impacts. */
function thump(
  g: Graph, destination: AudioNode, t0: number,
  from: number, to: number, amp: number, dur: number,
): void {
  const gn = g.ctx.createGain();
  gn.gain.value = 0;
  const o = g.ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(from, t0);
  glide(o.frequency, t0, from, to, dur * 0.8);
  o.connect(gn).connect(destination);
  perc(gn.gain, t0, amp, 0.004, dur);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

type SoundDefinition = (g: Graph, out: AudioNode, t0: number, o: VoiceOptions) => void;

/**
 * The head gain a voice carries: the mix trim, the theirs trim and the flam
 * attenuation, multiplied. The ONLY place MIX_DB is read.
 *
 * Pulled out of `play()` so `renderSoundOffline()` can apply the identical trim
 * without a second copy of the arithmetic. A measurement that recomputed the
 * trim its own way would be measuring its own opinion of the mix.
 */
function voiceGain(id: SoundId, mine: boolean, flamGain: number): number {
  return dbToGain(MIX_DB[id]) * (mine ? 1 : dbToGain(THEIRS_DB)) * flamGain;
}

/* ── the bank ─────────────────────────────────────────────────────────────── */

const sounds: Record<SoundId, SoundDefinition> = {
  yourTurn(g, out, t0, o) {
    osc(g, out, t0, 'sine', f(o, 523), 0.15, 0, 0.12);
    osc(g, out, t0, 'sine', f(o, 698), 0.15, 0.13, 0.25);
  },

  actionDeclared(g, out, t0, o) {
    osc(g, out, t0, 'triangle', f(o, 900), 0.1, 0, 0.08);
  },

  // Layered low impact with a brief card-snap transient.
  coup(g, out, t0, o) {
    noiseBurst(g, out, t0, 0.16, 0, 0.09, 1100);
    osc(g, out, t0, 'sine', f(o, 130), 0.26, 0, 0.42, f(o, 48));
    osc(g, out, t0, 'triangle', f(o, 72), 0.18, 0.03, 0.62, f(o, 38));
    osc(g, out, t0, 'sine', f(o, 680), 0.07, 0.02, 0.16, f(o, 310));
  },

  // A crisp challenge marker: card snap, rising accusation, low answer.
  challengeWindow(g, out, t0, o) {
    noiseBurst(g, out, t0, 0.08, 0, 0.045, 2200);
    osc(g, out, t0, 'triangle', f(o, 330), 0.11, 0, 0.18, f(o, 660));
    osc(g, out, t0, 'sine', f(o, 165), 0.09, 0.08, 0.3, f(o, 110));
  },

  blockOpportunity(g, out, t0, o) {
    osc(g, out, t0, 'square', f(o, 600), 0.08, 0, 0.1);
    osc(g, out, t0, 'square', f(o, 800), 0.08, 0.12, 0.22);
  },

  assassinationAlert(g, out, t0, o) {
    osc(g, out, t0, 'sawtooth', f(o, 880), 0.15, 0, 0.1);
    osc(g, out, t0, 'sawtooth', f(o, 660), 0.15, 0.12, 0.22);
    osc(g, out, t0, 'sawtooth', f(o, 440), 0.15, 0.24, 0.4);
  },

  block(g, out, t0, o) {
    osc(g, out, t0, 'triangle', f(o, 1200), 0.12, 0, 0.05);
    osc(g, out, t0, 'triangle', f(o, 2400), 0.08, 0, 0.15);
  },

  influenceLoss(g, out, t0, o) {
    osc(g, out, t0, 'sine', f(o, 300), 0.15, 0, 0.35, f(o, 150));
  },

  challengeRevealSuccess(g, out, t0, o) {
    noiseBurst(g, out, t0, 0.065, 0, 0.04, 2600);
    osc(g, out, t0, 'sine', f(o, 392), 0.11, 0, 0.18);
    osc(g, out, t0, 'triangle', f(o, 523), 0.11, 0.11, 0.31);
    osc(g, out, t0, 'sine', f(o, 784), 0.13, 0.23, 0.55);
    osc(g, out, t0, 'sine', f(o, 1568), 0.045, 0.25, 0.65);
  },

  challengeRevealFail(g, out, t0, o) {
    noiseBurst(g, out, t0, 0.08, 0, 0.06, 900);
    osc(g, out, t0, 'sawtooth', f(o, 360), 0.1, 0, 0.24, f(o, 210));
    osc(g, out, t0, 'triangle', f(o, 180), 0.12, 0.13, 0.48, f(o, 82));
    osc(g, out, t0, 'sine', f(o, 92), 0.12, 0.28, 0.72, f(o, 52));
  },

  coinsGained(g, out, t0, o) {
    osc(g, out, t0, 'sine', f(o, 1200), 0.1, 0, 0.15);
  },

  coinsLost(g, out, t0, o) {
    osc(g, out, t0, 'triangle', f(o, 600), 0.1, 0, 0.15);
  },

  timerWarning(g, out, t0, o) {
    osc(g, out, t0, 'square', f(o, 880), 0.12, 0, 0.06);
  },

  /**
   * DENIED — the move was not legal. NOT a loss. That distinction is the whole
   * brief: the cue it replaces (`timerWarning`, standing in) had the right
   * weight and the wrong shape, and the two cues it must never be mistaken for
   * are the two most consequential sounds a player hears about their own cards.
   *
   *   influenceLoss        one bare SINE, 300→150Hz portamento, 346ms
   *   challengeRevealFail  noise + saw 360→210 + tri 180→82 + sine 92→52, 715ms
   *   denied               two SQUARES through a closing lowpass, 320 then 220,
   *                        discrete, 88ms
   *
   * Four separations, each of them measured — see MEASURED_CONTRAST in
   * tests/app/audio/measurements.ts, which is octave-band energy normalised to
   * each cue's own total, so it describes TIMBRE independently of the trim:
   *
   *   1. OVER FAST. 88.1ms of active audio against 346.5 and 714.8 — 3.9x and
   *      8.1x shorter — and every envelope lands on a literal 0. There is no
   *      ring-out sitting in the beat after the tap. A refusal that lingers
   *      reads as damage already done.
   *   2. DISCRETE, NOT GLIDING. Both losses fall by SLIDING, and a pitch that
   *      sags is the sound of something giving way. This falls in two hard
   *      steps with silence between them: 320Hz for 38ms, a 7ms gap, then
   *      220Hz. A step is a refusal; a slide is a collapse.
   *   3. BUZZ, NOT TONE. `influenceLoss` is a bare sine: 100% of its energy in
   *      one octave band, the next band 32.1dB down. `denied` is a square
   *      behind a filter and spreads across three — 250 / 500 / 1k Hz at
   *      −0.97 / −8.79 / −14.16dB. A filtered square and a pure falling tone
   *      are not the same object even at the same pitch.
   *   4. MID, NOT BASS. `challengeRevealFail` puts essentially all of itself
   *      under 160Hz (−0.30dB of its own total; centroid 105Hz). `denied` puts
   *      1.2% there (−19.04dB; centroid 320Hz) — 18.7dB less chest, so no
   *      dread. And against the `timerWarning` it replaces, the closing
   *      1400→760Hz lowpass drops the centroid from 1561Hz to 320Hz: a muted
   *      buzzer behind a door rather than an alarm in the room.
   *
   * Tier 4 alongside `timerWarning`: a refusal is chrome, and must never
   * outrank a lost influence however distinctive it is. Trim −12.0 puts it at
   * −34.64 dBFS loud, level with `blockOpportunity` at the bottom of tier 4.
   */
  denied(g, out, t0, o) {
    const lp = g.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1400;
    lp.Q.value = 0.5;
    lp.connect(out);
    // Closing across the pair — the second blip is duller as well as lower.
    lp.frequency.setValueAtTime(f(o, 1400), t0);
    lp.frequency.exponentialRampToValueAtTime(f(o, 760), t0 + 0.09);
    osc(g, lp, t0, 'square', f(o, 320), 0.13, 0, 0.038);
    osc(g, lp, t0, 'square', f(o, 220), 0.14, 0.045, 0.088);
  },

  /**
   * WIN — a restrained brass fanfare. G3 C4 E4 G4 on the harmonic series, so it
   * reads as a bugle call rather than a chord progression.
   *
   * Brass without samples is one trick: a LOWPASS TRACKING THE ENVELOPE over a
   * small sawtooth stack. The cutoff opens 500 → 3000Hz in 60ms on each attack
   * and closes back to 900Hz over the note, which is what a blown instrument's
   * spectrum actually does; a static filter over the same stack is an organ.
   *
   * Notes 90ms apart — urgent. The phrase resolves at 270ms, and everything
   * after that (the fifth, the last note's tail) is deliberate ring-out.
   *
   * Fallback only: HERO_CLIPS.gameOverWin is the mastered clip and plays when
   * the fetch succeeds.
   */
  gameOverWin(g, out, t0, o) {
    const notes: [number, number, number][] = [
      [196.00, 0.00, 0.22],
      [261.63, 0.09, 0.22],
      [329.63, 0.18, 0.22],
      [392.00, 0.27, 0.80],
    ];
    for (const [hz, at, dur] of notes) {
      const t = t0 + at;
      const lp = g.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 500;
      lp.Q.value = 1.1;
      const env = g.ctx.createGain();
      env.gain.value = 0;
      lp.connect(env).connect(out);
      lp.frequency.setValueAtTime(500, t);
      lp.frequency.exponentialRampToValueAtTime(3000, t + 0.06);
      lp.frequency.exponentialRampToValueAtTime(900, t + dur);
      // Three sawtooths: unison, a 4-cent-sharp double for width, one octave up.
      for (const [mult, amp, det] of [[1, 0.34, 1], [1, 0.24, 1.004], [2, 0.10, 1]]) {
        const vg = g.ctx.createGain();
        vg.gain.value = amp;
        const ov = g.ctx.createOscillator();
        ov.type = 'sawtooth';
        ov.frequency.value = f(o, hz) * mult * det;
        ov.connect(vg).connect(lp);
        ov.start(t);
        ov.stop(t + dur + 0.05);
      }
      swell(env.gain, t, 0.30, 0.02, dur * 0.45, dur * 0.55);
    }
    // A fifth over the last note: the only harmony in the piece, and the thing
    // still ringing when the game-over overlay opens.
    const fg = g.ctx.createGain();
    fg.gain.value = 0;
    const fv = g.ctx.createOscillator();
    fv.type = 'triangle';
    fv.frequency.value = f(o, 587.33);
    fv.connect(fg).connect(out);
    fv.start(t0 + 0.27);
    fv.stop(t0 + 1.10);
    swell(fg.gain, t0 + 0.27, 0.10, 0.06, 0.32, 0.42);

    thump(g, out, t0, f(o, 110), f(o, 55), 0.20, 0.24);
    thump(g, out, t0 + 0.27, f(o, 110), f(o, 55), 0.18, 0.30);
  },

  /**
   * LOSE — gameOverWin inverted at every joint, so the two can never be
   * confused by timbre alone rather than merely by level:
   *
   *   win                            lose
   *   ─────────────────────────────  ────────────────────────────────────────
   *   G3 C4 E4 G4, rising major      G4 Eb4 C4 G3, falling MINOR
   *   sawtooth, bright               square through a 620Hz lowpass, muted
   *   filter OPENS on each attack    filter CLOSES through each note (1500→320)
   *   notes 90ms apart, urgent       notes 150 / 170 / 210ms apart, slowing
   *   a fifth ringing over the end   the last note SAGS a semitone flat
   *
   * THE SAG is the thing that reads as loss: ×0.944 (one semitone) over the last
   * 70% of the final note's length — a held pitch that will not stay up. Two
   * squares detuned 0.35% beat against each other at ~1.4Hz through it, so the
   * tail wavers instead of ringing.
   *
   * Fallback only, behind HERO_CLIPS.gameOverLose.
   */
  gameOverLose(g, out, t0, o) {
    const notes: [number, number, number][] = [
      [392.00, 0.00, 0.30],
      [311.13, 0.15, 0.30],
      [261.63, 0.32, 0.34],
      [196.00, 0.53, 1.05],
    ];
    for (let i = 0; i < notes.length; i++) {
      const [hz, at, dur] = notes[i];
      const t = t0 + at;
      const last = i === notes.length - 1;
      const lp = g.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 620;
      lp.Q.value = 1.4;
      const env = g.ctx.createGain();
      env.gain.value = 0;
      lp.connect(env).connect(out);
      // Closing, not opening: every note is duller at its end than at its start.
      lp.frequency.setValueAtTime(1500, t);
      lp.frequency.exponentialRampToValueAtTime(320, t + dur * 0.8);
      for (const [amp, det] of [[0.28, 1], [0.20, 1.0035]]) {
        const vg = g.ctx.createGain();
        vg.gain.value = amp;
        const ov = g.ctx.createOscillator();
        ov.type = 'square';
        const base = f(o, hz) * det;
        ov.frequency.setValueAtTime(base, t);
        if (last) glide(ov.frequency, t + dur * 0.3, base, base * 0.944, dur * 0.7);
        ov.connect(vg).connect(lp);
        ov.start(t);
        ov.stop(t + dur + 0.05);
      }
      swell(env.gain, t, 0.28, 0.03, dur * 0.35, dur * 0.62);
    }
    // One dead thud under the first note — a timpani with the head damped.
    thump(g, out, t0, f(o, 98), f(o, 46), 0.26, 0.34);
    // …and a long breath of air where the win's ringing fifth would have been.
    const ag = g.ctx.createGain();
    ag.gain.value = 0;
    const alp = g.ctx.createBiquadFilter();
    alp.type = 'lowpass';
    alp.frequency.value = 700;
    alp.Q.value = 0.6;
    const an = noiseSource(g, 'pink', t0 + 0.5, 1.3, 0.8);
    an.connect(alp).connect(ag).connect(out);
    glide(alp.frequency, t0 + 0.5, 700, 220, 1.1);
    swell(ag.gain, t0 + 0.5, 0.18, 0.18, 0.2, 0.9);
  },

  playerEliminated(g, out, t0, o) {
    osc(g, out, t0, 'sine', f(o, 200), 0.2, 0, 0.4, f(o, 80));
  },

  exchange(g, out, t0, o) {
    osc(g, out, t0, 'sine', f(o, 500), 0.08, 0, 0.25);
    osc(g, out, t0, 'sine', f(o, 507), 0.08, 0, 0.25);
    osc(g, out, t0, 'sine', f(o, 493), 0.08, 0, 0.25);
  },

  // Pink, not white: this is card stock crossing felt, and white reads as hiss.
  cardShuffle(g, out, t0) {
    noiseBurst(g, out, t0, 0.12, 0, 0.15, 3000, 'pink');
  },

  /**
   * The opening deal: four cards off the deck, ~110ms apart and settling —
   * each flick a little lower and a little quieter than the one before, the
   * way a hand slows as it finishes. Fallback for HERO_CLIPS.cardDeal.
   */
  cardDeal(g, out, t0, o) {
    const flicks: [number, number, number][] = [
      [0.00, 0.12, 3200], [0.11, 0.11, 2900], [0.23, 0.10, 2700], [0.36, 0.09, 2500],
    ];
    for (const [at, amp, hz] of flicks) {
      noiseBurst(g, out, t0, amp, at, 0.07, f(o, hz), 'pink');
    }
  },

  reaction(g, out, t0, o) {
    osc(g, out, t0, 'sine', f(o, 800), 0.1, 0, 0.08, f(o, 1200));
  },

  chatMessage(g, out, t0, o) {
    osc(g, out, t0, 'sine', f(o, 660), 0.08, 0, 0.12);
  },
};

/**
 * ── THE ONLY PLACE A CUE BECOMES SOUND ──────────────────────────────────────
 *
 * Build the head node, then either start the mastered hero buffer through it or
 * run the synth definition into it. `play()` and `renderSoundOffline()` both
 * come through here; neither has its own copy of the head, the trim, or the
 * clip-vs-fallback choice.
 *
 * `hero` null means "synth": either the cue has no hero clip, or the clip is
 * not decoded (fetch failed or still in flight) and the fallback is what the
 * player is about to hear.
 *
 * A clip carries the voice's pitch as its playback rate — the opponent detune
 * and the ±2.5% jitter — so a round-robin variant retriggered is never the
 * same recording at the same speed twice.
 */
interface HeroVoice {
  readonly buffer: AudioBuffer;
  /** The variant's solved pre-trim gain. */
  readonly gain: number;
}

function startVoice(
  g: Graph,
  id: SoundId,
  t0: number,
  o: VoiceOptions,
  hero: HeroVoice | null,
): GainNode {
  const head = makeHead(g, o);
  if (hero) {
    const source = g.ctx.createBufferSource();
    const gain = g.ctx.createGain();
    source.buffer = hero.buffer;
    source.playbackRate.value = o.pitch;
    gain.gain.value = hero.gain;
    source.connect(gain).connect(head);
    source.start(t0);
  } else {
    sounds[id](g, head, t0, o);
  }
  return head;
}

/* ── the offline render ───────────────────────────────────────────────────── */

/** One cue placed in an offline render. `at` is seconds from the render start. */
export interface RenderLayer {
  id: SoundId;
  /** Seconds after t0. Defaults to 0. */
  at?: number;
  /** Decoded hero clip for this layer; null/omitted renders the synth voice. */
  heroBuffer?: AudioBuffer | null;
  /** Which HERO_CLIPS variant `heroBuffer` is. Defaults to 0. */
  heroVariant?: number;
  /** Defaults to true. False applies the full opponent treatment. */
  mine?: boolean;
}

/**
 * Silence rendered BEFORE the cue, so the master chain is measured in the state
 * the player actually hears it in.
 *
 * ── WHY A RENDER THAT STARTS AT t=0 LIES ────────────────────────────────────
 * Chrome's DynamicsCompressorNode applies an internal MAKEUP GAIN — for this
 * chain's settings (−14 / knee 6 / 12:1) it is +6.5dB — and that gain is not
 * present at the first sample of a render. It ramps in over roughly 300ms of
 * context time, input or no input. A cue scheduled at t=4ms is therefore
 * measured up to 6.5dB quieter than the identical cue scheduled at t=1s, and
 * partially so ACROSS the cue, which biases short cues differently from long
 * ones. That is a measurement of the render's first 300ms, not of the mix.
 *
 * The live context runs for the whole session, so the settled state is the real
 * one. One second of pre-roll puts every cue in it. Verified stable: 0.5s, 1s
 * and 2s of pre-roll give the same figures to 0.02dB.
 */
const RENDER_PRE_ROLL_S = 1.0;

export interface RenderOptions {
  /** Cue length to render AFTER the pre-roll. The whole tail, plus room. */
  seconds?: number;
  sampleRate?: number;
  /** Override the compressor settling pre-roll. See RENDER_PRE_ROLL_S. */
  preRollSeconds?: number;
  /**
   * Decoded hero clip for the base cue. Null or omitted renders the synth
   * voice, which is what the player gets when the fetch fails — so a hero cue
   * is measured twice, once each way, and the two are compared.
   */
  heroBuffer?: AudioBuffer | null;
  /** Which HERO_CLIPS variant `heroBuffer` is. Defaults to 0. */
  heroVariant?: number;
  /**
   * MEASUREMENT ONLY: render the base cue's clip at this pre-trim gain instead
   * of the HERO_CLIPS one. It is how the harness SOLVES a clip's gain — render,
   * compare to the synth, correct, repeat — without a second copy of the graph.
   */
  heroGainOverride?: number;
  /** Extra cues summed into the same render — the two-cues-at-once check. */
  layers?: readonly RenderLayer[];
  /**
   * MEASUREMENT ONLY, and never set by the live path: an extra dB offset on
   * every head in the render.
   *
   * It exists for the linearity probe that answers "is this cue riding the
   * limiter?". Render a cue twice, once at 0 and once at −20, and add 20dB back
   * to the second: a linear chain gives the same peak both times, and the
   * shortfall of the first IS the gain reduction the compressor and soft clip
   * are applying. Measuring that with a bypassed chain would mean building a
   * second graph, which is the one thing this file will not do.
   */
  trimOffsetDb?: number;
}

/**
 * Render one cue (plus any `layers`) through the REAL master chain and return
 * the rendered buffer.
 *
 * ── WHY THIS CANNOT DRIFT FROM THE LIVE MIX ─────────────────────────────────
 * It calls `buildGraph()` — the same function `getGraph()` calls, so the
 * compressor, the soft clip and the bus topology are literally the same code —
 * and it starts the cue with `startVoice()` and `voiceGain()`, the same two
 * functions `play()` uses. There is no offline-only graph and no offline-only
 * copy of MIX_DB. The only things this deliberately omits are the parts of
 * `play()` that are not audio: the rate gate, the voice budget, the music duck,
 * and the pitch jitter (measured at the nominal pitch, jitter ±2.5%).
 *
 * Requires `OfflineAudioContext`, so it is browser-only and never called from
 * the app. `tests/app/audio/harness.html` is its one caller. Nothing here runs
 * at import time.
 */
export function renderSoundOffline(
  id: SoundId,
  opts: RenderOptions = {},
): Promise<AudioBuffer> {
  const sampleRate = opts.sampleRate ?? 48000;
  const seconds = opts.seconds ?? 4;
  const preRoll = opts.preRollSeconds ?? RENDER_PRE_ROLL_S;
  const ctx = new OfflineAudioContext(
    2, Math.ceil((preRoll + seconds) * sampleRate), sampleRate,
  );
  const g = buildGraph(ctx, false);
  const t0 = preRoll + 0.004;

  const all: readonly (RenderLayer & { gainOverride?: number })[] = [
    {
      id,
      heroBuffer: opts.heroBuffer ?? null,
      heroVariant: opts.heroVariant,
      gainOverride: opts.heroGainOverride,
    },
    ...(opts.layers ?? []),
  ];
  const offset = dbToGain(opts.trimOffsetDb ?? 0);
  for (const layer of all) {
    const mine = layer.mine !== false;
    const clip = HERO_CLIPS[layer.id]?.[layer.heroVariant ?? 0];
    const hero = clip && layer.heroBuffer
      ? { buffer: layer.heroBuffer, gain: layer.gainOverride ?? clip.gain }
      : null;
    startVoice(
      g,
      layer.id,
      t0 + (layer.at ?? 0),
      {
        mine,
        gain: voiceGain(layer.id, mine, 1) * offset,
        pan: mine ? 0 : THEIRS_PAN,
        pitch: mine ? 1 : THEIRS_DETUNE,
      },
      hero,
    );
  }
  return ctx.startRendering();
}

/**
 * Render a music piece through the REAL chain at MUSIC_GAIN — the same
 * `buildGraph()` (so the same music-bus EQ), into `musicGain` exactly as
 * `startPiece()` connects it — so the music can be measured on the same axis as
 * the cues. Browser-only, harness-only. Discard the first RENDER_PRE_ROLL_S of
 * the result (compressor makeup ramp). `gainOverride` is MEASUREMENT ONLY: it
 * is how the harness probes a candidate MUSIC_GAIN without editing this file.
 */
export function renderMusicOffline(
  buffer: AudioBuffer,
  opts: { seconds?: number; sampleRate?: number; offsetS?: number; gainOverride?: number } = {},
): Promise<AudioBuffer> {
  const sampleRate = opts.sampleRate ?? 48000;
  const seconds = opts.seconds ?? 20;
  const ctx = new OfflineAudioContext(2, Math.ceil((RENDER_PRE_ROLL_S + seconds) * sampleRate), sampleRate);
  const g = buildGraph(ctx, false);
  g.musicGain.gain.value = opts.gainOverride ?? MUSIC_GAIN;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(g.musicGain);
  source.start(0, opts.offsetS ?? 0);
  return ctx.startRendering();
}

/** The hero-clip table, so a harness can fetch and decode the same URLs. */
export function heroClips(): Readonly<Partial<Record<SoundId, readonly HeroClip[]>>> {
  return HERO_CLIPS;
}

/** Every SoundId, for a harness that wants to render the whole bank. */
export function soundIds(): readonly SoundId[] {
  return Object.keys(sounds) as SoundId[];
}

/** The mix trim table, read-only. The gate imports this. */
export const MIX_TRIM_DB: Readonly<Record<SoundId, number>> = MIX_DB;

/** The music bus level, read-only. The gate pins it to the render it was measured at. */
export const MUSIC_BUS_GAIN: number = MUSIC_GAIN;

/** The tier table, read-only. The gate imports this. */
export const MIX_TIER_OF: Readonly<Record<SoundId, MixTier>> = MIX_TIER;

/**
 * Pre-trim hero-clip gains, one per variant, read-only. The gate checks these
 * are re-solved.
 */
export const HERO_CLIP_GAIN: Readonly<Partial<Record<SoundId, readonly number[]>>> =
  Object.fromEntries(
    Object.entries(HERO_CLIPS).map(([id, clips]) => [id, clips.map(c => c.gain)]),
  );

/** Voice-budget tail per cue, read-only — the gate checks it covers every clip. */
export const VOICE_TAIL_S: Readonly<Record<SoundId, number>> =
  Object.fromEntries(Object.entries(VOICE).map(([id, v]) => [id, v.tail])) as Record<SoundId, number>;

/* ── the score's voices ───────────────────────────────────────────────────── */

/** One piece sounding (or scheduled to) through its own gain into musicGain. */
interface MusicVoice {
  readonly piece: MusicPiece;
  readonly state: MusicState;
  readonly source: AudioBufferSourceNode;
  readonly gain: GainNode;
  /** Context time at which the file's 0s would have played. */
  readonly origin: number;
  /** Context time the source starts. */
  readonly startAt: number;
}

/**
 * Equal-power halves: the incoming piece follows sin, the outgoing cos, so the
 * summed power is constant through a crossfade — a linear fade between two
 * uncorrelated pieces dips 3dB in the middle, which reads as the music
 * hesitating.
 */
function equalPowerCurve(dir: 'in' | 'out', from: number): Float32Array {
  const n = 64;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * (Math.PI / 2);
    c[i] = (dir === 'in' ? Math.sin(x) : Math.cos(x)) * from;
  }
  return c;
}

/**
 * Fade a gain param to 0 along the outgoing equal-power half, starting from
 * wherever it IS at `at` — a change can land half-way through another fade,
 * and jumping back to where that fade started is an audible step. Holds
 * rather than cancels; Firefox has no `cancelAndHoldAtTime`, and a new curve
 * that overlaps a still-scheduled one throws, so the fallback is a plain ramp.
 */
function fadeOut(p: AudioParam, at: number, dur: number): void {
  const from = p.value;
  try {
    if (typeof p.cancelAndHoldAtTime === 'function') p.cancelAndHoldAtTime(at);
    else {
      p.cancelScheduledValues(at);
      p.setValueAtTime(from, at);
    }
    p.setValueCurveAtTime(equalPowerCurve('out', from), at + 0.001, dur);
  } catch {
    p.cancelScheduledValues(0);
    p.setValueAtTime(from, at);
    p.linearRampToValueAtTime(0, at + dur);
  }
}

/* ── the engine ───────────────────────────────────────────────────────────── */

class SoundEngine {
  private graph: Graph | null = null;
  /** The same object as `graph.ctx`, narrowed. Only `resume()` needs it. */
  private liveCtx: AudioContext | null = null;
  // ── music state ── see "the score" below.
  /** The state the current scene wants. `startMusic()` plays this one. */
  private musicState: MusicState = 'court';
  /** The piece that owns the timeline: its handoff schedules the next. */
  private current: MusicVoice | null = null;
  /** The next piece of the pool, scheduled on the audio clock at the handoff. */
  private queued: MusicVoice | null = null;
  /** Pieces fading out (handoff, state change or stop). */
  private retiring = new Set<MusicVoice>();
  /** Shuffle bag and last pick, per state — they survive leaving the state. */
  private bags = new Map<MusicState, number[]>();
  private lastPick = new Map<MusicState, number>();
  private musicBuffers = new Map<string, AudioBuffer>();
  private musicBufferPromises = new Map<string, Promise<AudioBuffer>>();
  /** Lazily built 32kHz decoder — see MUSIC_DECODE_RATE. */
  private musicDecoder: BaseAudioContext | null = null;
  /** Bumped by every state change, start and stop; async continuations compare it. */
  private musicVersion = 0;
  /** A load for a start or a state change is in flight (its version). */
  private musicPending: number | null = null;
  private musicTimers = new Set<ReturnType<typeof setTimeout>>();
  private clipBuffers = new Map<string, AudioBuffer>();
  private clipBufferPromises = new Map<string, Promise<AudioBuffer>>();
  /** Last round-robin variant per cue — never picked twice running. */
  private lastVariant = new Map<SoundId, number>();
  private _muted: boolean;
  private _musicEnabled: boolean;

  // Voice budget, reaped by scheduled end time — see reap().
  private voiceEnd: number[] = [];
  private voiceWeight: number[] = [];
  private voiceLoad = 0;
  private peakVoiceLoad = 0;
  private droppedVoices = 0;
  private droppedPriority = 0;
  private gatedVoices = 0;
  private heroClipVoices = 0;
  private heroFallbackVoices = 0;
  private lastAt = new Map<SoundId, number>();
  private flamAt = new Map<SoundId, number>();
  private flamRun = new Map<SoundId, number>();

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

  /** True once a gesture has resumed the context. Never constructs one. */
  get running(): boolean {
    return this.liveCtx?.state === 'running';
  }

  /**
   * Build the whole chain, via the shared `buildGraph()`. Called lazily — never
   * at import time.
   */
  private getGraph(): Graph | null {
    if (typeof window === 'undefined') return null;
    if (this.graph) return this.graph;

    const ctx = new AudioContext();
    this.liveCtx = ctx;
    this.graph = buildGraph(ctx, this._muted);
    return this.graph;
  }

  private rampGain(gainNode: GainNode | null, target: number, durationMs: number): void {
    const g = this.graph;
    if (!g || !gainNode) return;
    const now = g.ctx.currentTime;
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(gainNode.gain.value, now);
    gainNode.gain.linearRampToValueAtTime(target, now + durationMs / 1000);
  }

  /** Call from a user gesture to unlock AudioContext on mobile Safari. */
  unlock(): void {
    const g = this.getGraph();
    if (!g || !this.liveCtx) return;
    const ctx = this.liveCtx;
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
    this.rampGain(this.graph?.sfxGain ?? null, muted ? 0 : 1, 80);
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

  /* ── the score ─────────────────────────────────────────────────────────────
   *
   * One piece at a time per state, through-composed, from that state's pool:
   *
   *   start      the first piece of the wanted state (lobby from its top, an
   *              in-game state from its `entryS`), musicGain fading in
   *   handoff    MUSIC_PREFETCH_S before the playing piece's `handoffS`, the
   *              next piece of the SAME pool (shuffle bag) is fetched and
   *              decoded; it is then scheduled ON THE AUDIO CLOCK to start at
   *              the handoff (a bar line of the outgoing piece) from its own
   *              `leadInS`, fading in over MUSIC_FADE_IN_POOL_S while the
   *              outgoing piece fades out over its remaining tail (≤8s).
   *   state      a different state crossfades now — equal-power, MUSIC_XFADE_STATE_S
   *              — into a piece of the new pool at its `entryS`, so a change
   *              into tension sounds like tension, not like a soft intro.
   *   stop       musicGain fades to 0 and every piece is stopped after it.
   *
   * Only the sounding piece is fetched; the next is prefetched ~20s ahead.
   * Nothing is precached by the service worker (it runtime-caches /audio/).
   * Decoded buffers not sounding or queued are evicted.
   *
   * Main-thread timers only PREPARE (prefetch) and PROMOTE (bookkeeping after a
   * handoff); every audible event is scheduled on the audio clock. A throttled
   * background tab therefore delays bookkeeping, never a fade. If a prefetch
   * fails, the piece plays out to its natural end and `onended` starts another.
   */

  private musicDecodeCtx(fallback: BaseAudioContext): BaseAudioContext {
    if (this.musicDecoder) return this.musicDecoder;
    try {
      this.musicDecoder = new OfflineAudioContext(2, 1, MUSIC_DECODE_RATE);
    } catch {
      this.musicDecoder = fallback;
    }
    return this.musicDecoder;
  }

  /** Fetch + decode one piece (32kHz — MUSIC_DECODE_RATE), and evict the unused. */
  private loadPiece(ctx: BaseAudioContext, url: string): Promise<AudioBuffer> {
    const cached = this.musicBuffers.get(url);
    if (cached) return Promise.resolve(cached);
    const pending = this.musicBufferPromises.get(url);
    if (pending) return pending;
    const promise = fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`Music request failed: ${response.status}`);
        return response.arrayBuffer();
      })
      .then(audio => this.musicDecodeCtx(ctx).decodeAudioData(audio))
      .then((buffer) => {
        this.musicBufferPromises.delete(url);
        this.musicBuffers.set(url, buffer);
        this.evictMusic(url);
        return buffer;
      })
      .catch((error: unknown) => {
        this.musicBufferPromises.delete(url);
        throw error;
      });
    this.musicBufferPromises.set(url, promise);
    return promise;
  }

  /** Keep only what is sounding, queued, or just loaded. */
  private evictMusic(keep: string): void {
    const live = new Set<string>([keep]);
    for (const v of [this.current, this.queued, ...this.retiring]) if (v) live.add(v.piece.url);
    for (const url of this.musicBuffers.keys()) if (!live.has(url)) this.musicBuffers.delete(url);
  }

  /** The next piece of `state`'s pool, from its shuffle bag. */
  private pickPiece(state: MusicState): MusicPiece {
    const pool = MUSIC_POOLS[state];
    const { pick, bag } = drawFromBag(this.bags.get(state) ?? [], pool.length, this.lastPick.get(state), Math.random);
    this.bags.set(state, bag);
    this.lastPick.set(state, pick);
    return pool[pick];
  }

  private later(fn: () => void, ms: number): void {
    const t = setTimeout(() => {
      this.musicTimers.delete(t);
      fn();
    }, Math.max(0, ms));
    this.musicTimers.add(t);
  }

  private clearMusicTimers(): void {
    for (const t of this.musicTimers) clearTimeout(t);
    this.musicTimers.clear();
  }

  /**
   * One piece, through its own gain into musicGain, starting at context time
   * `at` from `offset` seconds into the file, fading in over `fadeInS` (sin —
   * the incoming half of an equal-power pair; 0 = full level at once).
   */
  private startPiece(
    g: Graph, piece: MusicPiece, state: MusicState, buffer: AudioBuffer, at: number, offset: number, fadeInS: number,
  ): MusicVoice {
    const source = g.ctx.createBufferSource();
    source.buffer = buffer;
    const gain = g.ctx.createGain();
    if (fadeInS > 0) {
      gain.gain.setValueAtTime(0, at);
      gain.gain.setValueCurveAtTime(equalPowerCurve('in', 1), at + 0.001, fadeInS);
    } else {
      gain.gain.setValueAtTime(1, at);
    }
    source.connect(gain).connect(g.musicGain);
    const start = Math.min(Math.max(0, offset), Math.max(0, buffer.duration - 1));
    const voice: MusicVoice = { piece, state, source, gain, origin: at - start, startAt: at };
    source.onended = () => {
      gain.disconnect();
      this.retiring.delete(voice);
      if (this.queued === voice) this.queued = null;
      if (this.current === voice) {
        const g = this.graph;
        if (this.queued && g) {
          // The promote timer was starved (background tab): catch up.
          this.promote(g, voice, this.queued);
          return;
        }
        // Played out with nothing queued behind it (a failed prefetch, or a
        // timer starved before the prefetch): carry on with the next piece.
        this.current = null;
        if (this._musicEnabled && this.musicPending === null) this.startMusic();
      }
    };
    source.start(at, start);
    return voice;
  }

  /**
   * Fade a piece out from wherever its gain IS (a change can land mid-way
   * through another fade) and stop it after. A piece scheduled for the
   * future that has not started is simply cancelled.
   */
  private retire(g: Graph, v: MusicVoice, at: number, fadeS: number): void {
    this.retiring.add(v);
    if (v.startAt > at) {
      try { v.source.stop(); } catch { /* not started */ }
      return;
    }
    fadeOut(v.gain.gain, at, fadeS);
    try { v.source.stop(at + fadeS + 0.05); } catch { /* already stopped */ }
  }

  /** After a handoff: the queued piece owns the timeline. Guarded by identity. */
  private promote(g: Graph, from: MusicVoice, to: MusicVoice): void {
    if (this.current !== from || this.queued !== to) return;
    this.current = to;
    this.queued = null;
    this.scheduleHandoff(g, to);
  }

  /** Prefetch the next piece of this voice's pool ahead of its handoff. */
  private scheduleHandoff(g: Graph, v: MusicVoice): void {
    const version = this.musicVersion;
    const handoffAt = v.origin + v.piece.handoffS;
    const prefetchIn = (handoffAt - MUSIC_PREFETCH_S - g.ctx.currentTime) * 1000;
    this.later(() => {
      if (version !== this.musicVersion || this.current !== v || this.queued) return;
      const next = this.pickPiece(v.state);
      void this.loadPiece(g.ctx, next.url).then((buffer) => {
        if (version !== this.musicVersion || this.current !== v || this.queued) return;
        const now = g.ctx.currentTime;
        const at = Math.max(handoffAt, now + 0.05);
        const tail = clamp(v.origin + v.piece.durationS - at, 0.5, MUSIC_XFADE_POOL_S);
        this.queued = this.startPiece(g, next, v.state, buffer, at, next.leadInS, MUSIC_FADE_IN_POOL_S);
        this.retire(g, v, at, tail);
        // Bookkeeping only — the audio is already scheduled.
        const q = this.queued;
        this.later(() => this.promote(g, v, q), (at - now) * 1000 + 50);
      }).catch((error: unknown) => {
        // Let this piece play out; `onended` starts the next.
        console.warn('Unable to prefetch the next music piece', error);
      });
    }, prefetchIn);
  }

  /**
   * Choose the state for the current scene. If music is playing another
   * state, crossfade into this state's pool; if nothing is playing, only
   * record the choice — `startMusic()` (or the first-gesture `unlock()`) will
   * play it. Never starts audio on its own, so it is safe to call from an
   * effect before the page has had a gesture.
   */
  setMusicState(state: MusicState): void {
    const changed = state !== this.musicState;
    this.musicState = state;
    const g = this.graph;
    if (!g || !this._musicEnabled || g.ctx.state !== 'running') return;
    const playing = this.current ?? this.queued;
    if (!playing) {
      // Nothing sounding: a start in flight for the old state restarts.
      if (changed && this.musicPending !== null) {
        this.musicVersion += 1;
        this.musicPending = null;
        this.startMusic();
      }
      return;
    }
    if (playing.state === state) {
      if (this.musicPending !== null) {
        // Back to what is playing while a switch away was loading: cancel the
        // switch and re-arm the handoff the switch had disarmed.
        this.musicVersion += 1;
        this.musicPending = null;
        this.clearMusicTimers();
        if (this.current && !this.queued) this.scheduleHandoff(g, this.current);
        else if (this.current && this.queued) {
          const from = this.current;
          const to = this.queued;
          this.later(() => this.promote(g, from, to), (to.startAt - g.ctx.currentTime) * 1000 + 50);
        }
      }
      return;
    }
    const version = ++this.musicVersion;
    this.musicPending = version;
    this.clearMusicTimers();
    const piece = this.pickPiece(state);
    void this.loadPiece(g.ctx, piece.url).then((buffer) => {
      if (version !== this.musicVersion) return;
      this.musicPending = null;
      if (g.ctx.state !== 'running') return;
      const now = g.ctx.currentTime + 0.02;
      for (const v of [this.current, this.queued, ...this.retiring]) if (v) this.retire(g, v, now, MUSIC_XFADE_STATE_S);
      this.queued = null;
      this.current = this.startPiece(g, piece, state, buffer, now, piece.entryS, MUSIC_XFADE_STATE_S);
      this.scheduleHandoff(g, this.current);
    }).catch((error: unknown) => {
      if (version === this.musicVersion) this.musicPending = null;
      console.warn('Unable to switch background music', error);
    });
  }

  /** The state `setMusicState()` last chose. */
  get currentMusicState(): MusicState {
    return this.musicState;
  }

  /** The state actually sounding (null when stopped or still loading). */
  get playingMusicState(): MusicState | null {
    return (this.current ?? this.queued)?.state ?? null;
  }

  /** The piece actually sounding — for the harness and the docs, not for logic. */
  get playingMusicPiece(): string | null {
    return (this.current ?? this.queued)?.piece.url ?? null;
  }

  /**
   * DEV/HARNESS ONLY: jump the sounding piece to `leadS` seconds before its
   * handoff, so the prefetch → scheduled handoff → promote path can be driven
   * in seconds instead of minutes (tests/app/audio/harness.entry.ts `live`).
   */
  previewHandoff(leadS = MUSIC_PREFETCH_S + 2): void {
    const g = this.graph;
    const v = this.current;
    if (!g || !v || this.queued) return;
    const buffer = v.source.buffer;
    if (!buffer) return;
    this.clearMusicTimers();
    const now = g.ctx.currentTime + 0.02;
    this.retire(g, v, now, 0.05);
    this.current = this.startPiece(g, v.piece, v.state, buffer, now, v.piece.handoffS - leadS, 0.05);
    this.scheduleHandoff(g, this.current);
  }

  private loadClip(ctx: BaseAudioContext, url: string): Promise<AudioBuffer> {
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

  private preloadHeroClips(ctx: BaseAudioContext): void {
    for (const clips of Object.values(HERO_CLIPS)) {
      for (const clip of clips ?? []) void this.loadClip(ctx, clip.url).catch(() => undefined);
    }
  }

  /**
   * Which round-robin variant to play: uniform over the others, never the one
   * played last. A fair pick over three plays the same take twice running a
   * third of the time, and twice running is exactly what reads as a sample.
   */
  private pickVariant(id: SoundId, n: number, rng: () => number): number {
    if (n <= 1) return 0;
    const last = this.lastVariant.get(id);
    let i = Math.floor(rng() * (last === undefined ? n : n - 1));
    if (last !== undefined && i >= last) i += 1;
    this.lastVariant.set(id, i);
    return i;
  }

  /**
   * A tier-0 sting whose clip is not decoded yet: wait for it rather than play
   * the fallback, because the mastered stinger IS the moment and a fetch from
   * the SW cache is a few ms. The fallback plays only if the fetch fails. Both
   * go through `startVoice()`, so both carry the same trim and treatment.
   */
  private playClipWhenLoaded(g: Graph, id: SoundId, o: VoiceOptions, clip: HeroClip): void {
    void this.loadClip(g.ctx, clip.url).then((buffer) => {
      if (this._muted || g.ctx.state !== 'running') return;
      // The scheduled t0 is long gone by the time the fetch resolves.
      startVoice(g, id, g.ctx.currentTime + 0.004, o, { buffer, gain: clip.gain });
    }).catch(() => {
      if (this._muted || g.ctx.state !== 'running') return;
      startVoice(g, id, g.ctx.currentTime + 0.004, o, null);
    });
  }

  /**
   * Start the state `setMusicState()` chose, fading in. No-op until the
   * context is running (a gesture has unlocked it), when music is disabled, or
   * when a piece is already playing or loading — switching states is
   * `setMusicState()`'s job, and the next piece of a pool is the handoff's.
   *
   * The lobby starts at the top of a piece (its soft intro is the welcome); an
   * in-game state starts at the piece's `entryS`, so a page reloaded into a
   * duel sounds like a duel.
   */
  startMusic(): void {
    if (!this._musicEnabled || this.current || this.queued || this.musicPending !== null) return;
    const g = this.getGraph();
    if (!g || g.ctx.state !== 'running') return;

    // A restart inside a stop's fade: the old piece must not reappear under
    // the new one's fade-in.
    for (const v of this.retiring) {
      try { v.source.stop(); } catch { /* already stopped */ }
    }
    this.retiring.clear();

    const state = this.musicState;
    const piece = this.pickPiece(state);
    const version = ++this.musicVersion;
    this.musicPending = version;
    void this.loadPiece(g.ctx, piece.url).then((buffer) => {
      if (version !== this.musicVersion) return;
      this.musicPending = null;
      if (!this._musicEnabled || this.current || g.ctx.state !== 'running') return;
      // The scene moved on while this piece was loading: load the right one.
      if (state !== this.musicState) {
        this.startMusic();
        return;
      }
      const now = g.ctx.currentTime;
      g.musicGain.gain.cancelScheduledValues(now);
      g.musicGain.gain.setValueAtTime(0, now);
      this.current = this.startPiece(g, piece, state, buffer, now, state === 'lobby' ? 0 : piece.entryS, 0);
      this.scheduleHandoff(g, this.current);
      this.rampGain(g.musicGain, MUSIC_GAIN, 900);
    }).catch((error: unknown) => {
      if (version === this.musicVersion) this.musicPending = null;
      console.warn('Unable to start background music', error);
    });
  }

  stopMusic(fadeMs = 500): void {
    this.musicVersion += 1;
    this.musicPending = null;
    this.clearMusicTimers();
    const g = this.graph;
    if (!g) return;
    const now = g.ctx.currentTime;
    g.musicDuck.gain.cancelScheduledValues(now);
    g.musicDuck.gain.setValueAtTime(1, now);
    for (const v of [this.current, this.queued]) if (v) this.retiring.add(v);
    this.current = null;
    this.queued = null;
    if (!this.retiring.size) return;
    this.rampGain(g.musicGain, 0, fadeMs);
    const end = now + fadeMs / 1000 + 0.05;
    for (const v of this.retiring) {
      try { v.source.stop(end); } catch { /* already stopped */ }
    }
  }

  /**
   * Step the music back under a consequence. Depth is by VOICE weight, not by
   * sound id: heavier meaning, deeper dip. 0.50 / 0.60 / 0.70 is 6.0 / 4.4 /
   * 3.1dB — an unmistakable step back on the moments that matter, and nothing
   * at all on the 60% of a game that has no consequence in it.
   *
   * 25ms attack so the dip is under the transient rather than behind it; 600ms
   * release for heavy stings (they have tails to get out of the way of) and
   * 280ms for light ones (the bed should be back before the next beat).
   */
  duckMusic(weight = 4): void {
    const g = this.graph;
    if (!g || !this._musicEnabled || !(this.current ?? this.queued)) return;
    const depth = weight >= 6 ? 0.50 : weight >= 4 ? 0.60 : 0.70;
    const releaseS = weight >= 6 ? 0.6 : 0.28;
    const now = g.ctx.currentTime;
    const p = g.musicDuck.gain;
    p.cancelScheduledValues(now);
    p.setValueAtTime(Math.max(p.value, EPS), now);
    p.linearRampToValueAtTime(depth, now + 0.025);
    p.exponentialRampToValueAtTime(1, now + 0.025 + releaseS);
  }

  /**
   * The single entry point, and the single place MIX_DB is applied.
   *
   * `mine` defaults to true so every pre-existing `play(id)` call site keeps its
   * old behaviour exactly.
   */
  play(id: SoundId, opts: PlayOptions = {}): void {
    if (this._muted) return;
    const g = this.getGraph();
    if (!g || g.ctx.state !== 'running') return;

    if (!sounds[id]) return;
    const spec = VOICE[id];
    const t0 = g.ctx.currentTime + 0.004;

    if (!this.gate(id, t0, spec.priority)) {
      this.gatedVoices += 1;
      return;
    }
    if (!this.take(t0 + spec.tail, spec.weight, spec.priority)) {
      this.droppedVoices += 1;
      if (spec.priority) this.droppedPriority += 1;
      return;
    }
    if (DUCKS.has(id)) this.duckMusic(spec.weight);

    const mine = opts.mine !== false;
    // MIX_DB, the theirs trim and the flam attenuation all meet in voiceGain()
    // and nowhere else. The head GainNode startVoice() builds from this is the
    // per-sound gain node between the voice and sfxGain.
    const o: VoiceOptions = {
      mine,
      gain: voiceGain(id, mine, this.flam(id, t0)),
      pan: mine ? 0 : this.theirsPan(opts.playerId),
      pitch: (mine ? 1 : THEIRS_DETUNE)
        * (JITTERED.has(id) ? jitter(JITTER_AMOUNT) : 1),
    };

    // A decoded clip plays NOW, at t0, in the same tick as the synth would —
    // a tactile cue that waits on a promise lands behind its animation. A
    // clip that is not decoded yet plays its fallback (and starts the load),
    // except a tier-0 sting, which waits — see playClipWhenLoaded().
    const clips = HERO_CLIPS[id];
    if (clips) {
      const clip = clips[this.pickVariant(id, clips.length, g.rng)];
      const buffer = this.clipBuffers.get(clip.url);
      if (buffer) {
        this.heroClipVoices += 1;
        startVoice(g, id, t0, o, { buffer, gain: clip.gain });
        return;
      }
      if (MIX_TIER[id] === 0) {
        this.playClipWhenLoaded(g, id, o, clip);
        return;
      }
      this.heroFallbackVoices += 1;
      void this.loadClip(g.ctx, clip.url).catch(() => undefined);
    }
    startVoice(g, id, t0, o, null);
  }

  /** Voice-budget and rate-limit counters. `droppedPriority` must read 0. */
  stats(): SoundStats {
    this.reap();
    return {
      peakVoiceLoad: this.peakVoiceLoad,
      voiceLoad: this.voiceLoad,
      droppedVoices: this.droppedVoices,
      droppedPriority: this.droppedPriority,
      gatedVoices: this.gatedVoices,
      heroClipVoices: this.heroClipVoices,
      heroFallbackVoices: this.heroFallbackVoices,
    };
  }

  /**
   * Which side of the field an opponent sits on. Seeded by player id so the same
   * opponent is always on the same side — a cue that jumps between ears is a
   * different player to a listener.
   */
  private theirsPan(playerId: string | undefined): number {
    const r = playerId === undefined ? this.graph?.rng() ?? 0.5 : hash01(playerId);
    return r < 0.5 ? -THEIRS_PAN : THEIRS_PAN;
  }

  /**
   * Reaped by SCHEDULED END TIME rather than `onended`. `onended` fires on the
   * main thread whenever it gets round to it, so a budget keyed on it drifts
   * behind the graph it is supposed to be describing.
   */
  private take(endTime: number, weight: number, priority: boolean): boolean {
    this.reap();
    // The two caps ARE the priority scheme: routine voices can never claim past
    // MAX_VOICES, so 32 weighted units are permanently reserved for the stings.
    // A coin tick therefore cannot be the reason a win fanfare goes unheard.
    const cap = priority ? MAX_VOICES_PRIORITY : MAX_VOICES;
    if (this.voiceLoad + weight > cap) return false;
    this.voiceEnd.push(endTime);
    this.voiceWeight.push(weight);
    this.voiceLoad += weight;
    if (this.voiceLoad > this.peakVoiceLoad) this.peakVoiceLoad = this.voiceLoad;
    return true;
  }

  private reap(): void {
    const now = this.graph ? this.graph.ctx.currentTime : 0;
    let write = 0;
    for (let i = 0; i < this.voiceEnd.length; i++) {
      if (this.voiceEnd[i] > now) {
        this.voiceEnd[write] = this.voiceEnd[i];
        this.voiceWeight[write] = this.voiceWeight[i];
        write += 1;
      } else {
        this.voiceLoad -= this.voiceWeight[i];
      }
    }
    this.voiceEnd.length = write;
    this.voiceWeight.length = write;
    if (this.voiceLoad < 0) this.voiceLoad = 0;
  }

  private gate(id: SoundId, now: number, priority: boolean): boolean {
    const min = priority ? RATE_PRIORITY : RATE_DEFAULT;
    const last = this.lastAt.get(id);
    if (last !== undefined && now - last < min) return false;
    this.lastAt.set(id, now);
    return true;
  }

  /**
   * Linear gain for the Nth rapid retrigger. See FLAM_DB: the rate floors are
   * short enough to let both cards of an exchange speak, and this is what stops
   * the pair from also being twice as loud.
   */
  private flam(id: SoundId, now: number): number {
    if (!FLAM.has(id)) return 1;
    const last = this.flamAt.get(id);
    const run = last !== undefined && now - last < FLAM_WINDOW
      ? (this.flamRun.get(id) ?? 0) + 1
      : 0;
    this.flamAt.set(id, now);
    this.flamRun.set(id, run);
    return dbToGain(FLAM_DB[Math.min(run, FLAM_DB.length - 1)]);
  }
}

export type { SoundEngine };

let instance: SoundEngine | null = null;

export function getSoundEngine(): SoundEngine {
  if (!instance) instance = new SoundEngine();
  return instance;
}
