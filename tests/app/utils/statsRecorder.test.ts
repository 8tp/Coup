import { describe, it, expect } from 'vitest';
import { createEmptyStats, recordGameResult } from '@/app/utils/statsRecorder';
import { ClientGameState, GameMode, TurnPhase, GameStatus, ActionType, Character, LogEntry } from '@/shared/types';
import { StoredPlayerStats } from '@/app/types/stats';

function makeLog(entries: Partial<LogEntry>[]): LogEntry[] {
  return entries.map((e, i) => {
    const entry: LogEntry = {
      message: e.message ?? '',
      timestamp: e.timestamp ?? 1000 + i,
      eventType: e.eventType ?? 'game_start',
      character: e.character ?? null,
      turnNumber: e.turnNumber ?? 1,
      actorId: e.actorId ?? null,
      actorName: e.actorName ?? null,
      targetId: e.targetId ?? null,
    };
    if (e.wasBluff !== undefined) {
      entry.wasBluff = e.wasBluff;
    }
    return entry;
  });
}

function makeGameState(overrides: Partial<ClientGameState> = {}): ClientGameState {
  return {
    roomCode: 'TEST01',
    status: GameStatus.Finished,
    players: [
      { id: 'p1', name: 'Alice', coins: 5, influences: [{ character: Character.Duke, revealed: false }, { character: Character.Captain, revealed: true }], isAlive: true, seatIndex: 0 },
      { id: 'p2', name: 'Bob', coins: 0, influences: [{ character: null, revealed: true }, { character: null, revealed: true }], isAlive: false, seatIndex: 1 },
    ],
    currentPlayerIndex: 0,
    turnPhase: TurnPhase.GameOver,
    deckCount: 10,
    treasury: 40,
    pendingAction: null,
    pendingBlock: null,
    challengeState: null,
    influenceLossRequest: null,
    exchangeState: null,
    examineState: null,
    blockPassedPlayerIds: [],
    actionLog: [],
    timerExpiry: null,
    winnerId: 'p1',
    turnNumber: 5,
    myId: 'p1',
    gameMode: GameMode.Classic,
    useInquisitor: false,
    treasuryReserve: 0,
    ...overrides,
  };
}

describe('createEmptyStats', () => {
  it('creates empty stats with correct structure', () => {
    const stats = createEmptyStats('device-123');
    expect(stats.version).toBe(1);
    expect(stats.deviceId).toBe('device-123');
    expect(stats.lifetime.gamesPlayed).toBe(0);
    expect(stats.lifetime.gamesWon).toBe(0);
    expect(stats.lifetime.currentWinStreak).toBe(0);
    expect(stats.lifetime.bestWinStreak).toBe(0);
    expect(stats.history).toEqual([]);
  });
});

