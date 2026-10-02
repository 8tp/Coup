/**
 * THE SIX VERBS THAT HAD NO CALL SITES, AS THE APP NOW CALLS THEM.
 *
 * `verbs.test.ts` proves the factories carry §6's numbers. This file proves the
 * COMPOSITIONS the components perform with them: which primitive each verb is
 * fed to, which element ends up moving, that exactly one of `land`/`abort`
 * fires per gesture, that a landing cue never rides on an abort, and that §7's
 * collapse leaves the cue sequence identical.
 *
 * Same contract as the rest of this directory: node environment, hand-driven
 * rAF, no jsdom and no real frames. The elements are stand-ins for the four
 * real ones — the thrown action card (GameTable's `ActionCardFlight`), a seat
 * plate (`.table-seat` / `.table-bottom-hand`), a card inside that seat
 * (`.card-flip-wrapper`), and a card in the discard.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { reset as resetClock } from '@/app/anim/clock';
import {
  MAX_EVENT_MS,
  cancel,
  fly,
  hitstopCount,
  liveCount,
  punch,
  resetFlights,
  setReducedMotion,
  setRest,
} from '@/app/anim/flight';
import {
  ASSASSINATE_REACH,
  BLOCK_CUT_DUR,
  BLOCK_CUT_ENV,
  FALL_DUR,
  FLIGHT_TRANSFORM,
  FALL_SPIN,
  LUNGE_ENV,
  SHOVE_DUR,
  SHOVE_FRACTION,
  SHOVE_SPIN,
  STEAL_DELAY_MS,
  STEAL_DUR,
  STEAL_SPEED,
  STRIKE_DUR,
  assassinate,
  blockCut,
  challengeShove,
  coupSlam,
  influenceTumble,
  steal,
} from '@/app/anim/verbs';
import { FLIGHT_VARS_RESET } from '@/app/components/game/CardFace';
import { FakeElement, installRaf, type RafHarness } from './fakeDom';

let raf: RafHarness;

beforeEach(() => {
  resetFlights();
  resetClock();
  raf = installRaf();
});

afterEach(() => {
  setReducedMotion(false);
  resetFlights();
  resetClock();
  raf.restore();
});

interface Point {
  x: number;
  y: number;
}

/** Two seats a table apart: the actor bottom-left, the target top-right. */
const ACTOR: Point = { x: 220, y: 700 };
const TARGET: Point = { x: 820, y: 700 };

/**
 * Exactly the arithmetic `ActionCardFlight` does. The anchor is where the card
 * RESTS and `other` is the far end, chosen per verb so that one vector serves
 * both `fly`'s FLIP invert and `punch`'s peak displacement.
 */
function vec(anchor: Point, other: Point): { dx: number; dy: number } {
  return { dx: other.x - anchor.x, dy: other.y - anchor.y };
}

/** The peak absolute value of a custom property over a whole beat. */
function peakOf(el: FakeElement, prop: string, ms: number, step = 4): { peak: number; at: number } {
  let peak = 0;
  let at = 0;
  for (let t = 0; t < ms; t += step) {
    raf.frame(step);
    const v = Math.abs(el.num(prop) || 0);
    if (v > peak) {
      peak = v;
      at = (t + step) / ms;
    }
  }
  return { peak, at };
}

/* ── the inheritance stop ────────────────────────────────────────────────── */

