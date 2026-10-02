'use client';

import { useEffect, useRef } from 'react';
import { useGameStore } from '../stores/gameStore';
import { useSettingsStore } from '../stores/settingsStore';
import { fireHaptic, HAPTIC_PRIORITY } from '../utils/haptic';
import type { HapticName } from '../utils/haptic';
import { TurnPhase, ActionType } from '@/shared/types';
import type { ClientGameState, ChallengeRevealEvent } from '@/shared/types';

/** Actions that are aimed at a specific player. Being on the far end is `targeted`. */
const TARGETED_ACTIONS: ReadonlySet<ActionType> = new Set([
  ActionType.Coup,
  ActionType.Assassinate,
  ActionType.Steal,
  ActionType.Examine,
]);

interface PrevState {
  /** Identity of the pending action, so a re-broadcast of the same one is not a new event. */
  pendingActionKey: string | null;
  challengeReveal: ChallengeRevealEvent | null;
  myRevealedCount: number;
  myIsAlive: boolean;
  turnNumber: number;
  turnPhase: TurnPhase | null;
  winnerId: string | null;
}

function pendingActionKey(gs: ClientGameState): string | null {
  const pa = gs.pendingAction;
  if (!pa) return null;
  return `${gs.turnNumber}|${pa.type}|${pa.actorId}|${pa.targetId ?? ''}`;
}

function snapshotState(
  gs: ClientGameState | null,
  challengeReveal: ChallengeRevealEvent | null,
): PrevState {
  if (!gs) {
    return {
      pendingActionKey: null,
      challengeReveal,
      myRevealedCount: 0,
      myIsAlive: false,
      turnNumber: 0,
      turnPhase: null,
      winnerId: null,
    };
  }
  const me = gs.players.find(p => p.id === gs.myId);
  return {
    pendingActionKey: pendingActionKey(gs),
    challengeReveal,
    myRevealedCount: me?.influences.filter(i => i.revealed).length ?? 0,
    myIsAlive: me?.isAlive ?? false,
    turnNumber: gs.turnNumber,
    turnPhase: gs.turnPhase,
    winnerId: gs.winnerId,
  };
}

/**
 * Fires haptics for things that happen TO the local player. The ~24 existing
 * `haptic()` call sites already cover the player's own taps; this hook covers
 * the incoming half of the game, which previously buzzed for nothing at all.
 *
 * Rule 1 ("never more than one pattern per event") is enforced structurally
 * here: a state update collects candidate patterns and only the highest-
 * priority one is handed to fireHaptic(). The 300ms priority-aware floor in
 * utils/haptic.ts then handles collisions ACROSS updates.
 */
export function useHapticFeedback(): void {
  const prevRef = useRef<PrevState | null>(null);
  const initializedRef = useRef(false);

  const gameState = useGameStore(s => s.gameState);
  const challengeReveal = useGameStore(s => s.challengeReveal);
  const hapticEnabled = useSettingsStore(s => s.hapticEnabled);

  useEffect(() => {
    const curr = snapshotState(gameState, challengeReveal);

    // Skip everything on first render / initial load, so a rejoin mid-game
    // does not dump the whole backlog into the actuator at once.
    if (!initializedRef.current) {
      initializedRef.current = true;
      prevRef.current = curr;
      return;
    }

    const prev = prevRef.current;
    prevRef.current = curr;

    if (!prev || !gameState || !hapticEnabled) return;

    const myId = gameState.myId;
    const me = gameState.players.find(p => p.id === myId);
    // Spectators have no seat at the table, so nothing here is about them.
    if (!me) return;

    const currentPlayerId = gameState.players[gameState.currentPlayerIndex]?.id;
    const candidates: HapticName[] = [];

    // ─── Something is being done TO you ───
    if (
      curr.pendingActionKey &&
      curr.pendingActionKey !== prev.pendingActionKey &&
      gameState.pendingAction &&
      gameState.pendingAction.targetId === myId &&
      TARGETED_ACTIONS.has(gameState.pendingAction.type)
    ) {
      candidates.push('targeted');
    }

    // ─── Challenge reveal ───
    // ChallengeRevealEvent carries names rather than ids, so the local player
    // is matched by name; wasGenuine decides which side lost the challenge.
    // Safe because names are unique per room: RoomManager rejects a join whose
    // name case-insensitively matches a seated player (RoomManager.ts:83, :111).
    // That invariant is what this match rests on -- if it is ever relaxed, this
    // needs challengerId/challengedId on the event instead.
    if (curr.challengeReveal && curr.challengeReveal !== prev.challengeReveal) {
      const reveal = curr.challengeReveal;
      const iChallenged = reveal.challengerName === me.name;
      const iWasChallenged = reveal.challengedName === me.name;
      // wasGenuine = the challenged player held the card, so the challenger lost.
      const iLost = reveal.wasGenuine ? iChallenged : iWasChallenged;
      const iWon = reveal.wasGenuine ? iWasChallenged : iChallenged;
      if (iLost) candidates.push('targeted');
      else if (iWon) candidates.push('goodThing');
    }

    // ─── You lost an influence ───
    if (curr.myRevealedCount > prev.myRevealedCount) {
      candidates.push('influenceLost');
    }

    // ─── You were eliminated ───
    if (prev.myIsAlive && !curr.myIsAlive) {
      candidates.push('influenceLost');
    }

    // ─── Your turn begins ───
    if (
      me.isAlive &&
      curr.turnPhase === TurnPhase.AwaitingAction &&
      curr.turnNumber !== prev.turnNumber &&
      currentPlayerId === myId
    ) {
      candidates.push('goodThing');
    }

    // ─── Game over ───
    if (curr.winnerId && !prev.winnerId) {
      candidates.push(curr.winnerId === myId ? 'win' : 'influenceLost');
    }

    if (candidates.length === 0) return;

    // Rule 1: exactly one pattern leaves this update -- the most earned one.
    let best = candidates[0];
    for (const name of candidates) {
      if (HAPTIC_PRIORITY[name] > HAPTIC_PRIORITY[best]) best = name;
    }
    fireHaptic(best);
  }, [gameState, challengeReveal, hapticEnabled]);
}
