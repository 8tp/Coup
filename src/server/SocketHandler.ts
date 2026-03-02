import { Server, Socket } from 'socket.io';
import { ClientToServerEvents, ServerToClientEvents } from '../shared/protocol';
import { ActionType, GameState, GameStatus, TurnPhase } from '../shared/types';
import { REACTIONS } from '../shared/constants';
import { validateName, validateChatMessage } from './ContentFilter';
import { RoomManager } from './RoomManager';
import { serializeForPlayer } from './StateSerializer';
import { BotController } from './BotController';

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export class SocketHandler {
  private io: Server<ClientToServerEvents, ServerToClientEvents>;
  private roomManager: RoomManager;
  /** Track connection count per IP for accurate unique player count. */
  private connectionsByIp: Map<string, number> = new Map();

  constructor(io: Server<ClientToServerEvents, ServerToClientEvents>, roomManager: RoomManager) {
    this.io = io;
    this.roomManager = roomManager;
  }

  private getSocketIp(socket: TypedSocket): string {
    // CF-Connecting-IP is Cloudflare's canonical, non-spoofable client IP header
    const cfIp = socket.handshake.headers['cf-connecting-ip'];
    if (cfIp) {
      return Array.isArray(cfIp) ? cfIp[0] : cfIp;
    }
    // Fall back to X-Forwarded-For for other reverse proxies
    const forwarded = socket.handshake.headers['x-forwarded-for'];
    if (forwarded) {
      const first = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
      return first.trim();
    }
    return socket.handshake.address;
  }

  private trackConnection(socket: TypedSocket): void {
    const ip = this.getSocketIp(socket);
    this.connectionsByIp.set(ip, (this.connectionsByIp.get(ip) || 0) + 1);
  }

  private untrackConnection(socket: TypedSocket): void {
    const ip = this.getSocketIp(socket);
    const count = (this.connectionsByIp.get(ip) || 1) - 1;
    if (count <= 0) {
      this.connectionsByIp.delete(ip);
    } else {
      this.connectionsByIp.set(ip, count);
    }
  }

  handleConnection(socket: TypedSocket): void {
    console.log(`Client connected: ${socket.id}`);
    this.trackConnection(socket);
    this.broadcastServerStats();

    // Catch-all for any unhandled errors in socket handlers
    socket.onAny(() => {}); // no-op, just ensures listener setup
    socket.on('error', (err) => {
      console.error(`Socket error for ${socket.id}:`, err);
    });

    socket.on('room:create', (data, callback) => {
      const nameResult = validateName(data.playerName);
      if (!nameResult.valid) {
        callback({ success: false, error: nameResult.error });
        return;
      }

      const result = this.roomManager.createRoom(nameResult.sanitized, socket.id, data.isPublic);
      socket.leave('browser');
      socket.join(result.room.code);
      callback({
        success: true,
        roomCode: result.room.code,
        playerId: result.playerId,
      });

      this.broadcastRoomUpdate(result.room.code);
      this.maybeBroadcastPublicRoomList(result.room);
    });

    socket.on('room:join', (data, callback) => {
      const nameResult = validateName(data.playerName);
      const code = data.roomCode?.trim().toUpperCase();
      if (!nameResult.valid) {
        callback({ success: false, error: nameResult.error });
        return;
      }
      if (!code) {
        callback({ success: false, error: 'Invalid room code' });
        return;
      }

      const result = this.roomManager.joinRoom(code, nameResult.sanitized, socket.id);
      if ('error' in result) {
        callback({ success: false, error: result.error });
        return;
      }

      socket.leave('browser');
      socket.join(result.room.code);
      callback({
        success: true,
        roomCode: result.room.code,
        playerId: result.playerId,
      });

      this.broadcastRoomUpdate(result.room.code);
      this.maybeBroadcastPublicRoomList(result.room);
    });

    socket.on('room:rejoin', (data, callback) => {
      const code = data.roomCode?.trim().toUpperCase();
      if (!code || !data.playerId) {
        callback({ success: false, error: 'Invalid rejoin data' });
        return;
      }

      const result = this.roomManager.rejoinRoom(code, data.playerId, socket.id);
      if ('error' in result) {
        callback({ success: false, error: result.error });
        return;
      }

      // Cancel disconnect timer on successful rejoin
      this.roomManager.cancelDisconnectTimer(code, data.playerId);
      this.roomManager.touchRoom(code);

      socket.join(result.room.code);
      callback({
        success: true,
        roomCode: result.room.code,
        playerId: result.player.id,
      });

      this.broadcastRoomUpdate(result.room.code);

      // If game in progress, send current state
      const engine = this.roomManager.getEngine(code);
      if (engine) {
        const state = engine.getFullState();
        socket.emit('game:state', serializeForPlayer(state, result.player.id, result.room.players));
      }

      // Send chat history
      const chatHistory = this.roomManager.getChatHistory(code);
      if (chatHistory.length > 0) {
        socket.emit('chat:history', { messages: chatHistory });
      }
    });

    socket.on('room:leave', () => {
      this.handleDisconnect(socket);
    });

    // ─── Room Browser ───

    socket.on('browser:subscribe', () => {
      socket.join('browser');
      socket.emit('browser:list', { rooms: this.roomManager.getPublicRooms() });
      socket.emit('server:stats', {
        playersOnline: this.connectionsByIp.size,
        gamesInProgress: this.roomManager.getActiveGameCount(),
      });
    });

    socket.on('browser:unsubscribe', () => {
      socket.leave('browser');
    });

    // ─── Bots ───

    socket.on('bot:add', (data, callback) => {
      const found = this.roomManager.getPlayerRoom(socket.id);
      if (!found) {
        callback({ success: false, error: 'Not in a room' });
        return;
      }
      if (found.player.id !== found.room.hostId) {
        callback({ success: false, error: 'Only the host can add bots' });
        return;
      }

      const nameResult = validateName(data.name);
      if (!nameResult.valid) {
        callback({ success: false, error: nameResult.error });
        return;
      }

      const result = this.roomManager.addBot(found.room.code, nameResult.sanitized, data.personality);
      if ('error' in result) {
        callback({ success: false, error: result.error });
        return;
      }

      callback({ success: true, botId: result.botId });
      this.broadcastRoomUpdate(found.room.code);
      this.maybeBroadcastPublicRoomList(found.room);
    });

    socket.on('bot:remove', (data, callback) => {
      const found = this.roomManager.getPlayerRoom(socket.id);
      if (!found) {
        callback({ success: false, error: 'Not in a room' });
        return;
      }
      if (found.player.id !== found.room.hostId) {
        callback({ success: false, error: 'Only the host can remove bots' });
        return;
      }

      const result = this.roomManager.removeBot(found.room.code, data.botId);
      if ('error' in result) {
        callback({ success: false, error: result.error });
        return;
      }

      callback({ success: true });
      this.broadcastRoomUpdate(found.room.code);
      this.maybeBroadcastPublicRoomList(found.room);
    });

    socket.on('room:update_settings', (data, callback) => {
      const found = this.roomManager.getPlayerRoom(socket.id);
      if (!found) {
        callback({ success: false, error: 'Not in a room' });
        return;
      }
      if (found.player.id !== found.room.hostId) {
        callback({ success: false, error: 'Only the host can change settings' });
        return;
      }

      const wasPublic = found.room.settings.isPublic;
      const result = this.roomManager.updateSettings(found.room.code, data.settings);
      if ('error' in result) {
        callback({ success: false, error: result.error });
        return;
      }

      callback({ success: true });
      this.broadcastRoomUpdate(found.room.code);
      this.maybeBroadcastPublicRoomList(found.room, wasPublic);
    });

    socket.on('game:start', () => {
      const found = this.roomManager.getPlayerRoom(socket.id);
      if (!found) {
        socket.emit('game:error', { message: 'Not in a room' });
        return;
      }

      if (found.player.id !== found.room.hostId) {
        socket.emit('game:error', { message: 'Only the host can start the game' });
        return;
      }

      const result = this.roomManager.startGame(found.room.code);
      if ('error' in result) {
        socket.emit('game:error', { message: result.error });
        return;
      }

      const engine = result;
      const roomCode = found.room.code;

      // Create BotController if there are bots in the room
      const botPlayers = found.room.players.filter(p => p.isBot);
      if (botPlayers.length > 0) {
        const botMinReactionMs = (found.room.settings.botMinReactionSeconds ?? 2) * 1000;
        const botController = new BotController(engine, botPlayers, botMinReactionMs);
        this.roomManager.setBotController(roomCode, botController);
        this.wireBotEmoteCallback(roomCode, botController);
      }

      engine.setOnStateChange((state: GameState) => {
        this.broadcastGameState(roomCode, state);

        // Increment win count immediately when game ends
        if (state.turnPhase === TurnPhase.GameOver && state.winnerId) {
          const room = this.roomManager.getRoom(roomCode);
          if (room && !room.lastWinnerId) {
            const winner = room.players.find(p => p.id === state.winnerId);
            if (winner) {
              winner.wins = (winner.wins || 0) + 1;
            }
            room.lastWinnerId = state.winnerId;
            this.broadcastRoomUpdate(roomCode);
          }
        }

        // Dynamically look up BotController so mid-game additions are picked up
        this.roomManager.getBotController(roomCode)?.onStateChange();
      });

      this.broadcastGameState(roomCode, engine.getFullState());
      // Trigger initial bot evaluation
      this.roomManager.getBotController(roomCode)?.onStateChange();
      this.maybeBroadcastPublicRoomList(found.room);
      this.broadcastServerStats();
    });

    // ─── Chat ───

    socket.on('chat:send', (data) => {
      const found = this.roomManager.getPlayerRoom(socket.id);
      if (!found) return;
      this.roomManager.touchRoom(found.room.code);

      const msgResult = validateChatMessage(data.message);
      if (!msgResult.valid) {
        socket.emit('room:error', { message: msgResult.error });
        return;
      }

      const result = this.roomManager.addChatMessage(
        found.room.code,
        found.player.id,
        found.player.name,
        msgResult.sanitized,
      );
      if ('error' in result) {
        socket.emit('room:error', { message: result.error });
        return;
      }

      this.io.to(found.room.code).emit('chat:message', result);
    });

    // ─── Reactions ───

    socket.on('reaction:send', (data) => {
      const found = this.roomManager.getPlayerRoom(socket.id);
      if (!found) return;
      if (found.player.isBot) return;
      this.roomManager.touchRoom(found.room.code);

      const reactionId = data.reactionId;
      const reaction = REACTIONS.find(r => r.id === reactionId);
      if (!reaction) return;

      if (!this.roomManager.canSendReaction(found.player.id)) return;

      this.io.to(found.room.code).emit('reaction:fired', {
        playerId: found.player.id,
        reactionId,
        timestamp: Date.now(),
      });

      // Add reaction to chat log (same as bot emotes)
      const chatMsg = this.roomManager.addChatMessage(
        found.room.code,
        found.player.id,
        found.player.name,
        `${reaction.emoji} ${reaction.label}`,
      );
      if (!('error' in chatMsg)) {
        this.io.to(found.room.code).emit('chat:message', chatMsg);
      }
    });

    // ─── Rematch ───

    socket.on('game:rematch', () => {
      const found = this.roomManager.getPlayerRoom(socket.id);
      if (!found) {
        socket.emit('game:error', { message: 'Not in a room' });
        return;
      }

      if (found.player.id !== found.room.hostId) {
        socket.emit('game:error', { message: 'Only the host can start a rematch' });
        return;
      }

      // Check the engine's live state, not the stale room.gameState snapshot
      const engine = this.roomManager.getEngine(found.room.code);
      const isFinished = engine
        ? engine.game.status === GameStatus.Finished
        : found.room.gameState?.status === GameStatus.Finished;
      if (!isFinished) {
        socket.emit('game:error', { message: 'Game is not finished' });
        return;
      }

      const room = this.roomManager.resetToLobby(found.room.code);
      if (!room) return;

      this.io.to(room.code).emit('game:rematch_to_lobby');
      this.broadcastRoomUpdate(room.code);
      this.maybeBroadcastPublicRoomList(room);
      this.broadcastServerStats();
    });

    // ─── Game Actions ───

    socket.on('game:action', (data) => {
      const ctx = this.getGameContext(socket);
      if (!ctx) return;

      if (!data.action || !Object.values(ActionType).includes(data.action as ActionType)) {
        socket.emit('game:error', { message: 'Invalid action' });
        return;
      }

      const error = ctx.engine.handleAction(ctx.player.id, data.action, data.targetId);
      if (error) socket.emit('game:error', { message: error });
    });

    socket.on('game:challenge', () => {
      const ctx = this.getGameContext(socket);
      if (!ctx) return;

      const error = ctx.engine.handleChallenge(ctx.player.id);
      if (error) socket.emit('game:error', { message: error });
    });

    socket.on('game:pass_challenge', () => {
      const ctx = this.getGameContext(socket);
      if (!ctx) return;

      const error = ctx.engine.handlePassChallenge(ctx.player.id);
      if (error) socket.emit('game:error', { message: error });
    });

    socket.on('game:block', (data) => {
      const ctx = this.getGameContext(socket);
      if (!ctx) return;

      const error = ctx.engine.handleBlock(ctx.player.id, data.character);
      if (error) socket.emit('game:error', { message: error });
    });

    socket.on('game:pass_block', () => {
      const ctx = this.getGameContext(socket);
      if (!ctx) return;

      const error = ctx.engine.handlePassBlock(ctx.player.id);
      if (error) socket.emit('game:error', { message: error });
    });

    socket.on('game:challenge_block', () => {
      const ctx = this.getGameContext(socket);
      if (!ctx) return;

      const error = ctx.engine.handleChallengeBlock(ctx.player.id);
      if (error) socket.emit('game:error', { message: error });
    });

    socket.on('game:pass_challenge_block', () => {
      const ctx = this.getGameContext(socket);
      if (!ctx) return;

      const error = ctx.engine.handlePassChallengeBlock(ctx.player.id);
      if (error) socket.emit('game:error', { message: error });
    });

    socket.on('game:choose_influence_loss', (data) => {
      const ctx = this.getGameContext(socket);
      if (!ctx) return;

      if (typeof data.influenceIndex !== 'number') {
        socket.emit('game:error', { message: 'Invalid influence index' });
        return;
      }

      const error = ctx.engine.handleChooseInfluenceLoss(ctx.player.id, data.influenceIndex);
      if (error) socket.emit('game:error', { message: error });
    });

    socket.on('game:choose_exchange', (data) => {
      const ctx = this.getGameContext(socket);
      if (!ctx) return;

      if (!Array.isArray(data.keepIndices) || !data.keepIndices.every((i: unknown) => typeof i === 'number')) {
        socket.emit('game:error', { message: 'Invalid exchange selection' });
        return;
      }

      const error = ctx.engine.handleChooseExchange(ctx.player.id, data.keepIndices);
      if (error) socket.emit('game:error', { message: error });
    });

    socket.on('disconnect', () => {
      this.untrackConnection(socket);
      this.handleDisconnect(socket);
    });
  }

  private getGameContext(socket: TypedSocket) {
    const found = this.roomManager.getPlayerRoom(socket.id);
    if (!found) {
      socket.emit('game:error', { message: 'Not in a room' });
      return null;
    }

    const engine = this.roomManager.getEngine(found.room.code);
    if (!engine) {
      socket.emit('game:error', { message: 'No game in progress' });
      return null;
    }

    // Track human activity for inactive room cleanup
    if (!found.player.isBot) {
      this.roomManager.touchRoom(found.room.code);
    }

    return { room: found.room, player: found.player, engine };
  }

  private handleDisconnect(socket: TypedSocket): void {
    const found = this.roomManager.getPlayerRoom(socket.id);
    if (!found) return;

    const wasPublic = found.room.settings.isPublic;
    const roomCode = found.room.code;
    const playerId = found.player.id;
    const playerName = found.player.name;

    // Check if game is in progress and player is alive before leaving
    const engine = this.roomManager.getEngine(roomCode);
    const gamePlayer = engine?.game.getPlayer(playerId);
    const gameInProgress = engine && engine.game.status === 'InProgress';
    const playerAlive = gamePlayer?.isAlive ?? false;

    console.log(`Player ${playerName} disconnected from room ${roomCode}`);
    const room = this.roomManager.leaveRoom(roomCode, playerId);
    socket.leave(roomCode);

    if (room) {
      // Start disconnect timer if game is in progress and player is alive
      if (gameInProgress && playerAlive) {
        this.roomManager.startDisconnectTimer(roomCode, playerId, () => {
          this.handleBotReplacement(roomCode, playerId);
        });
      }

      this.broadcastRoomUpdate(room.code);
      this.maybeBroadcastPublicRoomList(room, wasPublic);
    } else if (wasPublic) {
      // Room was deleted — still need to update browser
      this.broadcastPublicRoomList();
    }
    this.broadcastServerStats();
  }

  private handleBotReplacement(roomCode: string, playerId: string): void {
    const replaced = this.roomManager.replaceWithBot(roomCode, playerId);
    if (!replaced) return;

    // Ensure emote callback is wired (BotController may have been newly created)
    const bc = this.roomManager.getBotController(roomCode);
    if (bc) {
      this.wireBotEmoteCallback(roomCode, bc);
    }

    // Broadcast updated room and game state
    this.broadcastRoomUpdate(roomCode);
    const engine = this.roomManager.getEngine(roomCode);
    if (engine) {
      this.broadcastGameState(roomCode, engine.getFullState());
      // Trigger bot evaluation so the new bot acts if it's their turn
      bc?.onStateChange();
    }
  }

  private wireBotEmoteCallback(roomCode: string, botController: BotController): void {
    botController.setOnBotEmote((botId, botName, reactionId) => {
      this.io.to(roomCode).emit('reaction:fired', {
        playerId: botId,
        reactionId,
        timestamp: Date.now(),
      });
      const reaction = REACTIONS.find(r => r.id === reactionId);
      if (reaction) {
        const chatMsg = this.roomManager.addBotChatMessage(
          roomCode, botId, botName, `${reaction.emoji} ${reaction.label}`
        );
        if (chatMsg && !('error' in chatMsg)) {
          this.io.to(roomCode).emit('chat:message', chatMsg);
        }
      }
    });
  }

  private broadcastRoomUpdate(roomCode: string): void {
    const room = this.roomManager.getRoom(roomCode);
    if (!room) return;

    this.io.to(roomCode).emit('room:updated', {
      players: room.players.map(({ socketId: _, ...rest }) => rest),
      hostId: room.hostId,
      settings: room.settings,
      lastWinnerId: room.lastWinnerId ?? null,
    });
  }

  private broadcastPublicRoomList(): void {
    this.io.to('browser').emit('browser:list', { rooms: this.roomManager.getPublicRooms() });
  }

  private maybeBroadcastPublicRoomList(room: { settings: { isPublic: boolean } }, wasPublic?: boolean): void {
    if (room.settings.isPublic || wasPublic) {
      this.broadcastPublicRoomList();
    }
  }

  private broadcastServerStats(): void {
    this.io.to('browser').emit('server:stats', {
      playersOnline: this.connectionsByIp.size,
      gamesInProgress: this.roomManager.getActiveGameCount(),
    });
  }

  private broadcastGameState(roomCode: string, state: GameState): void {
    const room = this.roomManager.getRoom(roomCode);
    if (!room) return;

    // Send personalized state to each human player
    for (const player of room.players) {
      if (!player.connected || player.isBot) continue;
      const clientState = serializeForPlayer(state, player.id, room.players);
      this.io.to(player.socketId).emit('game:state', clientState);
    }

    // Emit challenge reveal event if available
    const engine = this.roomManager.getEngine(roomCode);
    if (engine?.lastChallengeReveal) {
      this.io.to(roomCode).emit('game:challenge_reveal', engine.lastChallengeReveal);
      engine.lastChallengeReveal = null;
    }
  }
}
