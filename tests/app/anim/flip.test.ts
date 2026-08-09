import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { reset as resetClock } from '@/app/anim/clock';
import { liveCount, resetFlights, setRest } from '@/app/anim/flight';
import { invertAndPlay, measureFirst } from '@/app/anim/flip';
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

function at(el: FakeElement, left: number, top: number, width = 100, height = 140): void {
  el.rect = { left, top, width, height };
  el.offsetWidth = width;
}

describe('measureFirst', () => {
  it('captures the centroid, the layout width and the live tilt', () => {
    const el = new FakeElement();
    at(el, 20, 40, 80, 120);
    el.style.setProperty('--tilt', '-6.5deg');

    const first = measureFirst(el);
    expect(first).not.toBeNull();
    expect(first?.cx).toBe(60);
    expect(first?.cy).toBe(100);
    expect(first?.layoutWidth).toBe(80);
    expect(first?.tilt).toBe(-6.5);
  });

  it('returns null for no element', () => {
    expect(measureFirst(null)).toBeNull();
  });
});

describe('invertAndPlay — the guards', () => {
  it('a first rect with width 0 is placed, not flown', () => {
    const el = new FakeElement();
    at(el, 0, 0, 0, 0);
    const first = measureFirst(el);
    at(el, 300, 200);

    const land = vi.fn();
    expect(invertAndPlay(el, first, { land })).toBe('placed');
    expect(liveCount()).toBe(0);
    // placed at rest, and the information still fires in the same tick
    expect(el.style.getPropertyValue('--fx')).toBe('0px');
    expect(land).toHaveBeenCalledTimes(1);
  });

  it('a last rect with width 0 is placed — never inverted against 0×0', () => {
    const el = new FakeElement();
    at(el, 500, 400);
    const first = measureFirst(el);
    // The destination is a hidden panel: it measures 0×0 at viewport origin.
    at(el, 0, 0, 0, 0);

    const land = vi.fn();
    expect(invertAndPlay(el, first, { land })).toBe('placed');
    expect(liveCount()).toBe(0);
    // The bug this guard exists for: a 550,470 invert launching the card at the
    // top-left corner of the viewport.
    expect(el.style.getPropertyValue('--fx')).toBe('0px');
    expect(el.style.getPropertyValue('--fy')).toBe('0px');
    expect(land).toHaveBeenCalledTimes(1);
  });

  it('a sub-pixel move with no scale change is skipped entirely', () => {
    const el = new FakeElement();
    at(el, 100, 100);
    const first = measureFirst(el);
    at(el, 100.4, 100.3);

    const land = vi.fn();
    expect(invertAndPlay(el, first, { land })).toBe('skipped');
    expect(liveCount()).toBe(0);
    expect(land).toHaveBeenCalledTimes(1);
  });

  it('a sub-pixel move WITH a scale change is not skipped', () => {
    const el = new FakeElement();
    at(el, 100, 100, 200, 280);
    const first = measureFirst(el);
    at(el, 150, 170, 100, 140); // same centre, half the size

    expect(invertAndPlay(el, first)).toBe('played');
    expect(el.style.getPropertyValue('--fs')).toBe('2');
  });

  it('ignores a missing element or a missing snapshot', () => {
    const el = new FakeElement();
    expect(invertAndPlay(null, measureFirst(el))).toBe('ignored');
    expect(invertAndPlay(el, null)).toBe('ignored');
  });
});

describe('invertAndPlay — a real move', () => {
  it('inverts the measured delta exactly and lands on the rest pose', () => {
    const el = new FakeElement();
    at(el, 400, 300);
    el.style.setProperty('--tilt', '12deg');
    const first = measureFirst(el);
    at(el, 100, 300); // moved 300px left

    const land = vi.fn();
    expect(invertAndPlay(el, first, { dur: 200, arc: 0, land })).toBe('played');

    // INVERT: sitting at +300 on --fx, i.e. visually where it was.
    expect(el.style.getPropertyValue('--fx')).toBe('300px');
    expect(el.style.getPropertyValue('--fy')).toBe('0px');
    // the rotation continues from where it was rather than snapping to 0
    expect(el.style.getPropertyValue('--tilt')).toBe('12deg');

    raf.run(400, 10);
    expect(land).toHaveBeenCalledTimes(1);
    expect(el.style.getPropertyValue('--fx')).toBe('0px');
    expect(el.style.getPropertyValue('--tilt')).toBe('0deg');
  });

  it('lands on a non-zero rest pose', () => {
    const el = new FakeElement();
    setRest(el, 14, -9, 4);
    at(el, 400, 300);
    const first = measureFirst(el);
    at(el, 100, 300);

    const land = vi.fn();
    expect(invertAndPlay(el, first, { dur: 200, arc: 0, land })).toBe('played');
    expect(el.style.getPropertyValue('--fx')).toBe('314px');

    raf.run(400, 10);
    expect(el.style.getPropertyValue('--fx')).toBe('14px');
    expect(el.style.getPropertyValue('--fy')).toBe('-9px');
    expect(el.style.getPropertyValue('--tilt')).toBe('4deg');
  });

  it('cancelling the previous flight is part of the invert', () => {
    const el = new FakeElement();
    at(el, 400, 300);
    const first1 = measureFirst(el);
    at(el, 100, 300);

    const abort = vi.fn();
    expect(invertAndPlay(el, first1, { dur: 300, abort })).toBe('played');
    raf.run(60, 10);

    // It moves again before it landed.
    const first2 = measureFirst(el);
    at(el, 700, 300);
    expect(invertAndPlay(el, first2, { dur: 200 })).toBe('played');

    expect(abort).toHaveBeenCalledTimes(1);
    expect(liveCount()).toBe(1);
  });
});
