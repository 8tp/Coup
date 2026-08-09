import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as shake from '@/app/fx/shake';
import { el, type FakeElement } from '../anim/fakeDom';

/**
 * A `FakeElement` from the motion suite satisfies `ShakeElement` — the shake
 * types its target structurally for exactly this reason, so the transform
 * bookkeeping can be asserted without a jsdom.
 */

let node: FakeElement;

beforeEach(() => {
  shake.reset();
  shake.setReduced(false);
  node = el();
  shake.setTarget(node);
});

afterEach(() => {
  shake.reset();
  shake.setTarget(null);
});

function tx(): { x: number; y: number; rot: number } {
  return shake.displacement();
}

describe('shake — the trauma² curve', () => {
  it('displaces by trauma SQUARED, not linearly', () => {
    // Same target, same first frame, same noise phase (reset zeroes the clock),
    // so the only difference between the two runs is the trauma.
    const dt = 0.008;

    shake.reset();
    shake.add(0.6);
    shake.tick(dt);
    const loud = Math.abs(tx().x);

    shake.reset();
    shake.add(0.3);
    shake.tick(dt);
    const half = Math.abs(tx().x);

    expect(loud).toBeGreaterThan(0);
    expect(half).toBeGreaterThan(0);

    // trauma decays by DECAY·dt before the write, so the honest expectation is
    // ((0.6−0.012)/(0.3−0.012))² = 4.168 — not 4, and emphatically not the 2.04
    // a linear model would give. This assertion is the difference between juice
    // and nausea, stated as a number.
    const ratio = loud / half;
    expect(ratio).toBeGreaterThan(3.5);
    expect(ratio).toBeLessThan(5);
  });

  it('never exceeds trauma² × MAX_X / MAX_Y / MAX_R', () => {
    shake.add(shake.CAP);
    for (let i = 0; i < 40 && shake.active(); i++) {
      shake.tick(1 / 60);
      const tr = shake.level() * shake.level();
      const d = tx();
      // +0.05 / +0.005 is the write quantisation (0.1px, 0.01deg).
      expect(Math.abs(d.x)).toBeLessThanOrEqual(tr * shake.MAX_X + 0.05);
      expect(Math.abs(d.y)).toBeLessThanOrEqual(tr * shake.MAX_Y + 0.05);
      expect(Math.abs(d.rot)).toBeLessThanOrEqual(tr * shake.MAX_R + 0.005);
    }
  });

  it('keeps x and y decorrelated — not a single diagonal', () => {
    shake.add(0.6);
    shake.tick(0.008);
    const d = tx();
    // Equal noise seeds would put y at exactly x·(MAX_Y/MAX_X) = x·0.733 every
    // frame, and the shake would read as one diagonal slider being dragged.
    const locked = Math.abs(d.x) * (shake.MAX_Y / shake.MAX_X);
    expect(Math.abs(Math.abs(d.y) - locked)).toBeGreaterThan(0.5);
  });
});

describe('shake — the perceptual floor', () => {
  it('refuses a sub-floor trauma from rest', () => {
    expect(shake.MIN_TRAUMA).toBeCloseTo(Math.sqrt(0.3 / shake.MAX_X), 3);
    expect(shake.add(0.1)).toBe(false);
    expect(shake.add(shake.MIN_TRAUMA - 0.001)).toBe(false);
    expect(shake.level()).toBe(0);
    expect(shake.active()).toBe(false);
  });

  it('still allows stacking above the floor', () => {
    expect(shake.add(0.2)).toBe(true);
    const before = shake.level();
    // Already shaking: a sub-floor contribution genuinely adds, so it is honest
    // to let it through. Four blocked actions inside a second should build.
    expect(shake.add(0.1)).toBe(true);
    expect(shake.level()).toBeCloseTo(before + 0.1, 6);
  });

  it('accepts exactly MIN_TRAUMA from rest', () => {
    expect(shake.add(shake.MIN_TRAUMA)).toBe(true);
    expect(shake.level()).toBeCloseTo(shake.MIN_TRAUMA, 6);
  });

  it('writes nothing at all when reduced motion is on', () => {
    shake.setReduced(true);
    expect(shake.add(0.6)).toBe(false);
    expect(shake.level()).toBe(0);
    expect(shake.hasTransform()).toBe(false);
  });
});

describe('shake — LAND_CEILING', () => {
  it('stops a five-landing caravan out-shaking the win', () => {
    for (let i = 0; i < 5; i++) shake.add(0.16, shake.LAND_CEILING);
    expect(shake.level()).toBeCloseTo(shake.LAND_CEILING, 6);
    // The win is 0.60. A caravan capped at 0.34 can never reach it.
    expect(shake.level()).toBeLessThan(0.6);
  });

  it('a landing never LOWERS trauma that is already above the ceiling', () => {
    shake.add(0.6); // the win
    expect(shake.add(0.16, shake.LAND_CEILING)).toBe(false);
    expect(shake.level()).toBeCloseTo(0.6, 6);
  });

  it('an uncapped add still stacks to CAP and no further', () => {
    shake.add(0.6);
    shake.add(0.45);
    expect(shake.level()).toBeCloseTo(shake.CAP, 6);
    expect(shake.add(0.45)).toBe(false);
  });
});

describe('shake — the transform substrate', () => {
  it('REMOVES the transform at rest rather than setting it to none', () => {
    shake.add(0.6);
    shake.tick(0.016);
    expect(node.style.getPropertyValue('transform')).toMatch(/translate3d/);
    expect(node.style.getPropertyValue('will-change')).toBe('transform');
    expect(shake.hasTransform()).toBe(true);

    // Decay all the way out.
    for (let i = 0; i < 60 && shake.tick(1 / 60); i++) {
      /* spin */
    }

    // The property is GONE, not `none`: an element with `transform: none` is
    // still a transformed element for the containing-block rule, and it leaves
    // a value in the inline style that a reader will assume means something.
    expect(node.style.props.has('transform')).toBe(false);
    expect(node.style.props.has('will-change')).toBe(false);
    expect(shake.hasTransform()).toBe(false);

    const last = node.style.writes.filter((w) => w.property === 'transform').pop();
    expect(last).toEqual({ property: 'transform', value: null });
  });

  it('decays to exactly zero and stops reporting live', () => {
    shake.add(0.6);
    let frames = 0;
    while (shake.tick(1 / 60)) {
      frames++;
      expect(frames).toBeLessThan(300);
    }
    expect(shake.level()).toBe(0);
    expect(shake.active()).toBe(false);
    // 0.60 at 1.5/s is 0.4s ≈ 24 frames.
    expect(frames).toBeGreaterThan(15);
    expect(frames).toBeLessThan(35);
  });

  it('writes nothing while at rest', () => {
    const before = node.style.writes.length;
    expect(shake.tick(1 / 60)).toBe(false);
    expect(shake.tick(1 / 60)).toBe(false);
    expect(node.style.writes.length).toBe(before);
  });

  it('releases the old target when the target changes', () => {
    shake.add(0.6);
    shake.tick(0.016);
    expect(node.style.props.has('transform')).toBe(true);
    const next = el();
    shake.setTarget(next);
    expect(node.style.props.has('transform')).toBe(false);
    expect(next.style.props.has('transform')).toBe(false);
  });

  it('does not write to a detached node', () => {
    node.isConnected = false;
    shake.add(0.6);
    expect(shake.tick(0.016)).toBe(true);
    expect(node.style.writes.length).toBe(0);
  });
});
