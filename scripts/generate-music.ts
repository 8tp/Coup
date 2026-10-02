/**
 * Music generation (ElevenLabs Music v2), analysis and loop mastering.
 *
 *   <candidate> [--take N] [--output dir]   generate one candidate (needs ELEVENLABS_API_KEY,
 *                                           e.g. `npx tsx --env-file="$HOME/.config/elevenlabs/env" …`)
 *   analyze <file…>                         key, tempo, loudness, LRA, spectral balance, level profile
 *   master <bed…>                           MUSIC_MASTERS entry → seamless loop in public/audio/music/
 *
 * See docs/AUDIO.md for what was generated, what was picked, and why.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fftInPlace } from '../tests/app/audio/analysis';

const OUTPUT_FORMAT = 'mp3_44100_128';
const MODEL_ID = 'music_v2';

const candidates = {
  'velvet-court': {
    title: 'Velvet Court',
    durationMs: 70_000,
    prompt: 'Loop-friendly instrumental background music for a tense social deduction card game in a decadent near-future court. Dark chamber-electronic hybrid at 84 BPM, muted cello ostinato, softly plucked viola, restrained frame drum, subtle analog bass pulse, occasional glass harmonics. Suspicious, elegant, witty, and controlled; not epic, heroic, sentimental, or horror. No vocals and no dominant lead melody. Keep a steady low intensity with no dramatic intro, climax, or final cadence. Leave generous space for UI sound effects. The opening and ending should share compatible harmony, rhythm, texture, and energy for looping.',
  },
  'clockwork-conspiracy': {
    title: 'Clockwork Conspiracy',
    durationMs: 70_000,
    prompt: 'Loop-friendly instrumental underscore for a stylish bluffing and deception card game. 92 BPM, intimate clockwork percussion, pizzicato low strings, muted hand drum, warm analog pulse, sparse dulcimer accents, and a faint breathy woodwind texture. Cunning and playful with restrained tension, like quiet plotting around a royal table. No vocals, no cinematic swells, no dominant melody, no loud impacts, and no resolved ending. Maintain consistent low intensity and leave room for interface sounds. Match the opening and ending harmony, rhythm, and instrumentation so the track can repeat cleanly.',
  },
  'gilded-knives': {
    title: 'Gilded Knives',
    durationMs: 70_000,
    prompt: 'Loop-friendly instrumental ambience for a competitive court intrigue and social deduction game. 78 BPM, dry bowed bass, sparse viola harmonics, soft brushed frame percussion, quiet prepared-piano ticks, and a restrained dark synth bed. Sophisticated, suspicious, and slightly dangerous without becoming ominous or cinematic. No vocals, no memorable lead theme, no trailer drums, no large crescendo, and no final chord. Hold an even background intensity with sonic space for alerts and card sounds. Make the beginning and ending musically compatible for a seamless repeating loop.',
  },
  'court-crowned': {
    title: 'Court Crowned',
    durationMs: 7_000,
    prompt: 'A seven-second instrumental victory stinger for winning an elegant court intrigue card game. Immediate restrained chamber fanfare with a confident cello rise, two crisp viola flourishes, a subtle metallic glint, and a warm final chord. Clever and triumphant rather than heroic or bombastic. No vocals, no drums, no long intro, and no lingering reverb tail. Deliver a clear musical cadence within exactly seven seconds.',
  },
  'plot-unraveled': {
    title: 'Plot Unraveled',
    durationMs: 7_000,
    prompt: 'A seven-second instrumental defeat stinger for losing an elegant bluffing and court intrigue card game. Immediate low viola descent, a dry muted cello answer, one soft prepared-piano tick, and a restrained unresolved final tone. Wry and disappointed, not tragic, frightening, cinematic, or comedic. No vocals, no percussion swell, no long intro, and no lingering reverb tail. Complete the musical gesture within exactly seven seconds.',
  },

  // ── The adaptive score (2026-10-01) ───────────────────────────────────────
  // Three beds in ONE key/tempo family — D minor, 84 BPM, the velvet-court
  // palette — so lobby → table → endgame crossfades read as one score changing
  // its mind, not as three playlists. Each is generated a few seconds longer
  // than its loop so the head and tail can be trimmed as handles; see
  // `master` below for the loop method.
  'lobby-antechamber': {
    title: 'Antechamber',
    durationMs: 66_000,
    prompt: 'Loop-friendly instrumental lobby music for an elegant court-intrigue card game, the quiet before the game begins. D minor, 84 BPM, felt in a relaxed half-time. Dark chamber-electronic palette: warm sustained cello drone, softly plucked viola ostinato, glass harmonics, a distant felt piano playing sparse open fifths, a very soft analog pad, barely-there brushed frame drum. Inviting, poised and quietly conspiratorial, like a candlelit palace antechamber where the guests are arriving. No vocals, no lead melody, no build, no climax, no ending cadence. Even low intensity throughout and space for interface sounds. The opening and ending share the same harmony, texture and energy so it loops seamlessly.',
  },
  'table-velvet-court-ii': {
    title: 'Velvet Court II',
    durationMs: 96_000,
    prompt: 'Loop-friendly instrumental background music for a tense social deduction card game in a decadent near-future court. D minor, 84 BPM. Dark chamber-electronic hybrid: muted cello ostinato, softly plucked viola, restrained frame drum, subtle analog bass pulse, occasional glass harmonics. Suspicious, elegant, witty and controlled; not epic, heroic, sentimental, or horror. No vocals and no dominant lead melody. Keep a steady low intensity with no dramatic intro, climax or final cadence. Leave generous space in the upper mids for card and coin sound effects. The opening and ending share compatible harmony, rhythm, texture and energy for looping.',
  },
  'endgame-last-favour': {
    title: 'The Last Favour',
    durationMs: 66_000,
    prompt: 'Loop-friendly instrumental tension music for the final duel of a court-intrigue card game, two players left. D minor, 84 BPM, the same dark chamber-electronic palette as the main game music but tighter: insistent muted cello ostinato in eighth notes, a low pulsing analog bass on every beat, tremolo viola, a dry ticking frame drum and clock-like rim clicks, faint dissonant glass harmonics. Focused, close and dangerous; quiet, controlled pressure rather than loud action. No vocals, no lead melody, no big drums, no crescendo, no ending cadence. Steady intensity throughout with space for interface sounds. The opening and ending share the same harmony, rhythm and energy for a seamless loop.',
  },
} as const;

type CandidateId = keyof typeof candidates;

function isCandidateId(value: string): value is CandidateId {
  return value in candidates;
}

function parseOutputDirectory(args: string[]): string {
  const outputIndex = args.indexOf('--output');
  if (outputIndex === -1) return path.resolve('artifacts/music-candidates');
  const directory = args[outputIndex + 1];
  if (!directory) throw new Error('--output requires a directory');
  return path.resolve(directory);
}

/* ── analysis and loop mastering ──────────────────────────────────────────────
 *
 *   analyze <file…>                 key, tempo, loudness, spectral balance, and
 *                                   how alike the head and tail are
 *   master <track>                  build the seamless loop for one MUSIC_MASTERS
 *                                   entry into public/audio/music/
 *
 * Both need ffmpeg. Neither calls the API.
 */

