'use client';

import { Glyph, GlyphProps } from './GlyphBase';

/** Challenge — an accusation is raised. Replaces the log's question mark / crossed swords. */
export function ChallengeGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      {/* attention lozenge */}
      <path d="M32 9 L55 32 L32 55 L9 32 Z" />
      {/* query bar */}
      <path d="M32 20V36" />
      {/* query point */}
      <path d="M29 41h6v6h-6z" fill="currentColor" stroke="none" />
    </Glyph>
  );
}
