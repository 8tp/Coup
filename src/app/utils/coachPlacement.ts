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
  /**
   * How much further than the standard gap the callout stands off the anchor,
   * in px. The pointer bridges it with a brass leader line. 0 for `dock`.
   */
  reach: number;
  /** Area (px²) of `soft` the callout covers. 0 for any clean placement. */
  overlap: number;
}

export const CALLOUT_MARGIN = 8;
/** Distance from the anchor's edge, including the pointer's own depth. */
export const CALLOUT_GAP = 14;
/** The pointer never sits closer than this to a callout corner. */
const POINTER_INSET = 18;
/** Extra stand-off distances tried when nothing adjacent is clean. */
export const CALLOUT_REACHES: readonly number[] = [0, 40, 88];

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
  /** Controls the callout must not cover. The anchor is always added. */
  avoid?: readonly Rect[];
  /** Better not covered (the phase line, the deck): scored, not forbidden. */
  soft?: readonly Rect[];
  margin?: number;
  gap?: number;
  /** Sides to try, in order of preference. */
  sides?: readonly Exclude<CalloutSide, 'dock'>[];
  /** Extra stand-off distances to try, nearest first. */
  reaches?: readonly number[];
}

/**
 * Point at `anchor` from one of its four sides.
 *
 * Every side is tried at three alignments (centred on the anchor, then flush
 * with either end), clamped into the viewport, first right beside the anchor
 * and then standing a little further off (`reaches`, bridged by a leader
 * line). A candidate that leaves the viewport, touches the anchor or covers
 * anything in `avoid` is discarded outright; of the rest, the nearest that
 * covers nothing in `soft` wins, else the one covering least of it. Returns
 * null if no clean placement exists — pointing while covering a control is
 * worse than not pointing.
 */
export function placePointedCallout(input: PointInput): CalloutPlacement | null {
  const {
    anchor,
    size,
    viewport,
    avoid = [],
    soft = [],
    margin = CALLOUT_MARGIN,
    gap = CALLOUT_GAP,
    sides = ['above', 'left', 'right', 'below'],
    reaches = CALLOUT_REACHES,
  } = input;
  if (isEmptyRect(anchor) || size.width < 1 || size.height < 1) return null;

  const ax = anchor.left + anchor.width / 2;
  const ay = anchor.top + anchor.height / 2;
  let best: CalloutPlacement | null = null;

  for (const reach of reaches) {
    const off = gap + reach;
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
          top = side === 'above' ? anchor.top - off - size.height : rectBottom(anchor) + off;
        } else {
          top = clamp(start, margin, viewport.height - margin - size.height);
          left = side === 'left' ? anchor.left - off - size.width : rectRight(anchor) + off;
        }

        const box: Rect = { left, top, width: size.width, height: size.height };
        if (!fitsViewport(box, viewport, margin)) continue;
        if (intersectionArea(box, anchor) > 0) continue;
        if (overlapWith(box, avoid) > 0) continue;
        // The leader line crosses the stand-off; it must not cross a control either.
        if (reach > 0 && overlapWith(leaderRect(box, side, reach), avoid) > 0) continue;

        const pointer = vertical
          ? clamp(ax - left, POINTER_INSET, size.width - POINTER_INSET)
          : clamp(ay - top, POINTER_INSET, size.height - POINTER_INSET);
        const overlap = overlapWith(box, soft);
        if (overlap === 0) return { left, top, side, pointer, reach, overlap: 0 };
        if (!best || overlap < best.overlap) best = { left, top, side, pointer, reach, overlap };
      }
    }
  }
  return best;
}

/** The strip between the callout and the anchor that a leader line crosses. */
function leaderRect(box: Rect, side: Exclude<CalloutSide, 'dock'>, reach: number): Rect {
  switch (side) {
    case 'above': return { left: box.left, top: rectBottom(box), width: box.width, height: reach };
    case 'below': return { left: box.left, top: box.top - reach, width: box.width, height: reach };
    case 'left': return { left: rectRight(box), top: box.top, width: reach, height: box.height };
    case 'right': return { left: box.left - reach, top: box.top, width: reach, height: box.height };
  }
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
  /** More tops to try between the two defaults (e.g. just under the seats). */
  extraTops?: readonly number[];
  margin?: number;
  gap?: number;
}

/**
 * The phone banner: full width, docked just above the bottom sheet so it
 * never covers the buttons in it. If that would cover something in `avoid`
 * (the claim plaque a tip is about, a seat you are aiming at), it moves up —
 * to any `extraTops` the caller offers (just under the seats), then under the
 * header. Between clean spots, the one covering least of
 * `soft` wins. Returns null when no spot is clean — the caller then holds the
 * tip back rather than lay it over a control.
 */
export function placeDockBanner(input: DockInput): CalloutPlacement | null {
  const { sheetTop, topLimit, size, viewport, avoid = [], soft = [], maxWidth = Infinity, extraTops = [], margin = CALLOUT_MARGIN, gap = 8 } = input;
  const width = Math.min(viewport.width - margin * 2, maxWidth);
  const left = (viewport.width - width) / 2;
  const candidates = [sheetTop - gap - size.height, ...extraTops, topLimit + gap];

  let best: CalloutPlacement | null = null;
  for (const top of candidates) {
    if (top < topLimit - 0.5 || top + size.height > sheetTop - gap + 0.5) continue;
    const box: Rect = { left, top, width, height: size.height };
    if (overlapWith(box, avoid) > 0) continue;
    const overlap = overlapWith(box, soft);
    if (overlap === 0) return { left, top, side: 'dock', pointer: null, reach: 0, overlap: 0 };
    if (!best || overlap < best.overlap) best = { left, top, side: 'dock', pointer: null, reach: 0, overlap };
  }
  return best;
}
