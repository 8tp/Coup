'use client';

import { Glyph, GlyphProps, GLYPH_STROKE_LIGHT } from './GlyphBase';

/** Speaker — sound is on. Replaces the loudspeaker emoji in the header. */
export function SpeakerGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path d="M8 25h11L32 12v40L19 39H8z" fill="currentColor" stroke="none" />
      <path d="M40 21 L47 32 L40 43" />
      <path d="M50 13 L58 32 L50 51" strokeWidth={GLYPH_STROKE_LIGHT} />
    </Glyph>
  );
}
