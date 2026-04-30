'use client';

import { Character } from '@/shared/types';

export const CARD_BACK_ART = '/assets/cards/back.webp';
export const CARD_BACK_FOCUS_ART = '/assets/cards/focus/back.webp';

export const CHARACTER_CARD_ART: Record<Character, string> = {
  [Character.Duke]: '/assets/cards/duke-v2.webp',
  [Character.Assassin]: '/assets/cards/assassin-v2.webp',
  [Character.Captain]: '/assets/cards/captain-v2.webp',
  [Character.Ambassador]: '/assets/cards/ambassador-v2.webp',
  [Character.Contessa]: '/assets/cards/contessa-v2.webp',
  [Character.Inquisitor]: '/assets/cards/inquisitor-v2.webp',
};

export const CHARACTER_CARD_FOCUS_ART: Record<Character, string> = {
  [Character.Duke]: '/assets/cards/focus/duke-v2.webp',
  [Character.Assassin]: '/assets/cards/focus/assassin-v2.webp',
  [Character.Captain]: '/assets/cards/focus/captain-v2.webp',
  [Character.Ambassador]: '/assets/cards/focus/ambassador-v2.webp',
  [Character.Contessa]: '/assets/cards/focus/contessa-v2.webp',
  [Character.Inquisitor]: '/assets/cards/focus/inquisitor-v2.webp',
};

export const CHARACTER_CARD_BADGES: Record<Character, { name: string; action: string }> = {
  [Character.Duke]: { name: 'DUKE', action: 'TAX' },
  [Character.Assassin]: { name: 'ASSASSIN', action: 'KILL' },
  [Character.Captain]: { name: 'CAPTAIN', action: 'STEAL' },
  [Character.Ambassador]: { name: 'AMBASSADOR', action: 'EXCHANGE' },
  [Character.Contessa]: { name: 'CONTESSA', action: 'BLOCK' },
  [Character.Inquisitor]: { name: 'INQUISITOR', action: 'EXAMINE' },
};

interface CardArtworkProps {
  character: Character;
  className?: string;
  variant?: 'full' | 'focus';
}

export function CardArtwork({ character, className = '', variant = 'full' }: CardArtworkProps) {
  const src = variant === 'focus' ? CHARACTER_CARD_FOCUS_ART[character] : CHARACTER_CARD_ART[character];

  return (
    <img
      src={src}
      alt=""
      className={`absolute inset-0 h-full w-full object-cover ${className}`}
      draggable={false}
    />
  );
}

interface CardBackArtworkProps {
  className?: string;
  variant?: 'full' | 'focus';
}

export function CardBackArtwork({ className = '', variant = 'full' }: CardBackArtworkProps) {
  const src = variant === 'focus' ? CARD_BACK_FOCUS_ART : CARD_BACK_ART;

  return (
    <img
      src={src}
      alt=""
      className={`absolute inset-0 h-full w-full object-cover ${className}`}
      draggable={false}
    />
  );
}

interface CharacterCardBadgeProps {
  character: Character;
}

export function CharacterCardBadge({ character }: CharacterCardBadgeProps) {
  const details = CHARACTER_CARD_BADGES[character];
  const nameFit = details.name.length >= 9 ? 'card-label-extra-long' : details.name.length >= 7 ? 'card-label-medium' : '';
  const actionFit = details.action.length >= 8 ? 'card-label-medium' : '';

  return (
    <span className="card-label-plate">
      <span className={`card-character-label ${nameFit}`}>{details.name}</span>
      <span className={`card-action-label ${actionFit}`}>{details.action}</span>
    </span>
  );
}
