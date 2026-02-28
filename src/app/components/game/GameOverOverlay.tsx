'use client';

import { ClientGameState, TurnPhase } from '@/shared/types';
import { useGameStore } from '../../stores/gameStore';
import { CardFace } from './CardFace';

interface GameOverOverlayProps {
  gameState: ClientGameState;
  isHost: boolean;
  onRematch: () => void;
}

export function GameOverOverlay({ gameState, isHost, onRematch }: GameOverOverlayProps) {
  const challengeReveal = useGameStore(s => s.challengeReveal);

  // Wait for any challenge reveal animation to finish before showing
  if (gameState.turnPhase !== TurnPhase.GameOver || challengeReveal) return null;

  const winner = gameState.players.find(p => p.id === gameState.winnerId);
  const isMe = winner?.id === gameState.myId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 animate-fade-in p-4">
      <div className="text-center bg-coup-surface rounded-2xl p-8 border border-gray-700 max-w-sm w-full max-h-[90vh] overflow-y-auto">
        <div className="text-5xl mb-4">{isMe ? '🏆' : '💀'}</div>
        <h1 className="text-3xl font-bold mb-2">
          {isMe ? 'You Win!' : `${winner?.name} Wins!`}
        </h1>
        <p className="text-lg text-coup-accent mb-4">
          {isMe ? 'Your bluffs were legendary.' : 'Better luck next time.'}
        </p>
        <p className="text-gray-400 text-sm mb-4">
          Game lasted {gameState.turnNumber} turns
        </p>

        {/* All players' cards revealed */}
        <div className="space-y-2 mb-6">
          {gameState.players.map(p => (
            <div key={p.id} className="flex items-center gap-2 justify-center">
              <span className={`text-xs font-medium w-20 text-right truncate ${
                p.id === gameState.winnerId ? 'text-coup-accent' : 'text-gray-400'
              }`}>
                {p.id === gameState.myId ? 'You' : p.name}
              </span>
              <div className="flex gap-1">
                {p.influences.map((inf, i) => (
                  <CardFace key={i} influence={inf} size="sm" />
                ))}
              </div>
            </div>
          ))}
        </div>

        {isHost ? (
          <button
            className="btn-primary w-full"
            onClick={onRematch}
          >
            Play Again
          </button>
        ) : (
          <p className="text-gray-500 text-sm">
            Waiting for host to start rematch...
          </p>
        )}
      </div>
    </div>
  );
}
