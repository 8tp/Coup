'use client';

import { Glyph, GlyphProps } from './GlyphBase';

/** Exchange — cards swapped with the court deck. Replaces the cycle arrows. */
export function ExchangeGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path d="M14 22h36" />
      <path d="M40 12 L50 22 L40 32" />
      <path d="M50 42H14" />
      <path d="M24 32 L14 42 L24 52" />
    </Glyph>
  );
}
