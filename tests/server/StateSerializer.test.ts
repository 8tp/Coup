import { describe, it, expect } from 'vitest';
import { serializeForPlayer } from '@/server/StateSerializer';
import {
  GameState,
  GameStatus,
  TurnPhase,
  Character,
  PlayerState,
  ExchangeState,
} from '@/shared/types';

function createMockGameState(overrides: Partial<GameState> = {}): GameState {
  const player1: PlayerState = {
    id: 'p1',
    name: 'Alice',
    coins: 5,
    influences: [
      { character: Character.Duke, revealed: false },
      { character: Character.Captain, revealed: false },
    ],
    isAlive: true,
    seatIndex: 0,
  };

  const player2: PlayerState = {
    id: 'p2',
    name: 'Bob',
    coins: 3,
    influences: [
      { character: Character.Assassin, revealed: false },
      { character: Character.Contessa, revealed: true },
    ],
    isAlive: true,
    seatIndex: 1,
  };

  const player3: PlayerState = {
    id: 'p3',
    name: 'Charlie',
    coins: 2,
    influences: [
      { character: Character.Ambassador, revealed: true },
      { character: Character.Duke, revealed: true },
    ],
    isAlive: false,
    seatIndex: 2,
  };

  return {
    roomCode: 'TEST01',
    status: GameStatus.InProgress,
    players: [player1, player2, player3],
    currentPlayerIndex: 0,
    turnPhase: TurnPhase.AwaitingAction,
    deck: [Character.Captain, Character.Assassin, Character.Ambassador],
    treasury: 40,
    pendingAction: null,
    pendingBlock: null,
    challengeState: null,
    influenceLossRequest: null,
    exchangeState: null,
    blockPassedPlayerIds: [],
    actionLog: [],
    timerExpiry: null,
    winnerId: null,
    turnNumber: 1,
    ...overrides,
  };
}

describe('StateSerializer', () => {
  describe('serializeForPlayer()', () => {
    it('hides other players unrevealed cards (character: null)', () => {
      const state = createMockGameState();
      const clientState = serializeForPlayer(state, 'p1');

      // p2's unrevealed card should be null
      const p2 = clientState.players.find(p => p.id === 'p2')!;
      expect(p2.influences[0].character).toBeNull(); // unrevealed, not ours
      expect(p2.influences[0].revealed).toBe(false);
    });

    it('shows own unrevealed cards', () => {
      const state = createMockGameState();
      const clientState = serializeForPlayer(state, 'p1');

      const p1 = clientState.players.find(p => p.id === 'p1')!;
      expect(p1.influences[0].character).toBe(Character.Duke);
      expect(p1.influences[1].character).toBe(Character.Captain);
    });

    it('shows all revealed cards for any player', () => {
      const state = createMockGameState();
      const clientState = serializeForPlayer(state, 'p1');

      // p2's revealed card should be visible
      const p2 = clientState.players.find(p => p.id === 'p2')!;
      expect(p2.influences[1].character).toBe(Character.Contessa);
      expect(p2.influences[1].revealed).toBe(true);

      // p3's revealed cards should be visible
      const p3 = clientState.players.find(p => p.id === 'p3')!;
      expect(p3.influences[0].character).toBe(Character.Ambassador);
      expect(p3.influences[1].character).toBe(Character.Duke);
    });

    it('shows revealed cards of eliminated players', () => {
      const state = createMockGameState();
      const clientState = serializeForPlayer(state, 'p1');

      const p3 = clientState.players.find(p => p.id === 'p3')!;
      expect(p3.isAlive).toBe(false);
      expect(p3.influences[0].character).toBe(Character.Ambassador);
      expect(p3.influences[1].character).toBe(Character.Duke);
    });

    it('only sends exchange state to the exchanging player', () => {
      const exchangeState: ExchangeState = {
        playerId: 'p1',
        drawnCards: [Character.Assassin, Character.Contessa],
      };
      const state = createMockGameState({
        exchangeState,
        turnPhase: TurnPhase.AwaitingExchange,
      });

      // p1 is the exchanging player - should see exchange state
      const clientStateP1 = serializeForPlayer(state, 'p1');
      expect(clientStateP1.exchangeState).not.toBeNull();
      expect(clientStateP1.exchangeState!.availableCards).toBeDefined();
      expect(clientStateP1.exchangeState!.keepCount).toBe(2); // p1 has 2 unrevealed

      // p2 is not the exchanging player - should not see exchange state
      const clientStateP2 = serializeForPlayer(state, 'p2');
      expect(clientStateP2.exchangeState).toBeNull();
    });

    it('exchange state includes correct available cards', () => {
      const exchangeState: ExchangeState = {
        playerId: 'p1',
        drawnCards: [Character.Assassin, Character.Contessa],
      };
      const state = createMockGameState({
        exchangeState,
        turnPhase: TurnPhase.AwaitingExchange,
      });

      const clientState = serializeForPlayer(state, 'p1');
      // p1 hidden cards: Duke, Captain + drawn: Assassin, Contessa
      expect(clientState.exchangeState!.availableCards).toEqual([
        Character.Duke,
        Character.Captain,
        Character.Assassin,
        Character.Contessa,
      ]);
    });

    it('deckCount is correct', () => {
      const state = createMockGameState();
      const clientState = serializeForPlayer(state, 'p1');
      expect(clientState.deckCount).toBe(3); // 3 cards in deck
    });

    it('deckCount does not expose actual deck cards', () => {
      const state = createMockGameState();
      const clientState = serializeForPlayer(state, 'p1');
      // ClientGameState should not have a 'deck' array
      expect((clientState as any).deck).toBeUndefined();
    });

    it('myId is set correctly', () => {
      const state = createMockGameState();
      const clientStateP1 = serializeForPlayer(state, 'p1');
      expect(clientStateP1.myId).toBe('p1');

      const clientStateP2 = serializeForPlayer(state, 'p2');
      expect(clientStateP2.myId).toBe('p2');
    });

    it('preserves other game state fields', () => {
      const state = createMockGameState({
        pendingAction: {
          type: 'Tax' as any,
          actorId: 'p1',
          claimedCharacter: Character.Duke,
        },
        turnNumber: 5,
        treasury: 40,
      });

      const clientState = serializeForPlayer(state, 'p1');
      expect(clientState.roomCode).toBe('TEST01');
      expect(clientState.status).toBe(GameStatus.InProgress);
      expect(clientState.currentPlayerIndex).toBe(0);
      expect(clientState.turnPhase).toBe(TurnPhase.AwaitingAction);
      expect(clientState.treasury).toBe(40);
      expect(clientState.pendingAction).toBeDefined();
      expect(clientState.turnNumber).toBe(5);
      expect(clientState.winnerId).toBeNull();
    });

    it('serializes challenge state correctly', () => {
      const state = createMockGameState({
        challengeState: {
          challengerId: 'p2',
          challengedPlayerId: 'p1',
          claimedCharacter: Character.Duke,
          passedPlayerIds: ['p1'],
        },
      });

      const clientState = serializeForPlayer(state, 'p1');
      expect(clientState.challengeState).not.toBeNull();
      expect(clientState.challengeState!.challengerId).toBe('p2');
      expect(clientState.challengeState!.challengedPlayerId).toBe('p1');
      expect(clientState.challengeState!.claimedCharacter).toBe(Character.Duke);
    });

    it('handles null exchange state', () => {
      const state = createMockGameState({ exchangeState: null });
      const clientState = serializeForPlayer(state, 'p1');
      expect(clientState.exchangeState).toBeNull();
    });
  });
});
