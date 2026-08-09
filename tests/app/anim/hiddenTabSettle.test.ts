import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ensureHiddenTabSettle, __resetHiddenTabSettle } from '@/app/anim/useFlight';
import { fly, isFlying, setRest } from '@/app/anim/flight';
import { reset as resetClock } from '@/app/anim/clock';
import { el, installRaf, type FakeElement, type RafHarness } from './fakeDom';

/**
 * A HIDDEN TAB MUST NOT LEAVE A CARD IN THE AIR.
 *
 * `anim/clock.ts` is a bare `requestAnimationFrame` loop and Chrome does not
 * run rAF in a hidden tab, so a flight in progress when the player switches
 * away simply stops mid-transform and its `land` callback never fires. That was
 * measured in a real browser as 21 seconds of a stuck full-screen reveal plate
 * with the card parked at `--fx: -184px`.
 *
 * The reveal has its own ceiling for this, but the hazard belongs to the clock,
 * so the fix is page-lifetime: on `visibilitychange` → hidden, `finishAll()`
 * snaps every live flight onto its rest pose and fires `land`. LANDS rather than
 * aborts — those flights did arrive, just instantly and unobserved — which keeps
 * flight.ts's guarantee that every started flight resolves exactly once.
 *
 * Node has no `document`, so these tests install a minimal fake with a real
 * listener registry. That is enough: the whole mechanism is one event.
 */

interface FakeDoc {
  visibilityState: 'visible' | 'hidden';
  addEventListener(type: string, fn: () => void): void;
  removeEventListener(type: string, fn: () => void): void;
  /** Test hook: flip visibility and notify, the way a browser would. */
  __setHidden(hidden: boolean): void;
}

let raf: RafHarness;
let node: FakeElement;
let doc: FakeDoc;

function installDocument(): FakeDoc {
  const listeners = new Map<string, Set<() => void>>();
  const d: FakeDoc = {
    visibilityState: 'visible',
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    },
    removeEventListener(type, fn) {
      listeners.get(type)?.delete(fn);
    },
    __setHidden(hidden) {
      d.visibilityState = hidden ? 'hidden' : 'visible';
      for (const fn of listeners.get('visibilitychange') ?? []) fn();
    },
  };
  (globalThis as { document?: unknown }).document = d;
  return d;
}

beforeEach(() => {
  resetClock();
  raf = installRaf();
  node = el();
  doc = installDocument();
  // Re-arm against THIS document. Without the reset the installer keeps the
  // first test's listener and every later case silently tests nothing.
  __resetHiddenTabSettle();
});

afterEach(() => {
  __resetHiddenTabSettle();
  resetClock();
  raf.restore();
  delete (globalThis as { document?: unknown }).document;
});

describe('hidden tab settles every flight', () => {
  it('lands an in-flight card instead of leaving it parked', () => {
    ensureHiddenTabSettle();

    const land = vi.fn();
    const abort = vi.fn();
    setRest(node, 0, 0, 0);
    fly(node, { dx: -184, dy: 0, dur: 400, land, abort });

    raf.frame(16);
    expect(isFlying(node)).toBe(true);
    expect(land).not.toHaveBeenCalled();

    // The player switches tabs. In a browser rAF stops here; nothing else would
    // ever move this card.
    doc.__setHidden(true);

    expect(isFlying(node)).toBe(false);
    expect(land).toHaveBeenCalledTimes(1);
    // It ARRIVED. An abort would say the card never got there, and the table
    // would be showing a state the game had already moved past.
    expect(abort).not.toHaveBeenCalled();
  });

  it('leaves the card on its rest pose, not wherever it froze', () => {
    ensureHiddenTabSettle();

    setRest(node, 0, 0, 0);
    fly(node, { dx: -184, dy: 40, dur: 400 });
    raf.frame(16);
    doc.__setHidden(true);

    // Whatever `--fx` read mid-flight, the settled value is the rest pose.
    expect(node.style.getPropertyValue('--fx')).toBe('0px');
    expect(node.style.getPropertyValue('--fy')).toBe('0px');
  });

  it('does nothing when the tab becomes visible again', () => {
    ensureHiddenTabSettle();

    const land = vi.fn();
    setRest(node, 0, 0, 0);
    fly(node, { dx: 100, dy: 0, dur: 400, land });
    raf.frame(16);

    doc.__setHidden(true);
    expect(land).toHaveBeenCalledTimes(1);

    // Coming back must not re-land anything or restart the loop.
    doc.__setHidden(false);
    expect(land).toHaveBeenCalledTimes(1);
    expect(isFlying(node)).toBe(false);
  });

  it('is idempotent — installing twice arms one listener, not two', () => {
    ensureHiddenTabSettle();
    ensureHiddenTabSettle();
    ensureHiddenTabSettle();

    const land = vi.fn();
    setRest(node, 0, 0, 0);
    fly(node, { dx: 100, dy: 0, dur: 400, land });
    raf.frame(16);
    doc.__setHidden(true);

    // Three installs, one landing. A second listener would still only see one
    // live flight, so this guards the listener count via `finishAll` being a
    // no-op the second time rather than via counting handlers directly.
    expect(land).toHaveBeenCalledTimes(1);
  });
});
