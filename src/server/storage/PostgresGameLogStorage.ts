import { Pool, PoolConfig } from 'pg';
import { GameLog } from '../../shared/gameLogTypes';
import { AggregateGameStats } from '../../shared/metricTypes';
import { GameLogStorage } from './GameLogStorage';
import { anonymizeGameLog } from './anonymizeGameLog';

/** Small pool: one row per finished game is a tiny write load. */
const PG_POOL_MAX = 3;
const PG_CONNECT_TIMEOUT_MS = 5_000;
const PG_STATEMENT_TIMEOUT_MS = 5_000;
const PG_IDLE_TIMEOUT_MS = 30_000;
/** Refuse new work instead of queueing without bound when the DB is slow. */
const PG_MAX_WAITING = 10;
/** Successful stats are served from memory this long (saves don't invalidate). */
const STATS_CACHE_MS = 60_000;
/** A failed stats query is not retried for this long. */
const STATS_FAILURE_CACHE_MS = 10_000;

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS coup_games (
  game_id       TEXT PRIMARY KEY,
  finished_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at    TIMESTAMPTZ,
  game_mode     TEXT NOT NULL,
  player_count  SMALLINT NOT NULL,
  humans        SMALLINT NOT NULL,
  bots          SMALLINT NOT NULL,
  duration_ms   INTEGER NOT NULL,
  turns         INTEGER NOT NULL,
  winner_is_bot BOOLEAN NOT NULL,
  source        TEXT NOT NULL,
  payload       JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS coup_games_finished_at_idx ON coup_games (finished_at);
CREATE INDEX IF NOT EXISTS coup_games_game_mode_idx ON coup_games (game_mode);
CREATE INDEX IF NOT EXISTS coup_games_humans_bots_idx ON coup_games (humans, bots);
CREATE INDEX IF NOT EXISTS coup_games_duration_ms_idx ON coup_games (duration_ms);
`;

const INSERT_SQL = `
INSERT INTO coup_games
  (game_id, finished_at, started_at, game_mode, player_count, humans, bots, duration_ms, turns, winner_is_bot, source, payload)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
ON CONFLICT (game_id) DO NOTHING
`;

/** Single statement so a stats read holds at most one pooled connection. */
const STATS_SQL = `
WITH recent AS (
  SELECT game_mode, player_count, humans, bots, duration_ms, finished_at
  FROM coup_games
  WHERE finished_at > now() - interval '30 days'
)
SELECT
  (SELECT count(*)::int FROM coup_games) AS total,
  (SELECT count(*)::int FROM recent WHERE finished_at > now() - interval '7 days') AS last7,
  (SELECT count(*)::int FROM recent) AS last30,
  (SELECT count(*)::int FROM recent WHERE humans = 1 AND bots > 0) AS solo30,
  (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY duration_ms) FROM recent) AS median30,
  (SELECT coalesce(json_object_agg(game_mode, n), '{}'::json)
     FROM (SELECT game_mode, count(*)::int AS n FROM recent GROUP BY game_mode) m) AS by_mode,
  (SELECT coalesce(json_object_agg(player_count::text, n), '{}'::json)
     FROM (SELECT player_count, count(*)::int AS n FROM recent GROUP BY player_count) p) AS by_players
