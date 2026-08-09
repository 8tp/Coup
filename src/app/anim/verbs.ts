/**
 * anim/verbs.ts — ART-DIRECTION §6's per-verb table, as parameters.
 *
 * §6: "Everything else is the same flight engine with different parameters …
 * Verbs differ only in arc, spin, duration and delay — and they must differ, or
 * a Steal feels like a Tax and the player learns nothing from watching the
 * table." This module is where those four numbers live, so a call site reads as
 * the verb it is performing rather than as four magic constants.
 *
 * PURITY. Same rule as the rest of `anim/`: `easing` and the `FlyOptions` type
 * are the only imports. No component, no store, no audio bus, no game types, no
 * `window` at module scope. A landing CUE is the caller's business — see the
 * `land` callback on `FlyOptions` and the note in flight.ts's header.
 *
 * ── UNITS ─────────────────────────────────────────────────────────────────
 * §6's Arc column reads "low, 14" / "18" / "22" / "mirrored ±34°" — the degree
 * sign on the last row is a slip. Arc is flight.ts's `arc`: a PERPENDICULAR
 * LIFT IN PIXELS. Spin is the only column in degrees, and §6 lists it
 * separately for Exchange (±8°). 34 is read here as 34px, in line with the
 * 14/18/22 above it.
 */

import { hash1, hashKey } from './easing';
import type { FlyOptions } from './flight';

/**
 * THE TRANSFORM CONTRACT, as the string an element must actually carry.
 *
 * flight.ts writes the four custom properties; something has to compose them.
 * In this app that cannot be a stylesheet rule on `.card-face`, because
 * `.card-face` already composes a DIFFERENT transform out of the press
 * variables (`--press-y`, `--press-s`, `--card-lift`) and one element cannot
 * have two authors of one property. So the flight transform goes on the
 * WRAPPER, inline, from here — one string, one place, and the fallbacks make an
 * element that has never flown render exactly as it did before.
 *
 * Translate outermost is load-bearing; see flight.ts's header.
 */
export const FLIGHT_TRANSFORM =
  'translate(var(--fx, 0px), var(--fy, 0px)) rotate(var(--tilt, 0deg)) scale(var(--fs, 1))';

/**
 * Ready to spread into a React `style` prop. Frozen and module-level so every
 * card wrapper in a hand shares one object instead of allocating per render.
 */
export const FLIGHT_TRANSFORM_STYLE: Readonly<{ transform: string }> =
  Object.freeze({ transform: FLIGHT_TRANSFORM });

/** ±1 from a stable key, so a screenshot run reproduces frame for frame. */
function sideOf(key: number | string | undefined): number {
  return hash1(hashKey(key) + 7) < 0.5 ? -1 : 1;
}

/* ── DEAL / DRAW (§6 row 1) ───────────────────────────────────────────────
   "Comes off the deck pile, grows into the hand; easeOutBack on scale gives it
   a settle." arc 14, spin ±3°, 260ms, 64ms stagger.

   RISE and SCALE are this app's reading of "off the deck pile". A card in a
   seat does not know where the deck is rendered and must not go looking — a
   component that queries a sibling's geometry is a layout dependency that
   breaks the first time the table reflows. So the launch point is stated
   relative to the slot: 34px above it at 0.86 scale, which is a card coming
   down from somewhere smaller and further away. The horizontal bow is the arc,
   and because the travel is straight down flight.ts picks its side from the
   key — deterministic, not random. */
export const DEAL_ARC = 14;
export const DEAL_SPIN = 3;
export const DEAL_DUR = 260;
export const DEAL_STAGGER_MS = 64;
export const DEAL_RISE = 34;
export const DEAL_SCALE = 0.86;

/**
 * A card arriving from the deck into a slot it already occupies in the DOM —
 * an exchange result, a challenge replacement. There is no FLIP here because
 * there is no previous position: the card did not move, it was *replaced*.
 */
export function dealIn(key: number | string, o: FlyOptions = {}): FlyOptions {
  return {
    key,
    dx: 0,
    dy: -DEAL_RISE,
    scale: DEAL_SCALE,
    arc: DEAL_ARC,
    spin: sideOf(key) * DEAL_SPIN,
    dur: DEAL_DUR,
    ...o,
  };
}

