import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as F from '@/app/fx/floaters';
import { FakeStyle } from '../anim/fakeDom';

/**
 * The floater layer runs headless when no host is installed — records are still
 * created, clamped, stacked and ticked. A fake host is only needed for the two
 * rules that depend on real glyph metrics.
 */

class FakeFloatNode implements F.FloaterNode {
  textContent: string | null = null;
  offsetWidth = 0;
  readonly style = new FakeStyle();
  shout = false;
  setShout(on: boolean): void {
    this.shout = on;
  }
}

const made: FakeFloatNode[] = [];
/** Width the next created node reports. Set per test. */
let nodeWidth = 0;

const host: F.FloaterHost = {
  create(): F.FloaterNode {
    const n = new FakeFloatNode();
    n.offsetWidth = nodeWidth;
    made.push(n);
    return n;
  },
};

/** Roughly Coup's real band: under the phase banner, above the hand. */
const BAND = { top: 60, bottom: 320, width: 400 };

beforeEach(() => {
  F.reset();
  F.setHost(null);
  F.setReduced(false);
  F.setSuppressed(false);
  made.length = 0;
  nodeWidth = 0;
  F.setBand((out) => {
    out.top = BAND.top;
    out.bottom = BAND.bottom;
    out.width = BAND.width;
  });
});

afterEach(() => {
  F.reset();
  F.setBand(null);
  F.setHost(null);
});

describe('floaters — the keep-out band', () => {
  it('clamps a beat below the band up to the band bottom', () => {
    // A "−3" that lands on the coin counter it describes is worse than no float.
    expect(F.spawn('-3', 200, 900, 'crimson')).toBe(true);
    const rec = F.peek(0);
    expect(rec?.y).toBe(BAND.bottom);
  });

  it('clamps a beat above the band down to top + RISE', () => {
    expect(F.spawn('+2', 200, -50, 'brass')).toBe(true);
    // Offset by the full RISE, so the float ENDS its life inside the band
    // rather than starting inside it and drifting out through the top.
    expect(F.peek(0)?.y).toBe(BAND.top + F.RISE);
  });

  it('leaves a beat inside the band where it is', () => {
    expect(F.spawn('+1', 200, 220, 'brass')).toBe(true);
    expect(F.peek(0)?.y).toBe(210); // y − 10
  });

  it('never rises out through the top of the band', () => {
    F.spawn('+1', 200, 220, 'brass');
    for (let i = 0; i < 60; i++) {
      F.tick(1 / 60);
      const rec = F.peek(0);
      if (!rec) break;
      const drawnY = rec.y - F.RISE;
      expect(drawnY).toBeGreaterThanOrEqual(BAND.top);
    }
  });
});

describe('floaters — anti-collision stacking', () => {
  it('stacks two floats that land inside both thresholds', () => {
    F.spawn('+2', 200, 220, 'brass');
    F.spawn('+3', 200, 220, 'brass');
    F.spawn('+4', 200, 220, 'brass');
    expect(F.count()).toBe(3);
    expect(F.peek(0)?.y).toBe(210);
    expect(F.peek(1)?.y).toBe(210 - F.STACK_Y);
    expect(F.peek(2)?.y).toBe(210 - 2 * F.STACK_Y);
  });

  it('does NOT stack when the X separation exceeds the threshold', () => {
    F.spawn('+2', 100, 220, 'brass');
    F.spawn('+3', 100 + F.STACK_X, 220, 'brass');
    expect(F.peek(0)?.y).toBe(210);
    expect(F.peek(1)?.y).toBe(210); // side by side, no stacking
  });

  it('does NOT stack when the Y separation exceeds the threshold', () => {
    F.spawn('+2', 200, 130, 'brass'); // → y 120
    F.spawn('+3', 200, 210, 'brass'); // → y 200, which is 80 away
    expect(Math.abs((F.peek(0)?.y ?? 0) - (F.peek(1)?.y ?? 0))).toBeGreaterThanOrEqual(F.STACK_Y);
    expect(F.peek(1)?.y).toBe(200);
  });

  it('wraps to the bottom of the band rather than stacking through the banner', () => {
    // Coup pays several players in one beat; a deep enough caravan runs out of
    // headroom, and the answer is to start again at the bottom.
    for (let i = 0; i < 6; i++) F.spawn(`+${i}`, 200, 300, 'brass');
    for (let i = 0; i < F.count(); i++) {
      const rec = F.peek(i);
      expect(rec?.y).toBeGreaterThanOrEqual(BAND.top + F.RISE);
      expect(rec?.y).toBeLessThanOrEqual(BAND.bottom);
    }
  });
});

