import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fx from '@/app/fx';
import { reset as resetClock } from '@/app/anim/clock';
import { __resetHaptics } from '@/app/utils/haptic';
import {
  createFxCueDriver,
  clearFxAnchors,
  emitFxCue,
  fxDeckPoint,
  fxSeatPoint,
  registerFxSeat,
  type FxCueCall,
} from '@/app/hooks/useFxCues';
import {
  ActionType,
  Character,
  GameMode,
  GameStatus,
  TurnPhase,
  type ChallengeRevealEvent,
  type ClientGameState,
  type ClientPlayerState,
} from '@/shared/types';
import { el, installRaf, type RafHarness } from '../anim/fakeDom';

/**
 * The wiring layer, asserted the way tests/app/fx asserts the tuning table:
 * the design rule made executable.
 *
 * There is no jsdom here — the suite runs in vitest's node environment, so
 * there is no React renderer and no DOM to render into. That is why the diff
 * lives in a pure function behind a driver rather than inside the `useEffect`:
 * `createFxCueDriver(sink)` is exactly what the hook drives, with the sink
 * swapped for a recorder. Every rule below is a rule about the CUES, and the
 * cues do not need a canvas to be wrong.
 */

/* ── a table ────────────────────────────────────────────────────────────── */

const ME = 'p-me';
const A = 'p-alice';
const B = 'p-bob';

