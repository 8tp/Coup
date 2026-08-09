import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { reset as resetClock } from '@/app/anim/clock';
import {
  CONTACT,
  HITSTOP_MS,
  MS_MAX,
  MS_MIN,
  busyUntil,
  cancel,
  finishAll,
  flightDuration,
  fly,
  hitstopCount,
  isFlying,
  liveCount,
  punch,
  resetFlights,
  setRest,
  setReducedMotion,
  writeRest,
  type FlightElement,
} from '@/app/anim/flight';
import { FakeElement, installRaf, type RafHarness } from './fakeDom';

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

/** Drive frames until `predicate` or the budget runs out; returns ms elapsed. */
function runUntil(predicate: () => boolean, stepMs = 5, budgetMs = 3000): number {
  let t = 0;
  while (t < budgetMs) {
    raf.frame(stepMs);
    t += stepMs;
    if (predicate()) return t;
  }
  return -1;
}

describe('flightDuration', () => {
  it('clamps to [MS_MIN, MS_MAX]', () => {
    expect(flightDuration(0)).toBe(MS_MIN);
    expect(flightDuration(-50)).toBe(MS_MIN);
    expect(flightDuration(100)).toBeCloseTo(222, 9);
    expect(flightDuration(10000)).toBe(MS_MAX);
  });

  it('applies speed INSIDE the clamp', () => {
    // Outside the clamp these would be 111 and 470.2 respectively; a steal that
    // buys itself 50ms of extra travel pushes the whole event past its budget.
    expect(flightDuration(100, 0.5)).toBe(MS_MIN);
    expect(flightDuration(571, 1.12)).toBe(MS_MAX);
    // and where the clamp does not bite, speed is a straight multiplier
    expect(flightDuration(200, 1.1)).toBeCloseTo(264 * 1.1, 9);
  });

  it('fly() derives the same duration from its delta', () => {
    const el = new FakeElement();
    fly(el, { dx: 100, dy: 0 });
    expect(busyUntil()).toBeCloseTo(222, 6);
  });
});

describe('flight — a completed flight', () => {
  it('fires land exactly once and lands ON the rest pose, not on zero', () => {
    const el = new FakeElement();
    const land = vi.fn();
    const abort = vi.fn();
    setRest(el, 10, -4, 3);

    expect(fly(el, { dx: 120, dy: 0, dur: 200, arc: 0, land, abort })).toBe(true);
    expect(isFlying(el)).toBe(true);

    // launch pose = rest + delta
    expect(el.style.getPropertyValue('--fx')).toBe('130px');
    expect(el.style.getPropertyValue('--fy')).toBe('-4px');

    const elapsed = runUntil(() => land.mock.calls.length > 0);
    expect(elapsed).toBeGreaterThan(190);
    expect(elapsed).toBeLessThan(215);
    expect(land).toHaveBeenCalledTimes(1);
    expect(abort).not.toHaveBeenCalled();

    expect(el.style.getPropertyValue('--fx')).toBe('10px');
    expect(el.style.getPropertyValue('--fy')).toBe('-4px');
    expect(el.style.getPropertyValue('--tilt')).toBe('3deg');
    expect(el.style.getPropertyValue('--fs')).toBe('1');

    // the record is gone, the clock has nothing left to do
    expect(liveCount()).toBe(0);
    expect(isFlying(el)).toBe(false);
    expect(busyUntil()).toBe(0);

    raf.frame(16);
    expect(land).toHaveBeenCalledTimes(1);
  });

  it('honours a delay by holding at the launch pose', () => {
    const el = new FakeElement();
    const land = vi.fn();
    fly(el, { dx: 100, dy: 0, dur: 200, arc: 0, delay: 120, land });
    expect(busyUntil()).toBeCloseTo(320, 6);

    raf.run(100, 10);
    expect(el.style.getPropertyValue('--fx')).toBe('100px');
    expect(land).not.toHaveBeenCalled();

    const elapsed = runUntil(() => land.mock.calls.length > 0, 5);
    expect(elapsed).toBeGreaterThan(200);
  });
});

