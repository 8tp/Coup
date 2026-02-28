import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import next from 'next';
import { RoomManager } from './src/server/RoomManager';
import { SocketHandler } from './src/server/SocketHandler';
import type { ClientToServerEvents, ServerToClientEvents } from './src/shared/protocol';

const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = express();
  const httpServer = createServer(server);

  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: dev ? '*' : undefined,
    },
    pingInterval: 10000,
    pingTimeout: 5000,
  });

  const roomManager = new RoomManager();
  const socketHandler = new SocketHandler(io, roomManager);

  io.on('connection', (socket) => {
    socketHandler.handleConnection(socket);
  });

  // Let Next.js handle all other routes
  server.all('*', (req, res) => {
    return handle(req, res);
  });

  httpServer.listen(port, () => {
    console.log(`> Coup server ready on http://localhost:${port}`);
  });
});
