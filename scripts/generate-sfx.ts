/**
 * Sound-effect generation, candidate analysis and mastering for the hero clips
 * in `src/app/audio/SoundEngine.ts`.
 *
 * Development-time only. The app never calls ElevenLabs; the key is read from
 * `process.env.ELEVENLABS_API_KEY` and nowhere else. Load it without putting it
 * on a command line, e.g.
 *
 *   npx tsx --env-file="$HOME/.config/elevenlabs/env" scripts/generate-sfx.ts credits
 *
 * Commands
 *   credits                         print character_count / character_limit
 *   generate [cue…] [--take 1] [--n 3]
 *                                   generate candidates for one prompt take into
 *                                   artifacts/sfx-candidates/<cue>/<cue>-t<take>-<n>.mp3
 *   analyze  [cue…]                 measure every candidate (needs ffmpeg)
 *   master                          master the PICKS below into public/audio/sfx/
 *
 * Candidates live in artifacts/ (gitignored). Only mastered picks are committed.
 * Selection is by analysis, not by first result — see `analyze` and the notes on
 * each pick. Levels are NOT set here: every clip is peak-normalised, and its
 * level in the mix is the `gain` solved in the browser render (docs/AUDIO-MIX.md).
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { measure, spectrumOf } from '../tests/app/audio/analysis';

const OUTPUT_FORMAT = 'mp3_44100_128';
const API = 'https://api.elevenlabs.io/v1';
const CANDIDATE_DIR = path.resolve('artifacts/sfx-candidates');
const MASTER_DIR = path.resolve('public/audio/sfx');

/**
 * Shared tail for every prompt: the Ministry is paper, brass, velvet and wax on
 * a council table. Not sci-fi, not cartoon, no music bed under the foley.
 */
const ROOM = 'close-miked foley, dry small room, no music, no voices';

interface SfxPrompt {
  /** What the cue is for, for the person reading this file next. */
  readonly role: string;
  readonly text: string;
  readonly durationSeconds: number;
  readonly promptInfluence: number;
}

