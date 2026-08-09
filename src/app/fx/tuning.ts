/**
 * fx/tuning.ts — the cue → effect map, as DATA, written before any rendering
 * code existed. (GAME-FEEL-PLAN §3.1; ART-DIRECTION §6.)
 *
 * ── THE TWO RULES, AND WHY THEY ARE IN THE TYPES ──────────────────────────
 *
 * 1. RESTRAINT IS LOAD-BEARING. Most beats get nothing. Your card landing
 *    sparks; everyone else's does not. Opponents' turns are quiet, and Coup's
 *    three loud moments — a challenge resolved against you, losing an
 *    influence, and the win — stay loud *because nothing else has spent the
 *    attention*. `card_landed` fires several times a turn across a 6-player
 *    table; sparking on all of them makes the felt glitter permanently and
 *    destroys the signal value of the beats that matter.
 *
 * 2. RED ONLY FOR THE VICTIM. An attack aimed at you gets the flash and the
 *    shake; the same attack aimed at someone else gets a small neutral ring. A
 *    table where every attack flashes red teaches the player nothing; a table
 *    where only theirs do is one they can read out of the corner of their eye.
 *
 * Neither rule is left to discipline. `QuietRow` — the row type for a beat
 * between other players — declares `flash: FxFlash<QuietTone> | null` where
 * `QuietTone = Exclude<FxTone, 'crimson'>`, and `haptic: null`. A future edit
 * that reddens a bystander event, or that buzzes your phone for someone else's
 * turn, is a type error before it is a test failure. `rowFor()` carries the
 * same rule at lookup time: a `theirs` condition with no row resolves to
 * NOTHING, and never escalates to the loud form of the same event.
 *
 * ── UNITS ─────────────────────────────────────────────────────────────────
 * Sizes are CSS px, speeds px/s, lives seconds, ring radii `from → to` px,
 * flash strength is a peak opacity on the screen-blend plate, and trauma
 * displaces by trauma² × 15px after decaying at 1.5/s (see fx/shake.ts) — so
 * .16 is 0.38px, .30 is 1.35px, .45 is 3.0px and .60 is 5.4px.
 *
 * ── THE TABLE ─────────────────────────────────────────────────────────────
 *
 *  event                condition    particles                                flash        trauma  haptic
 *  ──────────────────── ──────────── ──────────────────────────────────────── ──────────── ─────── ──────────────
 *  card_landed          mine         5 dots ø7 fan along travel + ring 3→19   —            .16 †   land
 *  card_landed          theirs       ring 3→15 bone α.22, 130ms               —            0       —
 *  challenge_won        mine         ring 12→52 brass + 6 brass dots          —            .20     —
 *  challenge_won        theirs       ring 12→44 ash α.28                      —            0       —
 *  challenge_lost       against_me   flare ø62 + ring 10→86 crimson + 12 dots crimson .30  .30     targeted
 *  challenge_lost       theirs       ring 12→48 ash α.30                      —            0       —
 *  influence_lost       mine         12 crimson dots + ring 8→64, "LOST"      crimson .30  .34     influenceLost
 *  influence_lost       theirs       6 ash puffs 14→46                        —            0       —
 *  coup_landed          against_me   flare ø70 + ring 10→92 crimson + 14 dots crimson .38  .45     targeted
 *  coup_landed          mine         ring 12→52 ash + 6 bone dots             —            .20     —
 *  coup_landed          theirs       ring 12→46 ash α.24                      —            0       —
 *  assassinate_blocked  against_me   4-arm cross 5/arm bone + flare ø54       ash .16      .30     targeted
 *  assassinate_blocked  theirs       same cross, 3/arm at α.5, no flare       —            0       —
 *  coins_changed        mine         — (float only: +N brass / −N crimson)    —            0       —
 *  coins_changed        theirs       — (nothing, deliberately)                —            0       —
 *  player_eliminated    mine         14 ash settle puffs + "ELIMINATED"       —            .22     —
 *  player_eliminated    theirs       14 ash settle puffs                      —            .22     —
 *  game_over            mine         380 confetti 3.2s + 130 at +1.5s         brass .30    .60     win
 *  game_over            theirs       150 confetti 2.6s                        brass .12    .26     —
 *  denied               mine         2 crimson dots ø6.5, 220ms               —            0       denied
 *
 *  † capped at LAND_CEILING (0.34). Five landings in a caravan must not stack
 *    to the cap and out-shake the win.
 *
 * ── THREE ROWS THAT LOOK LIKE OMISSIONS AND ARE NOT ───────────────────────
 *
 *  • `challenge_won / mine` has NO haptic even though it is a good beat for
 *    you. `goodThing` sits at priority 3 in utils/haptic.ts, above `targeted`
 *    at 2 — so buzzing here would arm the 300ms floor at priority 3 and eat the
 *    `targeted` that the loser's forced influence loss earns milliseconds
 *    later. The winner of a challenge feels the *loser's* consequence; that is
 *    the beat worth a pattern.
 *
 *  • `player_eliminated / mine` has no flash and no haptic. The
 *    `influence_lost` that caused it lit the plate crimson and fired
 *    `influenceLost` (priority 4) in the same beat. Two crimson washes inside
 *    400ms is one long wash, and the haptic floor would drop the second pattern
 *    anyway — stating that here rather than letting the gate discover it.
 *
 *  • `coins_changed / theirs` is an empty row rather than a missing one. It is
 *    the difference between "we decided this gets nothing" and "we forgot".
 */

