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
  const mutedPlayerIds = useGameStore(s => s.mutedPlayerIds);

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
    const audibleChatMessages = chatMessages.filter(msg => !mutedPlayerIds.includes(msg.playerId));
    const reactionCount = Array.from(activeReactions.keys()).filter(playerId => !mutedPlayerIds.includes(playerId)).length;
    const chatCount = audibleChatMessages.length;
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

    /**
     * The perspective a cue is heard from. `mine` gets it centred, unfiltered
     * and at full level; anything else gets the -6dB / panned / lowpassed
     * treatment inside SoundEngine.makeHead().
     *
     * The whole point of passing this is that BYSTANDERS HEAR SOMETHING. Coup
     * used to gate several of these on "only if it involves me" and play nothing
     * otherwise, which left the table silent for the entirety of an opponent's
     * turn. Quiet is correct; silent is not.
     */
    const perspective = (actorId: string | undefined) => ({
      mine: actorId !== undefined && actorId === myId,
      playerId: actorId,
    });

    /** ChallengeRevealEvent carries names, not ids; the pan seed needs an id. */
    const idForName = (name: string): string | undefined =>
      gameState.players.find(p => p.name === name)?.id;

    // ─── Phase transitions ───

    // Your turn starts
    if (
      curr.turnPhase === TurnPhase.AwaitingAction &&
      (prev.turnPhase !== TurnPhase.AwaitingAction || prev.turnNumber !== curr.turnNumber) &&
      currentPlayerId === myId
    ) {
      sound.play('yourTurn');
    }

    // Action declared (non-coup). Heard by everyone, from the actor's seat.
    if (
      prev.turnPhase === TurnPhase.AwaitingAction &&
      curr.turnPhase !== TurnPhase.AwaitingAction &&
      curr.turnPhase !== TurnPhase.GameOver
    ) {
      const actorId = gameState.pendingAction?.actorId ?? currentPlayerId;
      if (gameState.pendingAction?.type === ActionType.Coup) {
        sound.play('coup', perspective(actorId));
      } else {
        sound.play('actionDeclared', perspective(actorId));
      }
    }

    // Challenge window opens (you can challenge) — a personal prompt, not an event.
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

    // Someone blocked. Used to fire only for the actor; now everyone hears it,
    // and it is "mine" for both parties to the block — the blocker did it, and
    // the actor is the one it was done to.
    if (curr.pendingBlockerId && !prev.pendingBlockerId) {
      const blockerId = curr.pendingBlockerId;
      sound.play('block', {
        mine: blockerId === myId || currentPlayerId === myId,
        playerId: blockerId,
      });
    }

    // Block challenge window opens (you can challenge the block)
    if (
      curr.turnPhase === TurnPhase.AwaitingBlockChallenge &&
      prev.turnPhase !== TurnPhase.AwaitingBlockChallenge &&
      currentPlayerId === myId
    ) {
      sound.play('challengeWindow');
    }

    // Influence loss. Everyone hears the card go down; only the VICTIM hears it
    // as their own — this is the override the mine/theirs rule needs, because
    // the actor of an assassination is not the one losing something.
    if (
      curr.turnPhase === TurnPhase.AwaitingInfluenceLoss &&
      prev.turnPhase !== TurnPhase.AwaitingInfluenceLoss &&
      gameState.influenceLossRequest
    ) {
      sound.play('influenceLoss', perspective(gameState.influenceLossRequest.playerId));
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
      curr.turnPhase === TurnPhase.AwaitingExamineSelection &&
      prev.turnPhase !== TurnPhase.AwaitingExamineSelection &&
      gameState.examineSelectionState?.targetId === myId
    ) {
      sound.play('exchange');
    }

    if (
      curr.turnPhase === TurnPhase.AwaitingExamineDecision &&
      prev.turnPhase !== TurnPhase.AwaitingExamineDecision &&
      gameState.examineState
    ) {
      // reuse exchange sound for examine reveal. ClientExamineState carries only
      // the target, so the examiner is the player whose turn it is.
      sound.play('exchange', perspective(currentPlayerId));
    }

    // ─── Challenge reveal ───
    if (curr.challengeReveal && curr.challengeReveal !== prev.challengeReveal) {
      const reveal = curr.challengeReveal;
      const challengerId = idForName(reveal.challengerName);
      const challengedId = idForName(reveal.challengedName);
      // Either party to the challenge hears it as theirs; the pan seed is the
      // player whose card is on the table.
      const involved = challengerId === myId || challengedId === myId;
      const opts = { mine: involved, playerId: challengedId };
      if (reveal.wasGenuine) {
        sound.play('challengeRevealSuccess', opts);
      } else {
        sound.play('challengeRevealFail', opts);
      }
      // Card shuffle for the deck return
      setTimeout(() => {
        if (!getSoundEngine().muted) sound.play('cardShuffle', opts);
      }, 400);
    }

    // ─── Coin changes (local player only) ───
    // Only my own coin total is tracked, so these are always mine by
    // construction — which is also the coinsLost override: the victim is the
    // only one who hears their own coins leave.
    if (curr.myCoins > prev.myCoins) {
      sound.play('coinsGained', { mine: true, playerId: myId });
    } else if (curr.myCoins < prev.myCoins) {
      sound.play('coinsLost', { mine: true, playerId: myId });
    }

    // ─── Eliminations ───
    for (const pid of prev.alivePlayers) {
      if (!curr.alivePlayers.has(pid)) {
        sound.play('playerEliminated', perspective(pid));
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
      const latest = audibleChatMessages[audibleChatMessages.length - 1];
      if (latest && latest.playerId !== myId) {
        sound.play('chatMessage');
      }
    }

    // ─── Reactions ───
    if (curr.reactionCount > prev.reactionCount) {
      sound.play('reaction');
    }
  }, [gameState, chatMessages, activeReactions, challengeReveal, isMuted, mutedPlayerIds]);
}
