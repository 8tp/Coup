/**
 * WHEN §6's VERBS FIRE, AND WHAT THEY AIM AT.
 *
 * `anim/verbs.ts` is the four numbers per verb and is tested against the real
 * engine in tests/app/anim. This file is the other half — the part that decides
 * a Coup just happened, that the thing which moves is the card thrown at the
 * target, and that a seat nobody can see does not get a gesture aimed at it.
 *
 * Everything asserted here is pure: a state diff, two geometry guards and the
 * discard's identity scheme. Node environment, no jsdom, no React — the whole
 * point of extracting these out of the effect is that they can be read without
 * a browser, which is precisely what the previous wave could not do.
 */

import { describe, expect, it } from 'vitest';
import {
  actionFlightPoints,
  createTableMotionDriver,
  discardEntries,
  discardTilt,
  shoveDirection,
  shoveWidthOf,
  tableMotionSnapshot,
  type TableMotion,
} from '@/app/components/game/GameTable';
import { fallDelta } from '@/app/components/game/CardFace';
import { blockCut, challengeShove, SHOVE_FRACTION } from '@/app/anim/verbs';
import {
  ActionType,
  Character,
  GameMode,
  GameStatus,
  TurnPhase,
  type ChallengeRevealEvent,
  type ClientGameState,
  type ClientPlayerState,
  type PendingAction,
  type PendingBlock,
} from '@/shared/types';

/* ── fixtures ────────────────────────────────────────────────────────────── */

function player(id: string, name: string, coins: number, revealed: (Character | null)[] = [null, null]): ClientPlayerState {
  return {
    id,
    name,
    coins,
    influences: revealed.map(c => ({ character: c, revealed: c !== null })),
    isAlive: revealed.some(c => c === null),
    seatIndex: 0,
  };
}

interface StateOpts {
  players?: ClientPlayerState[];
  pendingAction?: PendingAction | null;
  pendingBlock?: PendingBlock | null;
  turnNumber?: number;
}

function state(o: StateOpts = {}): ClientGameState {
  return {
    roomCode: 'ABCDEF',
    status: GameStatus.InProgress,
    players: o.players ?? [player('a', 'Alice', 5), player('b', 'Bob', 3)],
    currentPlayerIndex: 0,
    turnPhase: TurnPhase.AwaitingAction,
    deckCount: 11,
    treasury: 30,
    pendingAction: o.pendingAction ?? null,
    pendingBlock: o.pendingBlock ?? null,
    challengeState: null,
    influenceLossRequest: null,
    exchangeState: null,
    examineState: null,
    examineSelectionState: null,
    blockPassedPlayerIds: [],
    actionLog: [],
    timerExpiry: null,
    winnerId: null,
    turnNumber: o.turnNumber ?? 1,
    myId: 'a',
    gameMode: GameMode.Classic,
    useInquisitor: false,
    treasuryReserve: 0,
  };
}

function reveal(o: Partial<ChallengeRevealEvent> = {}): ChallengeRevealEvent {
  return {
    challengerName: 'Bob',
    challengedName: 'Alice',
    character: Character.Duke,
    wasGenuine: true,
    ...o,
  };
}

/** A driver already past its first-render skip, sitting on an empty table. */
function armed(): ReturnType<typeof createTableMotionDriver> {
  const d = createTableMotionDriver();
  expect(d.push(state(), null)).toEqual([]);
  return d;
}

/* ── the skip ────────────────────────────────────────────────────────────── */

describe('the first state is never re-enacted', () => {
  it('a player joining mid-game does not watch three old turns replay', () => {
    const d = createTableMotionDriver();
    const first = d.push(
      state({ pendingAction: { type: ActionType.Coup, actorId: 'a', targetId: 'b' } }),
      reveal(),
    );
    // A pending Coup and a live reveal in the very first snapshot are HISTORY,
    // not events. Same skip as createFxCueDriver's, for the same reason.
    expect(first).toEqual([]);
  });
});

