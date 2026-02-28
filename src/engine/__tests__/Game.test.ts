import { describe, it, expect, beforeEach } from 'vitest';
import { Game } from '../Game';
import { Player } from '../Player';
import { Character, GameStatus, TurnPhase } from '../../shared/types';
import { STARTING_COINS, STARTING_HAND_SIZE, TOTAL_COINS } from '../../shared/constants';

describe('Game', () => {
  let game: Game;
  const players = [
    { id: 'p1', name: 'Alice' },
    { id: 'p2', name: 'Bob' },
    { id: 'p3', name: 'Charlie' },
  ];

  beforeEach(() => {
    game = new Game('TEST01');
  });

  describe('constructor', () => {
    it('sets roomCode', () => {
      expect(game.roomCode).toBe('TEST01');
    });

    it('starts in Lobby status', () => {
      expect(game.status).toBe(GameStatus.Lobby);
    });
  });

  describe('initialize()', () => {
    beforeEach(() => {
      game.initialize(players);
    });

    it('deals STARTING_HAND_SIZE cards per player', () => {
      for (const player of game.players) {
        expect(player.influences).toHaveLength(STARTING_HAND_SIZE);
        for (const inf of player.influences) {
          expect(inf.revealed).toBe(false);
          expect(Object.values(Character)).toContain(inf.character);
        }
      }
    });

    it('gives STARTING_COINS to each player', () => {
      for (const player of game.players) {
        expect(player.coins).toBe(STARTING_COINS);
      }
    });

    it('removes dealt cards and coins from treasury/deck', () => {
      const totalDealt = players.length * STARTING_HAND_SIZE;
      expect(game.deck.size).toBe(15 - totalDealt);
      expect(game.treasury).toBe(TOTAL_COINS - players.length * STARTING_COINS);
    });

    it('sets status to InProgress', () => {
      expect(game.status).toBe(GameStatus.InProgress);
    });

    it('sets turnPhase to AwaitingAction', () => {
      expect(game.turnPhase).toBe(TurnPhase.AwaitingAction);
    });

    it('sets turnNumber to 1', () => {
      expect(game.turnNumber).toBe(1);
    });

    it('logs a game started message', () => {
      expect(game.actionLog.length).toBeGreaterThanOrEqual(1);
      expect(game.actionLog[0].message).toContain('Game started!');
    });

    it('currentPlayerIndex is within range', () => {
      expect(game.currentPlayerIndex).toBeGreaterThanOrEqual(0);
      expect(game.currentPlayerIndex).toBeLessThan(players.length);
    });
  });

  describe('advanceTurn()', () => {
    beforeEach(() => {
      game.initialize(players);
      game.currentPlayerIndex = 0;
    });

    it('moves to the next player', () => {
      game.advanceTurn();
      expect(game.currentPlayerIndex).toBe(1);
    });

    it('wraps around to the first player', () => {
      game.currentPlayerIndex = 2;
      game.advanceTurn();
      expect(game.currentPlayerIndex).toBe(0);
    });

    it('skips eliminated players', () => {
      // Eliminate player 1 (Bob)
      game.players[1].influences.forEach(inf => inf.revealed = true);
      game.currentPlayerIndex = 0;
      game.advanceTurn();
      expect(game.currentPlayerIndex).toBe(2); // skipped Bob
    });

    it('increments turnNumber', () => {
      const before = game.turnNumber;
      game.advanceTurn();
      expect(game.turnNumber).toBe(before + 1);
    });

    it('sets turnPhase to AwaitingAction', () => {
      game.turnPhase = TurnPhase.ActionResolved;
      game.advanceTurn();
      expect(game.turnPhase).toBe(TurnPhase.AwaitingAction);
    });

    it('detects win condition when only 1 player alive', () => {
      // Eliminate all but player 0
      game.players[1].influences.forEach(inf => inf.revealed = true);
      game.players[2].influences.forEach(inf => inf.revealed = true);
      game.advanceTurn();
      expect(game.status).toBe(GameStatus.Finished);
      expect(game.turnPhase).toBe(TurnPhase.GameOver);
      expect(game.winnerId).toBe('p1');
    });
  });

  describe('checkWinCondition()', () => {
    beforeEach(() => {
      game.initialize(players);
    });

    it('returns false when multiple players alive', () => {
      expect(game.checkWinCondition()).toBe(false);
      expect(game.status).toBe(GameStatus.InProgress);
    });

    it('returns true when only 1 player left', () => {
      game.players[1].influences.forEach(inf => inf.revealed = true);
      game.players[2].influences.forEach(inf => inf.revealed = true);
      expect(game.checkWinCondition()).toBe(true);
      expect(game.status).toBe(GameStatus.Finished);
      expect(game.turnPhase).toBe(TurnPhase.GameOver);
      expect(game.winnerId).toBe('p1');
    });
  });

  describe('eliminatePlayer()', () => {
    beforeEach(() => {
      game.initialize(players);
    });

    it('returns player coins to treasury', () => {
      const player = game.players[0];
      player.coins = 5;
      const treasuryBefore = game.treasury;
      game.eliminatePlayer(player);
      expect(player.coins).toBe(0);
      expect(game.treasury).toBe(treasuryBefore + 5);
    });

    it('logs an elimination message', () => {
      const logCount = game.actionLog.length;
      game.eliminatePlayer(game.players[0]);
      expect(game.actionLog.length).toBe(logCount + 1);
      expect(game.actionLog[game.actionLog.length - 1].message).toContain('eliminated');
    });
  });

  describe('giveCoins()', () => {
    beforeEach(() => {
      game.initialize(players);
    });

    it('transfers coins from treasury to player', () => {
      const player = game.players[0];
      const coinsBefore = player.coins;
      const treasuryBefore = game.treasury;
      game.giveCoins(player, 3);
      expect(player.coins).toBe(coinsBefore + 3);
      expect(game.treasury).toBe(treasuryBefore - 3);
    });

    it('gives only as much as treasury has', () => {
      const player = game.players[0];
      game.treasury = 2;
      game.giveCoins(player, 5);
      expect(player.coins).toBe(STARTING_COINS + 2);
      expect(game.treasury).toBe(0);
    });
  });

  describe('takeCoins()', () => {
    beforeEach(() => {
      game.initialize(players);
    });

    it('transfers coins from player to treasury', () => {
      const player = game.players[0];
      player.coins = 10;
      const treasuryBefore = game.treasury;
      game.takeCoins(player, 3);
      expect(player.coins).toBe(7);
      expect(game.treasury).toBe(treasuryBefore + 3);
    });

    it('takes only as much as player has', () => {
      const player = game.players[0];
      player.coins = 1;
      const treasuryBefore = game.treasury;
      game.takeCoins(player, 5);
      expect(player.coins).toBe(0);
      expect(game.treasury).toBe(treasuryBefore + 1);
    });
  });

  describe('getPlayer()', () => {
    beforeEach(() => {
      game.initialize(players);
    });

    it('finds a player by id', () => {
      expect(game.getPlayer('p1')?.name).toBe('Alice');
      expect(game.getPlayer('p2')?.name).toBe('Bob');
    });

    it('returns undefined for unknown id', () => {
      expect(game.getPlayer('unknown')).toBeUndefined();
    });
  });

  describe('getAlivePlayers()', () => {
    beforeEach(() => {
      game.initialize(players);
    });

    it('returns all players when all alive', () => {
      expect(game.getAlivePlayers()).toHaveLength(3);
    });

    it('excludes eliminated players', () => {
      game.players[1].influences.forEach(inf => inf.revealed = true);
      const alive = game.getAlivePlayers();
      expect(alive).toHaveLength(2);
      expect(alive.map(p => p.id)).not.toContain('p2');
    });
  });

  describe('toState()', () => {
    it('returns a complete GameState object', () => {
      game.initialize(players);
      const state = game.toState();
      expect(state.roomCode).toBe('TEST01');
      expect(state.status).toBe(GameStatus.InProgress);
      expect(state.players).toHaveLength(3);
      expect(state.turnPhase).toBe(TurnPhase.AwaitingAction);
      expect(state.deck).toBeDefined();
      expect(state.treasury).toBeDefined();
      expect(state.pendingAction).toBeNull();
      expect(state.pendingBlock).toBeNull();
      expect(state.challengeState).toBeNull();
      expect(state.influenceLossRequest).toBeNull();
      expect(state.exchangeState).toBeNull();
      expect(state.winnerId).toBeNull();
    });
  });
});
