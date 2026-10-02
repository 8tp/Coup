import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServer, Server as HttpServer } from 'http';
import { AddressInfo } from 'net';
import { Server as SocketServer } from 'socket.io';
import { io as createClient, Socket as ClientSocket } from 'socket.io-client';
import { SocketHandler } from '@/server/SocketHandler';
import { RoomManager } from '@/server/RoomManager';
import { AFK_TIMEOUTS_BEFORE_REPLACE, FILL_WITH_BOTS_TARGET } from '@/shared/constants';
import { ActionType, ClientGameState, ClientRoomPlayer, GameStatus, PublicRoomInfo, TurnPhase } from '@/shared/types';
import { ClientToServerEvents, RoomResponse, ServerToClientEvents } from '@/shared/protocol';

type TestSocket = ClientSocket<ServerToClientEvents, ClientToServerEvents>;
type RoomUpdate = Parameters<ServerToClientEvents['room:updated']>[0];

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function withTimeout<T>(promise: Promise<T>, message: string, timeoutMs = 4000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      value => { clearTimeout(timer); resolve(value); },
      error => { clearTimeout(timer); reject(error); },
    );
  });
}

function emitAck<TResponse>(socket: TestSocket, event: string, data: unknown): Promise<TResponse> {
  return withTimeout(
    new Promise((resolve) => {
      (socket as unknown as { emit: (...args: unknown[]) => void }).emit(event, data, resolve);
    }),
    `Timed out waiting for ${event} acknowledgement`,
  );
}

function waitFor<T>(socket: TestSocket, event: keyof ServerToClientEvents, predicate: (data: T) => boolean, label: string): Promise<T> {
  return withTimeout(
    new Promise((resolve) => {
      const handler = (data: T) => {
        if (!predicate(data)) return;
        (socket as unknown as { off: (e: string, h: (d: T) => void) => void }).off(event, handler);
        resolve(data);
      };
      (socket as unknown as { on: (e: string, h: (d: T) => void) => void }).on(event, handler);
    }),
    `Timed out waiting for ${label}`,
  );
}

const waitForState = (socket: TestSocket, predicate: (s: ClientGameState) => boolean, label: string) =>
  waitFor<ClientGameState>(socket, 'game:state', predicate, label);
const waitForRoom = (socket: TestSocket, predicate: (d: RoomUpdate) => boolean, label: string) =>
  waitFor<RoomUpdate>(socket, 'room:updated', predicate, label);

