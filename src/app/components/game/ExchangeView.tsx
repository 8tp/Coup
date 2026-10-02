'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ClientGameState, TurnPhase } from '@/shared/types';
import { Timer } from '../ui/Timer';
import { getSocket } from '../../hooks/useSocket';
import { haptic } from '../../utils/haptic';
import { characterCardVars } from '../../utils/characterPalette';
import { CardArtwork, CharacterCardBadge } from './CardArtwork';
import { getSoundEngine } from '../../audio/SoundEngine';
import {
  FLIGHT_TRANSFORM_STYLE,
  cancel as cancelFlight,
  clearRest,
  ensureReducedMotionSync,
  exchangeSwap,
  invertAndPlay,
  measureFirst,
  useIsomorphicLayoutEffect,
  writeRest,
  type FlipSnapshot,
} from '../../anim';

interface ExchangeViewProps {
  gameState: ClientGameState;
}

/**
 * The landing cue for a swap. Wired here and not inside `anim/`, which takes a
 * plain `land` callback precisely so it never has to know the audio bus exists.
 *
 * ONE CUE PER GESTURE, on the card the player touched. Not one per landing:
 * the SoundEngine rate-gates a non-priority id at 80ms and the §6 stagger is
 * 60ms, so cueing every card would produce a cue count that depends on how many
 * cards happened to shift — one, sometimes two, never predictable. The player
 * made one gesture; they hear one card land, and the rest ride in behind it,
 * which is the same argument HITSTOP_MIN_GAP_MS makes about the freeze.
 */
function playSwapLanding(): void {
  getSoundEngine().play('cardShuffle');
}