export const SFX_PROMPTS = {
  cardShuffle: [{
    role: 'a card handled: lands on felt, returns to the deck (tier 3, frequent)',
    text: `A single stiff playing card flicked off a deck and skidding onto a felt card table, short papery riffle flutter then a soft landing, ${ROOM}`,
    durationSeconds: 0.6,
    promptInfluence: 0.6,
  }, {
    // Take 2: landing FIRST. Take 1's flutter put the peak 130–210ms after the
    // onset, which is late for a cue fired on an animation's `land` callback.
    role: 'a card handled: lands on felt (impact at t=0)',
    text: `A single playing card dropped flat onto a green felt card table, one soft papery slap with a brief paper flutter after it, ${ROOM}`,
    durationSeconds: 0.5,
    promptInfluence: 0.7,
  }],
  actionDeclared: [{
    role: 'a claim is made: card put down with intent (tier 3, every turn)',
    text: `One stiff playing card slapped face-down onto a felt-covered wooden table, crisp papery snap with a soft wooden thud, ${ROOM}`,
    durationSeconds: 0.5,
    promptInfluence: 0.6,
  }, {
    role: 'a claim is made: card put down with intent (impact at t=0)',
    text: `A playing card snapped down firmly onto a felt table with a fingertip, one crisp papery slap, ${ROOM}`,
    durationSeconds: 0.5,
    promptInfluence: 0.7,
  }],
  coinsGained: [{
    role: 'your coins up (tier 3, frequent)',
    text: `Two or three heavy brass coins dropped onto a small stack of coins on a felt table, short bright metallic clinks, ${ROOM}`,
    durationSeconds: 0.7,
    promptInfluence: 0.6,
  }, {
    // Take 2: heavier and darker. Take 1 centred at 10–12kHz — a jingle, not
    // brass tokens on felt, and the first thing an opponent lowpass removes.
    role: 'your coins up (heavy, darker)',
    text: `Two thick heavy brass tokens set down onto a short stack of brass tokens on felt, a dull weighty clink, ${ROOM}`,
    durationSeconds: 0.5,
    promptInfluence: 0.7,
  }],
  coinsLost: [{
    role: 'your coins down (tier 3)',
    text: `A few brass coins swept off a small stack and slid across green felt, dull metallic scrape and a muted clink, ${ROOM}`,
    durationSeconds: 0.8,
    promptInfluence: 0.6,
  }, {
    role: 'your coins down (impact first)',
    text: `A small stack of heavy brass tokens knocked over and pushed away across felt, a dull clatter then a short slide, ${ROOM}`,
    durationSeconds: 0.6,
    promptInfluence: 0.7,
  }],
  coup: [{
    role: 'a coup is launched (tier 2, ducks the bed)',
    text: `A heavy brass seal stamped hard into warm wax on a thick oak desk, one deep low thud with a dull wooden boom, ${ROOM}`,
    durationSeconds: 1.4,
    promptInfluence: 0.6,
  }],
  assassinationAlert: [{
    role: 'you are the target of an assassination (tier 2)',
    text: `A thin steel dagger drawn quickly from a leather sheath, a short sharp metallic slide and a faint ring, ${ROOM}`,
    durationSeconds: 1.0,
    promptInfluence: 0.6,
  }],
  block: [{
    role: 'an action is blocked (tier 1, ducks the bed)',
    text: `A heavy open palm slammed flat onto a thick wooden council table, one deep solid thud, ${ROOM}`,
    durationSeconds: 0.7,
    promptInfluence: 0.6,
  }, {
    // Take 2: take 1 centred at 44–79Hz, which a phone speaker cannot play.
    role: 'an action is blocked (audible on small speakers)',
    text: `A flat palm slapped hard onto a thick wooden table, a sharp skin slap with a solid wooden knock, ${ROOM}`,
    durationSeconds: 0.6,
    promptInfluence: 0.7,
  }, {
    // Take 3: take 2 came back near-silent (peak −32 to −42 dBFS, noisy).
    role: 'an action is blocked (a hard knock with weight)',
    text: `A heavy wooden shield slammed down flat onto an oak table, one hard wooden knock with a short low thump, ${ROOM}`,
    durationSeconds: 0.6,
    promptInfluence: 0.7,
  }],
  challengeWindow: [{
    role: 'you may challenge (tier 4 prompt)',
    text: `Two quick sharp knuckle knocks on a polished hardwood table, crisp and close, ${ROOM}`,
    durationSeconds: 0.5,
    promptInfluence: 0.6,
  }, {
    // Take 2: a metallic rap, so it can never be confused with `denied`'s dull
    // wooden knock.
    role: 'you may challenge (metallic rap)',
    text: 'Two fast sharp raps of a heavy brass signet ring on a wooden table, crisp bright knocks, dry, close, no music',
    durationSeconds: 0.5,
    promptInfluence: 0.7,
  }],
  challengeRevealSuccess: [{
    role: 'a challenged claim was true (tier 2)',
    text: 'A playing card flipped over and snapped hard face-up onto a wooden table, followed by a short bright plucked harp chord that resolves, dry, no voices',
    durationSeconds: 1.2,
    promptInfluence: 0.55,
  }, {
    // Take 2: take 1 left ~600ms of dead air between the card and the chord.
    role: 'a challenged claim was true (no gap)',
    text: 'A playing card snapped face-up onto a wooden table and at the same instant a bright plucked harp chord rings out and resolves, dry, no voices',
    durationSeconds: 1.0,
    promptInfluence: 0.6,
  }],
  challengeRevealFail: [{
    role: 'a bluff was caught (tier 1, ducks the bed)',
    text: 'A playing card flipped over and slapped face-up onto a wooden table, followed by one low dark bowed cello note that sags downward, dry, no voices',
    durationSeconds: 1.4,
    promptInfluence: 0.55,
  }, {
    role: 'a bluff was caught (no gap)',
    text: 'A playing card slapped face-up onto a wooden table and at the same instant one low dark cello note sags downward, dry, no voices',
    durationSeconds: 1.1,
    promptInfluence: 0.6,
  }, {
    // Takes 1–2 never produced the low note: centroids 1.6–2.6kHz.
    role: 'a bluff was caught (the low end)',
    text: 'A playing card slapped down hard on a table together with one deep low timpani hit that rings and sinks, dark and heavy, no voices',
    durationSeconds: 1.0,
    promptInfluence: 0.65,
  }],
  influenceLoss: [{
    role: 'an influence is lost — the only irreversible thing in Coup (tier 1)',
    text: `A stiff paper card torn sharply in half, followed by a low dull thud on a wooden table, ${ROOM}`,
    durationSeconds: 1.0,
    promptInfluence: 0.6,
  }, {
    // Take 2: take 1 was all tear — 5kHz centroid and no body.
    role: 'an influence is lost (with weight)',
    text: `A playing card flipped face-up and slammed down onto a wooden table, a paper snap with a heavy low thud, ${ROOM}`,
    durationSeconds: 0.8,
    promptInfluence: 0.7,
  }],
  playerEliminated: [{
    role: 'a player is out (tier 0)',
    text: 'A heavy wooden chair scraped back across a stone floor, then one low distant bronze bell toll, dry hall, no music, no voices',
    durationSeconds: 2.2,
    promptInfluence: 0.55,
  }, {
    // Take 2: take 1 was two seconds of dense chair scrape at tier-0 level.
    role: 'a player is out (the bell, not the chair)',
    text: 'One single low bronze bell toll in a stone hall, a solemn strike with a long fading ring, no music, no voices',
    durationSeconds: 2.0,
    promptInfluence: 0.6,
  }],
  exchange: [{
    role: 'Ambassador/Inquisitor exchange begins (tier 2)',
    text: `Two playing cards drawn from a deck and swapped in the hand, quick paper slides and a soft short riffle, ${ROOM}`,
    durationSeconds: 1.0,
    promptInfluence: 0.6,
  }],
  yourTurn: [{
    role: 'your turn (tier 4 chrome)',
    text: 'A single small brass desk bell struck once very softly, clear short ting with a quick decay, dry, no music, no voices',
    durationSeconds: 0.8,
    promptInfluence: 0.6,
  }, {
    // Take 2: take 1 came back at −31 dBFS with a −35 to −46 dB noise floor.
    role: 'your turn (clean bell)',
    text: 'One small brass hotel desk bell, a single clean ding with a short ring, very close, dry, no music, no voices',
    durationSeconds: 0.9,
    promptInfluence: 0.7,
  }],
  timerWarning: [{
    role: 'five seconds left (tier 4 chrome)',
    text: 'One single mechanical pocket-watch tick, a crisp tiny brass escapement click, dry, close, no music',
    durationSeconds: 0.5,
    promptInfluence: 0.7,
  }, {
    role: 'five seconds left (single tick)',
    text: 'A single loud wooden clock tick, one short dry click, nothing else, no music',
    durationSeconds: 0.5,
    promptInfluence: 0.75,
  }],
  denied: [{
    role: 'that move is not legal — NOT a loss (tier 4 chrome)',
    text: 'One single dull muffled knock on a thick padded wooden door, short and soft, dry, no music, no voices',
    durationSeconds: 0.5,
    promptInfluence: 0.7,
  }],
  chatMessage: [{
    role: 'someone wrote in chat (tier 4 chrome)',
    text: 'A small folded paper note flicked onto a table, one soft gentle papery tap, very short, dry, no music',
    durationSeconds: 0.5,
    promptInfluence: 0.6,
  }],
  reaction: [{
    role: 'someone reacted (tier 4 chrome)',
    text: 'A quick light paper fan flutter, tiny and soft, very short, dry, no music',
    durationSeconds: 0.5,
    promptInfluence: 0.6,
  }],
  blockOpportunity: [{
    role: 'you may block (tier 4 prompt)',
    text: 'A small brass latch clicked twice, two light crisp metallic clicks, dry, close, no music',
    durationSeconds: 0.5,
    promptInfluence: 0.65,
  }],
  cardDeal: [{
    role: 'the opening deal (tier 3, once per game)',
    text: `Four playing cards dealt quickly one after another onto a felt table, rhythmic papery flicks and soft landings, ${ROOM}`,
    durationSeconds: 1.4,
    promptInfluence: 0.6,
  }],
} as const satisfies Record<string, readonly SfxPrompt[]>;

