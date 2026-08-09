import type { CSSProperties } from 'react';
import { Character } from '@/shared/types';

/**
 * characterPalette.ts — the ONE source of truth for character colour.
 *
 * ART-DIRECTION.md §1.1 measured the problem this module exists to delete: the
 * six character hues were raw Tailwind defaults hand-copied into five separate
 * palettes — `characterColors` in `CardFace.tsx`, `ChallengeRevealOverlay.tsx`
 * and `ExchangeView.tsx`, `characterThemes` in `HowToPlay.tsx`, and a fourth
 * set inlined per-entry in the `Tutorial.tsx` data array. Five copies meant
 * there was no single place to fix collision #1 (Contessa `#ef4444` was the
 * literal hex of the "you are being targeted" ring). All five now import from
 * here.
 *
 * ── WHERE THE VALUES ACTUALLY LIVE ────────────────────────────────────────
 *
 * Nowhere in this file. There is no hex here on purpose — a hex here would be
 * the sixth copy. Every entry is a *reference*:
 *
 *   - the Tailwind classes name `coup.duke` … `coup.inquisitor`, defined once
 *     in `tailwind.config.ts` (§2.2);
 *   - `hue` names `--char-duke` … `--char-inquisitor`, the `:root` mirror of
 *     those same tokens in `globals.css`.
 *
 * Change a character's colour in `tailwind.config.ts` (and its `:root` mirror)
 * and every call site follows.
 *
 * ── WHY THE ENTRIES ARE NOT ALL THE SAME SHAPE OF THING ───────────────────
 *
 * The five call sites want two different things and it is worth being explicit
 * about which is which, because mixing them is how the frames went wrong:
 *
 *   `hue` is for a CARD. §1.2 allows a character hue on a card as exactly one
 *   material — a printed band along one edge — so `hue` is handed to CSS as
 *   `--char-hue` and `.card-face::before` paints the band. Never a ring, never
 *   a glow, never a full-card saturated border.
 *
 *   `tint` / `edge` / `text` are for a PANEL THAT IS *ABOUT* A CHARACTER — the
 *   How to Play roster, the Tutorial character cards. Those are reference
 *   material, not table furniture, so a quiet hue wash and a hairline in the
 *   character's own colour is the correct read; §3.1's "no outlines" applies to
 *   things sitting on the felt.
 */

/**
 * The `style` object handed to a `.card-face`. Declared as an interface rather
 * than asserted with `as CSSProperties`, so a typo in the property name is a
 * compile error instead of a silently-dead band.
 */
export interface CharacterCardVars extends CSSProperties {
  '--char-hue': string;
}

export interface CharacterPaletteEntry {
  /**
   * CSS reference to the §2.2 hue, for the printed band on a card edge.
   * Consume via {@link characterCardVars}, not by hand.
   */
  hue: string;
  /** Tailwind text colour for the character's name. §2.3: ≥4.83:1 on `--raised`. */
  text: string;
  /** Low-alpha wash of the hue, for a panel whose subject is this character. */
  tint: string;
  /** Hairline in the character hue — a reference panel's edge, never a card's. */
  edge: string;
}

/**
 * §2.2. Every hue here is *lower* saturation than the Tailwind default it
 * replaced; the card is identified by art and glyph first, colour second.
 *
 * Contessa is the load-bearing entry: `coup.contessa` is `#E07B90`
 * (348°, S45), moved off `red-500` `#ef4444` (0°, S72) specifically so that
 * "you hold a Contessa" and "you are about to be couped" stop rendering as the
 * same pixel.
 */
export const CHARACTER_PALETTE: Record<Character, CharacterPaletteEntry> = {
  [Character.Duke]: {
    hue: 'var(--char-duke)',
    text: 'text-coup-duke',
    tint: 'bg-coup-duke/10',
    edge: 'border-coup-duke/40',
  },
  [Character.Assassin]: {
    hue: 'var(--char-assassin)',
    text: 'text-coup-assassin',
    tint: 'bg-coup-assassin/10',
    edge: 'border-coup-assassin/40',
  },
  [Character.Captain]: {
    hue: 'var(--char-captain)',
    text: 'text-coup-captain',
    tint: 'bg-coup-captain/10',
    edge: 'border-coup-captain/40',
  },
  [Character.Ambassador]: {
    hue: 'var(--char-ambassador)',
    text: 'text-coup-ambassador',
    tint: 'bg-coup-ambassador/10',
    edge: 'border-coup-ambassador/40',
  },
  [Character.Contessa]: {
    hue: 'var(--char-contessa)',
    text: 'text-coup-contessa',
    tint: 'bg-coup-contessa/10',
    edge: 'border-coup-contessa/40',
  },
  [Character.Inquisitor]: {
    hue: 'var(--char-inquisitor)',
    text: 'text-coup-inquisitor',
    tint: 'bg-coup-inquisitor/10',
    edge: 'border-coup-inquisitor/40',
  },
};

/**
 * The `style` for a `.card-face`. A face-down card passes `null` and gets a
 * transparent band — a card back does not belong to anybody yet.
 */
export function characterCardVars(character: Character | null): CharacterCardVars {
  return { '--char-hue': character ? CHARACTER_PALETTE[character].hue : 'transparent' };
}

/**
 * The `color` for a §1.2 character silhouette — `CHARACTER_GLYPHS[c]`, drawn
 * entirely in `currentColor`. §1.2 grants the character hue exactly two homes
 * on a card, "a solid printed band along one card edge **and as the glyph
 * fill**"; this is the second one.
 *
 * WHY THIS RESOLVES THE ROOT TOKEN AND NOT `var(--char-hue)`. `--char-hue` is
 * only defined where something has called {@link characterCardVars} — that is
 * `.card-face` and its four presentation variants. Two of the seven surfaces
 * that draw a card face are not `.card-face` at all (`ExaminePrompt`'s teal
 * panel, `Tutorial`'s inline art span), and on those the glyph would inherit
 * `.card-face`'s `transparent` local default or nothing at all, and vanish. The
 * `:root` token is defined everywhere, so the glyph is coloured everywhere.
 *
 * Still a reference, never a hex — the note at the top of this file applies.
 */
export function characterGlyphVars(character: Character): CSSProperties {
  return { color: CHARACTER_PALETTE[character].hue };
}