/* ── SWAP (§6 row 5) ──────────────────────────────────────────────────────
   "Mirrored ±34 with a 60ms offset … Two cards passing each other, not one blur
   crossing the felt." spin ±8°, 380ms.

   MIRRORING IS THE WHOLE POINT AND IT IS NOT FREE. flight.ts biases every arc
   to the UPWARD normal on purpose, so a card always rises off the felt rather
   than sliding through it — which means two cards trading places would both
   bow the same way and overlap into exactly the blur §6 is ruling out. A
   NEGATIVE arc is how you buy the other side: the card that travels left goes
   over, the card that travels right goes under, and they pass. The spin sign
   follows the arc sign so the two rotate opposite ways as well. */
export const EXCHANGE_ARC = 34;
export const EXCHANGE_SPIN = 8;
export const EXCHANGE_DUR = 380;
export const EXCHANGE_OFFSET_MS = 60;

export interface SwapContext {
  /** The FLIP invert: where the card IS minus where it belongs. */
  dx: number;
  dy: number;
  /**
   * Force which way this member passes, instead of deriving it from `dx`.
   *
   * Deriving is right for a hand reorder, where the members trade places and
   * therefore travel in opposite directions by construction. It is WRONG the
   * moment the two members share an endpoint instead of swapping ends: a
   * challenge reveal sends the proven card from the middle of the table to the
   * deck and pulls its replacement from the deck out to a seat, and when the
   * deck sits between the two the legs travel the SAME way. Derived, both bow
   * to the same side and overlap into exactly the blur §6's row rules out.
   * Pass ±1 (`swapSide()` on the leader, negated) to mirror off the partner
   * rather than off the geometry.
   */
  side?: number;
  /** The card the player actually touched. It leads; everything else offsets. */
  lead?: boolean;
  key?: number | string;
}

/**
 * Which way a swap member passes. `dx > 0` means the card is to the RIGHT of
 * its destination and is therefore travelling left, and that one goes over the
 * top.
 *
 * Rows wrap, so a card can move purely vertically; `dy` breaks that tie rather
 * than leaving the sign at 0 (an arc of 0 is a straight slide, which is the one
 * shape this verb exists to avoid).
 */
export function swapSide(ctx: SwapContext): number {
  if (ctx.side) return ctx.side < 0 ? -1 : 1;
  return ctx.dx > 0 ? 1 : ctx.dx < 0 ? -1 : ctx.dy >= 0 ? 1 : -1;
}

/** One member of a swap. */
export function exchangeSwap(ctx: SwapContext, o: FlyOptions = {}): FlyOptions {
  const side = swapSide(ctx);
  return {
    key: ctx.key,
    arc: side * EXCHANGE_ARC,
    spin: side * EXCHANGE_SPIN,
    dur: EXCHANGE_DUR,
    delay: ctx.lead ? 0 : EXCHANGE_OFFSET_MS,
    ...o,
  };
}

/* ── TRAVEL, THE SHARED CONTEXT ───────────────────────────────────────────
   Every verb below that uses `fly()` needs the same three things, and they
   mean exactly what `SwapContext.dx/dy` above mean: the FLIP INVERT — where
   the element IS minus where it BELONGS. flight.ts launches from
   `rest + (dx, dy)` and lands on `rest`, so a positive `dx` is a card sitting
   to the RIGHT of its destination and therefore travelling LEFT.

   `punch()` does NOT use this convention — its two arguments are the PEAK
   displacement, i.e. the direction the card lunges. The three verbs that shove
   (`assassinate`, `challengeShove`, `blockCut`) take contexts with different
   field names for exactly that reason: a `dx` that means "start here" and a
   `dx` that means "go there" must not be spellable the same way. */
export interface TravelContext {
  /** The FLIP invert: where the element is minus where it belongs. */
  dx: number;
  dy: number;
  /** Seeds the deterministic spin/arc side. A card or player id. */
  key?: number | string;
}

/* ── STRIKE (§6 row 3) ────────────────────────────────────────────────────
   "Coup: 0 (straight, fast). Assassinate: lunges 34% of the way at the target
   and stops." spin 5°, 300ms. "34% is as far as a card can travel before it
   reads as a second flight rather than a threat. Coup arms hitstop; the
   target's seat takes the shake."

   THE SPIN IS SHARED, THE PRIMITIVE IS NOT. Coup is a `fly()` — the card
   actually crosses the table and lands on the target. Assassinate is a
   `punch()` — there is no landing, because the knife does not arrive, it is
   *shown*. One verb table row, two engine primitives, and the sign convention
   differs between them (see TravelContext above). */