/* ── the strike row ──────────────────────────────────────────────────────── */

describe('a Coup — declaration is landing', () => {
  const coup = state({ pendingAction: { type: ActionType.Coup, actorId: 'a', targetId: 'b' } });

  it('throws one card, from the actor at the target', () => {
    const d = armed();
    expect(d.push(coup, null)).toEqual<TableMotion[]>([
      { kind: 'coup', fromId: 'a', toId: 'b', key: '1|Coup|a|b' },
    ]);
  });

  it('a re-broadcast of the same pending action is not a second Coup', () => {
    const d = armed();
    expect(d.push(coup, null)).toHaveLength(1);
    expect(d.push(coup, null)).toEqual([]);
    // ...and a fresh Coup next turn is.
    const again = state({
      turnNumber: 2,
      pendingAction: { type: ActionType.Coup, actorId: 'b', targetId: 'a' },
    });
    expect(d.push(again, null)).toEqual<TableMotion[]>([
      { kind: 'coup', fromId: 'b', toId: 'a', key: '2|Coup|b|a' },
    ]);
  });

  it('a targetless action never produces a throw', () => {
    const d = armed();
    expect(d.push(state({ pendingAction: { type: ActionType.Tax, actorId: 'a' } }), null)).toEqual([]);
    expect(d.push(state({ turnNumber: 2, pendingAction: { type: ActionType.ForeignAid, actorId: 'b' } }), null)).toEqual([]);
  });
});

describe('an Assassinate — the knife is shown at declaration', () => {
  it('fires when it is declared, not when it resolves', () => {
    const d = armed();
    const declared = state({ pendingAction: { type: ActionType.Assassinate, actorId: 'a', targetId: 'b' } });
    expect(d.push(declared, null)).toEqual<TableMotion[]>([
      { kind: 'assassinate', fromId: 'a', toId: 'b', key: '1|Assassinate|a|b' },
    ]);
    // It may still be blocked by a Contessa, and the lunge has already said so
    // — nothing further fires when the action leaves the table.
    expect(d.push(state({ turnNumber: 2 }), null)).toEqual([]);
  });
});

/* ── the take-from row ───────────────────────────────────────────────────── */

describe('a Steal — watched, not announced', () => {
  const declared = state({
    players: [player('a', 'Alice', 5), player('b', 'Bob', 3)],
    pendingAction: { type: ActionType.Steal, actorId: 'a', targetId: 'b' },
  });

  it('nothing moves at declaration — a steal that is blocked never happened', () => {
    const d = armed();
    expect(d.push(declared, null)).toEqual([]);
  });

  it('the coins travel from the victim to the thief once the balance actually falls', () => {
    const d = armed();
    d.push(declared, null);
    const resolved = state({
      turnNumber: 2,
      players: [player('a', 'Alice', 7), player('b', 'Bob', 1)],
    });
    expect(d.push(resolved, null)).toEqual<TableMotion[]>([
      // from the VICTIM to the THIEF: what moves is what was taken.
      { kind: 'steal', fromId: 'b', toId: 'a', key: '1|Steal|a|b|took' },
    ]);
  });

  it('a blocked steal is silent — the pending action clears and no coin moves', () => {
    const d = armed();
    d.push(declared, null);
    const blocked = state({
      turnNumber: 2,
      players: [player('a', 'Alice', 5), player('b', 'Bob', 3)],
    });
    expect(d.push(blocked, null)).toEqual([]);
    // and the watch is spent: a later coin change for any other reason does
    // not retroactively become a theft.
    expect(d.push(state({ turnNumber: 3, players: [player('a', 'Alice', 5), player('b', 'Bob', 2)] }), null))
      .toEqual([]);
  });

  it('a steal from a one-coin victim still counts — the balance fell', () => {
    const d = armed();
    d.push(state({
      players: [player('a', 'Alice', 0), player('b', 'Bob', 1)],
      pendingAction: { type: ActionType.Steal, actorId: 'a', targetId: 'b' },
    }), null);
    const out = d.push(state({
      turnNumber: 2,
      players: [player('a', 'Alice', 1), player('b', 'Bob', 0)],
    }), null);
    expect(out.map(m => m.kind)).toEqual(['steal']);
  });

  it('a pending block does not end the watch — the steal may still go through', () => {
    const d = armed();
    d.push(declared, null);
    // The block is declared; the pending ACTION is unchanged, so the watch
    // survives and only the block gesture fires.
    const withBlock = state({
      players: [player('a', 'Alice', 5), player('b', 'Bob', 3)],
      pendingAction: { type: ActionType.Steal, actorId: 'a', targetId: 'b' },
      pendingBlock: { blockerId: 'b', claimedCharacter: Character.Captain },
    });
    expect(d.push(withBlock, null).map(m => m.kind)).toEqual(['block']);
    // The block is then challenged and fails, so the steal lands after all.
    const out = d.push(state({ turnNumber: 2, players: [player('a', 'Alice', 7), player('b', 'Bob', 1)] }), null);
    expect(out.map(m => m.kind)).toEqual(['steal']);
  });
});

