/**
 * The §6 per-verb table, and the wiring of Coup's cards onto it.
 *
 * Node environment, hand-driven rAF, no jsdom — same contract as the rest of
 * this directory. What is asserted here is everything about the wiring that can
 * be asserted without a browser: the two transform authors stay disjoint, an
 * exchange reorder mirrors, a superseded flight is silent, and reduced motion
 * still cues in the same tick.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { reset as resetClock } from '@/app/anim/clock';
import {
  MAX_EVENT_MS,
  MS_MAX,
  busyUntil,
  cancel,
  fly,
  hitstopCount,
  liveCount,
  punch,
  resetFlights,
  setReducedMotion,
  setRest,
} from '@/app/anim/flight';
import { invertAndPlay, measureFirst } from '@/app/anim/flip';
import {
  ASSASSINATE_REACH,
  BLOCK_CUT_DUR,
  BLOCK_CUT_ENV,
  CHALLENGE_ARRIVE_ARC,
  CHALLENGE_ARRIVE_SPIN,
  COUP_ARC,
  DEAL_ARC,
  DEAL_DUR,
  DEAL_RISE,
  DEAL_SCALE,
  DEAL_SPIN,
  EXCHANGE_ARC,
  EXCHANGE_DUR,
  EXCHANGE_OFFSET_MS,
  EXCHANGE_SPIN,
  FALL_ARC,
  FALL_DUR,
  FALL_SPIN,
  FLIGHT_TRANSFORM,
  FLIGHT_TRANSFORM_STYLE,
  LUNGE_ENV,
  SHOVE_DUR,
  SHOVE_FRACTION,
  SHOVE_SPIN,
  STEAL_ARC,
  STEAL_DELAY_MS,
  STEAL_DUR,
  STEAL_LIFT,
  STEAL_SPEED,
  STEAL_SPIN,
  STRIKE_DUR,
  STRIKE_SPIN,
  assassinate,
  blockCut,
  challengeArrive,
  challengeShove,
  coupSlam,
  dealIn,
  exchangeSwap,
  influenceTumble,
  steal,
} from '@/app/anim/verbs';
import { writeRest } from '@/app/anim/flight';
import { FakeElement, installRaf, type RafHarness } from './fakeDom';

/** Exactly what ExchangeView's layout effect does before it measures LAST. */
function cancelFlightForMeasure(el: FakeElement): void {
  cancel(el);
  writeRest(el);
}

let raf: RafHarness;

beforeEach(() => {
  resetFlights();
  resetClock();
  raf = installRaf();
});

afterEach(() => {
  resetFlights();
  resetClock();
  raf.restore();
});

function at(el: FakeElement, left: number, top: number, width = 56, height = 80): void {
  el.rect = { left, top, width, height };
  el.offsetWidth = width;
}

/* ── the transform contract, as the string an element actually carries ───── */

describe('FLIGHT_TRANSFORM', () => {
  it('is the contract from flight.ts, translate outermost', () => {
    expect(FLIGHT_TRANSFORM).toBe(
      'translate(var(--fx, 0px), var(--fy, 0px)) rotate(var(--tilt, 0deg)) scale(var(--fs, 1))',
    );
    // Order is the whole point: rotate or scale outside the translate and a
    // measured invert lands short by dx·(1−cos θ) and dx·(1−s).
    const t = FLIGHT_TRANSFORM;
    expect(t.indexOf('translate')).toBeLessThan(t.indexOf('rotate'));
    expect(t.indexOf('rotate')).toBeLessThan(t.indexOf('scale'));
  });

  it('every variable has a fallback, so a card that never flew still renders', () => {
    for (const v of ['--fx', '--fy', '--tilt', '--fs']) {
      expect(FLIGHT_TRANSFORM).toContain(`var(${v}, `);
    }
  });

  it('is one frozen object, shared by every card wrapper', () => {
    expect(Object.isFrozen(FLIGHT_TRANSFORM_STYLE)).toBe(true);
    expect(FLIGHT_TRANSFORM_STYLE.transform).toBe(FLIGHT_TRANSFORM);
  });
});

/* ── the two transform authors ───────────────────────────────────────────── */

