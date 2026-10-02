'use client';

import { Glyph, GlyphProps } from './GlyphBase';

/** A face — send a reaction. Replaces the grinning emoji on the reaction button. */
export function ReactGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <circle cx="32" cy="32" r="24" />
      <rect x="22" y="22" width="5" height="8" fill="currentColor" stroke="none" />
      <rect x="37" y="22" width="5" height="8" fill="currentColor" stroke="none" />
      <path d="M20 37 L26 44 H38 L44 37" />
    </Glyph>
  );
}
