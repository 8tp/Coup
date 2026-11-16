'use client';

import { ClientGameState, TurnPhase } from '@/shared/types';
import { Timer } from '../ui/Timer';
import { getSocket } from '../../hooks/useSocket';
import { haptic, hapticHeavy } from '../../utils/haptic';
import { usePendingAnswer } from '../../hooks/usePendingAnswer';
import { CardArtwork, CharacterCardBadge } from './CardArtwork';

interface ExaminePromptProps {
  gameState: ClientGameState;
}

export function ExaminePrompt({ gameState }: ExaminePromptProps) {
  const socket = getSocket();
  const { pending, answer } = usePendingAnswer(gameState);
  const { examineState, turnPhase } = gameState;

  if (!examineState || turnPhase !== TurnPhase.AwaitingExamineDecision) return null;

  const target = gameState.players.find(p => p.id === examineState.targetId);

  return (
    <div className="prompt-action">
      <Timer expiresAt={gameState.timerExpiry} />
      <p className="text-center text-white font-bold mb-2">
        {target?.name}&apos;s card
      </p>
      <div className="flex justify-center mb-3">
        <div className="relative h-32 w-24 overflow-hidden rounded-xl border-2 border-teal-500 bg-teal-900/40">
          <CardArtwork character={examineState.revealedCard} variant="focus" priority />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
          <CharacterCardBadge character={examineState.revealedCard} />
        </div>
      </div>
      <p className="text-center text-gray-400 text-xs mb-3">
        Force Swap sends it to the deck and they draw a new card.
      </p>
      <div className="flex gap-2">
        <button
          className="btn-secondary flex-1"
          data-pending={pending === 'return' || undefined}
          aria-busy={pending === 'return' || undefined}
          onClick={() => answer('return', () => {
            haptic(80);
            socket.emit('game:examine_decision', { forceSwap: false });
          })}
        >
          Return
        </button>
        <button
          className="btn-primary flex-1"
          data-pending={pending === 'swap' || undefined}
          aria-busy={pending === 'swap' || undefined}
          onClick={() => answer('swap', () => {
            hapticHeavy();
            socket.emit('game:examine_decision', { forceSwap: true });
          })}
        >
          Force Swap
        </button>
      </div>
    </div>
  );
}
