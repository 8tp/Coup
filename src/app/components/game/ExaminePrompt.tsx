'use client';

import { ClientGameState, TurnPhase } from '@/shared/types';
import { Timer } from '../ui/Timer';
import { getSocket } from '../../hooks/useSocket';
import { haptic, hapticHeavy } from '../../utils/haptic';
import { usePendingAnswer } from '../../hooks/usePendingAnswer';
import { CardArtwork, CharacterCardBadge } from './CardArtwork';
import { useT } from '../../i18n';
import { playerName } from './tableText';

interface ExaminePromptProps {
  gameState: ClientGameState;
}

export function ExaminePrompt({ gameState }: ExaminePromptProps) {
  const t = useT();
  const socket = getSocket();
  const { pending, answer } = usePendingAnswer(gameState);
  const { examineState, turnPhase } = gameState;

  if (!examineState || turnPhase !== TurnPhase.AwaitingExamineDecision) return null;

  const target = gameState.players.find(p => p.id === examineState.targetId);

  return (
    <div className="prompt-action">
      <Timer expiresAt={gameState.timerExpiry} />
      {/* One column on a phone. In the middle of the desktop table the card
          sits beside the words and the buttons (globals.css), so the prompt
          fits between the far seats and your hand on a 720px laptop. */}
      <div className="examine-body">
        <div className="examine-card relative h-32 w-24 overflow-hidden rounded-xl border-2 border-teal-500 bg-teal-900/40">
          <CardArtwork character={examineState.revealedCard} variant="focus" priority />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
          <CharacterCardBadge character={examineState.revealedCard} />
        </div>
        <div className="examine-text">
          <p className="text-white font-bold">
            {t.rich('prompts.examinedCard', { name: playerName(target?.name) })}
          </p>
          <p className="text-gray-400 text-xs">
            {t('prompts.forceSwapHint')}
          </p>
          <div className="flex gap-2 w-full">
            <button
              className="btn-secondary flex-1"
              data-pending={pending === 'return' || undefined}
              aria-busy={pending === 'return' || undefined}
              onClick={() => answer('return', () => {
                haptic(80);
                socket.emit('game:examine_decision', { forceSwap: false });
              })}
            >
              {t('prompts.examineReturn')}
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
              {t('prompts.forceSwap')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
