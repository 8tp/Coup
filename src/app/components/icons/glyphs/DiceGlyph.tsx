'use client';

import { Glyph, GlyphProps } from './GlyphBase';

/** Dice — a gamble that did not pay. Used by the backfired-challenges award. */
export function DiceGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path d="M11 11h42v42H11z" />
      <path d="M18 18h8v8h-8z" fill="currentColor" stroke="none" />
      <path d="M28 28h8v8h-8z" fill="currentColor" stroke="none" />
      <path d="M38 38h8v8h-8z" fill="currentColor" stroke="none" />
    </Glyph>
  );
}
