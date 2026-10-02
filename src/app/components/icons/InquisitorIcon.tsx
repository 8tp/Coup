'use client';

import { Character } from '@/shared/types';
import { CharacterMedallion } from './CharacterMedallion';

interface IconProps {
  size?: number;
  className?: string;
}

export function InquisitorIcon({ size = 24, className }: IconProps) {
  return <CharacterMedallion character={Character.Inquisitor} size={size} className={className} />;
}