describe('the wrapper flies and the face keeps its press pose', () => {
  /** globals.css composes `.card-face`'s transform out of exactly these. */
  const PRESS_VARS = ['--press-s', '--press-y', '--card-lift'];
  const FLIGHT_VARS = ['--fx', '--fy', '--tilt', '--fs'];

  it('a flight writes only the flight variables — the press set is untouched', () => {
    const wrapper = new FakeElement();
    const face = new FakeElement();

    // The press pose, as globals.css would leave it mid-press.
    face.style.setProperty('--press-s', '0.955');
    face.style.setProperty('--press-y', '2px');
    face.style.setProperty('--card-lift', '1.05');
    const faceWritesBefore = face.writeCount();

    fly(wrapper, dealIn('Duke'));
    raf.run(DEAL_DUR + 60, 8);

    // Everything the flight touched is a flight variable...
    const touched = new Set(wrapper.style.writes.map(w => w.property));
    for (const p of touched) expect(FLIGHT_VARS).toContain(p);
    // ...and it touched all four.
    for (const v of FLIGHT_VARS) expect(touched.has(v)).toBe(true);

    // ...and the inner face was never written to at all.
    expect(face.writeCount()).toBe(faceWritesBefore);
    expect(face.style.getPropertyValue('--press-s')).toBe('0.955');
    expect(face.style.getPropertyValue('--press-y')).toBe('2px');
    expect(face.style.getPropertyValue('--card-lift')).toBe('1.05');
  });

  it('the two variable sets are disjoint, so one element could never be both', () => {
    for (const p of PRESS_VARS) expect(FLIGHT_VARS).not.toContain(p);
    // and the composed transform strings reference only their own set
    for (const p of PRESS_VARS) expect(FLIGHT_TRANSFORM).not.toContain(p);
  });
});

/* ── §6 Deal / draw ──────────────────────────────────────────────────────── */

describe('dealIn — the replacement card (§6 "Deal / draw")', () => {
  it('carries the table\'s numbers: arc 14, spin ±3°, 260ms', () => {
    const o = dealIn('Ambassador');
    expect(o.arc).toBe(DEAL_ARC);
    expect(Math.abs(o.spin ?? 0)).toBe(DEAL_SPIN);
    expect(o.dur).toBe(DEAL_DUR);
  });

  it('starts above its slot at a smaller scale — off the deck, growing in', () => {
    const o = dealIn('Duke');
    expect(o.dx).toBe(0);
    expect(o.dy).toBe(-DEAL_RISE);
    expect(o.scale).toBe(DEAL_SCALE);
    expect(o.scale).toBeLessThan(1);
  });

  it('picks its spin side from the key, not from Math.random', () => {
    const a = dealIn('Duke').spin;
    const b = dealIn('Duke').spin;
    expect(a).toBe(b);
    // and the two characters this actually swaps between do not both go the
    // same way by accident of one hash
    const spins = new Set(
      ['Duke', 'Assassin', 'Captain', 'Ambassador', 'Contessa', 'Inquisitor']
        .map(c => Math.sign(dealIn(c).spin ?? 0)),
    );
    expect(spins.size).toBe(2);
  });

  it('caller options win — the land cue is not something the verb decides', () => {
    const land = vi.fn();
    const o = dealIn('Duke', { land, dur: 999 });
    expect(o.land).toBe(land);
    expect(o.dur).toBe(999);
  });

  it('lands on the rest pose and cues exactly once', () => {
    const el = new FakeElement();
    const land = vi.fn();
    const abort = vi.fn();
    setRest(el, 6, -2, 4);

    fly(el, dealIn('Captain', { land, abort }));
    raf.run(DEAL_DUR + 80, 8);

    expect(land).toHaveBeenCalledTimes(1);
    expect(abort).not.toHaveBeenCalled();
    expect(el.style.getPropertyValue('--fx')).toBe('6px');
    expect(el.style.getPropertyValue('--fy')).toBe('-2px');
    expect(el.style.getPropertyValue('--tilt')).toBe('4deg');
    expect(el.style.getPropertyValue('--fs')).toBe('1');
  });
});

/* ── §6 Swap ─────────────────────────────────────────────────────────────── */

describe('exchangeSwap — mirrored arcs (§6 "Swap")', () => {
  it('a card travelling left goes over; one travelling right goes under', () => {
    // dx is the invert: positive means the card IS to the right of its slot and
    // is therefore travelling left.
    const goingLeft = exchangeSwap({ dx: 64, dy: 0 });
    const goingRight = exchangeSwap({ dx: -64, dy: 0 });

    expect(goingLeft.arc).toBe(EXCHANGE_ARC);
    expect(goingRight.arc).toBe(-EXCHANGE_ARC);
    expect(Math.sign(goingLeft.arc ?? 0)).toBe(-Math.sign(goingRight.arc ?? 0));
    expect(Math.abs(goingLeft.arc ?? 0)).toBe(Math.abs(goingRight.arc ?? 0));
  });

  it('the spin mirrors with the arc, at ±8°', () => {
    expect(exchangeSwap({ dx: 64, dy: 0 }).spin).toBe(EXCHANGE_SPIN);
    expect(exchangeSwap({ dx: -64, dy: 0 }).spin).toBe(-EXCHANGE_SPIN);
  });

  it('a purely vertical move (the row wrapped) still picks a side', () => {
    expect(exchangeSwap({ dx: 0, dy: 40 }).arc).toBe(EXCHANGE_ARC);
    expect(exchangeSwap({ dx: 0, dy: -40 }).arc).toBe(-EXCHANGE_ARC);
    // never a straight slide — that is the one shape this verb rules out
    expect(exchangeSwap({ dx: 0, dy: 0 }).arc).not.toBe(0);
  });

  it('the touched card leads; the others are offset by 60ms', () => {
    expect(exchangeSwap({ dx: 64, dy: 0, lead: true }).delay).toBe(0);
    expect(exchangeSwap({ dx: -64, dy: 0 }).delay).toBe(EXCHANGE_OFFSET_MS);
    expect(exchangeSwap({ dx: -64, dy: 0, lead: false }).delay).toBe(EXCHANGE_OFFSET_MS);
  });

  it('runs at 380ms, inside the 600ms event budget even with the offset', () => {
    expect(EXCHANGE_DUR).toBe(380);
    expect(EXCHANGE_DUR + EXCHANGE_OFFSET_MS).toBeLessThanOrEqual(600);
  });
});

