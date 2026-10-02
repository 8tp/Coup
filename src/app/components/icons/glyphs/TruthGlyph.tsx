'use client';

import { Glyph, GlyphProps, GLYPH_STROKE_LIGHT } from './GlyphBase';

/** Truth — the claim was genuine. Replaces the check mark. */
export function TruthGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path d="M11 11h42v42H11z" strokeWidth={GLYPH_STROKE_LIGHT} />
      <path d="M19 33 L28 42 L46 24" />
    </Glyph>
  );
}