describe('flight — hitstop', () => {
  it('is subtracted from the travel budget, not added to it', () => {
    const el = new FakeElement();
    const plain = new FakeElement();

    fly(plain, { dx: 0, dy: 300, dur: 300, arc: 0 });
    const plainCommit = busyUntil();
    cancel(plain);

    const land = vi.fn();
    fly(el, { dx: 0, dy: 300, dur: 300, arc: 0, hit: true, land });

    // Same wall-clock commitment: 255ms of travel + a 45ms freeze.
    expect(busyUntil()).toBeCloseTo(plainCommit, 6);
    expect(busyUntil()).toBeCloseTo(300, 6);

    const elapsed = runUntil(() => land.mock.calls.length > 0, 5);
    expect(elapsed).toBeGreaterThanOrEqual(295);
    expect(elapsed).toBeLessThanOrEqual(310);
    expect(hitstopCount()).toBe(1);
  });

  it('freezes the WHOLE live list, not just the landing element', () => {
    const hero = new FakeElement();
    const bystander = new FakeElement();
    fly(hero, { dx: 0, dy: 200, dur: 300, arc: 0, hit: true });
    fly(bystander, { dx: 0, dy: 200, dur: 400, arc: 0 });

    // Run past contact (0.5263 × 255ms ≈ 134ms) and into the freeze.
    raf.run(150, 5);
    expect(hitstopCount()).toBe(1);
    const frozenAt = bystander.style.getPropertyValue('--fy');

    raf.run(30, 5); // still inside the 45ms freeze
    expect(bystander.style.getPropertyValue('--fy')).toBe(frozenAt);

    raf.run(60, 5); // freeze over
    expect(bystander.style.getPropertyValue('--fy')).not.toBe(frozenAt);
  });

  it('fires at CONTACT, before the flight ends', () => {
    const el = new FakeElement();
    fly(el, { dx: 0, dy: 300, dur: 300, arc: 0, hit: true });
    const travelMs = 300 - HITSTOP_MS;
    raf.run(Math.floor(travelMs * CONTACT) - 10, 5);
    expect(hitstopCount()).toBe(0);
    raf.run(20, 5);
    expect(hitstopCount()).toBe(1);
  });

  it('MIN_GAP makes a caravan one heavy landing, not five', () => {
    const cards = [new FakeElement(), new FakeElement(), new FakeElement()];
    cards.forEach((c, i) => {
      fly(c, { dx: 0, dy: 200, dur: 260, arc: 0, hit: true, delay: i * 40 });
    });
    raf.run(900, 5);
    expect(hitstopCount()).toBe(1);
  });

  it('a second impact after MIN_GAP does freeze again', () => {
    const a = new FakeElement();
    const b = new FakeElement();
    fly(a, { dx: 0, dy: 200, dur: 260, arc: 0, hit: true });
    raf.run(600, 5);
    expect(hitstopCount()).toBe(1);
    fly(b, { dx: 0, dy: 200, dur: 260, arc: 0, hit: true });
    raf.run(600, 5);
    expect(hitstopCount()).toBe(2);
  });
});

describe('flight — every started flight resolves', () => {
  it('cancel fires abort exactly once and never land', () => {
    const el = new FakeElement();
    const land = vi.fn();
    let startedFlag: boolean | null = null;
    const abort = vi.fn((_el: FlightElement, started: boolean) => {
      startedFlag = started;
    });
    fly(el, { dx: 200, dy: 0, dur: 300, land, abort });

    raf.run(100, 10);
    cancel(el);

    expect(abort).toHaveBeenCalledTimes(1);
    expect(startedFlag).toBe(true); // it had started
    expect(land).not.toHaveBeenCalled();

    raf.run(500, 10);
    expect(abort).toHaveBeenCalledTimes(1);
    expect(land).not.toHaveBeenCalled();
    expect(liveCount()).toBe(0);
  });

  it('a superseded flight aborts — the new one starts from where it is', () => {
    const el = new FakeElement();
    const abortA = vi.fn();
    const landA = vi.fn();
    const landB = vi.fn();

    fly(el, { dx: 200, dy: 0, dur: 300, arc: 0, land: landA, abort: abortA });
    raf.run(100, 10);
    fly(el, { dx: 50, dy: 0, dur: 200, arc: 0, land: landB });

    expect(abortA).toHaveBeenCalledTimes(1);
    expect(landA).not.toHaveBeenCalled();
    expect(liveCount()).toBe(1);

    runUntil(() => landB.mock.calls.length > 0, 5);
    expect(landB).toHaveBeenCalledTimes(1);
    expect(landA).not.toHaveBeenCalled();
  });

  it('a cancel inside the delay reports started=false', () => {
    const el = new FakeElement();
    let startedFlag: boolean | null = null;
    const abort = vi.fn((_el: FlightElement, started: boolean) => {
      startedFlag = started;
    });
    fly(el, { dx: 200, dy: 0, dur: 200, delay: 150, abort });
    raf.run(40, 10);
    cancel(el);
    expect(abort).toHaveBeenCalledTimes(1);
    expect(startedFlag).toBe(false);
  });

  it('an unmounted node aborts instead of being written to', () => {
    const el = new FakeElement();
    const land = vi.fn();
    const abort = vi.fn();
    fly(el, { dx: 200, dy: 0, dur: 300, land, abort });
    raf.run(60, 10);

    el.isConnected = false;
    const writesAtUnmount = el.writeCount();
    raf.run(300, 10);

    expect(abort).toHaveBeenCalledTimes(1);
    expect(land).not.toHaveBeenCalled();
    expect(el.writeCount()).toBe(writesAtUnmount);
    expect(liveCount()).toBe(0);
  });

  it('resetFlights aborts everything in the air', () => {
    const el = new FakeElement();
    const abort = vi.fn();
    fly(el, { dx: 200, dy: 0, abort });
    raf.run(50, 10);
    resetFlights();
    expect(abort).toHaveBeenCalledTimes(1);
    expect(liveCount()).toBe(0);
  });

  it('finishAll snaps to the end and lands', () => {
    const el = new FakeElement();
    const land = vi.fn();
    setRest(el, 5, 5, 0);
    fly(el, { dx: 200, dy: 0, land });
    raf.run(50, 10);
    finishAll();
    expect(land).toHaveBeenCalledTimes(1);
    expect(el.style.getPropertyValue('--fx')).toBe('5px');
    expect(liveCount()).toBe(0);
  });
});

