'use client';

import { useState, useEffect } from 'react';
import { Character, ClientInfluence } from '@/shared/types';
import { CHARACTER_DESCRIPTIONS } from '@/shared/constants';
import { CHARACTER_SVG_ICONS, CardBack } from '../icons';

const characterColors: Record<Character, string> = {
  [Character.Duke]: 'border-purple-500 bg-purple-900/40',
  [Character.Assassin]: 'border-gray-500 bg-gray-800/40',
  [Character.Captain]: 'border-blue-500 bg-blue-900/40',
  [Character.Ambassador]: 'border-green-500 bg-green-900/40',
  [Character.Contessa]: 'border-red-500 bg-red-900/40',
};

const iconPixelSizes = { sm: 28, md: 36, lg: 48 } as const;

function CardPreviewModal({ character, onClose }: { character: Character; onClose: () => void }) {
  const Icon = CHARACTER_SVG_ICONS[character];

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
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
    </div>
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

  // Cards with a known character but no external onClick get click-to-preview
  const canPreview = !disablePreview && !onClick && !!influence.character;

  if (influence.revealed && influence.character) {
    const Icon = CHARACTER_SVG_ICONS[influence.character];
    return (
      <>
        <div
          title={influence.character}
          className={`card-face ${sizeClass} ${characterColors[influence.character]} card-face-revealed
            ${canPreview ? 'cursor-pointer' : ''}`}
          onClick={canPreview ? () => setShowPreview(true) : undefined}
        >
          <Icon size={iconPx} />
        </div>
        {showPreview && <CardPreviewModal character={influence.character} onClose={() => setShowPreview(false)} />}
      </>
    );
  }

  if (influence.character) {
    const Icon = CHARACTER_SVG_ICONS[influence.character];
    return (
      <>
        <div
          title={influence.character}
          className={`card-face ${sizeClass} ${characterColors[influence.character]}
            ${onClick ? 'cursor-pointer hover:scale-105' : ''}
            ${canPreview ? 'cursor-pointer hover:scale-105' : ''}
            ${selected ? 'ring-2 ring-coup-accent scale-105' : ''}`}
          onClick={onClick ?? (canPreview ? () => setShowPreview(true) : undefined)}
        >
          <Icon size={iconPx} />
        </div>
        {showPreview && <CardPreviewModal character={influence.character} onClose={() => setShowPreview(false)} />}
      </>
    );
  }

  return (
    <div className={`card-face ${sizeClass} border-gray-600 bg-coup-surface card-back`}>
      <CardBack size={iconPx} />
    </div>
  );
}
