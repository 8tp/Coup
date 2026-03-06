import { describe, it, expect } from 'vitest';
import { computeBluffSummary } from '@/app/utils/gameStats';
import { ClientGameState, Character, GameMode, GameStatus, TurnPhase } from '@/shared/types';

function createMockClientState(overrides: Partial<ClientGameState> = {}): ClientGameState {
  return {
    roomCode: 'TEST01',
    status: GameStatus.Finished,
    players: [
      { id: 'p1', name: 'Alice', coins: 5, influences: [], isAlive: true, seatIndex: 0 },
      { id: 'p2', name: 'Bob', coins: 3, influences: [], isAlive: false, seatIndex: 1 },
    ],
    currentPlayerIndex: 0,
    turnPhase: TurnPhase.GameOver,
    deckCount: 3,
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

describe('computeBluffSummary', () => {
  it('returns empty array when no claims made', () => {
    const state = createMockClientState({ actionLog: [] });
    expect(computeBluffSummary(state)).toEqual([]);
  });

  it('counts bluffs and honest claims correctly', () => {
    const state = createMockClientState({
      actionLog: [
        { message: 'Alice claims Duke', eventType: 'claim_action', character: Character.Duke, turnNumber: 1, actorId: 'p1', actorName: 'Alice', timestamp: 0, wasBluff: true },
        { message: 'Alice claims Captain', eventType: 'claim_action', character: Character.Captain, turnNumber: 2, actorId: 'p1', actorName: 'Alice', timestamp: 0, wasBluff: false },
        { message: 'Bob claims Assassin', eventType: 'claim_action', character: Character.Assassin, turnNumber: 3, actorId: 'p2', actorName: 'Bob', timestamp: 0, wasBluff: false },
      ],
    });

    const summary = computeBluffSummary(state);

    // Alice: 2 claims, 1 bluff
    const alice = summary.find(e => e.playerName === 'You')!; // myId=p1 -> "You"
    expect(alice.totalClaims).toBe(2);
    expect(alice.bluffs).toBe(1);

    // Bob: 1 claim, 0 bluffs
    const bob = summary.find(e => e.playerName === 'Bob')!;
    expect(bob.totalClaims).toBe(1);
    expect(bob.bluffs).toBe(0);
  });

  it('includes block claims in the count', () => {
    const state = createMockClientState({
      actionLog: [
        { message: 'Alice claims Duke', eventType: 'claim_action', character: Character.Duke, turnNumber: 1, actorId: 'p1', actorName: 'Alice', timestamp: 0, wasBluff: false },
        { message: 'Bob blocks with Contessa', eventType: 'block', character: Character.Contessa, turnNumber: 1, actorId: 'p2', actorName: 'Bob', timestamp: 0, wasBluff: true },
      ],
    });

    const summary = computeBluffSummary(state);
    const bob = summary.find(e => e.playerName === 'Bob')!;
    expect(bob.totalClaims).toBe(1); // block counts as a claim
    expect(bob.bluffs).toBe(1);
  });

  it('sorts by bluff count descending', () => {
    const state = createMockClientState({
      actionLog: [
        { message: 'Alice claims Duke', eventType: 'claim_action', character: Character.Duke, turnNumber: 1, actorId: 'p1', actorName: 'Alice', timestamp: 0, wasBluff: true },
        { message: 'Alice claims Duke', eventType: 'claim_action', character: Character.Duke, turnNumber: 2, actorId: 'p1', actorName: 'Alice', timestamp: 0, wasBluff: true },
        { message: 'Bob claims Duke', eventType: 'claim_action', character: Character.Duke, turnNumber: 3, actorId: 'p2', actorName: 'Bob', timestamp: 0, wasBluff: true },
      ],
    });

    const summary = computeBluffSummary(state);
    expect(summary[0].bluffs).toBeGreaterThanOrEqual(summary[1].bluffs);
  });

  it('computes unchallenged bluffs correctly', () => {
    const state = createMockClientState({
      actionLog: [
        { message: 'Alice claims Duke', eventType: 'claim_action', character: Character.Duke, turnNumber: 1, actorId: 'p1', actorName: 'Alice', timestamp: 0, wasBluff: true },
        { message: 'Bob challenges', eventType: 'challenge', character: null, turnNumber: 1, actorId: 'p2', actorName: 'Bob', timestamp: 0 },
        { message: 'Challenge succeeds', eventType: 'challenge_success', character: Character.Duke, turnNumber: 1, actorId: 'p2', actorName: 'Bob', timestamp: 0 },
        { message: 'Alice claims Duke again', eventType: 'claim_action', character: Character.Duke, turnNumber: 2, actorId: 'p1', actorName: 'Alice', timestamp: 0, wasBluff: true },
      ],
    });

    const summary = computeBluffSummary(state);
    const alice = summary.find(e => e.playerName === 'You')!;
    expect(alice.bluffs).toBe(2);
    expect(alice.caughtBluffing).toBe(1);
    expect(alice.unchallengedBluffs).toBe(1);
  });
});
