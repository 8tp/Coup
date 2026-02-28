import {
  GameState,
  ClientGameState,
  ClientPlayerState,
  ClientInfluence,
  ClientChallengeState,
  ClientExchangeState,
} from '../shared/types';

/**
 * Converts full server-side game state into a per-player client view.
 * Hides other players' unrevealed cards and restricts exchange info.
 */
export function serializeForPlayer(state: GameState, playerId: string): ClientGameState {
  return {
    roomCode: state.roomCode,
    status: state.status,
    players: state.players.map(p => serializePlayer(p, playerId)),
    currentPlayerIndex: state.currentPlayerIndex,
    turnPhase: state.turnPhase,
    deckCount: state.deck.length,
    treasury: state.treasury,
    pendingAction: state.pendingAction,
    pendingBlock: state.pendingBlock,
    challengeState: state.challengeState ? serializeChallengeState(state.challengeState) : null,
    influenceLossRequest: state.influenceLossRequest,
    exchangeState: serializeExchangeState(state, playerId),
    blockPassedPlayerIds: state.blockPassedPlayerIds || [],
    actionLog: state.actionLog,
    timerExpiry: state.timerExpiry,
    winnerId: state.winnerId,
    turnNumber: state.turnNumber,
    myId: playerId,
  };
}

function serializePlayer(player: import('../shared/types').PlayerState, viewerId: string): ClientPlayerState {
  const isMe = player.id === viewerId;

  return {
    id: player.id,
    name: player.name,
    coins: player.coins,
    influences: player.influences.map(inf => serializeInfluence(inf, isMe)),
    isAlive: player.isAlive,
    seatIndex: player.seatIndex,
  };
}

function serializeInfluence(influence: import('../shared/types').Influence, isOwn: boolean): ClientInfluence {
  return {
    character: (isOwn || influence.revealed) ? influence.character : null,
    revealed: influence.revealed,
  };
}

function serializeChallengeState(cs: import('../shared/types').ChallengeState): ClientChallengeState {
  return {
    challengerId: cs.challengerId,
    challengedPlayerId: cs.challengedPlayerId,
    claimedCharacter: cs.claimedCharacter,
    passedPlayerIds: cs.passedPlayerIds,
  };
}

function serializeExchangeState(state: GameState, playerId: string): ClientExchangeState | null {
  if (!state.exchangeState) return null;
  if (state.exchangeState.playerId !== playerId) return null;

  // The player sees their current unrevealed cards + drawn cards
  const player = state.players.find(p => p.id === playerId);
  if (!player) return null;

  const currentCards = player.influences
    .filter(inf => !inf.revealed)
    .map(inf => inf.character);

  return {
    availableCards: [...currentCards, ...state.exchangeState.drawnCards],
    keepCount: currentCards.length,
  };
}
