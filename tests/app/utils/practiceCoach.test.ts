import { describe, expect, it } from 'vitest';
import { ActionType, Character, ClientGameState, Faction, GameMode, GameStatus, TurnPhase } from '@/shared/types';
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
    examineSelectionState: null,
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

const stealOnMe = (overrides: Partial<ClientGameState> = {}) => gameState({
  currentPlayerIndex: 1,
  turnNumber: 3,
  turnPhase: TurnPhase.AwaitingActionChallenge,
  pendingAction: { type: ActionType.Steal, actorId: 'bot', targetId: 'me', claimedCharacter: Character.Captain },
  challengeState: {
    challengerId: '',
    challengedPlayerId: 'bot',
    claimedCharacter: Character.Captain,
    passedPlayerIds: ['bot'],
  },
  ...overrides,
});

describe('getPracticeCoachTip — first-time tips', () => {
  it('explains being targeted the first time, pointing at the claim', () => {
    const tip = getPracticeCoachTip(stealOnMe());

    expect(tip?.id).toBe('first-targeted');
    expect(tip?.anchor).toBe('plaque');
    expect(tip?.title).toContain('Tutor Bot');
    expect(tip?.body).toContain('2 of your coins');
    expect(tip?.body).toContain('Captain or Ambassador');
  });

  it('keeps a first-time tip up for the turn it was first shown', () => {
    const history = new Map([['first-targeted', 3]]);
    expect(getPracticeCoachTip(stealOnMe(), history)?.id).toBe('first-targeted');
  });

  it('never repeats a first-time tip on a later turn', () => {
    const history = new Map([['first-targeted', 3]]);
    expect(getPracticeCoachTip(stealOnMe({ turnNumber: 7 }), history)?.id).toBe('challenge-claim');
  });

  it('falls back to the plain block tip after the first block', () => {
    const blockWindow = gameState({
      currentPlayerIndex: 1,
      turnNumber: 9,
      turnPhase: TurnPhase.AwaitingBlock,
      pendingAction: { type: ActionType.ForeignAid, actorId: 'bot' },
    });
    expect(getPracticeCoachTip(blockWindow)?.id).toBe('first-block');
    const later = getPracticeCoachTip(blockWindow, new Map([['first-block', 2]]));
    expect(later?.id).toBe('make-block');
    expect(later?.body).toContain('Duke');
  });

  it('anchors every response tip to the prompt and every turn tip to the dock', () => {
    const loss = getPracticeCoachTip(gameState({
      turnPhase: TurnPhase.AwaitingInfluenceLoss,
      influenceLossRequest: { playerId: 'me', reason: 'challenge_lost' },
    }));
    expect(loss?.anchor).toBe('prompt');
    expect(getPracticeCoachTip(gameState())?.anchor).toBe('dock');
  });
});

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

    expect(tip?.id).toBe('first-block');
    expect(tip?.once).toBe(true);
    expect(tip?.anchor).toBe('prompt');
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

  it('points out an affordable Coup at 7 coins', () => {
    const state = gameState({ turnNumber: 6 });
    state.players[0].coins = 7;

    const tip = getPracticeCoachTip(state);

    expect(tip?.id).toBe('coup-ready');
    expect(tip?.anchor).toBe('dock');
    expect(tip?.body).toContain('at 10 you have to');
  });

  it('insists on the Coup at 10 coins', () => {
    const state = gameState();
    state.players[0].coins = 10;

    const tip = getPracticeCoachTip(state);

    expect(tip?.id).toBe('must-coup');
    expect(tip?.tone).toBe('danger');
    expect(tip?.title).toContain('must Coup');
  });

  it('explains faction targeting at the start of Reformation practice', () => {
    const state = gameState({ gameMode: GameMode.Reformation });
    state.players[0].faction = Faction.Loyalist;
    state.players[1].faction = Faction.Reformist;

    const tip = getPracticeCoachTip(state);

    expect(tip?.id).toBe('reformation-factions');
    expect(tip?.body).toContain('Challenges ignore factions');
    expect(tip?.body).toContain('Foreign Aid');
  });

  it('explains that an Examine target chooses which card to present', () => {
    const tip = getPracticeCoachTip(gameState({
      gameMode: GameMode.Reformation,
      useInquisitor: true,
      turnPhase: TurnPhase.AwaitingExamineSelection,
      pendingAction: { type: ActionType.Examine, actorId: 'bot', targetId: 'me' },
      examineSelectionState: { examinerId: 'bot', targetId: 'me' },
    }));

    expect(tip?.id).toBe('examine-selection');
    expect(tip?.title).toContain('You choose');
  });

  it('clarifies the inverse Duke claim when the reserve can be embezzled', () => {
    const state = gameState({
      gameMode: GameMode.Reformation,
      treasuryReserve: 4,
      turnNumber: 4,
    });
    state.players[0].faction = Faction.Loyalist;
    state.players[1].faction = Faction.Reformist;

    const tip = getPracticeCoachTip(state);

    expect(tip?.id).toBe('reformation-embezzle');
    expect(tip?.body).toContain('hidden Duke');
    expect(tip?.body).toContain('challenge succeed');
  });

  it('explains the inverse claim when the bot attempts to Embezzle', () => {
    const tip = getPracticeCoachTip(gameState({
      currentPlayerIndex: 1,
      turnPhase: TurnPhase.AwaitingActionChallenge,
      gameMode: GameMode.Reformation,
      pendingAction: {
        type: ActionType.Embezzle,
        actorId: 'bot',
      },
      challengeState: {
        challengerId: '',
        challengedPlayerId: 'bot',
        claimedCharacter: Character.Duke,
        passedPlayerIds: ['bot'],
      },
    }));

    expect(tip?.id).toBe('challenge-claim');
    expect(tip?.body).toContain('does not hold Duke');
    expect(tip?.body).toContain('if none is found');
  });

  it('explains that targeting unlocks when one faction remains', () => {
    const state = gameState({ gameMode: GameMode.Reformation, turnNumber: 4 });
    state.players[0].faction = Faction.Reformist;
    state.players[1].faction = Faction.Reformist;

    expect(getPracticeCoachTip(state)?.id).toBe('reformation-free-for-all');
  });

  it('does not coach eliminated players or game-over states', () => {
    const eliminated = gameState();
    eliminated.players[0].isAlive = false;

    expect(getPracticeCoachTip(eliminated)).toBeNull();
    expect(getPracticeCoachTip(gameState({ turnPhase: TurnPhase.GameOver }))).toBeNull();
  });
});
