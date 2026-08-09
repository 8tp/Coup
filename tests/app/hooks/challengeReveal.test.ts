/**
 * The challenge reveal's sequence, without a browser.
 *
 * The component is React and there is no jsdom here, so what is imported is the
 * PURE half — the gate, the phase list and the two dwells — and the
 * choreography is re-driven against the real flight engine with fake elements
 * and a hand-driven rAF. That is the same shape as `reorder()` in
 * tests/app/anim/verbs.test.ts, which re-drives ExchangeView's FLIP, and it is
 * a deliberate trade: a test that re-states the choreography can go wrong by
 * drifting from the component, but a test that cannot run the choreography at
 * all cannot catch a card being cut off mid-air, which is the exact failure the
 * `setTimeout` ladder this replaced used to produce.
 *
 * The two things asserted about it are the two that were previously untestable:
 * every flight resolves exactly once and only a LANDING cues, and the whole
 * sequence produces the same cue log with motion switched off (§7).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { reset as resetClock } from '@/app/anim/clock';
import {
  MAX_EVENT_MS,
  cancel,
  fly,
  hitstopCount,
  liveCount,
  resetFlights,
  setReducedMotion,
  setRest,
  writeRest,
} from '@/app/anim/flight';
import { DEAL_STAGGER_MS, challengeArrive, dealIn, exchangeSwap, swapSide } from '@/app/anim/verbs';
import fx from '@/app/fx';
import { __resetHaptics } from '@/app/utils/haptic';
import { clearFxAnchors, emitFxCue, type FxCueCall, type Point } from '@/app/hooks/useFxCues';
import {
  PHASE_CEILING_MS,
  REVEAL_HOLD_MS,
  SWAP_HOLD_MS,
  createRevealGate,
  nextRevealPhase,
  type RevealGate,
  revealPhases,
  showsReplacement,
  type RevealPhase,
} from '@/app/components/game/ChallengeRevealOverlay';
import { Character, type ChallengeRevealEvent } from '@/shared/types';
import { FakeElement, installRaf, type RafHarness } from '../anim/fakeDom';

/* ── the gate ────────────────────────────────────────────────────────────── */

