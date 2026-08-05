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

    const createResponse = await emitAck<RoomResponse>(host, 'room:create', { playerName: 'Host', isPublic: true });
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

  it('lets hosts remove lobby players before start', async () => {
    const host = await connectClient();
    const guest = await connectClient();

    const createResponse = await emitAck<RoomResponse>(host, 'room:create', { playerName: 'Host' });
    const roomCode = createResponse.roomCode!;
    const joinResponse = await emitAck<RoomResponse>(guest, 'room:join', { roomCode, playerName: 'Guest' });

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

  it('lets hosts remove a spectator from a live public game', async () => {
    const host = await connectClient();
    const guest = await connectClient();
    const spectator = await connectClient();

    const createResponse = await emitAck<RoomResponse>(host, 'room:create', { playerName: 'Host', isPublic: true });
    const roomCode = createResponse.roomCode!;
    await emitAck<RoomResponse>(guest, 'room:join', { roomCode, playerName: 'Guest' });

    host.emit('game:start');
    await waitForState(host, state => state.status === GameStatus.InProgress, 'host game start');

    const spectateResponse = await emitAck<{ success: boolean; spectatorId?: string; error?: string }>(
      spectator,
      'room:spectate',
      { roomCode, playerName: 'Watcher' },
    );
    expect(spectateResponse.success).toBe(true);
    expect(roomManager.getSpectators(roomCode)).toHaveLength(1);

    const spectatorRemoved = waitForEvent(spectator, 'room:removed', 'spectator removed');
    const spectatorUpdate = waitForRoomUpdate(host, data => (data.spectators ?? []).length === 0, 'spectator list empty');
    const removeResponse = await emitAck<{ success: boolean; error?: string }>(
      host,
      'room:remove_spectator',
      { spectatorId: spectateResponse.spectatorId },
    );
    expect(removeResponse).toMatchObject({ success: true });
    await spectatorRemoved;
    await spectatorUpdate;
    expect(roomManager.getSpectators(roomCode)).toHaveLength(0);

    // The removed spectator must lose its Socket.io subscription and its membership,
    // so it is free to become an authoritative member elsewhere.
    expect(roomManager.getSpectatorRoom(spectator.id)).toBeNull();
    const reused = await emitAck<RoomResponse>(spectator, 'room:create', { playerName: 'Freed Watcher' });
    expect(reused.success).toBe(true);
  });

  it('rejects non-host attempts to remove a spectator from a live game', async () => {
    const host = await connectClient();
    const guest = await connectClient();
    const spectator = await connectClient();

    const createResponse = await emitAck<RoomResponse>(host, 'room:create', { playerName: 'Host', isPublic: true });
    const roomCode = createResponse.roomCode!;
    await emitAck<RoomResponse>(guest, 'room:join', { roomCode, playerName: 'Guest' });

    host.emit('game:start');
    await waitForState(host, state => state.status === GameStatus.InProgress, 'host game start');

    const spectateResponse = await emitAck<{ success: boolean; spectatorId?: string }>(
      spectator,
      'room:spectate',
      { roomCode, playerName: 'Watcher' },
    );
    expect(spectateResponse.success).toBe(true);

    const nonHost = await emitAck<{ success: boolean; error?: string }>(
      guest,
      'room:remove_spectator',
      { spectatorId: spectateResponse.spectatorId },
    );
    expect(nonHost).toMatchObject({ success: false, error: 'Only the host can remove spectators' });

    const bySpectator = await emitAck<{ success: boolean; error?: string }>(
      spectator,
      'room:remove_spectator',
      { spectatorId: spectateResponse.spectatorId },
    );
    expect(bySpectator).toMatchObject({ success: false, error: 'Not in a room' });
    expect(roomManager.getSpectators(roomCode)).toHaveLength(1);
  });

  it('transfers a live socket membership on rejoin and unsubscribes the superseded socket', async () => {
    const host = await connectClient();
    const guest = await connectClient();

    const createResponse = await emitAck<RoomResponse>(host, 'room:create', { playerName: 'Host' });
    const roomCode = createResponse.roomCode!;
    const hostId = createResponse.playerId!;
    const sessionToken = createResponse.sessionToken!;

    // Rejoin from a second socket while the original socket is still connected.
    const replacement = await connectClient();
    const rejoin = await emitAck<RoomResponse>(replacement, 'room:rejoin', { roomCode, playerId: hostId, sessionToken });
    expect(rejoin.success).toBe(true);

    // Exactly one authoritative membership: the replacement socket owns it.
    expect(roomManager.getPlayerRoom(replacement.id)?.player.id).toBe(hostId);
    expect(roomManager.getPlayerRoom(host.id)).toBeNull();

    // The superseded socket must be unsubscribed from the room channel.
    let staleUpdates = 0;
    host.on('room:updated', () => { staleUpdates += 1; });
    const freshUpdate = waitForRoomUpdate(replacement, data => data.players.length === 2, 'guest joined');
    await emitAck<RoomResponse>(guest, 'room:join', { roomCode, playerName: 'Guest' });
    await freshUpdate;
    await delay(50);
    expect(staleUpdates).toBe(0);

    // Having lost its membership, the superseded socket may become a member elsewhere.
    const otherHost = await connectClient();
    const otherRoom = await emitAck<RoomResponse>(otherHost, 'room:create', { playerName: 'Other Host' });
    const reused = await emitAck<RoomResponse>(host, 'room:join', { roomCode: otherRoom.roomCode, playerName: 'Freed Host' });
    expect(reused.success).toBe(true);
    expect(roomManager.getPlayerRoom(host.id)?.room.code).toBe(otherRoom.roomCode);
  });

  it('rejects spectators for private rooms and pre-game public rooms', async () => {
    const privateHost = await connectClient();
    const publicHost = await connectClient();
    const privateSpectator = await connectClient();
    const lobbySpectator = await connectClient();

    const privateRoom = await emitAck<RoomResponse>(privateHost, 'room:create', { playerName: 'Private Host' });
    const privateResponse = await emitAck<{ success: boolean; error?: string }>(privateSpectator, 'room:spectate', {
      roomCode: privateRoom.roomCode,
      playerName: 'Watcher',
    });
    expect(privateResponse).toMatchObject({ success: false, error: 'Spectating is only available for public live games' });
    expect(roomManager.getSpectators(privateRoom.roomCode!)).toHaveLength(0);

    const publicRoom = await emitAck<RoomResponse>(publicHost, 'room:create', { playerName: 'Public Host', isPublic: true });
    const lobbyResponse = await emitAck<{ success: boolean; error?: string }>(lobbySpectator, 'room:spectate', {
      roomCode: publicRoom.roomCode,
      playerName: 'Watcher',
    });
    expect(lobbyResponse).toMatchObject({ success: false, error: 'Spectating is only available for public live games' });
    expect(roomManager.getSpectators(publicRoom.roomCode!)).toHaveLength(0);
  });

  it('rejects a socket joining multiple rooms or holding player and spectator roles', async () => {
    const firstHost = await connectClient();
    const secondHost = await connectClient();
    const guest = await connectClient();

    const firstRoom = await emitAck<RoomResponse>(firstHost, 'room:create', { playerName: 'First Host' });
    const secondRoom = await emitAck<RoomResponse>(secondHost, 'room:create', { playerName: 'Second Host', isPublic: true });
    const duplicateCreate = await emitAck<RoomResponse>(firstHost, 'room:create', { playerName: 'Other Host' });
    expect(duplicateCreate).toMatchObject({ success: false, error: 'Socket is already a room member' });
    expect(roomManager.getPlayerRoom(firstHost.id)?.room.code).toBe(firstRoom.roomCode);

    const joined = await emitAck<RoomResponse>(guest, 'room:join', { roomCode: firstRoom.roomCode, playerName: 'Guest' });
    expect(joined.success).toBe(true);

    const secondJoin = await emitAck<RoomResponse>(guest, 'room:join', { roomCode: secondRoom.roomCode, playerName: 'Duplicate' });
    expect(secondJoin).toMatchObject({ success: false, error: 'Socket is already a room member' });
    expect(roomManager.getRoom(firstRoom.roomCode!)?.players.some(player => player.socketId === guest.id)).toBe(true);
    expect(roomManager.getRoom(secondRoom.roomCode!)?.players.some(player => player.socketId === guest.id)).toBe(false);

    const secondGuest = await connectClient();
    await emitAck<RoomResponse>(secondGuest, 'room:join', { roomCode: secondRoom.roomCode, playerName: 'Starter' });
    secondHost.emit('game:start');
    await waitForState(secondHost, state => state.status === GameStatus.InProgress, 'public game start');

    const spectate = await emitAck<{ success: boolean; error?: string }>(guest, 'room:spectate', {
      roomCode: secondRoom.roomCode,
      playerName: 'Player Watcher',
    });
    expect(spectate).toMatchObject({ success: false, error: 'Socket is already a room member' });
    expect(roomManager.getSpectators(secondRoom.roomCode!)).toHaveLength(0);
  });

  it('rejects rejoin from a socket already authoritative in another room', async () => {
    const original = await connectClient();
    const keeper = await connectClient();
    const occupied = await connectClient();
    const target = await emitAck<RoomResponse>(original, 'room:create', { playerName: 'Original' });
    await emitAck<RoomResponse>(keeper, 'room:join', { roomCode: target.roomCode, playerName: 'Keeper' });
    original.disconnect();
    await delay(50);
    const occupiedRoom = await emitAck<RoomResponse>(occupied, 'room:create', { playerName: 'Occupied' });

    const response = await emitAck<RoomResponse>(occupied, 'room:rejoin', {
      roomCode: target.roomCode,
      playerId: target.playerId,
      sessionToken: target.sessionToken,
    });
    expect(response).toMatchObject({ success: false, error: 'Socket is already a room member' });
    expect(roomManager.getRoom(occupiedRoom.roomCode!)?.players.some(player => player.socketId === occupied.id)).toBe(true);
    expect(roomManager.getRoom(target.roomCode!)?.players.find(player => player.id === target.playerId)?.socketId).not.toBe(occupied.id);
  });

  it('does not mutate room state when acknowledgements are missing or non-callable', async () => {
    const socket = await connectClient();
    const raw = socket as unknown as { emit: (...args: unknown[]) => void };

    raw.emit('room:create', { playerName: 'No Ack' });
    raw.emit('room:create', { playerName: 'Bad Ack' }, { not: 'callable' });
    await delay(50);
    expect(roomManager.getPlayerRoom(socket.id)).toBeNull();

    const created = await emitAck<RoomResponse>(socket, 'room:create', { playerName: 'Valid Host' });
    expect(created.success).toBe(true);
    const room = roomManager.getRoom(created.roomCode!)!;
    const originalSettings = { ...room.settings };
    raw.emit('room:update_settings', { settings: { ...room.settings, isPublic: true } });
    raw.emit('bot:add', { name: 'Bad Bot', personality: 'random' }, 42);
    await delay(50);
    expect(room.settings).toEqual(originalSettings);
    expect(room.players).toHaveLength(1);
  });

  it('survives every acknowledgement handler being called without a usable acknowledgement', async () => {
    // Missing/non-callable acknowledgements must be dropped, not turned into a
    // `callback is not a function` throw that escapes the Socket.io listener.
    const uncaught: unknown[] = [];
    const onUncaught = (err: unknown) => uncaught.push(err);
    process.on('uncaughtException', onUncaught);

    try {
      await exerciseUnusableAcknowledgements();
    } finally {
      process.off('uncaughtException', onUncaught);
    }
    expect(uncaught.map(err => (err instanceof Error ? err.message : String(err)))).toEqual([]);
  });

  async function exerciseUnusableAcknowledgements(): Promise<void> {
    const host = await connectClient();
    const raw = host as unknown as { emit: (...args: unknown[]) => void };

    const created = await emitAck<RoomResponse>(host, 'room:create', { playerName: 'Ack Host' });
    expect(created.success).toBe(true);
    const roomCode = created.roomCode!;
    const room = roomManager.getRoom(roomCode)!;
    const originalSettings = { ...room.settings };

    // Every acknowledgement-based event, with a well-formed payload but an
    // unusable acknowledgement. None may throw or mutate state.
    const payloads: Array<[string, unknown]> = [
      ['room:create', { playerName: 'Second' }],
      ['room:join', { roomCode, playerName: 'Joiner' }],
      ['room:rejoin', { roomCode, playerId: created.playerId, sessionToken: created.sessionToken }],
      ['room:spectate', { roomCode, playerName: 'Watcher' }],
      ['room:remove_player', { playerId: created.playerId }],
      ['room:remove_spectator', { spectatorId: 'nope' }],
      ['room:update_settings', { settings: { ...room.settings, isPublic: true } }],
      ['bot:add', { name: 'Bot One', personality: 'optimal' }],
      ['bot:remove', { botId: 'nope' }],
    ];
    for (const [event, data] of payloads) {
      raw.emit(event, data);                    // acknowledgement omitted
      raw.emit(event, data, null);              // acknowledgement not callable
      raw.emit(event, data, 'ack');
      raw.emit(event, undefined);               // payload omitted too
    }
    await delay(100);

    // The socket is still alive and its single membership is untouched.
    expect(host.connected).toBe(true);
    expect(roomManager.getRoom(roomCode)?.players).toHaveLength(1);
    expect(roomManager.getRoom(roomCode)?.settings).toEqual(originalSettings);
    expect(roomManager.getSpectators(roomCode)).toHaveLength(0);
    expect(roomManager.getPlayerRoom(host.id)?.player.id).toBe(created.playerId);
  }

  it('rejects malformed payloads on every acknowledgement handler before mutating state', async () => {
    const host = await connectClient();
    const created = await emitAck<RoomResponse>(host, 'room:create', { playerName: 'Payload Host' });
    const roomCode = created.roomCode!;
    const room = roomManager.getRoom(roomCode)!;
    const originalSettings = { ...room.settings };

    // Handlers reachable as the room host.
    const hostCases: Array<[string, unknown, string]> = [
      ['room:rejoin', undefined, 'Invalid rejoin data'],
      ['room:rejoin', { roomCode }, 'Invalid rejoin data'],
      ['room:remove_player', undefined, 'Invalid player'],
      ['room:remove_player', { playerId: 7 }, 'Invalid player'],
      ['room:remove_spectator', undefined, 'Invalid spectator'],
      ['room:update_settings', undefined, 'Invalid settings'],
      ['room:update_settings', { settings: 'nope' }, 'Invalid settings'],
      ['bot:add', undefined, 'Invalid bot data'],
      ['bot:add', { name: 'Bot', personality: 5 }, 'Invalid bot data'],
      ['bot:remove', undefined, 'Invalid bot'],
    ];
    for (const [event, data, expectedError] of hostCases) {
      const response = await emitAck<{ success: boolean; error?: string }>(host, event, data);
      expect(response, `${event} with ${JSON.stringify(data)}`).toMatchObject({ success: false, error: expectedError });
    }

    // Handlers reachable from a socket with no membership.
    const outsider = await connectClient();
    const outsiderCases: Array<[string, unknown, string]> = [
      ['room:create', undefined, 'Invalid player name'],
      ['room:create', { playerName: 42 }, 'Invalid player name'],
      ['room:join', undefined, 'Invalid join data'],
      ['room:join', { roomCode }, 'Invalid join data'],
      ['room:spectate', undefined, 'Invalid spectate data'],
      ['room:spectate', { roomCode }, 'Invalid spectate data'],
    ];
    for (const [event, data, expectedError] of outsiderCases) {
      const response = await emitAck<{ success: boolean; error?: string }>(outsider, event, data);
      expect(response, `${event} with ${JSON.stringify(data)}`).toMatchObject({ success: false, error: expectedError });
    }

    // Rejections must not consume rate-limit quota or mutate state.
    expect(roomManager.getRoom(roomCode)?.players).toHaveLength(1);
    expect(roomManager.getRoom(roomCode)?.settings).toEqual(originalSettings);
    expect(roomManager.getPlayerRoom(outsider.id)).toBeNull();
    const stillWorks = await emitAck<RoomResponse>(outsider, 'room:join', { roomCode, playerName: 'Late Guest' });
    expect(stillWorks.success).toBe(true);
  });
});
