'use client';

/**
 * The challenge reveal — Coup's loudest beat, and the one that used to happen
 * nowhere.
 *
 * It was a `bg-black/70` plate with a card floating in the void, driven by a
 * 1500/2500/3500/3700ms `setTimeout` ladder. Two things were wrong with that
 * and only one of them was the timing.
 *
 * ── IT HAPPENS SOMEWHERE NOW ──────────────────────────────────────────────
 *
 * The card flies OUT OF THE ACCUSED PLAYER'S SEAT and lands in the middle of
 * the table; the replacement comes OFF THE DECK PILE and goes back to that same
 * seat. Neither was possible before the desktop table existed — there was no
 * deck object and no seat geometry to measure. The whole point is that a player
 * who looks up mid-beat can tell whose card it is without reading the sentence
 * underneath it.
 *
 * Positions come from the FX registry (`fxSeatPoint`, `fxDeckPoint`), and both
 * can be null: a spectator has no seat of their own, an eliminated seat can
 * unmount, and `.felt-centre` — the deck included — is `display: none` below
 * 1024px. A null is never coerced to (0, 0). flip.ts's guard spells out why: a
 * zero rect flown from is a card entering from the top-left corner of the
 * viewport, which reads as a layout bug rather than a reveal. Where there is no
 * geography the card uses `dealIn`'s local one — 34px above its slot at 0.86
 * scale — and the beat still reads, just without the address on it.
 *
 * ── THE LADDER IS GONE ────────────────────────────────────────────────────
 *
 * A phase now ends when BOTH its flights have resolved AND its reading dwell
 * has elapsed (`createRevealGate`). Those are different kinds of wait and
 * conflating them is what the ladder did: a hardcoded 1000ms for "card returned
 * to the deck" is a promise about motion that the motion never made, so a
 * slower machine cut the card off mid-air and a faster one left it parked.
 *
 * The dwells that remain are genuinely dwells — reading time, not motion time —
 * and each one says what it is holding for. There are two.
 *
 * ── §7 ────────────────────────────────────────────────────────────────────
 *
 * Under reduced motion every flight collapses to a ≤120ms fade and fires `land`
 * in the same tick, so the gate's flight half is satisfied immediately and the
 * sequence is driven entirely by the two reading dwells. Same phases, same
 * text, same cues, same order — the card simply appears where it was going to
 * land. Motion collapses; information does not.
 */

import { useEffect, useRef, useState } from 'react';
import { MAX_EVENT_MS, cancel as cancelFlight, fly, setRest, writeRest } from '../../anim/flight';
import { useIsomorphicLayoutEffect } from '../../anim/useFlight';
import {
  DEAL_STAGGER_MS,
  FLIGHT_TRANSFORM_STYLE,
  challengeArrive,
  dealIn,
  exchangeSwap,
  swapSide,
} from '../../anim/verbs';
import { emitFxCue, fxDeckPoint, fxSeatPoint, type Point } from '../../hooks/useFxCues';
import { useGameStore } from '../../stores/gameStore';
import { characterCardVars } from '../../utils/characterPalette';
import { BluffGlyph } from '../icons';
import { CardArtwork, CardBackArtwork, CharacterCardBadge } from './CardArtwork';
import type { ChallengeRevealEvent } from '@/shared/types';

/* ── the sequence ─────────────────────────────────────────────────────────
   Pure, exported, and tested in tests/app/hooks — none of it needs a DOM. */

export type RevealPhase = 'arrive' | 'swap' | 'done';

/**
 * How long the verdict stays up after the card has landed.
 *
 * A HOLD, NOT A TIMELINE. Three lines have to be read: who revealed what,
 * whether the challenge failed, and which player is now losing an influence.
 * 1500ms is the first rung of the ladder this replaced, kept because that
 * number was tuned against real reading and nothing about the motion rework
 * makes the sentence shorter.
 */
export const REVEAL_HOLD_MS = 1500;

/**
 * And how long the swap's one line stays up: "returned to the deck, a new one
 * drawn". One short line, and the two cards are visibly doing it, so it is a
 * fraction of the verdict's hold. The ladder spent 2000ms saying this across
 * two separate screens.
 */
export const SWAP_HOLD_MS = 900;

/** A proven card is only shuffled back and replaced when the challenge failed. */
export function showsReplacement(ev: ChallengeRevealEvent): boolean {
  return ev.wasGenuine && ev.replacementDrawn !== false;
}

