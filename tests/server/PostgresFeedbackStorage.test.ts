import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createFeedbackStorage,
  FEEDBACK_LIST_DEFAULT_LIMIT,
  FEEDBACK_LIST_MAX_LIMIT,
  PostgresFeedbackStorage,
} from '@/server/storage/PostgresFeedbackStorage';
import { PgPoolLike } from '@/server/storage/PostgresGameLogStorage';
import { FeedbackRecord } from '@/shared/feedbackTypes';
import { GameMode, TurnPhase } from '@/shared/types';

function sampleRecord(overrides: Partial<FeedbackRecord> = {}): FeedbackRecord {
  return {
    id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
    createdAt: '2026-11-16T10:00:00.000Z',
    kind: 'bug',
    message: 'The Contessa block button did nothing',
    context: {
      screen: 'game', viewport: 'phone', browser: 'chrome', os: 'android', textSize: 'normal', standalone: false,
      room: 'a1b2c3d4e5', gameId: 'a1b2c3d4e5-lx2k9', roomState: 'in_game', sender: 'alive', origin: 'quick_play',
      gameMode: GameMode.Classic, useInquisitor: false, turnPhase: TurnPhase.AwaitingBlock, turn: 7, humans: 1, bots: 3,
      appVersion: '9618828',
    },
    ...overrides,
  };
}

function fakePool(impl?: (text: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>) {
  const query = vi.fn(impl ?? (async () => ({ rows: [] })));
  const on = vi.fn();
  const end = vi.fn(async () => {});
  const pool: PgPoolLike = { query, on, end };
  return { pool, query, on, end };
}

describe('PostgresFeedbackStorage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is not created without DATABASE_URL, and is a no-op when constructed without one', async () => {
    expect(createFeedbackStorage({})).toBeNull();
    expect(createFeedbackStorage({ DATABASE_URL: '  ' })).toBeNull();
    const storage = new PostgresFeedbackStorage({});
    expect(storage.enabled).toBe(false);
    await expect(storage.saveFeedback(sampleRecord())).resolves.toBeUndefined();
    await expect(storage.listRecent()).resolves.toEqual([]);
    await expect(storage.close()).resolves.toBeUndefined();
  });

  it('is enabled by the factory when DATABASE_URL is set, without connecting eagerly', async () => {
    const storage = createFeedbackStorage({ DATABASE_URL: 'postgres://user:pass@127.0.0.1:1/none' });
    expect(storage?.enabled).toBe(true);
    await storage?.close();
  });

  it('creates coup_feedback once and inserts one row per note', async () => {
    const { pool, query, on } = fakePool();
    const storage = new PostgresFeedbackStorage({ pool });
    expect(on).toHaveBeenCalledWith('error', expect.any(Function));

    await storage.saveFeedback(sampleRecord());
    await storage.saveFeedback(sampleRecord({ id: 'second' }));

    const statements = query.mock.calls.map(call => String(call[0]));
    const schema = statements.filter(sql => sql.includes('CREATE TABLE IF NOT EXISTS coup_feedback'));
    expect(schema).toHaveLength(1);
    expect(schema[0]).toContain('CREATE INDEX IF NOT EXISTS coup_feedback_created_at_idx');
    const inserts = query.mock.calls.filter(call => String(call[0]).includes('INSERT INTO coup_feedback'));
    expect(inserts).toHaveLength(2);
    expect(String(inserts[0][0])).toContain('ON CONFLICT (id) DO NOTHING');

    const params = inserts[0][1] as unknown[];
    expect(params.slice(0, 8)).toEqual([
      '7c9e6679-7425-40de-944b-e07fc1f90ae7',
      new Date('2026-11-16T10:00:00.000Z'),
      'bug',
      'The Contessa block button did nothing',
      'game',
      'a1b2c3d4e5',
      'a1b2c3d4e5-lx2k9',
      '9618828',
    ]);
    expect(JSON.parse(params[8] as string)).toEqual(sampleRecord().context);
  });

  it('never throws when the database is down, logs only the id, and retries the schema later', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let up = false;
    const { pool, query } = fakePool(async () => {
      if (!up) throw new Error('connect ECONNREFUSED');
      return { rows: [] };
    });
    const storage = new PostgresFeedbackStorage({ pool });

    await expect(storage.saveFeedback(sampleRecord())).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
    const logged = errorSpy.mock.calls.flat().map(String).join(' ');
    expect(logged).toContain('7c9e6679');
    expect(logged).not.toContain('Contessa block button');

    up = true;
    await storage.saveFeedback(sampleRecord());
    expect(query.mock.calls.some(call => String(call[0]).includes('INSERT INTO coup_feedback'))).toBe(true);
  });

  it('drops writes instead of queueing when the pool is saturated', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const query = vi.fn(async () => ({ rows: [] }));
    const storage = new PostgresFeedbackStorage({ pool: { query, on: vi.fn(), waitingCount: 50 } });
    await expect(storage.saveFeedback(sampleRecord())).resolves.toBeUndefined();
    expect(query).not.toHaveBeenCalled();
  });

  it('lists newest first with a clamped limit and optional since', async () => {
    const created = new Date('2026-11-16T10:00:00.000Z');
    const { pool, query } = fakePool(async (sql: string) => (sql.includes('SELECT id')
      ? { rows: [{ id: 'x', created_at: created, kind: 'idea', message: 'More bots', context: sampleRecord().context }] }
      : { rows: [] }));
    const storage = new PostgresFeedbackStorage({ pool });

    const rows = await storage.listRecent();
    expect(rows).toEqual([{ id: 'x', createdAt: '2026-11-16T10:00:00.000Z', kind: 'idea', message: 'More bots', context: sampleRecord().context }]);

    const selects = () => query.mock.calls.filter(call => String(call[0]).includes('SELECT id'));
    expect(String(selects()[0][0])).toContain('ORDER BY created_at DESC');
    expect(selects()[0][1]).toEqual([null, FEEDBACK_LIST_DEFAULT_LIMIT]);

    const since = new Date('2026-11-01T00:00:00Z');
    await storage.listRecent({ limit: 100_000, since });
    expect(selects()[1][1]).toEqual([since, FEEDBACK_LIST_MAX_LIMIT]);
    await storage.listRecent({ limit: 0 });
    expect(selects()[2][1]).toEqual([null, 1]);
  });

  it('listRecent surfaces database errors to the CLI', async () => {
    const { pool } = fakePool(async () => { throw new Error('auth failed'); });
    const storage = new PostgresFeedbackStorage({ pool });
    await expect(storage.listRecent()).rejects.toThrow('auth failed');
  });

  it('flush waits for in-flight writes, bounded by a timeout, and close ends the pool', async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const { pool, end } = fakePool(async (sql: string) => {
      if (sql.includes('INSERT')) await gate;
      return { rows: [] };
    });
    const storage = new PostgresFeedbackStorage({ pool });

    void storage.saveFeedback(sampleRecord());
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(storage.pendingWriteCount).toBe(1);
    await storage.flush(20);
    expect(storage.pendingWriteCount).toBe(1);
    release();
    await storage.flush(1_000);
    expect(storage.pendingWriteCount).toBe(0);
    await storage.close();
    expect(end).toHaveBeenCalledTimes(1);
  });
});
