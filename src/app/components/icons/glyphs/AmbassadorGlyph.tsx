'use client';

import { Glyph, GlyphProps } from './GlyphBase';

/**
 * Ambassador — two offset arrows forming an open loop.
 *
 * ART-DIRECTION.md §1.2: it has to read as *exchange*. The two arrows are 180°
 * rotations of each other about the centre, each running one vertical arm and
 * one horizontal arm, so together they enclose a broken square — a cycle that
 * never closes, which is what an exchange is.
 *
 * Distinct from `ExchangeGlyph` (the action), which is two straight PARALLEL
 * horizontals with chevrons: that mark is a flat back-and-forth, this one is a
 * rotation. At 16px the difference is that one is two bars and the other is a
 * ring, which is a silhouette-level difference, not a detail-level one.
 *
 * The heads are deliberately oversized — 10 units of run each way. A 6-unit
 * head disappears at 16px, where the whole glyph is 13px wide and the stroke is
 * 1.5px; at 10 units it survives as a visible point.
 */
export function AmbassadorGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      {/* up the left, across the top, pointing right */}
      <path d="M10 48 V14 H46" />
      <path d="M36 4 L46 14 L36 24" />
      {/* down the right, across the bottom, pointing left */}
      <path d="M54 16 V50 H18" />
      <path d="M28 60 L18 50 L28 40" />
    </Glyph>
  );
}
