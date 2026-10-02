'use client';

import { Glyph, GlyphProps } from './GlyphBase';

/** Deck — the court deck, or a card returned to it. Replaces the playing-card emoji. */
export function DeckGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      {/* the card behind */}
      <path d="M24 20V10h28v34H38" />
      {/* the top card */}
      <path d="M10 20h28v34H10z" />
      <path d="M24 31 L30 37 L24 43 L18 37 Z" fill="currentColor" stroke="none" />
    </Glyph>
  );
}
