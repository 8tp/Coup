'use client';

import { Character } from '@/shared/types';
import { CharacterMedallion } from './CharacterMedallion';

interface IconProps {
  size?: number;
  className?: string;
}

export function AmbassadorIcon({ size = 24, className }: IconProps) {
  return <CharacterMedallion character={Character.Ambassador} size={size} className={className} />;
}
