'use client';

import { Glyph, GlyphProps } from './GlyphBase';

/** Exit — first out of the game. Used by the quick-exit award. */
export function ExitGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path d="M10 8h24v48H10z" />
      <path d="M38 32h14" />
      <path d="M44 24 L54 32 L44 40" />
    </Glyph>
  );
}
