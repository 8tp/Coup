'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Character, ClientInfluence } from '@/shared/types';
import { CHARACTER_DESCRIPTIONS } from '@/shared/constants';
import { useGameStore } from '../../stores/gameStore';
import { CardArtwork, CardBackArtwork, CharacterCardBadge } from './CardArtwork';

const characterColors: Record<Character, string> = {
  [Character.Duke]: 'border-purple-500 bg-purple-900/40',
  [Character.Assassin]: 'border-gray-500 bg-gray-800/40',
  [Character.Captain]: 'border-blue-500 bg-blue-900/40',
  [Character.Ambassador]: 'border-green-500 bg-green-900/40',
  [Character.Contessa]: 'border-red-500 bg-red-900/40',
  [Character.Inquisitor]: 'border-teal-500 bg-teal-900/40',
};

type CardSize = 'sm' | 'md' | 'lg';

const cardSizeClasses: Record<CardSize, string> = {
  sm: 'card-face-sm',
  md: 'card-face-md',
  lg: 'card-face-lg',
};

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

function CardFaceImage({ character, variant = 'focus', priority = false }: { character: Character; variant?: 'full' | 'focus'; priority?: boolean }) {
  return (
    <>
      <CardArtwork character={character} variant={variant} priority={priority} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
      <CharacterCardBadge character={character} />
      <span className="sr-only">{character}</span>
    </>
  );
}

function CardBackImage({ priority = false }: { priority?: boolean }) {
  return (
    <>
      <CardBackArtwork variant="focus" priority={priority} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/10" />
      <span className="sr-only">Hidden influence</span>
    </>
  );
}

function CardPreviewModal({ character, onClose }: { character: Character; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4" onClick={onClose}>
      <div
        className={`rounded-2xl border-2 p-5 flex flex-col items-center gap-3 max-w-[260px] w-full
          ${characterColors[character]} !bg-coup-surface/95 shadow-xl backdrop-blur-sm`}
        onClick={e => e.stopPropagation()}
      >
        <div className={`card-preview-face relative h-64 w-44 max-w-full overflow-hidden rounded-xl border-2 ${characterColors[character]}`}>
          <CardFaceImage character={character} variant="full" />
        </div>
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
  size?: CardSize;
  onClick?: () => void;
  selected?: boolean;
  /** Disable the click-to-preview behavior */
  disablePreview?: boolean;
  /** Hint that this card is above-the-fold or immediately interactive. */
  priority?: boolean;
}

export function CardFace({ influence, size = 'md', onClick, selected, disablePreview, priority = false }: CardFaceProps) {
  const [showPreview, setShowPreview] = useState(false);
  const sizeClass = cardSizeClasses[size];
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
    return (
      <>
        <div className={`card-flip-wrapper ${sizeClass}`}>
          <div
            title={influence.character}
            className={`card-face ${sizeClass} ${characterColors[influence.character]} card-face-revealed
              ${canPreview ? 'cursor-pointer' : ''} ${flipClass}`}
            onClick={canPreview ? () => setShowPreview(true) : undefined}
          >
            <CardFaceImage character={influence.character} priority={priority} />
          </div>
          {/* Back face shown during first half of flip animation */}
          {flipping && flipFront === 'face' && (
            <div className={`card-face ${sizeClass} ${characterColors[influence.character]} card-flip-back-face ${flipClass}`}>
              <CardFaceImage character={influence.character} priority={priority} />
            </div>
          )}
        </div>
        {showPreview && <CardPreviewModal character={influence.character} onClose={closePreview} />}
      </>
    );
  }

  if (influence.character) {
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
            <CardFaceImage character={influence.character} priority={priority} />
          </div>
          {/* Card back shown during first half when flipping from back→face */}
          {flipping && flipFront === 'back' && (
            <div className={`card-face ${sizeClass} border-gray-600 bg-coup-surface card-back card-flip-back-face ${flipClass}`}>
              <CardBackImage priority={priority} />
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
        <CardBackImage priority={priority} />
      </div>
    </div>
  );
}
