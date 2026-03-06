import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RoomManager } from '@/server/RoomManager';
import { DEFAULT_ROOM_SETTINGS, MIN_ACTION_TIMER, MAX_ACTION_TIMER, PUBLIC_ROOM_LIST_MAX, MAX_PLAYERS, INACTIVE_ROOM_CLEANUP_MS } from '@/shared/constants';
import { ActionType, GameMode, GameStatus, TurnPhase } from '@/shared/types';

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
      const { room, playerId, sessionToken } = manager.createRoom('Alice', 'socket1');
      // Mark disconnected
      room.players[0].connected = false;

      const result = manager.rejoinRoom(room.code, playerId, 'socket_new', sessionToken);
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
      const result = manager.addBot(room.code, 'Bot1', 'random');
      expect('error' in result).toBe(false);
      if ('error' in result) return;

      expect(result.botId).toBeDefined();
      const updated = manager.getRoom(room.code)!;
      expect(updated.players).toHaveLength(2);
      expect(updated.players[1].isBot).toBe(true);
      expect(updated.players[1].name).toBe('Bot1');
      expect(updated.players[1].personality).toBe('random');
      expect(updated.players[1].socketId).toBe('');
      expect(updated.players[1].connected).toBe(true);
    });

    it('rejects if room not found', () => {
      const result = manager.addBot('ZZZZZZ', 'Bot1', 'random');
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toContain('not found');
      }
    });

    it('rejects if game already in progress', () => {
      const { room } = manager.createRoom('Alice', 'socket1');
      manager.addBot(room.code, 'Bot1', 'random');
      manager.startGame(room.code);

      const result = manager.addBot(room.code, 'Bot2', 'random');
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toContain('in progress');
      }
    });

    it('rejects if room is full', () => {
      const { room } = manager.createRoom('P1', 's1');
      for (let i = 2; i <= 6; i++) {
        manager.addBot(room.code, `Bot${i}`, 'random');
      }
      const result = manager.addBot(room.code, 'Bot7', 'random');
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toContain('full');
      }
    });

    it('rejects duplicate names (case-insensitive)', () => {
      const { room } = manager.createRoom('Alice', 'socket1');
      const result = manager.addBot(room.code, 'alice', 'random');
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toContain('Name already taken');
      }
    });
  });

  describe('removeBot()', () => {
    it('removes a bot from the room', () => {
      const { room } = manager.createRoom('Alice', 'socket1');
      const addResult = manager.addBot(room.code, 'Bot1', 'random');
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
      const addResult = manager.addBot(room.code, 'Bot1', 'random');
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
      manager.addBot(room.code, 'Bot1', 'random');
      const joinResult = manager.joinRoom(room.code, 'Bob', 'socket2');
      if ('error' in joinResult) return;

      const updated = manager.leaveRoom(room.code, playerId);
      expect(updated).not.toBeNull();
      expect(updated!.hostId).toBe(joinResult.playerId); // Bob, not Bot1
    });

    it('deletes room if only bots remain after host leaves', () => {
      const { room, playerId } = manager.createRoom('Alice', 'socket1');
      manager.addBot(room.code, 'Bot1', 'random');
      manager.addBot(room.code, 'Bot2', 'random');

      const result = manager.leaveRoom(room.code, playerId);
      expect(result).toBeNull();
      expect(manager.getRoom(room.code)).toBeUndefined();
    });
  });

  describe('resetToLobby()', () => {
    it('preserves bots across rematch', () => {
      const { room } = manager.createRoom('Alice', 'socket1');
      manager.addBot(room.code, 'Bot1', 'random');
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
      manager.addBot(room.code, 'Bot1', 'random');
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
      manager.addBot(room.code, 'Bot1', 'random');
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
      manager.addBot(room.code, 'Bot1', 'random');
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
      manager.addBot(room.code, 'Bot1', 'random');
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
      manager.addBot(room.code, 'Bot1', 'random');

      const result = manager.startGame(room.code);
      expect('error' in result).toBe(false);

      const engine = manager.getEngine(room.code);
      expect(engine).toBeDefined();
      expect(engine!.game.players).toHaveLength(2);
    });

    it('bot counts toward minimum player requirement', () => {
      const { room } = manager.createRoom('Alice', 'socket1');
      manager.addBot(room.code, 'Bot1', 'random');

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

  // ─── Room Settings ───

  describe('Room settings', () => {
    it('createRoom initializes with default settings', () => {
      const { room } = manager.createRoom('Alice', 'socket1');
      expect(room.settings).toBeDefined();
      expect(room.settings.actionTimerSeconds).toBe(DEFAULT_ROOM_SETTINGS.actionTimerSeconds);
    });

    it('createRoom settings are a copy, not a reference', () => {
      const { room: room1 } = manager.createRoom('Alice', 'socket1');
      const { room: room2 } = manager.createRoom('Bob', 'socket2');
      room1.settings.actionTimerSeconds = 60;
      expect(room2.settings.actionTimerSeconds).toBe(DEFAULT_ROOM_SETTINGS.actionTimerSeconds);
    });
  });

  describe('updateSettings()', () => {
    it('updates action timer to a valid value', () => {
      const { room } = manager.createRoom('Alice', 'socket1');
      const result = manager.updateSettings(room.code, { actionTimerSeconds: 30, isPublic: false, botMinReactionSeconds: 2, turnTimerSeconds: 30, gameMode: GameMode.Classic, useInquisitor: false });
      expect('error' in result).toBe(false);

      const updated = manager.getRoom(room.code)!;
      expect(updated.settings.actionTimerSeconds).toBe(30);
    });

    it('accepts minimum timer value', () => {
      const { room } = manager.createRoom('Alice', 'socket1');
      const result = manager.updateSettings(room.code, { actionTimerSeconds: MIN_ACTION_TIMER, isPublic: false, botMinReactionSeconds: 2, turnTimerSeconds: 30, gameMode: GameMode.Classic, useInquisitor: false });
      expect('error' in result).toBe(false);

      const updated = manager.getRoom(room.code)!;
      expect(updated.settings.actionTimerSeconds).toBe(MIN_ACTION_TIMER);
    });

    it('accepts maximum timer value', () => {
      const { room } = manager.createRoom('Alice', 'socket1');
      const result = manager.updateSettings(room.code, { actionTimerSeconds: MAX_ACTION_TIMER, isPublic: false, botMinReactionSeconds: 2, turnTimerSeconds: 30, gameMode: GameMode.Classic, useInquisitor: false });
      expect('error' in result).toBe(false);

      const updated = manager.getRoom(room.code)!;
      expect(updated.settings.actionTimerSeconds).toBe(MAX_ACTION_TIMER);
    });

    it('rounds non-integer timer values', () => {
      const { room } = manager.createRoom('Alice', 'socket1');
      const result = manager.updateSettings(room.code, { actionTimerSeconds: 22.7, isPublic: false, botMinReactionSeconds: 2, turnTimerSeconds: 30, gameMode: GameMode.Classic, useInquisitor: false });
      expect('error' in result).toBe(false);

      const updated = manager.getRoom(room.code)!;
      expect(updated.settings.actionTimerSeconds).toBe(23);
    });

    it('rejects timer below minimum', () => {
      const { room } = manager.createRoom('Alice', 'socket1');
      const result = manager.updateSettings(room.code, { actionTimerSeconds: MIN_ACTION_TIMER - 1, isPublic: false, botMinReactionSeconds: 2, turnTimerSeconds: 30, gameMode: GameMode.Classic, useInquisitor: false });
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toContain('between');
      }
    });

    it('rejects timer above maximum', () => {
      const { room } = manager.createRoom('Alice', 'socket1');
      const result = manager.updateSettings(room.code, { actionTimerSeconds: MAX_ACTION_TIMER + 1, isPublic: false, botMinReactionSeconds: 2, turnTimerSeconds: 30, gameMode: GameMode.Classic, useInquisitor: false });
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toContain('between');
      }
    });

    it('rejects if room not found', () => {
      const result = manager.updateSettings('ZZZZZZ', { actionTimerSeconds: 30, isPublic: false, botMinReactionSeconds: 2, turnTimerSeconds: 30, gameMode: GameMode.Classic, useInquisitor: false });
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toContain('not found');
      }
    });

    it('rejects if game is in progress', () => {
      const { room } = manager.createRoom('Alice', 'socket1');
      manager.joinRoom(room.code, 'Bob', 'socket2');
      manager.startGame(room.code);

      const result = manager.updateSettings(room.code, { actionTimerSeconds: 30, isPublic: false, botMinReactionSeconds: 2, turnTimerSeconds: 30, gameMode: GameMode.Classic, useInquisitor: false });
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toContain('during a game');
      }
    });

    it('is case-insensitive on room code', () => {
      const { room } = manager.createRoom('Alice', 'socket1');
      const result = manager.updateSettings(room.code.toLowerCase(), { actionTimerSeconds: 30, isPublic: false, botMinReactionSeconds: 2, turnTimerSeconds: 30, gameMode: GameMode.Classic, useInquisitor: false });
      expect('error' in result).toBe(false);
    });
  });

  describe('Settings preserved across rematch', () => {
    it('resetToLobby preserves custom settings', () => {
      const { room } = manager.createRoom('Alice', 'socket1');
      manager.joinRoom(room.code, 'Bob', 'socket2');

      manager.updateSettings(room.code, { actionTimerSeconds: 45, isPublic: false, botMinReactionSeconds: 2, turnTimerSeconds: 30, gameMode: GameMode.Classic, useInquisitor: false });
      manager.startGame(room.code);

      const reset = manager.resetToLobby(room.code);
      expect(reset).not.toBeNull();
      expect(reset!.settings.actionTimerSeconds).toBe(45);
    });
  });

  describe('startGame() uses room settings for engine timer', () => {
    it('passes custom timer to engine', () => {
      const { room } = manager.createRoom('Alice', 'socket1');
      manager.joinRoom(room.code, 'Bob', 'socket2');
      manager.updateSettings(room.code, { actionTimerSeconds: 30, isPublic: false, botMinReactionSeconds: 2, turnTimerSeconds: 30, gameMode: GameMode.Classic, useInquisitor: false });

      const result = manager.startGame(room.code);
      expect('error' in result).toBe(false);

      const engine = manager.getEngine(room.code);
      expect(engine).toBeDefined();
      // Verify indirectly: trigger a challengeable action and check timer
      engine!.game.currentPlayerIndex = 0;
      engine!.game.turnPhase = TurnPhase.AwaitingAction as any;
      engine!.handleAction(engine!.game.players[0].id, ActionType.Tax as any);
      expect(engine!.timerExpiry).not.toBeNull();

      const expectedExpiry = Date.now() + 30_000;
      expect(engine!.timerExpiry!).toBeGreaterThanOrEqual(expectedExpiry - 200);
      expect(engine!.timerExpiry!).toBeLessThanOrEqual(expectedExpiry + 200);
    });

    it('uses default timer when settings are not changed', () => {
      const { room } = manager.createRoom('Alice', 'socket1');
      manager.joinRoom(room.code, 'Bob', 'socket2');

      const result = manager.startGame(room.code);
      expect('error' in result).toBe(false);

      const engine = manager.getEngine(room.code);
      expect(engine).toBeDefined();
      engine!.game.currentPlayerIndex = 0;
      engine!.game.turnPhase = TurnPhase.AwaitingAction as any;
      engine!.handleAction(engine!.game.players[0].id, ActionType.Tax as any);

      const expectedExpiry = Date.now() + DEFAULT_ROOM_SETTINGS.actionTimerSeconds * 1000;
      expect(engine!.timerExpiry!).toBeGreaterThanOrEqual(expectedExpiry - 200);
      expect(engine!.timerExpiry!).toBeLessThanOrEqual(expectedExpiry + 200);
    });
  });

  // ─── Public Room Features ───

  describe('Public room features', () => {
    it('createRoom defaults to isPublic: false', () => {
      const { room } = manager.createRoom('Alice', 'socket1');
      expect(room.settings.isPublic).toBe(false);
    });

    it('createRoom accepts isPublic: true', () => {
      const { room } = manager.createRoom('Alice', 'socket1', true);
      expect(room.settings.isPublic).toBe(true);
    });

    it('getPublicRooms returns only public rooms', () => {
      manager.createRoom('Alice', 'socket1', true);
      manager.createRoom('Bob', 'socket2', false);
      manager.createRoom('Charlie', 'socket3', true);

      const publicRooms = manager.getPublicRooms();
      expect(publicRooms).toHaveLength(2);
      expect(publicRooms.map(r => r.hostName)).toContain('Alice');
      expect(publicRooms.map(r => r.hostName)).toContain('Charlie');
      expect(publicRooms.map(r => r.hostName)).not.toContain('Bob');
    });

    it('getPublicRooms returns correct PublicRoomInfo shape', () => {
      const { room } = manager.createRoom('Alice', 'socket1', true);
      manager.joinRoom(room.code, 'Bob', 'socket2');

      const publicRooms = manager.getPublicRooms();
      expect(publicRooms).toHaveLength(1);

      const info = publicRooms[0];
      expect(info.code).toBe(room.code);
      expect(info.hostName).toBe('Alice');
      expect(info.playerCount).toBe(2);
      expect(info.maxPlayers).toBe(MAX_PLAYERS);
      expect(info.settings).toEqual({ actionTimerSeconds: 15, turnTimerSeconds: 30, isPublic: true, botMinReactionSeconds: 2, gameMode: GameMode.Classic, useInquisitor: false });
      expect(info.hasGame).toBe(false);
    });

    it('getPublicRooms shows hasGame: true when game in progress', () => {
      const { room } = manager.createRoom('Alice', 'socket1', true);
      manager.joinRoom(room.code, 'Bob', 'socket2');
      manager.startGame(room.code);

      const publicRooms = manager.getPublicRooms();
      expect(publicRooms).toHaveLength(1);
      expect(publicRooms[0].hasGame).toBe(true);
    });

    it('getPublicRooms returns empty array when no public rooms', () => {
      manager.createRoom('Alice', 'socket1', false);
      manager.createRoom('Bob', 'socket2');

      const publicRooms = manager.getPublicRooms();
      expect(publicRooms).toHaveLength(0);
    });

    it('getPublicRooms respects PUBLIC_ROOM_LIST_MAX', () => {
      for (let i = 0; i < PUBLIC_ROOM_LIST_MAX + 5; i++) {
        manager.createRoom(`Player${i}`, `socket${i}`, true);
      }

      const publicRooms = manager.getPublicRooms();
      expect(publicRooms).toHaveLength(PUBLIC_ROOM_LIST_MAX);
    });

    it('updateSettings can toggle isPublic on', () => {
      const { room } = manager.createRoom('Alice', 'socket1');
      expect(room.settings.isPublic).toBe(false);

      manager.updateSettings(room.code, { actionTimerSeconds: 15, isPublic: true, botMinReactionSeconds: 2, turnTimerSeconds: 30, gameMode: GameMode.Classic, useInquisitor: false });
      const updated = manager.getRoom(room.code)!;
      expect(updated.settings.isPublic).toBe(true);

      const publicRooms = manager.getPublicRooms();
      expect(publicRooms).toHaveLength(1);
    });

    it('updateSettings can toggle isPublic off', () => {
      const { room } = manager.createRoom('Alice', 'socket1', true);
      expect(room.settings.isPublic).toBe(true);

      manager.updateSettings(room.code, { actionTimerSeconds: 15, isPublic: false, botMinReactionSeconds: 2, turnTimerSeconds: 30, gameMode: GameMode.Classic, useInquisitor: false });
      const updated = manager.getRoom(room.code)!;
      expect(updated.settings.isPublic).toBe(false);

      const publicRooms = manager.getPublicRooms();
      expect(publicRooms).toHaveLength(0);
    });

    it('deleted room disappears from getPublicRooms', () => {
      const { room, playerId } = manager.createRoom('Alice', 'socket1', true);
      expect(manager.getPublicRooms()).toHaveLength(1);

      manager.leaveRoom(room.code, playerId);
      expect(manager.getPublicRooms()).toHaveLength(0);
    });

    it('resetToLobby preserves isPublic setting', () => {
      const { room } = manager.createRoom('Alice', 'socket1', true);
      manager.joinRoom(room.code, 'Bob', 'socket2');
      manager.startGame(room.code);

      const reset = manager.resetToLobby(room.code);
      expect(reset).not.toBeNull();
      expect(reset!.settings.isPublic).toBe(true);
    });
  });

  // ─── Inactive Room Cleanup ───

  describe('inactive room cleanup', () => {
    it('cleans up rooms with game engine but no connected humans after inactivity', () => {
      const { room } = manager.createRoom('Alice', 'socket1');
      manager.addBot(room.code, 'Bot1', 'random');
      manager.startGame(room.code);

      // Mark Alice as disconnected (simulates all humans leaving)
      const alice = room.players.find(p => !p.isBot)!;
      alice.connected = false;
      alice.isBot = true; // Simulate bot replacement
      alice.replacedByBot = true;

      expect(manager.getEngine(room.code)).toBeDefined();
      expect(manager.getActiveGameCount()).toBe(1);

      // Advance past INACTIVE_ROOM_CLEANUP_MS + cleanup interval
      vi.advanceTimersByTime(INACTIVE_ROOM_CLEANUP_MS + 60_000);

      // Room and engine should be cleaned up
      expect(manager.getRoom(room.code)).toBeUndefined();
      expect(manager.getEngine(room.code)).toBeUndefined();
      expect(manager.getActiveGameCount()).toBe(0);
    });

    it('does NOT clean up rooms with connected humans even after inactivity', () => {
      const { room } = manager.createRoom('Alice', 'socket1');
      manager.addBot(room.code, 'Bot1', 'random');
      manager.startGame(room.code);

      // Alice is still connected
      expect(room.players.find(p => !p.isBot)!.connected).toBe(true);

      // Advance past cleanup threshold
      vi.advanceTimersByTime(INACTIVE_ROOM_CLEANUP_MS + 60_000);

      // Room should still exist because Alice is connected
      expect(manager.getRoom(room.code)).toBeDefined();
      expect(manager.getEngine(room.code)).toBeDefined();
    });

    it('touchRoom resets the inactivity timer', () => {
      const { room } = manager.createRoom('Alice', 'socket1');
      manager.addBot(room.code, 'Bot1', 'random');
      manager.startGame(room.code);

      // Mark Alice as bot-replaced (no connected humans)
      const alice = room.players.find(p => !p.isBot)!;
      alice.connected = false;
      alice.isBot = true;
      alice.replacedByBot = true;

      // Advance 100s (less than 120s threshold)
      vi.advanceTimersByTime(100_000);

      // Touch the room (simulates human activity)
      manager.touchRoom(room.code);

      // Advance another 60s + cleanup interval (total 160s from touch, but only 60s since touch)
      vi.advanceTimersByTime(60_000 + 60_000);

      // Room should still exist because touchRoom reset the timer
      expect(manager.getRoom(room.code)).toBeDefined();

      // Now advance past 120s from the touch
      vi.advanceTimersByTime(60_000);

      // Now it should be cleaned up
      expect(manager.getRoom(room.code)).toBeUndefined();
    });

    it('does NOT clean up rooms without game engines', () => {
      const { room } = manager.createRoom('Alice', 'socket1');
      manager.addBot(room.code, 'Bot1', 'random');
      // No game started — no engine

      // Advance well past cleanup threshold
      vi.advanceTimersByTime(INACTIVE_ROOM_CLEANUP_MS + 60_000);

      // Room should still exist (no engine → not subject to inactive cleanup)
      expect(manager.getRoom(room.code)).toBeDefined();
    });
  });

  // ─── Finished Game Disconnect ───

  describe('leaveRoom() during finished game', () => {
    it('removes player from room when game is finished (not in progress)', () => {
      const { room, playerId } = manager.createRoom('Alice', 'socket1');
      manager.joinRoom(room.code, 'Bob', 'socket2');
      manager.startGame(room.code);

      // Simulate game finishing
      const engine = manager.getEngine(room.code)!;
      (engine.game as any).status = GameStatus.Finished;

      const updated = manager.leaveRoom(room.code, playerId);
      expect(updated).not.toBeNull();
      // Alice should be removed, not just marked disconnected
      expect(updated!.players.find(p => p.id === playerId)).toBeUndefined();
      expect(updated!.players).toHaveLength(1);
      expect(updated!.players[0].name).toBe('Bob');
    });

    it('still marks player as disconnected during in-progress game', () => {
      const { room, playerId } = manager.createRoom('Alice', 'socket1');
      manager.joinRoom(room.code, 'Bob', 'socket2');
      manager.startGame(room.code);

      // Game is InProgress by default after startGame
      const updated = manager.leaveRoom(room.code, playerId);
      expect(updated).not.toBeNull();
      const alice = updated!.players.find(p => p.id === playerId);
      expect(alice).toBeDefined();
      expect(alice!.connected).toBe(false);
    });

    it('deletes room when last human leaves finished game with only bots', () => {
      const { room, playerId } = manager.createRoom('Alice', 'socket1');
      manager.addBot(room.code, 'Bot1', 'random');
      manager.startGame(room.code);

      // Simulate game finishing
      const engine = manager.getEngine(room.code)!;
      (engine.game as any).status = GameStatus.Finished;

      const result = manager.leaveRoom(room.code, playerId);
      // Only bots remain → room deleted
      expect(result).toBeNull();
      expect(manager.getRoom(room.code)).toBeUndefined();
      expect(manager.getEngine(room.code)).toBeUndefined();
    });

    it('reassigns host when host leaves finished game', () => {
      const { room, playerId } = manager.createRoom('Alice', 'socket1');
      const bobResult = manager.joinRoom(room.code, 'Bob', 'socket2');
      if ('error' in bobResult) return;
      manager.startGame(room.code);

      // Simulate game finishing
      const engine = manager.getEngine(room.code)!;
      (engine.game as any).status = GameStatus.Finished;

      const updated = manager.leaveRoom(room.code, playerId);
      expect(updated).not.toBeNull();
      expect(updated!.hostId).toBe(bobResult.playerId);
    });
  });
});