/* ── the refuse row ──────────────────────────────────────────────────────── */

describe('a block landing — the blocker shoves the actor', () => {
  it('is aimed at whoever was blocked, from whoever blocked them', () => {
    const d = armed();
    const blocked = state({
      pendingAction: { type: ActionType.ForeignAid, actorId: 'a' },
      pendingBlock: { blockerId: 'b', claimedCharacter: Character.Duke },
    });
    expect(d.push(blocked, null)).toEqual<TableMotion[]>([
      { kind: 'block', fromId: 'b', toId: 'a', key: '1|b|ForeignAid' },
    ]);
    expect(d.push(blocked, null)).toEqual([]);
  });
});

describe('a challenge landing — after the plate comes down', () => {
  const withReveal = (r: ChallengeRevealEvent) => state({ turnNumber: 2 });

  it('does not fire while the reveal overlay owns the screen', () => {
    const d = armed();
    // The plate is up: a seat shoved behind a bg-black/70 scrim is a seat
    // nobody can see move.
    expect(d.push(state(), reveal())).toEqual([]);
  });

  it('shoves the CHALLENGER when the challenge failed', () => {
    const d = armed();
    d.push(state(), reveal({ wasGenuine: true }));
    // wasGenuine = Alice held the card, so Bob (the challenger) lost.
    expect(d.push(withReveal(reveal()), null)).toEqual<TableMotion[]>([
      { kind: 'challenge', fromId: 'a', toId: 'b', key: 'challenge|Bob|Alice|Duke' },
    ]);
  });

  it('shoves the CHALLENGED when they were caught bluffing', () => {
    const d = armed();
    d.push(state(), reveal({ wasGenuine: false }));
    expect(d.push(withReveal(reveal()), null)).toEqual<TableMotion[]>([
      { kind: 'challenge', fromId: 'b', toId: 'a', key: 'challenge|Bob|Alice|Duke' },
    ]);
  });

  it('a name that no longer maps to a seat produces nothing, not a shove at nobody', () => {
    const d = armed();
    d.push(state(), reveal({ challengerName: 'Ghost' }));
    expect(d.push(state({ turnNumber: 2 }), null)).toEqual([]);
  });
});

/* ── the snapshot ────────────────────────────────────────────────────────── */

describe('tableMotionSnapshot', () => {
  it('an absent game is present: false and carries the reveal anyway', () => {
    const s = tableMotionSnapshot(null, reveal());
    expect(s.present).toBe(false);
    expect(s.pendingKey).toBeNull();
    // The reveal lives in the store, not in the game state: a challenge whose
    // plate is still up while the game is being torn down must still be able
    // to transition to "down".
    expect(s.reveal).not.toBeNull();
  });

  it('the pending identity is turn, type, actor and target — nothing else', () => {
    const s = tableMotionSnapshot(
      state({ turnNumber: 4, pendingAction: { type: ActionType.Steal, actorId: 'a', targetId: 'b' } }),
      null,
    );
    expect(s.pendingKey).toBe('4|Steal|a|b');
  });
});

