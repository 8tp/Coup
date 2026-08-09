'use client';

import { Glyph, GlyphProps } from './GlyphBase';

/** Convert — a player crosses the aisle to the other faction (Reformation). */
export function ConvertGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      {/* the aisle */}
      <path d="M32 8v48" />
      {/* crossing it */}
      <path d="M10 32h36" />
      <path d="M36 22 L46 32 L36 42" />
    </Glyph>
  );
}
