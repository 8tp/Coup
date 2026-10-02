import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RoomEvent, RoomManager } from '@/server/RoomManager';
import { METRIC_PREFIX } from '@/server/metrics';
import { GameLogStorage } from '@/server/storage/GameLogStorage';
import {
  AFK_TIMEOUTS_BEFORE_REPLACE,
  DISCONNECT_BOT_REPLACE_MS,
  LOBBY_DISCONNECT_GRACE_MS,
} from '@/shared/constants';
import { GameStatus } from '@/shared/types';
import { GameLog } from '@/shared/gameLogTypes';
import { MetricEvent } from '@/shared/metricTypes';

/** Finish the room's game by revealing every influence except the winner's. */
function finishGame(manager: RoomManager, roomCode: string, winnerId: string): void {
  const engine = manager.getEngine(roomCode)!;
  for (const player of engine.game.players) {
    if (player.id === winnerId) continue;
    for (const influence of player.influences) influence.revealed = true;
    engine.game.log(`${player.name} has been eliminated!`, 'elimination', null, player.id, player.name);
  }
  engine.game.checkWinCondition();
  expect(engine.game.status).toBe(GameStatus.Finished);
}

describe('RoomManager — lobby resilience, AFK and finished rooms', () => {
  let manager: RoomManager;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    manager = new RoomManager();
  });

  afterEach(() => {
    manager.destroy();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // ─── 1. Lobby disconnect grace ───

  describe('lobby disconnect grace', () => {
    it('keeps a dropped lobby seat as disconnected until the grace period ends', () => {
      const { room } = manager.createRoom('Alice', 's1');
      const bob = manager.joinRoom(room.code, 'Bob', 's2');
      if ('error' in bob) throw new Error(bob.error);
      const onExpired = vi.fn();

      const outcome = manager.disconnectPlayer(room.code, bob.playerId, onExpired);

      expect(outcome?.kind).toBe('lobby_grace');
      expect(room.players.find(p => p.id === bob.playerId)?.connected).toBe(false);
      expect(manager.hasDisconnectTimer(room.code, bob.playerId)).toBe(true);

      vi.advanceTimersByTime(LOBBY_DISCONNECT_GRACE_MS - 1);
      expect(room.players).toHaveLength(2);
      expect(onExpired).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(room.players.map(p => p.name)).toEqual(['Alice']);
      expect(onExpired).toHaveBeenCalledWith(room);
    });

    it('restores the seat when the player rejoins within the grace window', () => {
      const { room, playerId, sessionToken } = manager.createRoom('Alice', 's1');
      manager.joinRoom(room.code, 'Bob', 's2');

      manager.disconnectPlayer(room.code, playerId);
      vi.advanceTimersByTime(LOBBY_DISCONNECT_GRACE_MS / 2);

      const rejoin = manager.rejoinRoom(room.code, playerId, 's1-new', sessionToken);
      expect('error' in rejoin).toBe(false);
      manager.cancelDisconnectTimer(room.code, playerId);

      vi.advanceTimersByTime(LOBBY_DISCONNECT_GRACE_MS * 2);
      expect(room.players.find(p => p.id === playerId)).toMatchObject({ connected: true, socketId: 's1-new' });
      expect(room.hostId).toBe(playerId);
    });

    it('does not drop a player who came back even if the timer was not cancelled', () => {
      const { room, playerId, sessionToken } = manager.createRoom('Alice', 's1');
      manager.disconnectPlayer(room.code, playerId);
      manager.rejoinRoom(room.code, playerId, 's1-new', sessionToken);

      vi.advanceTimersByTime(LOBBY_DISCONNECT_GRACE_MS);
      expect(manager.getRoom(room.code)?.players).toHaveLength(1);
    });

    it('keeps a lone host\'s room alive through a refresh, and closes it if they never return', () => {
      const { room, playerId } = manager.createRoom('Alice', 's1');
      manager.addBot(room.code, 'Bot1', 'random');
      const onExpired = vi.fn();

      manager.disconnectPlayer(room.code, playerId, onExpired);
      expect(manager.getRoom(room.code)).toBeDefined();

      vi.advanceTimersByTime(LOBBY_DISCONNECT_GRACE_MS);
      expect(manager.getRoom(room.code)).toBeUndefined();
      expect(onExpired).toHaveBeenCalledWith(null);
    });

    it('reassigns host to a human (never a bot) when a disconnected host times out', () => {
      const { room, playerId } = manager.createRoom('Alice', 's1');
      manager.addBot(room.code, 'Bot1', 'random');
      const bob = manager.joinRoom(room.code, 'Bob', 's2');
      if ('error' in bob) throw new Error(bob.error);

      manager.disconnectPlayer(room.code, playerId);
      expect(room.hostId).toBe(playerId); // host keeps the seat during grace

      vi.advanceTimersByTime(LOBBY_DISCONNECT_GRACE_MS);
      expect(room.hostId).toBe(bob.playerId);
    });

    it('also applies on the finished-game screen', () => {
      const { room, playerId } = manager.createRoom('Alice', 's1');
      const bob = manager.joinRoom(room.code, 'Bob', 's2');
      if ('error' in bob) throw new Error(bob.error);
      manager.startGame(room.code);
      finishGame(manager, room.code, playerId);

      const outcome = manager.disconnectPlayer(room.code, bob.playerId);
      expect(outcome?.kind).toBe('lobby_grace');
      expect(room.players).toHaveLength(2);

      vi.advanceTimersByTime(LOBBY_DISCONNECT_GRACE_MS);
      expect(room.players.map(p => p.name)).toEqual(['Alice']);
    });

    it('explicit leave in the lobby still removes the seat immediately', () => {
      const { room } = manager.createRoom('Alice', 's1');
      const bob = manager.joinRoom(room.code, 'Bob', 's2');
      if ('error' in bob) throw new Error(bob.error);

      manager.leaveRoom(room.code, bob.playerId);
      expect(room.players.map(p => p.name)).toEqual(['Alice']);
    });

    it('host kicking a disconnected player cancels their grace timer', () => {
      const { room } = manager.createRoom('Alice', 's1');
      const bob = manager.joinRoom(room.code, 'Bob', 's2');
      if ('error' in bob) throw new Error(bob.error);

      manager.disconnectPlayer(room.code, bob.playerId);
      manager.removePlayer(room.code, bob.playerId);
      expect(manager.hasDisconnectTimer(room.code, bob.playerId)).toBe(false);
    });

    it('starting with a disconnected lobby player seats them and hands over to the in-game bot timer', () => {
      const { room } = manager.createRoom('Alice', 's1');
      const bob = manager.joinRoom(room.code, 'Bob', 's2');
      if ('error' in bob) throw new Error(bob.error);
      manager.disconnectPlayer(room.code, bob.playerId);

      const onSeatExpired = vi.fn((playerId: string) => manager.replaceWithBot(room.code, playerId));
      const engine = manager.startGame(room.code, { onDisconnectedSeatExpired: onSeatExpired });
      if ('error' in engine) throw new Error(engine.error);

      // Bob is dealt in; the lobby grace no longer removes him.
      expect(engine.game.getPlayer(bob.playerId)).toBeDefined();
      vi.advanceTimersByTime(LOBBY_DISCONNECT_GRACE_MS);
      expect(room.players.find(p => p.id === bob.playerId)?.isBot).toBeFalsy();

      vi.advanceTimersByTime(DISCONNECT_BOT_REPLACE_MS - LOBBY_DISCONNECT_GRACE_MS);
      expect(onSeatExpired).toHaveBeenCalledWith(bob.playerId);
      expect(room.players.find(p => p.id === bob.playerId)).toMatchObject({ isBot: true, replacedByBot: true });
      expect(room.hostId).not.toBe(bob.playerId);
    });
  });

  // ─── 2. Explicit leave mid-game ───

  describe('explicit leave during a game', () => {
    it('detaches the socket so the seat can be handed to a bot immediately', () => {
      const { room, playerId } = manager.createRoom('Alice', 's1');
      const bob = manager.joinRoom(room.code, 'Bob', 's2');
      if ('error' in bob) throw new Error(bob.error);
      manager.startGame(room.code);

      const after = manager.leaveRoom(room.code, playerId);
      expect(after).not.toBeNull();
      expect(manager.getPlayerRoom('s1')).toBeNull();

      expect(manager.replaceWithBot(room.code, playerId, 'left')).toBe(true);
      expect(room.players.find(p => p.id === playerId)).toMatchObject({ isBot: true, replacedByBot: true, personality: 'optimal' });
      expect(room.hostId).toBe(bob.playerId);
      const log = manager.getEngine(room.code)!.game.actionLog.map(e => e.message);
      expect(log).toContain('Alice left — a bot took their seat.');
    });

    it('closes the room instead when the last human walks away mid-game', () => {
      const { room, playerId } = manager.createRoom('Alice', 's1');
      manager.addBot(room.code, 'Bot1', 'random');
      manager.startGame(room.code);

      expect(manager.leaveRoom(room.code, playerId)).toBeNull();
      expect(manager.getRoom(room.code)).toBeUndefined();
      expect(manager.getEngine(room.code)).toBeUndefined();
    });
  });

  // ─── 3. AFK ───

  describe('AFK replacement', () => {
    function startTwoHumanGame() {
      const { room, playerId } = manager.createRoom('Alice', 's1');
      const bob = manager.joinRoom(room.code, 'Bob', 's2');
      if ('error' in bob) throw new Error(bob.error);
      manager.addBot(room.code, 'Bot1', 'random');
      manager.startGame(room.code);
      return { room, aliceId: playerId, bobId: bob.playerId, botId: room.players.find(p => p.isBot)!.id };
    }

    it(`asks for replacement after ${AFK_TIMEOUTS_BEFORE_REPLACE} consecutive timeouts`, () => {
      const { room, bobId } = startTwoHumanGame();
      const results = Array.from({ length: AFK_TIMEOUTS_BEFORE_REPLACE }, () => manager.recordTurnTimeout(room.code, bobId));
      expect(results.slice(0, -1).every(r => r === false)).toBe(true);
      expect(results[results.length - 1]).toBe(true);
    });

    it('resets the count when the player acts', () => {
      const { room, bobId } = startTwoHumanGame();
      expect(manager.recordTurnTimeout(room.code, bobId)).toBe(false);
      manager.clearAfkStrikes(room.code, bobId);
      expect(manager.getAfkStrikes(room.code, bobId)).toBe(0);
      expect(manager.recordTurnTimeout(room.code, bobId)).toBe(false);
    });

    it('ignores bots and disconnected players', () => {
      const { room, bobId, botId } = startTwoHumanGame();
      for (let i = 0; i < 5; i++) expect(manager.recordTurnTimeout(room.code, botId)).toBe(false);
      manager.disconnectPlayer(room.code, bobId);
      for (let i = 0; i < 5; i++) expect(manager.recordTurnTimeout(room.code, bobId)).toBe(false);
    });

    it('replaces a still-connected idle player, frees their socket and logs it', () => {
      const { room, aliceId, bobId } = startTwoHumanGame();
      expect(manager.replaceWithBot(room.code, aliceId, 'afk')).toBe(true);

      expect(room.players.find(p => p.id === aliceId)).toMatchObject({ isBot: true, replacedByBot: true, socketId: '' });
      expect(manager.getPlayerRoom('s1')).toBeNull();
      expect(room.hostId).toBe(bobId); // host passes to a human, never a bot
      const log = manager.getEngine(room.code)!.game.actionLog.map(e => e.message);
      expect(log).toContain('Alice was idle — a bot took their seat.');
    });

    it('a disconnect-reason replacement still refuses a player who reconnected', () => {
      const { room, aliceId } = startTwoHumanGame();
      expect(manager.replaceWithBot(room.code, aliceId, 'disconnect')).toBe(false);
    });
  });

  // ─── 4. Finished games do not block joining ───

  describe('joining a finished room', () => {
    it('lets new players join after the game finishes, but not during it', () => {
      const { room, playerId } = manager.createRoom('Alice', 's1', true);
      manager.joinRoom(room.code, 'Bob', 's2');
      manager.startGame(room.code);

      expect(manager.joinRoom(room.code, 'Carol', 's3')).toEqual({ error: 'Game already in progress' });
      expect(manager.getPublicRooms()[0]).toMatchObject({ hasGame: true, betweenGames: false });

      finishGame(manager, room.code, playerId);
      const carol = manager.joinRoom(room.code, 'Carol', 's3');
      expect('error' in carol).toBe(false);
      expect(manager.getPublicRooms()[0]).toMatchObject({ hasGame: false, betweenGames: true, playerCount: 3 });

      // Carol is seated for the rematch
      const reset = manager.resetToLobby(room.code);
      expect(reset?.room.players.map(p => p.name)).toEqual(['Alice', 'Bob', 'Carol']);
      expect(manager.getPublicRooms()[0]).toMatchObject({ hasGame: false, betweenGames: false });
    });
  });

  // ─── Review regressions ───

  describe('finished rooms never get stuck', () => {
    function soloQuickPlayFinished() {
      const { room, playerId } = manager.createRoom('Alice', 's1', true, 'quick_play');
      manager.addBot(room.code, 'Bot1', 'random');
      manager.addBot(room.code, 'Bot2', 'random');
      manager.addBot(room.code, 'Bot3', 'random');
      manager.startGame(room.code);
      finishGame(manager, room.code, playerId);
      manager.onGameFinished(room.code);
      return { room, aliceId: playerId };
    }

    it('solo Play-vs-Bots, friend joins after the game, host leaves: room resets so the friend can host', () => {
      const events: RoomEvent[] = [];
      manager.setRoomEventListener(e => events.push(e));
      const { room, aliceId } = soloQuickPlayFinished();
      const carol = manager.joinRoom(room.code, 'Carol', 's3');
      if ('error' in carol) throw new Error(carol.error);

      manager.leaveRoom(room.code, aliceId);

      expect(manager.getEngine(room.code)).toBeUndefined();
      expect(room.gameState).toBeNull();
      expect(room.hostId).toBe(carol.playerId);
      expect(room.players.map(p => p.name)).toEqual(['Bot1', 'Bot2', 'Bot3', 'Carol']);
      expect(events.map(e => e.type)).toContain('reset_to_lobby');
      expect(manager.getPublicRooms()[0]).toMatchObject({ hasGame: false, betweenGames: false });

      // The new host can actually play
      expect('error' in manager.addBot(room.code, 'Bot4', 'random')).toBe(false);
      expect('error' in manager.startGame(room.code)).toBe(false);
    });

    it('same when the original host drops and never comes back', () => {
      const { room, aliceId } = soloQuickPlayFinished();
      const carol = manager.joinRoom(room.code, 'Carol', 's3');
      if ('error' in carol) throw new Error(carol.error);

      manager.disconnectPlayer(room.code, aliceId);
      expect(room.hostId).toBe(aliceId); // seat held during grace
      vi.advanceTimersByTime(LOBBY_DISCONNECT_GRACE_MS);

      expect(room.gameState).toBeNull();
      expect(room.hostId).toBe(carol.playerId);
    });

    it('keeps the game-over screen while a seated human is still around', () => {
      const { room, playerId } = manager.createRoom('Alice', 's1');
      const bob = manager.joinRoom(room.code, 'Bob', 's2');
      if ('error' in bob) throw new Error(bob.error);
      manager.startGame(room.code);
      finishGame(manager, room.code, playerId);
      manager.onGameFinished(room.code);
      manager.joinRoom(room.code, 'Carol', 's3');

      manager.leaveRoom(room.code, playerId);
      expect(room.hostId).toBe(bob.playerId); // seated human preferred over the newcomer
      expect(manager.getEngine(room.code)).toBeDefined();
    });
  });

  describe('grace across game end and rematch', () => {
    it('a player who refreshed on the game-over screen survives a quick rematch', () => {
      const { room, playerId } = manager.createRoom('Alice', 's1');
      const bob = manager.joinRoom(room.code, 'Bob', 's2');
      if ('error' in bob) throw new Error(bob.error);
      manager.startGame(room.code);
      finishGame(manager, room.code, playerId);
      manager.onGameFinished(room.code);

      manager.disconnectPlayer(room.code, bob.playerId);
      manager.resetToLobby(room.code);

      expect(room.players.find(p => p.id === bob.playerId)?.connected).toBe(false);
      expect(manager.hasDisconnectTimer(room.code, bob.playerId)).toBe(true);
      expect('error' in manager.rejoinRoom(room.code, bob.playerId, 's2b', bob.sessionToken)).toBe(false);
    });

    it('a grace player who never returns after the rematch is still released', () => {
      const { room, playerId } = manager.createRoom('Alice', 's1');
      const bob = manager.joinRoom(room.code, 'Bob', 's2');
      if ('error' in bob) throw new Error(bob.error);
      manager.startGame(room.code);
      finishGame(manager, room.code, playerId);
      manager.disconnectPlayer(room.code, bob.playerId);
      manager.resetToLobby(room.code);

      vi.advanceTimersByTime(LOBBY_DISCONNECT_GRACE_MS);
      expect(room.players.map(p => p.name)).toEqual(['Alice']);
    });

    it('players who dropped mid-game get lobby grace once the game ends, then are released', () => {
      const { room, playerId } = manager.createRoom('Alice', 's1');
      const bob = manager.joinRoom(room.code, 'Bob', 's2');
      if ('error' in bob) throw new Error(bob.error);
      manager.addBot(room.code, 'Bot1', 'random');
      manager.startGame(room.code);
      // Bob is eliminated, then drops: eliminated players get no bot timer.
      for (const inf of manager.getEngine(room.code)!.game.getPlayer(bob.playerId)!.influences) inf.revealed = true;
      manager.disconnectPlayer(room.code, bob.playerId);

      finishGame(manager, room.code, playerId);
      manager.onGameFinished(room.code);
      expect(manager.hasDisconnectTimer(room.code, bob.playerId)).toBe(true);

      vi.advanceTimersByTime(LOBBY_DISCONNECT_GRACE_MS);
      expect(room.players.find(p => p.id === bob.playerId)).toBeUndefined();
    });

    it('a host who dropped mid-game hands host to a connected human at game end', () => {
      const { room, playerId } = manager.createRoom('Alice', 's1');
      const bob = manager.joinRoom(room.code, 'Bob', 's2');
      if ('error' in bob) throw new Error(bob.error);
      manager.startGame(room.code);
      manager.disconnectPlayer(room.code, playerId);

      finishGame(manager, room.code, bob.playerId);
      manager.onGameFinished(room.code);
      expect(room.hostId).toBe(bob.playerId);
    });

    it('an eliminated host leaving mid-game hands host to a connected human', () => {
      const { room, playerId } = manager.createRoom('Alice', 's1');
      const bob = manager.joinRoom(room.code, 'Bob', 's2');
      if ('error' in bob) throw new Error(bob.error);
      manager.joinRoom(room.code, 'Carol', 's3');
      manager.startGame(room.code);
      for (const inf of manager.getEngine(room.code)!.game.getPlayer(playerId)!.influences) inf.revealed = true;

      manager.leaveRoom(room.code, playerId);
      expect(manager.replaceWithBot(room.code, playerId, 'left')).toBe(false); // dead seat: no bot
      expect(room.hostId).toBe(bob.playerId);
    });
  });

  describe('rejoin hardening', () => {
    it('never lets a socket rejoin as a bot', () => {
      const { room } = manager.createRoom('Alice', 's1');
      const bot = manager.addBot(room.code, 'Bot1', 'random');
      if ('error' in bot) throw new Error(bot.error);
      expect(manager.rejoinRoom(room.code, bot.botId, 'evil')).toEqual({ error: 'Player not found in room' });
      expect(manager.rejoinRoom(room.code, bot.botId, 'evil', 'anything')).toEqual({ error: 'Player not found in room' });
      expect(room.players.find(p => p.id === bot.botId)?.socketId).toBe('');
    });

    it('always requires the session token', () => {
      const { room, playerId } = manager.createRoom('Alice', 's1');
      manager.disconnectPlayer(room.code, playerId);
      expect(manager.rejoinRoom(room.code, playerId, 's1b')).toEqual({ error: 'Invalid session token' });
      expect(manager.rejoinRoom(room.code, playerId, 's1b', 'wrong')).toEqual({ error: 'Invalid session token' });
    });

    it('resets AFK strikes on a successful rejoin', () => {
      const { room, playerId, sessionToken } = manager.createRoom('Alice', 's1');
      manager.joinRoom(room.code, 'Bob', 's2');
      manager.startGame(room.code);
      manager.recordTurnTimeout(room.code, playerId);
      expect(manager.getAfkStrikes(room.code, playerId)).toBe(1);

      manager.disconnectPlayer(room.code, playerId);
      manager.rejoinRoom(room.code, playerId, 's1b', sessionToken);
      expect(manager.getAfkStrikes(room.code, playerId)).toBe(0);
    });
  });

  describe('host is never left on a bot', () => {
    it('closes the room when the last human seat goes to a bot', () => {
      const events: RoomEvent[] = [];
      manager.setRoomEventListener(e => events.push(e));
      const { room, playerId } = manager.createRoom('Alice', 's1', true);
      manager.addBot(room.code, 'Bot1', 'random');
      manager.startGame(room.code);

      expect(manager.replaceWithBot(room.code, playerId, 'afk')).toBe(true);
      expect(manager.getRoom(room.code)).toBeUndefined();
      expect(events).toContainEqual({ type: 'closed', roomCode: room.code, wasPublic: true });
    });

    it('falls back to a disconnected human rather than a bot', () => {
      const { room, playerId } = manager.createRoom('Alice', 's1');
      const bob = manager.joinRoom(room.code, 'Bob', 's2');
      if ('error' in bob) throw new Error(bob.error);
      manager.startGame(room.code);
      manager.disconnectPlayer(room.code, bob.playerId);

      manager.replaceWithBot(room.code, playerId, 'afk');
      expect(room.hostId).toBe(bob.playerId);
    });
  });

  // ─── 9. Metrics ───

  describe('structured metrics', () => {
    function metrics(): MetricEvent[] {
      const logSpy = console.log as unknown as ReturnType<typeof vi.fn>;
      return logSpy.mock.calls
        .map(args => args[0])
        .filter((line): line is string => typeof line === 'string' && line.startsWith(`${METRIC_PREFIX} `))
        .map(line => JSON.parse(line.slice(METRIC_PREFIX.length + 1)) as MetricEvent);
    }

    function rawMetricLines(): string[] {
      const logSpy = console.log as unknown as ReturnType<typeof vi.fn>;
      return logSpy.mock.calls.map(args => String(args[0])).filter(line => line.startsWith(METRIC_PREFIX));
    }

    it('emits one JSON line per lifecycle event with the documented shape', () => {
      const { room, playerId, sessionToken } = manager.createRoom('Alice', 'secret-socket-1', false, 'quick_play');
      manager.addBot(room.code, 'Bot1', 'random');
      manager.addBot(room.code, 'Bot2', 'aggressive');
      manager.startGame(room.code);
      finishGame(manager, room.code, playerId);
      manager.recordGameFinished(room.code);
      manager.recordGameFinished(room.code); // idempotent
      manager.leaveRoom(room.code, playerId);

      const events = metrics();
      expect(events.map(e => e.event)).toEqual(['room_created', 'game_started', 'game_finished', 'room_closed']);

      const [created, started, finished, closed] = events;
      // Metrics never carry the room code (a join credential) — a random per-room id instead.
      const roomId = created.room;
      expect(roomId).toMatch(/^[0-9a-f]{10}$/);
      expect(roomId).not.toBe(room.code);
      expect(events.every(e => e.room === roomId)).toBe(true);
      expect(created).toMatchObject({ event: 'room_created', isPublic: false, viaQuickPlay: true, practice: false });
      expect(started).toMatchObject({
        event: 'game_started',
        players: 3,
        humans: 1,
        bots: 2,
        botPersonalities: ['random', 'aggressive'],
        gameMode: 'Classic',
        useInquisitor: false,
        actionTimerMs: 15_000,
        turnTimerMs: 30_000,
        isPublic: false,
        viaQuickPlay: true,
        practice: false,
        rematchIndex: 0,
      });
      expect(typeof (started as { gameId: string }).gameId).toBe('string');
      expect(finished).toMatchObject({
        event: 'game_finished',
        gameId: (started as { gameId: string }).gameId,
        winnerIsBot: false,
        winnerWasReplaced: false,
        humans: 1,
        bots: 2,
        replacedByBot: 0,
        eliminations: 2,
        gameMode: 'Classic',
        rematchIndex: 0,
      });
      expect((finished as { durationMs: number }).durationMs).toBeGreaterThanOrEqual(0);
      expect((finished as { turns: number }).turns).toBeGreaterThanOrEqual(1);
      expect(closed).toMatchObject({
        event: 'room_closed',
        reason: 'empty',
        everStarted: true,
        gamesStarted: 1,
        gamesPlayed: 1,
        viaQuickPlay: true,
      });

      // Every line carries a timestamp and no PII / secrets.
      for (const line of rawMetricLines()) {
        expect(line).toMatch(/"ts":"\d{4}-\d{2}-\d{2}T/);
        expect(line).not.toContain('secret-socket-1');
        expect(line).not.toContain(sessionToken);
        expect(line).not.toContain(playerId);
        expect(line).not.toContain('Alice');
        expect(line).not.toContain(`"${room.code}`);
      }
    });

    it('counts rematches and lobbies that never started', () => {
      const { room, playerId } = manager.createRoom('Alice', 's1');
      manager.addBot(room.code, 'Bot1', 'random');
      manager.startGame(room.code);
      finishGame(manager, room.code, playerId);
      manager.recordGameFinished(room.code);
      manager.resetToLobby(room.code);
      manager.startGame(room.code);

      const starts = metrics().filter(e => e.event === 'game_started');
      expect(starts.map(e => (e as { rematchIndex: number }).rematchIndex)).toEqual([0, 1]);

      const { room: idle, playerId: idleHost } = manager.createRoom('Zed', 's9');
      const idleId = metrics().filter(e => e.event === 'room_created').pop()!.room;
      manager.leaveRoom(idle.code, idleHost);
      const closed = metrics().find(e => e.event === 'room_closed' && e.room === idleId);
      expect(closed).toMatchObject({ everStarted: false, gamesStarted: 0, gamesPlayed: 0, reason: 'empty' });
    });

    it('emits game_abandoned and player_replaced_by_bot', () => {
      const { room, playerId } = manager.createRoom('Alice', 's1');
      const bob = manager.joinRoom(room.code, 'Bob', 's2');
      if ('error' in bob) throw new Error(bob.error);
      manager.startGame(room.code);

      manager.replaceWithBot(room.code, playerId, 'afk');
      manager.leaveRoom(room.code, bob.playerId); // last human leaves mid-game

      const events = metrics();
      const roomId = events.find(e => e.event === 'room_created')!.room;
      expect(events.find(e => e.event === 'player_replaced_by_bot')).toMatchObject({ room: roomId, reason: 'afk' });
      expect(events.find(e => e.event === 'game_abandoned')).toMatchObject({ room: roomId, humans: 2, bots: 0, reason: 'empty' });
      expect(events.find(e => e.event === 'room_closed')).toMatchObject({ everStarted: true, gamesPlayed: 0 });
    });

    it('tags inactive and TTL closures', () => {
      const { room } = manager.createRoom('Alice', 's1');
      manager.addBot(room.code, 'Bot1', 'random');
      manager.startGame(room.code);
      const alice = room.players.find(p => !p.isBot)!;
      alice.connected = false;

      vi.advanceTimersByTime(4 * 60_000);
      expect(metrics().find(e => e.event === 'room_closed')).toMatchObject({ reason: 'inactive' });
      expect(metrics().find(e => e.event === 'game_abandoned')).toMatchObject({ reason: 'inactive' });

      manager.createRoom('Old', 's2');
      const oldId = metrics().filter(e => e.event === 'room_created').pop()!.room;
      vi.advanceTimersByTime(24 * 60 * 60 * 1000 + 60_000);
      expect(metrics().find(e => e.event === 'room_closed' && e.room === oldId)).toMatchObject({ reason: 'ttl' });
    });

    it('hands finished games to durable storage without letting failures escape', async () => {
      const saved: GameLog[] = [];
      const storage: GameLogStorage = {
        saveGameLog: vi.fn(async (log: GameLog) => { saved.push(log); throw new Error('db down'); }),
        getGameLogs: vi.fn(async () => []),
        getGameLog: vi.fn(async () => null),
      };
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const withStorage = new RoomManager({ gameLogStorage: storage });
      try {
        const { room, playerId } = withStorage.createRoom('Alice', 's1');
        withStorage.addBot(room.code, 'Bot1', 'random');
        withStorage.startGame(room.code);
        const engine = withStorage.getEngine(room.code)!;
        for (const inf of engine.game.players.find(p => p.id !== playerId)!.influences) inf.revealed = true;
        engine.game.checkWinCondition();

        const log = withStorage.recordGameFinished(room.code);
        expect(log).not.toBeNull();
        await vi.waitFor(() => expect(errorSpy).toHaveBeenCalled());
        expect(saved).toHaveLength(1);
        expect(saved[0].gameId).toBe(log!.gameId);
        expect(saved[0].source).toBe('online');
      } finally {
        withStorage.destroy();
      }
    });
  });
});