export type SfxCue = keyof typeof SFX_PROMPTS;

/**
 * The chosen candidates, by `<cue>/<candidate>` under artifacts/sfx-candidates.
 * Each entry masters to public/audio/sfx/<out>.mp3. Several outs per cue are
 * round-robin variants (see HERO_CLIPS in SoundEngine.ts).
 *
 * A pick is one or more LAYERS — a candidate, or a slice of one, placed at an
 * offset — summed, then filtered, crest-controlled, faded and encoded:
 *
 *   hp / lp   highpass / lowpass, Hz. Every clip gets at least a 40Hz highpass:
 *             sub energy counts toward the measured level and no laptop or
 *             phone plays it. `denied` uses it for the "no chest" rule.
 *   crestDb   cap on peak − loudest-300ms-RMS, by a lookahead limiter. This is
 *             what lets a clip be solved onto its tier WITHOUT its transient
 *             stabbing above a loss: after the gain solve, peak = loud + crest,
 *             and the gate holds every routine peak 1.5dB under the quietest
 *             loss. See docs/AUDIO-MIX.md.
 *   maxMs / fadeMs   hard length cap and the fade-out that ends it.
 */
interface Layer {
  /** `<cue>/<file>.mp3` under artifacts/sfx-candidates. */
  readonly from: string;
  /** Where this layer's onset sits in the output, ms. */
  readonly atMs?: number;
  readonly db?: number;
  /** Slice of the source to search for the onset in, ms. */
  readonly fromMs?: number;
  readonly toMs?: number;
  /** Onset threshold relative to the slice peak. −40 by default; higher skips pre-noise. */
  readonly onsetDb?: number;
}