describe('recordGameResult', () => {
  it('records a win correctly', () => {
    const empty = createEmptyStats('dev1');
    const gs = makeGameState({
      actionLog: makeLog([
        { eventType: 'game_start', actorId: null },
        { eventType: 'turn_start', actorId: 'p1', turnNumber: 1 },
        { eventType: 'income', actorId: 'p1', turnNumber: 1 },
        { eventType: 'turn_start', actorId: 'p2', turnNumber: 2 },
        { eventType: 'turn_start', actorId: 'p1', turnNumber: 3 },
        { eventType: 'coup', actorId: 'p1', turnNumber: 3 },
        { eventType: 'win', actorId: 'p1', turnNumber: 5 },
      ]),
    });

    const result = recordGameResult(empty, gs);
    expect(result.lifetime.gamesPlayed).toBe(1);
    expect(result.lifetime.gamesWon).toBe(1);
    expect(result.lifetime.currentWinStreak).toBe(1);
    expect(result.lifetime.bestWinStreak).toBe(1);
    expect(result.history).toHaveLength(1);
    expect(result.history[0].won).toBe(true);
    expect(result.history[0].playerCount).toBe(2);
  });

  it('records a loss correctly', () => {
    const empty = createEmptyStats('dev1');
    const gs = makeGameState({
      winnerId: 'p2',
      myId: 'p1',
      actionLog: makeLog([
        { eventType: 'game_start' },
        { eventType: 'turn_start', actorId: 'p1' },
        { eventType: 'win', actorId: 'p2', turnNumber: 5 },
      ]),
    });

    const result = recordGameResult(empty, gs);
    expect(result.lifetime.gamesPlayed).toBe(1);
    expect(result.lifetime.gamesWon).toBe(0);
    expect(result.lifetime.currentWinStreak).toBe(0);
    expect(result.history[0].won).toBe(false);
  });

  it('tracks win streaks correctly', () => {
    let stats = createEmptyStats('dev1');
    const winGS = (turn: number) => makeGameState({
      turnNumber: turn,
      winnerId: 'p1',
      actionLog: makeLog([
        { eventType: 'game_start', timestamp: turn * 1000 },
        { eventType: 'win', actorId: 'p1', timestamp: turn * 1000 + 1 },
      ]),
    });
    const loseGS = (turn: number) => makeGameState({
      turnNumber: turn,
      winnerId: 'p2',
      actionLog: makeLog([
        { eventType: 'game_start', timestamp: turn * 10000 },
        { eventType: 'win', actorId: 'p2', timestamp: turn * 10000 + 1 },
      ]),
    });

    // Win 3
    stats = recordGameResult(stats, winGS(1));
    stats = recordGameResult(stats, winGS(2));
    stats = recordGameResult(stats, winGS(3));
    expect(stats.lifetime.currentWinStreak).toBe(3);
    expect(stats.lifetime.bestWinStreak).toBe(3);

    // Lose 1
    stats = recordGameResult(stats, loseGS(4));
    expect(stats.lifetime.currentWinStreak).toBe(0);
    expect(stats.lifetime.bestWinStreak).toBe(3);

    // Win 2
    stats = recordGameResult(stats, winGS(5));
    stats = recordGameResult(stats, winGS(6));
    expect(stats.lifetime.currentWinStreak).toBe(2);
    expect(stats.lifetime.bestWinStreak).toBe(3);
  });

  it('counts challenges correctly', () => {
    const empty = createEmptyStats('dev1');
    const gs = makeGameState({
      actionLog: makeLog([
        { eventType: 'game_start' },
        { eventType: 'turn_start', actorId: 'p2' },
        { eventType: 'claim_action', actorId: 'p2', character: Character.Duke },
        { eventType: 'challenge', actorId: 'p1' },
        { eventType: 'challenge_success', actorId: 'p1' },
        { eventType: 'turn_start', actorId: 'p1' },
        { eventType: 'claim_action', actorId: 'p1', character: Character.Captain },
        { eventType: 'challenge', actorId: 'p2' },
        { eventType: 'challenge_fail', actorId: 'p1' },
        { eventType: 'win', actorId: 'p1' },
      ]),
    });

    const result = recordGameResult(empty, gs);
    expect(result.lifetime.challengesMade).toBe(1);
    expect(result.lifetime.challengesWon).toBe(1);
  });

  it('counts blocks correctly', () => {
    const empty = createEmptyStats('dev1');
    const gs = makeGameState({
      actionLog: makeLog([
        { eventType: 'game_start' },
        { eventType: 'turn_start', actorId: 'p2' },
        { eventType: 'declare_action', actorId: 'p2' },
        { eventType: 'block', actorId: 'p1', character: Character.Duke },
        { eventType: 'block', actorId: 'p1', character: Character.Duke },
        { eventType: 'win', actorId: 'p1' },
      ]),
    });

    const result = recordGameResult(empty, gs);
    expect(result.lifetime.blocksMade).toBe(2);
  });

  it('counts action types correctly', () => {
    const empty = createEmptyStats('dev1');
    const gs = makeGameState({
      actionLog: makeLog([
        { eventType: 'game_start' },
        { eventType: 'turn_start', actorId: 'p1' },
        { eventType: 'income', actorId: 'p1' },
        { eventType: 'turn_start', actorId: 'p1' },
        { eventType: 'income', actorId: 'p1' },
        { eventType: 'turn_start', actorId: 'p1' },
        { eventType: 'claim_action', actorId: 'p1', character: Character.Duke },
        { eventType: 'turn_start', actorId: 'p1' },
        { eventType: 'coup', actorId: 'p1' },
        { eventType: 'win', actorId: 'p1' },
      ]),
    });

    const result = recordGameResult(empty, gs);
    expect(result.lifetime.actionCounts[ActionType.Income]).toBe(2);
    expect(result.lifetime.actionCounts[ActionType.Tax]).toBe(1);
    expect(result.lifetime.actionCounts[ActionType.Coup]).toBe(1);
    expect(result.lifetime.totalTurns).toBe(4);
  });

  it('tracks first eliminated', () => {
    const empty = createEmptyStats('dev1');
    const gs = makeGameState({
      winnerId: 'p2',
      myId: 'p1',
      players: [
        { id: 'p1', name: 'Alice', coins: 0, influences: [{ character: null, revealed: true }, { character: null, revealed: true }], isAlive: false, seatIndex: 0 },
        { id: 'p2', name: 'Bob', coins: 5, influences: [{ character: Character.Duke, revealed: false }, { character: Character.Captain, revealed: false }], isAlive: true, seatIndex: 1 },
      ],
      actionLog: makeLog([
        { eventType: 'game_start' },
        { eventType: 'elimination', actorId: 'p1' },
        { eventType: 'win', actorId: 'p2' },
      ]),
    });

    const result = recordGameResult(empty, gs);
    expect(result.lifetime.firstEliminatedCount).toBe(1);
  });

  it('deduplicates same game', () => {
    const empty = createEmptyStats('dev1');
    const gs = makeGameState({
      actionLog: makeLog([
        { eventType: 'game_start', timestamp: 5000 },
        { eventType: 'win', actorId: 'p1', timestamp: 6000 },
      ]),
    });

    const first = recordGameResult(empty, gs);
    const second = recordGameResult(first, gs);
    expect(second.lifetime.gamesPlayed).toBe(1);
    expect(second.history).toHaveLength(1);
  });

  it('caps history at 50', () => {
    let stats = createEmptyStats('dev1');
    for (let i = 0; i < 55; i++) {
      const gs = makeGameState({
        turnNumber: i + 1,
        actionLog: makeLog([
          { eventType: 'game_start', timestamp: i * 100000 },
          { eventType: 'win', actorId: 'p1', timestamp: i * 100000 + 1 },
        ]),
      });
      stats = recordGameResult(stats, gs);
    }
    expect(stats.history).toHaveLength(50);
    expect(stats.lifetime.gamesPlayed).toBe(55);
  });

  it('tracks successful bluffs using wasBluff field', () => {
    const empty = createEmptyStats('dev1');
    const gs = makeGameState({
      actionLog: makeLog([
        { eventType: 'game_start' },
        // p1 bluffs Duke (Tax) 2 times, truthful once, caught once
        { eventType: 'claim_action', actorId: 'p1', character: Character.Duke, wasBluff: true },
        { eventType: 'claim_action', actorId: 'p1', character: Character.Duke, wasBluff: true },
        { eventType: 'claim_action', actorId: 'p1', character: Character.Duke, wasBluff: false },
        { eventType: 'challenge', actorId: 'p2' },
        { eventType: 'challenge_success', actorId: 'p2' },
        { eventType: 'win', actorId: 'p1' },
      ]),
    });

    const result = recordGameResult(empty, gs);
    // actualBluffs = 2, timesCaughtBluffing = 1, so successfulBluffs = 1
    expect(result.lifetime.successfulBluffs).toBe(1);
    expect(result.lifetime.timesCaughtBluffing).toBe(1);
  });

  it('does not count truthful claims as bluffs', () => {
    const empty = createEmptyStats('dev1');
    const gs = makeGameState({
      actionLog: makeLog([
        { eventType: 'game_start' },
        // p1 truthfully claims Duke (Tax) 3 times
        { eventType: 'claim_action', actorId: 'p1', character: Character.Duke, wasBluff: false },
        { eventType: 'claim_action', actorId: 'p1', character: Character.Duke, wasBluff: false },
        { eventType: 'claim_action', actorId: 'p1', character: Character.Duke, wasBluff: false },
        { eventType: 'win', actorId: 'p1' },
      ]),
    });

    const result = recordGameResult(empty, gs);
    // All claims truthful, no bluffs
    expect(result.lifetime.successfulBluffs).toBe(0);
    expect(result.lifetime.timesCaughtBluffing).toBe(0);
  });

  it('ignores non-GameOver state', () => {
    const empty = createEmptyStats('dev1');
    const gs = makeGameState({
      turnPhase: TurnPhase.AwaitingAction,
      actionLog: makeLog([{ eventType: 'game_start' }]),
    });

    const result = recordGameResult(empty, gs);
    expect(result.lifetime.gamesPlayed).toBe(0);
  });

  it('accumulates stats across multiple games', () => {
    let stats = createEmptyStats('dev1');

    const gs1 = makeGameState({
      turnNumber: 5,
      actionLog: makeLog([
        { eventType: 'game_start', timestamp: 1000 },
        { eventType: 'turn_start', actorId: 'p1' },
        { eventType: 'income', actorId: 'p1' },
        { eventType: 'coup', actorId: 'p1' },
        { eventType: 'win', actorId: 'p1', timestamp: 2000 },
      ]),
    });

    const gs2 = makeGameState({
      turnNumber: 8,
      actionLog: makeLog([
        { eventType: 'game_start', timestamp: 3000 },
        { eventType: 'turn_start', actorId: 'p1' },
        { eventType: 'turn_start', actorId: 'p1' },
        { eventType: 'income', actorId: 'p1' },
        { eventType: 'coup', actorId: 'p1' },
        { eventType: 'win', actorId: 'p1', timestamp: 4000 },
      ]),
    });

    stats = recordGameResult(stats, gs1);
    stats = recordGameResult(stats, gs2);

    expect(stats.lifetime.gamesPlayed).toBe(2);
    expect(stats.lifetime.gamesWon).toBe(2);
    expect(stats.lifetime.coupsMade).toBe(2);
    expect(stats.lifetime.totalTurns).toBe(3);
    expect(stats.history).toHaveLength(2);
  });

  it('counts awards earned', () => {
    const empty = createEmptyStats('dev1');
    // Create a game where p1 gets many challenges (The Inquisitor needs >=2)
    const gs = makeGameState({
      turnNumber: 10,
      actionLog: makeLog([
        { eventType: 'game_start' },
        { eventType: 'turn_start', actorId: 'p2' },
        { eventType: 'claim_action', actorId: 'p2', character: Character.Duke },
        { eventType: 'challenge', actorId: 'p1' },
        { eventType: 'challenge_success', actorId: 'p1' },
        { eventType: 'turn_start', actorId: 'p2' },
        { eventType: 'claim_action', actorId: 'p2', character: Character.Captain },
        { eventType: 'challenge', actorId: 'p1' },
        { eventType: 'challenge_success', actorId: 'p1' },
        { eventType: 'turn_start', actorId: 'p2' },
        { eventType: 'claim_action', actorId: 'p2', character: Character.Assassin },
        { eventType: 'challenge', actorId: 'p1' },
        { eventType: 'challenge_success', actorId: 'p1' },
        { eventType: 'win', actorId: 'p1', timestamp: 9999 },
      ]),
    });

    const result = recordGameResult(empty, gs);
    // p1 made 3 challenges, won all 3 → should earn Inquisitor and Eagle Eye
    expect(result.history[0].awardsEarned.length).toBeGreaterThan(0);
    // The award counts should be populated
    const totalAwards = Object.values(result.lifetime.awardCounts).reduce((a, b) => a + b, 0);
    expect(totalAwards).toBeGreaterThan(0);
  });
});