describe('floaters — the fade holds', () => {
  it('holds full alpha until 45% and only then falls', () => {
    expect(F.HOLD_UNTIL).toBe(0.45);
    expect(F.alphaAt(0.2)).toBe(1);
    expect(F.alphaAt(0.44)).toBe(1);
    expect(F.alphaAt(0.449)).toBe(1);
    // A linear fade over 900ms is legible for about 300ms of it. The hold buys
    // ~400ms of full contrast, which is what makes the number readable.
    expect(F.alphaAt(0.5)).toBeLessThan(1);
    expect(F.alphaAt(0.5)).toBeGreaterThan(0.8);
    expect(F.alphaAt(0.75)).toBeLessThan(F.alphaAt(0.5));
    expect(F.alphaAt(0.99)).toBeLessThan(0.05);
  });

  it('ramps in over the first 10% rather than popping on', () => {
    expect(F.alphaAt(0)).toBe(0);
    expect(F.alphaAt(0.05)).toBeCloseTo(0.5, 5);
    expect(F.alphaAt(0.1)).toBe(1);
  });

  it('falls on ^1.4, steeper than linear', () => {
    // Halfway through the fall the linear value would be 0.5; ^1.4 is 0.38.
    const mid = F.alphaAt(F.HOLD_UNTIL + (1 - F.HOLD_UNTIL) * 0.5);
    expect(mid).toBeLessThan(0.45);
    expect(mid).toBeGreaterThan(0.3);
  });

  it('drives the same envelope through tick()', () => {
    F.spawn('LOST', 200, 220, 'crimson', 1.2);
    let t = 0;
    const at40 = F.LIFE * 0.4;
    while (t < at40) {
      F.tick(1 / 60);
      t += 1 / 60;
    }
    expect(F.peek(0)?.alpha).toBe(1);
    while (F.tick(1 / 60)) {
      /* run it out */
    }
    expect(F.count()).toBe(0);
  });
});

describe('floaters — half-width is measured, not assumed', () => {
  it('clamps a long shout by the width its glyphs actually reported', () => {
    F.setHost(host);
    nodeWidth = 240; // "CAUGHT BLUFFING!" at 1.35 scale
    // Anchored on a seat near the left edge and centred with translateX(-50%).
    F.spawn('CAUGHT BLUFFING!', 20, 220, 'crimson', 1.35);
    // half = ceil(240/2) + 8 = 128. A fixed 62px guess would have put the first
    // glyph 66px off the left edge of the viewport.
    expect(F.peek(0)?.x).toBe(128);
    expect(made[0].shout).toBe(true);
    expect(made[0].textContent).toBe('CAUGHT BLUFFING!');
  });

  it('clamps a long shout off the right edge too', () => {
    F.setHost(host);
    nodeWidth = 240;
    F.spawn('CAUGHT BLUFFING!', 395, 220, 'crimson', 1.35);
    expect(F.peek(0)?.x).toBe(BAND.width - 128);
  });

  it('leaves a short number on its default clamp', () => {
    F.setHost(host);
    nodeWidth = 40;
    F.spawn('+3', 200, 220, 'brass');
    expect(F.peek(0)?.x).toBe(200);
    expect(made[0].shout).toBe(false);
  });
});

describe('floaters — suppression and reduced motion', () => {
  it('refuses to spawn while suppressed', () => {
    F.setSuppressed(true);
    expect(F.spawn('+3', 200, 220, 'brass')).toBe(false);
    expect(F.count()).toBe(0);
  });

  it('keeps the text and loses the rise under reduced motion', () => {
    F.setReduced(true);
    F.spawn('LOST', 200, 220, 'crimson', 1.2);
    const rec = F.peek(0);
    expect(rec?.text).toBe('LOST');
    expect(rec?.rise).toBe(0);
    F.tick(0.3);
    // Alpha still runs — the word appears and goes. It just does not travel.
    expect(F.peek(0)?.alpha).toBeGreaterThan(0);
  });
});

describe('floaters — the pool', () => {
  it('recycles the oldest float rather than growing', () => {
    for (let i = 0; i < 20; i++) F.spawn(`+${i}`, 30 + i * 200, 220, 'brass');
    expect(F.count()).toBeLessThanOrEqual(12);
  });

  it('refuses an empty string', () => {
    expect(F.spawn('', 200, 220, 'brass')).toBe(false);
  });
});
