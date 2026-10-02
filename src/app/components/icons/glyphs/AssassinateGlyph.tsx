'use client';

import { Glyph, GlyphProps } from './GlyphBase';

/** Assassinate — the Assassin's paid kill. Replaces the dagger. */
export function AssassinateGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      {/* blade */}
      <path d="M32 6 L41 24 V36 H23 V24 Z" fill="currentColor" stroke="none" />
      {/* crossguard */}
      <path d="M14 36h36v8H14z" fill="currentColor" stroke="none" />
      {/* grip */}
      <path d="M27 44h10v9H27z" fill="currentColor" stroke="none" />
      {/* pommel */}
      <path d="M22 53h20v5H22z" fill="currentColor" stroke="none" />
    </Glyph>
  );
}
