'use client';

import { ActionType, ClientGameState, TurnPhase } from '@/shared/types';
import { ACTION_DISPLAY_NAMES } from '@/shared/constants';
import { formatNames, remainingChallengeNames } from './PhaseStatus';
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
  const targetName = !pendingAction.targetId
    ? null
    : pendingAction.targetId === myId
      ? 'you'
      : gameState.players.find(p => p.id === pendingAction.targetId)?.name ?? null;
  const isEmbezzle = pendingAction.type === ActionType.Embezzle;
  const action = ACTION_DISPLAY_NAMES[pendingAction.type];
  const waitingOn = formatNames(remainingChallengeNames(gameState, pendingAction.actorId));

  /* `.prompt-claim` restates the claim for a phone, where this prompt sits in
     the bottom sheet and can cover the plaque. On the desktop table the plaque
     sits right above the prompt, so globals.css hides the line there. */

  // Actor sees waiting state
  if (myId === pendingAction.actorId) {
    return (
      <div className="prompt-info">
        <p className="prompt-claim text-center text-gray-300 mb-1">
          {isEmbezzle
            ? <>You claimed <span className="text-coup-accent font-bold">no Duke</span> to Embezzle</>
            : <>You claimed <span className="text-coup-accent font-bold">{pendingAction.claimedCharacter}</span> to {action}
              {targetName && <> on <span className="font-bold">{targetName}</span></>}</>
          }
        </p>
        <p className="text-center text-coup-ink-mute text-sm">Waiting for {waitingOn} to challenge or pass.</p>
        <Timer expiresAt={gameState.timerExpiry} />
      </div>
    );
  }

  // Already passed
  if (challengeState.passedPlayerIds.includes(myId)) {
    return (
      <div className="prompt-info">
        <p className="text-center text-gray-400 text-sm">
          You passed. Waiting for {waitingOn}.
        </p>
        <Timer expiresAt={gameState.timerExpiry} />
      </div>
    );
  }

  // Actionable: can challenge or pass
  const actionDesc = isEmbezzle
    ? `${actor?.name} claims no Duke to Embezzle`
    : targetName
      ? `${actor?.name} claims ${pendingAction.claimedCharacter} to ${action} ${pendingAction.type === ActionType.Steal ? 'from ' : ''}${targetName}`
      : `${actor?.name} claims ${pendingAction.claimedCharacter} to ${action}`;

  return (
    <div className="prompt-action">
      <p className="prompt-claim text-center text-white font-bold mb-1">
        {actionDesc}
      </p>
      <p className="prompt-hint text-center text-gray-400 text-xs mb-2">
        {isEmbezzle
          ? 'Challenge if you think they have a Duke. If they don\u0027t, you lose a card.'
          : 'Challenge if you think they\u0027re bluffing. If they aren\u0027t, you lose a card.'}
      </p>
      <Timer expiresAt={gameState.timerExpiry} />
      <div className="flex gap-3 mt-3">
        <button
          className="btn-danger flex-1"
          onClick={() => { hapticHeavy(); socket.emit('game:challenge'); }}
        >
          Challenge
        </button>
        <button
          className="btn-secondary flex-1"
          onClick={() => { haptic(80); socket.emit('game:pass_challenge'); }}
        >
          Pass
        </button>
      </div>
    </div>
  );
}
