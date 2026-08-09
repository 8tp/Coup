'use client';

import { Glyph, GlyphProps, GLYPH_STROKE_LIGHT } from './GlyphBase';

/** Coin — one unit of the treasury. Milled edge, struck centre. */
export function CoinGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <circle cx="32" cy="32" r="23" />
      <circle cx="32" cy="32" r="11" strokeWidth={GLYPH_STROKE_LIGHT} />
    </Glyph>
  );
}
