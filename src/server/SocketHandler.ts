import { Server, Socket } from 'socket.io';
import { ClientToServerEvents, ServerToClientEvents } from '../shared/protocol';
import { GameState, GameStatus } from '../shared/types';
import { CHAT_MAX_MESSAGE_LENGTH } from '../shared/constants';
import { RoomManager } from './RoomManager';
import { serializeForPlayer } from './StateSerializer';
import { BotController } from './BotController';

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export class SocketHandler {
  private io: Server<ClientToServerEvents, ServerToClientEvents>;
  private roomManager: RoomManager;

  constructor(io: Server<ClientToServerEvents, ServerToClientEvents>, roomManager: RoomManager) {
    this.io = io;
    this.roomManager = roomManager;
  }

  handleConnection(socket: TypedSocket): void {
    console.log(`Client connected: ${socket.id}`);

    socket.on('room:create', (data, callback) => {
      const name = data.playerName?.trim();
      if (!name || name.length > 20) {
        callback({ success: false, error: 'Invalid name (1-20 chars)' });
        return;
      }

      const result = this.roomManager.createRoom(name, socket.id);
      socket.join(result.room.code);
      callback({
        success: true,
        roomCode: result.room.code,
        playerId: result.playerId,
      });

      this.broadcastRoomUpdate(result.room.code);
    });

    socket.on('room:join', (data, callback) => {
      const name = data.playerName?.trim();
      const code = data.roomCode?.trim().toUpperCase();
      if (!name || name.length > 20) {
        callback({ success: false, error: 'Invalid name (1-20 chars)' });
        return;
      }
      if (!code) {
        callback({ success: false, error: 'Invalid room code' });
        return;
      }

      const result = this.roomManager.joinRoom(code, name, socket.id);
      if ('error' in result) {
        callback({ success: false, error: result.error });
        return;
      }

      socket.join(result.room.code);
      callback({
        success: true,
        roomCode: result.room.code,
        playerId: result.playerId,
      });

      this.broadcastRoomUpdate(result.room.code);
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

      const name = data.name?.trim();
      if (!name || name.length > 20) {
        callback({ success: false, error: 'Invalid name (1-20 chars)' });
        return;
      }

      const result = this.roomManager.addBot(found.room.code, name, data.personality);
      if ('error' in result) {
        callback({ success: false, error: result.error });
        return;
      }

      callback({ success: true, botId: result.botId });
      this.broadcastRoomUpdate(found.room.code);
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

      // Create BotController if there are bots in the room
      const botPlayers = found.room.players.filter(p => p.isBot);
      let botController: BotController | null = null;
      if (botPlayers.length > 0) {
        botController = new BotController(engine, botPlayers);
        this.roomManager.setBotController(found.room.code, botController);
      }

      engine.setOnStateChange((state: GameState) => {
        this.broadcastGameState(found.room.code, state);
        // Notify bots after state broadcast
        botController?.onStateChange();
      });

      this.broadcastGameState(found.room.code, engine.getFullState());
      // Trigger initial bot evaluation
      botController?.onStateChange();
    });

    // ─── Chat ───

    socket.on('chat:send', (data) => {
      const found = this.roomManager.getPlayerRoom(socket.id);
      if (!found) return;

      const msg = data.message;
      if (!msg || typeof msg !== 'string' || msg.trim().length === 0 || msg.length > CHAT_MAX_MESSAGE_LENGTH) {
        return;
      }

      const result = this.roomManager.addChatMessage(
        found.room.code,
        found.player.id,
        found.player.name,
        msg,
      );
      if ('error' in result) {
        socket.emit('room:error', { message: result.error });
        return;
      }

      this.io.to(found.room.code).emit('chat:message', result);
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
    });

    // ─── Game Actions ───

    socket.on('game:action', (data) => {
      const ctx = this.getGameContext(socket);
      if (!ctx) return;

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

      const error = ctx.engine.handleChooseInfluenceLoss(ctx.player.id, data.influenceIndex);
      if (error) socket.emit('game:error', { message: error });
    });

    socket.on('game:choose_exchange', (data) => {
      const ctx = this.getGameContext(socket);
      if (!ctx) return;

      const error = ctx.engine.handleChooseExchange(ctx.player.id, data.keepIndices);
      if (error) socket.emit('game:error', { message: error });
    });

    socket.on('disconnect', () => {
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

    return { room: found.room, player: found.player, engine };
  }

  private handleDisconnect(socket: TypedSocket): void {
    const found = this.roomManager.getPlayerRoom(socket.id);
    if (!found) return;

    console.log(`Player ${found.player.name} disconnected from room ${found.room.code}`);
    const room = this.roomManager.leaveRoom(found.room.code, found.player.id);
    socket.leave(found.room.code);

    if (room) {
      this.broadcastRoomUpdate(room.code);
    }
  }

  private broadcastRoomUpdate(roomCode: string): void {
    const room = this.roomManager.getRoom(roomCode);
    if (!room) return;

    this.io.to(roomCode).emit('room:updated', {
      players: room.players,
      hostId: room.hostId,
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
  }
}