describe('flight — write budget', () => {
  it('costs at most 4 writes per frame and 0 when nothing changed', () => {
    const el = new FakeElement();
    fly(el, { dx: 300, dy: 120, dur: 400, spin: 8 });

    for (let i = 0; i < 20; i++) {
      const before = el.writeCount();
      raf.frame(8);
      expect(el.writeCount() - before).toBeLessThanOrEqual(4);
    }

    const before = el.writeCount();
    raf.frame(0); // a frame with dt 0: same quantised pose, nothing to write
    expect(el.writeCount()).toBe(before);
  });

  it('quantises to 0.1px / 0.1deg / 0.001 scale', () => {
    const el = new FakeElement();
    fly(el, { dx: 137.77777, dy: -41.3331, dur: 400, scale: 0.31313, spin: 3.14159 });
    for (const w of el.style.writes) {
      if (w.value === null) continue;
      const n = parseFloat(w.value);
      if (w.property === '--fs') {
        expect(Math.abs(n * 1000 - Math.round(n * 1000))).toBeLessThan(1e-9);
      } else {
        expect(Math.abs(n * 10 - Math.round(n * 10))).toBeLessThan(1e-9);
      }
    }
    raf.run(400, 7);
    for (const w of el.style.writes) {
      if (w.value === null) continue;
      const n = parseFloat(w.value);
      const q = w.property === '--fs' ? 1000 : 10;
      expect(Math.abs(n * q - Math.round(n * q))).toBeLessThan(1e-9);
    }
  });
});

describe('flight — arc', () => {
  it('lifts perpendicular to travel, biased upward', () => {
    const el = new FakeElement();
    // Travel is leftward: the upward normal is the one that gets picked.
    fly(el, { dx: 200, dy: 0, dur: 400, arc: 20 });
    raf.run(200, 10);
    expect(el.num('--fy')).toBeLessThan(-10);
  });

  it('picks the side of a straight-up flight deterministically', () => {
    const traceFor = (key: string): number => {
      // Reset the clock too: an identical flight must be sampled at an identical
      // phase, or this measures frame alignment instead of the hash.
      resetFlights();
      resetClock();
      const el = new FakeElement();
      fly(el, { dx: 0, dy: 300, dur: 400, arc: 20, key });
      raf.run(200, 10);
      return el.num('--fx');
    };

    // Same key, same pixels — screenshots have to reproduce.
    expect(traceFor('duke-1')).toBe(traceFor('duke-1'));

    // and the hash really does pick both sides across ids
    const signs = new Set<number>();
    for (const key of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
      signs.add(Math.sign(traceFor(key)));
    }
    expect(signs.has(1)).toBe(true);
    expect(signs.has(-1)).toBe(true);
  });

  it('returns to exactly the rest pose regardless of arc and spin', () => {
    const el = new FakeElement();
    setRest(el, -7, 12, -5);
    const land = vi.fn();
    fly(el, { dx: 200, dy: 90, dur: 300, arc: 26, spin: 26, bump: 0.4, land });
    runUntil(() => land.mock.calls.length > 0, 5);
    expect(el.style.getPropertyValue('--fx')).toBe('-7px');
    expect(el.style.getPropertyValue('--fy')).toBe('12px');
    expect(el.style.getPropertyValue('--tilt')).toBe('-5deg');
    expect(el.style.getPropertyValue('--fs')).toBe('1');
  });
});

