'use client';

import { ActionType, ClientGameState, TurnPhase } from '@/shared/types';
import { ACTION_DEFINITIONS, ACTION_DISPLAY_NAMES } from '@/shared/constants';
import { Timer } from '../ui/Timer';
import { getSocket } from '../../hooks/useSocket';
import { haptic, hapticHeavy } from '../../utils/haptic';

interface ChallengePromptProps {
  gameState: ClientGameState;
}

export function ChallengePrompt({ gameState }: ChallengePromptProps) {
  const socket = getSocket();
  const { turnPhase, pendingAction, challengeState, myId } = gameState;

  if (turnPhase !== TurnPhase.AwaitingActionChallenge || !pendingAction || !challengeState) {
    return null;
  }

  const me = gameState.players.find(p => p.id === myId);
  if (!me || !me.isAlive) return null;

  const actor = gameState.players.find(p => p.id === pendingAction.actorId);
  const target = pendingAction.targetId
    ? gameState.players.find(p => p.id === pendingAction.targetId)
    : null;
  const def = ACTION_DEFINITIONS[pendingAction.type];

  // Actor sees waiting state
  if (myId === pendingAction.actorId) {
    const isMyEmbezzle = pendingAction.type === ActionType.Embezzle;
    return (
      <div className="prompt-info">
        <p className="text-center text-gray-300 mb-1">
          {isMyEmbezzle
            ? <>You want to <span className="text-coup-accent font-bold">Embezzle</span> (claiming no Duke)</>
            : <>You claimed <span className="text-coup-accent font-bold">{pendingAction.claimedCharacter}</span> to {ACTION_DISPLAY_NAMES[pendingAction.type]}
              {target && <> on <span className="font-bold">{target.name}</span></>}</>
          }
        </p>
        <p className="text-center text-gray-500 text-xs">Waiting for others to accept or challenge...</p>
        <Timer expiresAt={gameState.timerExpiry} />
      </div>
    );
  }

  // Already passed
  if (challengeState.passedPlayerIds.includes(myId)) {
    return (
      <div className="prompt-info">
        <p className="text-center text-gray-400 text-sm">
          You passed on challenging. Waiting for others...
        </p>
        <Timer expiresAt={gameState.timerExpiry} />
      </div>
    );
  }

  // Actionable: can challenge or pass
  const isEmbezzle = pendingAction.type === ActionType.Embezzle;
  const actionDesc = isEmbezzle
    ? `${actor?.name} wants to Embezzle (claims no Duke)`
    : target
      ? `${actor?.name} claims ${pendingAction.claimedCharacter} to ${ACTION_DISPLAY_NAMES[pendingAction.type]} ${target.name}`
      : `${actor?.name} claims ${pendingAction.claimedCharacter} to ${ACTION_DISPLAY_NAMES[pendingAction.type]}`;

  return (
    <div className="prompt-action">
      <p className="text-center text-white font-bold mb-1">
        {actionDesc}
      </p>
      <p className="text-center text-gray-400 text-xs mb-2">
        {isEmbezzle
          ? 'Think they actually have a Duke? Challenge to prove it!'
          : 'Do you think they\u0027re bluffing? Challenge to call them out!'}
      </p>
      <Timer expiresAt={gameState.timerExpiry} />
      <div className="flex gap-3 mt-3">
        <button
          className="btn-danger flex-1"
          onClick={() => { hapticHeavy(); socket.emit('game:challenge'); }}
        >
          Challenge!
        </button>
        <button
          className="btn-secondary flex-1"
          onClick={() => { haptic(80); socket.emit('game:pass_challenge'); }}
        >
          Let it go
        </button>
      </div>
    </div>
  );
}
