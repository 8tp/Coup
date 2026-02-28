'use client';

import { useState } from 'react';
import { ClientGameState, TurnPhase, Character } from '@/shared/types';
import { CHARACTER_SVG_ICONS } from '../icons';
import { getSocket } from '../../hooks/useSocket';

const characterColors: Record<Character, string> = {
  [Character.Duke]: 'border-purple-500 bg-purple-900/40',
  [Character.Assassin]: 'border-gray-500 bg-gray-800/40',
  [Character.Captain]: 'border-blue-500 bg-blue-900/40',
  [Character.Ambassador]: 'border-green-500 bg-green-900/40',
  [Character.Contessa]: 'border-red-500 bg-red-900/40',
};

interface ExchangeViewProps {
  gameState: ClientGameState;
}

export function ExchangeView({ gameState }: ExchangeViewProps) {
  const socket = getSocket();
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const { turnPhase, exchangeState } = gameState;

  if (turnPhase !== TurnPhase.AwaitingExchange || !exchangeState) {
    return null;
  }

  if (exchangeState.availableCards.length === 0) {
    return (
      <div className="prompt-info">
        <p className="text-center text-gray-400 text-sm">Exchange in progress...</p>
      </div>
    );
  }

  const { availableCards, keepCount } = exchangeState;

  const toggleCard = (index: number) => {
    setSelectedIndices(prev => {
      if (prev.includes(index)) {
        return prev.filter(i => i !== index);
      }
      if (prev.length >= keepCount) {
        return [...prev.slice(1), index];
      }
      return [...prev, index];
    });
  };

  const handleConfirm = () => {
    socket.emit('game:choose_exchange', { keepIndices: selectedIndices });
  };

  return (
    <div className="prompt-action">
      <p className="text-center text-coup-accent font-bold text-lg mb-1">
        Ambassador Exchange
      </p>
      <p className="text-center text-gray-400 text-xs mb-4">
        Tap {keepCount} card{keepCount > 1 ? 's' : ''} to keep. The rest go back to the deck.
      </p>
      <div className="flex flex-wrap gap-3 justify-center mb-4">
        {availableCards.map((char, i) => {
          const Icon = CHARACTER_SVG_ICONS[char];
          return (
            <button
              key={i}
              className={`card-face card-face-lg ${characterColors[char]}
                ${selectedIndices.includes(i) ? 'ring-2 ring-coup-accent scale-105' : 'opacity-60'}
                transition-all cursor-pointer hover:scale-105`}
              onClick={() => toggleCard(i)}
            >
              <Icon size={36} />
              <span className="card-face-label">{char}</span>
            </button>
          );
        })}
      </div>
      <button
        className="btn-primary w-full"
        disabled={selectedIndices.length !== keepCount}
        onClick={handleConfirm}
      >
        Keep selected ({selectedIndices.length}/{keepCount})
      </button>
    </div>
  );
}
