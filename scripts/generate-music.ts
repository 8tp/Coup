/**
 * Music generation (ElevenLabs Music v2), analysis and mastering for the
 * adaptive score. Prompts and picks are DATA in this file; see docs/AUDIO.md
 * for what was generated, what was picked, and why.
 *
 *   credits                                 character_count / limit (needs the key)
 *   generate <id…> [--take N]               one candidate per id → artifacts/music-candidates/
 *   analyze <file…>                         key, tempo, loudness, LRA, low-end share, intro/outro shape
 *   analyze-candidates [id…]                `analyze` over every candidate file of each id
 *   master <id…> | master all               PIECE_MASTERS entry → public/audio/music/<out>.mp3
 *
 * The key is read from ELEVENLABS_API_KEY, e.g.
 *   npx tsx --env-file="$HOME/.config/elevenlabs/env" scripts/generate-music.ts generate court-whispering-gallery
 * Analysis and mastering need ffmpeg and never call the API.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fftInPlace } from '../tests/app/audio/analysis';

const OUTPUT_FORMAT = 'mp3_44100_128';
const MODEL_ID = 'music_v2';
const API = 'https://api.elevenlabs.io/v1';
const CANDIDATE_DIR = path.resolve('artifacts/music-candidates');

/** The engine's states, mirrored from `MusicState` in src/app/audio/SoundEngine.ts. */
type MusicState = 'lobby' | 'court' | 'tension' | 'duel' | 'sudden_death' | 'fallen';

/* ── prompts ──────────────────────────────────────────────────────────────────
 *
 * Every score piece is one BRIEF (mood, meter, tempo, key, which instrument
 * leads) plus two shared tails: the FORM (through-composed, soft intro, natural
 * outro) and the MIX RULES. The rules are the owner's complaint turned into
 * prompt text — "a super repetitive bass track … hard to hear anything else" —
 * so every piece is asked for a light low end and an uncluttered 1–4kHz band,
 * where the card and coin cues live. The engine's music-bus EQ does the rest.
 *
 * Variety is designed in, not hoped for: within a pool no two pieces share a
 * lead instrument, and the score spans 72–112 BPM in 4/4, 3/4 and 6/8.
 */
const MIX_RULES = 'Instrumental only: no vocals, no choir, no spoken word. '
  + 'A dark, decadent palace chamber ensemble of acoustic instruments, close and fairly dry, with a little candlelit-room reverb. '
  + 'Light low end: no bass ostinato, no walking or pulsing bass line, no sub-bass, no synth bass, no 808, no booming kick or low drum hits; '
  + 'cello and double bass appear only as rare, soft, sustained notes. '
  + 'Keep the upper-mid presence range uncluttered so game sound effects can be heard: no bright lead synths, no electric guitar, no crash cymbals, no constant hi-hats. '
  + 'Not EDM, not an epic movie trailer, not lo-fi hip hop, not horror.';

function form(seconds: number, intro: string): string {
  return `Through-composed, about ${seconds} seconds long: begin with a soft, sparse intro of a few seconds on ${intro}; `
    + 'develop through two or three contrasting sections with real variation, no section repeated identically and no constant loop; '
    + 'close with a natural, quiet outro that thins out to a final soft note decaying to silence. No abrupt ending.';
}

interface ScorePiece {
  readonly state: MusicState;
  readonly title: string;
  readonly durationMs: number;
  readonly bpm: number;
  readonly meter: '4/4' | '3/4' | '6/8';
  readonly brief: string;
  readonly intro: string;
}

/**
 * The adaptive score (2026-10-02). Ids are `<state>-<name>`; a mastered pick is
 * `public/audio/music/<id>.mp3`.
 */