const ANALYSIS_RATE = 22050;

function decode(file: string, rate: number, channels: 1 | 2): Float32Array {
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-ac', String(channels), '-ar', String(rate), '-f', 'f32le', '-'],
    { maxBuffer: 1024 * 1024 * 1024 });
  return new Float32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
}

interface Loudness { lufs: number; lra: number; truePeak: number }

function parseLoudness(text: string): Loudness {
  const num = (re: RegExp): number => Number(text.match(re)?.[1] ?? NaN);
  return { lufs: num(/I:\s+(-?[\d.]+) LUFS/), lra: num(/LRA:\s+(-?[\d.]+) LU/), truePeak: num(/Peak:\s+(-?[\d.]+) dBFS/) };
}

/** ffmpeg's EBU R128 summary (written to stderr): integrated, range, true peak. */
function loudnessViaStderr(input: string[]): Loudness {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...input, '-af', 'ebur128=peak=true:framelog=quiet', '-f', 'null', '-'],
    { encoding: 'utf8' });
  return parseLoudness(r.stderr);
}

/** Short-time magnitude spectra, Hann-windowed. */
function stft(x: Float32Array, n: number, hop: number): Float64Array[] {
  const frames: Float64Array[] = [];
  const win = new Float64Array(n);
  for (let i = 0; i < n; i++) win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
  for (let s = 0; s + n <= x.length; s += hop) {
    const re = new Float64Array(n);
    const im = new Float64Array(n);
    for (let i = 0; i < n; i++) re[i] = x[s + i] * win[i];
    fftInPlace(re, im);
    const mag = new Float64Array(n / 2);
    for (let k = 0; k < n / 2; k++) mag[k] = Math.hypot(re[k], im[k]);
    frames.push(mag);
  }
  return frames;
}

