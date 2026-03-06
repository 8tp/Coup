'use client';

import { useEffect, useRef } from 'react';
import { useGameStore } from '../stores/gameStore';
import { getSoundEngine } from '../audio/SoundEngine';
import { TurnPhase, ActionType } from '@/shared/types';
import type { ClientGameState, ChallengeRevealEvent } from '@/shared/types';

interface PrevState {
  turnPhase: TurnPhase | null;
  currentPlayerIndex: number;
  turnNumber: number;
  myCoins: number;
  alivePlayers: Set<string>;
  timerExpiry: number | null;
  chatCount: number;
  reactionCount: number;
  challengeReveal: ChallengeRevealEvent | null;
  pendingBlockerId: string | null;
  winnerId: string | null;
}

function snapshotState(
  gs: ClientGameState | null,
  chatCount: number,
  reactionCount: number,
  challengeReveal: ChallengeRevealEvent | null,
): PrevState {
  if (!gs) {
    return {
      turnPhase: null,
      currentPlayerIndex: -1,
      turnNumber: 0,
      myCoins: 0,
      alivePlayers: new Set(),
      timerExpiry: null,
      chatCount,
      reactionCount,
      challengeReveal,
      pendingBlockerId: null,
      winnerId: null,
    };
  }
  const me = gs.players.find(p => p.id === gs.myId);
  return {
    turnPhase: gs.turnPhase,
    currentPlayerIndex: gs.currentPlayerIndex,
    turnNumber: gs.turnNumber,
    myCoins: me?.coins ?? 0,
    alivePlayers: new Set(gs.players.filter(p => p.isAlive).map(p => p.id)),
    timerExpiry: gs.timerExpiry,
    chatCount,
    reactionCount,
    challengeReveal,
    pendingBlockerId: gs.pendingBlock?.blockerId ?? null,
    winnerId: gs.winnerId,
  };
}