describe('an exchange reorder — two cards actually passing each other', () => {
  /**
   * The reorder ExchangeView performs: card B (right) is selected and moves to
   * the front, card A (left) shifts right to make room. Two FLIPs, mirrored.
   */
  function reorder(): { a: FakeElement; b: FakeElement; land: ReturnType<typeof vi.fn> } {
    const a = new FakeElement();
    const b = new FakeElement();
    at(a, 0, 0);
    at(b, 64, 0);

    const firstA = measureFirst(a);
    const firstB = measureFirst(b);

    // the commit: B is now first, A second
    at(b, 0, 0);
    at(a, 64, 0);

    const land = vi.fn();
    const play = (el: FakeElement, first: typeof firstA, lead: boolean) => {
      const rect = el.getBoundingClientRect();
      const dx = (first?.cx ?? 0) - (rect.left + rect.width / 2);
      const dy = (first?.cy ?? 0) - (rect.top + rect.height / 2);
      return invertAndPlay(
        el,
        first,
        exchangeSwap({ dx, dy, lead, key: lead ? 'b' : 'a' }, lead ? { land } : {}),
      );
    };

    // B is the card the player touched.
    expect(play(b, firstB, true)).toBe('played');
    expect(play(a, firstA, false)).toBe('played');
    return { a, b, land };
  }

  it('produces two flights whose arcs have opposite signs', () => {
    const { a, b } = reorder();
    expect(liveCount()).toBe(2);

    // Mid-flight for the leader, which is where the arc is at its widest. The
    // travel is horizontal, so the entire arc shows up in --fy.
    raf.run(EXCHANGE_DUR / 2, 5);
    const fyB = b.num('--fy');
    raf.run(EXCHANGE_OFFSET_MS, 5);
    const fyA = a.num('--fy');

    // B travels left → over the top (negative --fy is up).
    expect(fyB).toBeLessThan(-1);
    // A travels right → under.
    expect(fyA).toBeGreaterThan(1);
    expect(Math.sign(fyA)).toBe(-Math.sign(fyB));

    // and the tilts mirror too
    expect(Math.sign(a.num('--tilt'))).toBe(-Math.sign(b.num('--tilt')));
  });

  it('the follower is still held at its launch pose 60ms after the leader left', () => {
    const { a, b } = reorder();

    // 40ms in: inside the follower's delay. The leader has moved off its start;
    // the follower has not.
    raf.run(40, 5);
    expect(b.num('--fx')).not.toBe(64);
    expect(a.num('--fx')).toBe(-64);

    // Past the offset, it is under way.
    raf.run(EXCHANGE_OFFSET_MS + 40, 5);
    expect(a.num('--fx')).not.toBe(-64);
  });

  it('both land on their slots, and exactly one cue is fired for the gesture', () => {
    const { a, b, land } = reorder();
    raf.run(EXCHANGE_DUR + EXCHANGE_OFFSET_MS + 120, 8);

    expect(liveCount()).toBe(0);
    expect(a.num('--fx')).toBe(0);
    expect(a.num('--fy')).toBe(0);
    expect(b.num('--fx')).toBe(0);
    expect(b.num('--fy')).toBe(0);
    // one gesture, one landing cue — not one per card that happened to shift
    expect(land).toHaveBeenCalledTimes(1);
  });
});

