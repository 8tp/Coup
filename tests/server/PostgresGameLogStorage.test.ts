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

  const STATS_ROW = {
    total: 132, last7: 30, last30: 132, solo30: 44, median30: 240000.4,
    by_mode: { Classic: 120, Reformation: 12 },
    by_players: { '4': 80, '2': 52 },
  };

  function statsPool(statsImpl: () => Promise<{ rows: Array<Record<string, unknown>> }>) {
    return fakePool(async (sql: string) => (sql.includes('percentile_cont') ? statsImpl() : { rows: [] }));
  }

  const statsCalls = (query: ReturnType<typeof vi.fn>) =>
    query.mock.calls.filter(call => String(call[0]).includes('percentile_cont')).length;

  it('aggregates PII-free stats in a single statement and caches them for 60s, even across saves', async () => {
    const { pool, query } = statsPool(async () => ({ rows: [STATS_ROW] }));
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
    expect(statsCalls(query)).toBe(1);

    await storage.saveGameLog(sampleLog());
    await storage.getAggregateStats(30_000);
    expect(statsCalls(query)).toBe(1);

    await storage.getAggregateStats(61_001);
    expect(statsCalls(query)).toBe(2);
  });

  it('shares one in-flight stats query between concurrent callers', async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const { pool, query } = statsPool(async () => { await gate; return { rows: [STATS_ROW] }; });
    const storage = new PostgresGameLogStorage({ pool });

    const calls = Array.from({ length: 5 }, () => storage.getAggregateStats(1_000));
    await new Promise(resolve => setTimeout(resolve, 0));
    release();
    const results = await Promise.all(calls);

    expect(statsCalls(query)).toBe(1);
    expect(results.every(r => r?.totalGames === 132)).toBe(true);
  });

  it('caches a stats failure for ~10s instead of hammering a sick database', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { pool, query } = statsPool(async () => { throw new Error('timeout'); });
    const storage = new PostgresGameLogStorage({ pool });

    expect(await storage.getAggregateStats(1_000)).toBeNull();
    expect(await storage.getAggregateStats(5_000)).toBeNull();
    expect(statsCalls(query)).toBe(1);
    await storage.getAggregateStats(11_001);
    expect(statsCalls(query)).toBe(2);
  });

  it('drops work instead of queueing without bound when the pool is saturated', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const query = vi.fn(async () => ({ rows: [] }));
    const pool: PgPoolLike = { query, on: vi.fn(), waitingCount: 50 };
    const storage = new PostgresGameLogStorage({ pool });

    await expect(storage.saveGameLog(sampleLog())).resolves.toBeUndefined();
    await expect(storage.getAggregateStats()).resolves.toBeNull();
    expect(query).not.toHaveBeenCalled();
  });

  it('flush waits for in-flight writes, bounded by a timeout', async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const { pool } = fakePool(async (sql: string) => {
      if (sql.includes('INSERT')) await gate;
      return { rows: [] };
    });
    const storage = new PostgresGameLogStorage({ pool });

    void storage.saveGameLog(sampleLog());
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(storage.pendingWriteCount).toBe(1);

    const started = Date.now();
    await storage.flush(30); // write still blocked: returns after the timeout
    expect(Date.now() - started).toBeGreaterThanOrEqual(25);
    expect(storage.pendingWriteCount).toBe(1);

    release();
    await storage.flush(1_000);
    expect(storage.pendingWriteCount).toBe(0);
  });

  it('stores no player names: seats, "Player N" labels and seat ids only', async () => {
    const { pool, query } = fakePool();
    const storage = new PostgresGameLogStorage({ pool });
    const log = sampleLog({
      players: [
        { id: 'h1-uuid', name: 'Hunter', isBot: false, personality: null, finalCoins: 3, revealedCharacters: [], hiddenCharacters: [], isAlive: true, eliminationOrder: null },
        { id: 'h2-uuid', name: 'Ann', isBot: false, personality: null, finalCoins: 0, revealedCharacters: [], hiddenCharacters: [], isAlive: false, eliminationOrder: 1 },
        { id: 'b1-uuid', name: 'Ann Marie', isBot: true, personality: 'optimal', finalCoins: 0, revealedCharacters: [], hiddenCharacters: [], isAlive: false, eliminationOrder: 2 },
      ],
      playerCount: 3,
      winnerId: 'h1-uuid',
      winnerName: 'Hunter',
      actionLog: [
        { message: 'Hunter steals from Ann Marie.', timestamp: 1, eventType: 'claim_action', character: null, turnNumber: 1, actorId: 'h1-uuid', actorName: 'Hunter', targetId: 'b1-uuid' },
        { message: 'ann challenges Hunter! Hannah watches.', timestamp: 2, eventType: 'challenge', character: null, turnNumber: 1, actorId: 'h2-uuid', actorName: 'Ann' },
      ],
    });

    await storage.saveGameLog(log);
    const insert = query.mock.calls.find(call => String(call[0]).includes('INSERT INTO coup_games'))!;
    const payloadText = (insert[1] as unknown[])[11] as string;
    const payload = JSON.parse(payloadText);

    for (const secret of ['Hunter', 'h1-uuid', 'h2-uuid', 'b1-uuid', 'Ann']) {
      expect(payloadText).not.toContain(secret);
    }
    expect(payload.players.map((p: { id: string; name: string; isBot: boolean }) => [p.id, p.name, p.isBot])).toEqual([
      ['seat-1', 'Player 1', false],
      ['seat-2', 'Player 2', false],
      ['seat-3', 'Player 3', true],
    ]);
    expect(payload.winnerId).toBe('seat-1');
    expect(payload.winnerName).toBe('Player 1');
    expect(payload.actionLog[0]).toMatchObject({
      message: 'Player 1 steals from Player 3.', actorId: 'seat-1', actorName: 'Player 1', targetId: 'seat-3',
    });
    // Whole-name, case-insensitive matches only: "Hannah" is not a player and stays.
    expect(payload.actionLog[1].message).toBe('Player 2 challenges Player 1! Hannah watches.');
    // The caller's log is untouched.
    expect(log.players[0].name).toBe('Hunter');
  });
});