/* ── the geometry guards ─────────────────────────────────────────────────── */

describe('actionFlightPoints — a missing seat is never the origin', () => {
  const at = (id: string) => (id === 'a' ? { x: 100, y: 400 } : id === 'b' ? { x: 500, y: 120 } : null);

  it('a Coup rests on its target and comes from the actor', () => {
    expect(actionFlightPoints('coup', 'a', 'b', at)).toEqual({
      anchor: { x: 500, y: 120 },
      other: { x: 100, y: 400 },
    });
  });

  it('a Steal rests on the thief and comes from the victim', () => {
    // The driver hands it (victim → thief), so the anchor is the destination.
    expect(actionFlightPoints('steal', 'b', 'a', at)).toEqual({
      anchor: { x: 100, y: 400 },
      other: { x: 500, y: 120 },
    });
  });

  it('an Assassinate rests on the ACTOR and lunges at the target', () => {
    expect(actionFlightPoints('assassinate', 'a', 'b', at)).toEqual({
      anchor: { x: 100, y: 400 },
      other: { x: 500, y: 120 },
    });
  });

  it('either end missing means no flight at all — never (0, 0)', () => {
    for (const kind of ['coup', 'steal', 'assassinate'] as const) {
      expect(actionFlightPoints(kind, 'a', 'ghost', at)).toBeNull();
      expect(actionFlightPoints(kind, 'ghost', 'b', at)).toBeNull();
      expect(actionFlightPoints(kind, 'ghost', 'ghost', () => null)).toBeNull();
    }
  });
});

describe('the shove is a fraction of a CARD, aimed away from whoever threw it', () => {
  it('falls back to a seat card\'s width when nothing has measured yet', () => {
    expect(shoveWidthOf(null)).toBe(44);
    // 22% of 44px is under 10px — a recoil, not a seat sliding across the felt.
    expect(SHOVE_FRACTION * shoveWidthOf(null)).toBeLessThan(10);
  });

  it('a seat shoved by 22% of its own 15rem width would be an absurd 53px', () => {
    // The number §6 gives is right; the noun it is applied to is the decision.
    expect(SHOVE_FRACTION * 240).toBeGreaterThan(50);
    expect(SHOVE_FRACTION * 56).toBeLessThan(13);
  });

  it('points directly away from the winner', () => {
    const dir = shoveDirection({ x: 0, y: 0 }, { x: 300, y: 0 });
    expect(dir).toEqual({ dirX: 300, dirY: 0 });
    // `shove()` normalises, so the SIZE is the fraction and only the direction
    // came from the seats. Two seats a long way apart shove no harder.
    const near = challengeShove({ width: 56, ...shoveDirection({ x: 0, y: 0 }, { x: 30, y: 0 }) });
    const far = challengeShove({ width: 56, ...shoveDirection({ x: 0, y: 0 }, { x: 3000, y: 0 }) });
    expect(near.dx).toBeCloseTo(far.dx ?? 0, 10);
    expect(near.dx).toBeCloseTo(SHOVE_FRACTION * 56, 10);
  });

  it('an unmeasurable winner leaves the verb\'s own default — back, not towards the corner', () => {
    expect(shoveDirection(null, { x: 300, y: 0 })).toEqual({});
    expect(shoveDirection({ x: 3, y: 4 }, null)).toEqual({});
    // Two seats at the same point cannot name a direction either.
    expect(shoveDirection({ x: 7, y: 7 }, { x: 7, y: 7 })).toEqual({});
    const fallback = blockCut({ width: 56, ...shoveDirection(null, null) });
    expect(fallback.dx).toBeCloseTo(-SHOVE_FRACTION * 56, 10);
    expect(fallback.dy).toBe(0);
  });
});

