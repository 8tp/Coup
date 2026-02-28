'use client';

import { ClientGameState, TurnPhase } from '@/shared/types';
import { ACTION_DEFINITIONS } from '@/shared/constants';
import { Timer } from '../ui/Timer';
import { getSocket } from '../../hooks/useSocket';

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
    return (
      <div className="prompt-info">
        <p className="text-center text-gray-300 mb-1">
          You claimed <span className="text-coup-accent font-bold">{pendingAction.claimedCharacter}</span> to {pendingAction.type}
          {target && <> on <span className="font-bold">{target.name}</span></>}
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
  const actionDesc = target
    ? `${actor?.name} claims ${pendingAction.claimedCharacter} to ${pendingAction.type} ${target.name}`
    : `${actor?.name} claims ${pendingAction.claimedCharacter} to ${pendingAction.type}`;

  return (
    <div className="prompt-action">
      <p className="text-center text-white font-bold mb-1">
        {actionDesc}
      </p>
      <p className="text-center text-gray-400 text-xs mb-2">
        Do you think they&apos;re bluffing? Challenge to call them out!
      </p>
      <Timer expiresAt={gameState.timerExpiry} />
      <div className="flex gap-3 mt-3">
        <button
          className="btn-danger flex-1"
          onClick={() => socket.emit('game:challenge')}
        >
          Challenge!
        </button>
        <button
          className="btn-secondary flex-1"
          onClick={() => socket.emit('game:pass_challenge')}
        >
          Let it go
        </button>
      </div>
    </div>
  );
}
