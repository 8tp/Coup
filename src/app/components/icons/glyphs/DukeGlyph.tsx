'use client';

import { Glyph, GlyphProps } from './GlyphBase';

/**
 * Duke — a fractured crown reduced to three severe planes.
 *
 * ART-DIRECTION.md §1.2. THIS GLYPH IS GOVERNED BY THE CROWN RULING; read
 * `CrownGlyph.tsx`'s header before touching it. The crown means the WINNER.
 * The Duke and the winner are separated by silhouette, not by subject:
 *
 *              Winner (CrownGlyph)          Duke (here)
 *   Form       closed, symmetric, base      open-topped, asymmetric, no base
 *   Weight     one solid filled mass        an open stroked profile
 *   Register   heraldic, a whole object     technical-order, a fracture diagram
 *
 * The load-bearing difference at 16px is MASS vs LINE. CrownGlyph is a single
 * filled slab and reads as a dark blob with a jagged top; this is an open
 * polyline and reads as a jagged rule. Verified side by side on the 16px proof
 * sheet — they do not converge, because one has an interior and one does not.
 * If a future edit fills this path, the ruling is broken.
 *
 * The three planes are FLAT-TOPPED, not pointed — "planes", not spikes, which
 * is also what saves it at 16px. THE FIRST DRAFT WAS A TOOTHED ZIGZAG and it
 * was mud: three peaks plus two deep valleys plus two end legs is seven
 * features across 12.5px, and on the proof sheet it read as a picket fence. A
 * stepped profile has no thin valley to close up, so the same three planes
 * survive at a quarter of the size. Redrawn, not rescaled.
 *
 * They sit at three heights (32 / 14 / 26) over three widths (18 / 20 / 14),
 * middle plane highest, so no reflection maps the mark onto itself. The two end
 * legs fall to different depths (18 / 20 units) and never meet: there is no
 * base. Orthographic, stepped, unclosed — a fracture diagram of a crown rather
 * than a crown.
 */
export function DukeGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path d="M6 50 V32 H24 V14 H44 V26 H58 V46" />
    </Glyph>
  );
}