/** §6's Strike row. Both strikes, so a Coup and an Assassinate rhyme. */
export const STRIKE_DUR = 300;
export const STRIKE_SPIN = 5;

/**
 * How far up the vector to the target the knife goes.
 *
 * §6 fixes this at 34% and gives the reason: past it the card reads as a second
 * flight rather than a threat. Held exactly, because it is the one number in
 * the table with an argument attached rather than a feel.
 */
export const ASSASSINATE_REACH = 0.34;

/**
 * Where a `punch()` peaks, as a fraction of its duration.
 *
 * flight.ts's default `env` is 0.62 and its header says the peak is "~35%".
 * Computed rather than repeated: the envelope is sin(π·pᵉ), which peaks when
 * pᵉ = 0.5, i.e. p = 0.5^(1/0.62) = 0.327. So the lunge is out in the first
 * THIRD and spends the other two thirds recovering — which is the asymmetry
 * that makes it read as a hit instead of a wobble. Restated here as a named
 * constant so a verb that wants a different asymmetry (see `blockCut`) is
 * visibly choosing one rather than forgetting the default exists.
 */
export const LUNGE_ENV = 0.62;

/** The vector a lunge is a fraction OF. Deliberately not named `dx`/`dy`. */
export interface LungeContext {
  /** From the card's current position TO its target, in px. */
  toX: number;
  toY: number;
  key?: number | string;
}

/**
 * §6's Assassinate: 34% of the way at the target and stops.
 *
 * Feed the result to `punch()`, not `fly()`:
 *
 *     const o = assassinate({ toX, toY });
 *     punch(el, o.dx!, o.dy!, o);
 *
 * `dx`/`dy` carry the lunge because that is where `punch` reads its peak
 * displacement from and because a caller should never have to compute 0.34 ×
 * anything itself. NO HITSTOP: §6 arms it on exactly three things and an
 * assassination is not one of them — the knife can still be blocked by a
 * Contessa, and freezing the table for a threat that may evaporate spends one
 * of the two world-stopping moments on a maybe.
 */
export function assassinate(ctx: LungeContext, o: FlyOptions = {}): FlyOptions {
  return {
    key: ctx.key,
    dx: ctx.toX * ASSASSINATE_REACH,
    dy: ctx.toY * ASSASSINATE_REACH,
    dur: STRIKE_DUR,
    spin: sideOf(ctx.key) * STRIKE_SPIN,
    env: LUNGE_ENV,
    ...o,
  };
}

/**
 * §6's Coup: straight, fast, hitstop armed.
 *
 * `arc: 0` is the whole signature. Every other flight on this table bows,
 * because paper thrown across a felt bows; a Coup is the one action nobody can
 * challenge or block, and a card that travels in a dead straight line is the
 * only way the motion can say "this is already decided".
 *
 * The 5° spin survives the straight line. Spin rides the sine envelope, which
 * flight.ts computes independently of the arc, so `arc: 0` costs the bow and
 * keeps the roll — and a card with no rotation at all reads as a UI element
 * sliding rather than a printed thing being thrown.
 *
 * THE SHAKE IS NOT HERE. §6: "the target's seat takes the shake", and fx/ owns
 * shake (the `coup_landed` row in fx/tuning.ts). A second shake authored from
 * the motion layer would be two clocks displacing one element.
 */
export const COUP_ARC = 0;

export function coupSlam(ctx: TravelContext, o: FlyOptions = {}): FlyOptions {
  return {
    key: ctx.key,
    dx: ctx.dx,
    dy: ctx.dy,
    arc: COUP_ARC,
    spin: sideOf(ctx.key) * STRIKE_SPIN,
    dur: STRIKE_DUR,
    hit: true,
    ...o,
  };
}

/* ── TAKE-FROM (§6 row 4) ─────────────────────────────────────────────────
   "22, hero lift … ±6° … 340ms after a 120ms delay. The delay is the tell — a
   theft you can see coming." */

export const STEAL_ARC = 22;
export const STEAL_SPIN = 6;
export const STEAL_DUR = 340;
export const STEAL_DELAY_MS = 120;