export const SCORE: Record<string, ScorePiece> = {
  // ── lobby: inviting, unhurried ──────────────────────────────────────────
  'lobby-antechamber-waltz': {
    state: 'lobby', title: 'The Antechamber Waltz', durationMs: 120_000, bpm: 80, meter: '3/4',
    intro: 'solo harp',
    brief: 'Gentle, inviting lobby music for an elegant court-intrigue card game while the guests gather. '
      + '3/4 waltz time at 80 BPM, F major turning to D minor and back. Lead: a warm solo clarinet melody in its middle register, '
      + 'over lightly plucked harp and pizzicato violins; a harpsichord adds delicate broken chords and a celesta glints at phrase ends. '
      + 'Unhurried, gracious and faintly mischievous, like a candlelit palace antechamber before a scheme begins.',
  },
  'lobby-petitioners-bench': {
    state: 'lobby', title: "Petitioners' Bench", durationMs: 120_000, bpm: 72, meter: '4/4',
    intro: 'solo felt piano',
    brief: 'Calm, welcoming waiting-room music for a court-intrigue card game. 4/4 at 72 BPM, G minor with warm major-key turns. '
      + 'Lead: a felt-dampened prepared piano playing a simple, lyrical tune in the middle and upper register, answered by a muted French horn '
      + 'and a soft viola line; vibraphone and glass harmonica shimmer behind; a hand drum played with brushes, very quietly. '
      + 'Patient, curious and a little wry — a ministry waiting room with velvet chairs and propaganda posters on the walls.',
  },

  // ── court: sly intrigue, ≥3 alive and calm ──────────────────────────────
  'court-whispering-gallery': {
    state: 'court', title: 'Whispering Gallery', durationMs: 150_000, bpm: 92, meter: '4/4',
    intro: 'a few tiptoeing pizzicato violin notes',
    brief: 'Sly court-intrigue underscore for a bluffing card game in a decadent dystopian palace. 4/4 at 92 BPM, D minor. '
      + 'Lead: tiptoeing pizzicato violins and violas trade a sneaky staccato motif with a bassoon playing a sly, comic-sinister counter-melody '
      + 'in its tenor register; woodblock and clockwork ticks keep light time; an occasional muted trumpet comments. '
      + 'Cunning, playful and conspiratorial — secrets whispered along marble corridors.',
  },
  'court-ministry-minuet': {
    state: 'court', title: 'The Ministry Minuet', durationMs: 150_000, bpm: 96, meter: '3/4',
    intro: 'solo harpsichord',
    brief: 'Elegant, scheming court dance for a bluffing card game set in a decadent dystopian ministry. A minuet in 3/4 at 96 BPM, A minor. '
      + 'Lead: harpsichord carrying an ornamented, slightly crooked dance melody, with a muted trumpet answering its phrases and bowed violins '
      + 'sustaining thin, high harmonies; tambourine and finger cymbals lightly mark the downbeats. '
      + 'Polite on the surface and poisonous underneath — courtiers smiling while they lie.',
  },
  'court-ledger-and-quill': {
    state: 'court', title: 'Ledger and Quill', durationMs: 140_000, bpm: 100, meter: '4/4',
    intro: 'a ticking metronome and a few plinks of prepared piano',
    brief: 'Busy, clever bureaucratic-intrigue underscore for a bluffing card game set in a propaganda-poster ministry. 4/4 at 100 BPM, E minor. '
      + 'Lead: a staccato oboe and clarinet duet in interlocking lines over a high, plinky prepared-piano ostinato in the upper-middle register; '
      + 'light hand percussion, typewriter-like clicks and a ticking metronome. '
      + "Precise, wry and suspicious — clerks forging documents behind each other's backs.",
  },
  'court-velvet-procession': {
    state: 'court', title: 'Velvet Procession', durationMs: 140_000, bpm: 76, meter: '4/4',
    intro: 'soft castanets and harp',
    brief: 'Slow, seductive intrigue for a decadent court card game. 4/4 at 76 BPM in a habanera rhythm, C minor. '
      + 'Lead: a bowed solo viola with a sultry, sliding melody, supported by a harmonium (reed organ) in its middle register, harp and celesta; '
      + 'castanets and tambourine keep a soft habanera pattern. Languid, sly and dangerous, like a masked ball where everyone is bluffing.',
  },

  // ── tension: ≥3 alive, someone on their last card or a Coup on the table ──
  'tension-counting-house': {
    state: 'tension', title: 'The Counting House', durationMs: 125_000, bpm: 104, meter: '4/4',
    intro: 'a ticking clock and a single tremolo violin',
    brief: 'Suspenseful underscore for the moment a coup is threatened in a bluffing card game set in a dystopian palace. 4/4 at 104 BPM, B minor. '
      + 'Lead: tremolo and spiccato violins in a nervous mid-register pulse; a ticking clock and woodblock in eighth notes; '
      + 'muted French horn swells; a celesta playing small, unsettling dissonant figures. '
      + 'Restrained but anxious, with rising pressure and no climax — quiet enough to sit under conversation.',
  },
  'tension-quiet-knife': {
    state: 'tension', title: 'The Quiet Knife', durationMs: 125_000, bpm: 96, meter: '6/8',
    intro: 'soft frame drum taps and alto flute',
    brief: 'Taut, suspicious underscore for a court-intrigue card game when someone is close to elimination. 6/8 at 96 BPM, F-sharp minor. '
      + 'Lead: spiccato violas and second violins in a circling 6/8 ostinato in the middle register, harpsichord stabs on the off-beats, '
      + 'a breathy alto flute with flutter-tongue phrases, soft frame drum taps. Held breath, steady pulse, controlled menace — tense but never loud.',
  },

  // ── duel: exactly two alive ─────────────────────────────────────────────
  'duel-two-chairs-remain': {
    state: 'duel', title: 'Two Chairs Remain', durationMs: 120_000, bpm: 108, meter: '4/4',
    intro: 'a quiet spiccato violin figure',
    brief: 'Dramatic duel music for the final two players of a court-intrigue card game. 4/4 at 108 BPM, D minor. '
      + 'Driving spiccato violin and viola ostinati in sixteenth notes, staccato brass stabs from muted trumpets and French horns, '
      + 'tuned frame drums and high-pitched taiko patterns with no deep booms; a defiant solo horn melody enters mid-piece. '
      + 'Intense, propulsive and elegant — a sword duel in a gilded hall — but with clear headroom and a light low end.',
  },
  'duel-audience-of-one': {
    state: 'duel', title: 'Audience of One', durationMs: 120_000, bpm: 112, meter: '4/4',
    intro: 'solo harpsichord',
    brief: 'Relentless, dramatic duel music for the last two schemers in a court-intrigue card game. 4/4 at 112 BPM, G minor. '
      + 'Lead: harpsichord and pizzicato strings in interlocking sixteenth notes, col legno violins, a snare-like frame drum and hand drums, '
      + 'short brass stabs from trumpets and trombones in their middle register, a cello line in its tenor register that never becomes a bass line. '
      + 'Urgent, clever and cutting — a chess game played at speed.',
  },
  'duel-crossed-signets': {
    state: 'duel', title: 'Crossed Signets', durationMs: 115_000, bpm: 104, meter: '6/8',
    intro: 'a frame drum and a muted horn call',
    brief: 'Galloping, dramatic duel music for a two-player showdown in a court-intrigue card game. 6/8 at 104 BPM, C minor. '
      + 'A galloping string ostinato in violins and violas, a bodhrán-style frame drum, muted horn calls answering each other, '
      + 'clarinet trills and tambourine. Heroic tension without bombast — two rivals circling each other.',
  },

  // ── sudden death: two alive, both on their last card ────────────────────
  'sudden-death-one-card-each': {
    state: 'sudden_death', title: 'One Card Each', durationMs: 110_000, bpm: 112, meter: '4/4',
    intro: 'a ticking clock and tremolo strings',
    brief: 'Climactic final-showdown music for a court-intrigue card game where both players have one card left. 4/4 at 112 BPM, E minor. '
      + 'Relentless driving string ostinato in violins and violas, spiccato and tremolo; urgent brass stabs and rising horn calls; '
      + 'mid-pitched taiko and frame drums in insistent patterns; a ticking clock. Builds in waves of rising tension without a big release. '
      + 'The most intense piece of the score, yet tight, dry and controlled, with no deep sub-bass and no trailer booms.',
  },
  'sudden-death-final-wager': {
    state: 'sudden_death', title: 'The Final Wager', durationMs: 100_000, bpm: 108, meter: '6/8',
    intro: 'a single tremolo viola',
    brief: 'Feverish last-stand music for a court-intrigue card game, two players each on their final card. 6/8 at 108 BPM, B-flat minor. '
      + 'Whirling violin and viola ostinato, harpsichord hammering repeated notes, muted trumpets and horns in tight stabbing chords, '
      + 'frame drums and tambourine driving the compound meter. Breathless and climactic, yet light in the low end.',
  },

  // ── fallen: the local player is out, the game goes on ───────────────────
  'fallen-from-the-gallery': {
    state: 'fallen', title: 'From the Gallery', durationMs: 110_000, bpm: 72, meter: '4/4',
    intro: 'solo celesta',
    brief: 'Sparse, melancholy-but-curious music for a player who has been eliminated and now watches the rest of a court-intrigue card game from the gallery. '
      + '4/4 at 72 BPM, A minor. Lead: a solo celesta and music-box melody, sparse harp, a distant muted viola sustaining long notes, soft clock ticks. '
      + 'Quiet, reflective and a little wry, as if watching through a keyhole; lots of space between phrases.',
  },
  'fallen-after-the-verdict': {
    state: 'fallen', title: 'After the Verdict', durationMs: 105_000, bpm: 76, meter: '3/4',
    intro: 'harp arpeggios',
    brief: 'Quiet, rueful music for a player knocked out of a court-intrigue card game, watching the others play on. 3/4 at 76 BPM, D minor. '
      + 'Lead: a solo clarinet in its low-middle register with a wistful, slightly ironic melody; harp arpeggios, glass harmonica, '
      + 'a few pizzicato viola notes. Sparse, intimate and curious rather than tragic.',
  },
};