`;

/** The subset of `pg.Pool` this class uses (lets tests inject a fake). */
export interface PgPoolLike {
  query(text: string, params?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
  /** Clients queued waiting for a connection (pg.Pool exposes this). */
  readonly waitingCount?: number;
  on?(event: 'error', listener: (err: Error) => void): unknown;
  end?(): Promise<void>;
}

export interface PostgresGameLogStorageOptions {
  /** Usually process.env.DATABASE_URL. When absent the storage is a no-op. */
  connectionString?: string;
  /** Test seam: use this pool instead of creating a pg.Pool. */
  pool?: PgPoolLike;
}

class PoolSaturatedError extends Error {
  constructor() {
    super('Postgres pool saturated; dropping request');
  }
}

/**
 * Durable finished-game log, one row per game in `coup_games`.
 *
 * Active only when a connection string (DATABASE_URL) is configured; without
 * one every method is a cheap no-op. All methods swallow and log database
 * errors — persistence must never crash or stall the game loop. Stored
 * payloads are anonymized (players become seats, names become "Player N").
 */
export class PostgresGameLogStorage implements GameLogStorage {
  readonly enabled: boolean;
  private pool: PgPoolLike | null;
  private schemaReady: Promise<void> | null = null;
  private statsCache: { at: number; value: AggregateGameStats | null } | null = null;
  private statsInFlight: Promise<AggregateGameStats | null> | null = null;
  private pendingWrites = new Set<Promise<void>>();

  constructor(options: PostgresGameLogStorageOptions = {}) {
    if (options.pool) {
      this.pool = options.pool;
    } else if (options.connectionString) {
      const config: PoolConfig = {
        connectionString: options.connectionString,
        max: PG_POOL_MAX,
        idleTimeoutMillis: PG_IDLE_TIMEOUT_MS,
        connectionTimeoutMillis: PG_CONNECT_TIMEOUT_MS,
        statement_timeout: PG_STATEMENT_TIMEOUT_MS,
        query_timeout: PG_STATEMENT_TIMEOUT_MS + 1_000,
        application_name: 'coup-online',
      };
      this.pool = new Pool(config);
    } else {
      this.pool = null;
    }
    this.enabled = this.pool !== null;

    // An idle client erroring (e.g. DB restart) emits 'error' on the pool;
    // unhandled, that would take the whole process down.
    this.pool?.on?.('error', (err) => {
      console.error('[storage] Postgres pool error:', err.message);
    });
  }

  /** Run a query unless the pool already has too many requests queued. */
  private query(text: string, params?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }> {
    const pool = this.pool;
    if (!pool) return Promise.resolve({ rows: [] });
    if ((pool.waitingCount ?? 0) >= PG_MAX_WAITING) return Promise.reject(new PoolSaturatedError());
    return pool.query(text, params);
  }

  private ensureSchema(): Promise<void> {
    if (!this.pool) return Promise.resolve();
    if (!this.schemaReady) {
      this.schemaReady = this.query(SCHEMA_SQL).then(() => undefined);
      // Retry schema creation on the next call if it failed (e.g. DB not up yet).
      this.schemaReady.catch(() => { this.schemaReady = null; });
    }
    return this.schemaReady;
  }

  saveGameLog(log: GameLog): Promise<void> {
    if (!this.pool) return Promise.resolve();
    const write = this.writeGameLog(log);
    this.pendingWrites.add(write);
    void write.finally(() => this.pendingWrites.delete(write));
    return write;
  }

  private async writeGameLog(log: GameLog): Promise<void> {
    try {
      await this.ensureSchema();
      const bots = log.botsAtStart ?? log.players.filter(p => p.isBot).length;
      const humans = log.humansAtStart ?? log.playerCount - bots;
      const winner = log.players.find(p => p.id === log.winnerId);
      await this.query(INSERT_SQL, [
        log.gameId,
        log.endedAt ? new Date(log.endedAt) : new Date(),
        log.startedAt ? new Date(log.startedAt) : null,
        log.gameMode ?? 'Classic',
        log.playerCount,
        humans,
        bots,
        Math.max(0, Math.round(log.durationMs)),
        log.stats.totalTurns,
        !!winner?.isBot,
        log.source,
        JSON.stringify(anonymizeGameLog(log)),
      ]);
    } catch (err) {
      console.error('[storage] Failed to save game log:', err instanceof Error ? err.message : err);
    }
  }

  /** Wait (at most `timeoutMs`) for in-flight game-log writes, e.g. before shutdown. */
  async flush(timeoutMs: number): Promise<void> {
    if (this.pendingWrites.size === 0) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
      Promise.allSettled([...this.pendingWrites]),
      new Promise<void>(resolve => { timer = setTimeout(resolve, timeoutMs); }),
    ]);
    if (timer) clearTimeout(timer);
  }

  get pendingWriteCount(): number {
    return this.pendingWrites.size;
  }

  async getGameLogs(): Promise<GameLog[]> {
    if (!this.pool) return [];
    try {
      await this.ensureSchema();
      const result = await this.query('SELECT payload FROM coup_games ORDER BY finished_at DESC LIMIT 500');
      return result.rows.map(row => row.payload as GameLog);
    } catch (err) {
      console.error('[storage] Failed to read game logs:', err instanceof Error ? err.message : err);
      return [];
    }
  }

  async getGameLog(gameId: string): Promise<GameLog | null> {
    if (!this.pool) return null;
    try {
      await this.ensureSchema();
      const result = await this.query('SELECT payload FROM coup_games WHERE game_id = $1', [gameId]);
      return (result.rows[0]?.payload as GameLog | undefined) ?? null;
    } catch (err) {
      console.error('[storage] Failed to read game log:', err instanceof Error ? err.message : err);
      return null;
    }
  }

  /**
   * Aggregate, PII-free counts. Null when storage is disabled or the DB is
   * unreachable. Successes are cached for 60s and failures for 10s, and
   * concurrent callers share one in-flight query, so /api/stats traffic can
   * never occupy more than one pooled connection.
   */
  getAggregateStats(now: number = Date.now()): Promise<AggregateGameStats | null> {
    if (!this.pool) return Promise.resolve(null);
    const cached = this.statsCache;
    if (cached) {
      const ttl = cached.value ? STATS_CACHE_MS : STATS_FAILURE_CACHE_MS;
      if (now - cached.at < ttl) return Promise.resolve(cached.value);
    }
    if (this.statsInFlight) return this.statsInFlight;

    const run = this.computeStats(now).then(value => {
      this.statsCache = { at: now, value };
      return value;
    });
    this.statsInFlight = run;
    void run.finally(() => { if (this.statsInFlight === run) this.statsInFlight = null; });
    return run;
  }

  private async computeStats(now: number): Promise<AggregateGameStats | null> {
    try {
      await this.ensureSchema();
      const result = await this.query(STATS_SQL);
      const row = result.rows[0] ?? {};
      const median = row.median30;
      return {
        totalGames: Number(row.total ?? 0),
        gamesLast7Days: Number(row.last7 ?? 0),
        gamesLast30Days: Number(row.last30 ?? 0),
        medianDurationMsLast30Days: median === null || median === undefined ? null : Math.round(Number(median)),
        soloVsBotsGamesLast30Days: Number(row.solo30 ?? 0),
        byGameModeLast30Days: toCountMap(row.by_mode),
        byPlayerCountLast30Days: toCountMap(row.by_players),
        generatedAt: new Date(now).toISOString(),
      };
    } catch (err) {
      console.error('[storage] Failed to compute stats:', err instanceof Error ? err.message : err);
      return null;
    }
  }

  async close(): Promise<void> {
    try {
      await this.pool?.end?.();
    } catch {
      // ignore
    }
  }
}

function toCountMap(value: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (value && typeof value === 'object') {
    for (const [key, n] of Object.entries(value as Record<string, unknown>)) out[key] = Number(n ?? 0);
  }
  return out;
}

/**
 * Durable game-log storage if DATABASE_URL is configured, otherwise null
 * (the server then keeps only the structured `[metric]` log lines).
 */
export function createGameLogStorage(env: Record<string, string | undefined> = process.env): PostgresGameLogStorage | null {
  const url = env.DATABASE_URL?.trim();
  if (!url) return null;
  return new PostgresGameLogStorage({ connectionString: url });
}
