'use client';

import { Glyph, GlyphProps } from './GlyphBase';

/** Claim — a character is claimed (truthfully or not). Replaces the theatre masks. */
export function ClaimGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path d="M16 8v48" />
      <path d="M19 12h31L40 24l10 12H19z" fill="currentColor" stroke="none" />
    </Glyph>
  );
}
