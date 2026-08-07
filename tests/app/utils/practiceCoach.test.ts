import { describe, expect, it } from 'vitest';
import { ActionType, Character, ClientGameState, GameMode, GameStatus, TurnPhase } from '@/shared/types';
import { getPracticeCoachTip } from '@/app/utils/practiceCoach';

function gameState(overrides: Partial<ClientGameState> = {}): ClientGameState {
  return {
    roomCode: 'TEST',
    status: GameStatus.InProgress,
    players: [
      {
        id: 'me',
        name: 'Player',
        coins: 2,
        influences: [
          { character: Character.Duke, revealed: false },
          { character: Character.Captain, revealed: false },
        ],
        isAlive: true,
        seatIndex: 0,
      },
      {
        id: 'bot',
        name: 'Tutor Bot',
        coins: 2,
        influences: [
          { character: null, revealed: false },
          { character: null, revealed: false },
        ],
        isAlive: true,
        seatIndex: 1,
        isBot: true,
      },
    ],
    currentPlayerIndex: 0,
    turnPhase: TurnPhase.AwaitingAction,
    deckCount: 11,
    treasury: 46,
    pendingAction: null,
    pendingBlock: null,
    challengeState: null,
    influenceLossRequest: null,
    exchangeState: null,
    examineState: null,
    blockPassedPlayerIds: [],
    actionLog: [],
    timerExpiry: null,
    winnerId: null,
    turnNumber: 1,
    myId: 'me',
    gameMode: GameMode.Classic,
    useInquisitor: false,
    treasuryReserve: 0,
    ...overrides,
  };
}

describe('getPracticeCoachTip', () => {
  it('coaches the opening action without prescribing one move', () => {
    const tip = getPracticeCoachTip(gameState());

    expect(tip?.id).toBe('opening-action');
    expect(tip?.body).toContain('Income is guaranteed');
    expect(tip?.body).toContain('claim any role');
  });

  it('explains the risk when an opponent claim can be challenged', () => {
    const tip = getPracticeCoachTip(gameState({
      currentPlayerIndex: 1,
      turnPhase: TurnPhase.AwaitingActionChallenge,
      pendingAction: {
        type: ActionType.Tax,
        actorId: 'bot',
        claimedCharacter: Character.Duke,
      },
      challengeState: {
        challengerId: '',
        challengedPlayerId: 'bot',
        claimedCharacter: Character.Duke,
        passedPlayerIds: ['bot'],
      },
    }));

    expect(tip?.id).toBe('challenge-claim');
    expect(tip?.title).toContain('Tutor Bot');
    expect(tip?.body).toContain('you lose an influence');
  });

  it('explains that blocks are challengeable claims', () => {
    const tip = getPracticeCoachTip(gameState({
      currentPlayerIndex: 1,
      turnPhase: TurnPhase.AwaitingBlock,
      pendingAction: {
        type: ActionType.Steal,
        actorId: 'bot',
        targetId: 'me',
        claimedCharacter: Character.Captain,
      },
    }));

    expect(tip?.id).toBe('make-block');
    expect(tip?.body).toContain('Captain or Ambassador');
    expect(tip?.body).toContain('challenge');
  });

  it('prioritizes influence-loss advice over general turn advice', () => {
    const tip = getPracticeCoachTip(gameState({
      turnPhase: TurnPhase.AwaitingInfluenceLoss,
      influenceLossRequest: { playerId: 'me', reason: 'challenge_lost' },
    }));

    expect(tip?.id).toBe('choose-influence');
  });

  it('highlights an available or mandatory coup', () => {
    const state = gameState();
    state.players[0].coins = 10;

    const tip = getPracticeCoachTip(state);

    expect(tip?.id).toBe('coup-ready');
    expect(tip?.body).toContain('mandatory');
  });

  it('does not coach eliminated players or game-over states', () => {
    const eliminated = gameState();
    eliminated.players[0].isAlive = false;

    expect(getPracticeCoachTip(eliminated)).toBeNull();
    expect(getPracticeCoachTip(gameState({ turnPhase: TurnPhase.GameOver }))).toBeNull();
  });
});
