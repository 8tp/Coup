'use client';

import { ClientGameState, TurnPhase } from '@/shared/types';

interface GameOverOverlayProps {
  gameState: ClientGameState;
}

export function GameOverOverlay({ gameState }: GameOverOverlayProps) {
  if (gameState.turnPhase !== TurnPhase.GameOver) return null;

  const winner = gameState.players.find(p => p.id === gameState.winnerId);
  const isMe = winner?.id === gameState.myId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 animate-fade-in p-4">
      <div className="text-center bg-coup-surface rounded-2xl p-8 border border-gray-700 max-w-sm w-full">
        <div className="text-5xl mb-4">{isMe ? '🏆' : '💀'}</div>
        <h1 className="text-3xl font-bold mb-2">
          {isMe ? 'You Win!' : `${winner?.name} Wins!`}
        </h1>
        <p className="text-lg text-coup-accent mb-6">
          {isMe ? 'Your bluffs were legendary.' : 'Better luck next time.'}
        </p>
        <p className="text-gray-400 text-sm">
          Game lasted {gameState.turnNumber} turns
        </p>
      </div>
    </div>
  );
}
