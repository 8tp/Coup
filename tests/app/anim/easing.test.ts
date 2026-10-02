import { describe, it, expect } from 'vitest';
import {
  BACK,
  SCALE_BACK,
  clamp01,
  easeOutBack,
  easeOutCubic,
  settle,
  smoothstep,
  hash1,
  hashKey,
} from '@/app/anim/easing';
import { CONTACT } from '@/app/anim/flight';

/**
 * An independent reference for cubic-bezier(.22,1,.36,1), solved by bisection
 * rather than by Newton, so `settle()` is checked against a different method and
 * not against a copy of itself.
 */
function bezierRef(p: number, x1: number, y1: number, x2: number, y2: number): number {
  const axis = (t: number, a1: number, a2: number): number => {
    const u = 1 - t;
    return 3 * u * u * t * a1 + 3 * u * t * t * a2 + t * t * t;
  };
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (axis(mid, x1, x2) < p) lo = mid;
    else hi = mid;
  }
  return axis((lo + hi) / 2, y1, y2);
}

describe('easeOutBack', () => {
  it('pins both endpoints for both ratified constants', () => {
    expect(easeOutBack(0, BACK)).toBe(0);
    expect(easeOutBack(1, BACK)).toBe(1);
    expect(easeOutBack(0, SCALE_BACK)).toBe(0);
    expect(easeOutBack(1, SCALE_BACK)).toBe(1);
  });

  it('actually overshoots — the excursion past 1 is the settle', () => {
    let peakBack = 0;
    let peakScale = 0;
    for (let i = 1; i < 1000; i++) {
      const p = i / 1000;
      peakBack = Math.max(peakBack, easeOutBack(p, BACK));
      peakScale = Math.max(peakScale, easeOutBack(p, SCALE_BACK));
    }
    // 2.99% for position/rotation — see the note on BACK: the ratified docs say
    // "~4.5%", the closed form says 2.99%, and this is the arithmetic.
    // The classic 1.70158 overshoots exactly 10%, which is the bounce the
    // constant exists to remove.
    expect(peakBack).toBeGreaterThan(1.025);
    expect(peakBack).toBeLessThan(1.035);
    const classicPeak = easeOutBack(1 - (2 * 1.70158) / (3 * 2.70158), 1.70158);
    expect(classicPeak).toBeGreaterThan(1.09);
    // Scale overshoots less: its overshoot is measured in edge pixels.
    expect(peakScale).toBeGreaterThan(1.0);
    expect(peakScale).toBeLessThan(peakBack);
  });

  it('CONTACT is the p where it first crosses 1', () => {
    expect(easeOutBack(CONTACT, BACK)).toBeCloseTo(1, 12);

    let firstCrossing = -1;
    for (let i = 1; i <= 100000; i++) {
      const p = i / 100000;
      if (easeOutBack(p, BACK) >= 1) {
        firstCrossing = p;
        break;
      }
    }
    expect(firstCrossing).toBeGreaterThan(0);
    expect(Math.abs(firstCrossing - CONTACT)).toBeLessThan(1e-3);
    // and it is strictly below 1 just before
    expect(easeOutBack(CONTACT - 0.01, BACK)).toBeLessThan(1);
  });
});

describe('settle — cubic-bezier(.22, 1, .36, 1)', () => {
  it('pins its endpoints', () => {
    expect(settle(0)).toBe(0);
    expect(settle(1)).toBe(1);
    expect(settle(-3)).toBe(0);
    expect(settle(4)).toBe(1);
  });

  it('is monotonically non-decreasing', () => {
    let prev = 0;
    for (let i = 0; i <= 2000; i++) {
      const v = settle(i / 2000);
      expect(v).toBeGreaterThanOrEqual(prev - 1e-12);
      prev = v;
    }
  });

  it('never overshoots (y2 = 1 is the ceiling)', () => {
    for (let i = 0; i <= 1000; i++) {
      expect(settle(i / 1000)).toBeLessThanOrEqual(1 + 1e-9);
    }
  });

  it('is within 1e-4 of the true curve at every sampled p', () => {
    const samples = [0.02, 0.05, 0.1, 0.15, 0.25, 0.35, 0.5, 0.65, 0.8, 0.9, 0.97, 0.995];
    for (const p of samples) {
      expect(Math.abs(settle(p) - bezierRef(p, 0.22, 1, 0.36, 1))).toBeLessThan(1e-4);
    }
  });

  it('is measurably better than the easeOutQuint approximation', () => {
    const quint = (p: number): number => 1 - Math.pow(1 - p, 5);
    let worstQuint = 0;
    let worstSettle = 0;
    for (let i = 1; i < 1000; i++) {
      const p = i / 1000;
      const truth = bezierRef(p, 0.22, 1, 0.36, 1);
      worstQuint = Math.max(worstQuint, Math.abs(quint(p) - truth));
      worstSettle = Math.max(worstSettle, Math.abs(settle(p) - truth));
    }
    // Measured, not quoted: the quintic peaks 1.14% off at p≈0.058 — the
    // steepest part of the curve, where the release reads.
    expect(worstQuint).toBeGreaterThan(0.011);
    expect(worstSettle).toBeLessThan(1e-4);
  });
});

describe('the small helpers', () => {
  it('smoothstep is clamped, symmetric and flat at both ends', () => {
    expect(smoothstep(-1)).toBe(0);
    expect(smoothstep(0)).toBe(0);
    expect(smoothstep(0.5)).toBeCloseTo(0.5, 12);
    expect(smoothstep(1)).toBe(1);
    expect(smoothstep(2)).toBe(1);
    expect(smoothstep(0.25) + smoothstep(0.75)).toBeCloseTo(1, 12);
  });

  it('easeOutCubic is clamped and pins its endpoints', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(-1)).toBe(0);
    expect(easeOutCubic(2)).toBe(1);
    expect(easeOutCubic(0.5)).toBeCloseTo(0.875, 12);
  });

  it('clamp01 clamps', () => {
    expect(clamp01(-0.2)).toBe(0);
    expect(clamp01(0.4)).toBe(0.4);
    expect(clamp01(1.7)).toBe(1);
  });

  it('hash1 is deterministic, in range, and spread', () => {
    expect(hash1(7)).toBe(hash1(7));
    let below = 0;
    for (let i = 0; i < 256; i++) {
      const v = hash1(i);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      if (v < 0.5) below++;
    }
    expect(below).toBeGreaterThan(80);
    expect(below).toBeLessThan(176);
  });

  it('hashKey turns a React string id into a stable seed', () => {
    expect(hashKey('duke-1')).toBe(hashKey('duke-1'));
    expect(hashKey('duke-1')).not.toBe(hashKey('duke-2'));
    expect(hashKey(12)).toBe(12);
    expect(hashKey(undefined)).toBe(0);
    expect(hashKey(null)).toBe(0);
  });
});
