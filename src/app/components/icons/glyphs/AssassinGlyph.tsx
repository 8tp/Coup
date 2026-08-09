'use client';

import { Glyph, GlyphProps } from './GlyphBase';

/**
 * Assassin — a blunt wedge, point-down, with one notch.
 *
 * ART-DIRECTION.md §1.2, and §2.2's standing note that the Assassin's hue is
 * cold steel at S15 and "the fix here is the glyph, not the hue". §2.4 records
 * why: Assassin 206° and Captain 205° are ONE degree apart, separated only by
 * saturation. This silhouette is therefore the whole categorical signal for the
 * weakest pair in the palette, and it has to survive being seen next to
 * `CaptainGlyph` in monochrome. It does: a downward solid mass against a
 * horizontal open line.
 *
 * Explicitly NOT a dagger. `AssassinateGlyph` is the dagger — that is the
 * ACTION, drawn with a crossguard, grip and pommel. The character is the
 * abstract instrument: a heavy wedge that stops short of a point (the tip is a
 * flat 8 units wide, so it never becomes a needle that vanishes at 16px), with
 * a single square bite out of the left edge. The notch is the memorable event
 * in an otherwise plain triangle, and it is on one side only — the asymmetry is
 * what makes the mark nameable rather than generic.
 *
 * THE PAIR TO WATCH IS NOT THE ONE THE DOCUMENT NAMES. §2.4 flags Assassin
 * against Captain on hue; on SHAPE the near neighbour is `ContessaGlyph` —
 * both are solid masses, widest at the top, narrowing downward, and at 16px
 * that description is most of what you can see. Three things separate them and
 * all three were sized on the proof sheet, not guessed: this taper starts at
 * the very top edge where the shield has vertical shoulders for its first
 * 24 units; this has the notch and the shield is convex; and this ends in a
 * 12-unit BLUNT tip (3px at 16px) where the shield comes to a point. The tip
 * was 8 units in the first pass and the blunt/pointed distinction was not
 * carrying at 16px. Do not narrow it.
 *
 * Both of those numbers are proof-sheet results. The first draft sat on 40x46
 * of the grid with a 10x12 notch, and at 16px the notch closed up completely
 * and left a generic pennant. At 48x52 with a 14x16 notch the bite survives as
 * a visible shoulder at 16px, which is the whole point of drawing one. A
 * top-edge V-notch was tried and rejected in the same pass: at 16px it read as
 * a plain letter V.
 */
export function AssassinGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path
        d="M8 6 H56 L38 58 H26 L20 38 H34 V22 H14 Z"
        fill="currentColor"
        stroke="none"
      />
    </Glyph>
  );
}