interface Pick {
  readonly out: string;
  readonly layers: readonly Layer[];
  readonly hp?: number;
  readonly lp?: number;
  readonly maxMs?: number;
  readonly fadeMs?: number;
  readonly crestDb?: number;
  /** FFT denoise floor (dB) for a source that came back with audible hiss. */
  readonly denoiseDb?: number;
  /** Why this candidate, in one line: what the analysis showed. */
  readonly why: string;
}

const L = (from: string, extra: Omit<Layer, 'from'> = {}): Layer => ({ from, ...extra });

const T3 = 19; // actionDeclared crest cap — see `crestDb`
const T4 = 24.5; // tier-4 crest cap

export const PICKS: readonly Pick[] = [
  // ── tier 3, round-robin ─────────────────────────────────────────────────
  { out: 'cardShuffle-1', layers: [L('cardShuffle/cardShuffle-t2-4.mp3')], maxMs: 260, fadeMs: 70, crestDb: 22.5,
    why: 'impact at 20ms, 142ms active, felt-paper centroid 2.1kHz' },
  { out: 'cardShuffle-2', layers: [L('cardShuffle/cardShuffle-t2-3.mp3')], maxMs: 260, fadeMs: 70, crestDb: 22.5,
    why: 'impact at 22ms, flutter tail, 2.3kHz' },
  { out: 'cardShuffle-3', layers: [L('cardShuffle/cardShuffle-t2-1.mp3')], maxMs: 260, fadeMs: 70, crestDb: 22.5,
    why: 'impact at 3ms, more 1kHz body — the darker of the three' },
  { out: 'actionDeclared-1', layers: [L('actionDeclared/actionDeclared-t1-2.mp3', { onsetDb: -26 })], hp: 120, maxMs: 260, fadeMs: 60, crestDb: T3,
    why: 'snap + wooden thud, rise 21ms after pre-noise trim; 120Hz highpass — its sub thud made it the dull one of three at equal loudness, and sat under the table bed' },
  { out: 'actionDeclared-2', layers: [L('actionDeclared/actionDeclared-t2-3.mp3')], maxMs: 200, fadeMs: 60, crestDb: T3,
    why: 'crisp slap, 85ms, 3kHz. (t1-1 trimmed past its handling noise left a 290Hz thud — too far from its siblings)' },
  { out: 'actionDeclared-3', layers: [L('actionDeclared/actionDeclared-t2-1.mp3')], maxMs: 260, fadeMs: 60, crestDb: T3,
    why: 'rise 1ms, crisp; tail capped (the source rings to its end)' },
  { out: 'coinsGained-1', layers: [L('coinsGained/coinsGained-t2-4.mp3')], maxMs: 420, fadeMs: 90, crestDb: 15,
    why: 'two weighty clinks, 2.7kHz — take 1 sat at 10–12kHz, a jingle' },
  { out: 'coinsGained-2', layers: [L('coinsGained/coinsGained-t2-3.mp3')], maxMs: 380, fadeMs: 90, crestDb: 15,
    why: 'one stacked clink and a settle, 3.9kHz, rise 34ms' },
  { out: 'coinsLost-1', layers: [L('coinsLost/coinsLost-t2-1.mp3')], maxMs: 330, fadeMs: 90, crestDb: 16.5,
    why: 'clatter at 17ms then a short slide, 3.6kHz' },
  { out: 'coinsLost-2', layers: [L('coinsLost/coinsLost-t2-3.mp3')], maxMs: 330, fadeMs: 90, crestDb: 16.5,
    why: 'same gesture, longer slide' },
  { out: 'cardDeal', layers: [L('cardDeal/cardDeal-t1-2.mp3')], hp: 250, maxMs: 1000, fadeMs: 120, crestDb: 22.5,
    why: 'four evenly spaced flicks over ~950ms, onset 10ms (take 3 peaked at 1s); 250Hz highpass lifts it out of the beds (its loudest octave was 125Hz)' },
  // ── tier 2 ───────────────────────────────────────────────────────────────
  { out: 'coup', layers: [L('coup/coup-t1-1.mp3')], hp: 35, maxMs: 460, fadeMs: 140, crestDb: 15,
    why: 'the first of its two stamps only: rise 37ms, 125–250Hz weight, centroid 452Hz' },
  { out: 'assassinationAlert', layers: [L('assassinationAlert/assassinationAlert-t1-3.mp3')], maxMs: 520, fadeMs: 140, crestDb: 15,
    why: 'blade draw that starts at once (rise 137ms vs ~300 for the others)' },
  { out: 'challengeRevealSuccess', layers: [
    L('challengeRevealSuccess/challengeRevealSuccess-t1-1.mp3', { toMs: 300 }),
    L('challengeRevealSuccess/challengeRevealSuccess-t1-1.mp3', { fromMs: 600, atMs: 110 }),
  ], maxMs: 950, fadeMs: 280, crestDb: 15,
    why: 'card snap + harp chord from the same take, with its 600ms of dead air cut out' },
  { out: 'exchange', layers: [L('exchange/exchange-t1-1.mp3')], maxMs: 720, fadeMs: 160, crestDb: 16,
    why: 'paper slides building into a riffle, crest 15.9 (the lowest of three)' },
  // ── tier 1 ───────────────────────────────────────────────────────────────
  { out: 'influenceLoss', layers: [
    L('influenceLoss/influenceLoss-t2-1.mp3'),
    L('influenceLoss/influenceLoss-t1-3.mp3', { atMs: 110, db: -5 }),
  ], maxMs: 650, fadeMs: 160, crestDb: 13,
    why: 'card slammed face-up with a low thud (take 2), then torn (take 1) — weight AND loss' },
  { out: 'challengeRevealFail', layers: [
    L('challengeRevealFail/challengeRevealFail-t3-2.mp3'),
    L('actionDeclared/actionDeclared-t2-3.mp3', { db: -4 }),
  ], maxMs: 900, fadeMs: 380, crestDb: 13,
    why: 'timpani hit sinking under a card slap (−4dB): 125Hz-led (63Hz 20dB down), centroid ~120Hz like the synth it replaces; the slap carries it on speakers with no bass' },
  { out: 'block', layers: [
    L('block/block-t1-3.mp3'),
    L('actionDeclared/actionDeclared-t2-3.mp3', { db: -3 }),
  ], hp: 70, maxMs: 450, fadeMs: 150,
    why: 'thud with 125Hz body + a palm slap (−3dB) so a phone speaker, which plays none of the thud, still hears the block' },
  // ── tier 0 ───────────────────────────────────────────────────────────────
  { out: 'playerEliminated', layers: [L('playerEliminated/playerEliminated-t2-3.mp3')], maxMs: 1500, fadeMs: 550, crestDb: 13,
    why: 'one bell, strike at 28ms, 500Hz fundamental region; take 1 was 2s of chair scrape' },
  // ── tier 4 ───────────────────────────────────────────────────────────────
  { out: 'yourTurn', layers: [L('yourTurn/yourTurn-t1-1.mp3')], maxMs: 600, fadeMs: 260, crestDb: T4, denoiseDb: -50,
    why: 'small bell at 1kHz (warmer than take 2\'s 3–4kHz pings); hiss floor denoised' },
  { out: 'timerWarning', layers: [L('timerWarning/timerWarning-t2-4.mp3')], maxMs: 120, fadeMs: 30, crestDb: T4,
    why: 'one click, 90ms, centroid 1.9kHz — the escapement takes ticked 4–5 times' },
  { out: 'denied', layers: [L('denied/denied-t1-3.mp3')], hp: 350, maxMs: 100, fadeMs: 35, crestDb: T4,
    why: 'first knock only, 350Hz highpass: short, mid, no chest (centroid 552Hz vs the caught bluff 121Hz), and out from under the table bed' },
  { out: 'challengeWindow', layers: [L('challengeWindow/challengeWindow-t2-3.mp3')], maxMs: 160, fadeMs: 40, crestDb: T4,
    why: 'a brass-ring rap, 1kHz centroid — metallic, so never the dull `denied` knock' },
  { out: 'chatMessage', layers: [L('chatMessage/chatMessage-t1-1.mp3')], hp: 400, maxMs: 140, fadeMs: 40, crestDb: T4,
    why: 'one soft paper tap, 96ms; 400Hz highpass moves its weight to 1kHz, clear of the lobby bed it plays over' },
  { out: 'reaction', layers: [L('reaction/reaction-t1-3.mp3')], maxMs: 300, fadeMs: 100, crestDb: T4,
    why: 'paper flutter that starts at once (rise 75ms vs ~155)' },
  { out: 'blockOpportunity', layers: [L('blockOpportunity/blockOpportunity-t1-1.mp3')], lp: 10000, maxMs: 140, fadeMs: 30, crestDb: T4,
    why: 'two latch clicks in 110ms; lowpassed above 10kHz to take the glare off' },
];