function scorePrompt(p: ScorePiece): string {
  return `${p.brief} ${form(Math.round(p.durationMs / 1000), p.intro)} ${MIX_RULES}`;
}

/** The two endgame stingers (Aug 2026), unchanged. */
const STINGERS = {
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
} as const;

interface Candidate { title: string; durationMs: number; prompt: string }

function candidate(id: string): Candidate | undefined {
  if (id in SCORE) {
    const p = SCORE[id];
    return { title: p.title, durationMs: p.durationMs, prompt: scorePrompt(p) };
  }
  return (STINGERS as Record<string, Candidate>)[id];
}

/* ── API ──────────────────────────────────────────────────────────────────── */

function apiKey(): string {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error('Set ELEVENLABS_API_KEY in the shell running this script (e.g. tsx --env-file). Never expose it to the browser.');
  return key;
}

async function credits(): Promise<void> {
  const response = await fetch(`${API}/user/subscription`, { headers: { 'xi-api-key': apiKey() } });
  if (!response.ok) throw new Error(`subscription: ${response.status}`);
  const d = await response.json() as { tier?: string; character_count?: number; character_limit?: number };
  const used = d.character_count ?? 0;
  const limit = d.character_limit ?? 0;
  console.log(JSON.stringify({ tier: d.tier, character_count: used, character_limit: limit, remaining: limit - used }));
}