describe('a second tap while the first swap is still in the air', () => {
  /**
   * Found in a browser, not in review. `invertAndPlay` cancels the live flight
   * and writes the rest pose BEFORE taking its own LAST measurement, so a
   * caller that measures `last` itself — which ExchangeView must, to know which
   * way the card is travelling before it can pick an arc side — has to
   * neutralise first or it reads the mid-flight box while the engine reads the
   * rest box. Mid-flight the two can have OPPOSITE SIGNS, and the card then
   * bows the wrong way over a delta it never travels.
   */
  /**
   * A FakeElement's rect ignores the transform; a browser's does not, and the
   * whole bug lives in that difference. This one folds the live `--fx/--fy`
   * into its box, which is what `getBoundingClientRect` actually does.
   */
  class TransformedElement extends FakeElement {
    override getBoundingClientRect() {
      const fx = parseFloat(this.style.getPropertyValue('--fx')) || 0;
      const fy = parseFloat(this.style.getPropertyValue('--fy')) || 0;
      return {
        left: this.rect.left + fx,
        top: this.rect.top + fy,
        width: this.rect.width,
        height: this.rect.height,
      };
    }
  }

  it('the un-neutralised delta can disagree with the engine\'s about which way the card goes', () => {
    const el = new TransformedElement();
    at(el, 100, 0);

    // Tap one: the card is sent from slot 100 to slot 260 and is still in the air.
    const firstA = measureFirst(el);
    at(el, 260, 0);
    invertAndPlay(el, firstA, exchangeSwap({ dx: -160, dy: 0, lead: true }));
    raf.run(120, 8);
    const liveFx = el.num('--fx');
    expect(liveFx).toBeLessThan(0);

    // Tap two: FIRST is snapshotted (transform included, correctly), then the
    // reorder moves the slot. The move is deliberately SHORTER than the
    // distance still left in the air — that is the whole window in which the
    // two measurements disagree, and it is exactly the window a double-tap
    // lands in.
    const firstB = measureFirst(el);
    at(el, 260 + Math.round(liveFx / 2), 0);

    // What the caller reads if it measures LAST before neutralising…
    const naiveRect = el.getBoundingClientRect();
    const naiveDx = (firstB?.cx ?? 0) - (naiveRect.left + naiveRect.width / 2);
    // …versus what the engine will actually fly, which is measured after
    // cancel + writeRest.
    cancel(el);
    writeRest(el);
    const trueRect = el.getBoundingClientRect();
    const trueDx = (firstB?.cx ?? 0) - (trueRect.left + trueRect.width / 2);

    expect(Math.sign(naiveDx)).not.toBe(Math.sign(trueDx));
    // …so the arc side, which follows the delta, comes out mirrored the wrong
    // way over a delta the card never travels. That is the bug the neutralise
    // in ExchangeView's layout effect removes.
    expect(Math.sign(exchangeSwap({ dx: naiveDx, dy: 0 }).arc ?? 0))
      .not.toBe(Math.sign(exchangeSwap({ dx: trueDx, dy: 0 }).arc ?? 0));
  });

  it('the interrupted flight aborts, and the replacement flies from where it got to', () => {
    const el = new TransformedElement();
    at(el, 100, 0);

    const cue = vi.fn();
    const aborted = vi.fn();
    const firstA = measureFirst(el);
    at(el, 260, 0);
    invertAndPlay(el, firstA, exchangeSwap({ dx: -160, dy: 0, lead: true }, { land: cue, abort: aborted }));
    raf.run(120, 8);
    const seenAt = el.getBoundingClientRect().left;

    const firstB = measureFirst(el);
    at(el, 180, 0);
    cancelFlightForMeasure(el);
    const rect = el.getBoundingClientRect();
    const dx = (firstB?.cx ?? 0) - (rect.left + rect.width / 2);
    invertAndPlay(el, firstB, exchangeSwap({ dx, dy: 0, lead: true }, { land: cue }));

    // The first flight resolved as an abort — no cue for a card that never landed.
    expect(aborted).toHaveBeenCalledTimes(1);
    expect(cue).not.toHaveBeenCalled();
    // and the replacement launches from where the card visibly was, not from
    // the slot it was originally sent to.
    expect(el.getBoundingClientRect().left).toBeCloseTo(seenAt, 0);

    raf.run(EXCHANGE_DUR + 120, 8);
    expect(cue).toHaveBeenCalledTimes(1);
    expect(el.num('--fx')).toBe(0);
    expect(el.num('--fy')).toBe(0);
    expect(liveCount()).toBe(0);
  });
});

/* ── the cue contract: every started flight resolves, and only one way ───── */

describe('a landing cue is never fired by a flight that did not land', () => {
  it('a superseded flight aborts silently — chudopoly\'s 173 cues to 159 landings', () => {
    const el = new FakeElement();
    const cue = vi.fn();
    const aborted = vi.fn();

    fly(el, dealIn('Duke', { land: cue, abort: aborted }));
    raf.run(80, 8);

    // The reconcile: a second replacement arrives while the first is landing.
    const cue2 = vi.fn();
    fly(el, dealIn('Captain', { land: cue2 }));

    expect(cue).not.toHaveBeenCalled();
    expect(aborted).toHaveBeenCalledTimes(1);

    raf.run(DEAL_DUR + 80, 8);
    // the survivor lands, and cues, exactly once
    expect(cue).not.toHaveBeenCalled();
    expect(cue2).toHaveBeenCalledTimes(1);
  });

  it('an unmounted node aborts silently — the React seam\'s ref cleanup', () => {
    const el = new FakeElement();
    const cue = vi.fn();
    const aborted = vi.fn();

    fly(el, dealIn('Contessa', { land: cue, abort: aborted }));
    raf.run(80, 8);

    // useFlight's ref cleanup, and ExchangeView's, both do exactly this.
    cancel(el);

    expect(cue).not.toHaveBeenCalled();
    expect(aborted).toHaveBeenCalledTimes(1);
    expect(liveCount()).toBe(0);

    raf.run(DEAL_DUR, 8);
    expect(cue).not.toHaveBeenCalled();
  });

  it('a cancelled exchange member is silent even when it was the cued one', () => {
    const el = new FakeElement();
    at(el, 0, 0);
    const first = measureFirst(el);
    at(el, 64, 0);

    const cue = vi.fn();
    invertAndPlay(el, first, exchangeSwap({ dx: -64, dy: 0, lead: true }, { land: cue }));
    raf.run(100, 8);
    cancel(el);

    expect(cue).not.toHaveBeenCalled();
  });

  it('cue counts match landing counts across a run of swaps', () => {
    const cue = vi.fn();
    let landings = 0;
    const els = [new FakeElement(), new FakeElement(), new FakeElement()];

    for (let round = 0; round < 6; round++) {
      for (const el of els) {
        fly(el, dealIn(`r${round}`, { land: () => { landings++; cue(); } }));
      }
      // half the rounds are interrupted before anything lands
      raf.run(round % 2 === 0 ? DEAL_DUR + 40 : 60, 10);
    }
    raf.run(DEAL_DUR + 80, 10);

    expect(cue).toHaveBeenCalledTimes(landings);
    expect(liveCount()).toBe(0);
  });
});

