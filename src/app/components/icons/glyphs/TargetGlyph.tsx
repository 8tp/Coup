'use client';

import { Glyph, GlyphProps } from './GlyphBase';

/** Target — accuracy. Used by the challenge-accuracy award. */
export function TargetGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <circle cx="32" cy="32" r="18" />
      <path d="M32 6v8" />
      <path d="M32 50v8" />
      <path d="M6 32h8" />
      <path d="M50 32h8" />
      <path d="M28 28h8v8h-8z" fill="currentColor" stroke="none" />
    </Glyph>
  );
}
