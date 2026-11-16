import { describe, expect, it } from 'vitest';
import { ActionType, Character, ClientGameState, GameMode, GameStatus, TurnPhase } from '@/shared/types';
import { blockHint, canBlockDuringChallenge, visibleBlockCharacters } from '@/app/utils/blockOptions';
import { makePlainTranslator } from '@/app/i18n/runtime';

function claimOnMe(type: ActionType, overrides: Partial<ClientGameState> = {}): ClientGameState {
  return {
    roomCode: 'TEST',
    status: GameStatus.InProgress,
    players: [
      { id: 'me', name: 'Me', coins: 2, influences: [{ character: Character.Captain, revealed: false }, { character: Character.Duke, revealed: false }], isAlive: true, seatIndex: 0 },
      { id: 'bot', name: 'Bot', coins: 3, influences: [{ character: null, revealed: false }, { character: null, revealed: false }], isAlive: true, seatIndex: 1 },
    ],
    currentPlayerIndex: 1,
    turnPhase: TurnPhase.AwaitingActionChallenge,
    deckCount: 11,
    treasury: 45,
    pendingAction: { type, actorId: 'bot', targetId: 'me', claimedCharacter: Character.Captain },
    pendingBlock: null,
    challengeState: { challengerId: '', challengedPlayerId: 'bot', claimedCharacter: Character.Captain, passedPlayerIds: ['bot'] },
    influenceLossRequest: null,
    exchangeState: null,
    examineSelectionState: null,
    examineState: null,
    blockPassedPlayerIds: [],
    actionLog: [],
    timerExpiry: null,
    winnerId: null,
    turnNumber: 3,
    myId: 'me',
    gameMode: GameMode.Classic,
    useInquisitor: false,
    treasuryReserve: 0,
    ...overrides,
  };
}

describe('canBlockDuringChallenge', () => {
  it('offers the block to the target of a Steal or Assassinate while the challenge window is open', () => {
    expect(canBlockDuringChallenge(claimOnMe(ActionType.Steal))).toBe(true);
    expect(canBlockDuringChallenge(claimOnMe(ActionType.Assassinate))).toBe(true);
  });

  it('does not offer it for claims that cannot be blocked, to other players, or once declared', () => {
    expect(canBlockDuringChallenge(claimOnMe(ActionType.Examine))).toBe(false);
    expect(canBlockDuringChallenge(claimOnMe(ActionType.Steal, { myId: 'bot' }))).toBe(false);
    const declared = claimOnMe(ActionType.Steal);
    declared.pendingAction = { ...declared.pendingAction!, declaredBlock: { blockerId: 'me', claimedCharacter: Character.Captain } };
    expect(canBlockDuringChallenge(declared)).toBe(false);
  });

  it('does not offer it outside the challenge window', () => {
    expect(canBlockDuringChallenge(claimOnMe(ActionType.Steal, { turnPhase: TurnPhase.AwaitingBlock }))).toBe(false);
  });
});

describe('block copy', () => {
  it('shows the blocker that is in this deck', () => {
    expect(visibleBlockCharacters(claimOnMe(ActionType.Steal))).toEqual([Character.Captain, Character.Ambassador]);
    expect(visibleBlockCharacters(claimOnMe(ActionType.Steal, { useInquisitor: true }))).toEqual([Character.Captain, Character.Inquisitor]);
  });

  it('names the cards and what blocking saves', () => {
    const t = makePlainTranslator('en');
    expect(blockHint(t, ActionType.Steal, [Character.Captain, Character.Ambassador]))
      .toBe('Block with Captain or Ambassador to keep your coins. You can claim either without holding it.');
    expect(blockHint(t, ActionType.Assassinate, [Character.Contessa]))
      .toBe('Block with Contessa or lose a card. You can claim Contessa without holding one.');
    expect(blockHint(t, ActionType.Steal, [Character.Captain, Character.Inquisitor]))
      .toBe('Block with Captain or Inquisitor to keep your coins. You can claim either without holding it.');
  });

  it('builds the hint from the catalog, so other languages get their own words and list', () => {
    const accented = blockHint(makePlainTranslator('en-XA'), ActionType.Steal, [Character.Captain, Character.Ambassador]);
    expect(accented.startsWith('⟦')).toBe(true);
    expect(accented).not.toContain('Block with');
  });
});
