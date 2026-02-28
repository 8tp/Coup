import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RoomManager } from '@/server/RoomManager';

describe('RoomManager', () => {
  let manager: RoomManager;

  beforeEach(() => {
    vi.useFakeTimers();
    manager = new RoomManager();
  });

  afterEach(() => {
    manager.destroy();
    vi.useRealTimers();
  });

  describe('createRoom()', () => {
    it('creates a room with a code and a player', () => {
      const { room, playerId } = manager.createRoom('Alice', 'socket1');
      expect(room.code).toBeDefined();
      expect(room.code.length).toBe(6);
      expect(room.hostId).toBe(playerId);
      expect(room.players).toHaveLength(1);
      expect(room.players[0].name).toBe('Alice');
      expect(room.players[0].socketId).toBe('socket1');
      expect(room.players[0].connected).toBe(true);
      expect(room.gameState).toBeNull();
    });

    it('generates unique room codes', () => {
      const codes = new Set<string>();
      for (let i = 0; i < 20; i++) {
        const { room } = manager.createRoom(`Player${i}`, `socket${i}`);
        codes.add(room.code);
      }
      expect(codes.size).toBe(20);
    });
  });

  describe('joinRoom()', () => {
    it('adds a player to an existing room', () => {
      const { room } = manager.createRoom('Alice', 'socket1');
      const result = manager.joinRoom(room.code, 'Bob', 'socket2');
      expect('error' in result).toBe(false);
      if ('error' in result) return;

      expect(result.room.players).toHaveLength(2);
      expect(result.room.players[1].name).toBe('Bob');
    });

    it('is case-insensitive on room code', () => {
      const { room } = manager.createRoom('Alice', 'socket1');
      const result = manager.joinRoom(room.code.toLowerCase(), 'Bob', 'socket2');
      expect('error' in result).toBe(false);
    });

    it('rejects if room not found', () => {
      const result = manager.joinRoom('ZZZZZZ', 'Bob', 'socket2');
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toContain('not found');
      }
    });

    it('rejects if room is full (6 players)', () => {
      const { room } = manager.createRoom('P1', 's1');
      for (let i = 2; i <= 6; i++) {
        manager.joinRoom(room.code, `P${i}`, `s${i}`);
      }
      const result = manager.joinRoom(room.code, 'P7', 's7');
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toContain('full');
      }
    });

    it('rejects if game already in progress', () => {
      const { room } = manager.createRoom('Alice', 'socket1');
      manager.joinRoom(room.code, 'Bob', 'socket2');
      manager.startGame(room.code);

      const result = manager.joinRoom(room.code, 'Charlie', 'socket3');
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toContain('in progress');
      }
    });

    it('rejects duplicate player names', () => {
      const { room } = manager.createRoom('Alice', 'socket1');
      const result = manager.joinRoom(room.code, 'alice', 'socket2');
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toContain('Name already taken');
      }
    });
  });

  describe('rejoinRoom()', () => {
    it('reconnects a player with new socket', () => {
      const { room, playerId } = manager.createRoom('Alice', 'socket1');
      // Mark disconnected
      room.players[0].connected = false;

      const result = manager.rejoinRoom(room.code, playerId, 'socket_new');
      expect('error' in result).toBe(false);
      if ('error' in result) return;

      expect(result.player.socketId).toBe('socket_new');
      expect(result.player.connected).toBe(true);
    });

    it('rejects if room not found', () => {
      const result = manager.rejoinRoom('ZZZZZZ', 'some-id', 'socket1');
      expect('error' in result).toBe(true);
    });

    it('rejects if player not in room', () => {
      const { room } = manager.createRoom('Alice', 'socket1');
      const result = manager.rejoinRoom(room.code, 'unknown-id', 'socket2');
      expect('error' in result).toBe(true);
    });
  });

  describe('leaveRoom()', () => {
    it('removes player from room in lobby', () => {
      const { room } = manager.createRoom('Alice', 'socket1');
      const joinResult = manager.joinRoom(room.code, 'Bob', 'socket2');
      if ('error' in joinResult) return;

      const updated = manager.leaveRoom(room.code, joinResult.playerId);
      expect(updated).not.toBeNull();
      expect(updated!.players).toHaveLength(1);
      expect(updated!.players[0].name).toBe('Alice');
    });

    it('marks player as disconnected during game', () => {
      const { room, playerId } = manager.createRoom('Alice', 'socket1');
      manager.joinRoom(room.code, 'Bob', 'socket2');
      manager.startGame(room.code);

      const updated = manager.leaveRoom(room.code, playerId);
      expect(updated).not.toBeNull();
      const alice = updated!.players.find(p => p.id === playerId);
      expect(alice).toBeDefined();
      expect(alice!.connected).toBe(false);
    });

    it('assigns new host if host leaves in lobby', () => {
      const { room, playerId } = manager.createRoom('Alice', 'socket1');
      const joinResult = manager.joinRoom(room.code, 'Bob', 'socket2');
      if ('error' in joinResult) return;

      const updated = manager.leaveRoom(room.code, playerId);
      expect(updated).not.toBeNull();
      expect(updated!.hostId).toBe(joinResult.playerId);
    });

    it('deletes room if last player leaves', () => {
      const { room, playerId } = manager.createRoom('Alice', 'socket1');
      const result = manager.leaveRoom(room.code, playerId);
      expect(result).toBeNull();
      expect(manager.getRoom(room.code)).toBeUndefined();
    });

    it('returns null for non-existent room', () => {
      const result = manager.leaveRoom('ZZZZZZ', 'some-id');
      expect(result).toBeNull();
    });
  });

  describe('startGame()', () => {
    it('creates engine and initializes game', () => {
      const { room } = manager.createRoom('Alice', 'socket1');
      manager.joinRoom(room.code, 'Bob', 'socket2');

      const result = manager.startGame(room.code);
      expect('error' in result).toBe(false);

      const engine = manager.getEngine(room.code);
      expect(engine).toBeDefined();

      const updatedRoom = manager.getRoom(room.code);
      expect(updatedRoom!.gameState).not.toBeNull();
    });

    it('rejects if room not found', () => {
      const result = manager.startGame('ZZZZZZ');
      expect('error' in result).toBe(true);
    });

    it('rejects if not enough players', () => {
      const { room } = manager.createRoom('Alice', 'socket1');
      const result = manager.startGame(room.code);
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toContain('at least');
      }
    });

    it('rejects if game already in progress', () => {
      const { room } = manager.createRoom('Alice', 'socket1');
      manager.joinRoom(room.code, 'Bob', 'socket2');
      manager.startGame(room.code);

      const result = manager.startGame(room.code);
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toContain('already in progress');
      }
    });
  });

  describe('getPlayerRoom()', () => {
    it('finds room by socket ID', () => {
      const { room, playerId } = manager.createRoom('Alice', 'socket1');
      const result = manager.getPlayerRoom('socket1');
      expect(result).not.toBeNull();
      expect(result!.room.code).toBe(room.code);
      expect(result!.player.id).toBe(playerId);
    });

    it('returns null for unknown socket ID', () => {
      expect(manager.getPlayerRoom('unknown')).toBeNull();
    });
  });

  describe('getRoom()', () => {
    it('finds room by code (case insensitive)', () => {
      const { room } = manager.createRoom('Alice', 'socket1');
      expect(manager.getRoom(room.code.toLowerCase())).toBeDefined();
    });
  });

  // ─── Bot Management ───

  describe('addBot()', () => {
    it('adds a bot to the room', () => {
      const { room } = manager.createRoom('Alice', 'socket1');
      const result = manager.addBot(room.code, 'Bot1', { honesty: 50, skepticism: 50, vengefulness: 50 });
      expect('error' in result).toBe(false);
      if ('error' in result) return;

      expect(result.botId).toBeDefined();
      const updated = manager.getRoom(room.code)!;
      expect(updated.players).toHaveLength(2);
      expect(updated.players[1].isBot).toBe(true);
      expect(updated.players[1].name).toBe('Bot1');
      expect(updated.players[1].personality).toEqual({ honesty: 50, skepticism: 50, vengefulness: 50 });
      expect(updated.players[1].socketId).toBe('');
      expect(updated.players[1].connected).toBe(true);
    });

    it('rejects if room not found', () => {
      const result = manager.addBot('ZZZZZZ', 'Bot1', { honesty: 50, skepticism: 50, vengefulness: 50 });
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toContain('not found');
      }
    });

    it('rejects if game already in progress', () => {
      const { room } = manager.createRoom('Alice', 'socket1');
      manager.addBot(room.code, 'Bot1', { honesty: 50, skepticism: 50, vengefulness: 50 });
      manager.startGame(room.code);

      const result = manager.addBot(room.code, 'Bot2', { honesty: 50, skepticism: 50, vengefulness: 50 });
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toContain('in progress');
      }
    });

    it('rejects if room is full', () => {
      const { room } = manager.createRoom('P1', 's1');
      for (let i = 2; i <= 6; i++) {
        manager.addBot(room.code, `Bot${i}`, { honesty: 50, skepticism: 50, vengefulness: 50 });
      }
      const result = manager.addBot(room.code, 'Bot7', { honesty: 50, skepticism: 50, vengefulness: 50 });
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toContain('full');
      }
    });

    it('rejects duplicate names (case-insensitive)', () => {
      const { room } = manager.createRoom('Alice', 'socket1');
      const result = manager.addBot(room.code, 'alice', { honesty: 50, skepticism: 50, vengefulness: 50 });
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toContain('Name already taken');
      }
    });
  });

  describe('removeBot()', () => {
    it('removes a bot from the room', () => {
      const { room } = manager.createRoom('Alice', 'socket1');
      const addResult = manager.addBot(room.code, 'Bot1', { honesty: 50, skepticism: 50, vengefulness: 50 });
      if ('error' in addResult) return;

      const result = manager.removeBot(room.code, addResult.botId);
      expect('error' in result).toBe(false);

      const updated = manager.getRoom(room.code)!;
      expect(updated.players).toHaveLength(1);
      expect(updated.players[0].name).toBe('Alice');
    });

    it('rejects if room not found', () => {
      const result = manager.removeBot('ZZZZZZ', 'some-id');
      expect('error' in result).toBe(true);
    });

    it('rejects if game already in progress', () => {
      const { room } = manager.createRoom('Alice', 'socket1');
      const addResult = manager.addBot(room.code, 'Bot1', { honesty: 50, skepticism: 50, vengefulness: 50 });
      if ('error' in addResult) return;
      manager.startGame(room.code);

      const result = manager.removeBot(room.code, addResult.botId);
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toContain('in progress');
      }
    });

    it('rejects if player not found', () => {
      const { room } = manager.createRoom('Alice', 'socket1');
      const result = manager.removeBot(room.code, 'nonexistent');
      expect('error' in result).toBe(true);
    });

    it('rejects if player is not a bot', () => {
      const { room, playerId } = manager.createRoom('Alice', 'socket1');
      const result = manager.removeBot(room.code, playerId);
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toContain('not a bot');
      }
    });
  });

  describe('bot lifecycle in leaveRoom()', () => {
    it('assigns host to human player when host leaves (skips bots)', () => {
      const { room, playerId } = manager.createRoom('Alice', 'socket1');
      manager.addBot(room.code, 'Bot1', { honesty: 50, skepticism: 50, vengefulness: 50 });
      const joinResult = manager.joinRoom(room.code, 'Bob', 'socket2');
      if ('error' in joinResult) return;

      const updated = manager.leaveRoom(room.code, playerId);
      expect(updated).not.toBeNull();
      expect(updated!.hostId).toBe(joinResult.playerId); // Bob, not Bot1
    });

    it('deletes room if only bots remain after host leaves', () => {
      const { room, playerId } = manager.createRoom('Alice', 'socket1');
      manager.addBot(room.code, 'Bot1', { honesty: 50, skepticism: 50, vengefulness: 50 });
      manager.addBot(room.code, 'Bot2', { honesty: 50, skepticism: 50, vengefulness: 50 });

      const result = manager.leaveRoom(room.code, playerId);
      expect(result).toBeNull();
      expect(manager.getRoom(room.code)).toBeUndefined();
    });
  });

  describe('resetToLobby()', () => {
    it('preserves bots across rematch', () => {
      const { room } = manager.createRoom('Alice', 'socket1');
      manager.addBot(room.code, 'Bot1', { honesty: 50, skepticism: 50, vengefulness: 50 });
      manager.startGame(room.code);

      const reset = manager.resetToLobby(room.code);
      expect(reset).not.toBeNull();
      expect(reset!.players).toHaveLength(2);
      const bot = reset!.players.find(p => p.isBot);
      expect(bot).toBeDefined();
      expect(bot!.name).toBe('Bot1');
    });

    it('removes disconnected humans but keeps bots', () => {
      const { room } = manager.createRoom('Alice', 'socket1');
      manager.joinRoom(room.code, 'Bob', 'socket2');
      manager.addBot(room.code, 'Bot1', { honesty: 50, skepticism: 50, vengefulness: 50 });
      manager.startGame(room.code);

      // Mark Bob as disconnected
      const bob = room.players.find(p => p.name === 'Bob')!;
      bob.connected = false;

      const reset = manager.resetToLobby(room.code);
      expect(reset).not.toBeNull();
      // Alice (connected) + Bot1 = 2, Bob (disconnected) removed
      expect(reset!.players).toHaveLength(2);
      expect(reset!.players.find(p => p.name === 'Bob')).toBeUndefined();
      expect(reset!.players.find(p => p.isBot)).toBeDefined();
    });

    it('reassigns host to human when current host is disconnected', () => {
      const { room, playerId } = manager.createRoom('Alice', 'socket1');
      manager.joinRoom(room.code, 'Bob', 'socket2');
      manager.addBot(room.code, 'Bot1', { honesty: 50, skepticism: 50, vengefulness: 50 });
      manager.startGame(room.code);

      // Mark Alice (host) as disconnected
      const alice = room.players.find(p => p.id === playerId)!;
      alice.connected = false;

      const reset = manager.resetToLobby(room.code);
      expect(reset).not.toBeNull();
      // Host should be Bob (human), not Bot1
      const bob = reset!.players.find(p => p.name === 'Bob')!;
      expect(reset!.hostId).toBe(bob.id);
    });

    it('deletes room if only bots remain after rematch', () => {
      const { room } = manager.createRoom('Alice', 'socket1');
      manager.addBot(room.code, 'Bot1', { honesty: 50, skepticism: 50, vengefulness: 50 });
      manager.startGame(room.code);

      // Mark Alice as disconnected
      const alice = room.players.find(p => !p.isBot)!;
      alice.connected = false;

      const reset = manager.resetToLobby(room.code);
      expect(reset).toBeNull();
      expect(manager.getRoom(room.code)).toBeUndefined();
    });

    it('clears game state on reset', () => {
      const { room } = manager.createRoom('Alice', 'socket1');
      manager.addBot(room.code, 'Bot1', { honesty: 50, skepticism: 50, vengefulness: 50 });
      manager.startGame(room.code);

      expect(manager.getEngine(room.code)).toBeDefined();

      const reset = manager.resetToLobby(room.code);
      expect(reset).not.toBeNull();
      expect(reset!.gameState).toBeNull();
      expect(manager.getEngine(room.code)).toBeUndefined();
    });
  });

  describe('startGame() with bots', () => {
    it('starts game with human + bot players', () => {
      const { room } = manager.createRoom('Alice', 'socket1');
      manager.addBot(room.code, 'Bot1', { honesty: 50, skepticism: 50, vengefulness: 50 });

      const result = manager.startGame(room.code);
      expect('error' in result).toBe(false);

      const engine = manager.getEngine(room.code);
      expect(engine).toBeDefined();
      expect(engine!.game.players).toHaveLength(2);
    });

    it('bot counts toward minimum player requirement', () => {
      const { room } = manager.createRoom('Alice', 'socket1');
      manager.addBot(room.code, 'Bot1', { honesty: 50, skepticism: 50, vengefulness: 50 });

      // 1 human + 1 bot = 2 players, meets MIN_PLAYERS
      const result = manager.startGame(room.code);
      expect('error' in result).toBe(false);
    });
  });

  describe('getBotController() / setBotController()', () => {
    it('stores and retrieves bot controller', () => {
      const { room } = manager.createRoom('Alice', 'socket1');
      expect(manager.getBotController(room.code)).toBeUndefined();

      // Use a minimal mock for the controller
      const mockController = { destroy: vi.fn(), onStateChange: vi.fn() } as any;
      manager.setBotController(room.code, mockController);

      expect(manager.getBotController(room.code)).toBe(mockController);
    });
  });
});
