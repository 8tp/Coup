'use client';

import { Glyph, GlyphProps } from './GlyphBase';

/** Coup — the paid, unstoppable strike. Replaces the explosion. */
export function CoupGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path
        d="M32 6 L37 20 L50.4 13.6 L44 27 L58 32 L44 37 L50.4 50.4 L37 44 L32 58 L27 44 L13.6 50.4 L20 37 L6 32 L20 27 L13.6 13.6 L27 20 Z"
        fill="currentColor"
        stroke="none"
      />
    </Glyph>
  );
}
