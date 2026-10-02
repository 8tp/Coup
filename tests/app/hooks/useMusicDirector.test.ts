import { describe, expect, it } from 'vitest';
import {
  gameMusicCue,
  MUSIC_MIN_DWELL_MS,
  settleMusicCue,
  type CueHold,
  type GameMusicCue,
} from '@/app/hooks/useMusicDirector';
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

const lastCard = (id: string, over: Partial<ClientPlayerState> = {}): ClientPlayerState => player(id, {
  influences: [
    { character: null, revealed: true },
    { character: null, revealed: false },
  ],
  ...over,
});

describe('gameMusicCue — which state the game page asks for', () => {
  it('is nothing before there is a game', () => {
    expect(gameMusicCue(null)).toBeNull();
  });

  it('is court while three or more are alive, all on two cards, nobody holding a Coup', () => {
    expect(gameMusicCue(state())).toBe('court');
    expect(gameMusicCue(state({ players: [player('a', { coins: 6 }), player('b'), player('c')] }))).toBe('court');
    // The dead do not count towards anything.
    expect(gameMusicCue(state({
      players: [player('a'), player('b'), player('c'), { ...dead('d'), coins: 9 }],
    }))).toBe('court');
  });

  it('is tension when anyone alive is on their last card', () => {
    expect(gameMusicCue(state({ players: [wounded('a'), player('b'), player('c')] }))).toBe('tension');
    expect(gameMusicCue(state({ players: [player('a'), player('b'), lastCard('c')] }))).toBe('tension');
  });

  it('is tension when anyone alive can afford a Coup (≥7 coins)', () => {
    expect(gameMusicCue(state({ players: [player('a'), player('b', { coins: 7 }), player('c')] }))).toBe('tension');
    expect(gameMusicCue(state({ players: [player('a', { coins: 10 }), player('b'), player('c')] }))).toBe('tension');
  });

  it('is duel once exactly two are alive', () => {
    expect(gameMusicCue(state({ players: [player('a'), dead('b'), player('c')] }))).toBe('duel');
    expect(gameMusicCue(state({ players: [lastCard('a'), dead('b'), player('c', { coins: 9 })] }))).toBe('duel');
  });

  it('is duel from the very start of a game that began one-on-one', () => {
    expect(gameMusicCue(state({ players: [player('a'), player('b')] }))).toBe('duel');
    expect(gameMusicCue(state({ players: [wounded('a'), player('b')] }))).toBe('duel');
  });

  it('is sudden death when the last two are both on their last card', () => {
    expect(gameMusicCue(state({ players: [lastCard('a'), lastCard('b')] }))).toBe('sudden_death');
    expect(gameMusicCue(state({ players: [lastCard('a'), dead('b'), lastCard('c')] }))).toBe('sudden_death');
  });

  it('is fallen for a local player who is out while the game goes on', () => {
    expect(gameMusicCue(state({ players: [dead('a'), player('b'), player('c')] }))).toBe('fallen');
    // …whatever the rest of the table is doing.
    expect(gameMusicCue(state({ players: [dead('a'), lastCard('b'), lastCard('c')] }))).toBe('fallen');
  });

  it('gives a spectator the normal ladder — their id never matches a seat', () => {
    const watching = { myId: 'spectator-1' };
    expect(gameMusicCue(state({ ...watching }))).toBe('court');
    expect(gameMusicCue(state({ ...watching, players: [dead('a'), player('b'), player('c')] }))).toBe('duel');
    expect(gameMusicCue(state({ ...watching, players: [dead('a'), lastCard('b'), lastCard('c')] }))).toBe('sudden_death');
  });

  it('stops at game over, however it is signalled — even for the fallen', () => {
    expect(gameMusicCue(state({ status: GameStatus.Finished }))).toBe('over');
    expect(gameMusicCue(state({ winnerId: 'a' }))).toBe('over');
    expect(gameMusicCue(state({ turnPhase: TurnPhase.GameOver }))).toBe('over');
    expect(gameMusicCue(state({ winnerId: 'b', players: [dead('a'), player('b')] }))).toBe('over');
  });
});

