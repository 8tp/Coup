import { describe, expect, it } from 'vitest';
import {
  bluffLine,
  challengeLine,
  eliminationTurns,
  finishLine,
  playersInFinishingOrder,
} from '@/app/components/game/gameover/summary';
import { Character, ClientGameState, GameMode, GameStatus, LogEntry, TurnPhase } from '@/shared/types';

function entry(e: Partial<LogEntry> & Pick<LogEntry, 'eventType' | 'turnNumber'>): LogEntry {
  return { message: '', timestamp: 0, character: null, actorId: null, actorName: null, ...e };
}

function state(actionLog: LogEntry[], overrides: Partial<ClientGameState> = {}): ClientGameState {
  return {
    roomCode: 'TEST',
    status: GameStatus.Finished,
    players: [
      { id: 'a', name: 'Alice', coins: 4, influences: [], isAlive: true, seatIndex: 0 },
      { id: 'b', name: 'Bob', coins: 0, influences: [], isAlive: false, seatIndex: 1 },
      { id: 'c', name: 'Cleo', coins: 2, influences: [], isAlive: false, seatIndex: 2 },
    ],
    currentPlayerIndex: 0,
    turnPhase: TurnPhase.GameOver,
    deckCount: 9,
    treasury: 40,
    pendingAction: null,
    pendingBlock: null,
    challengeState: null,
    influenceLossRequest: null,
    exchangeState: null,
    examineSelectionState: null,
    examineState: null,
    blockPassedPlayerIds: [],
    actionLog,
    timerExpiry: null,
    winnerId: 'a',
    turnNumber: 12,
    myId: 'c',
    gameMode: GameMode.Classic,
    useInquisitor: false,
    treasuryReserve: 0,
    ...overrides,
  };
}

const coupEnding = [
  entry({ eventType: 'elimination', turnNumber: 4, actorId: 'c', actorName: 'Cleo' }),
  entry({ eventType: 'turn_start', turnNumber: 12 }),
  entry({ eventType: 'coup', turnNumber: 12, actorId: 'a', actorName: 'Alice', targetId: 'b' }),
  entry({ eventType: 'influence_loss', turnNumber: 12, actorId: 'b', actorName: 'Bob' }),
  entry({ eventType: 'elimination', turnNumber: 12, actorId: 'b', actorName: 'Bob' }),
  entry({ eventType: 'win', turnNumber: 12, actorId: 'a', actorName: 'Alice' }),
];

describe('game-over summary', () => {
  it('orders hands winner first, then from the last player out to the first', () => {
    expect(playersInFinishingOrder(state(coupEnding)).map(p => p.id)).toEqual(['a', 'b', 'c']);
    expect(eliminationTurns(state(coupEnding))).toEqual(new Map([['c', 4], ['b', 12]]));
  });

  it('names the move that ended the game', () => {
    expect(finishLine(state(coupEnding))).toBe('Alice ended it on turn 12 with a Coup on Bob.');
    expect(finishLine(state(coupEnding, { myId: 'b' }))).toBe('Alice ended it on turn 12 with a Coup on you.');
    expect(finishLine(state(coupEnding, { myId: 'a' }))).toBe('You ended it on turn 12 with a Coup on Bob.');
  });

  it('explains a lost challenge with the card that was there', () => {
    const log = [
      entry({ eventType: 'turn_start', turnNumber: 9 }),
      entry({ eventType: 'claim_action', turnNumber: 9, actorId: 'a', character: Character.Duke }),
      entry({ eventType: 'challenge', turnNumber: 9, actorId: 'b' }),
      entry({ eventType: 'challenge_fail', turnNumber: 9, actorId: 'a', character: Character.Duke }),
      entry({ eventType: 'elimination', turnNumber: 9, actorId: 'b' }),
      entry({ eventType: 'action_resolve', turnNumber: 9, actorId: 'a' }),
    ];
    expect(finishLine(state(log))).toBe('Alice ended it on turn 9: Bob challenged and Alice had the Duke.');
  });

  it('falls back to the last card lost when the cause is not in that turn', () => {
    const log = [
      entry({ eventType: 'turn_start', turnNumber: 3 }),
      entry({ eventType: 'elimination', turnNumber: 3, actorId: 'b' }),
    ];
    expect(finishLine(state(log))).toBe('Bob lost their last card on turn 3.');
    expect(finishLine(state([]))).toBeNull();
  });

  it('counts bluffs and challenges in plain sentences', () => {
    const log = [
      entry({ eventType: 'claim_action', turnNumber: 1, actorId: 'a', wasBluff: true }),
      entry({ eventType: 'claim_action', turnNumber: 2, actorId: 'a', wasBluff: true }),
      entry({ eventType: 'claim_action', turnNumber: 3, actorId: 'b', wasBluff: false }),
      entry({ eventType: 'challenge', turnNumber: 2, actorId: 'b' }),
      entry({ eventType: 'challenge_success', turnNumber: 2, actorId: 'b', targetId: 'a' }),
      entry({ eventType: 'challenge', turnNumber: 3, actorId: 'c' }),
      entry({ eventType: 'challenge_fail', turnNumber: 3, actorId: 'b' }),
    ];
    expect(bluffLine(state(log))).toBe('2 of 3 claims were bluffs. 1 was caught. Alice bluffed the most, twice.');
    expect(challengeLine(state(log))).toBe('Challengers won 1 of 2 challenges.');
    expect(bluffLine(state([]))).toBeNull();
    expect(challengeLine(state([]))).toBeNull();
    expect(bluffLine(state([entry({ eventType: 'claim_action', turnNumber: 1, actorId: 'a', wasBluff: false })])))
      .toBe('The one claim was honest.');
  });
});
