/**
 * anim/flip.ts — measured FLIP (First, Last, Invert, Play) for React.
 *
 * React owns the DOM, so the sequence is not chudopoly's "measure, reparent,
 * measure": it is "measure BEFORE the render that moves the node, then invert
 * after it has committed". Call `measureFirst()` in the render/effect that knows
 * the move is coming, and `invertAndPlay()` in the layout effect after it.
 *
 * The invert is exact because of flight.ts's transform contract — translate is
 * outermost, so adding the measured delta to `--fx` moves the centroid by
 * exactly that delta whatever tilt and scale the element carries.
 *
 * Three guards, all of them paid for in bugs elsewhere:
 *
 *   1. `first.width === 0` — the element was never rendered. There is no
 *      previous position to fly from; place it.
 *   2. `last.width === 0`  — the destination is not laid out (a hidden panel, a
 *      collapsed seat). INVERTING AGAINST A 0×0 RECT IS WHAT SENDS CARDS FLYING
 *      TO VIEWPORT (0,0). Place it and skip the beat rather than perform it
 *      into a corner.
 *   3. sub-1px move with no scale change — nothing to animate; a flight here is
 *      a start cue, a landing cue and 300ms of committed table time for a move
 *      no one can see.
 *
 * In cases 1–3 the caller's `land` callback still fires, synchronously. The
 * motion is skipped; the information is not (ART-DIRECTION §7).
 */

import {
  cancel,
  fly,
  writeRest,
  type FlightElement,
  type FlyOptions,
} from './flight';

export interface RectLike {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface MeasurableElement extends FlightElement {
  getBoundingClientRect(): RectLike;
  /** Layout width — unaffected by an in-flight `scale()`, unlike the rect. */
  readonly offsetWidth?: number;
}

export interface FlipSnapshot {
  cx: number;
  cy: number;
  width: number;
  height: number;
  /** `offsetWidth` when available: the scale factor must not be self-referential. */
  layoutWidth: number;
  /** Current `--tilt` in degrees, so the rotation continues instead of snapping. */
  tilt: number;
}

export type FlipResult =
  /** A flight was launched. */
  | 'played'
  /** No usable geometry either side — the element was placed at rest. */
  | 'placed'
  /** The move was below the perceptual floor. */
  | 'skipped'
  /** Nothing to do: no element, or no snapshot. */
  | 'ignored';

export interface FlipOptions extends FlyOptions {
  /** Ignore moves shorter than this many px (default 1). */
  minDistPx?: number;
}

function layoutWidthOf(el: MeasurableElement, rect: RectLike): number {
  const w = el.offsetWidth;
  return typeof w === 'number' && w > 0 ? w : rect.width;
}

function readTilt(el: FlightElement): number {
  const raw = el.style.getPropertyValue('--tilt');
  if (!raw) return 0;
  const v = parseFloat(raw);
  return Number.isFinite(v) ? v : 0;
}

/** FIRST — snapshot where the element is now, before the DOM moves it. */
export function measureFirst(el: MeasurableElement | null | undefined): FlipSnapshot | null {
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return {
    cx: rect.left + rect.width / 2,
    cy: rect.top + rect.height / 2,
    width: rect.width,
    height: rect.height,
    layoutWidth: layoutWidthOf(el, rect),
    tilt: readTilt(el),
  };
}

/**
 * LAST + INVERT + PLAY. Call after the DOM has moved the element.
 *
 * Any flight already on the element is cancelled first (firing its `abort`), and
 * the element is written to its rest pose so that `last` measures the
 * destination rather than wherever the previous flight had reached.
 */
export function invertAndPlay(
  el: MeasurableElement | null | undefined,
  first: FlipSnapshot | null | undefined,
  opts: FlipOptions = {},
): FlipResult {
  if (!el || !first) return 'ignored';

  cancel(el);
  writeRest(el);

  const settleNow = (): void => {
    const land = opts.land;
    if (land) land(el);
  };

  if (first.width === 0) {
    settleNow();
    return 'placed';
  }

  const last = el.getBoundingClientRect();
  if (last.width === 0) {
    settleNow();
    return 'placed';
  }

  const dx = first.cx - (last.left + last.width / 2);
  const dy = first.cy - (last.top + last.height / 2);
  const w1 = layoutWidthOf(el, last);
  const scale = w1 > 0 ? first.layoutWidth / w1 : 1;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < (opts.minDistPx ?? 1) && Math.abs(scale - 1) < 0.02) {
    settleNow();
    return 'skipped';
  }

  const started = fly(el, {
    ...opts,
    dx,
    dy,
    scale: opts.scale ?? scale,
    tiltFrom: opts.tiltFrom ?? first.tilt,
  });
  return started ? 'played' : 'ignored';
}
