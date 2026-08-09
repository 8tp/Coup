import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fx from '@/app/fx';
import * as floaters from '@/app/fx/floaters';
import * as flash from '@/app/fx/flash';
import * as shake from '@/app/fx/shake';
import { reset as resetClock } from '@/app/anim/clock';
import { __resetHaptics, hapticStats } from '@/app/utils/haptic';
import { el, installRaf, type FakeElement, type RafHarness } from '../anim/fakeDom';

/**
 * The design rule made executable.
 *
 * ART-DIRECTION §7: motion collapses to fades; sound and haptics stay. The
 * consequence that is easy to break and hard to notice is that a player who
 * asked for less motion must not become the only player at the table with no
 * evidence that anything happened. So: particles and shake go, the FLASH STAYS
 * (opacity-only, so it reads as a light coming up rather than a hit), and the
 * floater keeps its text and loses its 46px rise.
 *
 * There is no jsdom here, so the overlay never builds and there is no canvas
 * and no plate. That is the point: every one of these systems keeps its state
 * independently of whether a renderer exists, which is why they can be asserted
 * at all.
 */

let raf: RafHarness;
let table: FakeElement;

beforeEach(() => {
  resetClock();
  raf = installRaf();
  __resetHaptics();
  table = el();
  fx.reset();
  fx.setReducedMotion(false);
  fx.mount(null, table);
  fx.setBand((out) => {
    out.top = 60;
    out.bottom = 320;
    out.width = 400;
  });
});

afterEach(() => {
  fx.reset();
  fx.setReducedMotion(false);
  fx.unmount();
  fx.setBand(null);
  resetClock();
  raf.restore();
});

const AT = { condition: 'mine', x: 200, y: 220 } as const;

describe('fx — laziness', () => {
  it('mount() builds nothing and subscribes to nothing', () => {
    const s = fx.stats();
    expect(s.mounted).toBe(true);
    expect(s.pumping).toBe(false);
    expect(s.particles).toBe(0);
    expect(raf.pending()).toBe(0);
  });

  it('the first cue starts the pump and the last death stops it', () => {
    fx.cue('influence_lost', AT);
    expect(fx.stats().pumping).toBe(true);

    // Run the beat out: 12 sparks at 0.42s, a 0.42s ring, a 520ms flash and a
    // 900ms floater.
    for (let i = 0; i < 120; i++) raf.frame(16);
    const s = fx.stats();
    expect(s.particles).toBe(0);
    expect(s.floats).toBe(0);
    expect(s.flash).toBe(false);
    expect(s.trauma).toBe(0);
    expect(s.pumping).toBe(false);
  });
});

describe('fx — the normal path', () => {
  it('fires particles, shake, flash, float and haptic for your own influence loss', () => {
    expect(fx.cue('influence_lost', AT)).toBe(true);
    const s = fx.stats();
    expect(s.particles).toBeGreaterThan(0);
    expect(s.trauma).toBeCloseTo(0.34, 6);
    expect(s.flash).toBe(true);
    expect(s.floats).toBe(1);
    expect(floaters.peek(0)?.text).toBe('LOST');
    expect(floaters.peek(0)?.rise).toBe(46);
    expect(hapticStats().byPattern.influenceLost).toBe(1);
  });

  it('keeps the same loss quiet when it happens to somebody else', () => {
    expect(fx.cue('influence_lost', { condition: 'theirs', x: 200, y: 220 })).toBe(true);
    const s = fx.stats();
    expect(s.particles).toBeGreaterThan(0); // grey puffs
    expect(s.trauma).toBe(0);
    expect(s.flash).toBe(false);
    expect(s.floats).toBe(0);
    expect(hapticStats().fired).toBe(0);
  });
});

