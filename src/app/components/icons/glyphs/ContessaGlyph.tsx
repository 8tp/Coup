'use client';

import { Glyph, GlyphProps } from './GlyphBase';

/**
 * Contessa — a heraldic shield, flat top, single vertical split.
 *
 * ART-DIRECTION.md §1.2 gives this glyph a job the other five do not have: it
 * is "the only closed convex form in the set — findable by shape alone". That
 * is a constraint on the WHOLE SET, not just on this file. Duke is an open
 * profile, Assassin a downward wedge, Captain a horizontal line, Ambassador a
 * broken ring, Inquisitor a horizontal lens; this is the only mark you can find
 * by looking for a solid block with a flat top. Do not fill another character's
 * glyph into a convex mass, and do not open this one up.
 *
 * It is therefore SOLID, not stroked. An outlined shield at 16px is a 9px-wide
 * ring with 1.5px walls and almost no interior — it reads as a smudge. Filled,
 * it reads as a shield at 16px and as a shield at 48px.
 *
 * §2.4 also leans on it: `--crimson` (5°) and Contessa (348°) sit 17° apart,
 * and the stated mitigation is that "Contessa is only ever a fill inside one,
 * carrying the shield glyph". This is that glyph.
 *
 * The split is knocked out with `evenodd` rather than drawn as a second stroke,
 * because a stroke over a fill is a second weight on the same object. It is 6
 * units wide — 1.5px at 16px, exactly one stroke width, so it prints as a
 * hairline rather than vanishing — and it deliberately stops 8 units short of
 * the top edge and 14 short of the point. On the proof sheet a slot running
 * edge to edge split the mark into two halves at 16px, which costs the one
 * property §1.2 gives this glyph: being a single convex mass.
 */
export function ContessaGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path
        fillRule="evenodd"
        d="M10 8 H54 V32 L32 58 L10 32 Z M29 16 h6 v28 h-6 z"
        fill="currentColor"
        stroke="none"
      />
    </Glyph>
  );
}
