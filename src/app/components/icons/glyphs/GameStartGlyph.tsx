'use client';

import { Glyph, GlyphProps } from './GlyphBase';

/** Game start — the split-eclipse civic mark from the brand. Replaces the game-controller emoji. */
export function GameStartGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path
        fillRule="evenodd"
        d="M32 7a25 25 0 100 50 25 25 0 100-50z M28 4h8v56h-8z"
        fill="currentColor"
        stroke="none"
      />
    </Glyph>
  );
}