function player(id: string, name: string, over: Partial<ClientPlayerState> = {}): ClientPlayerState {
  return {
    id,
    name,
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

function state(over: Partial<ClientGameState> = {}): ClientGameState {
  return {
    roomCode: 'ABCDEF',
    status: GameStatus.InProgress,
    players: [player(ME, 'Me'), player(A, 'Alice'), player(B, 'Bob')],
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
    myId: ME,
    gameMode: GameMode.Classic,
    useInquisitor: false,
    treasuryReserve: 0,
    ...over,
  };
}

/** Flip `n` of a player's influences face-up. */
function withRevealed(gs: ClientGameState, id: string, n: number, alive = true): ClientGameState {
  return {
    ...gs,
    players: gs.players.map((p) =>
      p.id === id
        ? {
            ...p,
            isAlive: alive,
            influences: p.influences.map((inf, i) => ({ ...inf, revealed: i < n })),
          }
        : p,
    ),
  };
}

function withCoins(gs: ClientGameState, id: string, coins: number): ClientGameState {
  return { ...gs, players: gs.players.map((p) => (p.id === id ? { ...p, coins } : p)) };
}

/* ── the recorder ───────────────────────────────────────────────────────── */

let calls: FxCueCall[] = [];
const record = (c: FxCueCall): void => {
  calls.push(c);
};

/** `(event, condition)` pairs, which is what the tuning table is indexed by. */
function pairs(): string[] {
  return calls.map((c) => `${c.event}/${c.condition}`);
}

function driver() {
  calls = [];
  return createFxCueDriver(record);
}

/** Feed a run of states through a fresh driver, skipping the first as the hook does. */
function run(...states: (ClientGameState | null)[]): string[] {
  const d = driver();
  for (const s of states) d.push(s, null, null);
  return pairs();
}

beforeEach(() => {
  calls = [];
  clearFxAnchors();
});

/* ── the first-render skip ──────────────────────────────────────────────── */

describe('useFxCues — the first-render skip', () => {
  it('fires nothing on the first state it ever sees', () => {
    // A player rejoining mid-game receives a state that already contains three
    // revealed influences and two dead seats. Every one of those diffs against
    // nothing, and without the skip the rejoin is a firework display.
    const mid = withRevealed(
      withRevealed(state({ turnNumber: 9 }), A, 2, false),
      ME,
      1,
    );
    expect(run(mid)).toEqual([]);
  });

  it('fires nothing for a state re-broadcast with no change', () => {
    // The server re-broadcasts on every socket event, including chat. An
    // identical-content state must be silent, not a repeat of the last beat.
    const gs = state();
    const same = state();
    expect(run(gs, same, same, { ...same })).toEqual([]);
  });
});

/* ── one transition, one pair ───────────────────────────────────────────── */

describe('useFxCues — influence loss', () => {
  it('is `mine` when the card is yours', () => {
    expect(run(state(), withRevealed(state(), ME, 1))).toEqual([
      'card_landed/mine',
      'influence_lost/mine',
    ]);
  });

  it('is `theirs` for a bystander, and never `mine`', () => {
    // Rule 2. A bystander losing a card must not redden your screen.
    const out = run(state(), withRevealed(state(), A, 1));
    expect(out).toEqual(['card_landed/theirs', 'influence_lost/theirs']);
    expect(out.some((p) => p.endsWith('/mine'))).toBe(false);
    expect(out.some((p) => p.endsWith('/against_me'))).toBe(false);
  });

  it('puts the epicentre on the seat that lost it', () => {
    const d = driver();
    d.push(state(), null, null);
    d.push(withRevealed(state(), B, 1), null, null);
    expect(calls.every((c) => c.at === B)).toBe(true);
  });

  it('does not re-fire while the card stays face-up', () => {
    const lost = withRevealed(state(), A, 1);
    expect(run(state(), lost, lost, lost)).toEqual([
      'card_landed/theirs',
      'influence_lost/theirs',
    ]);
  });
});

describe('useFxCues — coup_landed has three conditions', () => {
  const coup = (actorId: string, targetId: string): ClientGameState =>
    state({
      turnPhase: TurnPhase.AwaitingInfluenceLoss,
      pendingAction: { type: ActionType.Coup, actorId, targetId },
    });

  it('is `against_me` when the Coup is aimed at you', () => {
    expect(run(state(), coup(A, ME))).toEqual(['coup_landed/against_me']);
  });

  it('is `mine` when you threw it', () => {
    expect(run(state(), coup(ME, A))).toEqual(['coup_landed/mine']);
  });

  it('is `theirs` across the table', () => {
    expect(run(state(), coup(A, B))).toEqual(['coup_landed/theirs']);
  });

  it('lands on the target, not the actor', () => {
    const d = driver();
    d.push(state(), null, null);
    d.push(coup(A, B), null, null);
    expect(calls[0].at).toBe(B);
  });
});

describe('useFxCues — challenges', () => {
  const reveal = (over: Partial<ChallengeRevealEvent>): ChallengeRevealEvent => ({
    challengerName: 'Alice',
    challengedName: 'Me',
    character: Character.Duke,
    wasGenuine: false,
    ...over,
  });

  /** Names, not ids — see the comment in the diff. `wasGenuine` picks the loser. */
  function challenge(r: ChallengeRevealEvent): string[] {
    const d = driver();
    d.push(state(), null, null);
    d.push(state(), r, null);
    return pairs();
  }

  it('gives you `against_me` when you were caught bluffing', () => {
    // Alice challenged Me and the card was NOT there: Me lost.
    expect(challenge(reveal({ wasGenuine: false }))).toEqual([
      'challenge_won/theirs',
      'challenge_lost/against_me',
    ]);
  });

  it('gives you `mine` on the win when your claim held', () => {
    // Alice challenged Me and the card WAS there: Alice lost.
    expect(challenge(reveal({ wasGenuine: true }))).toEqual([
      'challenge_won/mine',
      'challenge_lost/theirs',
    ]);
  });

  it('is quiet on both sides when neither party is you', () => {
    const out = challenge(reveal({ challengerName: 'Alice', challengedName: 'Bob' }));
    expect(out).toEqual(['challenge_won/theirs', 'challenge_lost/theirs']);
  });

  it('splits the two cues across the winner and the loser seats', () => {
    const d = driver();
    d.push(state(), null, null);
    d.push(state(), reveal({ wasGenuine: true }), null);
    expect(calls.map((c) => c.at)).toEqual([ME, A]);
  });

  it('does not re-fire while the same reveal is still on screen', () => {
    const r = reveal({});
    const d = driver();
    d.push(state(), null, null);
    d.push(state(), r, null);
    const first = pairs().length;
    d.push(state(), r, null);
    expect(pairs().length).toBe(first);
  });
});

describe('useFxCues — assassinate_blocked', () => {
  const blocked = (actorId: string, blockerId: string): ClientGameState =>
    state({
      turnPhase: TurnPhase.AwaitingBlockChallenge,
      pendingAction: { type: ActionType.Assassinate, actorId, targetId: blockerId },
      pendingBlock: { blockerId, claimedCharacter: Character.Contessa },
    });

  it('is `against_me` for the assassin whose knife was stopped', () => {
    expect(run(state(), blocked(ME, A))).toEqual(['assassinate_blocked/against_me']);
  });

  it('is `mine` for the player who put the Contessa down', () => {
    expect(run(state(), blocked(A, ME))).toEqual(['assassinate_blocked/mine']);
  });

  it('is `theirs` between two other players', () => {
    expect(run(state(), blocked(A, B))).toEqual(['assassinate_blocked/theirs']);
  });

  it('does not fire for a block on something that is not an Assassinate', () => {
    const stealBlocked = state({
      pendingAction: { type: ActionType.Steal, actorId: A, targetId: ME },
      pendingBlock: { blockerId: ME, claimedCharacter: Character.Captain },
    });
    expect(run(state(), stealBlocked)).toEqual([]);
  });
});

describe('useFxCues — coins', () => {
  it('floats a signed amount for your own gain', () => {
    const d = driver();
    d.push(state(), null, null);
    d.push(withCoins(state(), ME, 5), null, null);
    expect(pairs()).toEqual(['coins_changed/mine']);
    expect(calls[0].amount).toBe(3);
  });

  it('carries a negative amount for a loss', () => {
    const d = driver();
    d.push(withCoins(state(), ME, 7), null, null);
    d.push(withCoins(state(), ME, 0), null, null);
    expect(calls[0].amount).toBe(-7);
  });

  it('says nothing about an opponent’s coins', () => {
    // `coins_changed / theirs` is an EMPTY row on purpose. Six players taking
    // Income is six floats a turn, which is a scoreboard, not a game — so the
    // cue is not fired at all rather than fired into a row that does nothing.
    expect(run(state(), withCoins(state(), A, 9))).toEqual([]);
  });
});

describe('useFxCues — the rest of the table', () => {
  it('fires player_eliminated once, on the transition out', () => {
    const dead = withRevealed(state(), A, 2, false);
    const out = run(state(), dead, dead);
    expect(out.filter((p) => p.startsWith('player_eliminated'))).toEqual([
      'player_eliminated/theirs',
    ]);
  });

  it('gives your own elimination `mine`', () => {
    const out = run(withRevealed(state(), ME, 1), withRevealed(state(), ME, 2, false));
    expect(out).toContain('player_eliminated/mine');
  });

  it('fires game_over `mine` for the winner and `theirs` for everyone else', () => {
    expect(run(state(), state({ winnerId: ME, turnPhase: TurnPhase.GameOver }))).toEqual([
      'game_over/mine',
    ]);
    expect(run(state(), state({ winnerId: A, turnPhase: TurnPhase.GameOver }))).toEqual([
      'game_over/theirs',
    ]);
  });

  it('fires card_landed when an exchange closes, and only then', () => {
    const exchanging = state({
      turnPhase: TurnPhase.AwaitingExchange,
      pendingAction: { type: ActionType.Exchange, actorId: ME },
    });
    // Opening the exchange is not a landing.
    expect(run(state(), exchanging)).toEqual([]);
    // Closing it is.
    expect(run(exchanging, state({ turnNumber: 2 }))).toEqual(['card_landed/mine']);
  });

  it('fires a bystander card_landed when somebody else finishes exchanging', () => {
    const exchanging = state({
      turnPhase: TurnPhase.AwaitingExchange,
      pendingAction: { type: ActionType.Exchange, actorId: A },
    });
    expect(run(exchanging, state({ turnNumber: 2 }))).toEqual(['card_landed/theirs']);
  });

  it('fires denied when the server refuses something of yours', () => {
    const d = driver();
    d.push(state(), null, null);
    d.push(state(), null, 'You must Coup at 10 coins.');
    expect(pairs()).toEqual(['denied/mine']);
    // Clearing the banner is not a second refusal.
    d.push(state(), null, null);
    expect(pairs()).toEqual(['denied/mine']);
  });
});

/* ── ART-DIRECTION §7 ───────────────────────────────────────────────────── */

describe('useFxCues — reduced motion collapses motion, not information', () => {
  let raf: RafHarness;

  beforeEach(() => {
    resetClock();
    raf = installRaf();
    __resetHaptics();
    fx.reset();
    fx.setReducedMotion(false);
    fx.mount(null, el());
  });

  afterEach(() => {
    fx.reset();
    fx.setReducedMotion(false);
    fx.unmount();
    raf.restore();
    resetClock();
  });

  /** Drive a whole game's worth of beats through the REAL fx and return its log. */
  function play(): string[] {
    const d = createFxCueDriver();
    d.push(state(), null, null);
    d.push(withCoins(state(), ME, 5), null, null);
    d.push(
      state({ turnPhase: TurnPhase.AwaitingInfluenceLoss, pendingAction: { type: ActionType.Coup, actorId: A, targetId: ME } }),
      null,
      null,
    );
    d.push(withRevealed(state(), ME, 1), null, null);
    d.push(withRevealed(state(), A, 2, false), null, null);
    d.push(state({ winnerId: A, turnPhase: TurnPhase.GameOver }), null, null);
    return fx.log().map((r) => `${r.event}/${r.condition}/${r.matched}`);
  }

  it('produces an identical cue log with reduced motion on', () => {
    // A player who asked for less motion must not become the only player at the
    // table with no evidence anything happened. What changes is what the cue
    // RENDERS — never whether it fired.
    const normal = play();
    fx.reset();
    fx.setReducedMotion(true);
    const reduced = play();
    expect(reduced).toEqual(normal);
    expect(normal.length).toBeGreaterThan(5);
  });

  it('still refuses to shake under reduced motion', () => {
    fx.setReducedMotion(true);
    play();
    expect(fx.stats().trauma).toBe(0);
    expect(fx.stats().particles).toBe(0);
  });
});

/* ── laziness ───────────────────────────────────────────────────────────── */

describe('useFxCues — mounting is free', () => {
  it('builds nothing until the first cue', () => {
    const raf = installRaf();
    resetClock();
    fx.reset();
    fx.mount(null, el());
    // A driver that has only ever seen one state has fired nothing, so the
    // canvas, the clock subscription and the particle pool must not exist.
    const d = createFxCueDriver();
    d.push(state(), null, null);
    const s = fx.stats();
    expect(s.mounted).toBe(true);
    expect(s.pumping).toBe(false);
    expect(s.particles).toBe(0);
    expect(s.cues).toBe(0);
    fx.unmount();
    raf.restore();
  });
});

/* ── the two gaps the flight engine closed ──────────────────────────────── */

describe('emitFxCue — position and travel', () => {
  let cue: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    clearFxAnchors();
    cue = vi.spyOn(fx, 'cue').mockReturnValue(true);
  });

  afterEach(() => {
    cue.mockRestore();
  });

  function lastOpts(): Record<string, unknown> {
    return cue.mock.calls[cue.mock.calls.length - 1][1] as Record<string, unknown>;
  }

  it('passes the travel vector through, so a landing spark can be directional', () => {
    // fx/index.ts throws `card_landed / mine`'s fan along the travel and guards
    // on dx² + dy² > 144. Nothing ever passed one until flights owned real
    // geography, so every landing spark in the app rendered as the
    // omnidirectional fallback.
    emitFxCue({ event: 'card_landed', condition: 'mine', at: null, x: 400, y: 300, dx: -220, dy: 90 });
    const o = lastOpts();
    expect(o.dx).toBe(-220);
    expect(o.dy).toBe(90);
    expect((o.dx as number) ** 2 + (o.dy as number) ** 2).toBeGreaterThan(144);
  });

  it('omits dx/dy entirely when the caller has no travel to report', () => {
    // A state diff knows a card arrived but not from where. Inventing a
    // direction there is worse than the omnidirectional fallback it replaced.
    emitFxCue({ event: 'card_landed', condition: 'mine', at: null });
    const o = lastOpts();
    expect('dx' in o).toBe(false);
    expect('dy' in o).toBe(false);
  });

  it('an explicit point wins over the seat lookup', () => {
    const seat = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }), isConnected: true };
    registerFxSeat(ME, seat as unknown as HTMLElement);

    // A challenge reveal lands in the MIDDLE of the table but is still the
    // accused player's card, so both are supplied and the measurement wins.
    emitFxCue({ event: 'card_landed', condition: 'mine', at: ME, x: 640, y: 480 });
    expect(lastOpts()).toMatchObject({ x: 640, y: 480 });

    emitFxCue({ event: 'card_landed', condition: 'mine', at: ME });
    expect(lastOpts()).toMatchObject({ x: 50, y: 50 });
  });

  it('falls back to nothing rather than to (0, 0) when the seat is not on screen', () => {
    // flip.ts's guard: a zero rect treated as a position is a card at the
    // top-left corner of the viewport. fx/ centres on the overlay instead.
    const gone = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }), isConnected: true };
    registerFxSeat(A, gone as unknown as HTMLElement);
    emitFxCue({ event: 'card_landed', condition: 'theirs', at: A });
    const o = lastOpts();
    expect('x' in o).toBe(false);
    expect('y' in o).toBe(false);
  });
});

describe('fxSeatPoint / fxDeckPoint', () => {
  beforeEach(() => {
    clearFxAnchors();
  });

  it('reports a registered seat\'s centre and null for everything else', () => {
    const seat = { getBoundingClientRect: () => ({ left: 100, top: 200, width: 240, height: 120 }), isConnected: true };
    registerFxSeat(A, seat as unknown as HTMLElement);
    expect(fxSeatPoint(A)).toEqual({ x: 220, y: 260 });
    expect(fxSeatPoint(B)).toBeNull();
    expect(fxSeatPoint(null)).toBeNull();
  });

  it('a seat whose box measures nothing is absent, not at the origin', () => {
    const collapsed = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }), isConnected: true };
    registerFxSeat(A, collapsed as unknown as HTMLElement);
    expect(fxSeatPoint(A)).toBeNull();
  });

  it('has no deck to measure with no document — the phone path, and SSR', () => {
    // `.felt-centre` is display:none below 1024px, so the deck is genuinely not
    // an object there and the reveal falls back to `dealIn`'s local geography.
    expect(fxDeckPoint()).toBeNull();
  });
});