/* ── §7 ──────────────────────────────────────────────────────────────────── */

describe('reduced motion — the cue still fires, in the same tick', () => {
  afterEach(() => setReducedMotion(false));

  it('a deal-in collapses and cues synchronously, with no frame run at all', () => {
    setReducedMotion(true);
    const el = new FakeElement();
    setRest(el, 5, -3, 2);
    const cue = vi.fn();

    fly(el, dealIn('Duke', { land: cue }));

    // Not "eventually" — before a single frame has been driven.
    expect(cue).toHaveBeenCalledTimes(1);
    expect(raf.elapsedMs()).toBe(0);
    // and the card is at its slot, not part way to it
    expect(el.style.getPropertyValue('--fx')).toBe('5px');
    expect(el.style.getPropertyValue('--fy')).toBe('-3px');
    expect(el.style.getPropertyValue('--tilt')).toBe('2deg');
  });

  it('an exchange swap collapses and still cues once', () => {
    setReducedMotion(true);
    const el = new FakeElement();
    at(el, 0, 0);
    const first = measureFirst(el);
    at(el, 64, 0);

    const cue = vi.fn();
    invertAndPlay(el, first, exchangeSwap({ dx: -64, dy: 0, lead: true }, { land: cue }));

    expect(cue).toHaveBeenCalledTimes(1);
    expect(el.num('--fx')).toBe(0);
  });

  it('the collapse fades but hangs nothing informational off the fade', () => {
    setReducedMotion(true);
    const el = new FakeElement();
    const cue = vi.fn();
    fly(el, dealIn('Captain', { land: cue }));

    // The cosmetic ramp is a fade record with no callbacks on it.
    expect(liveCount()).toBe(1);
    expect(cue).toHaveBeenCalledTimes(1);

    raf.run(200, 10);
    expect(liveCount()).toBe(0);
    expect(cue).toHaveBeenCalledTimes(1);
    // opacity override removed, so no stale inline value fights a CSS state
    expect(el.style.getPropertyValue('opacity')).toBe('');
  });
});

/* ── the rest of §6's table ──────────────────────────────────────────────── */

describe('assassinate — §6\'s 34% lunge', () => {
  it('reaches exactly 34% of the way to the target and no further', () => {
    const o = assassinate({ toX: 400, toY: 0 });
    expect(ASSASSINATE_REACH).toBe(0.34);
    expect(o.dx).toBeCloseTo(400 * 0.34, 10);
    expect(o.dy).toBe(0);
    // The claim §6 attaches to the number: past this it reads as a flight.
    expect((o.dx ?? 0) / 400).toBeCloseTo(0.34, 10);
  });

  it('carries the Strike row\'s numbers and does NOT arm hitstop', () => {
    const o = assassinate({ toX: 0, toY: 300 });
    expect(o.dur).toBe(STRIKE_DUR);
    expect(Math.abs(o.spin ?? 0)).toBe(STRIKE_SPIN);
    expect(o.env).toBe(LUNGE_ENV);
    // §6 arms it on three things and a knife that a Contessa can still stop is
    // not one of them.
    expect(o.hit).toBeUndefined();
  });

  it('lunges and comes back to exactly where it started', () => {
    const el = new FakeElement();
    setRest(el, 12, -7, 3);
    const land = vi.fn();

    const o = assassinate({ toX: -260, toY: 120, key: 'victim' });
    punch(el, o.dx ?? 0, o.dy ?? 0, { ...o, land });

    // Out: at the envelope's peak it is displaced towards the target.
    raf.run(Math.round(STRIKE_DUR * 0.33), 4);
    expect(el.num('--fx')).toBeLessThan(12);
    expect(el.num('--fy')).toBeGreaterThan(-7);

    // Back: a punch has no net travel, so it lands on the rest pose it left.
    raf.run(STRIKE_DUR, 4);
    expect(land).toHaveBeenCalledTimes(1);
    expect(el.style.getPropertyValue('--fx')).toBe('12px');
    expect(el.style.getPropertyValue('--fy')).toBe('-7px');
    expect(el.style.getPropertyValue('--tilt')).toBe('3deg');
    expect(liveCount()).toBe(0);
  });

  it('peaks in the first third — a hit, not a wobble', () => {
    const el = new FakeElement();
    const o = assassinate({ toX: 300, toY: 0 });
    punch(el, o.dx ?? 0, o.dy ?? 0, o);

    // sin(π·p^0.62) peaks at p = 0.5^(1/0.62) = 0.327.
    expect(0.5 ** (1 / LUNGE_ENV)).toBeCloseTo(0.327, 3);

    let peakAt = 0;
    let peak = 0;
    for (let t = 0; t < STRIKE_DUR; t += 4) {
      raf.frame(4);
      const v = Math.abs(el.num('--fx'));
      if (v > peak) {
        peak = v;
        peakAt = (t + 4) / STRIKE_DUR;
      }
    }
    expect(peakAt).toBeLessThan(0.5);
    expect(peak).toBeCloseTo(300 * ASSASSINATE_REACH, 0);
  });
});

