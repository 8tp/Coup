'use client';

import { Glyph, GlyphProps, GLYPH_STROKE_LIGHT } from './GlyphBase';

/** Bluff — the claim was a lie. Replaces the cross / ballot X. */
export function BluffGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path d="M11 11h42v42H11z" strokeWidth={GLYPH_STROKE_LIGHT} />
      <path d="M21 21 L43 43" />
      <path d="M43 21 L21 43" />
    </Glyph>
  );
}
