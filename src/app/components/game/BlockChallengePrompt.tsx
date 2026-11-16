'use client';

import type { ReactNode } from 'react';
import { ClientGameState, TurnPhase } from '@/shared/types';
import { Timer } from '../ui/Timer';
import { remainingChallengeNames } from './PhaseStatus';
import { getSocket } from '../../hooks/useSocket';
import { haptic, hapticHeavy } from '../../utils/haptic';
import { usePendingAnswer } from '../../hooks/usePendingAnswer';
import { actionName, characterName, useT } from '../../i18n';
import { nameList, playerName } from './tableText';

interface BlockChallengePromptProps {
  gameState: ClientGameState;
}

export function BlockChallengePrompt({ gameState }: BlockChallengePromptProps) {
  const t = useT();
  const socket = getSocket();
  const { pending, answer } = usePendingAnswer(gameState);
  const { turnPhase, pendingAction, pendingBlock, challengeState, myId } = gameState;

  if (turnPhase !== TurnPhase.AwaitingBlockChallenge || !pendingBlock || !challengeState) {
    return null;
  }

  const me = gameState.players.find(p => p.id === myId);
  if (!me || !me.isAlive) return null;

  const blocker = gameState.players.find(p => p.id === pendingBlock.blockerId);
  const waitingNames = remainingChallengeNames(gameState, pendingBlock.blockerId);
  const waitingOn = { count: waitingNames.length, names: nameList(t, waitingNames) };
  const character = characterName(t, pendingBlock.claimedCharacter);

  // Blocker sees waiting message (can't challenge own block)
  if (myId === pendingBlock.blockerId) {
    return (
      <div className="prompt-info">
        <p className="prompt-claim text-center text-gray-300 text-sm mb-1">
          {t.rich('prompts.youClaimedBlock', {
            character,
            c: (chunks: ReactNode) => <span className="text-coup-accent font-bold">{chunks}</span>,
          })}
        </p>
        <p className="text-center text-gray-400 text-sm">
          {t.rich('prompts.waitingChallenge', waitingOn)}
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
          {t.rich('prompts.acceptedWaiting', waitingOn)}
        </p>
        <Timer expiresAt={gameState.timerExpiry} />
      </div>
    );
  }

  const claimParams = {
    blocker: playerName(blocker?.name),
    character,
    c: (chunks: ReactNode) => <span className="text-coup-accent">{chunks}</span>,
  };

  // All other alive players can challenge or accept the block
  return (
    <div className="prompt-action">
      <p className="prompt-claim text-center text-white font-bold mb-1">
        {pendingAction
          ? t.rich('prompts.blockClaim', { ...claimParams, action: actionName(t, pendingAction.type) })
          : t.rich('prompts.blockClaimPlain', claimParams)}
      </p>
      <p className="prompt-hint text-center text-gray-400 text-xs mb-2">
        {t('prompts.bluffHint')}
      </p>
      <Timer expiresAt={gameState.timerExpiry} />
      <div className="flex gap-3 mt-3">
        <button
          className="btn-danger flex-1"
          data-pending={pending === 'challenge' || undefined}
          aria-busy={pending === 'challenge' || undefined}
          onClick={() => answer('challenge', () => { hapticHeavy(); socket.emit('game:challenge_block'); })}
        >
          {t('prompts.challenge')}
        </button>
        <button
          className="btn-secondary flex-1"
          data-pending={pending === 'pass' || undefined}
          aria-busy={pending === 'pass' || undefined}
          onClick={() => answer('pass', () => { haptic(80); socket.emit('game:pass_challenge_block'); })}
        >
          {t('prompts.pass')}
        </button>
      </div>
    </div>
  );
}
