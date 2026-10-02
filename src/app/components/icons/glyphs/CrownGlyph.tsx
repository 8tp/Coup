'use client';

import { Glyph, GlyphProps } from './GlyphBase';

/**
 * Crown — the winner. Replaces the trophy and the crown emoji.
 *
 * Ratified by the crown RULING in ART-DIRECTION.md §1.2: the crown means victory,
 * not the Duke. Keep this form CLOSED, SYMMETRIC and SITTING ON A SOLID BASE — that
 * is the entire separation from the Duke's silhouette, which is open-topped,
 * asymmetric and baseless. Anyone drawing the Duke mark must diff it against this
 * one at 16px on the proof sheet before it lands.
 */
export function CrownGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path
        fillRule="evenodd"
        d="M8 20l12 12L32 12l12 20 12-12-4 30H12z M22 38h6v6h-6z M38 38h6v6h-6z"
        fill="currentColor"
        stroke="none"
      />
    </Glyph>
  );
}