function isCue(value: string): value is SfxCue {
  return value in SFX_PROMPTS;
}

function apiKey(): string {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error('ELEVENLABS_API_KEY is not set. Load it with --env-file; never print it.');
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

async function generateOne(cue: SfxCue, take: number, index: number): Promise<string> {
  const p: SfxPrompt | undefined = SFX_PROMPTS[cue][take - 1];
  if (!p) throw new Error(`${cue} has no take ${take}`);
  const dir = path.join(CANDIDATE_DIR, cue);
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `${cue}-t${take}-${index}.mp3`);
  if (existsSync(file)) return file;
  const response = await fetch(`${API}/sound-generation?output_format=${OUTPUT_FORMAT}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'xi-api-key': apiKey() },
    body: JSON.stringify({
      text: p.text,
      duration_seconds: p.durationSeconds,
      prompt_influence: p.promptInfluence,
    }),
  });
  if (!response.ok) throw new Error(`${cue}-${index}: ${response.status} ${await response.text()}`);
  await writeFile(file, Buffer.from(await response.arrayBuffer()));
  await writeFile(file.replace(/\.mp3$/, '.json'), `${JSON.stringify({
    cue, take, index, ...p, provider: 'ElevenLabs', endpoint: 'sound-generation', outputFormat: OUTPUT_FORMAT,
    generatedAt: new Date().toISOString(),
    requestId: response.headers.get('request-id') ?? response.headers.get('x-request-id'),
  }, null, 2)}\n`);
  return file;
}

/**
 * Zero-pad to 400ms. `shortTermRms` clamps its 300ms window to the buffer, so a
 * 100ms clip measured bare reads 10·log10(3) = 4.8dB LOUDER than the same clip
 * in the harness render, which has silence around it. Without this every
 * crest target below was off by that much on the short cues.
 */
function padTo300(x: Float32Array, rate: number): Float32Array {
  const n = Math.round(0.4 * rate);
  if (x.length >= n) return x;
  const y = new Float32Array(n);
  y.set(x);
  return y;
}

/** Decode any audio file to mono float32 at `rate` via ffmpeg. */
export function decodeMono(file: string, rate = 48000): Float32Array {
  const raw = execFileSync('ffmpeg', [
    '-v', 'error', '-i', file, '-ac', '1', '-ar', String(rate), '-f', 'f32le', '-',
  ], { maxBuffer: 256 * 1024 * 1024 });
  return new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
}

/** Onset = first sample within 40dB of peak; rise = onset → peak. */
function shape(x: Float32Array, rate: number) {
  let peak = 0;
  let peakAt = 0;
  for (let i = 0; i < x.length; i++) {
    const a = Math.abs(x[i]);
    if (a > peak) { peak = a; peakAt = i; }
  }
  const thr = peak * 10 ** (-40 / 20);
  let onset = 0;
  while (onset < x.length && Math.abs(x[onset]) < thr) onset++;
  // Noise floor: RMS of the last 60ms, relative to peak.
  const tailN = Math.min(x.length, Math.round(0.06 * rate));
  let s = 0;
  for (let i = x.length - tailN; i < x.length; i++) s += x[i] * x[i];
  const floorDb = 20 * Math.log10(Math.sqrt(s / tailN) / peak + 1e-12);
  // A coarse 20ms-step envelope, one glyph per step, 6dB per glyph below peak:
  // enough to SEE how many transients a clip has and where its weight sits.
  const glyphs = ' .:-=+*#';
  const step = Math.round(0.02 * rate);
  let env = '';
  for (let i = 0; i < x.length && env.length < 60; i += step) {
    let m = 0;
    for (let k = i; k < Math.min(x.length, i + step); k++) m = Math.max(m, Math.abs(x[k]));
    const db = 20 * Math.log10(m / peak + 1e-12);
    env += glyphs[Math.max(0, Math.min(7, 7 + Math.ceil(db / 6)))];
  }
  return {
    env,
    leadMs: Math.round((onset / rate) * 1000),
    riseMs: Math.round(((peakAt - onset) / rate) * 10000) / 10,
    tailFloorDb: Math.round(floorDb * 10) / 10,
    lenMs: Math.round((x.length / rate) * 1000),
  };
}

export function analyzeFile(file: string) {
  const rate = 48000;
  const x = decodeMono(file, rate);
  const m = measure([padTo300(x, rate)], rate);
  const sp = spectrumOf([x], rate);
  const sh = shape(x, rate);
  return {
    ...sh,
    activeMs: m.activeMs,
    peakDb: m.peakDb,
    stRmsDb: m.stRmsDb,
    crestDb: Math.round((m.peakDb - m.stRmsDb) * 100) / 100,
    lowDb: sp.lowDb,
    centroidHz: Math.round(sp.centroidHz),
    bandsDb: sp.bandsDb.map(v => Math.round(v)),
  };
}

async function analyze(cues: SfxCue[]): Promise<void> {
  for (const cue of cues) {
    const dir = path.join(CANDIDATE_DIR, cue);
    if (!existsSync(dir)) continue;
    const files = (await readdir(dir)).filter(f => f.endsWith('.mp3')).sort();
    for (const f of files) {
      const a = analyzeFile(path.join(dir, f));
      console.log(`${f.padEnd(30)} lead ${String(a.leadMs).padStart(4)}ms rise ${String(a.riseMs).padStart(5)}ms `
        + `active ${String(a.activeMs).padStart(7)}ms/${a.lenMs} peak ${a.peakDb} loud ${a.stRmsDb} `
        + `crest ${a.crestDb} floor ${a.tailFloorDb} low ${a.lowDb} cent ${a.centroidHz} `
        + `bands ${a.bandsDb.join(' ')}\n${''.padEnd(30)} |${a.env}|`);
    }
  }
}

const MASTER_RATE = 44100;

function peakAbs(x: Float32Array): number {
  let p = 0;
  for (const v of x) p = Math.max(p, Math.abs(v));
  return p;
}

/** Run ffmpeg over raw mono float32 and return raw mono float32. */
function ffFilter(x: Float32Array, filters: string[]): Float32Array {
  const out = execFileSync('ffmpeg', [
    '-v', 'error', '-f', 'f32le', '-ar', String(MASTER_RATE), '-ac', '1', '-i', 'pipe:0',
    '-af', filters.join(','), '-f', 'f32le', '-ar', String(MASTER_RATE), '-ac', '1', 'pipe:1',
  ], { input: Buffer.from(x.buffer, x.byteOffset, x.byteLength), maxBuffer: 256 * 1024 * 1024 });
  return new Float32Array(out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength));
}

/** One layer, trimmed to 2ms before its own onset, gain applied. */
function layerSamples(layer: Layer): Float32Array {
  const x = decodeMono(path.join(CANDIDATE_DIR, layer.from), MASTER_RATE);
  const ms = (v: number): number => Math.round((v / 1000) * MASTER_RATE);
  const seg = x.subarray(ms(layer.fromMs ?? 0), layer.toMs ? ms(layer.toMs) : x.length);
  const thr = peakAbs(seg) * 10 ** ((layer.onsetDb ?? -40) / 20);
  let start = 0;
  while (start < seg.length && Math.abs(seg[start]) < thr) start++;
  start = Math.max(0, start - ms(2));
  const g = 10 ** ((layer.db ?? 0) / 20);
  return Float32Array.from(seg.subarray(start), v => v * g);
}

/**
 * Master one pick: sum the layers, cut the tail at −50dB (or `maxMs`), filter,
 * cap the crest, fade, peak-normalise to −2 dBFS, encode 96 kbps mono MP3.
 * Every step after the layer sum is ffmpeg; the arithmetic is here so the
 * whole chain is reproducible from this file.
 */
async function masterOne(pick: Pick, crestTrim = 0): Promise<void> {
  const target = pick.crestDb === undefined ? undefined : pick.crestDb - crestTrim;
  const ms = (v: number): number => Math.round((v / 1000) * MASTER_RATE);
  const parts = pick.layers.map(l => ({ at: ms(l.atMs ?? 0), x: layerSamples(l) }));
  const len = Math.max(...parts.map(p => p.at + p.x.length));
  let y: Float32Array = new Float32Array(len);
  for (const p of parts) for (let i = 0; i < p.x.length; i++) y[p.at + i] += p.x[i];

  // Tail: last sample within 50dB of peak, plus 20ms; then the hard cap.
  const endThr = peakAbs(y) * 10 ** (-50 / 20);
  let end = y.length - 1;
  while (end > 0 && Math.abs(y[end]) < endThr) end--;
  end = Math.min(y.length, end + ms(20));
  if (pick.maxMs) end = Math.min(end, ms(pick.maxMs));
  y = y.slice(0, end);

  y = ffFilter(y, [
    `highpass=f=${pick.hp ?? 40}:poles=2`,
    ...(pick.lp ? [`lowpass=f=${pick.lp}:poles=2`] : []),
    ...(pick.denoiseDb ? [`afftdn=nf=${pick.denoiseDb}`] : []),
  ]);

  if (target !== undefined) {
    // Iterate: on a transient-dominated clip the loudest 300ms window IS the
    // transient, so limiting the peak pulls the loudness down with it and one
    // pass only buys back a fraction of the requested crest.
    const crestOf = (v: Float32Array): number =>
      20 * Math.log10(peakAbs(v)) - measure([padTo300(v, MASTER_RATE)], MASTER_RATE).stRmsDb;
    const before = crestOf(y);
    for (let pass = 0; pass < 8; pass++) {
      const crest = crestOf(y);
      if (crest <= target + 0.2) break;
      const peak = peakAbs(y);
      // Normalise to 0 dBFS so the limiter's threshold is relative to peak.
      y = Float32Array.from(y, v => v / peak);
      const limit = Math.max(0.0626, 10 ** ((target - crest - 0.3) / 20));
      y = ffFilter(y, [`alimiter=limit=${limit.toFixed(5)}:attack=1.5:release=30:level=disabled:latency=1`]);
    }
    if (process.env.DEBUG_CREST) console.log(`  crest ${before.toFixed(2)} → ${crestOf(y).toFixed(2)}`);
  }

  // Re-trim the head: the denoiser and the limiter's lookahead can both leave
  // a few ms of near-silence in front of the onset, and a hero clip that
  // starts late lands behind the animation it is cueing.
  {
    const thr = peakAbs(y) * 10 ** (-40 / 20);
    let s = 0;
    while (s < y.length && Math.abs(y[s]) < thr) s++;
    y = y.slice(Math.max(0, s - ms(1.5)));
  }

  const durS = y.length / MASTER_RATE;
  const fade = Math.min((pick.fadeMs ?? 30) / 1000, durS / 3);
  y = ffFilter(y, ['afade=t=in:d=0.0015', `afade=t=out:st=${(durS - fade).toFixed(5)}:d=${fade.toFixed(5)}`]);

  // Peak-normalise to −2 dBFS (MP3 overshoots by up to ~1dB). The level in the mix is the solved HERO_CLIPS gain.
  const g = 10 ** (-2 / 20) / peakAbs(y);
  y = Float32Array.from(y, v => v * g);

  await mkdir(MASTER_DIR, { recursive: true });
  const out = path.join(MASTER_DIR, `${pick.out}.mp3`);
  execFileSync('ffmpeg', [
    '-v', 'error', '-y', '-f', 'f32le', '-ar', String(MASTER_RATE), '-ac', '1', '-i', 'pipe:0',
    '-c:a', 'libmp3lame', '-b:a', '96k', '-map_metadata', '-1', out,
  ], { input: Buffer.from(y.buffer, y.byteOffset, y.byteLength) });
  const size = (await readFile(out)).length;
  const a = analyzeFile(out);
  // MP3 rings on a limited transient — up to ~2dB of overshoot. Judge the
  // crest on the ENCODED file and redo with a tighter target if it missed.
  if (pick.crestDb !== undefined && a.crestDb > pick.crestDb + 0.4 && crestTrim < 4) {
    return masterOne(pick, crestTrim + (a.crestDb - pick.crestDb));
  }
  console.log(`${pick.out.padEnd(24)} ${String(size).padStart(6)} B ${String(a.lenMs).padStart(5)}ms `
    + `lead ${a.leadMs} rise ${a.riseMs} peak ${a.peakDb} loud ${a.stRmsDb} crest ${a.crestDb} `
    + `active ${a.activeMs} cent ${a.centroidHz} low ${a.lowDb}\n${''.padEnd(24)} |${a.env}|`);
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  const flag = (name: string, fallback: number): number => {
    const i = rest.indexOf(name);
    return i === -1 ? fallback : Number(rest[i + 1]);
  };
  const n = flag('--n', 3);
  const take = flag('--take', 1);
  const named = rest.filter((a, i) => !a.startsWith('--') && !rest[i - 1]?.startsWith('--'));
  for (const c of named) if (!isCue(c)) throw new Error(`unknown cue ${c}`);
  const cues = (named.length ? named : Object.keys(SFX_PROMPTS)) as SfxCue[];

  switch (command) {
    case 'credits':
      return credits();
    case 'generate':
      for (const cue of cues) {
        if (!SFX_PROMPTS[cue][take - 1]) continue;
        for (let i = 1; i <= n; i++) {
          console.log(`saved ${path.relative(process.cwd(), await generateOne(cue, take, i))}`);
        }
      }
      return;
    case 'analyze':
      return analyze(cues);
    case 'master': {
      const only = new Set(named);
      for (const pick of PICKS) {
        if (only.size && ![...only].some(c => pick.out.startsWith(c))) continue;
        await masterOne(pick);
      }
      return;
    }
    default:
      console.error('usage: generate-sfx.ts credits | generate [cue…] [--take 1] [--n 3] | analyze [cue…] | master');
      process.exitCode = 1;
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