describe('a seat can fly because the cards inside it are insulated from it', () => {
  it('FLIGHT_VARS_RESET declares all four contract variables at their identity', () => {
    // Custom properties inherit, and `.card-flip-wrapper` reads `var(--fx, 0px)`.
    // Without a zero declared on the container, a seat's shove would be read by
    // every card in it as its own displacement and each card would move twice.
    expect(FLIGHT_VARS_RESET).toEqual({ '--fx': '0px', '--fy': '0px', '--tilt': '0deg', '--fs': '1' });
    expect(Object.isFrozen(FLIGHT_VARS_RESET)).toBe(true);
  });

  it('it stops exactly the variables the transform reads — no more, no fewer', () => {
    // Derived from the contract rather than restated, so a fifth variable added
    // to FLIGHT_TRANSFORM cannot slip past the inheritance stop.
    const read = [...FLIGHT_TRANSFORM.matchAll(/var\((--[a-z]+),/g)].map(m => m[1]).sort();
    expect(Object.keys(FLIGHT_VARS_RESET).sort()).toEqual(read);
    // ...and each identity value is genuinely a no-op for that variable.
    const reset = FLIGHT_VARS_RESET as Record<string, string>;
    for (const v of read) expect(parseFloat(reset[v])).toBe(v === '--fs' ? 1 : 0);
  });

  it('the shove writes to the seat and to nothing else', () => {
    const seat = new FakeElement();
    const cardInSeat = new FakeElement();
    const before = cardInSeat.writeCount();

    const o = challengeShove({ width: 56, key: 'loser' });
    punch(seat, o.dx ?? 0, o.dy ?? 0, o);
    raf.run(SHOVE_DUR + 60, 8);

    expect(seat.writeCount()).toBeGreaterThan(0);
    expect(cardInSeat.writeCount()).toBe(before);
  });
});

/* ── §6 Strike: the Coup ─────────────────────────────────────────────────── */

describe('coupSlam — the action card thrown at the target', () => {
  /** The card rests on the TARGET and launches from the actor. */
  function throwCoup(land: () => void, abort: () => void): FakeElement {
    const card = new FakeElement();
    const o = coupSlam({ ...vec(TARGET, ACTOR), key: 'coup-1' });
    expect(fly(card, { ...o, land, abort })).toBe(true);
    return card;
  }

  it('travels the whole way from the actor\'s seat to the target\'s, in a dead straight line', () => {
    const land = vi.fn();
    const abort = vi.fn();
    const card = throwCoup(land, abort);

    // It starts at the actor: −600px of --fx relative to its rest on the target.
    expect(card.num('--fx')).toBeCloseTo(ACTOR.x - TARGET.x, 0);

    // arc: 0 is the verb's whole signature. The travel is horizontal, so any
    // bow at all would show up in --fy.
    for (let i = 0; i < 50; i++) {
      raf.frame(8);
      expect(card.num('--fy')).toBe(0);
    }
    expect(card.style.getPropertyValue('--fx')).toBe('0px');
  });

  it('arms the hitstop, and lands exactly once', () => {
    const before = hitstopCount();
    const land = vi.fn();
    const abort = vi.fn();
    throwCoup(land, abort);

    raf.run(STRIKE_DUR + 200, 8);

    expect(hitstopCount()).toBe(before + 1);
    expect(land).toHaveBeenCalledTimes(1);
    expect(abort).not.toHaveBeenCalled();
    expect(liveCount()).toBe(0);
  });

  it('a Coup removed mid-air is silent — no landing sound for a card nobody saw arrive', () => {
    const land = vi.fn();
    const abort = vi.fn();
    const card = throwCoup(land, abort);
    raf.run(90, 8);

    // The component's ceiling, and its unmount cleanup, both do exactly this.
    cancel(card);

    expect(land).not.toHaveBeenCalled();
    expect(abort).toHaveBeenCalledTimes(1);
    raf.run(STRIKE_DUR, 8);
    expect(land).not.toHaveBeenCalled();
  });
});

/* ── §6 Strike: the Assassinate ──────────────────────────────────────────── */

describe('assassinate — the action card lunges from the actor and comes back', () => {
  /** The card rests on the ACTOR and lunges at the target. */
  function lunge(land: () => void, abort: () => void): FakeElement {
    const card = new FakeElement();
    const v = vec(ACTOR, TARGET);
    const o = assassinate({ toX: v.dx, toY: v.dy, key: 'kill-1' });
    expect(punch(card, o.dx ?? 0, o.dy ?? 0, { ...o, land, abort })).toBe(true);
    return card;
  }

  it('reaches 34% of the way and stops, then returns to exactly where it was', () => {
    const land = vi.fn();
    const abort = vi.fn();
    const card = lunge(land, abort);
    const distance = TARGET.x - ACTOR.x;

    const { peak, at } = peakOf(card, '--fx', STRIKE_DUR);
    expect(peak).toBeCloseTo(distance * ASSASSINATE_REACH, 0);
    // §6: past 34% it reads as a second flight rather than a threat.
    expect(peak / distance).toBeLessThan(0.35);
    // sin(π·p^0.62) peaks at 0.327 — out fast, recover slow. A hit, not a wobble.
    expect(at).toBeLessThan(0.5);
    expect(0.5 ** (1 / LUNGE_ENV)).toBeCloseTo(0.327, 3);

    raf.run(STRIKE_DUR, 8);
    expect(card.style.getPropertyValue('--fx')).toBe('0px');
    expect(land).toHaveBeenCalledTimes(1);
    expect(abort).not.toHaveBeenCalled();
  });

  it('does NOT freeze the table — a knife a Contessa can still stop is not a moment', () => {
    const before = hitstopCount();
    lunge(vi.fn(), vi.fn());
    raf.run(STRIKE_DUR + 120, 8);
    expect(hitstopCount()).toBe(before);
  });
});

/* ── §6 Take-from: the Steal ─────────────────────────────────────────────── */

describe('steal — the card rests on the thief and comes off the victim', () => {
  function theft(land: () => void, abort: () => void): FakeElement {
    const card = new FakeElement();
    // The driver hands the gesture over as victim → thief, so the anchor is
    // the thief and the launch point is the victim.
    const o = steal({ ...vec(ACTOR, TARGET), key: 'steal-1' });
    expect(fly(card, { ...o, land, abort })).toBe(true);
    return card;
  }

  it('holds at the victim\'s seat for 120ms before anything moves', () => {
    const card = theft(vi.fn(), vi.fn());
    const launch = card.num('--fx');
    expect(launch).toBeCloseTo(TARGET.x - ACTOR.x, 0);

    // The tell: for a fifth of a second the card just sits there.
    raf.run(STEAL_DELAY_MS - 20, 5);
    expect(card.num('--fx')).toBe(launch);

    raf.run(60, 5);
    expect(card.num('--fx')).not.toBe(launch);
  });

  it('carries a hero lift that is exactly nothing at both ends', () => {
    const card = theft(vi.fn(), vi.fn());
    raf.run(STEAL_DELAY_MS, 5);
    const { peak } = peakOf(card, '--fs', STEAL_DUR * STEAL_SPEED);
    // --fs peaks above 1 mid-flight...
    expect(peak).toBeGreaterThan(1);
    raf.run(200, 8);
    // ...and the landing is untouched by it.
    expect(card.style.getPropertyValue('--fs')).toBe('1');
  });

  it('the whole event — hold plus weighted flight — fits the 600ms budget', () => {
    const land = vi.fn();
    theft(land, vi.fn());
    raf.run(MAX_EVENT_MS, 8);
    expect(land).toHaveBeenCalledTimes(1);
    expect(liveCount()).toBe(0);
  });

  it('a theft cut short inside its own delay never announced itself', () => {
    const land = vi.fn();
    const abort = vi.fn();
    const card = theft(land, abort);
    raf.run(STEAL_DELAY_MS - 40, 5);
    cancel(card);

    expect(land).not.toHaveBeenCalled();
    // `started: false` — flight.ts's second abort argument — is how a caller
    // knows the gesture never began.
    expect(abort).toHaveBeenCalledTimes(1);
    expect(abort.mock.calls[0][1]).toBe(false);
  });
});

/* ── §6 Refuse: the two shoves, and the difference between them ──────────── */

describe('challengeShove and blockCut — one row, two beats', () => {
  const WIDTH = 56;

  function shove(kind: 'challenge' | 'block', dir: { dirX?: number; dirY?: number }, cb?: () => void) {
    const seat = new FakeElement();
    const ctx = { width: WIDTH, key: 'loser', ...dir };
    const o = kind === 'challenge' ? challengeShove(ctx) : blockCut(ctx);
    punch(seat, o.dx ?? 0, o.dy ?? 0, { ...o, land: cb });
    return { seat, o };
  }

  it('both displace the seat by 22% of a card, never of the seat', () => {
    const a = shove('challenge', {});
    const b = shove('block', {});
    const expected = SHOVE_FRACTION * WIDTH;
    expect(Math.hypot(a.o.dx ?? 0, a.o.dy ?? 0)).toBeCloseTo(expected, 10);
    expect(Math.hypot(b.o.dx ?? 0, b.o.dy ?? 0)).toBeCloseTo(expected, 10);
    // ~12px on a desktop seat card. A fifth of the SEAT would be 53px.
    expect(expected).toBeLessThan(13);
  });

  it('the challenge shove has a tail; the block is cut dead', () => {
    const a = shove('challenge', {});
    const peakA = peakOf(a.seat, '--fx', SHOVE_DUR, 4);
    raf.run(120, 8);

    const b = shove('block', {});
    const peakB = peakOf(b.seat, '--fx', BLOCK_CUT_DUR, 4);

    // Same displacement...
    expect(peakA.peak).toBeCloseTo(peakB.peak, 0);
    // ...different shape. The challenge is out in the first third and spends
    // two thirds drifting home; the block goes out for two thirds and snaps.
    expect(peakA.at).toBeLessThan(0.5);
    expect(peakB.at).toBeGreaterThan(0.5);
    expect(0.5 ** (1 / BLOCK_CUT_ENV)).toBeCloseTo(0.6484, 3);
    // And it is a shorter beat as well as a shorter recovery.
    expect(BLOCK_CUT_DUR).toBeLessThan(SHOVE_DUR);
  });

  it('is pushed directly away from whoever pushed it, and lands back on its pose', () => {
    // Winner to the left of the loser: the loser goes further right.
    const { seat } = shove('challenge', { dirX: 400, dirY: -300 });
    raf.run(SHOVE_DUR / 3, 4);
    expect(seat.num('--fx')).toBeGreaterThan(0);
    expect(seat.num('--fy')).toBeLessThan(0);
    // The −9° roll is unsigned by any key: the game chose the direction, so
    // the roll is not a coin flip.
    expect(seat.num('--tilt')).toBeLessThan(0);
    expect(SHOVE_SPIN).toBe(-9);

    raf.run(SHOVE_DUR, 4);
    expect(seat.style.getPropertyValue('--fx')).toBe('0px');
    expect(seat.style.getPropertyValue('--fy')).toBe('0px');
    expect(seat.style.getPropertyValue('--tilt')).toBe('0deg');
  });

  it('with no winner on screen it recoils straight back, not towards the viewport corner', () => {
    const { o } = shove('block', {});
    expect(o.dx).toBeLessThan(0);
    expect(o.dy).toBe(0);
  });

  it('a seat shoved twice resolves the first shove as an abort, exactly once', () => {
    const seat = new FakeElement();
    const first = vi.fn();
    const firstAbort = vi.fn();
    const second = vi.fn();

    const a = challengeShove({ width: WIDTH, key: 'x' });
    punch(seat, a.dx ?? 0, a.dy ?? 0, { ...a, land: first, abort: firstAbort });
    raf.run(60, 6);

    const b = blockCut({ width: WIDTH, key: 'x' });
    punch(seat, b.dx ?? 0, b.dy ?? 0, { ...b, land: second });

    expect(first).not.toHaveBeenCalled();
    expect(firstAbort).toHaveBeenCalledTimes(1);
    raf.run(BLOCK_CUT_DUR + 80, 6);
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
    expect(liveCount()).toBe(0);
  });
});

/* ── §6 Fall: the influence going to the discard ─────────────────────────── */

describe('influenceTumble — the discard card, thrown from its owner\'s seat', () => {
  /** The card is IN the discard well and belongs there; it fell from the seat. */
  function fall(land: () => void, abort: () => void): FakeElement {
    const card = new FakeElement();
    // Its rest pose is the tilt the discard gives it; the flight lands ON that.
    setRest(card, 0, 0, 0);
    const o = influenceTumble({ dx: ACTOR.x - 640, dy: ACTOR.y - 300, key: 'Duke' });
    expect(fly(card, { ...o, land, abort })).toBe(true);
    return card;
  }

  it('is the slowest thing on the table and spins on the way down', () => {
    const o = influenceTumble({ dx: -400, dy: 300, key: 'Duke' });
    expect(o.dur).toBe(FALL_DUR);
    expect(Math.abs(o.spin ?? 0)).toBe(FALL_SPIN);
    expect(o.hit).toBe(true);

    const card = fall(vi.fn(), vi.fn());
    const { peak } = peakOf(card, '--tilt', FALL_DUR * 0.8, 6);
    expect(peak).toBeGreaterThan(6);
    expect(peak).toBeLessThanOrEqual(FALL_SPIN);
  });

  it('lands face-up on its resting tilt and stays there, cueing once', () => {
    const land = vi.fn();
    const abort = vi.fn();
    const card = new FakeElement();
    setRest(card, 0, 0, -4);
    const o = influenceTumble({ dx: -420, dy: 260, key: 'Contessa' });
    fly(card, { ...o, land, abort });

    raf.run(FALL_DUR + 200, 8);
    expect(land).toHaveBeenCalledTimes(1);
    expect(abort).not.toHaveBeenCalled();
    // ON the rest pose, never on zero: the discard's tilt survives the flight.
    expect(card.style.getPropertyValue('--tilt')).toBe('-4deg');
    expect(card.style.getPropertyValue('--fx')).toBe('0px');
    expect(liveCount()).toBe(0);
  });

  it('a card whose node goes away mid-fall aborts rather than landing', () => {
    const land = vi.fn();
    const abort = vi.fn();
    const card = fall(land, abort);
    raf.run(120, 8);
    card.isConnected = false;
    raf.run(60, 8);

    expect(land).not.toHaveBeenCalled();
    expect(abort).toHaveBeenCalledTimes(1);
    expect(liveCount()).toBe(0);
  });
});

/* ── the six gestures read as six different shapes ───────────────────────── */

describe('the six verbs are actually different from each other', () => {
  it('no two of them share a duration, an arc and an envelope', () => {
    const v = vec(TARGET, ACTOR);
    const shape = (o: { dur?: number; arc?: number; env?: number; delay?: number; hit?: boolean }) =>
      [o.dur ?? 0, o.arc ?? 'auto', o.env ?? 1, o.delay ?? 0, !!o.hit].join('/');

    const shapes = [
      shape(coupSlam({ ...v, key: 'k' })),
      shape(assassinate({ toX: v.dx, toY: v.dy, key: 'k' })),
      shape(steal({ ...v, key: 'k' })),
      shape(challengeShove({ width: 56 })),
      shape(blockCut({ width: 56 })),
      shape(influenceTumble({ ...v, key: 'k' })),
    ];
    expect(new Set(shapes).size).toBe(shapes.length);
  });

  it('§6\'s hitstop budget is spent on the Coup and the Fall, and nothing else', () => {
    const v = vec(TARGET, ACTOR);
    expect(coupSlam({ ...v }).hit).toBe(true);
    expect(influenceTumble({ ...v }).hit).toBe(true);
    expect(assassinate({ toX: v.dx, toY: v.dy }).hit).toBeUndefined();
    expect(steal({ ...v }).hit).toBeUndefined();
    expect(challengeShove({ width: 56 }).hit).toBeUndefined();
    expect(blockCut({ width: 56 }).hit).toBeUndefined();
  });
});

/* ── §7 ──────────────────────────────────────────────────────────────────── */

describe('reduced motion — the same cues, in the same order, with no frames', () => {
  /**
   * A turn's worth of beats, fired one at a time exactly as the game fires
   * them: a knife, a theft, a coup, a block, a challenge, a card lost. The
   * order is the sequence's, not the durations', because these never overlap.
   */
  function playBeats(settle: (ms: number) => void): string[] {
    const order: string[] = [];
    const cue = (name: string) => () => order.push(name);
    const v = vec(TARGET, ACTOR);

    const knife = new FakeElement();
    const ka = assassinate({ toX: -v.dx, toY: -v.dy, key: 'a' });
    punch(knife, ka.dx ?? 0, ka.dy ?? 0, { ...ka, land: cue('assassinate') });
    settle(STRIKE_DUR + 120);

    const purse = new FakeElement();
    fly(purse, steal({ ...v, key: 's' }, { land: cue('steal') }));
    settle(MAX_EVENT_MS + 120);

    const coup = new FakeElement();
    fly(coup, coupSlam({ ...v, key: 'c' }, { land: cue('coup') }));
    settle(STRIKE_DUR + 220);

    const blocked = new FakeElement();
    const bc = blockCut({ width: 56, key: 'b' });
    punch(blocked, bc.dx ?? 0, bc.dy ?? 0, { ...bc, land: cue('block') });
    settle(BLOCK_CUT_DUR + 120);

    const loser = new FakeElement();
    const cs = challengeShove({ width: 56, key: 'l' });
    punch(loser, cs.dx ?? 0, cs.dy ?? 0, { ...cs, land: cue('challenge') });
    settle(SHOVE_DUR + 120);

    const lost = new FakeElement();
    fly(lost, influenceTumble({ ...v, key: 'd' }, { land: cue('tumble') }));
    settle(FALL_DUR + 220);

    return order;
  }

  it('the full-motion order is the sequence\'s order', () => {
    const order = playBeats(ms => raf.run(ms, 8));
    expect(order).toEqual(['assassinate', 'steal', 'coup', 'block', 'challenge', 'tumble']);
    expect(liveCount()).toBe(0);
  });

  it('collapsed, every cue still fires — in the same order, before a single frame', () => {
    setReducedMotion(true);
    const order = playBeats(() => {
      /* no frames at all: §7 requires the landing callback in the same tick */
    });
    expect(order).toEqual(['assassinate', 'steal', 'coup', 'block', 'challenge', 'tumble']);
    expect(raf.elapsedMs()).toBe(0);
  });

  it('collapsed, a card is placed at its destination rather than part way to it', () => {
    setReducedMotion(true);
    const card = new FakeElement();
    setRest(card, 0, 0, -4);
    const land = vi.fn();
    fly(card, influenceTumble({ dx: -420, dy: 260, key: 'Duke' }, { land }));

    expect(land).toHaveBeenCalledTimes(1);
    expect(card.style.getPropertyValue('--fx')).toBe('0px');
    expect(card.style.getPropertyValue('--fy')).toBe('0px');
    expect(card.style.getPropertyValue('--tilt')).toBe('-4deg');
  });

  it('collapsed, a shove ends where it began and still resolves exactly once', () => {
    setReducedMotion(true);
    const seat = new FakeElement();
    const land = vi.fn();
    const abort = vi.fn();
    const o = challengeShove({ width: 56, key: 'x' });
    punch(seat, o.dx ?? 0, o.dy ?? 0, { ...o, land, abort });

    expect(land).toHaveBeenCalledTimes(1);
    expect(abort).not.toHaveBeenCalled();
    expect(seat.style.getPropertyValue('--fx')).toBe('0px');
  });
});