import type { HapticName } from '../utils/haptic';
import { COL, type ColorIndex } from './palette';

/* ── the axes ───────────────────────────────────────────────────────────── */

export type FxEvent =
  | 'card_landed'
  | 'challenge_won'
  | 'challenge_lost'
  | 'influence_lost'
  | 'coup_landed'
  | 'assassinate_blocked'
  | 'coins_changed'
  | 'player_eliminated'
  | 'game_over'
  | 'denied';

export const FX_EVENTS: readonly FxEvent[] = [
  'card_landed',
  'challenge_won',
  'challenge_lost',
  'influence_lost',
  'coup_landed',
  'assassinate_blocked',
  'coins_changed',
  'player_eliminated',
  'game_over',
  'denied',
];

/**
 * Direction, from the local player's point of view.
 *
 *   mine       — you did it, or it is yours (your card, your coins, your win).
 *   against_me — it was done TO you (you were couped, you were caught bluffing).
 *   theirs     — it happened between other players. The quiet form.
 *
 * `mine` and `against_me` are two shades of "this concerns you" and fall back
 * to each other; `theirs` never falls back to either (see `rowFor`).
 */
export type FxCondition = 'mine' | 'against_me' | 'theirs';

/** Flash plate tones. Named for the ART-DIRECTION §2.1 token each one is. */
export type FxTone = 'brass' | 'crimson' | 'bone' | 'ash';

/**
 * The tones a BYSTANDER beat may wear. `crimson` is structurally absent — rule
 * 2 above is a type, not a convention.
 */
export type QuietTone = Exclude<FxTone, 'crimson'>;

/* ── emitters ───────────────────────────────────────────────────────────── */

/**
 * A declarative emitter. The table says WHAT shape a beat gets; fx/emitters.ts
 * knows how to throw it. Keeping this as data is what let the whole map be
 * written, argued over and diffed before a single pixel was drawn.
 */
export type FxEmitter =
  | {
      readonly emit: 'sparks';
      readonly count: number;
      readonly color: ColorIndex;
      readonly speed: number;
      readonly life: number;
      readonly size: number;
      readonly grav: number;
      /** Radians. Omit for a full circle. */
      readonly spread?: number;
      /** Throw the fan along the cue's travel vector when one was supplied. */
      readonly directional?: boolean;
      readonly alpha?: number;
    }
  | {
      readonly emit: 'ring';
      readonly from: number;
      readonly to: number;
      readonly color: ColorIndex;
      readonly life: number;
      readonly lineWidth: number;
      readonly alpha: number;
    }
  | {
      readonly emit: 'flare';
      readonly size: number;
      readonly color: ColorIndex;
      readonly life: number;
      readonly alpha: number;
    }
  | {
      readonly emit: 'puff';
      readonly count: number;
      readonly color: ColorIndex;
      readonly life: number;
      readonly from: number;
      readonly to: number;
      readonly alpha: number;
    }
  | {
      readonly emit: 'cross';
      readonly perArm: number;
      readonly color: ColorIndex;
      readonly speed: number;
      readonly size: number;
      readonly life: number;
      readonly alpha: number;
    }
  | {
      readonly emit: 'confetti';
      readonly count: number;
      readonly life: number;
      /**
       * A second, lighter fall this many ms later. The peak of a celebration
       * must not be the first frame of it — the game-over overlay animates in
       * over ~600ms and a single burst finishes underneath it.
       */
      readonly delayMs?: number;
    }
  | {
      readonly emit: 'settle';
      readonly count: number;
      readonly color: ColorIndex;
    };

