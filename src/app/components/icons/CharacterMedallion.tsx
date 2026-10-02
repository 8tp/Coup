'use client';

import { Character } from '@/shared/types';
import { CHARACTER_EMBLEMS } from './emblems';
import { CHARACTER_PALETTE } from '../../utils/characterPalette';

interface CharacterMedallionProps {
  character: Character;
  size?: number;
  className?: string;
}

/**
 * A character's emblem struck into a dark medallion with a hue rim — the large
 * presentation of the same mark the `*Glyph` components draw small. Used
 * wherever a character is the subject of a panel (prompts, rules, the action
 * dock) rather than a printed detail on a card.
 */
export function CharacterMedallion({ character, size = 24, className }: CharacterMedallionProps) {
  const hue = CHARACTER_PALETTE[character].hue;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      focusable="false"
    >
      <circle cx="40" cy="40" r="38.5" fill="var(--ground-deep)" />
      <circle cx="40" cy="40" r="35.5" fill="none" stroke={hue} strokeWidth="3" />
      {size >= 40 && (
        <circle cx="40" cy="40" r="30.5" fill="none" stroke={hue} strokeWidth="1" strokeDasharray="1.5 2.5" />
      )}
      <g transform="translate(13 13) scale(0.84)" fill={hue}>
        {CHARACTER_EMBLEMS[character]}
      </g>
    </svg>
  );
}
