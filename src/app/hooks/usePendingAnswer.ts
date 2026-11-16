'use client';

import { useCallback } from 'react';
import type { ClientGameState } from '@/shared/types';
import { useGameStore } from '../stores/gameStore';
import { activePendingAnswer, decisionWindowKey } from '../utils/pendingAnswer';

/**
 * One answer per decision, held pressed until the server replies.
 * See utils/pendingAnswer.ts for why.
 *
 *   const { pending, answer } = usePendingAnswer(gameState);
 *   <button data-pending={pending === 'pass' || undefined}
 *           onClick={() => answer('pass', () => socket.emit('game:pass_challenge'))}>
 *
 * `answer` runs `send` only when no answer to this decision is in flight, so a
 * second tap (on the same button or another one) is dropped on the client
 * instead of reaching the server's rate limit.
 */
export function usePendingAnswer(gameState: ClientGameState): {
  pending: string | null;
  answer: (choice: string, send: () => void) => void;
} {
  const stored = useGameStore(s => s.pendingAnswer);
  const pending = activePendingAnswer(stored, gameState)?.choice ?? null;

  const answer = useCallback((choice: string, send: () => void) => {
    const store = useGameStore.getState();
    if (activePendingAnswer(store.pendingAnswer, gameState)) return;
    store.setPendingAnswer({ window: decisionWindowKey(gameState), choice });
    send();
  }, [gameState]);

  return { pending, answer };
}
