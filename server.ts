import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import next from 'next';
import { RoomManager } from './src/server/RoomManager';
import { SocketHandler } from './src/server/SocketHandler';
import type { ClientToServerEvents, ServerToClientEvents } from './src/shared/protocol';

const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT || '3000', 10);

// Prevent the entire server from crashing on unhandled errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = express();
  const httpServer = createServer(server);

  if (!dev && !process.env.CORS_ORIGIN) {
    console.warn('WARNING: CORS_ORIGIN is not set in production. Cross-origin requests will be rejected.');
  }

  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: dev ? '*' : (process.env.CORS_ORIGIN || false),
    },
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  server.set('trust proxy', 1);

  // Security headers
  server.use((_req, res, next) => {
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-XSS-Protection', '0');
    if (!dev) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' wss: ws:; img-src 'self' data:; font-src 'self'");
    }
    next();
  });

  const roomManager = new RoomManager();
  const socketHandler = new SocketHandler(io, roomManager);

  io.on('connection', (socket) => {
    socketHandler.handleConnection(socket);
  });

  // Health check endpoint
  server.get('/health', (_req, res) => {
    res.status(200).send('ok');
  });

  // Let Next.js handle all other routes
  server.all('*', (req, res) => {
    return handle(req, res);
  });

  httpServer.listen(port, () => {
    console.log(`> Coup server ready on http://localhost:${port}`);
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log('Shutting down gracefully...');
    roomManager.destroy();
    io.close();
    httpServer.close(() => {
      process.exit(0);
    });
    // Force exit after 5 seconds if connections don't close
    setTimeout(() => process.exit(1), 5000);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
});
