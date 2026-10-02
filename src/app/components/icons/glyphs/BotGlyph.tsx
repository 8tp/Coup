'use client';

import { Glyph, GlyphProps } from './GlyphBase';

/** Bot — a computer player. Replaces the robot emoji. */
export function BotGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path d="M32 21V14" />
      <path d="M28 6h8v8h-8z" fill="currentColor" stroke="none" />
      <path d="M13 21h38v30H13z" />
      <path d="M21 31h8v8h-8z" fill="currentColor" stroke="none" />
      <path d="M35 31h8v8h-8z" fill="currentColor" stroke="none" />
    </Glyph>
  );
}
