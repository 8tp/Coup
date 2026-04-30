'use client';

import { Character } from '@/shared/types';
import {
  CARD_ART_DIMENSIONS,
  CARD_BACK_ART,
  CARD_BACK_FOCUS_ART,
  CHARACTER_CARD_ART,
  CHARACTER_CARD_FOCUS_ART,
} from '../../utils/assets';

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
  priority?: boolean;
}

export function CardArtwork({ character, className = '', variant = 'full', priority = false }: CardArtworkProps) {
  const src = variant === 'focus' ? CHARACTER_CARD_FOCUS_ART[character] : CHARACTER_CARD_ART[character];

  return (
    <img
      src={src}
      alt=""
      width={CARD_ART_DIMENSIONS.width}
      height={CARD_ART_DIMENSIONS.height}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={priority ? 'high' : 'auto'}
      className={`absolute inset-0 h-full w-full object-cover ${className}`}
      draggable={false}
    />
  );
}

interface CardBackArtworkProps {
  className?: string;
  variant?: 'full' | 'focus';
  priority?: boolean;
}

export function CardBackArtwork({ className = '', variant = 'full', priority = false }: CardBackArtworkProps) {
  const src = variant === 'focus' ? CARD_BACK_FOCUS_ART : CARD_BACK_ART;

  return (
    <img
      src={src}
      alt=""
      width={CARD_ART_DIMENSIONS.width}
      height={CARD_ART_DIMENSIONS.height}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={priority ? 'high' : 'auto'}
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