async function generate(id: string, take: number): Promise<void> {
  const c = candidate(id);
  if (!c) throw new Error(`unknown candidate ${id}; choose one of ${[...Object.keys(SCORE), ...Object.keys(STINGERS)].join(', ')}`);
  await mkdir(CANDIDATE_DIR, { recursive: true });
  const audioPath = path.join(CANDIDATE_DIR, `${id}-t${take}.mp3`);
  if (existsSync(audioPath)) {
    console.log(`exists, skipping: ${audioPath}`);
    return;
  }
  console.log(`Generating ${c.title} take ${take} (${c.durationMs / 1000}s)…`);
  const response = await fetch(`${API}/music?output_format=${OUTPUT_FORMAT}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'xi-api-key': apiKey() },
    body: JSON.stringify({
      prompt: c.prompt,
      music_length_ms: c.durationMs,
      force_instrumental: true,
      model_id: MODEL_ID,
    }),
  });
  if (!response.ok) throw new Error(`ElevenLabs returned ${response.status}: ${await response.text()}`);
  const audio = Buffer.from(await response.arrayBuffer());
  await writeFile(audioPath, audio);
  await writeFile(audioPath.replace(/\.mp3$/, '.json'), `${JSON.stringify({
    candidateId: id,
    take,
    title: c.title,
    prompt: c.prompt,
    generatedAt: new Date().toISOString(),
    provider: 'ElevenLabs',
    modelId: MODEL_ID,
    outputFormat: OUTPUT_FORMAT,
    durationMs: c.durationMs,
    requestId: response.headers.get('request-id') ?? response.headers.get('x-request-id'),
    terms: 'https://elevenlabs.io/music-api-terms',
  }, null, 2)}\n`);
  console.log(`Saved ${audioPath} (${(audio.length / 1024).toFixed(0)} KB)`);
}

/* ── analysis ─────────────────────────────────────────────────────────────── */

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
function loudnessOf(input: string[]): Loudness {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...input, '-af', 'ebur128=peak=true:framelog=quiet', '-f', 'null', '-'],
    { encoding: 'utf8' });
  return parseLoudness(r.stderr);
}

/** Short-term (3s) loudness, one value per 0.1s, from ffmpeg's ebur128 frame log. */
function shortTermProfile(input: string[]): { t: number; s: number }[] {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...input, '-af', 'ebur128', '-f', 'null', '-'], { encoding: 'utf8' });
  const out: { t: number; s: number }[] = [];
  for (const line of r.stderr.split('\n')) {
    const m = line.match(/t:\s*([\d.]+).*S:\s*(-?[\d.]+|-inf)/);
    if (m) out.push({ t: Number(m[1]), s: m[2] === '-inf' ? -120 : Number(m[2]) });
  }
  return out;
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

function autocorr(env: Float64Array): (lag: number) => number {
  const mean = env.reduce((s, v) => s + v, 0) / env.length;
  const e = env.map(v => v - mean);
  return (L: number): number => {
    const l0 = Math.floor(L);
    const frac = L - l0;
    let s = 0;
    for (let i = 0; i + l0 + 1 < e.length; i++) s += e[i] * ((1 - frac) * e[i + l0] + frac * e[i + l0 + 1]);
    return s;
  };
}

/**
 * Tempo near a nominal BPM (the prompt's): the comb of autocorrelation lags at
 * 1…16 beats, summed, over ±12% of the nominal and its half and double. A
 * single-lag peak cannot tell 84.0 from 83.6; 16 beats of drift can.
 */
function estimateTempo(env: Float64Array, hopS: number, nominal: number): number {
  const ac = autocorr(env);
  let best = nominal;
  let bestV = -Infinity;
  for (const scale of [0.5, 1, 2]) {
    const centre = nominal * scale;
    if (centre < 50 || centre > 200) continue;
    for (let bpm = centre * 0.88; bpm <= centre * 1.12; bpm += 0.05) {
      const lag = 60 / bpm / hopS;
      let v = 0;
      for (let k = 1; k <= 16; k++) v += ac(lag * k);
      // A small prior for the asked-for octave: half/double must clearly win.
      if (scale !== 1) v *= 0.9;
      if (v > bestV) { bestV = v; best = bpm; }
    }
  }
  return Math.round(best * 10) / 10;
}

/** Linear share (%) of long-term spectral energy in [lo, hi) Hz. */
function bandPercent(frames: Float64Array[], n: number, rate: number, lo: number, hi: number): number {
  let band = 0; let total = 0;
  for (const mag of frames) {
    for (let k = 1; k < mag.length; k++) {
      const f = (k * rate) / n;
      const p = mag[k] * mag[k];
      total += p;
      if (f >= lo && f < hi) band += p;
    }
  }
  return Math.round((band / total) * 1000) / 10;
}

export interface MusicAnalysis {
  file: string;
  seconds: number;
  key: string;
  keyR: number;
  bpm: number;
  lufs: number;
  lra: number;
  truePeak: number;
  /** Linear % of energy below 150Hz. */
  lowPct: number;
  /** Linear % of energy in 1–4kHz — where the cues live. */
  presencePct: number;
  /** Seconds from the start until short-term loudness first reaches integrated − 6 LU. */
  introS: number;
  /** Seconds from the last short-term value ≥ integrated − 6 LU to the end. */
  outroS: number;
  /** Short-term loudness 1s before the end, relative to integrated (LU). An abrupt end sits near 0. */
  endLu: number;
  /** Short-term loudness every 10s, LUFS. */
  profile: number[];
}

function analyzeMusic(file: string, nominalBpm = 96): MusicAnalysis {
  const x = decode(file, ANALYSIS_RATE, 1);
  const seconds = x.length / ANALYSIS_RATE;
  const n = 4096;
  const frames = stft(x, n, 2048);
  const key = estimateKey(frames, n);
  const bpm = estimateTempo(onsetEnvelope(stft(x, 1024, 256)), 256 / ANALYSIS_RATE, nominalBpm);
  const l = loudnessOf(['-i', file]);
  const st = shortTermProfile(['-i', file]);
  const loudEnough = (s: number): boolean => s >= l.lufs - 6;
  const first = st.find(p => p.t >= 3 && loudEnough(p.s));
  const lastIdx = (() => { for (let i = st.length - 1; i >= 0; i--) if (loudEnough(st[i].s)) return i; return -1; })();
  // The ebur128 short-term window is 3s and looks back, so subtract the window
  // from "first loud" to get when the music actually arrived.
  const introS = first ? Math.max(0, first.t - 3) : seconds;
  const outroS = lastIdx >= 0 ? Math.max(0, seconds - st[lastIdx].t + 1.5) : seconds;
  const end = st.filter(p => p.t <= seconds - 1).at(-1);
  const profile: number[] = [];
  for (let t = 10; t <= seconds; t += 10) {
    const p = st.find(q => q.t >= t);
    if (p) profile.push(Math.round(p.s));
  }
  return {
    file: path.basename(file), seconds: Math.round(seconds * 10) / 10, key: key.key, keyR: key.r, bpm,
    lufs: l.lufs, lra: l.lra, truePeak: l.truePeak,
    lowPct: bandPercent(frames, n, ANALYSIS_RATE, 0, 150),
    presencePct: bandPercent(frames, n, ANALYSIS_RATE, 1000, 4000),
    introS: Math.round(introS * 10) / 10, outroS: Math.round(outroS * 10) / 10,
    endLu: end ? Math.round((end.s - l.lufs) * 10) / 10 : NaN,
    profile,
  };
}

function printAnalysis(a: MusicAnalysis): void {
  console.log(`${a.file.padEnd(40)} ${a.seconds.toFixed(1)}s  ${a.key} (r ${a.keyR})  ${a.bpm} BPM  `
    + `${a.lufs} LUFS  LRA ${a.lra}  TP ${a.truePeak}  <150Hz ${a.lowPct}%  1–4kHz ${a.presencePct}%  `
    + `intro ${a.introS}s  outro ${a.outroS}s  end ${a.endLu} LU\n${''.padEnd(40)} S every 10s: ${a.profile.join(' ')}`);
}

function idOfCandidate(file: string): string | undefined {
  const base = path.basename(file).replace(/-t\d+\.mp3$/, '').replace(/\.mp3$/, '');
  return base in SCORE ? base : undefined;
}

async function analyzeCandidates(ids: string[]): Promise<void> {
  const files = (await readdir(CANDIDATE_DIR)).filter(f => f.endsWith('.mp3')).sort();
  const want = ids.length ? ids : Object.keys(SCORE);
  const all: MusicAnalysis[] = [];
  for (const f of files) {
    const id = idOfCandidate(f);
    if (!id || !want.includes(id)) continue;
    const a = analyzeMusic(path.join(CANDIDATE_DIR, f), SCORE[id].bpm);
    printAnalysis(a);
    all.push(a);
  }
  await writeFile(path.resolve('artifacts/music-candidates-analysis.json'), `${JSON.stringify(all, null, 2)}\n`);
}

/* ── mastering ────────────────────────────────────────────────────────────────
 *
 * A through-composed piece needs no loop surgery — it needs a clean start, a
 * clean end, a consistent level, and the point where the engine should hand
 * over to the next piece in its pool.
 *
 *   1. Trim the head and tail where the 100ms RMS is more than 40dB under the
 *      BODY level (median 1s RMS) — a take that opens on ten seconds of room
 *      tone, or rings on after its last note, is silent for this purpose.
 *   2. Find where the body arrives (4s-smoothed RMS within 4dB of the body)
 *      and where it ends (last point within 6dB).
 *   3. Intro: if the first 2s already sit within 6dB of the body, it is a hot
 *      start — fade it in over FADE_IN_HOT_S; otherwise a 60ms de-click fade.
 *   4. Outro: if the last 3s still sit within 6dB of the body (an abrupt end —
 *      generation stopped at the requested length mid-phrase), fade the last
 *      FADE_OUT_ABRUPT_S; otherwise the piece decays on its own and gets a 1.2s
 *      fade so the final sample is a true zero.
 *   5. High-pass at 35Hz (2nd order): sub-sonic energy no speaker plays only
 *      costs headroom. The real low-end shaping is the engine's music-bus EQ —
 *      one place, measured in the browser.
 *   6. Normalise to the state's LUFS target (two passes — MP3 moves integrated
 *      loudness by a few tenths), through a −1.5dBFS lookahead limiter (two
 *      takes came back at −0.7 / −0.9 dBTP once levelled), encode 112 kbps
 *      stereo MP3.
 *   7. Measure on the ENCODED file as a decoder returns it: loudness, low-end
 *      share, and clicks at both edges (largest second difference in the first /
 *      last 20ms against the piece's own p99.9).
 *   8. Three points on the bar grid (onset-comb downbeat at the measured tempo):
 *      `handoffS`, the first bar line ≥2s after the body ends (the final
 *      cadence is heard), where the engine starts the next piece of the pool and
 *      fades this one out; `entryS`, the bar where the body has arrived, where a
 *      STATE CHANGE enters this piece (a crossfade into tension must sound like
 *      tension, not like a soft intro); `leadInS`, a bar ~LEAD_IN_S before that,
 *      where a handoff WITHIN the pool enters, so each piece keeps a short
 *      run-up of its own.
 */
interface PieceMaster {
  /** Candidate file in artifacts/music-candidates. */
  readonly source: string;
  readonly why: string;
}

/** Beats per bar, counting a 6/8 bar as two dotted-quarter beats at the prompt's BPM. */
const BEATS_PER_BAR: Record<ScorePiece['meter'], number> = { '4/4': 4, '3/4': 3, '6/8': 2 };

const MASTER_RATE = 44100;
const BITRATE = '112k';
const FADE_IN_HOT_S = 2.5;
const FADE_OUT_ABRUPT_S = 7;
const HANDOFF_BEFORE_END_S = 5;
/** Below the body by this much is silence, for trimming. */
const TRIM_BELOW_BODY_DB = 40;
/** A handoff within a pool starts the next piece this far before its entry. */
const LEAD_IN_S = 8;
/** The body a state change enters must run at least this long before the handoff. */
const MIN_BODY_S = 60;

/** Integrated loudness per state. Duel and sudden death sit 1.5 LU hotter. */
export const STATE_LUFS: Record<MusicState, number> = {
  lobby: -20, court: -20, tension: -20, fallen: -20, duel: -18.5, sudden_death: -18.5,
};

/** The picks. Filled in from `analyze-candidates`; see docs/AUDIO.md. */
export const PIECE_MASTERS: Record<string, PieceMaster> = {
  'lobby-antechamber-waltz': {
    source: 'lobby-antechamber-waltz-t1.mp3',
    why: 'only take; 1.1% <150Hz, LRA 10.2, a 16s natural outro',
  },
  'lobby-petitioners-bench': {
    source: 'lobby-petitioners-bench-t2.mp3',
    why: "take 2: LRA 7.2 against take 1's 20.5 (t1 swung ±4 LU every ten seconds); 1% <150Hz, 0.2% in 1–4kHz",
  },
  'court-whispering-gallery': {
    source: 'court-whispering-gallery-t1.mp3',
    why: 'only take; 8.2% <150Hz, 1.5% in 1–4kHz; the body ends at ~114s into a 20s soft outro',
  },
  'court-ministry-minuet': {
    source: 'court-ministry-minuet-t1.mp3',
    why: 'only take; LRA 2.8 (the steadiest court piece), 1.1% <150Hz; starts hot so it gets the 2.5s fade-in',
  },
  'court-ledger-and-quill': {
    source: 'court-ledger-and-quill-t2.mp3',
    why: 'take 2: take 1 put 43% of its energy in 1–4kHz — the cue band — and climbed 13 LU to an abrupt end (−11.8 LU one second out); '
      + 't2 holds −19…−24 LUFS short-term with 12.7% in 1–4kHz and a 28s natural outro',
  },
  'court-velvet-procession': {
    source: 'court-velvet-procession-t1.mp3',
    why: 'only take; 0.7% <150Hz, C minor (r 0.87); grows across its length (LRA 17.7), so a state change enters at its body',
  },
  'tension-counting-house': {
    source: 'tension-counting-house-t1.mp3',
    why: 'only take; 0.1% <150Hz; a 27s build, so a state change enters at the body (entryS)',
  },
  'tension-quiet-knife': {
    source: 'tension-quiet-knife-t1.mp3',
    why: 'only take; LRA 3.7, dead steady at −19 short-term; 40% in 1–4kHz (flute + harpsichord) — checked by the masking gate',
  },
  'duel-two-chairs-remain': {
    source: 'duel-two-chairs-remain-t1.mp3',
    why: 'only take; LRA 4.2, D minor, 18s natural outro; 27% <150Hz before the bus EQ',
  },
  'duel-audience-of-one': {
    source: 'duel-audience-of-one-t1.mp3',
    why: 'only take; LRA 4.8; returned 110s and stops mid-phrase (−15.5 LU one second out), so it gets the 7s synthetic fade',
  },
  'duel-crossed-signets': {
    source: 'duel-crossed-signets-t1.mp3',
    why: 'only take; 0.6% <150Hz — the lightest duel piece — 6/8, natural 15s outro',
  },
  'sudden-death-one-card-each': {
    source: 'sudden-death-one-card-each-t1.mp3',
    why: 'take 1 over take 2 (same prompt): E minor as asked (t2 read D major, r 0.82), and its body arrives at ~11s where t2 builds '
      + 'for 31s, so a state change into it lands at once; both carry ~42% <150Hz before the bus EQ (mid-pitched taiko)',
  },
  'sudden-death-final-wager': {
    source: 'sudden-death-final-wager-t1.mp3',
    why: 'only take; different instrumentation (6/8, harpsichord) from one-card-each; 25% <150Hz; a short full-level body',
  },
  'fallen-from-the-gallery': {
    source: 'fallen-from-the-gallery-t1.mp3',
    why: 'only take; 0% <150Hz, 0.8% in 1–4kHz, steady −20…−22 short-term — exactly the quiet watcher asked for',
  },
  'fallen-after-the-verdict': {
    source: 'fallen-after-the-verdict-t1.mp3',
    why: "take 1 over take 2: LRA 13.4 vs 18.2 and ~70s of body against t2's ~50s (t2 sinks to −42 by 80s); "
      + 't1 opens on 10s of near-silence, which the body-relative trim removes',
  },
};

function shortRms(x: Float32Array, rate: number, startS: number, durS: number): number {
  const s = Math.max(0, Math.round(startS * rate));
  const e = Math.min(x.length / 2, Math.round((startS + durS) * rate));
  let sum = 0;
  for (let i = s; i < e; i++) sum += x[i * 2] ** 2 + x[i * 2 + 1] ** 2;
  return Math.sqrt(sum / Math.max(1, (e - s) * 2));
}

const dbOf = (v: number): number => 20 * Math.log10(Math.max(v, 1e-12));

/** Downbeat phase (s) at `bpm`: the bar offset whose comb of onsets is strongest. */
function downbeatPhase(mono: Float32Array, rate: number, bpm: number, beatsPerBar: number): number {
  const hop = 256;
  const env = onsetEnvelope(stft(mono, 1024, hop));
  const hopS = hop / rate;
  const beat = 60 / bpm;
  // Beat phase first, then which beat of the bar is the strongest.
  let bestPhase = 0; let bestV = -Infinity;
  for (let ph = 0; ph < beat; ph += hopS) {
    let v = 0;
    for (let t = ph; t / hopS < env.length; t += beat) v += env[Math.round(t / hopS)] ?? 0;
    if (v > bestV) { bestV = v; bestPhase = ph; }
  }
  let bestBar = 0; bestV = -Infinity;
  for (let b = 0; b < beatsPerBar; b++) {
    let v = 0;
    for (let t = bestPhase + b * beat; t / hopS < env.length; t += beat * beatsPerBar) v += env[Math.round(t / hopS)] ?? 0;
    if (v > bestV) { bestV = v; bestBar = b; }
  }
  return bestPhase + bestBar * beat;
}

async function masterPiece(id: string): Promise<Record<string, unknown>> {
  const m = PIECE_MASTERS[id];
  const piece = SCORE[id];
  if (!m || !piece) throw new Error(`no PIECE_MASTERS/SCORE entry ${id}`);
  const src = path.resolve(CANDIDATE_DIR, m.source);
  const pre = analyzeMusic(src, piece.bpm);
  const raw = decode(src, MASTER_RATE, 2);
  const frames = raw.length / 2;

  // 1–2. Trim, against the BODY level (median 1s RMS) rather than the peak: a
  // take that opens with ten seconds of room tone at −54 LUFS is "silent" for
  // this purpose, and so is the last ring of reverb after the final note.
  const rawS = frames / MASTER_RATE;
  const rawRms: number[] = [];
  for (let t = 0; t + 1 <= rawS; t += 1) rawRms.push(dbOf(shortRms(raw, MASTER_RATE, t, 1)));
  const rawBody = [...rawRms].sort((a, b) => a - b)[Math.floor(rawRms.length / 2)];
  const win = 0.1;
  let firstT = 0;
  while (firstT < rawS - win && dbOf(shortRms(raw, MASTER_RATE, firstT, win)) < rawBody - TRIM_BELOW_BODY_DB) firstT += win;
  const first = Math.max(0, Math.round((firstT - 0.05) * MASTER_RATE));
  let lastT = rawS - win;
  while (lastT > firstT && dbOf(shortRms(raw, MASTER_RATE, lastT, win)) < rawBody - TRIM_BELOW_BODY_DB) lastT -= win;
  const last = Math.min(frames, Math.round((lastT + win + 0.5) * MASTER_RATE));
  const x = raw.slice(first * 2, last * 2);
  const n = x.length / 2;
  const lenS = n / MASTER_RATE;

  // Body level of the trimmed piece: the reference for "hot", "abrupt", where
  // the body arrives (entry) and where it ends (handoff).
  const rmsDb: number[] = [];
  for (let t = 0; t + 1 <= lenS; t += 1) rmsDb.push(dbOf(shortRms(x, MASTER_RATE, t, 1)));
  const body = [...rmsDb].sort((a, b) => a - b)[Math.floor(rmsDb.length / 2)];
  const hotStart = dbOf(shortRms(x, MASTER_RATE, 0, 2)) > body - 6;
  const abruptEnd = dbOf(shortRms(x, MASTER_RATE, lenS - 3, 3)) > body - 6;
  const fadeIn = hotStart ? FADE_IN_HOT_S : 0.06;
  const fadeOut = abruptEnd ? FADE_OUT_ABRUPT_S : 1.2;
  // Smoothed over 4s so one loud bar in an intro is not "the body arriving".
  const smooth = (t: number): number => dbOf(shortRms(x, MASTER_RATE, Math.max(0, t - 2), 4));
  let arrive = 0;
  while (arrive < lenS / 2 && smooth(arrive) < body - 4) arrive += 0.25;
  let bodyEnd = lenS;
  while (bodyEnd > lenS / 2 && smooth(bodyEnd) < body - 6) bodyEnd -= 0.25;

  // 3–4. Fades (raised cosine, so both ends meet zero with zero slope).
  const fi = Math.round(fadeIn * MASTER_RATE);
  const fo = Math.round(fadeOut * MASTER_RATE);
  for (let i = 0; i < n; i++) {
    let g = 1;
    if (i < fi) g *= 0.5 - 0.5 * Math.cos((Math.PI * i) / fi);
    if (i >= n - fo) g *= 0.5 - 0.5 * Math.cos((Math.PI * (n - 1 - i)) / fo);
    x[i * 2] *= g;
    x[i * 2 + 1] *= g;
  }

  // 5–6. HPF, normalise, encode.
  await mkdir(path.resolve('artifacts'), { recursive: true });
  const tmp = path.resolve('artifacts', `_piece_${id}.f32`);
  await writeFile(tmp, Buffer.from(x.buffer, x.byteOffset, x.byteLength));
  const pcmIn = ['-f', 'f32le', '-ar', String(MASTER_RATE), '-ac', '2', '-i', tmp];
  const target = STATE_LUFS[piece.state];
  const before = loudnessOf([...pcmIn, '-af', 'highpass=f=35:p=2']);
  await mkdir(path.resolve('public/audio/music'), { recursive: true });
  const out = path.resolve('public/audio/music', `${id}.mp3`);
  const encode = (gainDb: number): void => {
    execFileSync('ffmpeg', ['-v', 'error', '-y', ...pcmIn,
      '-af', `highpass=f=35:p=2,volume=${gainDb.toFixed(2)}dB,alimiter=limit=0.84:attack=5:release=80:level=false`, '-c:a', 'libmp3lame', '-b:a', BITRATE, '-ac', '2',
      '-map_metadata', '-1', '-id3v2_version', '0', '-write_xing', '1', out]);
  };
  let gainDb = target - before.lufs;
  encode(gainDb);
  let after = loudnessOf(['-i', out]);
  if (Math.abs(after.lufs - target) > 0.1) {
    gainDb += target - after.lufs;
    encode(gainDb);
    after = loudnessOf(['-i', out]);
  }
  const bytes = (await readFile(out)).length;

  // 7. Measure the encoded file.
  const dec = decode(out, MASTER_RATE, 2);
  const dn = dec.length / 2;
  const mono = new Float32Array(dn);
  for (let i = 0; i < dn; i++) mono[i] = (dec[i * 2] + dec[i * 2 + 1]) / 2;
  const d2 = (i: number): number => Math.abs(mono[i + 1] - 2 * mono[i] + mono[i - 1]);
  const all: number[] = [];
  for (let i = 1; i < dn - 1; i += 5) all.push(d2(i));
  all.sort((a, b) => a - b);
  const p999 = all[Math.floor(all.length * 0.999)];
  const edge = Math.round(0.02 * MASTER_RATE);
  let headClick = 0; let tailClick = 0;
  for (let i = 1; i < edge; i++) headClick = Math.max(headClick, d2(i));
  for (let i = dn - edge; i < dn - 1; i++) tailClick = Math.max(tailClick, d2(i));
  const firstAbs = Math.max(Math.abs(dec[0]), Math.abs(dec[1]));
  const lastAbs = Math.max(Math.abs(dec[(dn - 1) * 2]), Math.abs(dec[(dn - 1) * 2 + 1]));
  const post = analyzeMusic(out, piece.bpm);

  // 8. Entry, lead-in and handoff, all on the bar grid.
  const durationS = dn / MASTER_RATE;
  const monoA = decode(out, ANALYSIS_RATE, 1);
  // The comb sometimes locks to half or double the asked-for tempo; fold the
  // measured pulse back onto the prompt's octave before building bars.
  const octave = 2 ** Math.round(Math.log2(post.bpm / piece.bpm));
  const bpm = Math.round((post.bpm / octave) * 10) / 10;
  const beatsPerBar = BEATS_PER_BAR[piece.meter];
  const barS = (60 / bpm) * beatsPerBar;
  const phase = downbeatPhase(monoA, ANALYSIS_RATE, bpm, beatsPerBar);
  const barAtOrBefore = (t: number): number => Math.max(0, phase + Math.floor((t - phase) / barS) * barS);
  const barAtOrAfter = (t: number): number => phase + Math.ceil((t - phase) / barS) * barS;
  const r3 = (v: number): number => Math.round(v * 1000) / 1000;
  // The handoff: the first bar line after the body ends plus a breath, so the
  // final cadence is heard; never later than HANDOFF_BEFORE_END_S from the end
  // (an abrupt take's synthetic fade begins FADE_OUT_ABRUPT_S from the end).
  const latest = durationS - (abruptEnd ? FADE_OUT_ABRUPT_S : HANDOFF_BEFORE_END_S);
  const handoffS = r3(Math.min(barAtOrAfter(Math.min(bodyEnd, durationS) + 2), barAtOrBefore(latest)));
  // A state change enters on the bar where the body has arrived — a crossfade
  // into tension must sound like tension, not like a soft intro. A handoff
  // within a pool enters LEAD_IN_S earlier, so the piece still has a short
  // run-up of its own.
  const entryS = r3(Math.min(barAtOrBefore(arrive), Math.max(0, handoffS - MIN_BODY_S)));
  const leadInS = r3(entryS > LEAD_IN_S ? barAtOrBefore(entryS - LEAD_IN_S) : 0);

  const result = {
    id, out: `${id}.mp3`, state: piece.state, source: m.source, bytes, kbps: Math.round((bytes * 8) / durationS / 1000),
    durationS: Math.round(durationS * 1000) / 1000, bpm, beatsPerBar, key: post.key, keyR: post.keyR,
    downbeatS: r3(phase), entryS, leadInS, handoffS,
    trimmedHeadS: r3(first / MASTER_RATE), trimmedTailS: r3(rawS - last / MASTER_RATE),
    bodyArrivesS: r3(arrive), bodyEndsS: r3(bodyEnd), hotStart, abruptEnd, fadeInS: fadeIn, fadeOutS: fadeOut,
    lufs: after.lufs, lra: after.lra, truePeak: after.truePeak,
    lowPctSource: pre.lowPct, lowPct: post.lowPct, presencePct: post.presencePct,
    introS: post.introS, outroS: post.outroS, endLu: post.endLu,
    headClickRatio: Math.round((headClick / p999) * 100) / 100,
    tailClickRatio: Math.round((tailClick / p999) * 100) / 100,
    firstSample: Number(firstAbs.toExponential(2)), lastSample: Number(lastAbs.toExponential(2)),
    why: m.why,
  };
  console.log(JSON.stringify(result));
  console.log(`  { url: '/audio/music/${id}.mp3', durationS: ${result.durationS}, leadInS: ${leadInS}, entryS: ${entryS}, handoffS: ${handoffS}, bpm: ${bpm} },`);
  await writeFile(path.resolve('artifacts', `piece-${id}.json`), `${JSON.stringify(result, null, 2)}\n`);
  return result;
}

/* ── main ─────────────────────────────────────────────────────────────────── */

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === 'credits') return credits();
  if (cmd === 'analyze') {
    for (const f of rest) printAnalysis(analyzeMusic(f, SCORE[idOfCandidate(f) ?? '']?.bpm ?? 96));
    return;
  }
  if (cmd === 'analyze-candidates') return analyzeCandidates(rest);
  if (cmd === 'master') {
    const ids = rest[0] === 'all' ? Object.keys(PIECE_MASTERS) : rest;
    const results = [];
    for (const id of ids) results.push(await masterPiece(id));
    if (rest[0] === 'all') await writeFile(path.resolve('artifacts/pieces.json'), `${JSON.stringify(results, null, 2)}\n`);
    return;
  }
  if (cmd === 'generate') {
    const ti = rest.indexOf('--take');
    const take = ti === -1 ? 1 : Number(rest[ti + 1]);
    const ids = rest.filter((a, i) => !a.startsWith('--') && (ti === -1 || i !== ti + 1));
    for (const id of ids) await generate(id, take);
    return;
  }
  console.error('usage: credits | generate <id…> [--take N] | analyze <file…> | analyze-candidates [id…] | master <id…>|all');
  console.error(`score ids: ${Object.keys(SCORE).join(', ')}`);
  process.exitCode = 1;
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
