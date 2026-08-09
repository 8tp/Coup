import { Character } from '@/shared/types';
import { DukeIcon } from './DukeIcon';
import { AssassinIcon } from './AssassinIcon';
import { CaptainIcon } from './CaptainIcon';
import { AmbassadorIcon } from './AmbassadorIcon';
import { ContessaIcon } from './ContessaIcon';
import { InquisitorIcon } from './InquisitorIcon';
import {
  AmbassadorGlyph,
  AssassinGlyph,
  CaptainGlyph,
  ContessaGlyph,
  DukeGlyph,
  InquisitorGlyph,
  type GlyphProps,
} from './glyphs';

export { DukeIcon } from './DukeIcon';
export { AssassinIcon } from './AssassinIcon';
export { CaptainIcon } from './CaptainIcon';
export { AmbassadorIcon } from './AmbassadorIcon';
export { ContessaIcon } from './ContessaIcon';
export { InquisitorIcon } from './InquisitorIcon';
export { CardBack } from './CardBack';
export { CoinIcon } from './CoinIcon';
export { CoupLogo } from './CoupLogo';

// Functional glyph set (see ./glyphs/index.ts for the drawing rules)
export * from './glyphs';

export const CHARACTER_SVG_ICONS: Record<Character, React.ComponentType<{ size?: number; className?: string }>> = {
  [Character.Duke]: DukeIcon,
  [Character.Assassin]: AssassinIcon,
  [Character.Captain]: CaptainIcon,
  [Character.Ambassador]: AmbassadorIcon,
  [Character.Contessa]: ContessaIcon,
  [Character.Inquisitor]: InquisitorIcon,
};

/**
 * The §1.2 character silhouettes, keyed by character.
 *
 * NOT the same thing as `CHARACTER_SVG_ICONS` above, and the difference is the
 * whole point of §1.2:
 *
 *   CHARACTER_SVG_ICONS are ILLUSTRATIONS — multi-colour, hard-coded hex,
 *   drawn to be looked at around 24-40px in a prompt or a roster.
 *
 *   CHARACTER_GLYPHS are MARKS — one colour, `currentColor`, two stroke
 *   widths, drawn to be *recognised* at 14px on a 44x64 card. They are the
 *   colourblind channel: §1.2 puts the categorical load on "glyph silhouette
 *   first, colour second", and §2.4 records that Assassin and Captain are 1°
 *   of hue apart, so a player who cannot separate the six hues has only these.
 *
 * Card surfaces want this map. Reference panels want the one above.
 */
export const CHARACTER_GLYPHS: Record<Character, React.ComponentType<GlyphProps>> = {
  [Character.Duke]: DukeGlyph,
  [Character.Assassin]: AssassinGlyph,
  [Character.Captain]: CaptainGlyph,
  [Character.Ambassador]: AmbassadorGlyph,
  [Character.Contessa]: ContessaGlyph,
  [Character.Inquisitor]: InquisitorGlyph,
};