describe('fx — reduced motion', () => {
  beforeEach(() => {
    fx.setReducedMotion(true);
  });

  it('suppresses particles entirely', () => {
    fx.cue('influence_lost', AT);
    fx.cue('game_over', AT);
    fx.cue('coup_landed', { condition: 'against_me', x: 100, y: 100 });
    expect(fx.stats().particles).toBe(0);
  });

  it('suppresses the shake entirely', () => {
    fx.cue('coup_landed', { condition: 'against_me', x: 100, y: 100 });
    expect(fx.stats().trauma).toBe(0);
    expect(shake.hasTransform()).toBe(false);
    expect(table.style.writes.length).toBe(0);
  });

  it('STILL FIRES THE FLASH — it is the only non-auditory evidence left', () => {
    expect(flash.firedCount()).toBe(0);
    fx.cue('coup_landed', { condition: 'against_me', x: 100, y: 100 });
    expect(fx.stats().flash).toBe(true);
    expect(flash.firedCount()).toBe(1);
  });

  it('softens the flash to 55% and stretches it 1.6×', () => {
    fx.cue('influence_lost', AT); // crimson .30 over 520ms
    // Peak lands in the attack window: 8% of 832ms is 67ms.
    for (let i = 0; i < 5; i++) raf.frame(16);
    const peak = flash.alphaNow();
    expect(peak).toBeGreaterThan(0);
    expect(peak).toBeLessThanOrEqual(0.3 * 0.55 + 0.005);

    // 1.6× duration: the normal path is out by 520ms, this one is not.
    for (let i = 0; i < 33; i++) raf.frame(16); // ~608ms total
    expect(fx.stats().flash).toBe(true);
    for (let i = 0; i < 20; i++) raf.frame(16); // ~928ms total
    expect(fx.stats().flash).toBe(false);
  });

  it('keeps the floater TEXT and drops only its rise', () => {
    fx.cue('influence_lost', AT);
    expect(fx.stats().floats).toBe(1);
    const rec = floaters.peek(0);
    expect(rec?.text).toBe('LOST');
    expect(rec?.rise).toBe(0);
    // Still fades in and out — the word appears and goes, it just does not travel.
    raf.frame(16);
    raf.frame(16);
    expect(floaters.peek(0)?.alpha).toBeGreaterThan(0);
  });

  it('keeps the haptics — a haptic is not motion', () => {
    fx.cue('influence_lost', AT);
    expect(hapticStats().byPattern.influenceLost).toBe(1);
  });

  it('fires every cue the normal path fires, in the same tick', () => {
    // GAME-FEEL-PLAN §7's reduced-motion gate. The cue LOG must be identical;
    // only what each cue renders may differ.
    const beats = [
      ['card_landed', { condition: 'mine', x: 10, y: 10 }],
      ['challenge_lost', { condition: 'against_me', x: 20, y: 20 }],
      ['influence_lost', { condition: 'mine', x: 30, y: 30 }],
      ['coins_changed', { condition: 'mine', x: 40, y: 40, amount: -3 }],
      ['player_eliminated', { condition: 'theirs', x: 50, y: 50 }],
      ['game_over', { condition: 'mine', x: 60, y: 60 }],
    ] as const;

    fx.setReducedMotion(false);
    fx.reset();
    for (const [event, opts] of beats) fx.cue(event, opts);
    const normal = fx.log().map((r) => `${r.event}/${r.condition}/${r.matched}`);

    fx.setReducedMotion(true);
    fx.reset();
    for (const [event, opts] of beats) fx.cue(event, opts);
    const reduced = fx.log().map((r) => `${r.event}/${r.condition}/${r.matched}`);

    expect(reduced).toEqual(normal);
    expect(normal.length).toBe(beats.length);
  });
});

describe('fx — the signed coin float', () => {
  it('is brass for a gain and crimson for a loss', () => {
    fx.cue('coins_changed', { condition: 'mine', x: 200, y: 220, amount: 3 });
    expect(floaters.peek(0)?.text).toBe('+3');
    expect(floaters.peek(0)?.tone).toBe('brass');
    fx.reset();
    fx.cue('coins_changed', { condition: 'mine', x: 200, y: 220, amount: -3 });
    expect(floaters.peek(0)?.text).toBe('-3');
    expect(floaters.peek(0)?.tone).toBe('crimson');
  });

  it('says nothing at all when somebody else is paid', () => {
    expect(fx.cue('coins_changed', { condition: 'theirs', x: 200, y: 220, amount: 3 })).toBe(true);
    expect(fx.stats().floats).toBe(0);
    expect(fx.stats().particles).toBe(0);
  });
});

describe('fx — unmatched cues', () => {
  it('reports a miss and does nothing', () => {
    expect(fx.cue('denied', { condition: 'theirs' })).toBe(false);
    const s = fx.stats();
    expect(s.particles).toBe(0);
    expect(s.trauma).toBe(0);
    expect(s.flash).toBe(false);
    expect(s.pumping).toBe(false);
    // The miss is still LOGGED — the Phase 7 gate needs to see it.
    expect(fx.log().at(-1)).toMatchObject({ event: 'denied', matched: false });
  });

  it('defaults an un-directed cue to its quiet form', () => {
    // Until the §3.6 two-channel hold exists, a cue with no direction must fail
    // QUIET rather than loud.
    fx.cue('coup_landed', { x: 100, y: 100 });
    expect(fx.stats().trauma).toBe(0);
    expect(fx.stats().flash).toBe(false);
  });
});
