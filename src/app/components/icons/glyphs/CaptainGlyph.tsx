'use client';

import { Glyph, GLYPH_STROKE_LIGHT, GlyphProps } from './GlyphBase';

/**
 * Captain — a hooked bar, horizontal. A grapple.
 *
 * ART-DIRECTION.md §1.2: it has to read as *taking*, matching STEAL. The shank
 * runs the full width and the hook turns down, back, and up again — five
 * orthogonal segments, so it is a hook rather than an "L" at every size. The
 * returning tip is the whole difference: an L reads as a corner, a J reads as
 * something that has caught.
 *
 * Distinct from `StealGlyph` (the action) on purpose: that one is a filled coin
 * plus a leftward arrow, so its mass is at the RIGHT and it terminates in a
 * chevron. This one is all line, its mass is the long horizontal, and it
 * terminates in a closed curl. They never collide even at 16px.
 *
 * The light-weight tick at the left end is the shank eye. It uses
 * GLYPH_STROKE_LIGHT because rule 1 reserves the heavy weight for object lines
 * and this is secondary detail; at 16px it drops to a hint of a serif, which is
 * the correct behaviour — it stops the bar reading as a bare arrow shaft
 * without competing with the hook.
 *
 * The first draft ran the shank at y=32 with a 16-unit hook, i.e. inside a
 * 16-unit band of a 64-unit grid, and at 16px that is a 4px-tall mark in a
 * 16px box — present but weightless next to five glyphs that use the whole
 * grid. The hook now spans 22..54, which is half the grid, and the set reads
 * as one family at size.
 */
export function CaptainGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path d="M6 22 H52 V54 H26 V38" />
      <path d="M6 14 V34" strokeWidth={GLYPH_STROKE_LIGHT} />
    </Glyph>
  );
}
