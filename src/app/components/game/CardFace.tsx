'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Character, ClientInfluence } from '@/shared/types';
import { CHARACTER_DESCRIPTIONS } from '@/shared/constants';
import { CHARACTER_SVG_ICONS, CardBack } from '../icons';
import { useGameStore } from '../../stores/gameStore';

const characterColors: Record<Character, string> = {
  [Character.Duke]: 'border-purple-500 bg-purple-900/40',
  [Character.Assassin]: 'border-gray-500 bg-gray-800/40',
  [Character.Captain]: 'border-blue-500 bg-blue-900/40',
  [Character.Ambassador]: 'border-green-500 bg-green-900/40',
  [Character.Contessa]: 'border-red-500 bg-red-900/40',
  [Character.Inquisitor]: 'border-teal-500 bg-teal-900/40',
};

const iconPixelSizes = { sm: 28, md: 36, lg: 48 } as const;

/** Detect when a card transitions to revealed and trigger a flip animation. */
function useCardFlip(influence: ClientInfluence) {
  const prevRevealedRef = useRef(influence.revealed);
  const prevCharRef = useRef(influence.character);
  const [flipping, setFlipping] = useState(false);
  // Which face to show during the first half of flip (before the midpoint swap)
  const [flipFront, setFlipFront] = useState<'back' | 'face'>('face');
  const flipTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    const wasRevealed = prevRevealedRef.current;
    const prevChar = prevCharRef.current;
    prevRevealedRef.current = influence.revealed;
    prevCharRef.current = influence.character;

    // Card just got revealed (hidden→revealed) — flip from face to revealed
    if (!wasRevealed && influence.revealed && influence.character) {
      setFlipFront('face');
      setFlipping(true);
      flipTimeoutRef.current = setTimeout(() => setFlipping(false), 700);
    }
    // Opponent card just became known (null→character, not revealed) — flip from back to face
    else if (prevChar === null && influence.character && !influence.revealed) {
      setFlipFront('back');
      setFlipping(true);
      flipTimeoutRef.current = setTimeout(() => setFlipping(false), 700);
    }

    return () => {
      if (flipTimeoutRef.current) clearTimeout(flipTimeoutRef.current);
    };
  }, [influence.revealed, influence.character]);

  return { flipping, flipFront };
}

function CardPreviewModal({ character, onClose }: { character: Character; onClose: () => void }) {
  const Icon = CHARACTER_SVG_ICONS[character];

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className={`rounded-2xl border-2 p-6 flex flex-col items-center gap-3 max-w-[200px] w-full
          ${characterColors[character]} bg-coup-surface shadow-xl`}
        onClick={e => e.stopPropagation()}
      >
        <Icon size={72} />
        <h3 className="text-lg font-bold text-white">{character}</h3>
        <p className="text-xs text-gray-300 text-center leading-relaxed">
          {CHARACTER_DESCRIPTIONS[character]}
        </p>
        <button
          className="mt-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>,
    document.body,
  );
}

interface CardFaceProps {
  influence: ClientInfluence;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  selected?: boolean;
  /** Disable the click-to-preview behavior */
  disablePreview?: boolean;
}

export function CardFace({ influence, size = 'md', onClick, selected, disablePreview }: CardFaceProps) {
  const [showPreview, setShowPreview] = useState(false);
  const sizeClass = `card-face-${size}`;
  const iconPx = iconPixelSizes[size];
  const { flipping, flipFront } = useCardFlip(influence);

  // Auto-close preview when game state changes (phase transitions, etc.)
  // This prevents the modal from blocking game interactions
  const turnPhase = useGameStore(s => s.gameState?.turnPhase);
  useEffect(() => {
    setShowPreview(false);
  }, [turnPhase]);

  const closePreview = useCallback(() => setShowPreview(false), []);

  // Cards with a known character but no external onClick get click-to-preview
  const canPreview = !disablePreview && !onClick && !!influence.character;

  const flipClass = flipping ? 'animate-card-flip-reveal' : '';

  if (influence.revealed && influence.character) {
    const Icon = CHARACTER_SVG_ICONS[influence.character];
    return (
      <>
        <div className={`card-flip-wrapper ${sizeClass}`}>
          <div
            title={influence.character}
            className={`card-face ${sizeClass} ${characterColors[influence.character]} card-face-revealed
              ${canPreview ? 'cursor-pointer' : ''} ${flipClass}`}
            onClick={canPreview ? () => setShowPreview(true) : undefined}
          >
            <Icon size={iconPx} />
          </div>
          {/* Back face shown during first half of flip animation */}
          {flipping && flipFront === 'face' && (
            <div className={`card-face ${sizeClass} ${characterColors[influence.character]} card-flip-back-face ${flipClass}`}>
              <Icon size={iconPx} />
            </div>
          )}
        </div>
        {showPreview && <CardPreviewModal character={influence.character} onClose={closePreview} />}
      </>
    );
  }

  if (influence.character) {
    const Icon = CHARACTER_SVG_ICONS[influence.character];
    return (
      <>
        <div className={`card-flip-wrapper ${sizeClass}`}>
          <div
            title={influence.character}
            className={`card-face ${sizeClass} ${characterColors[influence.character]}
              ${onClick ? 'cursor-pointer hover:scale-105' : ''}
              ${canPreview ? 'cursor-pointer hover:scale-105' : ''}
              ${selected ? 'ring-2 ring-coup-accent scale-105' : ''} ${flipClass}`}
            onClick={onClick ?? (canPreview ? () => setShowPreview(true) : undefined)}
          >
            <Icon size={iconPx} />
          </div>
          {/* Card back shown during first half when flipping from back→face */}
          {flipping && flipFront === 'back' && (
            <div className={`card-face ${sizeClass} border-gray-600 bg-coup-surface card-back card-flip-back-face ${flipClass}`}>
              <CardBack size={iconPx} />
            </div>
          )}
        </div>
        {showPreview && <CardPreviewModal character={influence.character} onClose={closePreview} />}
      </>
    );
  }

  return (
    <div className={`card-flip-wrapper ${sizeClass}`}>
      <div className={`card-face ${sizeClass} border-gray-600 bg-coup-surface card-back`}>
        <CardBack size={iconPx} />
      </div>
    </div>
  );
}
