import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import next from 'next';
import { RoomManager } from './src/server/RoomManager';
import { SocketHandler } from './src/server/SocketHandler';
import { createGameLogStorage } from './src/server/storage/PostgresGameLogStorage';
import type { ClientToServerEvents, ServerToClientEvents } from './src/shared/protocol';

const dev = process.env.NODE_ENV !== 'production';
/** On shutdown, wait at most this long for in-flight game-log writes. */
const SHUTDOWN_STORAGE_FLUSH_MS = 3000;
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
  server.disable('x-powered-by');

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
      // Cloudflare Web Analytics is injected at the edge: allow its beacon script and its reporting endpoint.
      res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; connect-src 'self' wss: ws: https://cloudflareinsights.com; img-src 'self' data:; font-src 'self'");
    }
    next();
  });

  server.use(express.static('public', {
    fallthrough: true,
    setHeaders: (res, filePath) => {
      if (/\.(?:ico|mp3|png|svg|webp)$/i.test(filePath)) {
        res.setHeader(
          'Cache-Control',
          dev ? 'public, max-age=0' : 'public, max-age=86400, stale-while-revalidate=604800',
        );
      }
    },
  }));

  // Durable finished-game storage: only when DATABASE_URL is configured.
  const gameLogStorage = createGameLogStorage();
  console.log(gameLogStorage
    ? '> Game log storage: Postgres (DATABASE_URL set)'
    : '> Game log storage: disabled (set DATABASE_URL to enable)');

  const roomManager = new RoomManager({ gameLogStorage });
  const socketHandler = new SocketHandler(io, roomManager);

  io.on('connection', (socket) => {
    socketHandler.handleConnection(socket);
  });

  // Health check endpoint
  server.get('/health', (_req, res) => {
    res.status(200).send('ok');
  });

  // Aggregate, PII-free game counts. Only exists when durable storage is configured.
  server.get('/api/stats', async (_req, res) => {
    if (!gameLogStorage) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const stats = await gameLogStorage.getAggregateStats();
    if (!stats) {
      res.status(503).json({ error: 'Stats temporarily unavailable' });
      return;
    }
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.json(stats);
  });

  // Let Next.js handle all other routes
  server.all('*', (req, res) => {
    return handle(req, res);
  });

  httpServer.listen(port, () => {
    console.log(`> Coup server ready on http://localhost:${port}`);
  });

  // Graceful shutdown
  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log('Shutting down gracefully...');
    // Force exit after 5 seconds if connections don't close
    setTimeout(() => process.exit(1), 5000).unref();
    roomManager.destroy();
    io.close();
    // Let finished-game writes land before the pool goes away (bounded wait).
    if (gameLogStorage) {
      await gameLogStorage.flush(SHUTDOWN_STORAGE_FLUSH_MS);
      await gameLogStorage.close();
    }
    httpServer.close(() => {
      process.exit(0);
    });
  };
  process.on('SIGTERM', () => { void shutdown(); });
  process.on('SIGINT', () => { void shutdown(); });
});