describe('fallDelta — the discard has no geography below 1024px', () => {
  const box = { left: 400, top: 300, width: 44, height: 64 };

  it('is the invert: where the card is, minus where it belongs', () => {
    expect(fallDelta(box, { x: 100, y: 200 })).toEqual({ dx: 100 - 422, dy: 200 - 332 });
  });

  it('declines when the seat it fell from is not on screen', () => {
    expect(fallDelta(box, null)).toBeNull();
  });

  it('declines when the card itself measures nothing — `.felt-centre` is display:none', () => {
    // A zero rect is not a position. Subtracting it would leave an absolute
    // viewport coordinate and the card would enter from the corner.
    expect(fallDelta({ left: 0, top: 0, width: 0, height: 0 }, { x: 100, y: 200 })).toBeNull();
  });

  it('declines a fall of no distance rather than spinning in place', () => {
    expect(fallDelta(box, { x: 422, y: 332 })).toBeNull();
  });
});

/* ── the discard's identity ──────────────────────────────────────────────── */

describe('discardEntries — an index was never an identity', () => {
  const lost = (id: string, name: string, cards: (Character | null)[]) => player(id, name, 2, cards);

  it('nothing is fresh on the very first render', () => {
    const entries = discardEntries([lost('a', 'Alice', [Character.Duke, null])], null);
    expect(entries).toHaveLength(1);
    expect(entries[0].fresh).toBe(false);
    expect(entries[0].id).toBe('a:0');
    expect(entries[0].ownerId).toBe('a');
  });

  it('only the card that has just arrived is fresh', () => {
    const seen = new Set(['a:0']);
    const entries = discardEntries(
      [lost('a', 'Alice', [Character.Duke, null]), lost('b', 'Bob', [Character.Captain, null])],
      seen,
    );
    expect(entries.map(e => [e.id, e.fresh])).toEqual([['a:0', false], ['b:0', true]]);
  });

  it('a loss by an EARLY seat inserts in the middle without disturbing what is already down', () => {
    // The pile is derived by walking players in seat order, so Alice's second
    // loss lands before Bob's card in the list. Keyed by position, Bob's card
    // would take on a new index, a new tilt and — worse — Alice's ownership.
    const before = discardEntries(
      [lost('a', 'Alice', [Character.Duke, null]), lost('b', 'Bob', [Character.Captain, null])],
      new Set(['a:0', 'b:0']),
    );
    const after = discardEntries(
      [lost('a', 'Alice', [Character.Duke, Character.Contessa]), lost('b', 'Bob', [Character.Captain, null])],
      new Set(['a:0', 'b:0']),
    );
    expect(after.map(e => e.id)).toEqual(['a:0', 'a:1', 'b:0']);
    // The inserted card is the only fresh one, and it belongs to Alice.
    expect(after.filter(e => e.fresh).map(e => [e.id, e.ownerId])).toEqual([['a:1', 'a']]);
    // Bob's card keeps its identity, its owner and therefore its tilt.
    const bobBefore = before.find(e => e.id === 'b:0')!;
    const bobAfter = after.find(e => e.id === 'b:0')!;
    expect(bobAfter.ownerId).toBe(bobBefore.ownerId);
    expect(discardTilt(bobAfter.id)).toBe(discardTilt(bobBefore.id));
  });

  it('a hidden or unrevealed influence is not in the discard', () => {
    const entries = discardEntries([lost('a', 'Alice', [null, null])], new Set());
    expect(entries).toEqual([]);
  });
});

describe('discardTilt', () => {
  it('is stable per card and drawn from the eight resting angles', () => {
    const angles = new Set<number>();
    for (let i = 0; i < 40; i++) {
      const id = `p${i}:${i % 2}`;
      const t = discardTilt(id);
      expect(discardTilt(id)).toBe(t);
      expect(Math.abs(t)).toBeLessThanOrEqual(5);
      angles.add(t);
    }
    // Not one constant dressed up as a hash.
    expect(angles.size).toBeGreaterThan(3);
  });
});
