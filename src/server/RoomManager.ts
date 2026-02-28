import { v4 as uuidv4 } from 'uuid';
import { Room, RoomPlayer } from '../shared/types';
import { MAX_PLAYERS, MIN_PLAYERS } from '../shared/constants';
import { GameEngine } from '../engine/GameEngine';

const ROOM_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private engines: Map<string, GameEngine> = new Map();
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

  createRoom(playerName: string, socketId: string): { room: Room; playerId: string } {
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

  rejoinRoom(
    roomCode: string,
    playerId: string,
    socketId: string,
  ): { room: Room; player: RoomPlayer } | { error: string } {
    const room = this.rooms.get(roomCode.toUpperCase());
    if (!room) return { error: 'Room not found' };

    const player = room.players.find(p => p.id === playerId);
    if (!player) return { error: 'Player not found in room' };

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

    // If room is empty, delete it
    if (room.players.length === 0) {
      this.rooms.delete(roomCode);
      this.engines.delete(roomCode);
      return null;
    }

    // If host left, assign new host
    if (room.hostId === playerId) {
      room.hostId = room.players[0].id;
    }

    return room;
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

    const engine = new GameEngine(roomCode);
    engine.startGame(room.players.map(p => ({ id: p.id, name: p.name })));

    this.engines.set(roomCode, engine);
    room.gameState = engine.getFullState();

    return engine;
  }

  getPlayerRoom(socketId: string): { room: Room; player: RoomPlayer } | null {
    for (const room of this.rooms.values()) {
      const player = room.players.find(p => p.socketId === socketId);
      if (player) return { room, player };
    }
    return null;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [code, room] of this.rooms.entries()) {
      if (now - room.createdAt > ROOM_TTL_MS) {
        this.rooms.delete(code);
        this.engines.delete(code);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
  }
}
