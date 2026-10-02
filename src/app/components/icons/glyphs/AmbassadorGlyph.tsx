'use client';

import { Character } from '@/shared/types';
import { CHARACTER_EMBLEMS } from '../emblems';
import { EmblemGlyph, GlyphProps } from './GlyphBase';

/** The Ambassador emblem at glyph scale. The drawing lives in `../emblems.tsx`. */
export function AmbassadorGlyph(props: GlyphProps) {
  return <EmblemGlyph {...props}>{CHARACTER_EMBLEMS[Character.Ambassador]}</EmblemGlyph>;
}
