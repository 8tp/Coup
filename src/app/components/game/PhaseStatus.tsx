'use client';

import { ActionType, ClientGameState, GameMode, TurnPhase } from '@/shared/types';
import { ACTION_DISPLAY_NAMES } from '@/shared/constants';

interface PhaseStatusProps {
  gameState: ClientGameState;
}

function formatNames(names: string[]): string {
  if (names.length === 0) return 'players';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

function remainingChallengeNames(gameState: ClientGameState, excludedPlayerId?: string): string[] {
  const passed = new Set(gameState.challengeState?.passedPlayerIds ?? []);
  if (excludedPlayerId) passed.add(excludedPlayerId);
  return gameState.players
    .filter(p => p.isAlive && !passed.has(p.id))
    .map(p => p.name);
}

function remainingBlockNames(gameState: ClientGameState): string[] {
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

export function PhaseStatus({ gameState }: PhaseStatusProps) {
  const { turnPhase, pendingAction, pendingBlock, influenceLossRequest, myId } = gameState;
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const isMyTurn = currentPlayer?.id === myId;

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
      const remainingNames = remainingChallengeNames(gameState, pendingAction?.actorId);
      if (myId === pendingAction?.actorId) {
        text = `Waiting for ${formatNames(remainingNames)} to challenge or pass on your claim of ${claimText(gameState)}`;
      } else if (gameState.challengeState?.passedPlayerIds.includes(myId)) {
        text = `Waiting for ${formatNames(remainingNames)} to challenge or pass`;
      } else {
        text = `${actor?.name} claims ${claimText(gameState)}: challenge or pass`;
        tone = 'ask';
      }
      break;
    }

    case TurnPhase.AwaitingBlock: {
      const actor = gameState.players.find(p => p.id === pendingAction?.actorId);
      const isTarget = pendingAction?.targetId === myId;
      const remainingNames = remainingBlockNames(gameState);
      if (myId === pendingAction?.actorId) {
        text = `Waiting for ${formatNames(remainingNames)} to block or allow your ${pendingAction ? ACTION_DISPLAY_NAMES[pendingAction.type] : 'action'}`;
      } else if (isTarget) {
        text = `${actor?.name} is targeting you: block or allow`;
        tone = 'danger';
      } else if (gameState.blockPassedPlayerIds?.includes(myId)) {
        text = `Waiting for ${formatNames(remainingNames)} to block or allow`;
      } else {
        text = `Waiting for ${formatNames(remainingNames)} to block ${actor?.name}'s ${pendingAction ? ACTION_DISPLAY_NAMES[pendingAction.type] : 'action'}`;
      }
      break;
    }

    case TurnPhase.AwaitingBlockChallenge: {
      const blocker = gameState.players.find(p => p.id === pendingBlock?.blockerId);
      const remainingNames = remainingChallengeNames(gameState, pendingBlock?.blockerId);
      if (myId === pendingAction?.actorId && !gameState.challengeState?.passedPlayerIds.includes(myId)) {
        text = `${blocker?.name} blocks with ${pendingBlock?.claimedCharacter}: challenge or pass`;
        tone = 'ask';
      } else if (gameState.challengeState?.passedPlayerIds.includes(myId) || myId === pendingBlock?.blockerId) {
        text = `Waiting for ${formatNames(remainingNames)} to challenge or pass on ${blocker?.name}'s block`;
      } else {
        text = `${blocker?.name} blocks with ${pendingBlock?.claimedCharacter}: challenge or pass`;
        tone = 'ask';
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
