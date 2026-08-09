'use client';

import { Glyph, GlyphProps } from './GlyphBase';

/** Resolve — the action stands and the turn closes. Replaces the sparkles. */
export function ResolveGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path
        d="M32 6 L38 26 L58 32 L38 38 L32 58 L26 38 L6 32 L26 26 Z"
        fill="currentColor"
        stroke="none"
      />
    </Glyph>
  );
}