describe('createRevealGate — motion finishing and words being read are two waits', () => {
  it('needs both, in either order', () => {
    const a = vi.fn();
    const g1 = createRevealGate(1, a);
    g1.settle();
    expect(a).not.toHaveBeenCalled();
    g1.dwell();
    expect(a).toHaveBeenCalledTimes(1);

    const b = vi.fn();
    const g2 = createRevealGate(1, b);
    g2.dwell();
    expect(b).not.toHaveBeenCalled();
    g2.settle();
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('waits for every flight, not just the first', () => {
    const a = vi.fn();
    const g = createRevealGate(3, a);
    g.dwell();
    g.settle();
    g.settle();
    expect(a).not.toHaveBeenCalled();
    g.settle();
    expect(a).toHaveBeenCalledTimes(1);
  });

  it('fires exactly once however many extra settles arrive', () => {
    const a = vi.fn();
    const g = createRevealGate(1, a);
    g.dwell();
    g.settle();
    g.settle();
    g.dwell();
    expect(a).toHaveBeenCalledTimes(1);
    expect(g.fired()).toBe(true);
  });

  it('a phase with nothing to fly is just its dwell', () => {
    // The spectator / below-1024px path: no seat and no deck, so no flight was
    // ever started and the sequence must still move.
    const a = vi.fn();
    const g = createRevealGate(0, a);
    expect(a).not.toHaveBeenCalled();
    g.dwell();
    expect(a).toHaveBeenCalledTimes(1);
  });

  it('an ABORT advances it exactly like a landing — the overlay cannot wedge', () => {
    // flight.ts guarantees one of `land` or `abort`. A gate that only counted
    // landings would leave a full-screen plate up forever the first time a card
    // was superseded or its node unmounted mid-air.
    const a = vi.fn();
    const g = createRevealGate(2, a);
    g.dwell();
    g.settle(); // land
    g.settle(); // abort
    expect(a).toHaveBeenCalledTimes(1);
  });
});

/* ── the phase list ──────────────────────────────────────────────────────── */

function ev(over: Partial<ChallengeRevealEvent> = {}): ChallengeRevealEvent {
  return {
    challengerName: 'Bob',
    challengedName: 'Alice',
    character: Character.Duke,
    wasGenuine: true,
    ...over,
  };
}

describe('revealPhases — every case the old ladder handled', () => {
  it('a proven claim returns the card and draws a replacement', () => {
    expect(revealPhases(ev())).toEqual(['arrive', 'swap', 'done']);
    expect(showsReplacement(ev())).toBe(true);
  });

  it('a proven claim with no replacement drawn stops after the verdict', () => {
    expect(revealPhases(ev({ replacementDrawn: false }))).toEqual(['arrive', 'done']);
  });

  it('a caught bluff never swaps — there was no card to return', () => {
    expect(revealPhases(ev({ wasGenuine: false }))).toEqual(['arrive', 'done']);
    expect(showsReplacement(ev({ wasGenuine: false }))).toBe(false);
  });

  it("Embezzle's inverted claim is still a proven claim", () => {
    // wasGenuine means "the challenge failed", whichever direction the claim
    // ran, so the reveal sequence does not branch on `inverseClaim` at all.
    const inverse = ev({ inverseClaim: true, revealedCharacters: [Character.Captain, Character.Contessa] });
    expect(revealPhases(inverse)).toEqual(['arrive', 'swap', 'done']);
    expect(revealPhases(ev({ inverseClaim: true, wasGenuine: false }))).toEqual(['arrive', 'done']);
  });

  it('walks the list and stops', () => {
    expect(nextRevealPhase(ev(), 'arrive')).toBe('swap');
    expect(nextRevealPhase(ev(), 'swap')).toBe('done');
    expect(nextRevealPhase(ev(), 'done')).toBe('done');
    expect(nextRevealPhase(ev({ wasGenuine: false }), 'arrive')).toBe('done');
  });

  it('holds for reading time, not for motion time', () => {
    // Both dwells outlast the longest flight either phase can start, which is
    // the property that makes them holds rather than a timeline: they are never
    // what the card is waiting for.
    expect(REVEAL_HOLD_MS).toBeGreaterThan(MAX_EVENT_MS);
    expect(SWAP_HOLD_MS).toBeGreaterThan(0);
  });
});

/* ── the choreography ────────────────────────────────────────────────────── */

let raf: RafHarness;
let cues: FxCueCall[];

beforeEach(() => {
  resetFlights();
  resetClock();
  clearFxAnchors();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  raf = installRaf();
  cues = [];
});

afterEach(() => {
  resetFlights();
  resetClock();
  setReducedMotion(false);
  raf.restore();
  vi.useRealTimers();
});

const SEAT: Point = { x: 1180, y: 210 };
const DECK: Point = { x: 700, y: 400 };

/** A reveal card sitting in the middle of the overlay. */
function card(index: number): FakeElement {
  const e = new FakeElement();
  e.rect = { left: 620 + index * 124, top: 420, width: 112, height: 160 };
  return e;
}

function delta(el: FakeElement, p: Point): { dx: number; dy: number } {
  const r = el.getBoundingClientRect();
  return { dx: p.x - (r.left + r.width / 2), dy: p.y - (r.top + r.height / 2) };
}

function centreOf(el: FakeElement): Point {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

interface Tally {
  lands: number;
  aborts: number;
}

/** The component's `armPhase`, restated: the dwell and the ceiling above it. */
function armPhase(els: FakeElement[], gate: RevealGate, dwellMs: number): () => void {
  const dwell = setTimeout(gate.dwell, dwellMs);
  const ceiling = setTimeout(() => {
    for (const el of els) {
      cancel(el);
      writeRest(el);
    }
    gate.dwell();
  }, dwellMs + PHASE_CEILING_MS);
  return () => {
    clearTimeout(dwell);
    clearTimeout(ceiling);
  };
}

/**
 * ChallengeRevealOverlay's `arrive` layout effect, driven by hand.
 *
 * Kept deliberately literal — the same verb, the same stagger, the same
 * `hit` on index 0 only, the same "cue from `land`, settle from both".
 */
function arrive(
  els: FakeElement[],
  seat: Point | null,
  advance: (p: RevealPhase) => void,
  tally: Tally,
  emit: (c: FxCueCall) => void = c => cues.push(c),
): () => void {
  const gate = createRevealGate(els.length, () => advance('swap'));
  const disarm = armPhase(els, gate, REVEAL_HOLD_MS);

  els.forEach((el, i) => {
    const key = `Alice-${i}`;
    const opts = seat ? challengeArrive({ ...delta(el, seat), key }) : dealIn(key);
    const travelX = -(opts.dx ?? 0);
    const travelY = -(opts.dy ?? 0);
    const started = fly(el, {
      ...opts,
      delay: i * DEAL_STAGGER_MS,
      hit: i === 0 && seat !== null,
      land: () => {
        tally.lands++;
        if (i === 0) {
          emit({
            event: 'card_landed',
            condition: 'theirs',
            at: 'p-alice',
            ...centreOf(el),
            dx: travelX,
            dy: travelY,
          });
        }
        gate.settle();
      },
      abort: () => {
        tally.aborts++;
        gate.settle();
      },
    });
    if (!started) gate.settle();
  });

  return () => {
    disarm();
    for (const el of els) cancel(el);
  };
}

/** The `swap` layout effect: the proof goes back to the deck, a new card comes out. */
function swap(
  faces: FakeElement[],
  backs: FakeElement[],
  deck: Point | null,
  seat: Point | null,
  advance: (p: RevealPhase) => void,
  tally: Tally,
  emit: (c: FxCueCall) => void = c => cues.push(c),
): () => void {
  const outbound = deck ? faces : [];
  const gate = createRevealGate(outbound.length + backs.length, () => advance('done'));
  const disarm = armPhase([...outbound, ...backs], gate, SWAP_HOLD_MS);

  let outSide = 1;

  if (deck) {
    outbound.forEach((el, i) => {
      const toDeck = delta(el, deck);
      setRest(el, toDeck.dx, toDeck.dy);
      const back = { dx: -toDeck.dx, dy: -toDeck.dy };
      if (i === 0) outSide = swapSide(back);
      const started = fly(el, {
        ...exchangeSwap({ ...back, side: outSide, lead: true, key: `return-${i}` }, back),
        land: () => {
          tally.lands++;
          gate.settle();
        },
        abort: () => {
          tally.aborts++;
          gate.settle();
        },
      });
      if (!started) gate.settle();
    });
  }

  backs.forEach((el, i) => {
    const toSeat = seat ? delta(el, seat) : { dx: 0, dy: 0 };
    setRest(el, toSeat.dx, toSeat.dy);
    const dest = seat ?? centreOf(el);
    const launch = deck ? { dx: deck.x - dest.x, dy: deck.y - dest.y } : null;
    const key = `draw-${i}`;
    const opts = launch
      ? exchangeSwap({ ...launch, side: -outSide, lead: false, key }, { ...launch })
      : dealIn(key);
    const started = fly(el, {
      ...opts,
      delay: (opts.delay ?? 0) + i * DEAL_STAGGER_MS,
      land: () => {
        tally.lands++;
        emit({
          event: 'card_landed',
          condition: 'theirs',
          at: 'p-alice',
          x: dest.x,
          y: dest.y,
          dx: -(opts.dx ?? 0),
          dy: -(opts.dy ?? 0),
        });
        gate.settle();
      },
      abort: () => {
        tally.aborts++;
        gate.settle();
      },
    });
    if (!started) gate.settle();
  });

  return () => {
    disarm();
    for (const el of outbound) cancel(el);
    for (const el of backs) cancel(el);
  };
}

describe('the reveal flies out of a seat and back to a deck', () => {
  it('launches every card from the accused seat and lands each exactly once', () => {
    // Embezzle: three cards shown at once, the widest case the overlay has.
    const els = [card(0), card(1), card(2)];
    const tally: Tally = { lands: 0, aborts: 0 };
    const phases: RevealPhase[] = [];
    arrive(els, SEAT, p => phases.push(p), tally);

    // Frame one: every card is AT the seat, not at the middle of the table.
    raf.frame(1);
    for (const el of els) {
      const d = delta(el, SEAT);
      expect(el.num('--fx')).toBeCloseTo(d.dx, 0);
      expect(el.num('--fy')).toBeCloseTo(d.dy, 0);
    }

    raf.run(MAX_EVENT_MS, 8);
    expect(tally.lands).toBe(3);
    expect(tally.aborts).toBe(0);
    expect(liveCount()).toBe(0);
    // …on the middle of the table, which is their rest pose.
    for (const el of els) {
      expect(el.num('--fx')).toBe(0);
      expect(el.num('--fy')).toBe(0);
    }
  });

  it('cues one landing for the gesture, with the travel vector attached', () => {
    const els = [card(0), card(1), card(2)];
    arrive(els, SEAT, () => {}, { lands: 0, aborts: 0 });
    raf.run(MAX_EVENT_MS, 8);

    expect(cues).toHaveLength(1);
    const c = cues[0];
    expect(c.event).toBe('card_landed');
    // The epicentre is where the card stopped, not the seat it left.
    expect(c.x).toBeCloseTo(centreOf(els[0]).x, 6);
    // The travel points from the seat to the middle: leftwards and downwards.
    expect(c.dx).toBeLessThan(0);
    expect(c.dy).toBeGreaterThan(0);
    // fx/index.ts only throws a directional fan above this, and a reveal is
    // always further than 12px — which is the whole gap this closes.
    expect((c.dx ?? 0) ** 2 + (c.dy ?? 0) ** 2).toBeGreaterThan(144);
  });

  it('freezes the table exactly once, however many cards are shown', () => {
    const before = hitstopCount();
    arrive([card(0), card(1), card(2)], SEAT, () => {}, { lands: 0, aborts: 0 });
    raf.run(MAX_EVENT_MS, 8);
    expect(hitstopCount()).toBe(before + 1);
  });

  it('does not advance until BOTH the cards have landed and the verdict has been read', () => {
    const els = [card(0)];
    const phases: RevealPhase[] = [];
    arrive(els, SEAT, p => phases.push(p), { lands: 0, aborts: 0 });

    // Landed, but the sentence has not been read.
    raf.run(MAX_EVENT_MS, 8);
    expect(phases).toEqual([]);
    vi.advanceTimersByTime(REVEAL_HOLD_MS - 1);
    expect(phases).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(phases).toEqual(['swap']);
  });

  it('does not advance on the hold alone while a card is still in the air', () => {
    const els = [card(0)];
    const phases: RevealPhase[] = [];
    arrive(els, SEAT, p => phases.push(p), { lands: 0, aborts: 0 });

    // The hold expires with the card still flying — the old ladder's exact
    // failure, and now it simply waits.
    vi.advanceTimersByTime(REVEAL_HOLD_MS);
    expect(phases).toEqual([]);
    expect(liveCount()).toBe(1);
    raf.run(MAX_EVENT_MS, 8);
    expect(phases).toEqual(['swap']);
  });

  it('sends the proof to the deck and the replacement to the seat', () => {
    const faces = [card(0)];
    const backs = [card(0)];
    swap(faces, backs, DECK, SEAT, () => {}, { lands: 0, aborts: 0 });

    raf.frame(1);
    // The replacement starts at the deck…
    const startX = centreOf(backs[0]).x + backs[0].num('--fx');
    const startY = centreOf(backs[0]).y + backs[0].num('--fy');
    expect(startX).toBeCloseTo(DECK.x, 0);
    expect(startY).toBeCloseTo(DECK.y, 0);

    raf.run(MAX_EVENT_MS + 200, 8);
    // …and finishes at the seat.
    expect(centreOf(backs[0]).x + backs[0].num('--fx')).toBeCloseTo(SEAT.x, 0);
    expect(centreOf(backs[0]).y + backs[0].num('--fy')).toBeCloseTo(SEAT.y, 0);
    // …while the proven card finishes at the deck.
    expect(centreOf(faces[0]).x + faces[0].num('--fx')).toBeCloseTo(DECK.x, 0);
    expect(centreOf(faces[0]).y + faces[0].num('--fy')).toBeCloseTo(DECK.y, 0);
  });

  it('mirrors the two legs, so they pass each other rather than blurring together', () => {
    const faces = [card(0)];
    const backs = [card(0)];
    swap(faces, backs, DECK, SEAT, () => {}, { lands: 0, aborts: 0 });
    // Past the follower's 60ms offset, both are in the air.
    raf.run(200, 8);
    const bowOut = faces[0].num('--tilt');
    const bowIn = backs[0].num('--tilt');
    expect(Math.sign(bowOut)).toBe(-Math.sign(bowIn));
  });
});

/* ── the cue contract ────────────────────────────────────────────────────── */

describe('an aborted reveal is silent', () => {
  it('never cues a landing for a card that did not land', () => {
    const els = [card(0), card(1)];
    const tally: Tally = { lands: 0, aborts: 0 };
    const teardown = arrive(els, SEAT, () => {}, tally);

    raf.run(100, 8);
    // The overlay unmounts mid-beat: a rematch, a disconnect, a second
    // challenge landing on top of this one.
    teardown();

    expect(tally.aborts).toBe(2);
    expect(tally.lands).toBe(0);
    expect(cues).toHaveLength(0);
    expect(liveCount()).toBe(0);

    // And nothing arrives late.
    raf.run(MAX_EVENT_MS, 8);
    expect(cues).toHaveLength(0);
  });

  it('lands and aborts never both happen to one card', () => {
    // Six reveals, half of them interrupted before anything lands. The invariant
    // chudopoly measured 173-against-159 on.
    const tally: Tally = { lands: 0, aborts: 0 };
    let started = 0;
    for (let round = 0; round < 6; round++) {
      const els = [card(0), card(1)];
      started += els.length;
      const teardown = arrive(els, SEAT, () => {}, tally);
      raf.run(round % 2 === 0 ? MAX_EVENT_MS : 60, 10);
      teardown();
    }
    expect(tally.lands + tally.aborts).toBe(started);
    // One cue per COMPLETED reveal, and the interrupted ones contributed none.
    expect(cues).toHaveLength(3);
  });

  it('advances anyway when a card aborts — the plate never sticks', () => {
    const els = [card(0)];
    const phases: RevealPhase[] = [];
    const tally: Tally = { lands: 0, aborts: 0 };
    arrive(els, SEAT, p => phases.push(p), tally);

    raf.run(60, 8);
    cancel(els[0]);
    expect(tally.aborts).toBe(1);
    // The flight half of the gate is satisfied by the abort; the hold is not.
    expect(phases).toEqual([]);
    vi.advanceTimersByTime(REVEAL_HOLD_MS);
    expect(phases).toEqual(['swap']);
    expect(cues).toHaveLength(0);
  });
});

/* ── no geography ────────────────────────────────────────────────────────── */

describe('a seat or a deck that is not on screen', () => {
  it('never flies from (0, 0) when the accused has no registered seat', () => {
    const els = [card(0)];
    arrive(els, null, () => {}, { lands: 0, aborts: 0 });
    raf.frame(1);

    // A spectator, or a seat that unmounted. The card comes from just above its
    // own slot — `dealIn` — and NOT from the corner of the viewport, which is
    // what a zeroed rect would have produced.
    const start = { x: centreOf(els[0]).x + els[0].num('--fx'), y: centreOf(els[0]).y + els[0].num('--fy') };
    expect(start.x).toBeCloseTo(centreOf(els[0]).x, 0);
    expect(start.y).toBeLessThan(centreOf(els[0]).y);
    expect(Math.hypot(start.x, start.y)).toBeGreaterThan(100);

    raf.run(MAX_EVENT_MS, 8);
    expect(els[0].num('--fx')).toBe(0);
    expect(els[0].num('--fy')).toBe(0);
  });

  it('keeps the proof where it is when there is no deck object (below 1024px)', () => {
    const faces = [card(0)];
    const backs = [card(0)];
    const tally: Tally = { lands: 0, aborts: 0 };
    swap(faces, backs, null, SEAT, () => {}, tally);

    raf.run(MAX_EVENT_MS + 200, 8);
    // Only the replacement flew, and it still reached the seat.
    expect(tally.lands).toBe(1);
    // Never written to at all: it did not fly, so it did not move.
    expect(faces[0].style.getPropertyValue('--fx')).toBe('');
    expect(centreOf(backs[0]).x + backs[0].num('--fx')).toBeCloseTo(SEAT.x, 0);
  });

  it('still completes the sequence with no geography at all', () => {
    const phases: RevealPhase[] = [];
    const tally: Tally = { lands: 0, aborts: 0 };
    arrive([card(0)], null, p => phases.push(p), tally);
    raf.run(MAX_EVENT_MS, 8);
    vi.advanceTimersByTime(REVEAL_HOLD_MS);
    expect(phases).toEqual(['swap']);

    swap([card(0)], [card(0)], null, null, p => phases.push(p), tally);
    raf.run(MAX_EVENT_MS + 200, 8);
    vi.advanceTimersByTime(SWAP_HOLD_MS);
    expect(phases).toEqual(['swap', 'done']);
  });
});

/* ── ART-DIRECTION §7 ────────────────────────────────────────────────────── */

describe('reduced motion — the reveal still tells the whole story', () => {
  beforeEach(() => {
    __resetHaptics();
    fx.reset();
    fx.setReducedMotion(false);
    fx.mount(null, new FakeElement());
  });

  afterEach(() => {
    fx.reset();
    fx.setReducedMotion(false);
    fx.unmount();
  });

  /** The whole reveal, cued through the REAL fx layer. */
  function play(): string[] {
    const tally: Tally = { lands: 0, aborts: 0 };
    const faces = [card(0), card(1)];
    arrive(faces, SEAT, () => {}, tally, emitFxCue);
    raf.run(MAX_EVENT_MS, 8);
    vi.advanceTimersByTime(REVEAL_HOLD_MS);

    swap(faces, [card(0), card(1)], DECK, SEAT, () => {}, tally, emitFxCue);
    raf.run(MAX_EVENT_MS + 200, 8);
    vi.advanceTimersByTime(SWAP_HOLD_MS);
    return fx.log().map(r => `${r.event}/${r.condition}/${r.matched}`);
  }

  it('produces an identical cue log with motion switched off', () => {
    const normal = play();
    expect(normal.length).toBeGreaterThan(0);

    resetFlights();
    fx.reset();
    setReducedMotion(true);
    fx.setReducedMotion(true);
    expect(play()).toEqual(normal);
  });

  it('cues in the same tick — nothing informational hangs off the fade', () => {
    setReducedMotion(true);
    const tally: Tally = { lands: 0, aborts: 0 };
    arrive([card(0)], SEAT, () => {}, tally);

    // Not "eventually": before a single frame has been driven.
    expect(raf.elapsedMs()).toBe(0);
    expect(tally.lands).toBe(1);
    expect(cues).toHaveLength(1);
  });

  it('still holds for reading time — the words are not what collapsed', () => {
    setReducedMotion(true);
    const phases: RevealPhase[] = [];
    arrive([card(0)], SEAT, p => phases.push(p), { lands: 0, aborts: 0 });

    expect(phases).toEqual([]);
    vi.advanceTimersByTime(REVEAL_HOLD_MS - 1);
    expect(phases).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(phases).toEqual(['swap']);
  });

  it('keeps the travel vector, so the collapsed cue is still directional', () => {
    setReducedMotion(true);
    arrive([card(0)], SEAT, () => {}, { lands: 0, aborts: 0 });
    const c = cues[0];
    // The card did not visibly travel, but the beat still knows which way it
    // would have — reduced motion removes the ramp, not the information.
    expect((c.dx ?? 0) ** 2 + (c.dy ?? 0) ** 2).toBeGreaterThan(144);
  });
});

/* ── the hidden tab ──────────────────────────────────────────────────────── */

describe('a tab that stops getting frames', () => {
  /**
   * anim/clock.ts is a bare rAF loop and Chrome does not run rAF in a hidden
   * tab, so a flight started just before the player switched tabs never lands
   * and never aborts — it simply stops. Waiting on flight completion therefore
   * has a failure mode the `setTimeout` ladder did not: a full-screen z-40
   * plate that stays up indefinitely. Measured in a real backgrounded tab at
   * 21 seconds, the card parked at `--fx: -184px`.
   */
  it('finishes the phase anyway, with the cards on their marks and no cue', () => {
    const els = [card(0), card(1)];
    const phases: RevealPhase[] = [];
    const tally: Tally = { lands: 0, aborts: 0 };
    arrive(els, SEAT, p => phases.push(p), tally);

    // Not one frame is ever driven — that IS a hidden tab.
    vi.advanceTimersByTime(REVEAL_HOLD_MS);
    expect(phases).toEqual([]);
    expect(liveCount()).toBe(2);

    vi.advanceTimersByTime(PHASE_CEILING_MS);
    expect(phases).toEqual(['swap']);
    expect(liveCount()).toBe(0);
    // Killed, not pretended-landed: no landing cue for motion nobody saw.
    expect(tally.lands).toBe(0);
    expect(tally.aborts).toBe(2);
    expect(cues).toHaveLength(0);
    // …and the cards are on their destinations rather than parked mid-air.
    for (const el of els) {
      expect(el.num('--fx')).toBe(0);
      expect(el.num('--fy')).toBe(0);
    }
    expect(raf.elapsedMs()).toBe(0);
  });

  it('the swap phase has the same floor', () => {
    const faces = [card(0)];
    const backs = [card(0)];
    const phases: RevealPhase[] = [];
    swap(faces, backs, DECK, SEAT, p => phases.push(p), { lands: 0, aborts: 0 });

    vi.advanceTimersByTime(SWAP_HOLD_MS + PHASE_CEILING_MS);
    expect(phases).toEqual(['done']);
    expect(liveCount()).toBe(0);
    // The replacement is snapped onto the seat it was flying to, not left at
    // the deck it launched from.
    expect(centreOf(backs[0]).x + backs[0].num('--fx')).toBeCloseTo(SEAT.x, 0);
  });

  it('never fires when the frames DO arrive — the ceiling is a floor, not a clock', () => {
    const els = [card(0)];
    const phases: RevealPhase[] = [];
    const tally: Tally = { lands: 0, aborts: 0 };
    arrive(els, SEAT, p => phases.push(p), tally);

    raf.run(MAX_EVENT_MS, 8);
    vi.advanceTimersByTime(REVEAL_HOLD_MS + PHASE_CEILING_MS + 500);
    expect(phases).toEqual(['swap']);
    expect(tally.lands).toBe(1);
    expect(tally.aborts).toBe(0);
    expect(cues).toHaveLength(1);
  });

  it('sits comfortably outside the engine\'s own commitment', () => {
    // flight.ts promises no event exceeds MAX_EVENT_MS, so a phase still moving
    // 400ms past that is stopped rather than slow.
    expect(PHASE_CEILING_MS).toBeGreaterThan(MAX_EVENT_MS);
  });
});