export function ExchangeView({ gameState }: ExchangeViewProps) {
  const socket = getSocket();
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const { turnPhase, exchangeState } = gameState;
  const prevTurnRef = useRef(gameState.turnNumber);

  /* ── the FLIP bookkeeping ──────────────────────────────────────────────
     Three refs, and each one exists because React owns the DOM here:

     `nodes`   — the live wrapper per ORIGINAL card index. Keyed by the index
                 the server sent, not by render position, because render
                 position is the thing that moves.
     `refCbs`  — one stable ref callback per index. An inline arrow would be a
                 new function identity on every render, and React 19 treats a
                 changed callback ref as detach-then-attach: every re-render of
                 this panel (there is a Timer ticking inside it) would run the
                 cleanup and cancel a flight in mid-air.
     `pending` — the FIRST measurements, taken in the click handler before
                 setState, and consumed by the layout effect after the commit
                 that reordered the DOM. */
  const nodes = useRef(new Map<number, HTMLDivElement>());
  const refCbs = useRef(new Map<number, (node: HTMLDivElement | null) => (() => void) | void>());
  const pending = useRef<{ firsts: Map<number, FlipSnapshot>; lead: number } | null>(null);

  useEffect(() => { ensureReducedMotionSync(); }, []);

  // Reset selection when a new exchange starts (different turn)
  useEffect(() => {
    if (prevTurnRef.current !== gameState.turnNumber) {
      setSelectedIndices([]);
      prevTurnRef.current = gameState.turnNumber;
    }
  }, [gameState.turnNumber]);

  const availableCards = exchangeState?.availableCards;

  /* THE REORDER. Selected cards move to the front, in the order they were
     picked; the rest keep their dealt order. This is the DOM move that FLIP
     measures — a selection that only changed a ring colour would have nothing
     to invert, and §6's Swap verb would have nothing to say. */
  const order = useMemo(() => {
    const count = availableCards?.length ?? 0;
    const rest: number[] = [];
    for (let i = 0; i < count; i++) {
      if (!selectedIndices.includes(i)) rest.push(i);
    }
    return [...selectedIndices.filter(i => i < count), ...rest];
  }, [availableCards?.length, selectedIndices]);

  /* LAST + INVERT + PLAY, after the commit that reordered the row.
     `pending` is only ever set by `toggleCard`, so a re-render driven by the
     Timer or by a state broadcast walks straight past this. */
  useIsomorphicLayoutEffect(() => {
    const p = pending.current;
    if (!p) return;
    pending.current = null;

    for (const [index, first] of p.firsts) {
      const el = nodes.current.get(index);
      if (!el) continue;

      // Measured, not inferred from the index change: the row wraps, so "moved
      // to an earlier slot" and "moved left on screen" are not the same thing,
      // and the arc side has to follow the pixels.
      //
      // NEUTRALISE BEFORE MEASURING — found in the browser, not in review.
      // `invertAndPlay` cancels any live flight and writes the rest pose before
      // it takes its own LAST measurement. A card still in the air from a
      // previous tap would therefore be measured HERE at its mid-flight box and
      // THERE at its rest box: two different deltas, and on a fast double-tap
      // they can have opposite signs, so the card bows the wrong way over a
      // delta it never travels. Doing the neutralise first makes the two
      // measurements identical by construction — the calls inside
      // `invertAndPlay` then find nothing left to do.
      cancelFlight(el);
      writeRest(el);
      const rect = el.getBoundingClientRect();
      const dx = first.cx - (rect.left + rect.width / 2);
      const dy = first.cy - (rect.top + rect.height / 2);
      const lead = index === p.lead;

      invertAndPlay(
        el,
        first,
        exchangeSwap({ dx, dy, lead, key: index }, lead ? { land: playSwapLanding } : {}),
      );
    }
  }, [selectedIndices]);

  const nodeRef = (index: number) => {
    const cbs = refCbs.current;
    const existing = cbs.get(index);
    if (existing) return existing;
    const cb = (node: HTMLDivElement | null): (() => void) | void => {
      if (!node) {
        nodes.current.delete(index);
        return;
      }
      nodes.current.set(index, node);
      // React 19 cleanup: abort on the same commit as the removal, so a flight
      // never writes to a detached node and — the contract that matters — a
      // superseded flight fires `abort`, which carries no cue, instead of
      // `land`, which does.
      return () => {
        cancelFlight(node);
        clearRest(node);
        if (nodes.current.get(index) === node) nodes.current.delete(index);
      };
    };
    cbs.set(index, cb);
    return cb;
  };

  if (turnPhase !== TurnPhase.AwaitingExchange || !exchangeState) {
    return null;
  }

  if (exchangeState.availableCards.length === 0) {
    return (
      <div className="prompt-info">
        <p className="text-center text-gray-400 text-sm">Exchange in progress...</p>
      </div>
    );
  }

  const { keepCount } = exchangeState;
  const cards = exchangeState.availableCards;

  const toggleCard = (index: number) => {
    haptic();

    // FIRST — every card, because selecting one shifts the others. Taken before
    // setState so the snapshot is genuinely "before the move".
    const firsts = new Map<number, FlipSnapshot>();
    for (const [i, el] of nodes.current) {
      const snap = measureFirst(el);
      if (snap) firsts.set(i, snap);
    }
    pending.current = { firsts, lead: index };

    setSelectedIndices(prev => {
      if (prev.includes(index)) {
        return prev.filter(i => i !== index);
      }
      if (prev.length >= keepCount) {
        return [...prev.slice(1), index];
      }
      return [...prev, index];
    });
  };

  const handleConfirm = () => {
    haptic(80);
    socket.emit('game:choose_exchange', { keepIndices: selectedIndices });
  };

  return (
    <div className="prompt-action">
      <Timer expiresAt={gameState.timerExpiry} />
      <p className="text-center text-coup-accent font-bold text-lg mb-1">
        {gameState.useInquisitor ? 'Inquisitor' : 'Ambassador'} Exchange
      </p>
      <p className="text-center text-gray-400 text-xs mb-4">
        Tap {keepCount} card{keepCount > 1 ? 's' : ''} to keep. The rest go back to the deck.
      </p>
      <div className="flex flex-wrap gap-2 sm:gap-3 justify-center mb-4">
        {order.map(i => {
          const char = cards[i];
          return (
            /* Two elements, two transform authors — the same split CardFace
               documents. The wrapper flies (`--fx/--fy/--tilt/--fs`); the
               `.card-face` button keeps the press/hover pose it composes in
               globals.css out of `--press-*` and `--card-lift`. Putting the
               flight on the button would have overwritten that transform
               outright and taken the hover lift with it. */
            <div
              key={i}
              ref={nodeRef(i)}
              style={FLIGHT_TRANSFORM_STYLE}
              className="card-flip-wrapper card-face-md sm:card-face-lg"
            >
              <button
                title={char}
                className={`card-face card-face-md sm:card-face-lg is-interactive
                  ${selectedIndices.includes(i) ? 'is-selected ring-2 ring-coup-accent' : 'opacity-60'}`}
                style={characterCardVars(char)}
                onClick={() => toggleCard(i)}
              >
                <CardArtwork character={char} variant="focus" priority />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
                <CharacterCardBadge character={char} />
                <span className="sr-only">{char}</span>
              </button>
            </div>
          );
        })}
      </div>
      <button
        className="btn-primary w-full"
        disabled={selectedIndices.length !== keepCount}
        onClick={handleConfirm}
      >
        Keep selected ({selectedIndices.length}/{keepCount})
      </button>
    </div>
  );
}