/** Which phases this reveal will actually visit, in order. */
export function revealPhases(ev: ChallengeRevealEvent): RevealPhase[] {
  return showsReplacement(ev) ? ['arrive', 'swap', 'done'] : ['arrive', 'done'];
}

/** The phase after `phase`, or `'done'`. */
export function nextRevealPhase(ev: ChallengeRevealEvent, phase: RevealPhase): RevealPhase {
  const order = revealPhases(ev);
  return order[order.indexOf(phase) + 1] ?? 'done';
}

export interface RevealGate {
  /** One flight resolved. `land` or `abort` — the gate does not care which. */
  settle(): void;
  /** The reading dwell elapsed. */
  dwell(): void;
  /** Whether `advance` has already run. */
  fired(): boolean;
}

/**
 * A phase ends when the motion is finished AND the words have been up long
 * enough. Two independent conditions, whichever finishes last.
 *
 * `settle()` does not care whether the flight LANDED or ABORTED, and that is
 * the load-bearing part. flight.ts guarantees every started flight resolves
 * exactly one of those two ways; a gate that only counted landings would wedge
 * the overlay on screen forever the first time a card was superseded or its
 * node unmounted mid-air. The CUE is what distinguishes them — that hangs off
 * `land` alone, so an aborted flight advances the sequence silently and never
 * sparks. `advance` runs at most once however the counts arrive.
 */
export function createRevealGate(flights: number, advance: () => void): RevealGate {
  let outstanding = Math.max(0, flights);
  let holding = true;
  let done = false;

  const check = (): void => {
    if (done || holding || outstanding > 0) return;
    done = true;
    advance();
  };

  return {
    settle(): void {
      if (outstanding > 0) outstanding--;
      check();
    },
    dwell(): void {
      holding = false;
      check();
    },
    fired(): boolean {
      return done;
    },
  };
}

/**
 * How long after its dwell a phase will wait for motion that is never coming,
 * before snapping the cards home and moving on regardless.
 *
 * FOUND IN A BROWSER, NOT IN REVIEW, AND IT IS THE ONE THING THE `setTimeout`
 * LADDER DID BETTER. anim/clock.ts is a bare `requestAnimationFrame` loop with
 * no visibility handling, and Chrome does not run rAF in a hidden tab — so a
 * player who switches tabs mid-reveal freezes every flight, `land` never fires,
 * and a gate that waits on flights waits forever behind a full-screen `z-40`
 * plate. Timers do NOT stop when a tab is hidden (they are rate-limited to
 * ~1/s, which is far inside these dwells), so the ladder simply ran to
 * completion off screen. Measured: 21 seconds of a stuck overlay in a
 * backgrounded tab, the card parked at `--fx: -184px` the entire time.
 *
 * So the flights are still what the sequence WAITS on; this is only what stops
 * it waiting on a promise the browser has decided not to keep. `MAX_EVENT_MS`
 * is flight.ts's own commitment — no flight this file starts may exceed it — so
 * a phase that has not finished moving 400ms past that is not slow, it is
 * stopped.
 */
export const PHASE_CEILING_MS = MAX_EVENT_MS + 400;

/* ── geometry ─────────────────────────────────────────────────────────────
   One `getBoundingClientRect` per card per phase — a few times a challenge,
   which is a beat. The rAF loop never measures anything. */

interface Delta {
  dx: number;
  dy: number;
}

/** The vector from where this element currently is to `p`. */
function deltaTo(el: HTMLElement, p: Point): Delta {
  const r = el.getBoundingClientRect();
  return { dx: p.x - (r.left + r.width / 2), dy: p.y - (r.top + r.height / 2) };
}

