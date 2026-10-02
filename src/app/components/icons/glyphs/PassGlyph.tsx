'use client';

import { Glyph, GlyphProps, GLYPH_STROKE_LIGHT } from './GlyphBase';

/** Pass — declined to act. The null verdict in the same square chassis. */
export function PassGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path d="M11 11h42v42H11z" strokeWidth={GLYPH_STROKE_LIGHT} />
      <path d="M20 32h24" />
    </Glyph>
  );
}
