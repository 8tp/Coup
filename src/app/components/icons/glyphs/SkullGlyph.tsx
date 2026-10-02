'use client';

import { Glyph, GlyphProps } from './GlyphBase';

/** Skull — an influence lost, or a player eliminated. Replaces the skull emoji. */
export function SkullGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path
        fillRule="evenodd"
        d="M18 10h28l6 6v24H42v12H22V40H12V16z M20 20h8v10h-8z M36 20h8v10h-8z M32 32l4 8h-8z M24 43h16v4H24z"
        fill="currentColor"
        stroke="none"
      />
    </Glyph>
  );
}