/* ── flash and float ────────────────────────────────────────────────────── */

export interface FxFlash<T extends FxTone = FxTone> {
  readonly tone: T;
  /** Peak opacity on the screen-blend plate. */
  readonly strength: number;
  readonly durationMs: number;
}

export type FxFloatTone = 'brass' | 'crimson' | 'bone' | 'ash' | 'signed';

export interface FxFloatSpec {
  /** `null` = the caller supplies the text (a coin delta, a player name). */
  readonly text: string | null;
  /** `'signed'` picks brass for a gain and crimson for a loss. */
  readonly tone: FxFloatTone;
  /** 1 = the default size. A shout is 1.35 and gets the heavy outline. */
  readonly scale: number;
}

/* ── rows ───────────────────────────────────────────────────────────────── */

interface RowCommon {
  readonly event: FxEvent;
  readonly particles: readonly FxEmitter[];
  readonly float: FxFloatSpec | null;
  /** One line on why this row is tuned the way it is. Not decoration. */
  readonly why: string;
}

/** A beat that concerns YOU. The only rows allowed to be loud. */
export interface LoudRow extends RowCommon {
  readonly condition: 'mine' | 'against_me';
  readonly flash: FxFlash | null;
  readonly trauma: number;
  /** Clamp the RESULTING trauma, so a caravan of these cannot stack past it. */
  readonly traumaCeiling: number | null;
  readonly haptic: HapticName | null;
}

/**
 * A beat between other players.
 *
 * Three of the four fields on this type are narrower than `LoudRow`'s, and each
 * narrowing is one of the two rules made unwritable:
 *   flash  — `QuietTone`, so it cannot be crimson.
 *   haptic — `null`, so it cannot touch your hands.
 *   traumaCeiling — `null`, because nothing quiet is repeated enough to need one.
 * `trauma` is left open, because two bystander beats genuinely earn a knock:
 * a player being eliminated and somebody else winning are table-level facts,
 * not opponents' turns. `QUIET_TRAUMA_CEILING` bounds them.
 */
export interface QuietRow extends RowCommon {
  readonly condition: 'theirs';
  readonly flash: FxFlash<QuietTone> | null;
  readonly trauma: number;
  readonly traumaCeiling: null;
  readonly haptic: null;
}

export type FxRow = LoudRow | QuietRow;

/**
 * The most a beat that is not about you may shake the table. .26 is the
 * someone-else-won knock; anything above it is an attack, and an attack that is
 * not aimed at you does not get to move your screen.
 */
export const QUIET_TRAUMA_CEILING = 0.26;

/** Routine landings must never out-shake the win. Mirrored in fx/shake.ts. */
export const LAND_CEILING = 0.34;

/* ── the table ──────────────────────────────────────────────────────────── */

