'use client';

import { Glyph, GlyphProps } from './GlyphBase';

/**
 * Inquisitor — the eclipse eye.
 *
 * ART-DIRECTION.md §1.2 calls this "the one glyph that survives the rewrite":
 * `InquisitorIcon.tsx` is already an eclipse eye and the MOTIF is reused here
 * rather than reinvented. What could not be reused is the drawing. That file is
 * a five-colour illustration with hard-coded teal hex, `strokeLinejoin="round"`,
 * `fill-opacity` highlights and three `<animate>` elements — it breaks rules 2,
 * 3, 4, 5 and 8 of the glyph set, and it is a 24px+ illustration that turns to
 * porridge at 16px. `InquisitorIcon.tsx` stays exactly as it is for the places
 * that want the illustration; this is the same subject in the line language.
 *
 * The eclipse is done by KNOCKOUT, not by a second colour: one solid lens with
 * the iris punched out of it, so the ground shows through as the occluded disc.
 * That is the only way to get a bright-rim/dark-centre eclipse out of a
 * single-colour `currentColor` mark, and it is also what a screen-print does.
 *
 * The lens is quadratic rather than orthogonal because the rest of the rules
 * govern JOINS and CAPS (rule 2), not curvature — `ExamineGlyph`, `StealGlyph`
 * and `CoinGlyph` are all circles. The iris is r=10 against a 36-unit lens
 * opening (y 14..50), which leaves 8 units of rim top and bottom: 2px at 16px,
 * more than one stroke width, so the rim never breaks and the knockout never
 * bleeds out through the lid. The first draft's 28-unit opening left 1.5px and
 * was living on the edge of that.
 */
export function InquisitorGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path
        fillRule="evenodd"
        d="M2 32 Q32 -4 62 32 Q32 68 2 32 Z M32 22 A10 10 0 1 1 31.99 22 Z"
        fill="currentColor"
        stroke="none"
      />
    </Glyph>
  );
}