describe('coupSlam — straight, fast, armed', () => {
  it('has an arc of exactly zero', () => {
    expect(coupSlam({ dx: 200, dy: 0 }).arc).toBe(0);
    expect(COUP_ARC).toBe(0);
  });

  it('keeps the Strike row\'s 5° roll despite the straight line', () => {
    const o = coupSlam({ dx: 200, dy: 0, key: 'target' });
    expect(Math.abs(o.spin ?? 0)).toBe(STRIKE_SPIN);
    expect(o.dur).toBe(STRIKE_DUR);
    expect(o.hit).toBe(true);
  });

  it('never leaves the line between where it started and where it lands', () => {
    const el = new FakeElement();
    setRest(el, 0, 0);
    fly(el, coupSlam({ dx: 240, dy: 0, key: 'k' }));

    // Horizontal travel, so any bow at all shows up as a non-zero --fy.
    for (let i = 0; i < 40; i++) {
      raf.frame(8);
      expect(el.num('--fy')).toBe(0);
    }
  });

  it('freezes the table on contact and lands on the rest pose', () => {
    const before = hitstopCount();
    const el = new FakeElement();
    setRest(el, 4, 9, -2);
    const land = vi.fn();

    fly(el, coupSlam({ dx: 300, dy: -120, key: 'coup' }, { land }));
    raf.run(STRIKE_DUR + 200, 8);

    expect(hitstopCount()).toBe(before + 1);
    expect(land).toHaveBeenCalledTimes(1);
    expect(el.style.getPropertyValue('--fx')).toBe('4px');
    expect(el.style.getPropertyValue('--fy')).toBe('9px');
    expect(el.style.getPropertyValue('--tilt')).toBe('-2deg');
  });
});

describe('steal — the delay is the tell', () => {
  it('carries the Take-from row: arc 22, ±6°, 340ms, 120ms delay, hero lift', () => {
    const o = steal({ dx: -180, dy: 40, key: 's' });
    expect(o.arc).toBe(STEAL_ARC);
    expect(STEAL_ARC).toBe(22);
    expect(Math.abs(o.spin ?? 0)).toBe(STEAL_SPIN);
    expect(o.dur).toBe(STEAL_DUR);
    expect(o.delay).toBe(STEAL_DELAY_MS);
    expect(o.speed).toBe(STEAL_SPEED);
    expect(o.bump).toBe(STEAL_LIFT);
    // The lift must stay well under the deal's 14% growth or a steal reads as
    // a second deal.
    expect(STEAL_LIFT).toBeLessThan((1 - DEAL_SCALE) / 2);
  });

  it('fits the 600ms event budget with the delay and the 1.12x weight', () => {
    // 340 x 1.12 = 380.8ms of flight, which is what the multiplier actually
    // costs — §6's "340ms" is the base, not the wall time.
    const wall = STEAL_DUR * STEAL_SPEED;
    expect(wall).toBeCloseTo(380.8, 6);
    expect(STEAL_DELAY_MS + wall).toBeLessThanOrEqual(MAX_EVENT_MS);

    const el = new FakeElement();
    fly(el, steal({ dx: -300, dy: 0, key: 's' }));
    // The engine's own accounting agrees, which is the number that matters:
    // budgetDelay() would have clipped the delay if it did not fit.
    expect(busyUntil()).toBeLessThanOrEqual(MAX_EVENT_MS);
    expect(busyUntil()).toBeCloseTo(STEAL_DELAY_MS + wall, 6);
  });

  it('holds at the launch pose for the whole delay, then leaves', () => {
    const el = new FakeElement();
    setRest(el, 0, 0);
    fly(el, steal({ dx: -300, dy: 0, key: 's' }));

    // Parked at the start of the path — visibly about to happen.
    raf.run(STEAL_DELAY_MS - 20, 5);
    expect(el.num('--fx')).toBe(-300);

    raf.run(60, 5);
    expect(el.num('--fx')).toBeGreaterThan(-300);
  });

  it('lands on the rest pose with the lift spent', () => {
    const el = new FakeElement();
    setRest(el, -6, 3, 5);
    const land = vi.fn();
    fly(el, steal({ dx: -300, dy: 0, key: 's' }, { land }));
    raf.run(MAX_EVENT_MS + 40, 8);

    expect(land).toHaveBeenCalledTimes(1);
    expect(el.style.getPropertyValue('--fx')).toBe('-6px');
    expect(el.style.getPropertyValue('--fy')).toBe('3px');
    expect(el.style.getPropertyValue('--tilt')).toBe('5deg');
    // `bump` rides the arc envelope, so it is exactly 0 at both ends.
    expect(el.style.getPropertyValue('--fs')).toBe('1');
  });
});

