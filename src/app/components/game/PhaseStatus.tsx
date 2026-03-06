'use client';

import { ClientGameState, TurnPhase } from '@/shared/types';

interface PhaseStatusProps {
  gameState: ClientGameState;
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
      if (myId === pendingAction?.actorId) {
        text = `Waiting — others may challenge your ${pendingAction?.claimedCharacter} claim`;
      } else {
        text = `${actor?.name} claims ${pendingAction?.claimedCharacter} — Challenge or Pass?`;
        color = 'bg-yellow-900/40 text-yellow-300 border border-yellow-600/50';
      }
      break;
    }

    case TurnPhase.AwaitingBlock: {
      const actor = gameState.players.find(p => p.id === pendingAction?.actorId);
      const isTarget = pendingAction?.targetId === myId;
      if (myId === pendingAction?.actorId) {
        text = `Waiting — target may block your ${pendingAction?.type}`;
      } else if (isTarget) {
        text = `${actor?.name} is targeting you — Block or let it happen?`;
        color = 'bg-red-900/40 text-red-300 border border-red-600/50';
      } else {
        text = `Waiting for block decision on ${actor?.name}'s ${pendingAction?.type}`;
      }
      break;
    }

    case TurnPhase.AwaitingBlockChallenge: {
      const blocker = gameState.players.find(p => p.id === pendingBlock?.blockerId);
      if (myId === pendingAction?.actorId) {
        text = `${blocker?.name} blocks with ${pendingBlock?.claimedCharacter} — Challenge the block?`;
        color = 'bg-yellow-900/40 text-yellow-300 border border-yellow-600/50';
      } else {
        text = `${blocker?.name} blocks — waiting for response`;
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
        text = 'Exchange in progress...';
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
