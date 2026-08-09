'use client';

import { Glyph, GlyphProps } from './GlyphBase';

/** Declare — an action is announced to the table. Replaces the loudhailer. */
export function DeclareGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path d="M10 12h44v28H30L18 52V40h-8z" />
    </Glyph>
  );
}