describe('the Refuse row — one row, two elements', () => {
  const WIDTH = 112;

  it('shoves back 22% of the card\'s own width', () => {
    const o = challengeShove({ width: WIDTH });
    expect(SHOVE_FRACTION).toBe(0.22);
    expect(o.dx).toBeCloseTo(-0.22 * WIDTH, 10);
    expect(o.dy).toBe(0);
    expect(o.dur).toBe(SHOVE_DUR);
    expect(o.spin).toBe(SHOVE_SPIN);
    expect(SHOVE_SPIN).toBe(-9);
  });

  it('normalises the direction, so the shove is the same size whatever vector it is given', () => {
    const near = challengeShove({ width: WIDTH, dirX: 3, dirY: 4 });
    const far = challengeShove({ width: WIDTH, dirX: 300, dirY: 400 });
    const size = (o: { dx?: number; dy?: number }) => Math.hypot(o.dx ?? 0, o.dy ?? 0);
    expect(size(near)).toBeCloseTo(SHOVE_FRACTION * WIDTH, 10);
    expect(size(far)).toBeCloseTo(SHOVE_FRACTION * WIDTH, 10);
    expect(near.dx).toBeCloseTo(far.dx ?? 0, 10);
  });

  it('the spin does not pick a side from a hash — the game chose the direction', () => {
    const spins = new Set(
      ['a', 'b', 'c', 'd'].map(k => challengeShove({ width: WIDTH, key: k }).spin),
    );
    expect(spins).toEqual(new Set([SHOVE_SPIN]));
  });

  it('blockCut is the same shove with the tail taken off', () => {
    const shove = challengeShove({ width: WIDTH });
    const cut = blockCut({ width: WIDTH });
    // Same displacement, same roll…
    expect(cut.dx).toBe(shove.dx);
    expect(cut.spin).toBe(shove.spin);
    // …different envelope and a shorter beat.
    expect(cut.env).toBe(BLOCK_CUT_ENV);
    expect(cut.dur).toBe(BLOCK_CUT_DUR);
    expect(BLOCK_CUT_DUR).toBeLessThan(SHOVE_DUR);
  });

  it('the cut peaks late and the shove peaks early — that is what "no tail" means', () => {
    function peakFraction(o: ReturnType<typeof challengeShove>, dur: number): number {
      const el = new FakeElement();
      punch(el, o.dx ?? 0, o.dy ?? 0, o);
      let peak = 0;
      let at = 0;
      for (let t = 0; t < dur; t += 2) {
        raf.frame(2);
        const v = Math.abs(el.num('--fx'));
        if (v > peak) {
          peak = v;
          at = (t + 2) / dur;
        }
      }
      cancel(el);
      return at;
    }

    const shoveAt = peakFraction(challengeShove({ width: WIDTH }), SHOVE_DUR);
    const cutAt = peakFraction(blockCut({ width: WIDTH }), BLOCK_CUT_DUR);

    // sin(π·p^0.62) peaks at 0.327; sin(π·p^1.6) peaks at 0.649.
    expect(shoveAt).toBeCloseTo(0.5 ** (1 / LUNGE_ENV), 1);
    expect(cutAt).toBeCloseTo(0.5 ** (1 / BLOCK_CUT_ENV), 1);
    expect(cutAt).toBeGreaterThan(shoveAt);
    // The recovery is what got cut: two thirds of the beat becomes a third.
    expect(1 - cutAt).toBeLessThan((1 - shoveAt) / 1.5);
  });

  it('both shoves end exactly where they began', () => {
    for (const o of [challengeShove({ width: WIDTH }), blockCut({ width: WIDTH })]) {
      const el = new FakeElement();
      setRest(el, 3, -4, 1);
      punch(el, o.dx ?? 0, o.dy ?? 0, o);
      raf.run(SHOVE_DUR + 80, 6);
      expect(el.style.getPropertyValue('--fx')).toBe('3px');
      expect(el.style.getPropertyValue('--fy')).toBe('-4px');
      expect(el.style.getPropertyValue('--tilt')).toBe('1deg');
    }
    expect(liveCount()).toBe(0);
  });

  it('challengeArrive is the other half: flat, fast and armed', () => {
    const o = challengeArrive({ dx: 300, dy: -200, key: 'acc' });
    expect(o.arc).toBe(CHALLENGE_ARRIVE_ARC);
    // The flattest bow on the table — a card thrown as evidence, not dealt.
    expect(CHALLENGE_ARRIVE_ARC).toBeLessThan(DEAL_ARC);
    expect(Math.abs(o.spin ?? 0)).toBe(CHALLENGE_ARRIVE_SPIN);
    expect(o.dur).toBe(SHOVE_DUR);
    expect(o.hit).toBe(true);
  });

  it('challengeArrive lands on the rest pose and cues once', () => {
    const el = new FakeElement();
    setRest(el, 0, 0, 0);
    const land = vi.fn();
    const abort = vi.fn();
    fly(el, challengeArrive({ dx: -420, dy: 260, key: 'acc' }, { land, abort }));
    raf.run(SHOVE_DUR + 200, 8);

    expect(land).toHaveBeenCalledTimes(1);
    expect(abort).not.toHaveBeenCalled();
    expect(el.num('--fx')).toBe(0);
    expect(el.num('--fy')).toBe(0);
  });
});

