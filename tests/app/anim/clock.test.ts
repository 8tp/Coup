import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  subscribe,
  unsubscribe,
  now,
  start,
  reset,
  frameCount,
  subCount,
  isRunning,
  type ClockSubscriber,
} from '@/app/anim/clock';
import { installRaf, type RafHarness } from './fakeDom';

let raf: RafHarness;

beforeEach(() => {
  reset();
  raf = installRaf();
});

afterEach(() => {
  reset();
  raf.restore();
});

describe('clock — dt clamping', () => {
  it('clamps a stalled tab to 1/20s instead of teleporting', () => {
    const seen: number[] = [];
    subscribe((dt) => seen.push(dt));

    raf.frame(16); // first frame after start has no previous timestamp
    raf.frame(16);
    raf.stall(3000); // three seconds backgrounded
    raf.frame(16);

    expect(seen[0]).toBe(0);
    expect(seen[1]).toBeCloseTo(0.016, 9);
    expect(seen[2]).toBe(1 / 20);
    expect(seen[3]).toBeCloseTo(0.016, 9);
  });

  it('clamps a backwards or zero timestamp to 0', () => {
    const seen: number[] = [];
    subscribe((dt) => seen.push(dt));

    raf.frame(16);
    raf.frame(0);
    raf.frame(-500);
    raf.frame(8);

    expect(seen).toEqual([0, 0, 0, 0.008]);
  });

  it('now() accumulates the clamped dt, not wall time', () => {
    subscribe(() => {});
    raf.frame(16);
    raf.frame(40);
    raf.stall(5000);

    // 0 + 0.04 + clamp(5) → 0.09, not 5.056
    expect(now()).toBeCloseTo(0.09, 9);
    expect(frameCount()).toBe(3);
  });
});

describe('clock — lifecycle', () => {
  it('starts on the first subscriber and stops when the last one leaves', () => {
    expect(isRunning()).toBe(false);

    const fn: ClockSubscriber = () => {};
    subscribe(fn);
    expect(isRunning()).toBe(true);
    expect(raf.pending()).toBe(1);

    raf.frame(16);
    expect(raf.pending()).toBe(1);

    unsubscribe(fn);
    expect(subCount()).toBe(0);

    raf.frame(16); // the already-scheduled frame notices the empty list
    expect(isRunning()).toBe(false);
    expect(raf.pending()).toBe(0);

    // and it stays stopped
    raf.frame(16);
    expect(frameCount()).toBe(2);
  });

  it('restarts cleanly after stopping, with no dt jump across the gap', () => {
    const seen: number[] = [];
    const fn: ClockSubscriber = (dt) => seen.push(dt);
    subscribe(fn);
    raf.frame(16);
    unsubscribe(fn);
    raf.frame(16);
    expect(isRunning()).toBe(false);

    subscribe(fn);
    raf.stall(9000);
    expect(seen[seen.length - 1]).toBe(0);
  });

  it('the unsubscribe returned by subscribe works', () => {
    const fn = vi.fn();
    const off = subscribe(fn);
    raf.frame(16);
    expect(fn).toHaveBeenCalledTimes(1);
    off();
    raf.frame(16);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('start() is idempotent — one loop, not two', () => {
    subscribe(() => {});
    start();
    start();
    expect(raf.pending()).toBe(1);
  });
});

describe('clock — mutation during a tick', () => {
  it('defers adds and removes to between frames', () => {
    const order: string[] = [];
    const late: ClockSubscriber = () => order.push('late');
    const other: ClockSubscriber = () => order.push('other');
    const first: ClockSubscriber = () => {
      order.push('first');
      subscribe(late);
      unsubscribe(first);
    };

    subscribe(first);
    subscribe(other);

    raf.frame(16);
    // `late` was added mid-tick and must not run in the frame that added it;
    // `other` must still run even though `first` removed itself mid-walk.
    expect(order).toEqual(['first', 'other']);

    order.length = 0;
    raf.frame(16);
    expect(order).toEqual(['other', 'late']);
    expect(subCount()).toBe(2);
  });

  it('a subscriber that throws does not wedge the loop', () => {
    const good = vi.fn();
    const bad: ClockSubscriber = () => {
      throw new Error('boom');
    };
    subscribe(bad);
    subscribe(good);

    expect(() => raf.frame(16)).toThrow('boom');
    // The tick flag was released in a finally, so the next add is not deferred
    // forever and the loop is still scheduled.
    expect(raf.pending()).toBe(1);
    unsubscribe(bad);
    raf.frame(16);
    expect(good).toHaveBeenCalledTimes(1);
  });
});

describe('clock — SSR safety', () => {
  it('subscribing with no requestAnimationFrame is inert, not an exception', () => {
    raf.restore();
    const g = globalThis as { requestAnimationFrame?: unknown };
    const original = g.requestAnimationFrame;
    delete g.requestAnimationFrame;
    try {
      expect(() => subscribe(() => {})).not.toThrow();
      expect(isRunning()).toBe(false);
      expect(subCount()).toBe(1);
    } finally {
      if (original !== undefined) g.requestAnimationFrame = original;
      raf = installRaf();
    }
  });
});
