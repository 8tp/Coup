'use client';

import { ActionType, ClientGameState, GameMode, TurnPhase } from '@/shared/types';
import { ACTION_DISPLAY_NAMES } from '@/shared/constants';

interface PhaseStatusProps {
  gameState: ClientGameState;
}

export function formatNames(names: string[]): string {
  if (names.length === 0) return 'players';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

export function remainingChallengeNames(gameState: ClientGameState, excludedPlayerId?: string): string[] {
  const passed = new Set(gameState.challengeState?.passedPlayerIds ?? []);
  if (excludedPlayerId) passed.add(excludedPlayerId);
  return gameState.players
    .filter(p => p.isAlive && !passed.has(p.id))
    .map(p => p.name);
}

export function remainingBlockNames(gameState: ClientGameState): string[] {
  const pendingAction = gameState.pendingAction;
  if (!pendingAction) return [];

  const passed = new Set(gameState.blockPassedPlayerIds ?? []);
  passed.add(pendingAction.actorId);

  if (pendingAction.targetId) {
    const target = gameState.players.find(p => p.id === pendingAction.targetId && p.isAlive && !passed.has(p.id));
    return target ? [target.name] : [];
  }

  const actor = gameState.players.find(player => player.id === pendingAction.actorId);
  const aliveFactions = new Set(
    gameState.players.filter(player => player.isAlive && player.faction).map(player => player.faction),
  );

  return gameState.players
    .filter(p => {
      if (!p.isAlive || passed.has(p.id)) return false;
      if (
        pendingAction.type === ActionType.ForeignAid &&
        gameState.gameMode === GameMode.Reformation &&
        aliveFactions.size > 1 &&
        p.faction === actor?.faction
      ) {
        return false;
      }
      return true;
    })
    .map(p => p.name);
}

/** What the actor claimed. Embezzle's claim is that they hold no Duke. */
function claimText(gameState: ClientGameState): string {
  const action = gameState.pendingAction;
  if (!action) return 'a character';
  if (action.type === ActionType.Embezzle) return 'no Duke';
  return action.claimedCharacter ?? 'a character';
}

/**
 * The status line over the felt. During a claim it never restates the claim
 * itself: the plaque under it says who claimed what, at whom. It names who the
 * table is waiting on, and when you can answer it says what to do.
 *
 * Whenever a prompt is open (yours, or the waiting note for you) the prompt is
 * the one statement of the state, so globals.css hides this line visually and
 * keeps it for screen readers ("THE CENTRE SAYS IT ONCE").
 */
export function PhaseStatus({ gameState }: PhaseStatusProps) {
  const { turnPhase, pendingAction, pendingBlock, influenceLossRequest, myId } = gameState;
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const isMyTurn = currentPlayer?.id === myId;
  // A spectator, or a seat that has been knocked out, can only watch.
  const canAnswer = !!gameState.players.find(p => p.id === myId)?.isAlive;
  const passedChallenge = gameState.challengeState?.passedPlayerIds.includes(myId) ?? false;

  let text = '';
  let tone: 'neutral' | 'mine' | 'ask' | 'danger' = 'neutral';

  switch (turnPhase) {
    case TurnPhase.AwaitingAction:
      if (isMyTurn) {
        text = 'Your turn: choose an action';
        tone = 'mine';
      } else {
        text = `${currentPlayer?.name}'s turn`;
      }
      break;

    case TurnPhase.AwaitingActionChallenge: {
      const actor = gameState.players.find(p => p.id === pendingAction?.actorId);
      if (canAnswer && myId !== pendingAction?.actorId && !passedChallenge) {
        text = `${actor?.name} claims ${claimText(gameState)}: challenge or pass`;
        tone = 'ask';
      } else {
        text = `Waiting for ${formatNames(remainingChallengeNames(gameState, pendingAction?.actorId))} to challenge or pass`;
      }
      break;
    }

    case TurnPhase.AwaitingBlock: {
      const actor = gameState.players.find(p => p.id === pendingAction?.actorId);
      const remaining = remainingBlockNames(gameState);
      const myName = gameState.players.find(p => p.id === myId)?.name;
      if (canAnswer && myName && remaining.includes(myName)) {
        if (pendingAction?.targetId === myId) {
          text = `${actor?.name} is targeting you: block or allow`;
          tone = 'danger';
        } else {
          text = `${actor?.name} uses ${pendingAction ? ACTION_DISPLAY_NAMES[pendingAction.type] : 'an action'}: block or allow`;
          tone = 'ask';
        }
      } else {
        text = `Waiting for ${formatNames(remaining)} to block or allow`;
      }
      break;
    }

    case TurnPhase.AwaitingBlockChallenge: {
      const blocker = gameState.players.find(p => p.id === pendingBlock?.blockerId);
      if (canAnswer && myId !== pendingBlock?.blockerId && !passedChallenge) {
        text = `${blocker?.name} blocks with ${pendingBlock?.claimedCharacter}: challenge or pass`;
        tone = 'ask';
      } else {
        text = `Waiting for ${formatNames(remainingChallengeNames(gameState, pendingBlock?.blockerId))} to challenge or pass`;
      }
      break;
    }

    case TurnPhase.AwaitingInfluenceLoss: {
      const loser = gameState.players.find(p => p.id === influenceLossRequest?.playerId);
      if (influenceLossRequest?.playerId === myId) {
        text = 'Choose a card to lose';
        tone = 'danger';
      } else {
        text = `${loser?.name} is choosing a card to lose`;
      }
      break;
    }

    case TurnPhase.AwaitingExamineSelection: {
      const target = gameState.players.find(p => p.id === gameState.examineSelectionState?.targetId);
      const examiner = gameState.players.find(p => p.id === gameState.examineSelectionState?.examinerId);
      if (target?.id === myId) {
        text = `Choose a card to show ${examiner?.name ?? 'the Inquisitor'}`;
        tone = 'ask';
      } else {
        text = `${target?.name ?? 'The target'} is choosing a card for ${examiner?.name ?? 'the Inquisitor'} to examine`;
      }
      break;
    }

    case TurnPhase.AwaitingExamineDecision: {
      const examiner = gameState.players.find(p => p.id === pendingAction?.actorId);
      if (myId === pendingAction?.actorId) {
        text = 'Return the card or force a swap';
        tone = 'ask';
      } else {
        text = `${examiner?.name} is examining a card`;
      }
      break;
    }

    case TurnPhase.AwaitingExchange:
      if (gameState.exchangeState) {
        text = 'Choose the cards to keep';
        tone = 'ask';
      } else {
        const exchanger = gameState.players.find(p => p.id === pendingAction?.actorId);
        text = `${exchanger?.name ?? 'A player'} is choosing cards to keep`;
      }
      break;

    case TurnPhase.GameOver:
      text = 'Game over';
      tone = 'mine';
      break;

    default:
      return null;
  }

  return (
    <div
      className="phase-status-enter phase-line"
      data-tone={tone}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {text}
    </div>
  );
}