describe('influenceTumble — §6\'s Fall', () => {
  it('carries arc 22, ±26° and the table\'s longest beat', () => {
    const o = influenceTumble({ dx: 120, dy: -300, key: 'lost' });
    expect(o.arc).toBe(FALL_ARC);
    expect(Math.abs(o.spin ?? 0)).toBe(FALL_SPIN);
    expect(FALL_SPIN).toBe(26);
    expect(o.dur).toBe(FALL_DUR);
    expect(o.hit).toBe(true);
    // 420ms is MS_MAX exactly: nothing on this table is slower, and no
    // distance can make the one irreversible event slower still.
    expect(FALL_DUR).toBe(MS_MAX);
  });

  it('tumbles both ways across the six characters, deterministically', () => {
    const spins = new Set(
      ['Duke', 'Assassin', 'Captain', 'Ambassador', 'Contessa', 'Inquisitor']
        .map(c => Math.sign(influenceTumble({ dx: 0, dy: -200, key: c }).spin ?? 0)),
    );
    expect(spins.size).toBe(2);
    expect(influenceTumble({ dx: 0, dy: -200, key: 'Duke' }).spin)
      .toBe(influenceTumble({ dx: 0, dy: -200, key: 'Duke' }).spin);
  });

  it('lands face-up on the discard\'s rest tilt and stays there', () => {
    const el = new FakeElement();
    // A discard rests tilted — the whole reason flights land ON a rest pose.
    setRest(el, 0, 0, -4);
    const land = vi.fn();
    fly(el, influenceTumble({ dx: 40, dy: -280, key: 'Contessa' }, { land }));
    raf.run(FALL_DUR + 200, 8);

    expect(land).toHaveBeenCalledTimes(1);
    expect(el.style.getPropertyValue('--tilt')).toBe('-4deg');
    expect(liveCount()).toBe(0);

    // Nothing moves it afterwards: "stays there" is a property of the engine,
    // not of a CSS animation that happens to end on the right frame.
    const writes = el.writeCount();
    raf.run(500, 16);
    expect(el.writeCount()).toBe(writes);
  });
});

/* ── §6's motion budget, as an absence ───────────────────────────────────── */

describe('the quiet verbs get nothing', () => {
  it('has no verb for Income, Tax, Foreign Aid or Embezzle', async () => {
    // §6: "Take … deliberately plain … the card does not move." The budget is
    // two world-stopping moments and it only balances because the twelve beats
    // around them spend nothing. This is that decision, executable.
    const verbs = await import('@/app/anim/verbs');
    for (const name of ['income', 'tax', 'foreignAid', 'embezzle', 'take']) {
      expect(verbs).not.toHaveProperty(name);
    }
  });

  it('every verb that does exist differs from every other in arc, spin or duration', () => {
    // §6: "they must differ, or a Steal feels like a Tax."
    const shape = (o: { arc?: number; spin?: number; dur?: number }) =>
      `${o.arc ?? 'auto'}|${Math.abs(o.spin ?? 0)}|${o.dur ?? 'auto'}`;
    const shapes = [
      shape(dealIn('k')),
      shape(exchangeSwap({ dx: 10, dy: 0 })),
      shape(coupSlam({ dx: 10, dy: 0, key: 'k' })),
      shape(steal({ dx: 10, dy: 0, key: 'k' })),
      shape(challengeArrive({ dx: 10, dy: 0, key: 'k' })),
      shape(influenceTumble({ dx: 10, dy: 0, key: 'k' })),
    ];
    expect(new Set(shapes).size).toBe(shapes.length);
  });
});
