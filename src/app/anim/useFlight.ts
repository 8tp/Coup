'use client';

/**
 * anim/useFlight.ts — the React seam.
 *
 * chudopoly's card nodes live for the whole game, so its engine can hold a node
 * reference indefinitely. React's do not: a seat re-renders, a hand re-keys, a
 * prompt unmounts mid-beat. The single job of this hook is that a flight whose
 * node has gone away ABORTS rather than writing to a detached node — and that it
 * aborts at detach time, not whenever the next frame happens to notice.
 *
 * It uses a callback ref with a cleanup (React 19), so the abort is on the same
 * commit as the removal, and it keeps its own node reference rather than reading
 * `ref.current` in an effect cleanup, where the ref has already been nulled.
 */

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import {
  cancel as cancelFlight,
  clearRest,
  finishAll,
  fly as flyEl,
  punch as punchEl,
  setRest as setRestPose,
  setReducedMotion,
  type FlyOptions,
} from './flight';
import {
  invertAndPlay,
  measureFirst,
  type FlipOptions,
  type FlipResult,
  type FlipSnapshot,
} from './flip';

export interface FlightHandle<T extends HTMLElement> {
  /** Attach to the element you want to animate. */
  ref: (node: T | null) => (() => void) | void;
  /** The live node, or null when unmounted. */
  node: () => T | null;
  /** FIRST — snapshot the current box before the DOM moves. */
  measure: () => FlipSnapshot | null;
  /** LAST/INVERT/PLAY — call after the move has committed. */
  play: (first: FlipSnapshot | null, opts?: FlipOptions) => FlipResult;
  /** Launch from an explicit delta. */
  fly: (opts: FlyOptions) => boolean;
  /** There-and-back shove. */
  punch: (dx: number, dy: number, opts?: FlyOptions) => boolean;
  /** Resting pose this element lands on — a fan offset, a discard tilt. */
  setRest: (x: number, y: number, rot?: number) => void;
  /** Kill any live flight; fires its `abort`, never `land`. */
  cancel: () => void;
}

export function useFlight<T extends HTMLElement = HTMLElement>(): FlightHandle<T> {
  const nodeRef = useRef<T | null>(null);

  const ref = useCallback((node: T | null) => {
    nodeRef.current = node;
    if (!node) return;
    return () => {
      // Detach: abort before React drops the node, so nothing writes to it and
      // the caller's abort callback fires while its context is still live.
      cancelFlight(node);
      clearRest(node);
      if (nodeRef.current === node) nodeRef.current = null;
    };
  }, []);

  const handle = useRef<FlightHandle<T> | null>(null);
  if (handle.current === null) {
    handle.current = {
      ref,
      node: () => nodeRef.current,
      measure: () => measureFirst(nodeRef.current),
      play: (first, opts) => invertAndPlay(nodeRef.current, first, opts),
      fly: (opts) => flyEl(nodeRef.current, opts),
      punch: (dx, dy, opts) => punchEl(nodeRef.current, dx, dy, opts),
      setRest: (x, y, rot) => setRestPose(nodeRef.current, x, y, rot),
      cancel: () => cancelFlight(nodeRef.current),
    };
  }
  return handle.current;
}

/**
 * FLIP needs the DOM measured after the commit that moved it and BEFORE the
 * browser paints, so the invert is never a visible frame at the destination.
 * That is `useLayoutEffect`, which React does not run on the server and warns
 * about when a component is server-rendered — which every component in this
 * Next app is. The usual dodge, stated once here rather than in each caller.
 */
export const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

let syncInstalled = false;

/**
 * Keep the engine's reduced-motion flag in step with the two things that can ask
 * for it: the OS setting, and the app's own `html.reduce-motion` class (written
 * by the settings store — which this module deliberately does not import; the
 * class is the contract between them).
 *
 * IDEMPOTENT AND PERMANENT, so any component may call it without knowing
 * whether it is the first. The flag is process-wide state on a module-level
 * engine, so its listener has to outlive any one component's mount: a card that
 * unmounts must not be able to take the whole app's reduced-motion handling
 * with it. One `matchMedia` listener and one `MutationObserver` for the life of
 * the page is the correct cost for that.
 */
export function ensureReducedMotionSync(): void {
  if (syncInstalled) return;
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  syncInstalled = true;
  const root = document.documentElement;
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const apply = (): void => {
    setReducedMotion(mq.matches || root.classList.contains('reduce-motion'));
  };
  apply();
  mq.addEventListener('change', apply);
  new MutationObserver(apply).observe(root, {
    attributes: true,
    attributeFilter: ['class'],
  });
}

let hiddenSettleInstalled = false;
let hiddenSettleHandler: (() => void) | null = null;
let hiddenSettleDoc: Document | null = null;

/**
 * SETTLE EVERY FLIGHT WHEN THE TAB GOES AWAY.
 *
 * `anim/clock.ts` is a bare `requestAnimationFrame` loop, and Chrome does not
 * run rAF in a hidden tab. So a card in the air when the player switches tabs
 * simply stops: `land` never fires, and anything waiting on that callback waits
 * as long as the player is gone. The challenge reveal hit this first and now
 * carries its own ceiling — measured at 21 seconds of a stuck full-screen plate
 * with the card parked at `--fx: -184px` — but the hazard is the CLOCK's, not
 * the reveal's, and every other flight sits on the same loop.
 *
 * `finishAll()` is the right response rather than pausing. The player did not
 * see the motion, so there is nothing to resume: snapping each card onto its
 * rest pose and firing `land` leaves the table in exactly the state the flights
 * were travelling towards, which is what they should find when they come back.
 * Resuming instead would restart a card mid-air seconds after the event that
 * launched it — motion with no cause attached.
 *
 * It also preserves flight.ts's central guarantee: every started flight
 * resolves. `finishAll` lands rather than aborts, because those flights did
 * arrive; they just arrived instantly and unobserved.
 *
 * Page-lifetime and idempotent, for the same reason as the reduced-motion sync:
 * a card that unmounts must not take the app's visibility handling with it.
 */
export function ensureHiddenTabSettle(): void {
  if (hiddenSettleInstalled) return;
  if (typeof document === 'undefined') return;
  hiddenSettleInstalled = true;
  hiddenSettleDoc = document;
  hiddenSettleHandler = (): void => {
    if (hiddenSettleDoc?.visibilityState === 'hidden') finishAll();
  };
  document.addEventListener('visibilitychange', hiddenSettleHandler);
}

/**
 * Test hook: uninstall the visibility listener and re-arm the guard. Matches
 * `__resetHaptics()` / `resetJitter()` elsewhere in the codebase — a
 * page-lifetime installer is untestable across cases without one, because the
 * second test would silently keep the first test's listener and document.
 * Never call this from app code.
 */
export function __resetHiddenTabSettle(): void {
  if (hiddenSettleDoc && hiddenSettleHandler) {
    hiddenSettleDoc.removeEventListener('visibilitychange', hiddenSettleHandler);
  }
  hiddenSettleInstalled = false;
  hiddenSettleHandler = null;
  hiddenSettleDoc = null;
}

/**
 * Mount-time wrapper for the two page-lifetime installers. Safe anywhere, and
 * cheap after the first call.
 */
export function useReducedMotionSync(): void {
  useEffect(() => {
    ensureReducedMotionSync();
    ensureHiddenTabSettle();
  }, []);
}
