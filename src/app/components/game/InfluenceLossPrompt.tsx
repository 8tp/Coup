'use client';

import type { ReactNode } from 'react';
import { Character, ClientGameState, InfluenceLossRequest, TurnPhase } from '@/shared/types';
import { characterName, useT } from '../../i18n';
import { playerName } from './tableText';
import { CardFace } from './CardFace';
import { Timer } from '../ui/Timer';
import { getSocket } from '../../hooks/useSocket';
import { hapticHeavy } from '../../utils/haptic';
import { usePendingAnswer } from '../../hooks/usePendingAnswer';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { SHORT_DESKTOP_QUERY } from './table/seatLayout';

interface InfluenceLossPromptProps {
  gameState: ClientGameState;
}

type LossReason = InfluenceLossRequest['reason'];
const LOSS_REASONS: ReadonlySet<string> = new Set<LossReason>([
  'coup', 'assassination', 'challenge_lost', 'challenge_failed_defense', 'embezzle_failed',
]);

function isLossReason(reason: unknown): reason is LossReason {
  return typeof reason === 'string' && LOSS_REASONS.has(reason);
}

export function InfluenceLossPrompt({ gameState }: InfluenceLossPromptProps) {
  const t = useT();
  const socket = getSocket();
  const { pending, answer } = usePendingAnswer(gameState);
  // A short desktop has no height to spare between the far seats and your hand.
  const shortDesktop = useMediaQuery(SHORT_DESKTOP_QUERY);
  const { turnPhase, influenceLossRequest, myId } = gameState;

  if (turnPhase !== TurnPhase.AwaitingInfluenceLoss || !influenceLossRequest) return null;

  const reason = isLossReason(influenceLossRequest.reason) ? influenceLossRequest.reason : null;

  if (influenceLossRequest.playerId !== myId) {
    const loser = gameState.players.find(p => p.id === influenceLossRequest.playerId);
    const spectatorReason = reason ? t(`prompts.lossWatch.${reason}`) : t('prompts.lossWatch.default');
    return (
      <div className="prompt-info">
        <p className="text-center text-gray-300 text-sm">
          {t.rich('prompts.mustChoose', {
            name: playerName(loser?.name),
            b: (chunks: ReactNode) => <span className="font-bold">{chunks}</span>,
          })}
        </p>
        <p className="text-center text-coup-ink-mute text-xs mt-1">
          {spectatorReason}
        </p>
      </div>
    );
  }

  const me = gameState.players.find(p => p.id === myId);
  if (!me) return null;

  const unrevealed = me.influences
    .map((inf, i) => ({ inf, index: i }))
    .filter(({ inf }) => !inf.revealed);

  const reasonText = reason === 'embezzle_failed'
    ? t('prompts.loss.embezzle_failed', { character: characterName(t, Character.Duke) })
    : reason
      ? t(`prompts.loss.${reason}`)
      : t('prompts.loss.default');

  return (
    <div className="prompt-urgent">
      <Timer expiresAt={gameState.timerExpiry} />
      <p className="text-center text-red-300 font-bold text-lg mb-1">
        {reasonText}
      </p>
      <p className="text-center text-gray-400 text-xs mb-3">
        {t('prompts.tapToLose')}
      </p>
      <div className="flex gap-4 justify-center">
        {unrevealed.map(({ inf, index }) => (
          <button
            key={index}
            className="loss-choice transition-transform hover:scale-110 active:scale-95"
            data-pending={pending === `lose:${index}` || undefined}
            aria-busy={pending === `lose:${index}` || undefined}
            onClick={() => answer(`lose:${index}`, () => { hapticHeavy(); socket.emit('game:choose_influence_loss', { influenceIndex: index }); })}
          >
            <CardFace influence={inf} size={shortDesktop ? 'md' : 'lg'} disablePreview priority />
          </button>
        ))}
      </div>
    </div>
  );
}
