'use client';

import { Glyph, GlyphProps } from './GlyphBase';

/** Turn — a turn begins. Replaces the play triangle. */
export function TurnGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path d="M16 11 L52 32 L16 53 Z" fill="currentColor" stroke="none" />
    </Glyph>
  );
}