describe('settleMusicCue — hysteresis', () => {
  const T0 = 1_000_000;
  const hold = (cue: GameMusicCue, since = T0): CueHold => ({ cue, since });

  it('applies the first cue at once', () => {
    expect(settleMusicCue(null, 'court', T0)).toEqual({ hold: hold('court'), retryAt: null });
    expect(settleMusicCue(null, 'duel', T0).hold.cue).toBe('duel');
  });

  it('holds a change until the current cue has played MUSIC_MIN_DWELL_MS, then re-reads', () => {
    const early = settleMusicCue(hold('court'), 'tension', T0 + 3000);
    expect(early.hold).toEqual(hold('court'));
    expect(early.retryAt).toBe(T0 + MUSIC_MIN_DWELL_MS);
    const ready = settleMusicCue(hold('court'), 'tension', T0 + MUSIC_MIN_DWELL_MS);
    expect(ready).toEqual({ hold: hold('tension', T0 + MUSIC_MIN_DWELL_MS), retryAt: null });
  });

  it('does not flicker when a coin count bounces 6 ↔ 7', () => {
    // A broadcast every second, alternating — the score changes at most once per dwell.
    let h: CueHold | null = null;
    const applied: { cue: GameMusicCue; at: number }[] = [];
    for (let s = 0; s <= 40; s++) {
      const raw: GameMusicCue = s % 2 === 0 ? 'court' : 'tension';
      const next = settleMusicCue(h, raw, T0 + s * 1000);
      if (!h || next.hold.cue !== h.cue) applied.push({ cue: next.hold.cue, at: s });
      h = next.hold;
    }
    for (let i = 1; i < applied.length; i++) {
      expect((applied[i].at - applied[i - 1].at) * 1000).toBeGreaterThanOrEqual(MUSIC_MIN_DWELL_MS);
    }
    expect(applied.length).toBeLessThanOrEqual(1 + Math.floor(40_000 / MUSIC_MIN_DWELL_MS));
  });

  it('never goes back from duel or sudden death to court or tension', () => {
    const later = T0 + 60_000;
    for (const back of ['court', 'tension'] as const) {
      expect(settleMusicCue(hold('duel'), back, later)).toEqual({ hold: hold('duel'), retryAt: null });
      expect(settleMusicCue(hold('sudden_death'), back, later)).toEqual({ hold: hold('sudden_death'), retryAt: null });
    }
    expect(settleMusicCue(hold('sudden_death'), 'duel', later).hold.cue).toBe('sudden_death');
  });

  it('escalates duel → sudden death, and anything → fallen, after the dwell', () => {
    expect(settleMusicCue(hold('duel'), 'sudden_death', T0 + MUSIC_MIN_DWELL_MS).hold.cue).toBe('sudden_death');
    expect(settleMusicCue(hold('tension'), 'fallen', T0 + MUSIC_MIN_DWELL_MS).hold.cue).toBe('fallen');
    expect(settleMusicCue(hold('duel'), 'fallen', T0 + 2000).retryAt).toBe(T0 + MUSIC_MIN_DWELL_MS);
  });

  it('stays fallen until the game is over', () => {
    for (const cue of ['court', 'tension', 'duel', 'sudden_death'] as const) {
      expect(settleMusicCue(hold('fallen'), cue, T0 + 60_000).hold.cue).toBe('fallen');
    }
  });

  it('stops for game over at once, from anywhere, dwell or not', () => {
    for (const cue of ['court', 'tension', 'duel', 'sudden_death', 'fallen'] as const) {
      expect(settleMusicCue(hold(cue), 'over', T0 + 100)).toEqual({ hold: hold('over', T0 + 100), retryAt: null });
    }
  });

  it('a new game after game over starts at once', () => {
    expect(settleMusicCue(hold('over'), 'court', T0 + 100).hold).toEqual(hold('court', T0 + 100));
  });
});

describe('isOpeningDeal — the first state of a new game', () => {
  const start = { timestamp: 0, message: 'Game started.', eventType: 'game_start' as const, turnNumber: 1,
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
