import { v4 as uuidv4 } from 'uuid';
import { BotDifficulty, ChatMessage, GameStatus, PublicRoomInfo, Room, RoomPlayer, RoomSettings } from '../shared/types';
import { CHAT_MAX_HISTORY, CHAT_MAX_MESSAGE_LENGTH, CHAT_RATE_LIMIT_MS, DEFAULT_ROOM_SETTINGS, DISCONNECT_BOT_REPLACE_MS, MAX_ACTION_TIMER, MAX_BOT_REACTION_SECONDS, MAX_PLAYERS, MAX_TURN_TIMER, MIN_ACTION_TIMER, MIN_BOT_REACTION_SECONDS, MIN_PLAYERS, MIN_TURN_TIMER, PUBLIC_ROOM_LIST_MAX, REACTION_RATE_LIMIT_MS } from '../shared/constants';
import { GameEngine } from '../engine/GameEngine';
import { BotController } from './BotController';

const ROOM_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private engines: Map<string, GameEngine> = new Map();
  private botControllers: Map<string, BotController> = new Map();
  private chatMessages: Map<string, ChatMessage[]> = new Map();
  private lastChatTime: Map<string, number> = new Map();
  private lastReactionTime: Map<string, number> = new Map();
  private disconnectTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor() {
    // Periodic cleanup of stale rooms
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);
  }

  generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No ambiguous chars
    let code: string;
    do {
      code = '';
      for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
    } while (this.rooms.has(code));
    return code;
  }

  createRoom(playerName: string, socketId: string, isPublic?: boolean): { room: Room; playerId: string } {
    const code = this.generateRoomCode();
    const playerId = uuidv4();

    const room: Room = {
      code,
      hostId: playerId,
      players: [
        {
          id: playerId,
          name: playerName,
          socketId,
          connected: true,
        },
      ],
      gameState: null,
      createdAt: Date.now(),
      settings: { ...DEFAULT_ROOM_SETTINGS, isPublic: !!isPublic },
    };

    this.rooms.set(code, room);
    return { room, playerId };
  }

  joinRoom(
    roomCode: string,
    playerName: string,
    socketId: string,
  ): { room: Room; playerId: string } | { error: string } {
    const room = this.rooms.get(roomCode.toUpperCase());
    if (!room) return { error: 'Room not found' };
    if (room.gameState) return { error: 'Game already in progress' };
    if (room.players.length >= MAX_PLAYERS) return { error: 'Room is full' };

    // Check for duplicate names
    if (room.players.some(p => p.name.toLowerCase() === playerName.toLowerCase())) {
      return { error: 'Name already taken in this room' };
    }

    const playerId = uuidv4();
    room.players.push({
      id: playerId,
      name: playerName,
      socketId,
      connected: true,
    });

    return { room, playerId };
  }

  addBot(
    roomCode: string,
    name: string,
    difficulty: BotDifficulty,
  ): { botId: string } | { error: string } {
    const room = this.rooms.get(roomCode.toUpperCase());
    if (!room) return { error: 'Room not found' };
    if (room.gameState) return { error: 'Game already in progress' };
    if (room.players.length >= MAX_PLAYERS) return { error: 'Room is full' };

    if (room.players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
      return { error: 'Name already taken in this room' };
    }

    const botId = uuidv4();
    room.players.push({
      id: botId,
      name,
      socketId: '',
      connected: true,
      isBot: true,
      difficulty,
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
  ): { room: Room; player: RoomPlayer } | { error: string } {
    const room = this.rooms.get(roomCode.toUpperCase());
    if (!room) return { error: 'Room not found' };

    const player = room.players.find(p => p.id === playerId);
    if (!player) return { error: 'Player not found in room' };

    if (player.replacedByBot) {
      return { error: 'You have been replaced by a bot due to inactivity' };
    }

    player.socketId = socketId;
    player.connected = true;

    return { room, player };
  }

  leaveRoom(roomCode: string, playerId: string): Room | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;

    // If game is in progress, mark as disconnected instead of removing
    if (room.gameState) {
      const player = room.players.find(p => p.id === playerId);
      if (player) player.connected = false;
      return room;
    }

    room.players = room.players.filter(p => p.id !== playerId);
    this.lastChatTime.delete(playerId);
    this.lastReactionTime.delete(playerId);

    // If room is empty, delete it
    if (room.players.length === 0) {
      this.rooms.delete(roomCode);
      this.engines.delete(roomCode);
      this.chatMessages.delete(roomCode);
      return null;
    }

    // If host left, assign new host (skip bots)
    if (room.hostId === playerId) {
      const humanPlayer = room.players.find(p => !p.isBot);
      if (humanPlayer) {
        room.hostId = humanPlayer.id;
      } else {
        // All remaining are bots — delete the room
        this.rooms.delete(roomCode);
        this.engines.delete(roomCode);
        this.chatMessages.delete(roomCode);
        const bc = this.botControllers.get(roomCode);
        if (bc) { bc.destroy(); this.botControllers.delete(roomCode); }
        return null;
      }
    }

    return room;
  }

  updateSettings(roomCode: string, settings: RoomSettings): { success: boolean } | { error: string } {
    const room = this.rooms.get(roomCode.toUpperCase());
    if (!room) return { error: 'Room not found' };
    if (room.gameState) return { error: 'Cannot change settings during a game' };

    const timer = Math.round(settings.actionTimerSeconds);
    if (timer < MIN_ACTION_TIMER || timer > MAX_ACTION_TIMER) {
      return { error: `Timer must be between ${MIN_ACTION_TIMER} and ${MAX_ACTION_TIMER} seconds` };
    }

    // Validate turn timer: clamp to [MIN_TURN_TIMER, MAX_TURN_TIMER]
    const turnTimer = Math.max(MIN_TURN_TIMER, Math.min(MAX_TURN_TIMER, Math.round(settings.turnTimerSeconds ?? room.settings.turnTimerSeconds)));

    // Validate bot min reaction time: clamp to [MIN, MAX], round to nearest 0.5, cap at action timer
    let botReaction = settings.botMinReactionSeconds ?? room.settings.botMinReactionSeconds;
    botReaction = Math.max(MIN_BOT_REACTION_SECONDS, Math.min(MAX_BOT_REACTION_SECONDS, botReaction));
    botReaction = Math.round(botReaction * 2) / 2; // round to nearest 0.5
    botReaction = Math.min(botReaction, timer); // can't exceed action timer

    room.settings = { actionTimerSeconds: timer, turnTimerSeconds: turnTimer, isPublic: !!settings.isPublic, botMinReactionSeconds: botReaction };
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
        hasGame: room.gameState !== null,
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

  startGame(roomCode: string): GameEngine | { error: string } {
    const room = this.rooms.get(roomCode);
    if (!room) return { error: 'Room not found' };
    if (room.players.length < MIN_PLAYERS) return { error: `Need at least ${MIN_PLAYERS} players` };
    if (room.gameState) return { error: 'Game already in progress' };

    // Clear previous game's winner so the onStateChange guard can detect new wins
    room.lastWinnerId = undefined;

    const timerMs = room.settings.actionTimerSeconds * 1000;
    const turnTimerMs = room.settings.turnTimerSeconds * 1000;
    const engine = new GameEngine(roomCode, timerMs, turnTimerMs);
    engine.startGame(room.players.map(p => ({ id: p.id, name: p.name })));

    this.engines.set(roomCode, engine);
    room.gameState = engine.getFullState();

    return engine;
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
      id: uuidv4(),
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
      id: uuidv4(),
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

  resetToLobby(roomCode: string): Room | null {
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

    // Clear all disconnect timers for this room
    this.clearDisconnectTimersForRoom(roomCode);

    // Remove disconnected human players and bot-replaced players; original bots survive
    room.players = room.players.filter(p => (p.isBot && !p.replacedByBot) || p.connected);

    // If room is empty after filtering, delete it
    if (room.players.length === 0) {
      this.rooms.delete(roomCode);
      this.chatMessages.delete(roomCode);
      return null;
    }

    // Reassign host if needed (skip bots)
    if (!room.players.find(p => p.id === room.hostId && !p.isBot)) {
      const humanPlayer = room.players.find(p => !p.isBot);
      if (humanPlayer) {
        room.hostId = humanPlayer.id;
      } else {
        // Only bots remain — delete room
        this.rooms.delete(roomCode);
        this.chatMessages.delete(roomCode);
        return null;
      }
    }

    return room;
  }

  getPlayerRoom(socketId: string): { room: Room; player: RoomPlayer } | null {
    for (const room of this.rooms.values()) {
      const player = room.players.find(p => p.socketId === socketId);
      if (player) return { room, player };
    }
    return null;
  }

  // ─── Disconnect Timer & Bot Replacement ───

  startDisconnectTimer(roomCode: string, playerId: string, onReplace: () => void): void {
    const key = `${roomCode}:${playerId}`;
    // Clear any existing timer for this player
    const existing = this.disconnectTimers.get(key);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.disconnectTimers.delete(key);
      onReplace();
    }, DISCONNECT_BOT_REPLACE_MS);

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

  replaceWithBot(roomCode: string, playerId: string): boolean {
    const room = this.rooms.get(roomCode);
    if (!room) return false;

    const engine = this.engines.get(roomCode);
    if (!engine || engine.game.status !== GameStatus.InProgress) return false;

    const roomPlayer = room.players.find(p => p.id === playerId);
    if (!roomPlayer || roomPlayer.connected || roomPlayer.isBot) return false;

    const gamePlayer = engine.game.getPlayer(playerId);
    if (!gamePlayer || !gamePlayer.isAlive) return false;

    // Convert to bot
    roomPlayer.isBot = true;
    roomPlayer.difficulty = 'hard';
    roomPlayer.replacedByBot = true;
    roomPlayer.connected = true; // Bots are always "connected"

    // Register with BotController (create one if needed)
    let bc = this.botControllers.get(roomCode);
    if (bc) {
      bc.addBot(playerId, 'hard', roomPlayer.name);
    } else {
      const botMinReactionMs = (room.settings.botMinReactionSeconds ?? 2) * 1000;
      bc = new BotController(engine, [roomPlayer], botMinReactionMs);
      this.botControllers.set(roomCode, bc);
    }

    // Reassign host if the replaced player was host
    if (room.hostId === playerId) {
      const humanPlayer = room.players.find(p => !p.isBot && p.connected);
      if (humanPlayer) {
        room.hostId = humanPlayer.id;
      }
    }

    // Log replacement
    engine.game.log(
      `${roomPlayer.name} has been replaced by a bot.`,
      'bot_replace',
      null,
      playerId,
      roomPlayer.name,
    );

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

  private cleanup(): void {
    const now = Date.now();
    for (const [code, room] of this.rooms.entries()) {
      if (now - room.createdAt > ROOM_TTL_MS) {
        this.clearDisconnectTimersForRoom(code);
        this.cleanRateLimitsForRoom(room);
        this.rooms.delete(code);
        this.engines.delete(code);
        this.chatMessages.delete(code);
        const bc = this.botControllers.get(code);
        if (bc) { bc.destroy(); this.botControllers.delete(code); }
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    for (const timer of this.disconnectTimers.values()) {
      clearTimeout(timer);
    }
    this.disconnectTimers.clear();
  }
}
