import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGameLogStorage, PgPoolLike, PostgresGameLogStorage } from '@/server/storage/PostgresGameLogStorage';
import { GameLog } from '@/shared/gameLogTypes';
import { GameMode } from '@/shared/types';

function sampleLog(overrides: Partial<GameLog> = {}): GameLog {
  return {
    gameId: 'ABCD-lx2k9',
    startedAt: '2026-09-01T10:00:00.000Z',
    endedAt: '2026-09-01T10:04:00.000Z',
    durationMs: 240_000,
    playerCount: 4,
    players: [
      { id: 'h1', name: 'Alice', isBot: false, personality: null, finalCoins: 3, revealedCharacters: [], hiddenCharacters: [], isAlive: true, eliminationOrder: null },
      { id: 'b1', name: 'Bot1', isBot: true, personality: 'random', finalCoins: 0, revealedCharacters: [], hiddenCharacters: [], isAlive: false, eliminationOrder: 1 },
      { id: 'b2', name: 'Bot2', isBot: true, personality: 'random', finalCoins: 0, revealedCharacters: [], hiddenCharacters: [], isAlive: false, eliminationOrder: 2 },
      { id: 'b3', name: 'Bot3', isBot: true, personality: 'random', finalCoins: 0, revealedCharacters: [], hiddenCharacters: [], isAlive: false, eliminationOrder: 3 },
    ],
    winnerId: 'h1',
    winnerName: 'Alice',
    actionLog: [],
    stats: { totalTurns: 21, actionCounts: {}, totalChallenges: 0, successfulChallenges: 0, totalBlocks: 0, totalEliminations: 3 },
    source: 'online',
    gameMode: GameMode.Reformation,
    humansAtStart: 1,
    botsAtStart: 3,
    ...overrides,
  };
}

function fakePool(impl?: (text: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>) {
  const query = vi.fn(impl ?? (async () => ({ rows: [] })));
  const on = vi.fn();
  const pool: PgPoolLike = { query, on };
  return { pool, query, on };
}

describe('PostgresGameLogStorage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('without DATABASE_URL', () => {
    it('is not created by the factory', () => {
      expect(createGameLogStorage({})).toBeNull();
      expect(createGameLogStorage({ DATABASE_URL: '   ' })).toBeNull();
    });

    it('is a harmless no-op when constructed without a connection string', async () => {
      const storage = new PostgresGameLogStorage({});
      expect(storage.enabled).toBe(false);
      await expect(storage.saveGameLog(sampleLog())).resolves.toBeUndefined();
      await expect(storage.getGameLogs()).resolves.toEqual([]);
      await expect(storage.getGameLog('x')).resolves.toBeNull();
      await expect(storage.getAggregateStats()).resolves.toBeNull();
      await expect(storage.close()).resolves.toBeUndefined();
    });
  });

  it('is enabled by the factory when DATABASE_URL is set (without connecting eagerly)', async () => {
    const storage = createGameLogStorage({ DATABASE_URL: 'postgres://user:pass@127.0.0.1:1/none' });
    expect(storage?.enabled).toBe(true);
    await storage?.close();
  });

  it('creates the table once and writes one row per finished game with indexed columns', async () => {
    const { pool, query, on } = fakePool();
    const storage = new PostgresGameLogStorage({ pool });
    expect(on).toHaveBeenCalledWith('error', expect.any(Function));

    await storage.saveGameLog(sampleLog());
    await storage.saveGameLog(sampleLog({ gameId: 'ABCD-second' }));

    const statements = query.mock.calls.map(call => String(call[0]));
    expect(statements.filter(sql => sql.includes('CREATE TABLE IF NOT EXISTS coup_games'))).toHaveLength(1);
    const inserts = query.mock.calls.filter(call => String(call[0]).includes('INSERT INTO coup_games'));
    expect(inserts).toHaveLength(2);

    const params = inserts[0][1] as unknown[];
    expect(params[0]).toBe('ABCD-lx2k9');                        // game_id
    expect(params[1]).toEqual(new Date('2026-09-01T10:04:00.000Z')); // finished_at
    expect(params[3]).toBe('Reformation');                       // game_mode
    expect(params.slice(4, 10)).toEqual([4, 1, 3, 240_000, 21, false]); // player_count, humans, bots, duration_ms, turns, winner_is_bot
    expect(JSON.parse(params[11] as string)).toMatchObject({ gameId: 'ABCD-lx2k9', source: 'online' });
  });

  it('never throws when the database is unavailable, and retries the schema later', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let up = false;
    const { pool, query } = fakePool(async () => {
      if (!up) throw new Error('connect ECONNREFUSED');
      return { rows: [] };
    });
    const storage = new PostgresGameLogStorage({ pool });

    await expect(storage.saveGameLog(sampleLog())).resolves.toBeUndefined();
    await expect(storage.getAggregateStats()).resolves.toBeNull();
    expect(errorSpy).toHaveBeenCalled();

    up = true;
    await storage.saveGameLog(sampleLog());
    expect(query.mock.calls.some(call => String(call[0]).includes('INSERT INTO coup_games'))).toBe(true);
  });

  it('aggregates PII-free stats and caches them briefly', async () => {
    const { pool, query } = fakePool(async (sql: string) => {
      if (sql.includes('percentile_cont')) {
        return { rows: [{ total: 132, last7: 30, last30: 132, solo30: 44, median30: 240000.4 }] };
      }
      if (sql.includes('GROUP BY game_mode')) return { rows: [{ key: 'Classic', n: 120 }, { key: 'Reformation', n: 12 }] };
      if (sql.includes('GROUP BY player_count')) return { rows: [{ key: '4', n: 80 }, { key: '2', n: 52 }] };
      return { rows: [] };
    });
    const storage = new PostgresGameLogStorage({ pool });

    const stats = await storage.getAggregateStats(1_000);
    expect(stats).toEqual({
      totalGames: 132,
      gamesLast7Days: 30,
      gamesLast30Days: 132,
      medianDurationMsLast30Days: 240000,
      soloVsBotsGamesLast30Days: 44,
      byGameModeLast30Days: { Classic: 120, Reformation: 12 },
      byPlayerCountLast30Days: { '4': 80, '2': 52 },
      generatedAt: new Date(1_000).toISOString(),
    });

    const callsAfterFirst = query.mock.calls.length;
    await storage.getAggregateStats(2_000);
    expect(query.mock.calls.length).toBe(callsAfterFirst);
  });
});
