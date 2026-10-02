/**
 * Where the practice coach's callout goes. Pure geometry, no DOM: the
 * component measures (getBoundingClientRect on `[data-coach-anchor]`
 * elements) and hands the rectangles in; this decides.
 *
 * The one hard rule: the callout NEVER covers the thing it is talking about,
 * and never covers a control the player may need (the `avoid` list). A
 * placement that would is not returned at all — the caller then docks the
 * tip as a banner instead of pointing.
 */

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

/** The side of the anchor the callout sits on; `dock` is the phone banner. */
export type CalloutSide = 'above' | 'below' | 'left' | 'right' | 'dock';

export interface CalloutPlacement {
  left: number;
  top: number;
  side: CalloutSide;
  /**
   * Where the pointer sits along the edge facing the anchor, in px from the
   * callout's left (above/below) or top (left/right). Null for `dock`.
   */
  pointer: number | null;
  /** Area (px²) of `avoid` the callout covers. 0 for any clean placement. */
  overlap: number;
}

export const CALLOUT_MARGIN = 8;
/** Distance from the anchor's edge, including the pointer's own depth. */
export const CALLOUT_GAP = 14;
/** The pointer never sits closer than this to a callout corner. */
const POINTER_INSET = 18;

export function rectRight(r: Rect): number { return r.left + r.width; }
export function rectBottom(r: Rect): number { return r.top + r.height; }

export function intersectionArea(a: Rect, b: Rect): number {
  const w = Math.min(rectRight(a), rectRight(b)) - Math.max(a.left, b.left);
  const h = Math.min(rectBottom(a), rectBottom(b)) - Math.max(a.top, b.top);
  return w > 0 && h > 0 ? w * h : 0;
}

export function isEmptyRect(r: Rect | null | undefined): boolean {
  return !r || r.width < 1 || r.height < 1;
}

function clamp(v: number, lo: number, hi: number): number {
  return hi < lo ? lo : Math.min(hi, Math.max(lo, v));
}

function fitsViewport(r: Rect, viewport: Size, margin: number): boolean {
  return r.left >= margin - 0.5
    && r.top >= margin - 0.5
    && rectRight(r) <= viewport.width - margin + 0.5
    && rectBottom(r) <= viewport.height - margin + 0.5;
}

function overlapWith(r: Rect, avoid: readonly Rect[]): number {
  let total = 0;
  for (const a of avoid) if (!isEmptyRect(a)) total += intersectionArea(r, a);
  return total;
}

interface PointInput {
  anchor: Rect;
  size: Size;
  viewport: Size;
  /** Controls and objects the callout must not cover. The anchor is always added. */
  avoid?: readonly Rect[];
  margin?: number;
  gap?: number;
  /** Sides to try, in order of preference. */
  sides?: readonly Exclude<CalloutSide, 'dock'>[];
}

/**
 * Point at `anchor` from one of its four sides.
 *
 * Every side is tried at three alignments (centred on the anchor, then flush
 * with either end) and clamped into the viewport. A candidate that leaves the
 * viewport or touches the anchor is discarded outright; of the rest, the first
 * that covers nothing in `avoid` wins. Returns null if no clean placement
 * exists — pointing while covering a control is worse than not pointing.
 */
export function placePointedCallout(input: PointInput): CalloutPlacement | null {
  const {
    anchor,
    size,
    viewport,
    avoid = [],
    margin = CALLOUT_MARGIN,
    gap = CALLOUT_GAP,
    sides = ['above', 'left', 'right', 'below'],
  } = input;
  if (isEmptyRect(anchor) || size.width < 1 || size.height < 1) return null;

  const ax = anchor.left + anchor.width / 2;
  const ay = anchor.top + anchor.height / 2;

  for (const side of sides) {
    const vertical = side === 'above' || side === 'below';
    const starts = vertical
      ? [ax - size.width / 2, anchor.left, rectRight(anchor) - size.width]
      : [ay - size.height / 2, anchor.top, rectBottom(anchor) - size.height];

    for (const start of starts) {
      let left: number;
      let top: number;
      if (vertical) {
        left = clamp(start, margin, viewport.width - margin - size.width);
        top = side === 'above' ? anchor.top - gap - size.height : rectBottom(anchor) + gap;
      } else {
        top = clamp(start, margin, viewport.height - margin - size.height);
        left = side === 'left' ? anchor.left - gap - size.width : rectRight(anchor) + gap;
      }

      const box: Rect = { left, top, width: size.width, height: size.height };
      if (!fitsViewport(box, viewport, margin)) continue;
      if (intersectionArea(box, anchor) > 0) continue;
      if (overlapWith(box, avoid) > 0) continue;

      const pointer = vertical
        ? clamp(ax - left, POINTER_INSET, size.width - POINTER_INSET)
        : clamp(ay - top, POINTER_INSET, size.height - POINTER_INSET);
      return { left, top, side, pointer, overlap: 0 };
    }
  }
  return null;
}

interface DockInput {
  /** Top edge of the bottom sheet (the dock). The banner sits just above it. */
  sheetTop: number;
  /** Lowest y the banner may start at — the bottom of the header. */
  topLimit: number;
  size: Size;
  viewport: Size;
  /** Must never be covered: the thing the tip is about, any live control. */
  avoid?: readonly Rect[];
  /** Better not covered (seats, the phase line); scored, not forbidden. */
  soft?: readonly Rect[];
  /** Cap on the banner's width; it is centred when capped. */
  maxWidth?: number;
  margin?: number;
  gap?: number;
}

/**
 * The phone banner: full width, docked just above the bottom sheet so it
 * never covers the buttons in it. If that would cover something in `avoid`
 * (the claim plaque a tip is about, a seat you are aiming at), it moves up
 * under the header instead. Between clean spots, the one covering least of
 * `soft` wins. Returns null when no spot is clean — the caller then holds the
 * tip back rather than lay it over a control.
 */
export function placeDockBanner(input: DockInput): CalloutPlacement | null {
  const { sheetTop, topLimit, size, viewport, avoid = [], soft = [], maxWidth = Infinity, margin = CALLOUT_MARGIN, gap = 8 } = input;
  const width = Math.min(viewport.width - margin * 2, maxWidth);
  const left = (viewport.width - width) / 2;
  const candidates = [sheetTop - gap - size.height, topLimit + gap];

  let best: CalloutPlacement | null = null;
  for (const top of candidates) {
    if (top < topLimit - 0.5 || top + size.height > sheetTop - gap + 0.5) continue;
    const box: Rect = { left, top, width, height: size.height };
    if (overlapWith(box, avoid) > 0) continue;
    const overlap = overlapWith(box, soft);
    if (overlap === 0) return { left, top, side: 'dock', pointer: null, overlap: 0 };
    if (!best || overlap < best.overlap) best = { left, top, side: 'dock', pointer: null, overlap };
  }
  return best;
}