const PITCH = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
// Krumhansl–Kessler key profiles.
const MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

function correlate(a: readonly number[], b: readonly number[]): number {
  const ma = a.reduce((s, v) => s + v, 0) / a.length;
  const mb = b.reduce((s, v) => s + v, 0) / b.length;
  let num = 0; let da = 0; let db = 0;
  for (let i = 0; i < a.length; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return num / Math.sqrt(da * db);
}

/** Best Krumhansl key over a whole-track chroma, with its runner-up. */
function estimateKey(frames: Float64Array[], n: number): { key: string; r: number; second: string } {
  const chroma = new Array<number>(12).fill(0);
  for (const mag of frames) {
    for (let k = 1; k < mag.length; k++) {
      const f = (k * ANALYSIS_RATE) / n;
      if (f < 60 || f > 2000) continue;
      const pc = ((Math.round(12 * Math.log2(f / 440)) + 69) % 12 + 12) % 12;
      chroma[pc] += mag[k] * mag[k];
    }
  }
  const scores: { key: string; r: number }[] = [];
  for (let tonic = 0; tonic < 12; tonic++) {
    const rot = (p: number[]) => p.map((_, i) => p[(i - tonic + 12) % 12]);
    scores.push({ key: `${PITCH[tonic]} major`, r: correlate(chroma, rot(MAJOR)) });
    scores.push({ key: `${PITCH[tonic]} minor`, r: correlate(chroma, rot(MINOR)) });
  }
  scores.sort((a, b) => b.r - a.r);
  return { key: scores[0].key, r: Math.round(scores[0].r * 100) / 100, second: scores[1].key };
}

/** Spectral-flux onset envelope, one value per hop. */
function onsetEnvelope(frames: Float64Array[]): Float64Array {
  const env = new Float64Array(frames.length);
  for (let t = 1; t < frames.length; t++) {
    let s = 0;
    for (let k = 1; k < frames[t].length; k++) {
      const d = Math.log1p(frames[t][k] * 100) - Math.log1p(frames[t - 1][k] * 100);
      if (d > 0) s += d;
    }
    env[t] = s;
  }
  return env;
}

/** Tempo from the onset envelope's autocorrelation, 60–180 BPM. */
function estimateTempo(env: Float64Array, hopS: number): { bpm: number; alt: number } {
  const mean = env.reduce((s, v) => s + v, 0) / env.length;
  const e = env.map(v => v - mean);
  const lag = (bpm: number): number => 60 / bpm / hopS;
  const ac = (L: number): number => {
    const l0 = Math.floor(L);
    const frac = L - l0;
    let s = 0;
    for (let i = 0; i + l0 + 1 < e.length; i++) s += e[i] * ((1 - frac) * e[i + l0] + frac * e[i + l0 + 1]);
    return s;
  };
  const results: { bpm: number; v: number }[] = [];
  for (let bpm = 60; bpm <= 180; bpm += 0.25) results.push({ bpm, v: ac(lag(bpm)) });
  results.sort((a, b) => b.v - a.v);
  const best = results[0].bpm;
  const alt = results.find(r => Math.abs(r.bpm - best) > 8)?.bpm ?? best;
  return { bpm: best, alt };
}

/**
 * Fine tempo near a nominal BPM: the comb of autocorrelation lags at 1…32
 * beats, summed. A single-lag peak cannot tell 84.0 from 83.6; 32 beats of
 * accumulated drift can — 0.4 BPM is a third of a beat over 32 beats.
 */
function fineTempo(env: Float64Array, hopS: number, nominal: number): number {
  const mean = env.reduce((s, v) => s + v, 0) / env.length;
  const e = env.map(v => v - mean);
  const ac = (L: number): number => {
    const l0 = Math.floor(L);
    const frac = L - l0;
    let s = 0;
    for (let i = 0; i + l0 + 1 < e.length; i++) s += e[i] * ((1 - frac) * e[i + l0] + frac * e[i + l0 + 1]);
    return s;
  };
  let best = nominal;
  let bestV = -Infinity;
  for (let bpm = nominal - 3; bpm <= nominal + 3; bpm += 0.02) {
    const lag = 60 / bpm / hopS;
    let v = 0;
    for (let k = 1; k <= 32; k++) v += ac(lag * k);
    if (v > bestV) { bestV = v; best = bpm; }
  }
  return Math.round(best * 100) / 100;
}

/** Share of energy in a band of the long-term average spectrum, dB. */
function bandShare(frames: Float64Array[], n: number, lo: number, hi: number): number {
  let band = 0; let total = 0;
  for (const mag of frames) {
    for (let k = 1; k < mag.length; k++) {
      const f = (k * ANALYSIS_RATE) / n;
      const p = mag[k] * mag[k];
      total += p;
      if (f >= lo && f < hi) band += p;
    }
  }
  return Math.round(10 * Math.log10(band / total) * 10) / 10;
}

function analyzeMusic(file: string): void {
  const x = decode(file, ANALYSIS_RATE, 1);
  const n = 4096;
  const frames = stft(x, n, 2048);
  const key = estimateKey(frames, n);
  const onsetFrames = stft(x, 1024, 512);
  const tempo = estimateTempo(onsetEnvelope(onsetFrames), 512 / ANALYSIS_RATE);
  const fine = fineTempo(onsetEnvelope(stft(x, 1024, 256)), 256 / ANALYSIS_RATE, 84);
  const l = loudnessViaStderr(['-i', file]);
  // Short-term (3s) loudness every 3s: a loop wants the same level at both ends.
  const frame = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
  const profile: string[] = [];
  for (const line of frame.split('\n')) {
    const mt = line.match(/t:\s*([\d.]+).*S:\s*(-?[\d.]+)/);
    if (mt && Math.round(Number(mt[1]) * 10) % 30 === 0 && Number(mt[1]) >= 2.9) profile.push(String(Math.round(Number(mt[2]))));
  }
  console.log(`${path.basename(file).padEnd(36)} ${(x.length / ANALYSIS_RATE).toFixed(1)}s  ${key.key} (r ${key.r}, then ${key.second})  `
    + `${tempo.bpm} BPM (alt ${tempo.alt}, fine near 84: ${fine})  ${l.lufs} LUFS  LRA ${l.lra}  TP ${l.truePeak}  `
    + `<160Hz ${bandShare(frames, n, 0, 160)}dB  1–4kHz ${bandShare(frames, n, 1000, 4000)}dB  >4kHz ${bandShare(frames, n, 4000, 11025)}dB`
    + `\n${"".padEnd(36)} S-loudness every 3s: ${profile.join(" ")}`);
}

/**
 * ── THE LOOP METHOD ──────────────────────────────────────────────────────────
 * GAME-FEEL-PLAN §4.8: a loop whose period is a whole number of BARS at the
 * track's tempo, with a crossfade a whole number of BEATS long, so the beat
 * grid never stutters across the seam.
 *
 *   1. Skip `headS` of intro. Snap the loop start S to the strongest onset
 *      within a beat of it, so the loop begins on an attack, not mid-note.
 *   2. Search E around S + bars·barLength (± half a beat, and ±1 bar) for the
 *      point whose next 3 seconds look most like the 3 seconds after S —
 *      onset-envelope correlation plus log-spectrum distance. Refine to the
 *      sample by cross-correlating the low-passed waveforms (±8ms), so the
 *      bass is in phase when the two copies overlap.
 *   3. Loop = audio[S, E). Its first `xfadeBeats` are rewritten as an
 *      equal-power crossfade from audio[E…] (fading out) into audio[S…]
 *      (fading in). Played on repeat, the sample after the loop's last is
 *      therefore audio[E] — the true continuation — and the transition back
 *      into the head happens gradually inside the first beats, not at a cut.
 *   4. Measure the seam: the sample step at the wrap against the track's
 *      typical sample step, and the spectral flux across the wrap against the
 *      track's median flux.
 *   5. Normalise to MUSIC_LUFS, check true peak, encode 128 kbps stereo.
 */
interface MusicMaster {
  readonly source: string;
  readonly out: string;
  readonly bpm: number;
  readonly bars: number;
  readonly headS: number;
  readonly xfadeBeats: number;
  /** The source is already a finished loop: relevel and re-encode only. */
  readonly wholeFile?: boolean;
  readonly why: string;
}

const MUSIC_LUFS = -20;
const MASTER_RATE = 44100;

export const MUSIC_MASTERS: Record<string, MusicMaster> = {
  // Kept over Velvet Court II (LRA 6.7 LU, key correlation 0.5): LRA 0.6 LU and
  // almost nothing above 1kHz (1–4kHz is −31.8dB of its total energy), which
  // leaves more room for card and coin cues than any other bed. But the
  // shipped 68.0s file was 95.2 beats long — not a whole number — and its wrap
  // measured a 44× click (second difference vs the loop's p99.9). So it is
  // re-looped from itself: 22 whole bars, a 4-beat crossfade, both seams kept
  // clear of the old one at 0/68s.
  'table-velvet-court': {
    source: 'public/audio/velvet-court.mp3', out: 'table-velvet-court', bpm: 84, bars: 22, headS: 1.2, xfadeBeats: 4,
    why: 'shipped bed, re-looped on whole bars and levelled to −20 LUFS',
  },
  'lobby-antechamber': {
    source: 'lobby-antechamber-t2.mp3', out: 'lobby-antechamber', bpm: 84, bars: 14, headS: 21, xfadeBeats: 4,
    why: 'take 2: D minor (r 0.86) — the iv of the table\'s A minor, so lobby→table is a near-key crossfade; '
      + 'its last 45s hold −19/−20 LUFS short-term (LRA 1.6 in the loop) where take 1 swung ±3 LU and drifted 2 LU louder; '
      + 'head/tail match 0.93. Cost: a 14-bar (40s) loop, because take 2 spends its first 20s building',
  },
  'endgame-last-favour': {
    source: 'endgame-last-favour-t2.mp3', out: 'endgame-last-favour', bpm: 84, bars: 21, headS: 3, xfadeBeats: 4,
    why: 'take 2: A minor (r 0.79) at exactly 84 BPM — the table bed\'s own key and tempo, so the crossfade into it '
      + 'reads as the same score tightening; LRA 1.9; take 1 sat in D (major/minor ambiguous, r 0.7) and drifted louder',
  },
};

function onsetEnvAt(x: Float32Array, rate: number, startS: number, durS: number, hop: number): Float64Array {
  const s = Math.max(0, Math.round(startS * rate));
  const seg = x.subarray(s, Math.min(x.length, s + Math.round(durS * rate)));
  return onsetEnvelope(stft(seg, 1024, hop));
}

function logSpec(x: Float32Array, rate: number, startS: number, durS: number): Float64Array {
  const s = Math.max(0, Math.round(startS * rate));
  const frames = stft(x.subarray(s, s + Math.round(durS * rate)), 2048, 1024);
  const acc = new Float64Array(64);
  for (const mag of frames) {
    for (let k = 1; k < mag.length; k++) acc[Math.min(63, Math.floor(Math.log2(k) * 6))] += mag[k] * mag[k];
  }
  return acc.map(v => 10 * Math.log10(v + 1e-12));
}

async function masterLoop(name: string): Promise<void> {
  const m = MUSIC_MASTERS[name];
  if (!m) throw new Error(`no MUSIC_MASTERS entry ${name}`);
  if (m.wholeFile) {
    await relevelLoop(m);
    return;
  }
  const src = m.source.startsWith('public/') ? path.resolve(m.source) : path.resolve('artifacts/music-candidates', m.source);
  const stereo = decode(src, MASTER_RATE, 2);
  const mono = decode(src, ANALYSIS_RATE, 1);
  const lenS = mono.length / ANALYSIS_RATE;
  const beat = 60 / m.bpm;
  const bar = beat * 4;
  const hop = 256;
  const hopS = hop / ANALYSIS_RATE;

  // 1. Snap S to the strongest onset within a beat of headS.
  const envHead = onsetEnvAt(mono, ANALYSIS_RATE, m.headS - beat, 2 * beat, hop);
  let bi = 0;
  for (let i = 0; i < envHead.length; i++) if (envHead[i] > envHead[bi]) bi = i;
  const S = m.headS - beat + bi * hopS;

  // 2. Search E.
  const W = 3;
  const refEnv = onsetEnvAt(mono, ANALYSIS_RATE, S, W, hop);
  const refSpec = logSpec(mono, ANALYSIS_RATE, S, W);
  let best = { E: 0, score: -Infinity, corr: 0, spec: 0 };
  for (const barsTry of [m.bars - 2, m.bars - 1, m.bars, m.bars + 1]) {
    const centre = S + barsTry * bar;
    if (centre + W + 0.5 > lenS) continue;
    for (let off = -beat / 8; off <= beat / 8; off += hopS) {
      const E = centre + off;
      const env = onsetEnvAt(mono, ANALYSIS_RATE, E, W, hop);
      const corr = correlate(Array.from(refEnv), Array.from(env).slice(0, refEnv.length));
      const spec = logSpec(mono, ANALYSIS_RATE, E, W);
      let d = 0;
      for (let i = 0; i < spec.length; i++) d += (spec[i] - refSpec[i]) ** 2;
      const specDist = Math.sqrt(d / spec.length);
      // Prefer the requested bar count a little: a ±1 bar loop is a fallback.
      const score = corr - specDist / 10 - (barsTry === m.bars ? 0 : 0.05);
      if (score > best.score) best = { E, score, corr, spec: specDist };
    }
  }
  if (!best.E) throw new Error('no loop end found');

  // Sample-level refine at MASTER_RATE: cross-correlate low-passed mono.
  const lp = (startS: number, n: number): Float64Array => {
    const out = new Float64Array(n);
    const s0 = Math.round(startS * MASTER_RATE);
    let y = 0;
    for (let i = 0; i < n; i++) {
      const v = (stereo[(s0 + i) * 2] + stereo[(s0 + i) * 2 + 1]) / 2;
      y += 0.02 * (v - y); // ~140Hz one-pole
      out[i] = y;
    }
    return out;
  };
  const N = Math.round(0.25 * MASTER_RATE);
  const a = lp(S, N);
  const maxShift = Math.round(0.008 * MASTER_RATE);
  let bestShift = 0;
  let bestXc = -Infinity;
  for (let sh = -maxShift; sh <= maxShift; sh += 4) {
    const b = lp(best.E + sh / MASTER_RATE, N);
    let xc = 0;
    for (let i = 0; i < N; i++) xc += a[i] * b[i];
    if (xc > bestXc) { bestXc = xc; bestShift = sh; }
  }
  const s0 = Math.round(S * MASTER_RATE);
  const e0 = Math.round(best.E * MASTER_RATE) + bestShift;
  const P = e0 - s0;
  const X = Math.round(m.xfadeBeats * beat * MASTER_RATE);
  if (e0 + X > stereo.length / 2) throw new Error('crossfade runs past the end of the source');

  // 3. Build the loop.
  const loop = new Float32Array(P * 2);
  for (let i = 0; i < P; i++) {
    for (let c = 0; c < 2; c++) {
      const head = stereo[(s0 + i) * 2 + c];
      if (i < X) {
        const t = i / X;
        const tail = stereo[(e0 + i) * 2 + c];
        loop[i * 2 + c] = head * Math.sin(t * Math.PI / 2) + tail * Math.cos(t * Math.PI / 2);
      } else {
        loop[i * 2 + c] = head;
      }
    }
  }

  await encodeLoop(m, loop, X, {
    startS: Math.round(S * 1000) / 1000,
    endS: Math.round((e0 / MASTER_RATE) * 1000) / 1000,
    bars: Math.round(((P / MASTER_RATE) / bar) * 1000) / 1000,
    matchCorr: Math.round(best.corr * 100) / 100,
    matchSpecDb: Math.round(best.spec * 100) / 100,
    sampleShift: bestShift,
  });
}

/**
 * A loop that is already a loop (the shipped `velvet-court.mp3`): decode it,
 * and re-encode it the same way as the new beds — normalised, wrap-padded.
 */
async function relevelLoop(m: MusicMaster): Promise<void> {
  const loop = decode(path.resolve(m.source), MASTER_RATE, 2);
  await encodeLoop(m, loop, 0, { bars: Math.round(((loop.length / 2 / MASTER_RATE) / (240 / m.bpm)) * 1000) / 1000 });
}

/**
 * Samples of wrap-around context written on each side of the loop. MP3 is
 * gapless here (the LAME header carries the encoder delay and padding, and
 * Chrome's decodeAudioData honours it — verified: decoded lengths are exact),
 * but gapless is not seamless: the first and last frames are decoded without
 * the overlap context of the frames that will actually neighbour them when
 * the buffer loops, and a click at the wrap measured 2–6× the loop's own
 * p99.9 second difference on two of four candidates. So the file is
 * [last PAD samples][loop][first PAD samples], and the engine loops between
 * `loopStart` and `loopEnd` (MUSIC_LOOPS in SoundEngine.ts) — the codec's edge
 * effects land in the padding, which is never played after the first pass.
 */
const PAD = 4096;

async function encodeLoop(m: MusicMaster, loop: Float32Array, X: number, meta: Record<string, number>): Promise<void> {
  const P = loop.length / 2;
  const padded = new Float32Array((P + 2 * PAD) * 2);
  padded.set(loop.subarray((P - PAD) * 2), 0);
  padded.set(loop, PAD * 2);
  padded.set(loop.subarray(0, PAD * 2), (PAD + P) * 2);

  // Normalise (two passes: MP3 moves integrated loudness by a few tenths). The
  // loudness is measured on the loop alone, not the padding.
  const tmpLoop = path.resolve('artifacts', `_loop_${m.out}.f32`);
  const tmp = path.resolve('artifacts', `_padded_${m.out}.f32`);
  await writeFile(tmpLoop, Buffer.from(loop.buffer, loop.byteOffset, loop.byteLength));
  await writeFile(tmp, Buffer.from(padded.buffer));
  const before = loudnessViaStderr(['-f', 'f32le', '-ar', String(MASTER_RATE), '-ac', '2', '-i', tmpLoop]);
  await mkdir(path.resolve('public/audio/music'), { recursive: true });
  const out = path.resolve('public/audio/music', `${m.out}.mp3`);
  const encode = (gainDb: number): void => {
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'f32le', '-ar', String(MASTER_RATE), '-ac', '2', '-i', tmp,
      '-af', `volume=${gainDb.toFixed(2)}dB`, '-c:a', 'libmp3lame', '-b:a', '128k', '-map_metadata', '-1', out]);
  };
  let gainDb = MUSIC_LUFS - before.lufs;
  encode(gainDb);
  let after = loudnessViaStderr(['-i', out]);
  if (Math.abs(after.lufs - MUSIC_LUFS) > 0.1) {
    gainDb += MUSIC_LUFS - after.lufs;
    encode(gainDb);
    after = loudnessViaStderr(['-i', out]);
  }
  const size = (await readFile(out)).length;

  // The seam, measured on the ENCODED file as a decoder returns it, looping
  // between PAD and PAD + P exactly as the engine will.
  const dec = decode(out, MASTER_RATE, 2);
  const decLen = dec.length / 2;
  const at = (i: number): number => {
    const j = PAD + (((i % P) + P) % P);
    return (dec[j * 2] + dec[j * 2 + 1]) / 2;
  };
  const pcm = (i: number): number => {
    const j = ((i % P) + P) % P;
    return ((loop[j * 2] + loop[j * 2 + 1]) / 2) * 10 ** (gainDb / 20);
  };
  // Click detector: the largest second difference within ±10ms of the wrap,
  // against the 99.9th percentile over the whole loop — for the decoded loop,
  // and for the PRE-ENCODE loop, which across the wrap is the source itself,
  // uninterrupted (the crossfade starts at full tail weight). Whatever the
  // second figure shows is the music; the seam is clean if the first is no
  // larger.
  const d2 = (f: (i: number) => number, i: number): number => Math.abs(f(i + 1) - 2 * f(i) + f(i - 1));
  const all: number[] = [];
  for (let i = 1; i < P - 1; i += 7) all.push(d2(at, i));
  all.sort((p, q) => p - q);
  const p999 = all[Math.floor(all.length * 0.999)];
  const w = Math.round(0.01 * MASTER_RATE);
  let atWrap = 0;
  let srcAtWrap = 0;
  for (let i = -w; i <= w; i++) {
    atWrap = Math.max(atWrap, d2(at, i));
    srcAtWrap = Math.max(srcAtWrap, d2(pcm, i));
  }
  // Flam detector: onset flux inside the crossfade (two copies overlapping)
  // against the loop's own p95. Doubled attacks push it up.
  const decMono = new Float32Array(P);
  for (let i = 0; i < P; i++) decMono[i] = at(i);
  const flux = Array.from(onsetEnvelope(stft(decMono, 1024, 512)));
  const sorted = [...flux].sort((p, q) => p - q);
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const xfFrames = flux.slice(0, Math.max(1, Math.ceil(X / 512)));
  const xfP95 = [...xfFrames].sort((p, q) => p - q)[Math.floor(xfFrames.length * 0.95)];

  const result = {
    out: `${m.out}.mp3`, bytes: size,
    loopStartS: PAD / MASTER_RATE, loopEndS: (PAD + P) / MASTER_RATE, periodS: Math.round((P / MASTER_RATE) * 1000) / 1000,
    bpm: m.bpm, xfadeBeats: m.xfadeBeats, ...meta,
    decodedLengthMatches: decLen === P + 2 * PAD,
    wrapClickRatio: Math.round((atWrap / p999) * 100) / 100,
    sourceAtWrapRatio: Math.round((srcAtWrap / p999) * 100) / 100,
    xfadeFluxRatio: X ? Math.round((xfP95 / p95) * 100) / 100 : null,
    lufs: after.lufs, lra: after.lra, truePeak: after.truePeak,
  };
  console.log(JSON.stringify(result));
  await writeFile(path.resolve('artifacts', `loop-${m.out}.json`), `${JSON.stringify({ ...result, source: m.source, why: m.why }, null, 2)}\n`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args[0] === 'analyze') {
    for (const f of args.slice(1)) analyzeMusic(f);
    return;
  }
  if (args[0] === 'master') {
    for (const name of args.slice(1)) await masterLoop(name);
    return;
  }
  const candidateId = args[0];

  if (!candidateId || !isCandidateId(candidateId)) {
    console.error(`Choose one candidate: ${Object.keys(candidates).join(', ')}`);
    process.exitCode = 1;
    return;
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error('Set ELEVENLABS_API_KEY in the shell running this script. Never expose it to the browser.');
  }

  const candidate = candidates[candidateId];
  const outputDirectory = parseOutputDirectory(args);
  await mkdir(outputDirectory, { recursive: true });

  console.log(`Generating ${candidate.title} (${candidate.durationMs / 1000}s)...`);
  const response = await fetch(`https://api.elevenlabs.io/v1/music?output_format=${OUTPUT_FORMAT}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
    },
    body: JSON.stringify({
      prompt: candidate.prompt,
      music_length_ms: candidate.durationMs,
      force_instrumental: true,
      model_id: MODEL_ID,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`ElevenLabs returned ${response.status}: ${detail}`);
  }

  const audio = Buffer.from(await response.arrayBuffer());
  const takeIndex = args.indexOf('--take');
  const take = takeIndex === -1 ? '' : `-t${args[takeIndex + 1]}`;
  const audioPath = path.join(outputDirectory, `${candidateId}${take}.mp3`);
  const metadataPath = path.join(outputDirectory, `${candidateId}${take}.json`);
  const generatedAt = new Date().toISOString();

  await Promise.all([
    writeFile(audioPath, audio),
    writeFile(metadataPath, `${JSON.stringify({
      candidateId,
      title: candidate.title,
      prompt: candidate.prompt,
      generatedAt,
      provider: 'ElevenLabs',
      modelId: MODEL_ID,
      outputFormat: OUTPUT_FORMAT,
      durationMs: candidate.durationMs,
      requestId: response.headers.get('request-id') ?? response.headers.get('x-request-id'),
      terms: 'https://elevenlabs.io/music-api-terms',
    }, null, 2)}\n`),
  ]);

  console.log(`Saved ${audioPath}`);
  console.log(`Saved ${metadataPath}`);
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
