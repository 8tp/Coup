'use client';

import { Glyph, GlyphProps } from './GlyphBase';

/** Steal — coins pulled off a rival. Replaces the flying money. */
export function StealGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      {/* the coin being taken */}
      <circle cx="47" cy="32" r="11" fill="currentColor" stroke="none" />
      {/* the pull */}
      <path d="M34 32H12" />
      <path d="M22 20 L10 32 L22 44" />
    </Glyph>
  );
}
