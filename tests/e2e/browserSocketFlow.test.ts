import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createServer, Server as HttpServer } from 'http';
import { AddressInfo } from 'net';
import { Server as SocketServer } from 'socket.io';
import { io as createClient, Socket as ClientSocket } from 'socket.io-client';
import { SocketHandler } from '@/server/SocketHandler';
import { RoomManager } from '@/server/RoomManager';
import { ActionType, ClientGameState, ClientRoomPlayer, ClientSpectator, GameMode, GameStatus, RoomSettings, TurnPhase } from '@/shared/types';
import { ClientToServerEvents, RoomResponse, ServerToClientEvents } from '@/shared/protocol';

type TestSocket = ClientSocket<ServerToClientEvents, ClientToServerEvents>;

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function withTimeout<T>(promise: Promise<T>, message: string, timeoutMs = 5000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      error => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function onceConnected(socket: TestSocket): Promise<void> {
  if (socket.connected) return Promise.resolve();
  return withTimeout(
    new Promise((resolve, reject) => {
      socket.once('connect', () => resolve());
      socket.once('connect_error', reject);
    }),
    'Timed out waiting for socket connection',
  );
}

function emitAck<TResponse>(socket: TestSocket, event: string, data: unknown): Promise<TResponse> {
  return withTimeout(
    new Promise((resolve) => {
      (socket as unknown as { emit: (...args: unknown[]) => void }).emit(event, data, resolve);
    }),
    `Timed out waiting for ${event} acknowledgement`,
  );
}

function waitForState(socket: TestSocket, predicate: (state: ClientGameState) => boolean, label: string): Promise<ClientGameState> {
  return withTimeout(
    new Promise((resolve) => {
      const handler = (state: ClientGameState) => {
        if (!predicate(state)) return;
        socket.off('game:state', handler);
        resolve(state);
      };
      socket.on('game:state', handler);
    }),
    `Timed out waiting for game state: ${label}`,
  );
}

function waitForRoomUpdate(
  socket: TestSocket,
  predicate: (data: { players: ClientRoomPlayer[]; hostId: string; settings: RoomSettings; lastWinnerId?: string | null; spectators?: ClientSpectator[] }) => boolean,
  label: string,
): Promise<{ players: ClientRoomPlayer[]; hostId: string; settings: RoomSettings; lastWinnerId?: string | null; spectators?: ClientSpectator[] }> {
  return withTimeout(
    new Promise((resolve) => {
      const handler = (data: { players: ClientRoomPlayer[]; hostId: string; settings: RoomSettings; lastWinnerId?: string | null; spectators?: ClientSpectator[] }) => {
        if (!predicate(data)) return;
        socket.off('room:updated', handler);
        resolve(data);
      };
      socket.on('room:updated', handler);
    }),
    `Timed out waiting for room update: ${label}`,
  );
}

function waitForEvent(socket: TestSocket, event: keyof ServerToClientEvents, label: string): Promise<void> {
  return withTimeout(
    new Promise((resolve) => {
      const handler = () => {
        (socket as unknown as { off: (event: string, handler: () => void) => void }).off(event, handler);
        resolve();
      };
      (socket as unknown as { on: (event: string, handler: () => void) => void }).on(event, handler);
    }),
    `Timed out waiting for event: ${label}`,
  );
}

function waitForError(socket: TestSocket, event: 'game:error' | 'room:error', expectedMessage: string): Promise<void> {
  return withTimeout(
    new Promise((resolve) => {
      const handler = (data: { message: string }) => {
        if (data.message !== expectedMessage) return;
        socket.off(event, handler);
        resolve();
      };
      socket.on(event, handler);
    }),
    `Timed out waiting for ${event}: ${expectedMessage}`,
  );
}

describe('browser socket E2E flow', () => {
  let httpServer: HttpServer;
  let ioServer: SocketServer<ClientToServerEvents, ServerToClientEvents>;
  let roomManager: RoomManager;
  let port: number;
  const clients: TestSocket[] = [];

  beforeEach(async () => {
    httpServer = createServer();
    ioServer = new SocketServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
      cors: { origin: '*' },
    });
    roomManager = new RoomManager();
    const socketHandler = new SocketHandler(ioServer, roomManager);
    ioServer.on('connection', socket => socketHandler.handleConnection(socket));

    await new Promise<void>(resolve => {
      httpServer.listen(0, () => {
        port = (httpServer.address() as AddressInfo).port;
        resolve();
      });
    });
  });

  afterEach(async () => {
    for (const client of clients) {
      client.disconnect();
    }
    clients.length = 0;
    await new Promise<void>(resolve => ioServer.close(() => resolve()));
    roomManager.destroy();
  });

  async function connectClient(): Promise<TestSocket> {
    const socket = createClient(`http://localhost:${port}`, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    }) as TestSocket;
    clients.push(socket);
    await onceConnected(socket);
    return socket;
  }

  it('creates, joins, starts, takes actions, finishes, and rematches to lobby', async () => {
    const host = await connectClient();
    const guest = await connectClient();

    const createResponse = await emitAck<RoomResponse>(host, 'room:create', { playerName: 'Alice' });
    expect(createResponse.success).toBe(true);
    expect(createResponse.roomCode).toBeDefined();
    expect(createResponse.playerId).toBeDefined();

    const roomCode = createResponse.roomCode!;
    const hostId = createResponse.playerId!;

    const joinResponse = await emitAck<RoomResponse>(guest, 'room:join', { roomCode, playerName: 'Bob' });
    expect(joinResponse.success).toBe(true);
    expect(joinResponse.playerId).toBeDefined();
    const guestId = joinResponse.playerId!;

    const startedForHost = waitForState(host, state => state.status === GameStatus.InProgress, 'host game start');
    const startedForGuest = waitForState(guest, state => state.status === GameStatus.InProgress, 'guest game start');
    host.emit('game:start');

    await expect(startedForHost).resolves.toMatchObject({ status: GameStatus.InProgress });
    await expect(startedForGuest).resolves.toMatchObject({ status: GameStatus.InProgress });

    const engine = roomManager.getEngine(roomCode);
    expect(engine).toBeDefined();
    if (!engine) return;

    engine.game.getPlayer(hostId)!.coins = 7;
    engine.game.currentPlayerIndex = engine.game.players.findIndex(p => p.id === hostId);
    engine.game.turnPhase = TurnPhase.AwaitingAction;

    const firstLoss = waitForState(
      guest,
      state => state.turnPhase === TurnPhase.AwaitingInfluenceLoss && state.influenceLossRequest?.playerId === guestId,
      'first coup influence loss',
    );
    host.emit('game:action', { action: ActionType.Coup, targetId: guestId });
    await expect(firstLoss).resolves.toMatchObject({ turnPhase: TurnPhase.AwaitingInfluenceLoss });

    await delay(550);
    const afterFirstLoss = waitForState(
      host,
      state => state.players.find(p => p.id === guestId)?.influences.filter(inf => inf.revealed).length === 1,
      'first revealed influence',
    );
    guest.emit('game:choose_influence_loss', { influenceIndex: 0 });
    await afterFirstLoss;

    await delay(550);
    engine.game.getPlayer(hostId)!.coins = 7;
    engine.game.currentPlayerIndex = engine.game.players.findIndex(p => p.id === hostId);
    engine.game.turnPhase = TurnPhase.AwaitingAction;

    const secondLoss = waitForState(
      guest,
      state => state.turnPhase === TurnPhase.AwaitingInfluenceLoss && state.influenceLossRequest?.playerId === guestId,
      'second coup influence loss',
    );
    host.emit('game:action', { action: ActionType.Coup, targetId: guestId });
    await secondLoss;

    await delay(550);
    const finishedForHost = waitForState(
      host,
      state => state.status === GameStatus.Finished && state.turnPhase === TurnPhase.GameOver,
      'game over',
    );
    guest.emit('game:choose_influence_loss', { influenceIndex: 1 });
    const finalState = await finishedForHost;
    expect(finalState.winnerId).toBe(hostId);
    expect(finalState.players.find(p => p.id === guestId)?.isAlive).toBe(false);

    const rematchToLobby = waitForEvent(host, 'game:rematch_to_lobby', 'rematch to lobby');
    host.emit('game:rematch');
    await rematchToLobby;

    expect(roomManager.getEngine(roomCode)).toBeUndefined();
    const room = roomManager.getRoom(roomCode);
    expect(room?.gameState).toBeNull();
    expect(room?.players.map(p => p.name)).toEqual(['Alice', 'Bob']);
    expect(room?.players.find(p => p.id === hostId)?.wins).toBe(1);
  }, 15000);

  it('lets spectators join a live game and receive spectator state', async () => {
    const host = await connectClient();
    const guest = await connectClient();
    const spectator = await connectClient();

    const createResponse = await emitAck<RoomResponse>(host, 'room:create', { playerName: 'Host' });
    const roomCode = createResponse.roomCode!;
    await emitAck<RoomResponse>(guest, 'room:join', { roomCode, playerName: 'Guest' });

    const startedForSpectator = waitForState(spectator, state => state.status === GameStatus.InProgress, 'spectator game start');
    host.emit('game:start');
    await waitForState(host, state => state.status === GameStatus.InProgress, 'host game start');

    const spectateResponse = await emitAck<{ success: boolean; roomCode?: string; spectatorId?: string; error?: string }>(
      spectator,
      'room:spectate',
      { roomCode, playerName: 'Watcher' },
    );

    expect(spectateResponse.success).toBe(true);
    const spectatorState = await startedForSpectator;
    expect(spectatorState.myId).toBe(spectateResponse.spectatorId);
    expect(spectatorState.players).toHaveLength(2);
    expect(spectatorState.players.every(player => player.influences.every(inf => inf.character === null || inf.revealed))).toBe(true);
  });

  it('rejoins a player into an in-progress game with the session token', async () => {
    const host = await connectClient();
    const guest = await connectClient();

    const createResponse = await emitAck<RoomResponse>(host, 'room:create', { playerName: 'Rejoin Host' });
    const roomCode = createResponse.roomCode!;
    const hostId = createResponse.playerId!;
    const sessionToken = createResponse.sessionToken!;
    await emitAck<RoomResponse>(guest, 'room:join', { roomCode, playerName: 'Guest' });

    host.emit('game:start');
    await waitForState(guest, state => state.status === GameStatus.InProgress, 'guest game start');

    host.disconnect();
    await delay(100);

    const rejoinedHost = await connectClient();
    const stateAfterRejoin = waitForState(rejoinedHost, state => state.status === GameStatus.InProgress, 'state after rejoin');
    const rejoinResponse = await emitAck<RoomResponse>(rejoinedHost, 'room:rejoin', { roomCode, playerId: hostId, sessionToken });

    expect(rejoinResponse.success).toBe(true);
    await expect(stateAfterRejoin).resolves.toMatchObject({ myId: hostId, status: GameStatus.InProgress });
    expect(roomManager.getRoom(roomCode)?.players.find(p => p.id === hostId)?.connected).toBe(true);
  });

  it('starts Reformation with factions and Inquisitor state serialized', async () => {
    const host = await connectClient();
    const guest = await connectClient();

    const createResponse = await emitAck<RoomResponse>(host, 'room:create', { playerName: 'Reform Host' });
    const roomCode = createResponse.roomCode!;
    await emitAck<RoomResponse>(guest, 'room:join', { roomCode, playerName: 'Reform Guest' });

    const room = roomManager.getRoom(roomCode)!;
    const settings = { ...room.settings, gameMode: GameMode.Reformation, useInquisitor: true };
    const settingsResponse = await emitAck<{ success: boolean; error?: string }>(host, 'room:update_settings', { settings });
    expect(settingsResponse.success).toBe(true);

    const reformStateForGuest = waitForState(
      guest,
      state => state.status === GameStatus.InProgress && state.gameMode === GameMode.Reformation,
      'reformation game start',
    );
    host.emit('game:start');
    const state = await reformStateForGuest;

    expect(state.useInquisitor).toBe(true);
    expect(state.treasuryReserve).toBe(0);
    expect(state.players.every(player => player.faction)).toBe(true);
  });

  it('rejects non-host rematch requests', async () => {
    const host = await connectClient();
    const guest = await connectClient();

    const createResponse = await emitAck<RoomResponse>(host, 'room:create', { playerName: 'Host' });
    const roomCode = createResponse.roomCode!;
    await emitAck<RoomResponse>(guest, 'room:join', { roomCode, playerName: 'Guest' });

    host.emit('game:start');
    await waitForState(guest, state => state.status === GameStatus.InProgress, 'guest game start');

    const error = waitForError(guest, 'game:error', 'Only the host can start a rematch');
    guest.emit('game:rematch');
    await error;
  });

  it('lets hosts remove lobby players and spectators before start', async () => {
    const host = await connectClient();
    const guest = await connectClient();
    const spectator = await connectClient();

    const createResponse = await emitAck<RoomResponse>(host, 'room:create', { playerName: 'Host' });
    const roomCode = createResponse.roomCode!;
    const joinResponse = await emitAck<RoomResponse>(guest, 'room:join', { roomCode, playerName: 'Guest' });
    const spectateResponse = await emitAck<{ success: boolean; roomCode?: string; spectatorId?: string; error?: string }>(
      spectator,
      'room:spectate',
      { roomCode, playerName: 'Watcher' },
    );
    expect(spectateResponse.success).toBe(true);

    const spectatorRemoved = waitForEvent(spectator, 'room:removed', 'spectator removed');
    const spectatorUpdate = waitForRoomUpdate(host, data => (data.spectators ?? []).length === 0, 'spectator list empty');
    const removeSpectatorResponse = await emitAck<{ success: boolean; error?: string }>(
      host,
      'room:remove_spectator',
      { spectatorId: spectateResponse.spectatorId },
    );
    expect(removeSpectatorResponse.success).toBe(true);
    await spectatorRemoved;
    await spectatorUpdate;

    const playerRemoved = waitForEvent(guest, 'room:removed', 'player removed');
    const playerUpdate = waitForRoomUpdate(host, data => data.players.every(player => player.id !== joinResponse.playerId), 'player removed');
    const removePlayerResponse = await emitAck<{ success: boolean; error?: string }>(
      host,
      'room:remove_player',
      { playerId: joinResponse.playerId },
    );
    expect(removePlayerResponse.success).toBe(true);
    await playerRemoved;
    await playerUpdate;
    expect(roomManager.getRoom(roomCode)?.players).toHaveLength(1);
  });
});
