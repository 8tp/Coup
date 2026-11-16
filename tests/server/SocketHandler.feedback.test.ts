import { afterEach, beforeEach, describe, expect, it, MockInstance, vi } from 'vitest';
import { createServer, Server as HttpServer } from 'http';
import { AddressInfo } from 'net';
import { Server as SocketServer } from 'socket.io';
import { io as createClient, Socket as ClientSocket } from 'socket.io-client';
import { SocketHandler } from '@/server/SocketHandler';
import { RoomManager } from '@/server/RoomManager';
import { FEEDBACK_PREFIX, FeedbackService } from '@/server/feedback';
import { FEEDBACK_PER_CONNECTION_MAX } from '@/shared/constants';
import { FeedbackRecord, FeedbackResponse, FeedbackSubmission } from '@/shared/feedbackTypes';
import { ClientToServerEvents, RoomResponse, ServerToClientEvents } from '@/shared/protocol';

type TestSocket = ClientSocket<ServerToClientEvents, ClientToServerEvents>;

function ack<T>(fn: (resolve: (value: T) => void) => void, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out: ${label}`)), 4000);
    fn(value => { clearTimeout(timer); resolve(value); });
  });
}

const sendFeedback = (socket: TestSocket, data: FeedbackSubmission) =>
  ack<FeedbackResponse>(resolve => socket.emit('feedback:send', data, resolve), 'feedback:send');

const CLIENT_CONTEXT = { screen: 'lobby', viewport: 'phone', browser: 'chrome', os: 'android', textSize: 'normal', standalone: false } as const;

describe('SocketHandler: feedback:send', () => {
  let httpServer: HttpServer;
  let ioServer: SocketServer<ClientToServerEvents, ServerToClientEvents>;
  let roomManager: RoomManager;
  let saved: FeedbackRecord[];
  let logSpy: MockInstance<typeof console.log>;
  let port: number;
  const clients: TestSocket[] = [];

  const feedbackLines = (): FeedbackRecord[] => logSpy.mock.calls
    .map(call => String(call[0]))
    .filter(line => line.startsWith(`${FEEDBACK_PREFIX} `))
    .map(line => JSON.parse(line.slice(FEEDBACK_PREFIX.length + 1)) as FeedbackRecord);

  beforeEach(async () => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    saved = [];
    httpServer = createServer();
    ioServer = new SocketServer<ClientToServerEvents, ServerToClientEvents>(httpServer, { cors: { origin: '*' } });
    roomManager = new RoomManager();
    const feedback = new FeedbackService({ storage: { saveFeedback: async r => { saved.push(r); } }, appVersion: 'abc1234' });
    const handler = new SocketHandler(ioServer, roomManager, { feedback });
    ioServer.on('connection', socket => handler.handleConnection(socket));
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
    roomManager.destroy();
    await new Promise<void>(resolve => ioServer.close(() => resolve()));
    vi.restoreAllMocks();
  });

  async function connect(): Promise<TestSocket> {
    const socket: TestSocket = createClient(`http://localhost:${port}`, { transports: ['websocket'], forceNew: true });
    clients.push(socket);
    await ack<void>(resolve => socket.on('connect', () => resolve()), 'connect');
    return socket;
  }

  it('accepts a note from the home page (no room) and logs it with no room fields', async () => {
    const socket = await connect();
    const response = await sendFeedback(socket, { kind: 'idea', message: '  Add a 2v2 mode  ', context: { ...CLIENT_CONTEXT, screen: 'home' } });
    expect(response).toEqual({ success: true });

    const [record] = feedbackLines();
    expect(record).toMatchObject({
      kind: 'idea',
      message: 'Add a 2v2 mode',
      context: { screen: 'home', roomState: 'none', sender: 'no_room', room: null, gameId: null, appVersion: 'abc1234' },
    });
    await vi.waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0].id).toBe(record.id);
  });

  it('attaches the room metric id from socket membership, never the code, name or socket id', async () => {
    const socket = await connect();
    const created = await ack<RoomResponse>(resolve => socket.emit('room:create', { playerName: 'ZaraUniqueName' }, resolve), 'room:create');
    expect(created.success).toBe(true);

    const response = await sendFeedback(socket, { kind: 'bug', message: 'Lobby froze', context: CLIENT_CONTEXT });
    expect(response).toEqual({ success: true });

    const line = logSpy.mock.calls.map(c => String(c[0])).find(l => l.startsWith(FEEDBACK_PREFIX))!;
    expect(line).not.toContain('ZaraUniqueName');
    expect(line).not.toContain(`"${created.roomCode}"`);
    expect(line).not.toContain(socket.id!);
    expect(line).not.toContain(created.sessionToken!);
    expect(line).not.toContain(created.playerId!);
    const [record] = feedbackLines();
    expect(record.context).toMatchObject({ screen: 'lobby', roomState: 'lobby', sender: 'lobby', humans: 1, bots: 0 });
    expect(record.context.room).toMatch(/^[0-9a-f]{10}$/);
  });

  it('rejects invalid notes with a code and does not log them', async () => {
    const socket = await connect();
    expect(await sendFeedback(socket, { kind: 'bug', message: '   ', context: CLIENT_CONTEXT })).toEqual({ success: false, error: 'empty' });
    expect(await sendFeedback(socket, { kind: 'rant' as 'bug', message: 'x', context: CLIENT_CONTEXT })).toEqual({ success: false, error: 'invalid' });
    expect(await sendFeedback(socket, null as unknown as FeedbackSubmission)).toEqual({ success: false, error: 'invalid' });
    expect(feedbackLines()).toHaveLength(0);
  });

  it('rate limits per connection; a new connection gets its own quota', async () => {
    const socket = await connect();
    for (let i = 0; i < FEEDBACK_PER_CONNECTION_MAX; i++) {
      expect(await sendFeedback(socket, { kind: 'other', message: `note ${i}`, context: CLIENT_CONTEXT })).toEqual({ success: true });
    }
    expect(await sendFeedback(socket, { kind: 'other', message: 'spam', context: CLIENT_CONTEXT })).toEqual({ success: false, error: 'rate_limited' });

    const other = await connect();
    expect(await sendFeedback(other, { kind: 'other', message: 'hello', context: CLIENT_CONTEXT })).toEqual({ success: true });
    expect(feedbackLines()).toHaveLength(FEEDBACK_PER_CONNECTION_MAX + 1);
  });

  it('ignores an emit without an acknowledgement callback', async () => {
    const socket = await connect();
    (socket as unknown as { emit: (e: string, d: unknown) => void }).emit('feedback:send', { kind: 'bug', message: 'no ack', context: CLIENT_CONTEXT });
    // The connection stays healthy and the next note works.
    expect(await sendFeedback(socket, { kind: 'bug', message: 'with ack', context: CLIENT_CONTEXT })).toEqual({ success: true });
    expect(feedbackLines().map(r => r.message)).toEqual(['with ack']);
  });
});