describe('SocketHandler — funnel and resilience flows', () => {
  let httpServer: HttpServer;
  let ioServer: SocketServer<ClientToServerEvents, ServerToClientEvents>;
  let roomManager: RoomManager;
  let port: number;
  const clients: TestSocket[] = [];

  beforeEach(async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    httpServer = createServer();
    ioServer = new SocketServer<ClientToServerEvents, ServerToClientEvents>(httpServer, { cors: { origin: '*' } });
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
    for (const client of clients) client.disconnect();
    clients.length = 0;
    await new Promise<void>(resolve => ioServer.close(() => resolve()));
    roomManager.destroy();
    vi.restoreAllMocks();
  });

  async function connectClient(): Promise<TestSocket> {
    const socket = createClient(`http://localhost:${port}`, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    }) as TestSocket;
    clients.push(socket);
    await withTimeout(new Promise<void>((resolve, reject) => {
      socket.once('connect', () => resolve());
      socket.once('connect_error', reject);
    }), 'connect');
    return socket;
  }

  async function createTwoPlayerRoom(isPublic = false) {
    const host = await connectClient();
    const guest = await connectClient();
    const created = await emitAck<RoomResponse>(host, 'room:create', { playerName: 'Host', isPublic });
    const joined = await emitAck<RoomResponse>(guest, 'room:join', { roomCode: created.roomCode, playerName: 'Guest' });
    return {
      host,
      guest,
      roomCode: created.roomCode!,
      hostId: created.playerId!,
      guestId: joined.playerId!,
      guestToken: joined.sessionToken!,
      hostToken: created.sessionToken!,
    };
  }

  async function startGame(host: TestSocket, others: TestSocket[] = []) {
    const started = [host, ...others].map(s => waitForState(s, st => st.status === GameStatus.InProgress, 'game start'));
    host.emit('game:start');
    await Promise.all(started);
  }

  // ─── 1. Lobby refresh survives ───

  it('a lobby refresh keeps the seat, shows it as disconnected, and rejoin restores it', async () => {
    const { host, guest, roomCode, guestId, guestToken } = await createTwoPlayerRoom();

    const sawDisconnected = waitForRoom(host, d => d.players.some(p => p.id === guestId && !p.connected), 'guest disconnected');
    guest.disconnect();
    await sawDisconnected;
    expect(roomManager.getRoom(roomCode)?.players).toHaveLength(2);
    expect(roomManager.hasDisconnectTimer(roomCode, guestId)).toBe(true);

    const refreshed = await connectClient();
    const sawReconnected = waitForRoom(host, d => d.players.some(p => p.id === guestId && p.connected), 'guest reconnected');
    const rejoin = await emitAck<RoomResponse>(refreshed, 'room:rejoin', { roomCode, playerId: guestId, sessionToken: guestToken });
    expect(rejoin).toMatchObject({ success: true, roomCode, playerId: guestId });
    await sawReconnected;
    expect(roomManager.hasDisconnectTimer(roomCode, guestId)).toBe(false);
  });

  it('a lone host refreshing the lobby does not destroy the room', async () => {
    const host = await connectClient();
    const created = await emitAck<RoomResponse>(host, 'room:create', { playerName: 'Solo' });
    host.disconnect();
    await delay(50);
    expect(roomManager.getRoom(created.roomCode!)).toBeDefined();

    const refreshed = await connectClient();
    const rejoin = await emitAck<RoomResponse>(refreshed, 'room:rejoin', {
      roomCode: created.roomCode, playerId: created.playerId, sessionToken: created.sessionToken,
    });
    expect(rejoin.success).toBe(true);
    expect(roomManager.getRoom(created.roomCode!)?.hostId).toBe(created.playerId);
  });

  it('a player who dropped in the lobby is dealt in and can rejoin straight into the game', async () => {
    const { host, guest, roomCode, guestId, guestToken } = await createTwoPlayerRoom();
    guest.disconnect();
    await waitForRoom(host, d => d.players.some(p => p.id === guestId && !p.connected), 'guest disconnected');

    await startGame(host);
    expect(roomManager.getEngine(roomCode)?.game.getPlayer(guestId)).toBeDefined();
    expect(roomManager.hasDisconnectTimer(roomCode, guestId)).toBe(true); // in-game bot timer

    const back = await connectClient();
    const state = waitForState(back, s => s.status === GameStatus.InProgress, 'rejoined game state');
    const rejoin = await emitAck<RoomResponse>(back, 'room:rejoin', { roomCode, playerId: guestId, sessionToken: guestToken });
    expect(rejoin.success).toBe(true);
    await expect(state).resolves.toMatchObject({ myId: guestId });
    expect(roomManager.hasDisconnectTimer(roomCode, guestId)).toBe(false);
  });

  // ─── 2. Explicit leave mid-game ───

  it('an explicit leave mid-game hands the seat to a bot immediately', async () => {
    const { host, guest, roomCode, guestId } = await createTwoPlayerRoom();
    // A third human keeps the game going after the guest walks.
    const third = await connectClient();
    await emitAck<RoomResponse>(third, 'room:join', { roomCode, playerName: 'Third' });
    await startGame(host, [guest, third]);

    const replacedState = waitForState(host, s => s.actionLog.some(e => e.message === 'Guest left — a bot took their seat.'), 'bot replacement log');
    guest.emit('room:leave');
    await replacedState;

    expect(roomManager.getRoom(roomCode)?.players.find(p => p.id === guestId)).toMatchObject({ isBot: true, replacedByBot: true });
    expect(roomManager.hasDisconnectTimer(roomCode, guestId)).toBe(false);

    // The departed socket is free to start something new right away.
    const fresh = await emitAck<RoomResponse>(guest, 'room:create', { playerName: 'Guest Again' });
    expect(fresh.success).toBe(true);
  });

  // ─── 3. AFK ───

  it(`replaces a connected player after ${AFK_TIMEOUTS_BEFORE_REPLACE} consecutive turn timeouts and tells them why`, async () => {
    const { host, guest, roomCode, guestId } = await createTwoPlayerRoom();
    await startGame(host, [guest]);
    const engine = roomManager.getEngine(roomCode)!;

    const removed = waitFor<{ message: string }>(guest, 'room:removed', () => true, 'room:removed for idle guest');
    for (let i = 0; i < AFK_TIMEOUTS_BEFORE_REPLACE; i++) {
      engine.game.currentPlayerIndex = engine.game.players.findIndex(p => p.id === guestId);
      engine.game.turnPhase = TurnPhase.AwaitingAction;
      engine.handleTimerExpiry();
    }

    await expect(removed).resolves.toMatchObject({ message: expect.stringContaining('idle') });
    const seat = roomManager.getRoom(roomCode)?.players.find(p => p.id === guestId);
    expect(seat).toMatchObject({ isBot: true, replacedByBot: true });
    expect(engine.game.actionLog.map(e => e.message)).toContain('Guest was idle — a bot took their seat.');
  });

  it('acting between timeouts resets the AFK count', async () => {
    const { host, guest, roomCode, guestId } = await createTwoPlayerRoom();
    await startGame(host, [guest]);
    const engine = roomManager.getEngine(roomCode)!;
    const guestTurn = () => {
      engine.game.currentPlayerIndex = engine.game.players.findIndex(p => p.id === guestId);
      engine.game.turnPhase = TurnPhase.AwaitingAction;
    };

    guestTurn();
    engine.handleTimerExpiry();
    expect(roomManager.getAfkStrikes(roomCode, guestId)).toBe(1);

    guestTurn();
    const guestIncomes = (s: { actionLog: Array<{ eventType: string; actorId: string | null }> }) =>
      s.actionLog.filter(e => e.eventType === 'income' && e.actorId === guestId).length;
    const before = guestIncomes(engine.getFullState());
    const acted = waitForState(host, s => guestIncomes(s) > before, 'guest income');
    guest.emit('game:action', { action: ActionType.Income });
    await acted;
    expect(roomManager.getAfkStrikes(roomCode, guestId)).toBe(0);

    guestTurn();
    engine.handleTimerExpiry();
    expect(roomManager.getRoom(roomCode)?.players.find(p => p.id === guestId)?.isBot).toBeFalsy();
  });

  // ─── 4. Finished rooms are joinable ───

  it('lets a newcomer join a finished public room and seats them at the rematch', async () => {
    const { host, guest, roomCode, hostId, guestId } = await createTwoPlayerRoom(true);
    await startGame(host, [guest]);
    const engine = roomManager.getEngine(roomCode)!;

    // Finish the game: the guest is eliminated by a coup.
    for (const inf of engine.game.getPlayer(guestId)!.influences) inf.revealed = true;
    engine.game.checkWinCondition();
    expect(engine.game.status).toBe(GameStatus.Finished);

    const browser = await connectClient();
    const list = waitFor<{ rooms: PublicRoomInfo[] }>(browser, 'browser:list', d => d.rooms.some(r => r.code === roomCode), 'browser list');
    browser.emit('browser:subscribe');
    const listed = (await list).rooms.find(r => r.code === roomCode)!;
    expect(listed).toMatchObject({ hasGame: false, betweenGames: true });

    const newcomer = await connectClient();
    let newcomerGotState = false;
    newcomer.on('game:state', () => { newcomerGotState = true; });
    const joined = await emitAck<RoomResponse>(newcomer, 'room:join', { roomCode, playerName: 'Late' });
    expect(joined.success).toBe(true);

    // Further game broadcasts don't drag the newcomer into a game they weren't in.
    const hostSawGameOver = waitForState(host, s => s.turnPhase === TurnPhase.GameOver, 'host game over');
    (engine as unknown as { broadcastState(): void }).broadcastState();
    await hostSawGameOver;
    await delay(100);
    expect(newcomerGotState).toBe(false);
    expect(roomManager.getRoom(roomCode)?.players.find(p => p.id === hostId)?.wins).toBe(1);

    const lobby = waitForRoom(newcomer, d => d.players.length === 3, 'rematch lobby');
    host.emit('game:rematch');
    const update = await lobby;
    expect(update.players.map((p: ClientRoomPlayer) => p.name)).toEqual(['Host', 'Guest', 'Late']);
    expect(update.hostId).toBe(hostId);
  });

  // ─── 6. Fill with bots (server side) ───

  it(`fills a solo lobby up to ${FILL_WITH_BOTS_TARGET} players with bot:add_many, keeping the human host`, async () => {
    const host = await connectClient();
    const created = await emitAck<RoomResponse>(host, 'room:create', { playerName: 'Solo', origin: 'quick_play' });
    const bots = Array.from({ length: FILL_WITH_BOTS_TARGET - 1 }, (_, i) => ({ name: `Filler ${i + 1}`, personality: 'random' }));

    const response = await emitAck<{ success: boolean; botIds?: string[] }>(host, 'bot:add_many', { bots });
    expect(response.success).toBe(true);
    const room = roomManager.getRoom(created.roomCode!)!;
    expect(room.players).toHaveLength(FILL_WITH_BOTS_TARGET);
    expect(room.players.filter(p => p.isBot)).toHaveLength(FILL_WITH_BOTS_TARGET - 1);
    expect(room.hostId).toBe(created.playerId);

    // Quick-play rooms are tagged for metrics only; an unknown origin is ignored.
    const other = await connectClient();
    const weird = await emitAck<RoomResponse>(other, 'room:create', { playerName: 'Odd', origin: 'not-a-real-origin' });
    expect(weird.success).toBe(true);
  });
});
