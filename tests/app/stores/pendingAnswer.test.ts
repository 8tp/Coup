import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGameStore } from '@/app/stores/gameStore';
import { activePendingAnswer, decisionWindowKey } from '@/app/utils/pendingAnswer';
import { PENDING_ANSWER_TIMEOUT_MS } from '@/shared/constants';
import {
  ActionType,
  Character,
  GameMode,
  GameStatus,
  TurnPhase,
  type ClientGameState,
} from '@/shared/types';

/**
 * A tapped answer stays pressed until the server replies, so a player 300ms
 * from the server sees the tap land at once and cannot send a second answer
 * into the rate limit. These pin when the hold is released.
 */
function challengeWindow(overrides: Partial<ClientGameState> = {}): ClientGameState {
  return {
    roomCode: 'ABCD',
    status: GameStatus.InProgress,
    players: [
      { id: 'me', name: 'Me', coins: 2, influences: [], isAlive: true, seatIndex: 0 },
      { id: 'bot1', name: 'Bot1', coins: 2, influences: [], isAlive: true, seatIndex: 1 },
      { id: 'bot2', name: 'Bot2', coins: 2, influences: [], isAlive: true, seatIndex: 2 },
    ],
    currentPlayerIndex: 1,
    turnPhase: TurnPhase.AwaitingActionChallenge,
    deckCount: 9,
    treasury: 40,
    pendingAction: { type: ActionType.Tax, actorId: 'bot1', claimedCharacter: Character.Duke },
    pendingBlock: null,
    challengeState: { challengerId: '', challengedPlayerId: 'bot1', claimedCharacter: Character.Duke, passedPlayerIds: ['bot1'] },
    influenceLossRequest: null,
    exchangeState: null,
    examineSelectionState: null,
    examineState: null,
    blockPassedPlayerIds: [],
    actionLog: [],
    timerExpiry: null,
    winnerId: null,
    turnNumber: 4,
    myId: 'me',
    gameMode: GameMode.Classic,
    useInquisitor: false,
    treasuryReserve: 0,
    ...overrides,
  };
}

describe('decisionWindowKey', () => {
  it('ignores passes, which do not change the decision on the table', () => {
    const before = challengeWindow();
    const after = challengeWindow({
      challengeState: { ...before.challengeState!, passedPlayerIds: ['bot1', 'bot2'] },
    });
    expect(decisionWindowKey(after)).toBe(decisionWindowKey(before));
  });

  it('changes when the phase, the turn, the claim or the block changes', () => {
    const base = challengeWindow();
    const key = decisionWindowKey(base);
    expect(decisionWindowKey(challengeWindow({ turnPhase: TurnPhase.AwaitingBlock }))).not.toBe(key);
    expect(decisionWindowKey(challengeWindow({ turnNumber: 5 }))).not.toBe(key);
    expect(decisionWindowKey(challengeWindow({
      pendingAction: { type: ActionType.Steal, actorId: 'bot1', targetId: 'me', claimedCharacter: Character.Captain },
    }))).not.toBe(key);
    expect(decisionWindowKey(challengeWindow({
      turnPhase: TurnPhase.AwaitingBlockChallenge,
      pendingBlock: { blockerId: 'bot2', claimedCharacter: Character.Duke },
    }))).not.toBe(decisionWindowKey(challengeWindow({ turnPhase: TurnPhase.AwaitingBlockChallenge })));
  });
});

describe('gameStore pendingAnswer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useGameStore.getState().setGameState(challengeWindow());
    useGameStore.getState().setPendingAnswer(null);
    useGameStore.getState().setError(null);
  });

  afterEach(() => {
    useGameStore.getState().setPendingAnswer(null);
    useGameStore.getState().setGameState(null);
    vi.useRealTimers();
  });

  const hold = () => {
    const gs = useGameStore.getState().gameState!;
    useGameStore.getState().setPendingAnswer({ window: decisionWindowKey(gs), choice: 'pass' });
  };
  const held = () => activePendingAnswer(useGameStore.getState().pendingAnswer, useGameStore.getState().gameState);

  it('holds the answer while other players pass in the same window', () => {
    hold();
    const gs = useGameStore.getState().gameState!;
    useGameStore.getState().setGameState({
      ...gs,
      challengeState: { ...gs.challengeState!, passedPlayerIds: ['bot1', 'bot2'] },
    });
    expect(held()?.choice).toBe('pass');
  });

  it('releases the answer when the server moves the decision on', () => {
    hold();
    useGameStore.getState().setGameState(challengeWindow({ turnPhase: TurnPhase.AwaitingAction, turnNumber: 5, pendingAction: null, challengeState: null }));
    expect(useGameStore.getState().pendingAnswer).toBeNull();
  });

  it('releases the answer when the server refuses it, so the player can answer again', () => {
    hold();
    useGameStore.getState().setError('Too many requests, please wait');
    expect(useGameStore.getState().pendingAnswer).toBeNull();
  });

  it('releases the answer if no reply ever comes', () => {
    hold();
    vi.advanceTimersByTime(PENDING_ANSWER_TIMEOUT_MS - 1);
    expect(held()?.choice).toBe('pass');
    vi.advanceTimersByTime(1);
    expect(useGameStore.getState().pendingAnswer).toBeNull();
  });

  it('a stale timeout does not release a newer answer', () => {
    hold();
    vi.advanceTimersByTime(PENDING_ANSWER_TIMEOUT_MS - 100);
    useGameStore.getState().setGameState(challengeWindow({ turnPhase: TurnPhase.AwaitingBlock }));
    hold();
    vi.advanceTimersByTime(200);
    expect(held()?.choice).toBe('pass');
  });

  it('is cleared with the room', () => {
    hold();
    useGameStore.getState().clearRoom();
    expect(useGameStore.getState().pendingAnswer).toBeNull();
  });
});
