'use client';

import { ClientGameState, TurnPhase } from '@/shared/types';
import { ACTION_DISPLAY_NAMES } from '@/shared/constants';
import { Timer } from '../ui/Timer';
import { formatNames, remainingChallengeNames } from './PhaseStatus';
import { getSocket } from '../../hooks/useSocket';
import { haptic, hapticHeavy } from '../../utils/haptic';
import { usePendingAnswer } from '../../hooks/usePendingAnswer';

interface BlockChallengePromptProps {
  gameState: ClientGameState;
}

export function BlockChallengePrompt({ gameState }: BlockChallengePromptProps) {
  const socket = getSocket();
  const { pending, answer } = usePendingAnswer(gameState);
  const { turnPhase, pendingAction, pendingBlock, challengeState, myId } = gameState;

  if (turnPhase !== TurnPhase.AwaitingBlockChallenge || !pendingBlock || !challengeState) {
    return null;
  }

  const me = gameState.players.find(p => p.id === myId);
  if (!me || !me.isAlive) return null;

  const blocker = gameState.players.find(p => p.id === pendingBlock.blockerId);
  const waitingOn = formatNames(remainingChallengeNames(gameState, pendingBlock.blockerId));

  // Blocker sees waiting message (can't challenge own block)
  if (myId === pendingBlock.blockerId) {
    return (
      <div className="prompt-info">
        <p className="prompt-claim text-center text-gray-300 text-sm mb-1">
          You claimed <span className="text-coup-accent font-bold">{pendingBlock.claimedCharacter}</span> to block.
        </p>
        <p className="text-center text-gray-400 text-sm">
          Waiting for {waitingOn} to challenge or pass.
        </p>
        <Timer expiresAt={gameState.timerExpiry} />
      </div>
    );
  }

  // Already passed
  if (challengeState.passedPlayerIds.includes(myId)) {
    return (
      <div className="prompt-info">
        <p className="text-center text-gray-400 text-sm">
          You accepted the block. Waiting for {waitingOn}.
        </p>
        <Timer expiresAt={gameState.timerExpiry} />
      </div>
    );
  }

  // All other alive players can challenge or accept the block
  return (
    <div className="prompt-action">
      <p className="prompt-claim text-center text-white font-bold mb-1">
        {blocker?.name} claims <span className="text-coup-accent">{pendingBlock.claimedCharacter}</span> to block{pendingAction ? ` the ${ACTION_DISPLAY_NAMES[pendingAction.type]}` : ''}
      </p>
      <p className="prompt-hint text-center text-gray-400 text-xs mb-2">
        Challenge if you think they&apos;re bluffing. If they aren&apos;t, you lose a card.
      </p>
      <Timer expiresAt={gameState.timerExpiry} />
      <div className="flex gap-3 mt-3">
        <button
          className="btn-danger flex-1"
          data-pending={pending === 'challenge' || undefined}
          aria-busy={pending === 'challenge' || undefined}
          onClick={() => answer('challenge', () => { hapticHeavy(); socket.emit('game:challenge_block'); })}
        >
          Challenge
        </button>
        <button
          className="btn-secondary flex-1"
          data-pending={pending === 'pass' || undefined}
          aria-busy={pending === 'pass' || undefined}
          onClick={() => answer('pass', () => { haptic(80); socket.emit('game:pass_challenge_block'); })}
        >
          Pass
        </button>
      </div>
    </div>
  );
}