export const FX_TABLE: readonly FxRow[] = [
  /* ── card_landed ─────────────────────────────────────────────────────── */
  {
    event: 'card_landed',
    condition: 'mine',
    // A circular scatter of dots reads as sparkle, and sparkle is what a card
    // does when it twinkles, not when it hits a table. The fan is thrown ALONG
    // the travel vector — dust pushed ahead of the card — so the eye can still
    // read which way it came from after it has stopped. The ring is the only
    // element that reads as a surface being struck rather than material leaving.
    particles: [
      {
        emit: 'sparks',
        count: 5,
        color: COL.BONE,
        speed: 165,
        life: 0.3,
        size: 7,
        grav: 380,
        spread: 2.0,
        directional: true,
      },
      { emit: 'ring', from: 3, to: 19, color: COL.BONE, life: 0.18, lineWidth: 1.8, alpha: 0.36 },
    ],
    flash: null,
    trauma: 0.16,
    traumaCeiling: LAND_CEILING,
    haptic: 'land',
    float: null,
    why: 'Yours sparks. 0.16 is 0.38px — felt, not seen, and capped so a caravan cannot stack.',
  },
  {
    event: 'card_landed',
    condition: 'theirs',
    particles: [
      { emit: 'ring', from: 3, to: 15, color: COL.BONE, life: 0.13, lineWidth: 1.4, alpha: 0.22 },
    ],
    flash: null,
    trauma: 0,
    traumaCeiling: null,
    haptic: null,
    float: null,
    why: 'A contact mark so the table stays physical, and nothing else. This fires the most of any row.',
  },

  /* ── challenge_won ───────────────────────────────────────────────────── */
  {
    event: 'challenge_won',
    condition: 'mine',
    particles: [
      { emit: 'ring', from: 12, to: 52, color: COL.BRASS, life: 0.32, lineWidth: 3.0, alpha: 0.85 },
      { emit: 'sparks', count: 6, color: COL.BRASS, speed: 170, life: 0.32, size: 8, grav: 300 },
    ],
    flash: null,
    trauma: 0.2,
    traumaCeiling: null,
    haptic: null,
    float: null,
    why: 'Brass, no plate: being right is a good beat, not a world-stopping one. Haptic deliberately absent — see the header.',
  },
  {
    event: 'challenge_won',
    condition: 'theirs',
    particles: [
      { emit: 'ring', from: 12, to: 44, color: COL.ASH, life: 0.28, lineWidth: 2.0, alpha: 0.28 },
    ],
    flash: null,
    trauma: 0,
    traumaCeiling: null,
    haptic: null,
    float: null,
    why: 'Somebody was right about somebody else. A neutral ring says where it happened.',
  },

  /* ── challenge_lost ──────────────────────────────────────────────────── */
  {
    event: 'challenge_lost',
    condition: 'against_me',
    // One of Coup's three loud moments. Harder than the neutral ring in all
    // three dimensions a ring has: 5.5px of stroke instead of 2.2, 86px of
    // travel instead of 48, and 460ms instead of 280 — it arrives slower and
    // stays longer, which is what makes it read as "this one was aimed at you"
    // rather than as more sparkle. The flare is what makes it read as HERE.
    particles: [
      { emit: 'flare', size: 62, color: COL.CRIMSON, life: 0.3, alpha: 1 },
      { emit: 'ring', from: 10, to: 86, color: COL.CRIMSON, life: 0.46, lineWidth: 5.5, alpha: 1 },
      { emit: 'sparks', count: 12, color: COL.CRIMSON, speed: 250, life: 0.44, size: 9.5, grav: 300 },
    ],
    flash: { tone: 'crimson', strength: 0.3, durationMs: 500 },
    trauma: 0.3,
    traumaCeiling: null,
    haptic: 'targeted',
    float: { text: 'CAUGHT BLUFFING!', tone: 'crimson', scale: 1.35 },
    why: 'Loud moment 1 of 3. Everything a bystander does not get: red, shake, buzz, and a shout.',
  },
  {
    event: 'challenge_lost',
    condition: 'theirs',
    particles: [
      { emit: 'ring', from: 12, to: 48, color: COL.ASH, life: 0.3, lineWidth: 2.2, alpha: 0.3 },
    ],
    flash: null,
    trauma: 0,
    traumaCeiling: null,
    haptic: null,
    float: null,
    why: 'The same event with the red taken out. This row is the whole point of rule 2.',
  },

  /* ── influence_lost ──────────────────────────────────────────────────── */
  {
    event: 'influence_lost',
    condition: 'mine',
    particles: [
      { emit: 'ring', from: 8, to: 64, color: COL.CRIMSON, life: 0.42, lineWidth: 4.0, alpha: 0.5 },
      { emit: 'sparks', count: 12, color: COL.CRIMSON, speed: 210, life: 0.42, size: 9, grav: 340 },
    ],
    flash: { tone: 'crimson', strength: 0.3, durationMs: 520 },
    trauma: 0.34,
    traumaCeiling: null,
    haptic: 'influenceLost',
    float: { text: 'LOST', tone: 'crimson', scale: 1.2 },
    why: 'ART-DIRECTION §6 world-stopping moment 1: the only irreversible thing in this game.',
  },
  {
    event: 'influence_lost',
    condition: 'theirs',
    particles: [
      { emit: 'puff', count: 6, color: COL.ASH, life: 0.55, from: 14, to: 46, alpha: 0.3 },
    ],
    flash: null,
    trauma: 0,
    traumaCeiling: null,
    haptic: null,
    float: null,
    why: 'Volume dissipating, not glow. Somebody else got smaller; you did not feel it.',
  },

  /* ── coup_landed ─────────────────────────────────────────────────────── */
  {
    event: 'coup_landed',
    condition: 'against_me',
    particles: [
      { emit: 'flare', size: 70, color: COL.CRIMSON, life: 0.32, alpha: 1 },
      { emit: 'ring', from: 10, to: 92, color: COL.CRIMSON, life: 0.5, lineWidth: 6.0, alpha: 1 },
      { emit: 'sparks', count: 14, color: COL.CRIMSON, speed: 270, life: 0.46, size: 10, grav: 320 },
    ],
    flash: { tone: 'crimson', strength: 0.38, durationMs: 560 },
    trauma: 0.45,
    traumaCeiling: null,
    haptic: 'targeted',
    float: null,
    // No float: a Coup is always followed by influence_lost/mine, which shouts
    // "LOST" ~400ms later. Two shouts in one beat is a stack, not a sentence.
    why: 'The loudest non-terminal beat: 3.0px of shake. Unblockable and unbluffable, so it is allowed to be the biggest hit.',
  },
  {
    event: 'coup_landed',
    condition: 'mine',
    particles: [
      { emit: 'ring', from: 12, to: 52, color: COL.ASH, life: 0.3, lineWidth: 3.0, alpha: 0.55 },
      { emit: 'sparks', count: 6, color: COL.BONE, speed: 180, life: 0.3, size: 8, grav: 340 },
    ],
    flash: null,
    trauma: 0.2,
    traumaCeiling: null,
    haptic: null,
    float: null,
    why: 'Spending 7 coins is a beat. 0.6px of knock, no red — you are the one holding the hammer.',
  },
  {
    event: 'coup_landed',
    condition: 'theirs',
    particles: [
      { emit: 'ring', from: 12, to: 46, color: COL.ASH, life: 0.28, lineWidth: 2.0, alpha: 0.24 },
    ],
    flash: null,
    trauma: 0,
    traumaCeiling: null,
    haptic: null,
    float: null,
    why: 'A Coup across the table is information, not an event on your screen.',
  },

  /* ── assassinate_blocked ─────────────────────────────────────────────── */
  {
    event: 'assassinate_blocked',
    condition: 'against_me',
    // The signature: two things met at right angles and neither of them bent.
    // Ash rather than crimson on the plate, because nothing was lost — a block
    // is a refusal, and the refusal material is steel, not blood.
    particles: [
      { emit: 'cross', perArm: 5, color: COL.BONE, speed: 360, size: 8.5, life: 0.34, alpha: 1 },
      { emit: 'flare', size: 54, color: COL.BONE, life: 0.28, alpha: 0.9 },
    ],
    flash: { tone: 'ash', strength: 0.16, durationMs: 380 },
    trauma: 0.3,
    traumaCeiling: null,
    haptic: 'targeted',
    float: { text: 'BLOCKED!', tone: 'bone', scale: 1.35 },
    why: 'A knife stopped by a Contessa is a collision. Loud enough to feel, colourless because nobody bled.',
  },
  {
    event: 'assassinate_blocked',
    condition: 'theirs',
    particles: [
      { emit: 'cross', perArm: 3, color: COL.ASH, speed: 320, size: 7.5, life: 0.3, alpha: 0.5 },
    ],
    flash: null,
    trauma: 0,
    traumaCeiling: null,
    haptic: null,
    float: null,
    why: 'The same shape at half the count and half the alpha. Recognisable, ignorable.',
  },

  /* ── coins_changed ───────────────────────────────────────────────────── */
  {
    event: 'coins_changed',
    condition: 'mine',
    particles: [],
    flash: null,
    trauma: 0,
    traumaCeiling: null,
    haptic: null,
    float: { text: null, tone: 'signed', scale: 1 },
    why: 'A number, and nothing else. Coins change on almost every turn — this is the row that must stay cheap.',
  },
  {
    event: 'coins_changed',
    condition: 'theirs',
    particles: [],
    flash: null,
    trauma: 0,
    traumaCeiling: null,
    haptic: null,
    float: null,
    why: 'Empty on purpose. Six players taking Income is six floats a turn, which is a scoreboard, not a game.',
  },

  /* ── player_eliminated ───────────────────────────────────────────────── */
  {
    event: 'player_eliminated',
    condition: 'mine',
    particles: [{ emit: 'settle', count: 14, color: COL.ASH }],
    flash: null,
    trauma: 0.22,
    traumaCeiling: null,
    haptic: null,
    float: { text: 'ELIMINATED', tone: 'crimson', scale: 1.35 },
    why: 'No second flash and no second buzz — see the header. The dust settles and the word lands.',
  },
  {
    event: 'player_eliminated',
    condition: 'theirs',
    particles: [{ emit: 'settle', count: 14, color: COL.ASH }],
    flash: null,
    trauma: 0.22,
    traumaCeiling: null,
    haptic: null,
    float: null,
    why: 'The one bystander row that shakes: the table is a player smaller, which is a table-level fact.',
  },

  /* ── game_over ───────────────────────────────────────────────────────── */
  {
    event: 'game_over',
    condition: 'mine',
    particles: [
      { emit: 'confetti', count: 380, life: 3.2, delayMs: 1500 },
    ],
    flash: { tone: 'brass', strength: 0.3, durationMs: 700 },
    trauma: 0.6,
    traumaCeiling: null,
    haptic: 'win',
    float: null,
    why: 'ART-DIRECTION §6 world-stopping moment 2. 0.60 → 5.4px, the largest number in the table.',
  },
  {
    event: 'game_over',
    condition: 'theirs',
    particles: [{ emit: 'confetti', count: 150, life: 2.6 }],
    flash: { tone: 'brass', strength: 0.12, durationMs: 600 },
    trauma: 0.26,
    traumaCeiling: null,
    haptic: null,
    float: null,
    why: 'Somebody won and it was not you. The ceremony still happens; you are not in it.',
  },

  /* ── denied ──────────────────────────────────────────────────────────── */
  {
    event: 'denied',
    condition: 'mine',
    particles: [
      { emit: 'sparks', count: 2, color: COL.CRIMSON, speed: 120, life: 0.22, size: 6.5, grav: 260 },
    ],
    flash: null,
    trauma: 0,
    traumaCeiling: null,
    haptic: 'denied',
    float: null,
    // GAME-FEEL-PLAN §6.1: keep controls live and refuse out loud. The shake,
    // the sentence and the button pose belong to the control; the two red
    // chips and the 12ms tick belong here.
    why: 'A refusal is always yours — there is no theirs row, so a bystander denied cue resolves to nothing.',
  },
];