/** Where an element sits right now, in viewport px. */
function centreOf(el: HTMLElement): Point {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/**
 * Arm both of a phase's timers: the reading dwell, and the ceiling above.
 *
 * The ceiling KILLS the flights rather than pretending they landed — `cancel`
 * fires `abort`, which settles the gate silently, and `writeRest` puts the card
 * on its destination. That is the honest resolution: nobody saw the motion, so
 * nobody is owed the landing cue that would have gone with it.
 */
function armPhase(els: readonly HTMLElement[], gate: RevealGate, dwellMs: number): () => void {
  const dwell = setTimeout(gate.dwell, dwellMs);
  const ceiling = setTimeout(() => {
    for (const el of els) {
      cancelFlight(el);
      writeRest(el);
    }
    gate.dwell();
  }, dwellMs + PHASE_CEILING_MS);
  return () => {
    clearTimeout(dwell);
    clearTimeout(ceiling);
  };
}

/* ── the component ────────────────────────────────────────────────────────── */

export function ChallengeRevealOverlay() {
  const challengeReveal = useGameStore(s => s.challengeReveal);
  const setChallengeReveal = useGameStore(s => s.setChallengeReveal);
  const gameState = useGameStore(s => s.gameState);

  const [phase, setPhase] = useState<RevealPhase>('arrive');
  // Derived-state-from-props: a second challenge can arrive while the first is
  // still on screen, and its sequence must start at `arrive` rather than
  // inheriting whatever phase the last one had reached. Comparing the event
  // IDENTITY is what makes two textually identical challenges in a row two
  // separate reveals.
  const [seen, setSeen] = useState<ChallengeRevealEvent | null>(challengeReveal);
  if (seen !== challengeReveal) {
    setSeen(challengeReveal);
    setPhase('arrive');
  }

  const faceRefs = useRef<(HTMLDivElement | null)[]>([]);
  const backRefs = useRef<(HTMLDivElement | null)[]>([]);

  const revealedCharacters = challengeReveal
    ? (challengeReveal.revealedCharacters ?? [challengeReveal.character])
    : [];

  /* Whose card it is. `ChallengeRevealEvent` carries NAMES, not ids — the same
     constraint useFxCues and useHapticFeedback work under, and safe for the
     same reason: RoomManager rejects a join whose name case-insensitively
     matches a seated player, so a name is a key. */
  const accused = gameState?.players.find(p => p.name === challengeReveal?.challengedName) ?? null;
  const accusedId = accused?.id ?? null;
  const isMine = accusedId !== null && accusedId === gameState?.myId;

  /* ── ARRIVE ─────────────────────────────────────────────────────────────
     The card comes out of the accused's seat, fast, and the table takes the
     hit as it lands. §6 arms hitstop on exactly three things and "a challenge
     resolving" is one of them — on the FIRST card only, because an Embezzle
     reveal is three cards and three freezes inside 200ms is jank, not weight
     (flight.ts's HITSTOP_MIN_GAP_MS would drop the other two anyway; arming
     one is saying so rather than relying on it). */
  useIsomorphicLayoutEffect(() => {
    if (!challengeReveal || phase !== 'arrive') return;

    const seat = fxSeatPoint(accusedId);
    const els = faceRefs.current.filter((el): el is HTMLDivElement => el !== null);
    const advance = () => {
      setPhase(nextRevealPhase(challengeReveal, 'arrive'));
    };
    const gate = createRevealGate(els.length, advance);
    const disarm = armPhase(els, gate, REVEAL_HOLD_MS);

    els.forEach((el, i) => {
      const key = `${challengeReveal.challengedName}-${i}`;
      // The two geographies, and the fallback is not a degenerate version of
      // the real one — it is `dealIn`, the verb whose entire premise is a card
      // that does not know where it came from.
      const opts = seat
        ? challengeArrive({ ...deltaTo(el, seat), key })
        : dealIn(key);
      const travelX = -(opts.dx ?? 0);
      const travelY = -(opts.dy ?? 0);
      const started = fly(el, {
        ...opts,
        delay: i * DEAL_STAGGER_MS,
        hit: i === 0 && seat !== null,
        land: () => {
          // One cue for the gesture, not one per card in an Embezzle reveal:
          // tuning.ts's rule 1 is that a felt which glitters constantly has
          // stopped meaning anything. The epicentre is where the card actually
          // stopped, which is the middle of the table, not the seat it left.
          if (i === 0) {
            emitFxCue({
              event: 'card_landed',
              condition: isMine ? 'mine' : 'theirs',
              at: accusedId,
              ...centreOf(el),
              dx: travelX,
              dy: travelY,
            });
          }
          gate.settle();
        },
        abort: gate.settle,
      });
      if (!started) gate.settle();
    });

    return () => {
      disarm();
      // Only ever a no-op in practice — the phase cannot change until every
      // flight has resolved — but an unmount mid-beat (the store cleared by a
      // rematch, a disconnect) must not leave a record writing to a dead node.
      for (const el of els) cancelFlight(el);
    };
  }, [challengeReveal, phase, accusedId, isMine]);

  /* ── SWAP ───────────────────────────────────────────────────────────────
     §6's Swap row, and it is a swap in the literal sense for once: the proven
     card goes back into the deck and its replacement comes out of the same
     pile, so the two genuinely pass each other. `exchangeSwap` mirrors their
     arcs off the sign of the travel and offsets the follower by 60ms, which is
     the difference between two cards trading places and one blur. */
  useIsomorphicLayoutEffect(() => {
    if (!challengeReveal || phase !== 'swap') return;

    const deck = fxDeckPoint();
    const seat = fxSeatPoint(accusedId);
    const faces = faceRefs.current.filter((el): el is HTMLDivElement => el !== null);
    const backs = backRefs.current.filter((el): el is HTMLDivElement => el !== null);

    // With no deck object on screen (below 1024px) there is nowhere for the
    // proven card to go, so it stays where it is and only the replacement
    // moves. Flying it to a measured nothing is the (0,0) bug.
    const outbound = deck ? faces : [];
    const gate = createRevealGate(outbound.length + backs.length, () => setPhase('done'));
    const disarm = armPhase([...outbound, ...backs], gate, SWAP_HOLD_MS);

    /* Which way the proven card bows, decided ONCE — off the first of them, so
       a three-card Embezzle reveal does not have its members disagreeing, and
       so the replacement below can take the other side deliberately instead of
       deriving one that may match. */
    let outSide = 1;

    if (deck) {
      outbound.forEach((el, i) => {
        const toDeck = deltaTo(el, deck);
        setRest(el, toDeck.dx, toDeck.dy);
        // The invert: it IS at centre, it BELONGS at the deck now.
        const back = { dx: -toDeck.dx, dy: -toDeck.dy };
        if (i === 0) outSide = swapSide(back);
        const started = fly(el, {
          ...exchangeSwap({ ...back, side: outSide, lead: true, key: `return-${i}` }, back),
          land: gate.settle,
          abort: gate.settle,
        });
        if (!started) gate.settle();
      });
    }

    backs.forEach((el, i) => {
      // Its destination is the seat; its launch point is the deck.
      const toSeat = seat ? deltaTo(el, seat) : { dx: 0, dy: 0 };
      setRest(el, toSeat.dx, toSeat.dy);
      const dest = seat ?? centreOf(el);
      const launch: Delta | null = deck ? { dx: deck.x - dest.x, dy: deck.y - dest.y } : null;
      const key = `draw-${i}`;
      const opts = launch
        // Mirrored off the leg it is replacing, not off its own travel — the
        // two share the deck as an endpoint, so their travel directions can
        // agree (see `SwapContext.side`).
        ? exchangeSwap({ ...launch, side: -outSide, lead: false, key }, { ...launch })
        // No deck to come off, so the replacement uses the verb written for
        // exactly that case — and it still lands on the seat, because the rest
        // pose above already moved the destination there.
        : dealIn(key);
      const started = fly(el, {
        ...opts,
        delay: (opts.delay ?? 0) + i * DEAL_STAGGER_MS,
        land: () => {
          // The replacement arriving in a real seat: the second and last
          // landing of the beat, and the one that tells the accused player
          // their hand is whole again.
          emitFxCue({
            event: 'card_landed',
            condition: isMine ? 'mine' : 'theirs',
            at: accusedId,
            x: dest.x,
            y: dest.y,
            dx: -(opts.dx ?? 0),
            dy: -(opts.dy ?? 0),
          });
          gate.settle();
        },
        abort: gate.settle,
      });
      if (!started) gate.settle();
    });

    return () => {
      disarm();
      for (const el of outbound) cancelFlight(el);
      for (const el of backs) cancelFlight(el);
    };
  }, [challengeReveal, phase, accusedId, isMine]);

  /* The store is cleared as a plain effect rather than from inside the gate:
     `setChallengeReveal(null)` unmounts this component, and a store write from
     a layout effect that is about to delete its own subscriber is a render
     scheduled from inside a commit. */
  useEffect(() => {
    if (challengeReveal && phase === 'done') setChallengeReveal(null);
  }, [challengeReveal, phase, setChallengeReveal]);

  if (!challengeReveal || phase === 'done') return null;

  const { challengerName, challengedName, character, wasGenuine } = challengeReveal;
  const showReplacement = showsReplacement(challengeReveal);
  const inverseClaim = challengeReveal.inverseClaim === true;
  const showCardFaces = wasGenuine || inverseClaim;

  return (
    /* The plate lifts for the swap: the cards are flying to the deck and to a
       seat, and a player who cannot see either of those is watching two
       rectangles slide off the edge of a black screen. Opacity on the SCRIM,
       never on a flying card — one author per element. */
    <div
      className={`fixed inset-0 z-40 flex items-center justify-center animate-fade-in transition-colors duration-300 ${
        phase === 'swap' ? 'bg-black/40' : 'bg-black/70'
      }`}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="relative flex gap-3">
          {showCardFaces ? (
            revealedCharacters.map((revealedCharacter, index) => (
              /* The flight transform goes on a WRAPPER. `.card-face` already
                 composes a transform out of the press variables and one
                 element cannot have two authors of one property — verbs.ts's
                 FLIGHT_TRANSFORM header. */
              <div
                key={`${revealedCharacter}-${index}`}
                ref={node => {
                  faceRefs.current[index] = node;
                }}
                style={FLIGHT_TRANSFORM_STYLE}
              >
                <div
                  className="card-face card-reveal-face h-40 w-28"
                  style={characterCardVars(revealedCharacter)}
                >
                  <CardArtwork character={revealedCharacter} variant="focus" priority />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/25" />
                  <CharacterCardBadge character={revealedCharacter} />
                </div>
              </div>
            ))
          ) : (
            <div
              ref={node => {
                faceRefs.current[0] = node;
              }}
              style={FLIGHT_TRANSFORM_STYLE}
            >
              <div
                className="card-face w-28 h-40 gap-2"
                /* A card nobody holds. §1.2: no character hue (the band stays
                   transparent), and the failure is stated with the hazard
                   material rather than a red border. */
                style={{ backgroundColor: 'rgba(95,20,28,0.45)', backgroundImage: 'var(--hazard)' }}
              >
                {/* The last functional glyph-as-character in the app. BluffGlyph is
                    the same mark the action log uses for a caught bluff, so the
                    overlay and the log line beneath it say it the same way. */}
                <BluffGlyph size={52} className="text-coup-crimson" />
                <span className="type-display text-step-0 text-coup-ink">{character}</span>
              </div>
            </div>
          )}

          {/* The replacements ride ON TOP of the cards they replace rather than
              beside them: a second row would widen the flex line and shove the
              proven cards sideways at the exact frame they start flying, so
              every measurement in the swap effect would be taken from a box
              that is about to move. */}
          {phase === 'swap' && showReplacement && (
            <div className="absolute inset-0 flex justify-center gap-3">
              {revealedCharacters.map((_, index) => (
                <div
                  key={index}
                  ref={node => {
                    backRefs.current[index] = node;
                  }}
                  style={FLIGHT_TRANSFORM_STYLE}
                >
                  <div className="card-face card-back h-40 w-28 bg-coup-surface">
                    <CardBackArtwork variant="focus" priority />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/10" />
                    <span className="sr-only">New hidden influence</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Text */}
        <div className="text-center mt-2">
          {phase === 'arrive' && (
            <>
              <p className="text-white text-lg font-bold">
                {inverseClaim && wasGenuine
                  ? <>{challengedName} shows every card: <span className="text-coup-accent">no Duke</span>!</>
                  : inverseClaim
                    ? <>{challengedName} reveals <span className="text-coup-accent">Duke</span>!</>
                    : wasGenuine
                  ? <>{challengedName} reveals <span className="text-coup-accent">{character}</span>!</>
                  : <>{challengedName} does not have <span className="text-coup-accent">{character}</span>!</>
                }
              </p>
              <p className={`text-sm font-bold mt-1 ${wasGenuine ? 'text-green-400' : 'text-red-400'}`}>
                {wasGenuine ? 'Challenge fails!' : 'Caught bluffing!'}
              </p>
              <p className="text-gray-400 text-xs mt-1">
                {wasGenuine
                  ? `${challengerName} must lose an influence`
                  : `${challengedName} must lose an influence`}
              </p>
            </>
          )}
          {phase === 'swap' && (
            <p className="text-gray-400 text-sm animate-fade-in">
              {revealedCharacters.length > 1
                ? 'Shown cards returned to the deck; replacements drawn.'
                : 'Card returned to the deck; a replacement is drawn.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
