'use client';

import { ClientGameState, TurnPhase } from '@/shared/types';

interface WaitingViewProps {
  gameState: ClientGameState;
}

export function WaitingView({ gameState }: WaitingViewProps) {
  const { turnPhase, myId, players, currentPlayerIndex } = gameState;

  // Don't show during game over
  if (turnPhase === TurnPhase.GameOver) return null;

  const me = players.find(p => p.id === myId);
  const currentPlayer = players[currentPlayerIndex];

  // Show eliminated message
  if (me && !me.isAlive) {
    return (
      <div className="prompt-info">
        <p className="text-center text-gray-400 text-sm">
          You have been eliminated. Watching the game...
        </p>
      </div>
    );
  }

  // Show waiting message when it's not your turn and you have no prompt
  if (turnPhase === TurnPhase.AwaitingAction && currentPlayer?.id !== myId) {
    return (
      <div className="prompt-info">
        <p className="text-center text-gray-400 text-sm">
          Waiting for <span className="font-bold text-gray-300">{currentPlayer?.name}</span> to choose an action...
        </p>
      </div>
    );
  }

  // Show waiting message during examine phase for non-examiners
  if (turnPhase === TurnPhase.AwaitingExamineDecision && gameState.examineState) {
    const examiner = players.find(p => p.id === gameState.pendingAction?.actorId);
    const target = players.find(p => p.id === gameState.examineState?.targetId);
    return (
      <div className="prompt-info">
        <p className="text-center text-gray-400 text-sm">
          <span className="font-bold text-gray-300">{examiner?.name}</span> is examining{' '}
          <span className="font-bold text-gray-300">{target?.name}</span>&apos;s card...
        </p>
      </div>
    );
  }

  return null;
}