/**
 * `speed` MULTIPLIES the duration (flight.ts), so 1.12 makes the steal 12%
 * SLOWER, not faster. That is the intent: weight, not haste.
 *
 * The arithmetic, because §6's "340ms" and this multiplier cannot both be the
 * wall time. Wall time is clampMs(340 × 1.12) = 380.8ms, and the whole event —
 * delay plus flight — is 120 + 380.8 = 500.8ms, inside flight.ts's 600ms
 * MAX_EVENT_MS with 99ms to spare. 340 is the base the verb table names; the
 * multiplier is the weight on top of it. Read literally as "the flight lasts
 * 340ms" the table is wrong by 41ms, and that is the deviation.
 */
export const STEAL_SPEED = 1.12;

/**
 * §6's "hero lift", as `bump` — extra scale at mid-flight, exactly 0 at both
 * ends so the landing is untouched.
 *
 * 0.06 is bounded from above by the deal: `DEAL_SCALE` is 0.86, a 14% growth
 * that is supposed to read as "this card came from somewhere further away". A
 * hero lift has to stay well under that or a steal starts reading as a second
 * deal, so it takes under half of it.
 */
export const STEAL_LIFT = 0.06;

/**
 * §6's Steal. The delay is the verb: for 120ms nothing happens, and then the
 * coins leave. It is the only action in the game the victim can watch coming.
 */
export function steal(ctx: TravelContext, o: FlyOptions = {}): FlyOptions {
  return {
    key: ctx.key,
    dx: ctx.dx,
    dy: ctx.dy,
    arc: STEAL_ARC,
    spin: sideOf(ctx.key) * STEAL_SPIN,
    dur: STEAL_DUR,
    speed: STEAL_SPEED,
    delay: STEAL_DELAY_MS,
    bump: STEAL_LIFT,
    ...o,
  };
}

/* ── REFUSE (§6 row 6) ────────────────────────────────────────────────────
   "the challenged card comes in fast; the loser's card is shoved back −0.22 …
   −9° … 280ms. Block is the same shove cut dead, no tail."

   ONE ROW, TWO FUNCTIONS, AND THAT IS A DEVIATION WORTH STATING. The row
   describes two elements doing two different things at once: a card arriving
   (`fly`) and a different card recoiling (`punch`). No single FlyOptions
   factory can be both, so the row is split — `challengeArrive` for the card
   that comes in and `challengeShove` for the one that is pushed. They share
   the row's 280ms so the two halves of the collision are one beat.

   −0.22 IS A FRACTION, NOT A PIXEL COUNT. §6 gives it unsigned by anything: at
   22px it would be a nudge a player cannot see across a 15rem seat, and at
   22% of the travel it would grow with the table. 22% of the card's OWN WIDTH
   is the reading that is scale-free and still visible — a card shoved back by
   a fifth of itself is unmistakably recoil and unmistakably not travel. On the
   1024px table's 4.25rem deck leaf that is 15px; on a hand card it is more. */

export const SHOVE_FRACTION = 0.22;
export const SHOVE_SPIN = -9;
export const SHOVE_DUR = 280;

/**
 * `blockCut`'s envelope. §6: "the same shove cut dead, no tail."
 *
 * The tail is the RECOVERY, so the knob is the envelope, not the displacement.
 * With `LUNGE_ENV` (0.62) the peak is at p = 0.327 and 67% of the beat is the
 * card drifting home — that drift is the tail. Inverting the skew moves the
 * peak late: sin(π·p^1.6) peaks at p = 0.5^(1/1.6) = 0.649, so the shove takes
 * 65% of the beat going out and snaps back in the remaining 35%.
 */
export const BLOCK_CUT_ENV = 1.6;

/**
 * And it is shorter. 220ms against the row's 280ms — "cut dead" is a shorter
 * beat as well as a shorter recovery, and a block has nothing after it to wait
 * for, where a challenge has a reveal coming.
 */
export const BLOCK_CUT_DUR = 220;

/** How far the challenged card's arrival travels before it lands. §6: fast. */
export const CHALLENGE_ARRIVE_ARC = 12;
export const CHALLENGE_ARRIVE_SPIN = 4;

export interface ShoveContext {
  /** The shoved card's own width in px — the displacement is a fraction of it. */
  width: number;
  /** Which way it is pushed. Defaults to straight back, i.e. leftwards. */
  dirX?: number;
  dirY?: number;
  key?: number | string;
}

