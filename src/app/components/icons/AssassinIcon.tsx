'use client';

import { Character } from '@/shared/types';
import { CharacterMedallion } from './CharacterMedallion';

interface IconProps {
  size?: number;
  className?: string;
}

export function AssassinIcon({ size = 24, className }: IconProps) {
  return <CharacterMedallion character={Character.Assassin} size={size} className={className} />;
}
