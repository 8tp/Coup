'use client';

import { Glyph, GlyphProps } from './GlyphBase';

/** Examine — the Inquisitor looks at a card. Replaces the magnifier. */
export function ExamineGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <circle cx="27" cy="27" r="15" />
      <path d="M38 38 L54 54" />
    </Glyph>
  );
}
