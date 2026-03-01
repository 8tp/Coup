'use client';

import { ClientGameState, TurnPhase } from '@/shared/types';
import { CardFace } from './CardFace';
import { Timer } from '../ui/Timer';
import { getSocket } from '../../hooks/useSocket';
import { hapticHeavy } from '../../utils/haptic';

interface InfluenceLossPromptProps {
  gameState: ClientGameState;
}

const REASON_LABELS: Record<string, string> = {
  coup: 'You were couped!',
  assassination: 'You are being assassinated!',
  challenge_lost: 'You lost the challenge!',
  challenge_failed_defense: 'Your bluff was called!',
};

const SPECTATOR_REASON_LABELS: Record<string, string> = {
  coup: 'Coup',
  assassination: 'Assassination',
  challenge_lost: 'Lost challenge',
  challenge_failed_defense: 'Caught bluffing',
};

export function InfluenceLossPrompt({ gameState }: InfluenceLossPromptProps) {
  const socket = getSocket();
  const { turnPhase, influenceLossRequest, myId } = gameState;

  if (turnPhase !== TurnPhase.AwaitingInfluenceLoss || !influenceLossRequest) return null;

  if (influenceLossRequest.playerId !== myId) {
    const loser = gameState.players.find(p => p.id === influenceLossRequest.playerId);
    const spectatorReason = SPECTATOR_REASON_LABELS[influenceLossRequest.reason] || 'Must lose an influence';
    return (
      <div className="prompt-info">
        <p className="text-center text-gray-300 text-sm">
          <span className="font-bold">{loser?.name}</span> must choose an influence to lose.
        </p>
        <p className="text-center text-gray-500 text-xs mt-1">
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

  const reasonText = REASON_LABELS[influenceLossRequest.reason] || 'Choose an influence to lose';

  return (
    <div className="prompt-urgent">
      <Timer expiresAt={gameState.timerExpiry} />
      <p className="text-center text-red-300 font-bold text-lg mb-1">
        {reasonText}
      </p>
      <p className="text-center text-gray-400 text-xs mb-3">
        Tap a card to reveal and lose it
      </p>
      <div className="flex gap-4 justify-center">
        {unrevealed.map(({ inf, index }) => (
          <button
            key={index}
            className="transition-transform hover:scale-110 active:scale-95"
            onClick={() => { hapticHeavy(); socket.emit('game:choose_influence_loss', { influenceIndex: index }); }}
          >
            <CardFace influence={inf} size="lg" disablePreview />
          </button>
        ))}
      </div>
    </div>
  );
}
