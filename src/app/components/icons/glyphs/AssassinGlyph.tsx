'use client';

import { Character } from '@/shared/types';
import { CHARACTER_EMBLEMS } from '../emblems';
import { EmblemGlyph, GlyphProps } from './GlyphBase';

/** The Assassin emblem at glyph scale. The drawing lives in `../emblems.tsx`. */
export function AssassinGlyph(props: GlyphProps) {
  return <EmblemGlyph {...props}>{CHARACTER_EMBLEMS[Character.Assassin]}</EmblemGlyph>;
}
