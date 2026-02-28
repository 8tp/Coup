'use client';

import { ClientGameState, TurnPhase } from '@/shared/types';
import { Timer } from '../ui/Timer';
import { getSocket } from '../../hooks/useSocket';

interface BlockChallengePromptProps {
  gameState: ClientGameState;
}

export function BlockChallengePrompt({ gameState }: BlockChallengePromptProps) {
  const socket = getSocket();
  const { turnPhase, pendingAction, pendingBlock, challengeState, myId } = gameState;

  if (turnPhase !== TurnPhase.AwaitingBlockChallenge || !pendingBlock || !challengeState) {
    return null;
  }

  const me = gameState.players.find(p => p.id === myId);
  if (!me || !me.isAlive) return null;

  const blocker = gameState.players.find(p => p.id === pendingBlock.blockerId);

  // Only the original actor can challenge a block
  if (myId !== pendingAction?.actorId) {
    // Blocker's own view
    if (myId === pendingBlock.blockerId) {
      return (
        <div className="prompt-info">
          <p className="text-center text-gray-300 text-sm">
            You claimed <span className="text-coup-accent font-bold">{pendingBlock.claimedCharacter}</span> to block.
            Waiting to see if they challenge...
          </p>
          <Timer expiresAt={gameState.timerExpiry} />
        </div>
      );
    }

    return (
      <div className="prompt-info">
        <p className="text-center text-gray-400 text-sm">
          <span className="font-bold">{blocker?.name}</span> blocks with{' '}
          <span className="text-coup-accent font-bold">{pendingBlock.claimedCharacter}</span>.
          Waiting for {gameState.players.find(p => p.id === pendingAction?.actorId)?.name} to respond...
        </p>
        <Timer expiresAt={gameState.timerExpiry} />
      </div>
    );
  }

  // Already passed
  if (challengeState.passedPlayerIds.includes(myId)) {
    return (
      <div className="prompt-info">
        <p className="text-center text-gray-400 text-sm">You accepted the block.</p>
      </div>
    );
  }

  // Actor can challenge the block
  return (
    <div className="prompt-action">
      <p className="text-center text-white font-bold mb-1">
        {blocker?.name} claims <span className="text-coup-accent">{pendingBlock.claimedCharacter}</span> to block your {pendingAction?.type}
      </p>
      <p className="text-center text-gray-400 text-xs mb-2">
        Think they&apos;re bluffing the block? Challenge them!
      </p>
      <Timer expiresAt={gameState.timerExpiry} />
      <div className="flex gap-3 mt-3">
        <button
          className="btn-danger flex-1"
          onClick={() => socket.emit('game:challenge_block')}
        >
          Challenge block!
        </button>
        <button
          className="btn-secondary flex-1"
          onClick={() => socket.emit('game:pass_challenge_block')}
        >
          Accept block
        </button>
      </div>
    </div>
  );
}