/* ── lookup ─────────────────────────────────────────────────────────────── */

/**
 * Resolve a cue to its row.
 *
 * The fallback chain is itself rule 1:
 *
 *   exact match
 *   → if the condition was `theirs`, STOP. A bystander beat never escalates to
 *     the loud form of the same event, even when the loud form is the only row
 *     that exists (see `denied`). Silence is the correct failure mode for an
 *     unmapped combination; a crimson wash is not.
 *   → the other self-condition, because `mine` and `against_me` are two shades
 *     of "this concerns you"
 *   → `theirs`, the quiet form
 *   → null
 */
export function rowFor(event: FxEvent, condition: FxCondition): FxRow | null {
  const exact = find(event, condition);
  if (exact) return exact;
  if (condition === 'theirs') return null;
  const other = condition === 'mine' ? 'against_me' : 'mine';
  return find(event, other) ?? find(event, 'theirs');
}

function find(event: FxEvent, condition: FxCondition): FxRow | null {
  for (let i = 0; i < FX_TABLE.length; i++) {
    const row = FX_TABLE[i];
    if (row.event === event && row.condition === condition) return row;
  }
  return null;
}

/** Every row for an event, in table order. Used by the tuning tests. */
export function rowsFor(event: FxEvent): readonly FxRow[] {
  return FX_TABLE.filter((row) => row.event === event);
}
