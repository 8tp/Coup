'use client';

import { Character, ClientInfluence } from '@/shared/types';
import { CHARACTER_ICONS } from '@/shared/constants';

const characterColors: Record<Character, string> = {
  [Character.Duke]: 'border-purple-500 bg-purple-900/40',
  [Character.Assassin]: 'border-gray-500 bg-gray-800/40',
  [Character.Captain]: 'border-blue-500 bg-blue-900/40',
  [Character.Ambassador]: 'border-green-500 bg-green-900/40',
  [Character.Contessa]: 'border-red-500 bg-red-900/40',
};

interface CardFaceProps {
  influence: ClientInfluence;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  selected?: boolean;
}

export function CardFace({ influence, size = 'md', onClick, selected }: CardFaceProps) {
  const sizeClass = `card-face-${size}`;
  const iconSize = size === 'sm' ? 'text-base' : size === 'md' ? 'text-xl' : 'text-2xl';

  if (influence.revealed && influence.character) {
    return (
      <div className={`card-face ${sizeClass} ${characterColors[influence.character]} opacity-40`}>
        <span className={iconSize}>{CHARACTER_ICONS[influence.character]}</span>
        <span className="mt-0.5 leading-tight">{influence.character}</span>
      </div>
    );
  }

  if (influence.character) {
    return (
      <div
        className={`card-face ${sizeClass} ${characterColors[influence.character]}
          ${onClick ? 'cursor-pointer hover:scale-105' : ''}
          ${selected ? 'ring-2 ring-coup-accent scale-105' : ''}`}
        onClick={onClick}
      >
        <span className={iconSize}>{CHARACTER_ICONS[influence.character]}</span>
        <span className="mt-0.5 leading-tight">{influence.character}</span>
      </div>
    );
  }

  return (
    <div className={`card-face ${sizeClass} border-gray-600 bg-coup-surface`}>
      <span className={iconSize}>?</span>
    </div>
  );
}
