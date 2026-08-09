import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fx from '@/app/fx';
import * as floaters from '@/app/fx/floaters';
import { reset as resetClock } from '@/app/anim/clock';
import { __resetHaptics } from '@/app/utils/haptic';
import { el, installRaf, type FakeElement, type RafHarness } from '../anim/fakeDom';

/**
 * THE SUBSTRATE EXISTS BEFORE ANY CHANNEL IS DISPATCHED.
 *
 * `cue()` used to call `pump()` LAST, after handing work to particles, shake,
 * flash and floaters. `pump()` is what installs the floater host, and
 * `floaters.spawn()` only attaches a node when a host is already present:
 *
 *     if (!rec.node && host) rec.node = host.create();
 *
 * So the very first float of a session was created headless. It never
 * self-healed either — `setHost()` clears `node` only when the host CHANGES,
 * and it never back-fills live records — so that record stayed nodeless for its
 * whole 900ms life and simply did not render. It also skipped the measured
 * half-width clamp, so even its position was a guess.
 *
 * Every SUBSEQUENT float was fine, which is exactly why unit tests and source
 * review both missed it and it took watching a real game's opening beat to see.
 *
 * There is no jsdom here, so no host is ever actually installed. What this file
 * pins is the ordering itself, observed from inside `spawn()`: the band
 * provider is called by `readBand()` partway through spawning, so if `pump()`
 * has already run by then, `stats().pumping` is true at that instant. That is
 * the invariant, and it is what regressed.
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
});

afterEach(() => {
  fx.reset();
  fx.setReducedMotion(false);
  fx.unmount();
  fx.setBand(null);
  resetClock();
  raf.restore();
});

/** `coins_changed / mine` is float-only — the cheapest row that spawns one. */
const COINS = { condition: 'mine', x: 200, y: 220, amount: 3 } as const;

describe('cue() builds the substrate before dispatching', () => {
  it('has already pumped by the time the FIRST float spawns', () => {
    const pumpingDuringSpawn: boolean[] = [];
    fx.setBand((out) => {
      out.top = 60;
      out.bottom = 320;
      out.width = 400;
      pumpingDuringSpawn.push(fx.stats().pumping);
    });

    // Nothing has run yet: this is the first cue of the "session".
    expect(fx.stats().pumping).toBe(false);

    fx.cue('coins_changed', COINS);

    // The provider ran (so we really did observe from inside spawn) ...
    expect(pumpingDuringSpawn).toHaveLength(1);
    // ... and the pump was already up at that moment. Pre-fix this was `false`.
    expect(pumpingDuringSpawn[0]).toBe(true);
  });

  it('spawns the first float rather than dropping it', () => {
    fx.setBand((out) => {
      out.top = 60;
      out.bottom = 320;
      out.width = 400;
    });

    expect(floaters.count()).toBe(0);
    fx.cue('coins_changed', COINS);
    expect(floaters.count()).toBe(1);
    expect(floaters.peek(0)?.text).toBe('+3');
  });

  it('still does not pump for a cue the tuning table has no row for', () => {
    // The laziness rule is carried by the `!row` early return, NOT by where
    // `pump()` sits — moving the call earlier must not have cost that.
    //
    // `denied / theirs` is the right probe: `rowFor` returns null for it,
    // because a `theirs` condition never escalates to the loud form and there
    // is no quiet denial. Note `coins_changed / theirs` is NOT this case — that
    // row EXISTS and is deliberately empty, so it matches, returns true, and
    // pumps. It pumped before this change too (the old call site was equally
    // unconditional once past `!row`), so nothing regressed there.
    const fired = fx.cue('denied', { condition: 'theirs', x: 10, y: 10 });
    expect(fired).toBe(false);
    expect(fx.stats().pumping).toBe(false);
    expect(floaters.count()).toBe(0);
  });
});
