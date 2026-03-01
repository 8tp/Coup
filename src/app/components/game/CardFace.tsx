'use client';

import { Character, ClientInfluence } from '@/shared/types';
import { CHARACTER_SVG_ICONS, CardBack } from '../icons';

const characterColors: Record<Character, string> = {
  [Character.Duke]: 'border-purple-500 bg-purple-900/40',
  [Character.Assassin]: 'border-gray-500 bg-gray-800/40',
  [Character.Captain]: 'border-blue-500 bg-blue-900/40',
  [Character.Ambassador]: 'border-green-500 bg-green-900/40',
  [Character.Contessa]: 'border-red-500 bg-red-900/40',
};

const iconPixelSizes = { sm: 28, md: 36, lg: 48 } as const;

interface CardFaceProps {
  influence: ClientInfluence;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  selected?: boolean;
}

export function CardFace({ influence, size = 'md', onClick, selected }: CardFaceProps) {
  const sizeClass = `card-face-${size}`;
  const iconPx = iconPixelSizes[size];

  if (influence.revealed && influence.character) {
    const Icon = CHARACTER_SVG_ICONS[influence.character];
    return (
      <div title={influence.character} className={`card-face ${sizeClass} ${characterColors[influence.character]} card-face-revealed`}>
        <Icon size={iconPx} />
      </div>
    );
  }

  if (influence.character) {
    const Icon = CHARACTER_SVG_ICONS[influence.character];
    return (
      <div
        title={influence.character}
        className={`card-face ${sizeClass} ${characterColors[influence.character]}
          ${onClick ? 'cursor-pointer hover:scale-105' : ''}
          ${selected ? 'ring-2 ring-coup-accent scale-105' : ''}`}
        onClick={onClick}
      >
        <Icon size={iconPx} />
      </div>
    );
  }

  return (
    <div className={`card-face ${sizeClass} border-gray-600 bg-coup-surface card-back`}>
      <CardBack size={iconPx} />
    </div>
  );
}
