'use client';

import { Glyph, GlyphProps } from './GlyphBase';

/** Speaker muted — sound is off. Replaces the muted-speaker emoji in the header. */
export function SpeakerMutedGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path d="M8 25h11L32 12v40L19 39H8z" fill="currentColor" stroke="none" />
      <path d="M40 24 L56 40" />
      <path d="M56 24 L40 40" />
    </Glyph>
  );
}
