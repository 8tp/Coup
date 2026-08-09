/**
 * Functional glyph set.
 *
 * These replace the system emoji that were doing functional work in the action
 * log, the header, the game-over screen and the awards list. They are drawn in
 * one line language; if you add a glyph, it must follow all of these:
 *
 *   1. TWO STROKE WIDTHS ONLY, at a 2:1 ratio — `GLYPH_STROKE_HEAVY` (6) for
 *      object lines and the load-bearing mark, `GLYPH_STROKE_LIGHT` (3) for
 *      secondary detail and frames. No third weight, ever.
 *   2. SQUARE CORNERS ALWAYS — `stroke-linejoin="miter"`, `stroke-linecap="butt"`.
 *      No rounded caps or joins anywhere. (`<Glyph>` sets these; don't override.)
 *   3. NEVER a gradient, a blur, or a soft shadow.
 *   4. PATTERNS, NOT OPACITY, for tints. Use `<HatchPattern>` + `useHatchId()`:
 *      a 45-degree line screen reads as the halftone it is imitating, where
 *      `fill-opacity` just reads as faded.
 *   5. `currentColor` for every stroke and fill, so the glyph inherits the
 *      caller's colour. No hard-coded hex.
 *   6. 64x64 viewBox, ~6px margin, coordinates on whole (ideally even) units.
 *   7. LEGIBLE AT 16px — that is where most of these render. One strong
 *      silhouette beats detail. More than ~8 path elements means simplify.
 *   8. No `<text>` (it does not survive a font change) and no `<animate>`.
 *
 * `GlyphSheet.tsx` in this directory renders the whole set at 16/24/48 on dark
 * and light. It is a development aid — it is not routed and should not be.
 */

export { Glyph, HatchPattern, useHatchId, GLYPH_STROKE_HEAVY, GLYPH_STROKE_LIGHT } from './GlyphBase';
export type { GlyphProps } from './GlyphBase';

/* Characters (ART-DIRECTION.md §1.2) — one 1-bit silhouette each, and the
 * COLOURBLIND CHANNEL for the six character hues. Two of those hues are 1° of
 * hue apart (Assassin 206°/S15 vs Captain 205°/S56, §2.4), so these six carry
 * the categorical load on their own and are held to a harder standard than the
 * rest of the set: no two may share a silhouette CLASS. As drawn they are one
 * open profile (Duke), one downward mass (Assassin), one horizontal line
 * (Captain), one broken ring (Ambassador), one convex block (Contessa) and one
 * horizontal lens (Inquisitor). Consume via `CHARACTER_GLYPHS` in ../index.ts.
 *
 * `DukeGlyph` is additionally bound by the crown RULING in §1.2 — see its
 * header and `CrownGlyph`'s. */
export { DukeGlyph } from './DukeGlyph';
export { AssassinGlyph } from './AssassinGlyph';
export { CaptainGlyph } from './CaptainGlyph';
export { AmbassadorGlyph } from './AmbassadorGlyph';
export { ContessaGlyph } from './ContessaGlyph';
export { InquisitorGlyph } from './InquisitorGlyph';

// Verdicts — square/lozenge chassis
export { ChallengeGlyph } from './ChallengeGlyph';
export { TruthGlyph } from './TruthGlyph';
export { BluffGlyph } from './BluffGlyph';
export { PassGlyph } from './PassGlyph';
export { BlockGlyph } from './BlockGlyph';

// Actions
export { CoupGlyph } from './CoupGlyph';
export { AssassinateGlyph } from './AssassinateGlyph';
export { StealGlyph } from './StealGlyph';
export { ExchangeGlyph } from './ExchangeGlyph';
export { ExamineGlyph } from './ExamineGlyph';
export { ConvertGlyph } from './ConvertGlyph';
export { EmbezzleGlyph } from './EmbezzleGlyph';
export { CoinGlyph } from './CoinGlyph';
export { ClaimGlyph } from './ClaimGlyph';
export { DeclareGlyph } from './DeclareGlyph';
export { ResolveGlyph } from './ResolveGlyph';

// State and outcome
export { SkullGlyph } from './SkullGlyph';
export { CrownGlyph } from './CrownGlyph';
export { DeckGlyph } from './DeckGlyph';
export { TurnGlyph } from './TurnGlyph';
export { GameStartGlyph } from './GameStartGlyph';
export { BotGlyph } from './BotGlyph';

// Chrome
export { SpeakerGlyph } from './SpeakerGlyph';
export { SpeakerMutedGlyph } from './SpeakerMutedGlyph';

// Awards
export { TargetGlyph } from './TargetGlyph';
export { DiceGlyph } from './DiceGlyph';
export { ExitGlyph } from './ExitGlyph';
