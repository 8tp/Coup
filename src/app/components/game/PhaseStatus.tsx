'use client';

import { ClientGameState, TurnPhase } from '@/shared/types';
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

  return gameState.players
    .filter(p => p.isAlive && !passed.has(p.id))
    .map(p => p.name);
}

export function PhaseStatus({ gameState }: PhaseStatusProps) {
  const { turnPhase, pendingAction, pendingBlock, influenceLossRequest, myId } = gameState;
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const isMyTurn = currentPlayer?.id === myId;

  let text = '';
  let color = 'bg-gray-800 text-gray-300';

  switch (turnPhase) {
    case TurnPhase.AwaitingAction:
      if (isMyTurn) {
        text = 'YOUR TURN — Choose an action';
        color = 'bg-coup-accent/20 text-coup-accent border border-coup-accent/50';
      } else {
        text = `${currentPlayer?.name}'s turn`;
      }
      break;

    case TurnPhase.AwaitingActionChallenge: {
      const actor = gameState.players.find(p => p.id === pendingAction?.actorId);
      const remainingNames = remainingChallengeNames(gameState, pendingAction?.actorId);
      if (myId === pendingAction?.actorId) {
        text = `Waiting for ${formatNames(remainingNames)} to accept or challenge your ${pendingAction?.claimedCharacter} claim`;
      } else if (gameState.challengeState?.passedPlayerIds.includes(myId)) {
        text = `Waiting for ${formatNames(remainingNames)} to accept or challenge`;
      } else {
        text = `${actor?.name} claims ${pendingAction?.claimedCharacter} — Challenge or Pass?`;
        color = 'bg-yellow-900/40 text-yellow-300 border border-yellow-600/50';
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
        text = `${actor?.name} is targeting you — Block or allow?`;
        color = 'bg-red-900/40 text-red-300 border border-red-600/50';
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
        text = `${blocker?.name} blocks with ${pendingBlock?.claimedCharacter} — Challenge the block?`;
        color = 'bg-yellow-900/40 text-yellow-300 border border-yellow-600/50';
      } else if (gameState.challengeState?.passedPlayerIds.includes(myId) || myId === pendingBlock?.blockerId) {
        text = `Waiting for ${formatNames(remainingNames)} to accept or challenge ${blocker?.name}'s block`;
      } else {
        text = `${blocker?.name} blocks — Challenge or Pass?`;
        color = 'bg-yellow-900/40 text-yellow-300 border border-yellow-600/50';
      }
      break;
    }

    case TurnPhase.AwaitingInfluenceLoss: {
      const loser = gameState.players.find(p => p.id === influenceLossRequest?.playerId);
      if (influenceLossRequest?.playerId === myId) {
        text = 'You must choose an influence to lose!';
        color = 'bg-red-900/40 text-red-300 border border-red-600/50';
      } else {
        text = `${loser?.name} is choosing an influence to lose`;
      }
      break;
    }

    case TurnPhase.AwaitingExamineDecision: {
      const examiner = gameState.players.find(p => p.id === pendingAction?.actorId);
      if (myId === pendingAction?.actorId) {
        text = 'Examine — Force swap or return the card?';
        color = 'bg-teal-900/40 text-teal-300 border border-teal-600/50';
      } else {
        text = `${examiner?.name} is examining a card...`;
      }
      break;
    }

    case TurnPhase.AwaitingExchange:
      if (gameState.exchangeState) {
        text = 'Choose which cards to keep';
        color = 'bg-green-900/40 text-green-300 border border-green-600/50';
      } else {
        const exchanger = gameState.players.find(p => p.id === pendingAction?.actorId);
        text = `${exchanger?.name ?? 'A player'} is choosing cards`;
      }
      break;

    case TurnPhase.GameOver:
      text = 'Game Over';
      color = 'bg-coup-accent/20 text-coup-accent';
      break;

    default:
      return null;
  }

  return (
    <div className={`rounded-lg px-3 py-2 text-center text-sm font-bold ${color}`}>
      {text}
    </div>
  );
}