export function useSoundEffects(): void {
  const prevRef = useRef<PrevState | null>(null);
  const initializedRef = useRef(false);
  const timerWarnedForRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const gameState = useGameStore(s => s.gameState);
  const chatMessages = useGameStore(s => s.chatMessages);
  const activeReactions = useGameStore(s => s.activeReactions);
  const challengeReveal = useGameStore(s => s.challengeReveal);
  const isMuted = useGameStore(s => s.isMuted);

  // Timer warning interval
  useEffect(() => {
    if (isMuted) return;

    timerIntervalRef.current = setInterval(() => {
      const gs = useGameStore.getState().gameState;
      if (!gs?.timerExpiry) return;

      const remaining = gs.timerExpiry - Date.now();
      if (remaining <= 5000 && remaining > 0) {
        if (timerWarnedForRef.current !== gs.timerExpiry) {
          timerWarnedForRef.current = gs.timerExpiry;
          getSoundEngine().play('timerWarning');
        }
      }
    }, 500);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isMuted]);

  // Main state-transition sound effects
  useEffect(() => {
    const sound = getSoundEngine();
    const chatCount = chatMessages.length;
    const reactionCount = activeReactions.size;
    const curr = snapshotState(gameState, chatCount, reactionCount, challengeReveal);

    // Skip all sounds on first render / initial load
    if (!initializedRef.current) {
      initializedRef.current = true;
      prevRef.current = curr;
      return;
    }

    const prev = prevRef.current;
    prevRef.current = curr;

    if (!prev || !gameState || isMuted) return;

    const myId = gameState.myId;
    const currentPlayerId = gameState.players[gameState.currentPlayerIndex]?.id;

    // ─── Phase transitions ───

    // Your turn starts
    if (
      curr.turnPhase === TurnPhase.AwaitingAction &&
      (prev.turnPhase !== TurnPhase.AwaitingAction || prev.turnNumber !== curr.turnNumber) &&
      currentPlayerId === myId
    ) {
      sound.play('yourTurn');
    }

    // Action declared (non-coup)
    if (
      prev.turnPhase === TurnPhase.AwaitingAction &&
      curr.turnPhase !== TurnPhase.AwaitingAction &&
      curr.turnPhase !== TurnPhase.GameOver
    ) {
      if (gameState.pendingAction?.type === ActionType.Coup) {
        sound.play('coup');
      } else {
        sound.play('actionDeclared');
      }
    }

    // Challenge window opens (you can challenge)
    if (
      curr.turnPhase === TurnPhase.AwaitingActionChallenge &&
      prev.turnPhase !== TurnPhase.AwaitingActionChallenge &&
      currentPlayerId !== myId
    ) {
      sound.play('challengeWindow');
    }

    // Block opportunity (block window opens for you)
    if (
      curr.turnPhase === TurnPhase.AwaitingBlock &&
      prev.turnPhase !== TurnPhase.AwaitingBlock
    ) {
      const target = gameState.pendingAction?.targetId;
      // Block opportunity is relevant to target of steal/assassinate, or everyone for foreign aid
      if (
        (target === myId) ||
        (gameState.pendingAction?.type === ActionType.ForeignAid && currentPlayerId !== myId)
      ) {
        sound.play('blockOpportunity');
      }
    }

    // Assassination alert (you are the target)
    if (
      prev.turnPhase === TurnPhase.AwaitingAction &&
      gameState.pendingAction?.type === ActionType.Assassinate &&
      gameState.pendingAction?.targetId === myId
    ) {
      sound.play('assassinationAlert');
    }

    // Someone blocked (actor hears it)
    if (
      curr.pendingBlockerId && !prev.pendingBlockerId &&
      currentPlayerId === myId
    ) {
      sound.play('block');
    }

    // Block challenge window opens (you can challenge the block)
    if (
      curr.turnPhase === TurnPhase.AwaitingBlockChallenge &&
      prev.turnPhase !== TurnPhase.AwaitingBlockChallenge &&
      currentPlayerId === myId
    ) {
      sound.play('challengeWindow');
    }

    // Influence loss (you must choose)
    if (
      curr.turnPhase === TurnPhase.AwaitingInfluenceLoss &&
      prev.turnPhase !== TurnPhase.AwaitingInfluenceLoss &&
      gameState.influenceLossRequest?.playerId === myId
    ) {
      sound.play('influenceLoss');
    }

    // Exchange phase starts for you
    if (
      curr.turnPhase === TurnPhase.AwaitingExchange &&
      prev.turnPhase !== TurnPhase.AwaitingExchange &&
      gameState.exchangeState && currentPlayerId === myId
    ) {
      sound.play('exchange');
    }

    // Examine phase starts for you
    if (
      curr.turnPhase === TurnPhase.AwaitingExamineDecision &&
      prev.turnPhase !== TurnPhase.AwaitingExamineDecision &&
      gameState.examineState
    ) {
      sound.play('exchange'); // reuse exchange sound for examine reveal
    }

    // ─── Challenge reveal ───
    if (curr.challengeReveal && curr.challengeReveal !== prev.challengeReveal) {
      if (curr.challengeReveal.wasGenuine) {
        sound.play('challengeRevealSuccess');
      } else {
        sound.play('challengeRevealFail');
      }
      // Card shuffle for the deck return
      setTimeout(() => {
        if (!getSoundEngine().muted) sound.play('cardShuffle');
      }, 400);
    }

    // ─── Coin changes (local player only) ───
    if (curr.myCoins > prev.myCoins) {
      sound.play('coinsGained');
    } else if (curr.myCoins < prev.myCoins) {
      sound.play('coinsLost');
    }

    // ─── Eliminations ───
    for (const pid of prev.alivePlayers) {
      if (!curr.alivePlayers.has(pid)) {
        sound.play('playerEliminated');
        break; // one sound per state update
      }
    }

    // ─── Game over ───
    if (curr.winnerId && !prev.winnerId) {
      if (curr.winnerId === myId) {
        sound.play('gameOverWin');
      } else {
        sound.play('gameOverLose');
      }
    }

    // ─── Chat messages (skip own) ───
    if (curr.chatCount > prev.chatCount) {
      const latest = chatMessages[chatMessages.length - 1];
      if (latest && latest.playerId !== myId) {
        sound.play('chatMessage');
      }
    }

    // ─── Reactions ───
    if (curr.reactionCount > prev.reactionCount) {
      sound.play('reaction');
    }
  }, [gameState, chatMessages, activeReactions, challengeReveal, isMuted]);
}
