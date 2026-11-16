import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createServer, Server as HttpServer } from 'http';
import { AddressInfo } from 'net';
import { Server as SocketServer } from 'socket.io';
import { io as createClient, Socket as ClientSocket } from 'socket.io-client';
import { SocketHandler } from '@/server/SocketHandler';
import { RoomManager } from '@/server/RoomManager';
import { CHAT_RATE_LIMIT_MS, QUICK_PHRASES } from '@/shared/constants';
import { ChatMessage } from '@/shared/types';
import { ClientToServerEvents, RoomResponse, ServerToClientEvents } from '@/shared/protocol';

type TestSocket = ClientSocket<ServerToClientEvents, ClientToServerEvents>;

function ack<T>(fn: (resolve: (value: T) => void) => void, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out: ${label}`)), 4000);
    fn(value => { clearTimeout(timer); resolve(value); });
  });
}

/**
 * Quick phrases travel as an id, so each reader sees the phrase in their own
 * language; the English stays in `message` for older clients and server logs.
 */
describe('SocketHandler: chat quick phrases', () => {
  let httpServer: HttpServer;
  let ioServer: SocketServer<ClientToServerEvents, ServerToClientEvents>;
  let roomManager: RoomManager;
  let port: number;
  const clients: TestSocket[] = [];

  beforeEach(async () => {
    httpServer = createServer();
    ioServer = new SocketServer<ClientToServerEvents, ServerToClientEvents>(httpServer, { cors: { origin: '*' } });
    roomManager = new RoomManager();
    const handler = new SocketHandler(ioServer, roomManager);
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
  });

  async function connect(): Promise<TestSocket> {
    const socket: TestSocket = createClient(`http://localhost:${port}`, { transports: ['websocket'], forceNew: true });
    clients.push(socket);
    await ack<void>(resolve => socket.on('connect', () => resolve()), 'connect');
    return socket;
  }

  async function twoInARoom(): Promise<{ host: TestSocket; guest: TestSocket }> {
    const host = await connect();
    const guest = await connect();
    const created = await ack<RoomResponse>(resolve => host.emit('room:create', { playerName: 'Host' }, resolve), 'room:create');
    await ack<RoomResponse>(resolve => guest.emit('room:join', { roomCode: created.roomCode!, playerName: 'Guest' }, resolve), 'room:join');
    return { host, guest };
  }

  const nextChat = (socket: TestSocket) => ack<ChatMessage>(resolve => socket.once('chat:message', resolve), 'chat:message');

  it('passes a quick phrase on by id, with its English as the message', async () => {
    const { host, guest } = await twoInARoom();
    const phrase = QUICK_PHRASES.find(p => p.id === 'have_it')!;
    const received = nextChat(guest);
    host.emit('chat:send', { message: 'Eu tenho', phraseId: phrase.id });
    const msg = await received;
    expect(msg.phraseId).toBe('have_it');
    // Whatever the sender's client typed, the stored line is the phrase's English.
    expect(msg.message).toBe('I have it');
    expect(msg.playerName).toBe('Host');
  });

  it('treats an unknown phrase id as typed text, and typed text carries no id', async () => {
    const { host, guest } = await twoInARoom();
    let received = nextChat(guest);
    host.emit('chat:send', { message: 'hello there', phraseId: 'not_a_phrase' });
    let msg = await received;
    expect(msg.phraseId).toBeUndefined();
    expect(msg.message).toBe('hello there');

    await new Promise(r => setTimeout(r, CHAT_RATE_LIMIT_MS + 50));
    received = nextChat(guest);
    host.emit('chat:send', { message: 'Nice bluff' });
    msg = await received;
    expect(msg.phraseId).toBeUndefined();
    expect(msg.message).toBe('Nice bluff');
  });

  it('keeps the phrase id in the history a rejoining player receives', async () => {
    const { host } = await twoInARoom();
    const received = nextChat(host);
    host.emit('chat:send', { message: 'Well played', phraseId: 'well_played' });
    await received;
    const room = [...(roomManager as unknown as { chatMessages: Map<string, ChatMessage[]> }).chatMessages.values()][0];
    expect(room.at(-1)).toMatchObject({ phraseId: 'well_played', message: 'Well played' });
  });
});
