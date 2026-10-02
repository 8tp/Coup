import { describe, it, expect, beforeEach } from 'vitest';
import * as P from '@/app/fx/particles';
import * as emit from '@/app/fx/emitters';
import { COL } from '@/app/fx/palette';

/**
 * The pool is module state, and vitest isolates modules per test FILE, so the
 * laziness assertion below is only meaningful as the first test in this file.
 * It is here rather than in a file of its own because everything else it needs
 * to know about is here too.
 */

function one(life: number, x: number): boolean {
  P.spDefaults();
  P.SP.kind = P.KIND.DOT;
  P.SP.col = COL.BONE;
  P.SP.life = life;
  P.SP.x = x;
  P.SP.drag = 0;
  P.SP.grav = 0;
  return P.spawn();
}

function livePx(): number[] {
  const p = P.inspect();
  if (!p) return [];
  const out: number[] = [];
  for (let i = 0; i < P.count(); i++) out.push(p.px[i]);
  return out;
}

describe('particles — laziness', () => {
  it('allocates no backing store until the first spawn', () => {
    // Importing fx must cost the module records and nothing else. 21 typed
    // arrays × 600 is ~46KB that an SSR render must never pay for.
    expect(P.allocated()).toBe(false);
    expect(P.inspect()).toBeNull();
    one(1, 0);
    expect(P.allocated()).toBe(true);
  });
});

describe('particles — capacity', () => {
  beforeEach(() => {
    P.reset();
  });

  it('never exceeds CAP', () => {
    for (let i = 0; i < P.CAP + 200; i++) one(1, i);
    expect(P.count()).toBe(P.CAP);
    expect(P.peakCount()).toBe(P.CAP);
  });

  it('DROPS a spawn on a full pool rather than queueing it', () => {
    for (let i = 0; i < P.CAP; i++) one(1, i);
    expect(P.full()).toBe(true);
    expect(one(1, 9999)).toBe(false);
    expect(one(1, 9999)).toBe(false);
    expect(P.droppedCount()).toBe(2);
    expect(P.count()).toBe(P.CAP);

    // A queue would turn a burst you cannot see into frames you can feel: the
    // dropped pieces must NEVER reappear once room frees up.
    P.update(0.5);
    const after = P.count();
    P.update(0.001);
    expect(P.count()).toBeLessThanOrEqual(after);
    expect(livePx()).not.toContain(9999);
  });

  it('an emitter stops firing at saturation instead of failing', () => {
    for (let i = 0; i < P.CAP - 3; i++) one(1, i);
    // 380 confetti into 3 free slots.
    const placed = emit.confetti(400, 800, 380, 3.2);
    expect(placed).toBe(3);
    expect(P.count()).toBe(P.CAP);
  });
});

describe('particles — zero allocation across a frame', () => {
  beforeEach(() => {
    P.reset();
  });

  it('reuses the same typed arrays for every frame of a burst', () => {
    emit.confetti(400, 800, 300, 3.2);
    emit.sparks(10, 10, 40, COL.CRIMSON, { speed: 200, life: 0.4, size: 9, grav: 300 });
    const before = P.inspect();
    expect(before).not.toBeNull();
    if (!before) return;

    const identity = { ...before };
    const startCount = P.count();
    expect(startCount).toBe(340);

    for (let f = 0; f < 60; f++) P.update(1 / 60);

    const after = P.inspect();
    expect(after).toBe(before); // the pool object itself
    for (const key of Object.keys(identity) as (keyof typeof identity)[]) {
      expect(after?.[key]).toBe(identity[key]); // every backing array
      expect(after?.[key].length).toBe(P.CAP); // never resized
    }
    // Particles really did die during those frames — the invariant is not
    // holding because nothing happened.
    expect(P.count()).toBeLessThan(startCount);
  });

  it('the spawn descriptor is one shared object, not a per-particle literal', () => {
    const sp = P.SP;
    emit.sparks(0, 0, 50, COL.BONE, { speed: 100, life: 0.3, size: 7, grav: 0 });
    expect(P.SP).toBe(sp);
  });
});

describe('particles — swap-with-last', () => {
  beforeEach(() => {
    P.reset();
  });

  it('keeps the live range dense and correct when a middle particle dies', () => {
    one(0.1, 1); // index 0 — dies first
    one(5.0, 2); // index 1
    one(5.0, 3); // index 2 — the last, so it swaps into 0

    expect(livePx()).toEqual([1, 2, 3]);
    P.update(0.2);
    expect(P.count()).toBe(2);
    // Swap-with-last, not splice: 3 takes 1's slot. `splice` returns an array,
    // which would be a per-frame allocation.
    expect(livePx()).toEqual([3, 2]);
  });

  it('does not skip the particle swapped into a dead slot', () => {
    one(0.1, 1);
    one(0.1, 2);
    one(5.0, 3);
    one(0.1, 4);
    P.update(0.2);
    // Every short-lived particle must go in the SAME frame, including the one
    // that was moved into an index the loop had already passed.
    expect(P.count()).toBe(1);
    expect(livePx()).toEqual([3]);
  });

  it('drains to empty', () => {
    for (let i = 0; i < 100; i++) one(0.2, i);
    P.update(0.3);
    expect(P.count()).toBe(0);
    P.update(0.3);
    expect(P.count()).toBe(0);
  });
});

describe('particles — the FX jitter stream', () => {
  beforeEach(() => {
    P.reset();
  });

  it('is deterministic and independent of any game randomness', () => {
    // A spark must never consume from the deck's RNG. The counter-driven hash
    // is reproducible from its own reset and from nothing else.
    P.resetJitter();
    const a = [P.rnd(), P.rnd(), P.rnd()];
    P.resetJitter();
    const b = [P.rnd(), P.rnd(), P.rnd()];
    expect(a).toEqual(b);
    for (const v of a) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    expect(new Set(a).size).toBe(3);
  });

  it('gives the same burst from the same seed', () => {
    P.reset();
    emit.sparks(100, 100, 12, COL.CRIMSON, { speed: 250, life: 0.4, size: 9, grav: 300 });
    const first = livePx();
    P.reset();
    emit.sparks(100, 100, 12, COL.CRIMSON, { speed: 250, life: 0.4, size: 9, grav: 300 });
    expect(livePx()).toEqual(first);
  });
});

describe('particles — draw is inert without a document', () => {
  it('reports no sprites in the node environment and never throws', () => {
    P.reset();
    one(1, 0);
    expect(P.ensureSprites()).toBe(false);
    // `draw` bails on a missing sprite atlas rather than throwing, which is
    // what keeps an SSR render and this suite honest.
    expect(() => P.draw({} as never, 2)).not.toThrow();
  });
});