function shove(ctx: ShoveContext, dur: number, env: number, o: FlyOptions): FlyOptions {
  const dx = ctx.dirX ?? -1;
  const dy = ctx.dirY ?? 0;
  // Normalise, so a caller passing a raw seat-to-seat vector gets a shove of
  // the stated size rather than one scaled by how far apart the seats are.
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const push = SHOVE_FRACTION * ctx.width;
  return {
    key: ctx.key,
    dx: (dx / len) * push,
    dy: (dy / len) * push,
    dur,
    spin: SHOVE_SPIN,
    env,
    ...o,
  };
}

/**
 * The loser's card, shoved back. Feed to `punch()` — `dx`/`dy` are the PEAK
 * displacement, and the card ends exactly where it started.
 *
 * The spin is −9° unsigned by any key, and that is deliberate where deal and
 * strike pick a side from a hash: a shove has a direction the game chose, so
 * randomising which way it rolls would put a deterministic gesture on a
 * coin-flip.
 */
export function challengeShove(ctx: ShoveContext, o: FlyOptions = {}): FlyOptions {
  return shove(ctx, SHOVE_DUR, LUNGE_ENV, o);
}

/** The same shove with the tail taken off it. §6's Block. */
export function blockCut(ctx: ShoveContext, o: FlyOptions = {}): FlyOptions {
  return shove(ctx, BLOCK_CUT_DUR, BLOCK_CUT_ENV, o);
}

/**
 * The other half of §6's Refuse row: the challenged card coming in fast, to be
 * looked at. A `fly()`, and one of the exactly three things §6 arms hitstop
 * on — "a revealed influence landing face-up, a Coup card landing, a challenge
 * resolving". This is the third.
 *
 * The arc is 12, below Deal's 14: this is the flattest bow on the table
 * because a card thrown down as evidence is thrown, not dealt.
 */
export function challengeArrive(ctx: TravelContext, o: FlyOptions = {}): FlyOptions {
  return {
    key: ctx.key,
    dx: ctx.dx,
    dy: ctx.dy,
    arc: CHALLENGE_ARRIVE_ARC,
    spin: sideOf(ctx.key) * CHALLENGE_ARRIVE_SPIN,
    dur: SHOVE_DUR,
    hit: true,
    ...o,
  };
}

/* ── FALL (§6 row 7) ──────────────────────────────────────────────────────
   "22 … ±26° tumble … 420ms … Lands face-up in the discard and STAYS there."

   420ms is exactly flight.ts's MS_MAX, so this verb is the slowest thing that
   can happen on this table and no distance can make it slower. That is the
   right shape for the one irreversible event in Coup (§6's first
   world-stopping moment): every other flight speeds up or slows down with the
   geometry; a card being lost always takes the same, longest beat.

   Armed. `hit` pulls HITSTOP_MS out of the duration at launch — 420 − 45 =
   375ms of travel, 45ms of frozen table, 420ms of wall clock. */
export const FALL_ARC = 22;
export const FALL_SPIN = 26;
export const FALL_DUR = 420;

export function influenceTumble(ctx: TravelContext, o: FlyOptions = {}): FlyOptions {
  return {
    key: ctx.key,
    dx: ctx.dx,
    dy: ctx.dy,
    arc: FALL_ARC,
    spin: sideOf(ctx.key) * FALL_SPIN,
    dur: FALL_DUR,
    hit: true,
    ...o,
  };
}

/* ── THE QUIET VERBS (§6 row 2) ───────────────────────────────────────────
   "Take (Income, Tax, Foreign Aid, Embezzle) … Deliberately plain. Coins
   travel from the treasury to the seat; THE CARD DOES NOT MOVE."

   There is no `income()` and no `tax()` in this file and there must not be.
   §6's budget is two world-stopping moments, and it only balances because the
   twelve beats around them spend nothing. A card that hops when you take
   Income is a card that has taught the player that hopping means nothing,
   which is a tax on the Coup that lands three turns later.

   The Take row's 18/±4°/300ms describes the COIN, not the card, and coins are
   fx/floaters.ts's `coins_changed` — a different layer with a different
   budget. If a verb ever appears here for a Take, one of §6's two moments has
   to give something up to pay for it. */
