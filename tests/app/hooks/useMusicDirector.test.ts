import { describe, expect, it } from 'vitest';
import { gameMusicCue } from '@/app/hooks/useMusicDirector';
import { isOpeningDeal } from '@/app/hooks/useSoundEffects';
import { GameMode, GameStatus, TurnPhase } from '@/shared/types';
import type { ClientGameState, ClientPlayerState } from '@/shared/types';

function player(id: string, over: Partial<ClientPlayerState> = {}): ClientPlayerState {
  return {
    id,
    name: id,
    coins: 2,
    influences: [
      { character: null, revealed: false },
      { character: null, revealed: false },
    ],
    isAlive: true,
    seatIndex: 0,
    ...over,
  };
}

const dead = (id: string): ClientPlayerState => player(id, {
  isAlive: false,
  influences: [
    { character: null, revealed: true },
    { character: null, revealed: true },
  ],
});

const wounded = (id: string): ClientPlayerState => player(id, {
  influences: [
    { character: null, revealed: true },
    { character: null, revealed: false },
  ],
});

function state(over: Partial<ClientGameState> = {}): ClientGameState {
  return {
    roomCode: 'ABCDEF',
    status: GameStatus.InProgress,
    players: [player('a'), player('b'), player('c')],
    currentPlayerIndex: 0,
    turnPhase: TurnPhase.AwaitingAction,
    deckCount: 9,
    treasury: 40,
    pendingAction: null,
    pendingBlock: null,
    challengeState: null,
    influenceLossRequest: null,
    exchangeState: null,
    examineState: null,
    examineSelectionState: null,
    blockPassedPlayerIds: [],
    actionLog: [],
    timerExpiry: null,
    winnerId: null,
    turnNumber: 1,
    myId: 'a',
    gameMode: GameMode.Classic,
    useInquisitor: false,
    treasuryReserve: 0,
    ...over,
  };
}

describe('gameMusicCue — which bed the game page asks for', () => {
  it('is nothing before there is a game', () => {
    expect(gameMusicCue(null)).toBeNull();
  });

  it('is the table bed while three or more are alive', () => {
    expect(gameMusicCue(state())).toBe('table');
    expect(gameMusicCue(state({ players: [wounded('a'), wounded('b'), player('c')] }))).toBe('table');
  });

  it('is the endgame bed once only two are left', () => {
    expect(gameMusicCue(state({ players: [player('a'), dead('b'), player('c')] }))).toBe('endgame');
  });

  it('a two-player game starts on the table bed and turns when the first card falls', () => {
    expect(gameMusicCue(state({ players: [player('a'), player('b')] }))).toBe('table');
    expect(gameMusicCue(state({ players: [wounded('a'), player('b')] }))).toBe('endgame');
  });

  it('stops at game over, however it is signalled', () => {
    expect(gameMusicCue(state({ status: GameStatus.Finished }))).toBe('over');
    expect(gameMusicCue(state({ winnerId: 'a' }))).toBe('over');
    expect(gameMusicCue(state({ turnPhase: TurnPhase.GameOver }))).toBe('over');
  });
});

describe('isOpeningDeal — the first state of a new game', () => {
  const start = { timestamp: 0, message: 'Game started!', eventType: 'game_start' as const, turnNumber: 1,
    character: null, actorId: null, actorName: null };

  it('is the opening state: turn 1, awaiting the first action, only the start logged', () => {
    expect(isOpeningDeal(state({ actionLog: [start] }))).toBe(true);
  });

  it('is not a reconnect into a game already under way', () => {
    expect(isOpeningDeal(state({ turnNumber: 2, actionLog: [start] }))).toBe(false);
    expect(isOpeningDeal(state({
      turnPhase: TurnPhase.AwaitingActionChallenge,
      actionLog: [start],
    }))).toBe(false);
    expect(isOpeningDeal(state({
      actionLog: [start, { ...start, eventType: 'income' as const }],
    }))).toBe(false);
  });
});
