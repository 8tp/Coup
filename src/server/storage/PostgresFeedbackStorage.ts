import { Pool, PoolConfig } from 'pg';
import { FeedbackContext, FeedbackKind, FeedbackRecord } from '../../shared/feedbackTypes';
import type { FeedbackSink } from '../feedback';
import { PgPoolLike } from './PostgresGameLogStorage';

/** Feedback is a handful of rows a day: two connections are plenty. */
const PG_POOL_MAX = 2;
const PG_CONNECT_TIMEOUT_MS = 5_000;
const PG_STATEMENT_TIMEOUT_MS = 5_000;
const PG_IDLE_TIMEOUT_MS = 30_000;
/** Refuse new work instead of queueing without bound when the DB is slow. */
const PG_MAX_WAITING = 10;
export const FEEDBACK_LIST_DEFAULT_LIMIT = 50;
export const FEEDBACK_LIST_MAX_LIMIT = 500;

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS coup_feedback (
  id          TEXT PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  kind        TEXT NOT NULL,
  message     TEXT NOT NULL,
  screen      TEXT NOT NULL,
  room_id     TEXT,
  game_id     TEXT,
  app_version TEXT,
  context     JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS coup_feedback_created_at_idx ON coup_feedback (created_at);
`;

const INSERT_SQL = `
INSERT INTO coup_feedback (id, created_at, kind, message, screen, room_id, game_id, app_version, context)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
ON CONFLICT (id) DO NOTHING
`;

const LIST_SQL = `
SELECT id, created_at, kind, message, context
FROM coup_feedback
WHERE ($1::timestamptz IS NULL OR created_at >= $1::timestamptz)
ORDER BY created_at DESC
LIMIT $2
`;

export interface PostgresFeedbackStorageOptions {
  /** Usually process.env.DATABASE_URL. When absent the storage is a no-op. */
  connectionString?: string;
  /** Test seam: use this pool instead of creating a pg.Pool. */
  pool?: PgPoolLike;
}

export interface ListFeedbackOptions {
  limit?: number;
  since?: Date | null;
}

/**
 * Durable feedback notes, one row per note in `coup_feedback` (the database
 * is shared with another app, hence the `coup_` prefix).
 *
 * Active only when DATABASE_URL is configured. `saveFeedback` never throws:
 * a failing database must not reach the socket handler or the game loop
 * (the `[feedback]` log line already holds the note). `listRecent` is for
 * the owner's CLI and does throw, so the script can report the failure.
 */
export class PostgresFeedbackStorage implements FeedbackSink {
  readonly enabled: boolean;
  private pool: PgPoolLike | null;
  private schemaReady: Promise<void> | null = null;
  private pendingWrites = new Set<Promise<void>>();

  constructor(options: PostgresFeedbackStorageOptions = {}) {
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
        application_name: 'coup-online-feedback',
      };
      this.pool = new Pool(config);
    } else {
      this.pool = null;
    }
    this.enabled = this.pool !== null;
    this.pool?.on?.('error', (err) => {
      console.error('[storage] Postgres feedback pool error:', err.message);
    });
  }

  private query(text: string, params?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }> {
    const pool = this.pool;
    if (!pool) return Promise.resolve({ rows: [] });
    if ((pool.waitingCount ?? 0) >= PG_MAX_WAITING) {
      return Promise.reject(new Error('Postgres pool saturated; dropping request'));
    }
    return pool.query(text, params);
  }

  private ensureSchema(): Promise<void> {
    if (!this.pool) return Promise.resolve();
    if (!this.schemaReady) {
      this.schemaReady = this.query(SCHEMA_SQL).then(() => undefined);
      this.schemaReady.catch(() => { this.schemaReady = null; });
    }
    return this.schemaReady;
  }

  saveFeedback(record: FeedbackRecord): Promise<void> {
    if (!this.pool) return Promise.resolve();
    const write = this.writeFeedback(record);
    this.pendingWrites.add(write);
    void write.finally(() => this.pendingWrites.delete(write));
    return write;
  }

  private async writeFeedback(record: FeedbackRecord): Promise<void> {
    try {
      await this.ensureSchema();
      await this.query(INSERT_SQL, [
        record.id,
        new Date(record.createdAt),
        record.kind,
        record.message,
        record.context.screen,
        record.context.room,
        record.context.gameId,
        record.context.appVersion,
        JSON.stringify(record.context),
      ]);
    } catch (err) {
      // Only the id: the note itself is already in the [feedback] log line.
      console.error(`[storage] Failed to save feedback ${record.id}:`, err instanceof Error ? err.message : err);
    }
  }

  /** Newest first. Throws on database errors (CLI use only, never the game loop). */
  async listRecent(options: ListFeedbackOptions = {}): Promise<FeedbackRecord[]> {
    if (!this.pool) return [];
    const limit = clampLimit(options.limit);
    await this.ensureSchema();
    const result = await this.query(LIST_SQL, [options.since ?? null, limit]);
    return result.rows.map(rowToRecord);
  }

  /** Wait (at most `timeoutMs`) for in-flight writes, e.g. before shutdown. */
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

  async close(): Promise<void> {
    try {
      await this.pool?.end?.();
    } catch {
      // ignore
    }
  }
}

function clampLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return FEEDBACK_LIST_DEFAULT_LIMIT;
  return Math.min(FEEDBACK_LIST_MAX_LIMIT, Math.max(1, Math.floor(limit)));
}

function rowToRecord(row: Record<string, unknown>): FeedbackRecord {
  const created = row.created_at;
  const context = (typeof row.context === 'string' ? JSON.parse(row.context) : row.context) as FeedbackContext;
  return {
    id: String(row.id),
    createdAt: created instanceof Date ? created.toISOString() : String(created),
    kind: String(row.kind) as FeedbackKind,
    message: String(row.message),
    context,
  };
}

/** Feedback storage if DATABASE_URL is configured, otherwise null (log line only). */
export function createFeedbackStorage(env: Record<string, string | undefined> = process.env): PostgresFeedbackStorage | null {
  const url = env.DATABASE_URL?.trim();
  if (!url) return null;
  return new PostgresFeedbackStorage({ connectionString: url });
}