describe('flight — rest poses', () => {
  it('retargets a flight in place when the rest pose moves', () => {
    const el = new FakeElement();
    const land = vi.fn();
    fly(el, { dx: 200, dy: 0, dur: 300, arc: 0, land });
    raf.run(100, 10);
    setRest(el, 40, 0, 0); // the fan reflowed mid-flight
    runUntil(() => land.mock.calls.length > 0, 5);
    expect(el.style.getPropertyValue('--fx')).toBe('40px');
  });

  it('writeRest places an element with no animation', () => {
    const el = new FakeElement();
    setRest(el, 3.14159, -2.71828, 1.23456);
    writeRest(el);
    expect(el.style.getPropertyValue('--fx')).toBe('3.1px');
    expect(el.style.getPropertyValue('--fy')).toBe('-2.7px');
    expect(el.style.getPropertyValue('--tilt')).toBe('1.23deg');
    expect(el.style.getPropertyValue('--fs')).toBe('1');
    expect(liveCount()).toBe(0);
  });
});

describe('punch', () => {
  it('is a there-and-back with no net travel', () => {
    const el = new FakeElement();
    const land = vi.fn();
    setRest(el, 0, 0, 0);
    punch(el, -30, 0, { dur: 280, spin: -9, land });
    raf.run(90, 10);
    expect(el.num('--fx')).toBeLessThan(-10);
    runUntil(() => land.mock.calls.length > 0, 5);
    expect(el.style.getPropertyValue('--fx')).toBe('0px');
    expect(el.style.getPropertyValue('--tilt')).toBe('0deg');
  });
});

describe('flight — reduced motion (ART-DIRECTION §7)', () => {
  it('fires the landing callback in the SAME TICK', () => {
    setReducedMotion(true);
    const el = new FakeElement();
    const land = vi.fn();
    const abort = vi.fn();
    setRest(el, 8, -3, 2);

    fly(el, { dx: 400, dy: 250, dur: 300, hit: true, land, abort });

    // No frames have run. The cue is not hanging off the back of a ramp.
    expect(land).toHaveBeenCalledTimes(1);
    expect(abort).not.toHaveBeenCalled();
    // and the element is already at its destination — information, not motion
    expect(el.style.getPropertyValue('--fx')).toBe('8px');
    expect(el.style.getPropertyValue('--fy')).toBe('-3px');
    expect(el.style.getPropertyValue('--tilt')).toBe('2deg');
  });

  it('collapses to an opacity fade of at most 120ms that carries no callback', () => {
    setReducedMotion(true);
    const el = new FakeElement();
    const land = vi.fn();
    fly(el, { dx: 400, dy: 250, land });

    expect(parseFloat(el.style.getPropertyValue('opacity'))).toBeLessThan(1);
    const settled = runUntil(() => liveCount() === 0, 5);
    expect(settled).toBeGreaterThan(0);
    expect(settled).toBeLessThanOrEqual(130);
    expect(el.style.getPropertyValue('opacity')).toBe('');
    expect(land).toHaveBeenCalledTimes(1);
  });

  it('never freezes the table — there is no motion to freeze', () => {
    setReducedMotion(true);
    const el = new FakeElement();
    fly(el, { dx: 400, dy: 250, hit: true });
    raf.run(400, 5);
    expect(hitstopCount()).toBe(0);
  });

  it('supersedes a flight that was already in the air', () => {
    const el = new FakeElement();
    const abort = vi.fn();
    fly(el, { dx: 300, dy: 0, dur: 400, abort });
    raf.run(60, 10);
    setReducedMotion(true);
    const land = vi.fn();
    fly(el, { dx: 300, dy: 0, land });
    expect(abort).toHaveBeenCalledTimes(1);
    expect(land).toHaveBeenCalledTimes(1);
  });
});
