import { randomInt, randomBytes, randomUUID } from 'crypto';
import { BotPersonality, BotReplaceReason, ChatMessage, GameMode, GameStatus, PublicRoomInfo, Room, RoomOrigin, RoomPlayer, RoomSettings, Spectator } from '../shared/types';
import { AFK_TIMEOUTS_BEFORE_REPLACE, CHAT_MAX_HISTORY, CHAT_MAX_MESSAGE_LENGTH, CHAT_RATE_LIMIT_MS, DEFAULT_ROOM_SETTINGS, DISCONNECT_BOT_REPLACE_MS, INACTIVE_ROOM_CLEANUP_MS, LOBBY_DISCONNECT_GRACE_MS, MAX_ACTION_TIMER, MAX_BOT_REACTION_SECONDS, MAX_PLAYERS, MAX_TURN_TIMER, MIN_ACTION_TIMER, MIN_BOT_REACTION_SECONDS, MIN_PLAYERS, MIN_TURN_TIMER, PUBLIC_ROOM_LIST_MAX, REACTION_RATE_LIMIT_MS } from '../shared/constants';
import { RoomCloseReason, RoomMeta } from '../shared/metricTypes';
import { GameLog } from '../shared/gameLogTypes';
import { GameEngine } from '../engine/GameEngine';
import { BotController } from './BotController';
import { GameLogger } from './GameLogger';
import { emitMetric } from './metrics';
import { GameLogStorage } from './storage/GameLogStorage';

const MAX_SPECTATORS_PER_ROOM = 10;

const ROOM_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface RoomManagerOptions {
  /** Durable sink for finished-game logs. Writes are fire-and-forget. */
  gameLogStorage?: GameLogStorage | null;
}

/**
 * Room changes that happen outside a direct request (timers, automatic
 * resets), so the socket layer can broadcast them.
 */
export type RoomEvent =
  | { type: 'updated'; roomCode: string; room: Room }
  | { type: 'reset_to_lobby'; roomCode: string; room: Room; promoted: Array<{ spectator: Spectator; playerId: string; sessionToken: string }> }
  | { type: 'closed'; roomCode: string; wasPublic: boolean };

/** Result of a socket dropping (as opposed to an explicit leave). */
export type DisconnectOutcome =
  | { kind: 'in_game'; room: Room }
  | { kind: 'lobby_grace'; room: Room };

