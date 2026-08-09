'use client';

import { Glyph, GlyphProps } from './GlyphBase';

/**
 * Block — an action was stopped. An octagon with a prohibition slash.
 *
 * The slash is not decoration. This glyph originally carried the same horizontal
 * bar as PassGlyph (`M20 32h24`), and at 16px — the size it renders at in the
 * action log — an octagon and a square are not separable, so "blocked" and
 * "passed" read as the same mark for two opposite outcomes. The diagonal
 * separates them at every size, and a slashed octagon is the prohibition sign it
 * is already imitating. Verified on the 16px proof sheet, not in the source.
 */
export function BlockGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path d="M22.5 9h19L55 22.5v19L41.5 55h-19L9 41.5v-19z" />
      <path d="M21 21 L43 43" />
    </Glyph>
  );
}