export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private engines: Map<string, GameEngine> = new Map();
  private botControllers: Map<string, BotController> = new Map();
  private chatMessages: Map<string, ChatMessage[]> = new Map();
  private lastChatTime: Map<string, number> = new Map();
  private lastReactionTime: Map<string, number> = new Map();
  private lastHumanActivityAt: Map<string, number> = new Map();
  private disconnectTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private spectators: Map<string, Spectator[]> = new Map(); // roomCode -> spectators
  /** `${roomCode}:${playerId}` -> consecutive turn-timer expiries on that player's own decisions */
  private afkStrikes: Map<string, number> = new Map();
  /** Server-only funnel bookkeeping per room (never sent to clients). */
  private roomMeta: Map<string, RoomMeta> = new Map();
  private gameLogStorage: GameLogStorage | null;
  private roomEventListener: ((event: RoomEvent) => void) | null = null;
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor(options: RoomManagerOptions = {}) {
    this.gameLogStorage = options.gameLogStorage ?? null;
    // Periodic cleanup of stale rooms
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);
  }

  /** Subscribe to timer-driven / automatic room changes (one listener). */
  setRoomEventListener(listener: ((event: RoomEvent) => void) | null): void {
    this.roomEventListener = listener;
  }

  private notify(event: RoomEvent): void {
    try {
      this.roomEventListener?.(event);
    } catch (err) {
      console.error('Error in room event listener:', err);
    }
  }

  generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Letters only, no ambiguous chars
    let code: string;
    do {
      code = '';
      for (let i = 0; i < 4; i++) {
        code += chars[randomInt(chars.length)];
      }
    } while (this.rooms.has(code));
    return code;
  }

  touchRoom(roomCode: string): void {
    this.lastHumanActivityAt.set(roomCode.toUpperCase(), Date.now());
  }

  createRoom(playerName: string, socketId: string, isPublic?: boolean, origin: RoomOrigin = 'standard'): { room: Room; playerId: string; sessionToken: string } {
    const code = this.generateRoomCode();
    const playerId = randomUUID();
    const sessionToken = randomBytes(32).toString('hex');

    const room: Room = {
      code,
      hostId: playerId,
      players: [
        {
          id: playerId,
          name: playerName,
          socketId,
          connected: true,
          sessionToken,
        },
      ],
      gameState: null,
      createdAt: Date.now(),
      settings: { ...DEFAULT_ROOM_SETTINGS, isPublic: !!isPublic },
    };

    this.rooms.set(code, room);
    this.lastHumanActivityAt.set(code, Date.now());
    const meta = this.createMeta(origin);
    this.roomMeta.set(code, meta);
    emitMetric({
      event: 'room_created',
      room: meta.metricId,
      isPublic: room.settings.isPublic,
      viaQuickPlay: origin === 'quick_play',
      practice: origin === 'practice',
    });
    return { room, playerId, sessionToken };
  }

  /** True while a game engine exists and has not finished. */
  isGameInProgress(roomCode: string): boolean {
    const engine = this.engines.get(roomCode.toUpperCase());
    return !!engine && engine.game.status === GameStatus.InProgress;
  }

  joinRoom(
    roomCode: string,
    playerName: string,
    socketId: string,
  ): { room: Room; playerId: string; sessionToken: string } | { error: string } {
    if (this.hasSocketMembership(socketId)) return { error: 'Socket is already a room member' };
    const room = this.rooms.get(roomCode.toUpperCase());
    if (!room) return { error: 'Room not found' };
    // A finished game no longer blocks joining: newcomers wait in the lobby
    // view and are seated when the host starts the rematch.
    if (room.gameState && this.isGameInProgress(room.code)) return { error: 'Game already in progress' };
    if (room.players.length >= MAX_PLAYERS) return { error: 'Room is full' };

    // Check for duplicate names
    if (room.players.some(p => p.name.toLowerCase() === playerName.toLowerCase())) {
      return { error: 'Name already taken in this room' };
    }

    const playerId = randomUUID();
    const sessionToken = randomBytes(32).toString('hex');
    room.players.push({
      id: playerId,
      name: playerName,
      socketId,
      connected: true,
      sessionToken,
    });

    this.lastHumanActivityAt.set(roomCode.toUpperCase(), Date.now());
    return { room, playerId, sessionToken };
  }

  addBot(
    roomCode: string,
    name: string,
    personality: BotPersonality,
  ): { botId: string } | { error: string } {
    const room = this.rooms.get(roomCode.toUpperCase());
    if (!room) return { error: 'Room not found' };
    if (room.gameState) return { error: 'Game already in progress' };
    if (room.players.length >= MAX_PLAYERS) return { error: 'Room is full' };

    if (room.players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
      return { error: 'Name already taken in this room' };
    }

    const botId = randomUUID();
    room.players.push({
      id: botId,
      name,
      socketId: '',
      connected: true,
      isBot: true,
      personality,
    });

    return { botId };
  }

  removeBot(roomCode: string, botId: string): { success: boolean } | { error: string } {
    const room = this.rooms.get(roomCode.toUpperCase());
    if (!room) return { error: 'Room not found' };
    if (room.gameState) return { error: 'Game already in progress' };

    const player = room.players.find(p => p.id === botId);
    if (!player) return { error: 'Player not found' };
    if (!player.isBot) return { error: 'Player is not a bot' };

    room.players = room.players.filter(p => p.id !== botId);
    return { success: true };
  }

  removePlayer(roomCode: string, playerId: string): { removedPlayer: RoomPlayer } | { error: string } {
    const room = this.rooms.get(roomCode.toUpperCase());
    if (!room) return { error: 'Room not found' };
    if (room.gameState) return { error: 'Game already in progress' };
    if (room.hostId === playerId) return { error: 'Cannot remove the host' };

    const player = room.players.find(p => p.id === playerId);
    if (!player) return { error: 'Player not found' };

    this.cancelDisconnectTimer(room.code, playerId);
    room.players = room.players.filter(p => p.id !== playerId);
    this.lastChatTime.delete(playerId);
    this.lastReactionTime.delete(playerId);
    return { removedPlayer: player };
  }

  getBotController(code: string): BotController | undefined {
    return this.botControllers.get(code.toUpperCase());
  }

  setBotController(code: string, controller: BotController): void {
    this.botControllers.set(code.toUpperCase(), controller);
  }

  rejoinRoom(
    roomCode: string,
    playerId: string,
    socketId: string,
    sessionToken?: string,
  ): { room: Room; player: RoomPlayer } | { error: string } {
    const existing = this.getPlayerRoom(socketId);
    const existingSpectator = this.getSpectatorRoom(socketId);
    if (existingSpectator || (existing && (existing.room.code !== roomCode.toUpperCase() || existing.player.id !== playerId))) {
      return { error: 'Socket is already a room member' };
    }
    const room = this.rooms.get(roomCode.toUpperCase());
    if (!room) return { error: 'Room not found' };

    const player = room.players.find(p => p.id === playerId);
    if (!player) return { error: 'Player not found in room' };

    if (player.replacedByBot) {
      return { error: 'A bot took your seat while you were inactive' };
    }

    // Bot seats are never claimable by a socket (bot ids are public in room:updated).
    if (player.isBot) return { error: 'Player not found in room' };

    // Every human seat has a session token; it is always required.
    if (!player.sessionToken || typeof sessionToken !== 'string' || player.sessionToken !== sessionToken) {
      return { error: 'Invalid session token' };
    }

    player.socketId = socketId;
    player.connected = true;
    // Coming back proves they're present: forget earlier idle timeouts.
    this.afkStrikes.delete(`${room.code}:${playerId}`);

    return { room, player };
  }

  /**
   * Explicit leave (`room:leave`). Lobby / finished game: the seat is removed
   * immediately. In-progress game: the player is detached from their socket
   * and marked disconnected so the caller can hand the seat to a bot right
   * away; if no other human is seated the room is closed instead.
   */
  leaveRoom(roomCode: string, playerId: string): Room | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;

    this.cancelDisconnectTimer(roomCode, playerId);
    this.afkStrikes.delete(`${roomCode}:${playerId}`);

    if (room.gameState && this.isGameInProgress(roomCode)) {
      const player = room.players.find(p => p.id === playerId);
      if (!player) return room;
      const otherHumans = room.players.some(p => p.id !== playerId && !p.isBot);
      if (!otherHumans) {
        // Nobody left to play with — don't leave bots grinding an empty table.
        this.deleteRoom(roomCode, 'empty');
        return null;
      }
      player.connected = false;
      player.socketId = '';
      if (room.hostId === playerId) this.reassignHost(room, playerId);
      return room;
    }

    return this.removePlayerFromRoom(room, playerId);
  }

  /** Human ids dealt into the current (possibly finished) game. */
  private seatedIds(roomCode: string): Set<string> {
    const engine = this.engines.get(roomCode);
    return new Set(engine ? engine.game.players.map(p => p.id) : []);
  }

  /**
   * Move host away from `departingId`, never to a bot. Preference: a connected
   * human seated in the current game, then any connected human, then any human.
   * Returns false if no human is left to take it.
   */
  private reassignHost(room: Room, departingId: string): boolean {
    const seated = this.seatedIds(room.code);
    const humans = room.players.filter(p => p.id !== departingId && !p.isBot);
    const next = humans.find(p => p.connected && seated.has(p.id))
      ?? humans.find(p => p.connected)
      ?? humans[0];
    if (!next) return false;
    room.hostId = next.id;
    return true;
  }

  /** Arm (or re-arm) the lobby grace timer for a disconnected human. */
  private armLobbyGrace(roomCode: string, playerId: string, onGraceExpired?: (room: Room | null) => void): void {
    this.startDisconnectTimer(roomCode, playerId, () => {
      const result = this.releaseDisconnectedSeat(roomCode, playerId);
      if (result === 'kept') return;
      onGraceExpired?.(result);
      if (result) this.notify({ type: 'updated', roomCode, room: result });
    }, LOBBY_DISCONNECT_GRACE_MS);
  }

  /**
   * A finished room whose host is not one of the players from that game (e.g.
   * a newcomer who joined after it ended) can't be rematched by anyone — only
   * seated players see the Play Again button. Reset it to the lobby instead.
   */
  private maybeAutoResetFinishedRoom(room: Room): Room | null {
    const engine = this.engines.get(room.code);
    if (!engine || engine.game.status !== GameStatus.Finished) return room;
    if (this.seatedIds(room.code).has(room.hostId)) return room;

    const result = this.resetToLobby(room.code);
    if (!result) return null;
    this.notify({ type: 'reset_to_lobby', roomCode: room.code, room: result.room, promoted: result.promoted });
    return result.room;
  }

  /**
   * Game just ended: humans who dropped mid-game (in-game timers no longer
   * apply after the finish) now get the normal lobby grace, so an unreturned
   * seat is eventually released instead of lingering until the 24h TTL. If the
   * host is gone, host passes to a connected human.
   */
  onGameFinished(roomCode: string): GameLog | null {
    const code = roomCode.toUpperCase();
    const log = this.recordGameFinished(code);
    const room = this.rooms.get(code);
    if (!room) return log;
    for (const player of room.players) {
      if (player.isBot || player.connected) continue;
      if (player.socketId === '') {
        // Explicitly left mid-game: nothing to wait for.
        this.cancelDisconnectTimer(code, player.id);
        continue;
      }
      this.armLobbyGrace(code, player.id);
    }
    const host = room.players.find(p => p.id === room.hostId);
    if (!host || host.isBot || !host.connected) {
      const connected = room.players.find(p => !p.isBot && p.connected && p.id !== room.hostId);
      if (connected) room.hostId = connected.id;
    }
    return log;
  }

  /**
   * Socket dropped without an explicit leave (refresh, tab close, mobile
   * backgrounding). In-progress game: mark disconnected (the caller starts the
   * bot-replacement timer). Lobby / finished game: mark disconnected and hold
   * the seat for LOBBY_DISCONNECT_GRACE_MS; `onGraceExpired` fires after the
   * seat is released, with the surviving room or null if it was closed.
   */
  disconnectPlayer(
    roomCode: string,
    playerId: string,
    onGraceExpired?: (room: Room | null) => void,
  ): DisconnectOutcome | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;
    const player = room.players.find(p => p.id === playerId);
    if (!player) return null;

    player.connected = false;

    if (room.gameState && this.isGameInProgress(roomCode)) {
      return { kind: 'in_game', room };
    }

    this.armLobbyGrace(roomCode, playerId, onGraceExpired);

    return { kind: 'lobby_grace', room };
  }

  /** Whether a disconnect (lobby grace or bot-replacement) timer is pending for a player. */
  hasDisconnectTimer(roomCode: string, playerId: string): boolean {
    return this.disconnectTimers.has(`${roomCode.toUpperCase()}:${playerId}`);
  }

  /** Lobby grace expired: drop the seat unless the player came back or a game started. */
  private releaseDisconnectedSeat(roomCode: string, playerId: string): Room | null | 'kept' {
    const room = this.rooms.get(roomCode);
    if (!room) return null;
    const player = room.players.find(p => p.id === playerId);
    if (!player || player.connected) return 'kept';
    if (this.isGameInProgress(roomCode)) return 'kept';
    return this.removePlayerFromRoom(room, playerId);
  }

  /** Remove a seat outright, reassigning host (humans only) or closing the room. */
  private removePlayerFromRoom(room: Room, playerId: string): Room | null {
    const roomCode = room.code;
    room.players = room.players.filter(p => p.id !== playerId);
    this.lastChatTime.delete(playerId);
    this.lastReactionTime.delete(playerId);

    // If room is empty, delete it
    if (room.players.length === 0) {
      this.deleteRoom(roomCode, 'empty');
      return null;
    }

    // If host left, assign new host (skip bots; prefer someone connected)
    if (room.hostId === playerId && !this.reassignHost(room, playerId)) {
      // All remaining are bots — delete the room
      this.deleteRoom(roomCode, 'empty');
      return null;
    }

    return this.maybeAutoResetFinishedRoom(room);
  }

  updateSettings(roomCode: string, settings: RoomSettings): { success: boolean } | { error: string } {
    const room = this.rooms.get(roomCode.toUpperCase());
    if (!room) return { error: 'Room not found' };
    if (room.gameState) return { error: 'Cannot change settings during a game' };

    // Validate and sanitize numeric inputs before any arithmetic
    const rawTimer = Number(settings.actionTimerSeconds);
    if (!Number.isFinite(rawTimer)) {
      return { error: 'Invalid action timer value' };
    }
    const timer = Math.round(rawTimer);
    if (timer < MIN_ACTION_TIMER || timer > MAX_ACTION_TIMER) {
      return { error: `Timer must be between ${MIN_ACTION_TIMER} and ${MAX_ACTION_TIMER} seconds` };
    }

    // Validate turn timer: clamp to [MIN_TURN_TIMER, MAX_TURN_TIMER]
    const rawTurnTimer = Number(settings.turnTimerSeconds ?? room.settings.turnTimerSeconds);
    if (!Number.isFinite(rawTurnTimer)) {
      return { error: 'Invalid turn timer value' };
    }
    const turnTimer = Math.max(MIN_TURN_TIMER, Math.min(MAX_TURN_TIMER, Math.round(rawTurnTimer)));

    // Validate bot min reaction time: clamp to [MIN, MAX], round to nearest 0.5, cap at action timer
    const rawBotReaction = Number(settings.botMinReactionSeconds ?? room.settings.botMinReactionSeconds);
    if (!Number.isFinite(rawBotReaction)) {
      return { error: 'Invalid bot reaction time value' };
    }
    let botReaction = Math.max(MIN_BOT_REACTION_SECONDS, Math.min(MAX_BOT_REACTION_SECONDS, rawBotReaction));
    botReaction = Math.round(botReaction * 2) / 2; // round to nearest 0.5
    botReaction = Math.min(botReaction, timer); // can't exceed action timer

    // Validate game mode and inquisitor settings
    const gameMode = settings.gameMode === GameMode.Reformation ? GameMode.Reformation : GameMode.Classic;
    const useInquisitor = gameMode === 'Reformation' ? !!settings.useInquisitor : false;

    room.settings = { actionTimerSeconds: timer, turnTimerSeconds: turnTimer, isPublic: !!settings.isPublic, botMinReactionSeconds: botReaction, gameMode, useInquisitor };
    return { success: true };
  }

  getPublicRooms(): PublicRoomInfo[] {
    const result: PublicRoomInfo[] = [];
    for (const room of this.rooms.values()) {
      if (!room.settings.isPublic) continue;
      result.push({
        code: room.code,
        hostName: room.players.find(p => p.id === room.hostId)?.name || 'Unknown',
        playerCount: room.players.length,
        maxPlayers: MAX_PLAYERS,
        settings: { ...room.settings },
        hasGame: this.isGameInProgress(room.code),
        betweenGames: room.gameState !== null && !this.isGameInProgress(room.code),
        spectatorCount: this.getSpectators(room.code).length,
      });
      if (result.length >= PUBLIC_ROOM_LIST_MAX) break;
    }
    return result;
  }

  getActiveGameCount(): number {
    return this.engines.size;
  }

  getRoom(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  getEngine(code: string): GameEngine | undefined {
    return this.engines.get(code.toUpperCase());
  }

  /**
   * Start a game with every seated player. Humans whose socket is down at
   * start keep their seat: their lobby grace timer is swapped for the normal
   * in-game DISCONNECT_BOT_REPLACE_MS timer (`onDisconnectedSeatExpired`), so
   * they can rejoin straight into the game, or a bot takes over if they never return.
   */
  startGame(
    roomCode: string,
    options: { onDisconnectedSeatExpired?: (playerId: string) => void } = {},
  ): GameEngine | { error: string } {
    const room = this.rooms.get(roomCode);
    if (!room) return { error: 'Room not found' };
    if (room.players.length < MIN_PLAYERS) return { error: `Need at least ${MIN_PLAYERS} players` };
    if (room.gameState) return { error: 'Game already in progress' };

    // Clear previous game's winner so the onStateChange guard can detect new wins
    room.lastWinnerId = undefined;

    const timerMs = room.settings.actionTimerSeconds * 1000;
    const turnTimerMs = room.settings.turnTimerSeconds * 1000;
    const engine = new GameEngine(roomCode, timerMs, turnTimerMs);
    engine.startGame(
      room.players.map(p => ({ id: p.id, name: p.name })),
      { gameMode: room.settings.gameMode, useInquisitor: room.settings.useInquisitor },
    );

    this.engines.set(roomCode, engine);
    room.gameState = engine.getFullState();

    // Lobby grace timers no longer apply; disconnected humans fall under the
    // in-game bot replacement path instead.
    this.clearDisconnectTimersForRoom(roomCode);
    this.clearAfkStrikesForRoom(roomCode);
    const disconnectedHumans = room.players.filter(p => !p.isBot && !p.connected);
    for (const player of disconnectedHumans) {
      const playerId = player.id;
      this.startDisconnectTimer(roomCode, playerId, () => {
        options.onDisconnectedSeatExpired?.(playerId);
      });
    }

    const meta = this.getMeta(roomCode);
    const startedAt = Date.now();
    const bots = room.players.filter(p => p.isBot);
    const humans = room.players.length - bots.length;
    const rematchIndex = meta.gamesStarted;
    meta.gamesStarted += 1;
    meta.currentGame = {
      gameId: `${meta.metricId}-${startedAt.toString(36)}`,
      startedAt,
      humans,
      bots: bots.length,
      rematchIndex,
      finishedRecorded: false,
    };
    emitMetric({
      event: 'game_started',
      room: meta.metricId,
      gameId: meta.currentGame.gameId,
      players: room.players.length,
      humans,
      bots: bots.length,
      botPersonalities: bots.map(b => b.personality ?? 'random'),
      disconnectedHumans: disconnectedHumans.length,
      gameMode: room.settings.gameMode,
      useInquisitor: room.settings.useInquisitor,
      actionTimerMs: timerMs,
      turnTimerMs,
      isPublic: room.settings.isPublic,
      viaQuickPlay: meta.origin === 'quick_play',
      practice: meta.origin === 'practice',
      rematchIndex,
    });

    return engine;
  }

  /**
   * Record a finished game exactly once: emits `game_finished` and hands the
   * game log to durable storage (fire-and-forget). Returns the log, or null
   * if there is no finished game to record or it was already recorded.
   */
  recordGameFinished(roomCode: string): GameLog | null {
    const code = roomCode.toUpperCase();
    const room = this.rooms.get(code);
    const engine = this.engines.get(code);
    const meta = this.roomMeta.get(code);
    if (!room || !engine || !meta?.currentGame) return null;
    if (engine.game.status !== GameStatus.Finished) return null;
    if (meta.currentGame.finishedRecorded) return null;

    const current = meta.currentGame;
    current.finishedRecorded = true;
    meta.gamesFinished += 1;

    const log = GameLogger.buildGameLog(engine, room.players, 'online');
    const durationMs = Date.now() - current.startedAt;
    log.gameId = current.gameId;
    log.startedAt = new Date(current.startedAt).toISOString();
    log.durationMs = durationMs;
    log.gameMode = room.settings.gameMode;
    log.useInquisitor = room.settings.useInquisitor;
    log.humansAtStart = current.humans;
    log.botsAtStart = current.bots;

    const winner = room.players.find(p => p.id === engine.game.winnerId);
    const gamePlayerIds = new Set(engine.game.players.map(p => p.id));
    emitMetric({
      event: 'game_finished',
      room: meta.metricId,
      gameId: current.gameId,
      durationMs,
      turns: engine.game.turnNumber,
      winnerIsBot: !!winner?.isBot,
      winnerWasReplaced: !!winner?.replacedByBot,
      humans: current.humans,
      bots: current.bots,
      replacedByBot: room.players.filter(p => p.replacedByBot && gamePlayerIds.has(p.id)).length,
      eliminations: log.players.filter(p => p.eliminationOrder !== null).length,
      gameMode: room.settings.gameMode,
      useInquisitor: room.settings.useInquisitor,
      isPublic: room.settings.isPublic,
      viaQuickPlay: meta.origin === 'quick_play',
      practice: meta.origin === 'practice',
      rematchIndex: current.rematchIndex,
    });

    const storage = this.gameLogStorage;
    if (storage) {
      // Never block or crash the game loop on persistence.
      void storage.saveGameLog(log).catch((err: unknown) => {
        console.error(`Failed to persist game log for room ${code}:`, err instanceof Error ? err.message : err);
      });
    }

    return log;
  }

  // ─── AFK tracking ───

  /**
   * Count a turn-timer expiry on a connected human's own decision. Returns
   * true once they reach AFK_TIMEOUTS_BEFORE_REPLACE consecutive expiries (the
   * caller then hands the seat to a bot). Bots and disconnected players are
   * ignored — the disconnect timer already covers the latter.
   */
  recordTurnTimeout(roomCode: string, playerId: string): boolean {
    const code = roomCode.toUpperCase();
    const room = this.rooms.get(code);
    const player = room?.players.find(p => p.id === playerId);
    if (!room || !player || player.isBot || !player.connected) return false;
    if (!this.isGameInProgress(code)) return false;

    const key = `${code}:${playerId}`;
    const strikes = (this.afkStrikes.get(key) ?? 0) + 1;
    this.afkStrikes.set(key, strikes);
    return strikes >= AFK_TIMEOUTS_BEFORE_REPLACE;
  }

  /** The player did something themselves — reset their consecutive-timeout count. */
  clearAfkStrikes(roomCode: string, playerId: string): void {
    this.afkStrikes.delete(`${roomCode.toUpperCase()}:${playerId}`);
  }

  getAfkStrikes(roomCode: string, playerId: string): number {
    return this.afkStrikes.get(`${roomCode.toUpperCase()}:${playerId}`) ?? 0;
  }

  private clearAfkStrikesForRoom(roomCode: string): void {
    for (const key of this.afkStrikes.keys()) {
      if (key.startsWith(`${roomCode}:`)) this.afkStrikes.delete(key);
    }
  }

  private getMeta(roomCode: string): RoomMeta {
    let meta = this.roomMeta.get(roomCode);
    if (!meta) {
      meta = this.createMeta('standard');
      this.roomMeta.set(roomCode, meta);
    }
    return meta;
  }

  private createMeta(origin: RoomOrigin): RoomMeta {
    // Room codes are join credentials for private rooms, so metrics use an
    // unrelated random id that is stable for the room's lifetime.
    return { metricId: randomBytes(5).toString('hex'), origin, gamesStarted: 0, gamesFinished: 0, currentGame: null };
  }

  // ─── Chat ───

  addChatMessage(roomCode: string, playerId: string, playerName: string, message: string): ChatMessage | { error: string } {
    const room = this.rooms.get(roomCode);
    if (!room) return { error: 'Room not found' };

    const trimmed = message.trim();
    if (!trimmed || trimmed.length > CHAT_MAX_MESSAGE_LENGTH) {
      return { error: `Message must be 1-${CHAT_MAX_MESSAGE_LENGTH} characters` };
    }

    // Rate limiting
    const now = Date.now();
    const lastTime = this.lastChatTime.get(playerId) || 0;
    if (now - lastTime < CHAT_RATE_LIMIT_MS) {
      return { error: 'Sending messages too fast' };
    }
    this.lastChatTime.set(playerId, now);

    const chatMsg: ChatMessage = {
      id: randomUUID(),
      playerId,
      playerName,
      message: trimmed,
      timestamp: now,
    };

    let history = this.chatMessages.get(roomCode);
    if (!history) {
      history = [];
      this.chatMessages.set(roomCode, history);
    }
    history.push(chatMsg);
    if (history.length > CHAT_MAX_HISTORY) {
      history.shift();
    }

    return chatMsg;
  }

  addBotChatMessage(roomCode: string, botId: string, botName: string, message: string): ChatMessage | { error: string } {
    const room = this.rooms.get(roomCode);
    if (!room) return { error: 'Room not found' };

    const chatMsg: ChatMessage = {
      id: randomUUID(),
      playerId: botId,
      playerName: botName,
      message,
      timestamp: Date.now(),
    };

    let history = this.chatMessages.get(roomCode);
    if (!history) {
      history = [];
      this.chatMessages.set(roomCode, history);
    }
    history.push(chatMsg);
    if (history.length > CHAT_MAX_HISTORY) {
      history.shift();
    }

    return chatMsg;
  }

  canSendReaction(playerId: string): boolean {
    const now = Date.now();
    const lastTime = this.lastReactionTime.get(playerId) || 0;
    if (now - lastTime < REACTION_RATE_LIMIT_MS) {
      return false;
    }
    this.lastReactionTime.set(playerId, now);
    return true;
  }

  getChatHistory(roomCode: string): ChatMessage[] {
    return this.chatMessages.get(roomCode) || [];
  }

  // ─── Rematch ───

  resetToLobby(roomCode: string): { room: Room; promoted: Array<{ spectator: Spectator; playerId: string; sessionToken: string }> } | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;

    // Destroy engine (wins already incremented at GameOver)
    const engine = this.engines.get(roomCode);
    if (engine) {
      engine.destroy();
      this.engines.delete(roomCode);
    }

    // Destroy bot controller
    const bc = this.botControllers.get(roomCode);
    if (bc) {
      bc.destroy();
      this.botControllers.delete(roomCode);
    }

    room.gameState = null;
    const meta = this.roomMeta.get(roomCode);
    if (meta) meta.currentGame = null;

    // Humans who dropped but are still inside their reconnect window keep their seat
    const inGrace = new Set(
      room.players
        .filter(p => !p.isBot && !p.connected && p.socketId !== '' && this.disconnectTimers.has(`${roomCode}:${p.id}`))
        .map(p => p.id),
    );

    // Clear all disconnect timers for this room
    this.clearDisconnectTimersForRoom(roomCode);
    this.clearAfkStrikesForRoom(roomCode);

    // Remove disconnected human players (unless in grace) and bot-replaced players; original bots survive
    room.players = room.players.filter(p => (p.isBot && !p.replacedByBot) || p.connected || inGrace.has(p.id));
    for (const playerId of inGrace) this.armLobbyGrace(roomCode, playerId);

    // If room is empty after filtering, delete it
    if (room.players.length === 0) {
      this.deleteRoom(roomCode, 'empty');
      return null;
    }

    // Reassign host if needed (skip bots; prefer connected)
    if (!room.players.find(p => p.id === room.hostId && !p.isBot)) {
      const humanPlayer = room.players.find(p => !p.isBot && p.connected) ?? room.players.find(p => !p.isBot);
      if (humanPlayer) {
        room.hostId = humanPlayer.id;
      } else {
        // Only bots remain — delete room
        this.deleteRoom(roomCode, 'empty');
        return null;
      }
    }

    // Promote spectators to players (queue behavior)
    const promoted = this.promoteSpectators(roomCode);

    return { room, promoted };
  }

  /**
   * Promote waiting spectators into the lobby as players, up to MAX_PLAYERS.
   * Returns the list of promoted spectators so the caller can notify them.
   */
  promoteSpectators(roomCode: string): Array<{ spectator: Spectator; playerId: string; sessionToken: string }> {
    const code = roomCode.toUpperCase();
    const room = this.rooms.get(code);
    if (!room) return [];
    const spectators = this.spectators.get(code);
    if (!spectators || spectators.length === 0) return [];

    const promoted: Array<{ spectator: Spectator; playerId: string; sessionToken: string }> = [];

    const skipped: Spectator[] = [];
    while (spectators.length > 0 && room.players.length < MAX_PLAYERS) {
      const spectator = spectators.shift()!;

      // Retain spectators whose name conflicts with an existing player
      if (room.players.some(p => p.name.toLowerCase() === spectator.name.toLowerCase())) {
        skipped.push(spectator);
        continue;
      }

      const playerId = randomUUID();
      const sessionToken = randomBytes(32).toString('hex');
      room.players.push({
        id: playerId,
        name: spectator.name,
        socketId: spectator.socketId,
        connected: true,
        sessionToken,
      });

      promoted.push({ spectator, playerId, sessionToken });
    }

    // Put back spectators that couldn't be promoted (name conflict)
    spectators.unshift(...skipped);
    if (spectators.length === 0) this.spectators.delete(code);
    return promoted;
  }

  getPlayerRoom(socketId: string): { room: Room; player: RoomPlayer } | null {
    for (const room of this.rooms.values()) {
      const player = room.players.find(p => p.socketId === socketId);
      if (player) return { room, player };
    }
    return null;
  }

  hasSocketMembership(socketId: string): boolean {
    return this.getPlayerRoom(socketId) !== null || this.getSpectatorRoom(socketId) !== null;
  }

  // ─── Spectators ───

  addSpectator(roomCode: string, name: string, socketId: string): { spectatorId: string } | { error: string } {
    if (this.hasSocketMembership(socketId)) return { error: 'Socket is already a room member' };
    const code = roomCode.toUpperCase();
    const room = this.rooms.get(code);
    if (!room) return { error: 'Room not found' };
    // Spectating is limited to public rooms that have actually started a game:
    // private rooms and pre-game lobbies must not be observable. The engine is
    // present until resetToLobby, a superset of `PublicRoomInfo.hasGame`
    // (in-progress only), so the browser never offers a "Watch" the server refuses.
    const engine = this.engines.get(code);
    if (!room.settings.isPublic || !engine) {
      return { error: 'Spectating is only available for public live games' };
    }

    let spectators = this.spectators.get(code);
    if (!spectators) {
      spectators = [];
      this.spectators.set(code, spectators);
    }

    if (spectators.length >= MAX_SPECTATORS_PER_ROOM) {
      return { error: 'Too many spectators' };
    }

    const spectatorId = randomUUID();
    spectators.push({ id: spectatorId, name, socketId });
    return { spectatorId };
  }

  removeSpectator(socketId: string): { roomCode: string } | null {
    for (const [code, spectators] of this.spectators.entries()) {
      const idx = spectators.findIndex(s => s.socketId === socketId);
      if (idx !== -1) {
        spectators.splice(idx, 1);
        if (spectators.length === 0) this.spectators.delete(code);
        return { roomCode: code };
      }
    }
    return null;
  }

  removeSpectatorById(roomCode: string, spectatorId: string): { spectator: Spectator } | { error: string } {
    const code = roomCode.toUpperCase();
    const spectators = this.spectators.get(code);
    if (!this.rooms.has(code)) return { error: 'Room not found' };
    if (!spectators) return { error: 'Spectator not found' };

    const idx = spectators.findIndex(s => s.id === spectatorId);
    if (idx === -1) return { error: 'Spectator not found' };

    const [spectator] = spectators.splice(idx, 1);
    if (spectators.length === 0) this.spectators.delete(code);
    return { spectator };
  }

  getSpectators(roomCode: string): Spectator[] {
    return this.spectators.get(roomCode.toUpperCase()) || [];
  }

  getSpectatorRoom(socketId: string): { room: Room; spectator: Spectator } | null {
    for (const [code, spectators] of this.spectators.entries()) {
      const spectator = spectators.find(s => s.socketId === socketId);
      if (spectator) {
        const room = this.rooms.get(code);
        if (room) return { room, spectator };
      }
    }
    return null;
  }

  // ─── Disconnect Timer & Bot Replacement ───

  startDisconnectTimer(
    roomCode: string,
    playerId: string,
    onExpire: () => void,
    delayMs: number = DISCONNECT_BOT_REPLACE_MS,
  ): void {
    const key = `${roomCode}:${playerId}`;
    // Clear any existing timer for this player
    const existing = this.disconnectTimers.get(key);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.disconnectTimers.delete(key);
      onExpire();
    }, delayMs);

    this.disconnectTimers.set(key, timer);
  }

  cancelDisconnectTimer(roomCode: string, playerId: string): void {
    const key = `${roomCode}:${playerId}`;
    const timer = this.disconnectTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.disconnectTimers.delete(key);
    }
  }

  /**
   * Hand a human's seat in an in-progress game to an 'optimal' bot.
   * `disconnect` requires the player to still be disconnected (they may have
   * come back); `left` and `afk` replace regardless of socket state.
   */
  replaceWithBot(roomCode: string, playerId: string, reason: BotReplaceReason = 'disconnect'): boolean {
    const room = this.rooms.get(roomCode);
    if (!room) return false;

    const engine = this.engines.get(roomCode);
    if (!engine || engine.game.status !== GameStatus.InProgress) return false;

    const roomPlayer = room.players.find(p => p.id === playerId);
    if (!roomPlayer || roomPlayer.isBot) return false;
    if (reason === 'disconnect' && roomPlayer.connected) return false;

    const gamePlayer = engine.game.getPlayer(playerId);
    if (!gamePlayer || !gamePlayer.isAlive) return false;

    // Convert to bot
    roomPlayer.isBot = true;
    roomPlayer.personality = 'optimal';
    roomPlayer.replacedByBot = true;
    roomPlayer.connected = true; // Bots are always "connected"
    roomPlayer.socketId = ''; // The human's socket no longer owns this seat
    this.cancelDisconnectTimer(roomCode, playerId);
    this.afkStrikes.delete(`${roomCode}:${playerId}`);

    // Register with BotController (create one if needed)
    let bc = this.botControllers.get(roomCode);
    if (bc) {
      bc.addBot(playerId, 'optimal', roomPlayer.name);
    } else {
      const botMinReactionMs = (room.settings.botMinReactionSeconds ?? 2) * 1000;
      bc = new BotController(engine, [roomPlayer], botMinReactionMs);
      this.botControllers.set(roomCode, bc);
    }

    // Reassign host if the replaced player was host (never to a bot)
    const humansLeft = room.hostId === playerId
      ? this.reassignHost(room, playerId)
      : room.players.some(p => !p.isBot);

    // Log replacement
    const message = reason === 'afk'
      ? `${roomPlayer.name} was idle, so a bot took their seat.`
      : reason === 'left'
        ? `${roomPlayer.name} left, so a bot took their seat.`
        : `A bot took ${roomPlayer.name}'s seat.`;
    engine.game.log(message, 'bot_replace', null, playerId, roomPlayer.name);

    const meta = this.getMeta(roomCode);
    emitMetric({
      event: 'player_replaced_by_bot',
      room: meta.metricId,
      gameId: meta.currentGame?.gameId ?? null,
      reason,
      turn: engine.game.turnNumber,
    });

    if (!humansLeft) {
      // Every seat is a bot now and replaced humans can't rejoin: nobody can
      // ever host or rematch this room, so close it.
      this.deleteRoom(roomCode, 'empty');
    }

    return true;
  }

  private clearDisconnectTimersForRoom(roomCode: string): void {
    for (const [key, timer] of this.disconnectTimers.entries()) {
      if (key.startsWith(`${roomCode}:`)) {
        clearTimeout(timer);
        this.disconnectTimers.delete(key);
      }
    }
  }

  private cleanRateLimitsForRoom(room: Room): void {
    for (const player of room.players) {
      this.lastChatTime.delete(player.id);
      this.lastReactionTime.delete(player.id);
    }
  }

  private deleteRoom(roomCode: string, reason: RoomCloseReason): void {
    this.clearDisconnectTimersForRoom(roomCode);
    this.clearAfkStrikesForRoom(roomCode);
    const room = this.rooms.get(roomCode);
    if (room) this.cleanRateLimitsForRoom(room);

    const engine = this.engines.get(roomCode);
    const meta = this.roomMeta.get(roomCode);
    const now = Date.now();
    if (engine && engine.game.status === GameStatus.InProgress && meta?.currentGame) {
      emitMetric({
        event: 'game_abandoned',
        room: meta.metricId,
        gameId: meta.currentGame.gameId,
        durationMs: now - meta.currentGame.startedAt,
        turns: engine.game.turnNumber,
        humans: meta.currentGame.humans,
        bots: meta.currentGame.bots,
        reason,
      });
    }
    if (room) {
      emitMetric({
        event: 'room_closed',
        room: meta?.metricId ?? 'unknown',
        reason,
        everStarted: (meta?.gamesStarted ?? 0) > 0,
        gamesStarted: meta?.gamesStarted ?? 0,
        gamesPlayed: meta?.gamesFinished ?? 0,
        ageMs: now - room.createdAt,
        isPublic: room.settings.isPublic,
        viaQuickPlay: meta?.origin === 'quick_play',
        practice: meta?.origin === 'practice',
      });
    }
    this.roomMeta.delete(roomCode);

    if (engine) engine.destroy();
    this.engines.delete(roomCode);

    const bc = this.botControllers.get(roomCode);
    if (bc) bc.destroy();
    this.botControllers.delete(roomCode);

    this.rooms.delete(roomCode);
    this.chatMessages.delete(roomCode);
    this.lastHumanActivityAt.delete(roomCode);
    this.spectators.delete(roomCode);
    if (room) this.notify({ type: 'closed', roomCode, wasPublic: room.settings.isPublic });
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [code, room] of this.rooms.entries()) {
      // 24h TTL for all rooms
      if (now - room.createdAt > ROOM_TTL_MS) {
        this.deleteRoom(code, 'ttl');
        continue;
      }

      // Clean up rooms with games but no connected human players and no
      // human activity for INACTIVE_ROOM_CLEANUP_MS (120s)
      const engine = this.engines.get(code);
      if (engine) {
        const hasConnectedHuman = room.players.some(p => !p.isBot && p.connected);
        if (!hasConnectedHuman) {
          const lastActivity = this.lastHumanActivityAt.get(code) ?? room.createdAt;
          if (now - lastActivity > INACTIVE_ROOM_CLEANUP_MS) {
            this.deleteRoom(code, 'inactive');
          }
        }
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    for (const timer of this.disconnectTimers.values()) {
      clearTimeout(timer);
    }
    this.disconnectTimers.clear();
    this.lastHumanActivityAt.clear();
    this.afkStrikes.clear();
  }
}
