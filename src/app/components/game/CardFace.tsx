'use client';

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { Character, ClientInfluence } from '@/shared/types';
import { CHARACTER_DESCRIPTIONS } from '@/shared/constants';
import { useGameStore } from '../../stores/gameStore';
import { CHARACTER_PALETTE, characterCardVars } from '../../utils/characterPalette';
import { CardArtwork, CardBackArtwork, CharacterCardBadge } from './CardArtwork';
import { getSoundEngine } from '../../audio/SoundEngine';
import {
  FLIGHT_TRANSFORM_STYLE,
  dealIn,
  ensureReducedMotionSync,
  influenceTumble,
  useFlight,
  useIsomorphicLayoutEffect,
} from '../../anim';
import type { Point } from '../../hooks/useFxCues';

type CardSize = 'sm' | 'md' | 'lg';

const cardSizeClasses: Record<CardSize, string> = {
  sm: 'card-face-sm',
  md: 'card-face-md',
  lg: 'card-face-lg',
};

/* ── THE TWO TRANSFORM AUTHORS, AND WHY THEY DO NOT MEET ───────────────────
 *
 * A card here is two elements and each owns exactly one `transform`:
 *
 *   .card-flip-wrapper  ← THE FLIGHT. `FLIGHT_TRANSFORM_STYLE`, inline, from
 *                         anim/verbs. flight.ts writes --fx/--fy/--tilt/--fs
 *                         and nothing else writes them.
 *   .card-face          ← THE POSE. globals.css composes --press-y/--press-s/
 *                         --card-lift, plus the 3D flip keyframes, which write
 *                         `transform` outright.
 *
 * Two elements, two authors, no collision — which is what makes the flight
 * survivable at all: `.card-face`'s transform lives in globals.css and could
 * not be extended to carry four more variables without owning that file.
 *
 * Translate being OUTERMOST on the wrapper is what keeps a measured FLIP exact:
 * adding `dx` to `--fx` moves the wrapper's centroid by exactly `dx` whatever
 * tilt and scale it carries. See flight.ts's header for the arithmetic on what
 * happens when it is not.
 *
 * ── AND WHY AN ANCESTOR MUST NOT WRITE THEM EITHER ────────────────────────
 *
 * Custom properties INHERIT. `.card-flip-wrapper`'s transform reads
 * `var(--fx, 0px)`, and it only defines `--fx` itself once flight.ts has
 * written one — so any ancestor that flies would push its own `--fx` down into
 * every card underneath it and each card would move twice: once because the
 * ancestor moved, and again because it read the ancestor's variable as its
 * own. That is not hypothetical: GameTable shoves a whole SEAT for §6's Refuse
 * verb, and a seat is full of these wrappers.
 *
 * {@link FLIGHT_VARS_RESET} is the stop. Put it on the container that holds
 * cards inside anything that can fly — `.seat-cards`, `.hand-cards` — and the
 * inherited value dies one level above the card. It is not needed on cards
 * whose ancestors never fly, and it is deliberately not baked into the wrapper
 * itself: flight.ts's `clearTransform()` removes the inline properties, and a
 * card that had declared its own zeroes would silently start inheriting again
 * the moment it left the system.
 */

/**
 * Zeroes for the four transform-contract variables, to be spread onto a
 * CONTAINER of cards. Frozen and module-level: React skips a style object it
 * is handed by identity, so a shared constant can never re-write a variable
 * flight.ts is in the middle of animating.
 */
export const FLIGHT_VARS_RESET: Readonly<CSSProperties> = Object.freeze({
  '--fx': '0px',
  '--fy': '0px',
  '--tilt': '0deg',
  '--fs': '1',
} as CSSProperties);

/**
 * A landing cue. anim/ deliberately does not import the audio bus — flight.ts
 * takes a plain `land` callback precisely so the cue is wired here, at the
 * call site that knows what landed.
 *
 * `cardShuffle` and not `exchange`: `exchange` is the semantic cue for the
 * ACTION and useSoundEffects already fires it; `cardShuffle` is the bank's
 * paper-and-deck cue, is in `FLAM` (so a second one inside 190ms attenuates
 * rather than doubling) and is non-priority, which is the right weight for
 * something that happens on every replacement.
 *
 * `mine` is left at its default true, and that is correct rather than lazy: the
 * swap path below only fires on a `character → different character` transition,
 * and an opponent's hidden influence is serialised to `{ character: null }`, so
 * a card that swaps in front of you is always your own.
 */
function playCardLanding(): void {
  getSoundEngine().play('cardShuffle');
}

/**
 * WHERE A CARD CAME FROM, AS A THUNK RATHER THAN A POINT.
 *
 * The one caller — the discard pile — knows the answer as "that player's
 * seat", and the only place that can be turned into viewport pixels is the FX
 * position registry. Resolving it in the PARENT'S render would be a
 * `getBoundingClientRect` during render; resolving it in the parent's layout
 * effect is too late, because a child's layout effect runs first and the card
 * must launch on the frame it mounts. So the parent hands down the question and
 * this component asks it at exactly the right moment — inside its own mount
 * layout effect, one frame after the DOM has the card in it.
 *
 * Returning null is a first-class answer and means "no geography": below
 * 1024px there is no discard well at all, a spectator has no seat, and an
 * unmounted seat measures nothing. It is never coerced to (0, 0) — flip.ts's
 * guard has the arithmetic on why a zero rect is a card entering from the
 * corner of the viewport.
 */
export type EnterFrom = () => Point | null;

/** The smallest box worth treating as a rendered card. */
interface CardBox {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/**
 * The FLIP invert for a fall: where the card IS (`from`) minus where it
 * BELONGS (the centre of `rect`).
 *
 * Three ways to answer "do not move", and not one of them is a coordinate:
 *
 *   • `from` is null — the seat it fell from is not on screen.
 *   • `rect` measures zero — `.felt-centre` is `display: none` below 1024px,
 *     so on a phone the discard exists in the DOM and nowhere on the screen. A
 *     zero rect is not a position: subtracting it would turn the delta into an
 *     absolute viewport coordinate and the card would fly in from the corner.
 *   • the delta is already zero — a fall of no distance is a spin in place,
 *     which reads as a glitch rather than as a card being thrown down.
 */
export function fallDelta(rect: CardBox, from: Point | null): { dx: number; dy: number } | null {
  if (!from) return null;
  if (rect.width === 0 && rect.height === 0) return null;
  const dx = from.x - (rect.left + rect.width / 2);
  const dy = from.y - (rect.top + rect.height / 2);
  if (dx * dx + dy * dy < 1) return null;
  return { dx, dy };
}

/** One swap event. A fresh object per swap so the effect below fires once. */
interface SwapCue {
  n: number;
  character: Character;
}

/** Detect when a card transitions to revealed and trigger a flip animation. */
function useCardFlip(influence: ClientInfluence) {
  const prevRevealedRef = useRef(influence.revealed);
  const prevCharRef = useRef(influence.character);
  const [flipping, setFlipping] = useState(false);
  // Which face to show during the first half of flip (before the midpoint swap)
  const [flipFront, setFlipFront] = useState<'back' | 'face'>('face');
  // The replacement beat. A COUNTED OBJECT, not a boolean with a timeout: the
  // flight engine owns the duration now, so the only thing React has to carry
  // is "a swap happened, here is which card arrived" — and it has to be a new
  // identity every time so two swaps in a row are two flights. The old
  // `setSwapMotion(true)` + 650ms `setTimeout` pair was a second clock keeping
  // a CSS class alive; both are gone.
  const [swapCue, setSwapCue] = useState<SwapCue | null>(null);
  const flipTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    const wasRevealed = prevRevealedRef.current;
    const prevChar = prevCharRef.current;
    prevRevealedRef.current = influence.revealed;
    prevCharRef.current = influence.character;

    if (flipTimeoutRef.current) clearTimeout(flipTimeoutRef.current);

    // Card just got revealed (hidden→revealed) — flip from face to revealed
    if (!wasRevealed && influence.revealed && influence.character) {
      setFlipFront('face');
      setFlipping(true);
      flipTimeoutRef.current = setTimeout(() => setFlipping(false), 700);
    }
    // Opponent card just became known (null→character, not revealed) — flip from back to face
    else if (prevChar === null && influence.character && !influence.revealed) {
      setFlipFront('back');
      setFlipping(true);
      flipTimeoutRef.current = setTimeout(() => setFlipping(false), 700);
    }
    // Known card changed while still hidden to opponents / visible to owner.
    // This happens after exchanges and challenge replacements.
    else if (prevChar && influence.character && prevChar !== influence.character && !influence.revealed) {
      const arrived = influence.character;
      setSwapCue(prev => ({ n: (prev?.n ?? 0) + 1, character: arrived }));
    }

    return () => {
      if (flipTimeoutRef.current) clearTimeout(flipTimeoutRef.current);
    };
  }, [influence.revealed, influence.character]);

  return { flipping, flipFront, swapCue };
}

/** Exactly as long as the `card-unpress` keyframes in globals.css run. */
const CARD_UNPRESS_MS = 190;

type PressPhase = 'idle' | 'pressed' | 'unpressing';

/**
 * The press mechanic (GAME-FEEL-PLAN §2.4). Cards are the thing a player
 * touches most and had no press state at all; buttons have had `active:scale-95`
 * for months.
 *
 * The pose itself lives entirely in CSS (`.is-pressed` / `.is-unpressing`);
 * this hook only decides *when*. It owns one real piece of logic:
 *
 * THE FLIP GUARD. `.card-face` composes one transform out of `--press-s` and
 * `--card-lift`, but `animate-card-flip-reveal` writes the whole `transform`
 * property from its own keyframes. Two authors, one property: mid-flip the
 * press would either be invisible (the flip wins on animation order) or would
 * fight it. So `enabled` is false while a card is flipping, and a press already
 * in progress when a flip starts is dropped rather than left stuck at .955 — a
 * card cannot be both turning over and being held down.
 *
 * THE SWAP NO LONGER NEEDS THE GUARD. It used to: `animate-card-swap-in` was a
 * third author on this same element's `transform`. It is a flight now, and a
 * flight lives on the WRAPPER — so a card arriving from the deck and a finger
 * on that card are two elements' business and compose instead of fighting.
 * Narrowing the guard is the point of moving it, not an oversight.
 */
function useCardPress(enabled: boolean) {
  const [phase, setPhase] = useState<PressPhase>('idle');

  // Hold `is-unpressing` for exactly the length of the release keyframes, then
  // drop back to idle so the class does not re-fire on the next render.
  useEffect(() => {
    if (phase !== 'unpressing') return;
    const timer = setTimeout(() => setPhase('idle'), CARD_UNPRESS_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  // The guard: a flip starting mid-press cancels the press outright.
  useEffect(() => {
    if (!enabled) setPhase('idle');
  }, [enabled]);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    // isPrimary keeps a second finger during a pinch from re-pressing the card.
    if (!enabled || !event.isPrimary) return;
    setPhase('pressed');
  }, [enabled]);

  // Release: only a real press releases into the overshoot. A pointerup that
  // never had a matching pointerdown (drag ended here) must not animate.
  const onPointerUp = useCallback(() => {
    setPhase(prev => (prev === 'pressed' ? 'unpressing' : prev));
  }, []);

  // Cancelled (scroll took over the gesture) or dragged off: no overshoot, the
  // press was never completed.
  const onPointerCancel = useCallback(() => setPhase('idle'), []);
  const onPointerLeave = useCallback(() => {
    setPhase(prev => (prev === 'pressed' ? 'idle' : prev));
  }, []);

  const pressClass = phase === 'pressed'
    ? 'is-pressed'
    : phase === 'unpressing'
      ? 'is-unpressing'
      : '';

  return {
    pressClass,
    pressHandlers: { onPointerDown, onPointerUp, onPointerCancel, onPointerLeave },
  };
}

function CardFaceImage({ character, variant = 'focus', priority = false }: { character: Character; variant?: 'full' | 'focus'; priority?: boolean }) {
  return (
    <>
      <CardArtwork character={character} variant={variant} priority={priority} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
      <CharacterCardBadge character={character} />
      <span className="sr-only">{character}</span>
    </>
  );
}

function CardBackImage({ priority = false }: { priority?: boolean }) {
  return (
    <>
      <CardBackArtwork variant="focus" priority={priority} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/10" />
      <span className="sr-only">Hidden influence</span>
    </>
  );
}

function CardPreviewModal({ character, onClose }: { character: Character; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const palette = CHARACTER_PALETTE[character];

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4" onClick={onClose}>
      {/* A reference panel about one character, not table furniture — so §1.2
          allows the hue on its hairline. Quiet: 1px at 40%, not a 2px
          Tailwind default. */}
      <div
        className={`rounded p-5 flex flex-col items-center gap-3 max-w-[260px] w-full
          border ${palette.edge} bg-coup-surface/95 shadow-xl`}
        onClick={e => e.stopPropagation()}
      >
        <div
          className="card-face card-preview-face h-64 w-44 max-w-full"
          style={characterCardVars(character)}
        >
          <CardFaceImage character={character} variant="full" />
        </div>
        <h3 className={`text-lg font-bold ${palette.text}`}>{character}</h3>
        <p className="text-xs text-coup-ink-mute text-center leading-relaxed">
          {CHARACTER_DESCRIPTIONS[character]}
        </p>
        <button
          className="mt-1 text-xs text-coup-ink-mute hover:text-coup-ink transition-colors"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>,
    document.body,
  );
}

interface CardFaceProps {
  influence: ClientInfluence;
  size?: CardSize;
  onClick?: () => void;
  selected?: boolean;
  /** Disable the click-to-preview behavior */
  disablePreview?: boolean;
  /** Hint that this card is above-the-fold or immediately interactive. */
  priority?: boolean;
  /**
   * §6's Fall row. Where this card fell FROM, asked on mount — see
   * {@link EnterFrom}. Present only on a discard card that has just landed;
   * everything else omits it and does not move.
   */
  enterFrom?: EnterFrom;
}

export function CardFace({ influence, size = 'md', onClick, selected, disablePreview, priority = false, enterFrom }: CardFaceProps) {
  const [showPreview, setShowPreview] = useState(false);
  const sizeClass = cardSizeClasses[size];
  const { flipping, flipFront, swapCue } = useCardFlip(influence);
  const flight = useFlight<HTMLDivElement>();

  // §7's collapse is engine-side, but only if the engine has been told. The
  // installer is idempotent and page-lifetime, so every card calling it costs
  // one branch after the first.
  useEffect(() => { ensureReducedMotionSync(); }, []);

  /* THE SWAP, AS A FLIGHT (§6 "Deal / draw").
   *
   * This replaces `animate-card-swap-in`, a fixed 600ms keyframe that faded a
   * card in from translateY(-18px) on a second clock. Three things the keyframe
   * could not do and the flight does: it is interruptible (a second replacement
   * mid-landing continues from where the card actually is, instead of
   * restarting the keyframe from -18px), it lands on the element's REST pose so
   * a future fan offset composes instead of being overwritten, and it fires a
   * landing callback exactly once — which is what lets the cue be a landing cue
   * rather than a start cue with a guessed delay on it.
   *
   * Layout effect, so the launch pose is written before the browser paints. A
   * passive effect would show one frame of the new card sitting at rest, which
   * is precisely the teleport this is here to remove.
   */
  useIsomorphicLayoutEffect(() => {
    if (!swapCue) return;
    flight.fly(dealIn(swapCue.character, { land: playCardLanding }));
  }, [swapCue, flight]);

  /* THE FALL (§6 row 7) — an influence arriving in the discard.
   *
   * MOUNT ONLY, and that is the definition of the event rather than an
   * optimisation: a card appears in the discard exactly once, when it is lost.
   * The question is read out of a ref so a re-render cannot re-fire it and so
   * the effect has no dependency that changes.
   *
   * `fallDelta` holds the three ways to decline; a missing `enterFrom` — this
   * is simply not a discard card — is the fourth and cheapest.
   */
  const fallRef = useRef<{ from: EnterFrom | undefined; key: string }>({
    from: enterFrom,
    key: `${influence.character ?? 'influence'}`,
  });
  useIsomorphicLayoutEffect(() => {
    const { from, key } = fallRef.current;
    if (!from) return;
    const node = flight.node();
    if (!node) return;
    const delta = fallDelta(node.getBoundingClientRect(), from());
    if (!delta) return;
    flight.fly(influenceTumble({ ...delta, key }, { land: playCardLanding }));
  }, [flight]);

  // Auto-close preview when game state changes (phase transitions, etc.)
  // This prevents the modal from blocking game interactions
  const turnPhase = useGameStore(s => s.gameState?.turnPhase);
  useEffect(() => {
    setShowPreview(false);
  }, [turnPhase]);

  const closePreview = useCallback(() => setShowPreview(false), []);

  // Cards with a known character but no external onClick get click-to-preview
  const canPreview = !disablePreview && !onClick && !!influence.character;
  const interactive = !!onClick || canPreview;
  const activate = useCallback(() => {
    if (onClick) {
      onClick();
      return;
    }
    if (canPreview) setShowPreview(true);
  }, [canPreview, onClick]);
  const handleKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!interactive) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      activate();
    }
  }, [activate, interactive]);

  const flipClass = flipping ? 'animate-card-flip-reveal' : '';

  // A card mid-flip has another author on `.card-face`'s `transform`; the press
  // stands down until it lands. A card mid-FLIGHT does not — that transform is
  // on the wrapper. See useCardPress().
  const { pressClass, pressHandlers } = useCardPress(interactive && !flipping);
  const cardVars = characterCardVars(influence.character);

  if (influence.revealed && influence.character) {
    return (
      <>
        <div ref={flight.ref} style={FLIGHT_TRANSFORM_STYLE} className={`card-flip-wrapper ${sizeClass}`}>
          <div
            title={influence.character}
            role={interactive ? 'button' : 'img'}
            tabIndex={interactive ? 0 : undefined}
            aria-label={`Revealed ${influence.character} influence`}
            className={`card-face ${sizeClass} card-face-revealed
              ${canPreview ? 'is-interactive' : ''} ${pressClass} ${flipClass}`}
            style={cardVars}
            onClick={interactive ? activate : undefined}
            onKeyDown={handleKeyDown}
            {...pressHandlers}
          >
            <CardFaceImage character={influence.character} priority={priority} />
          </div>
          {/* Back face shown during first half of flip animation */}
          {flipping && flipFront === 'face' && (
            <div className={`card-face ${sizeClass} card-flip-back-face ${flipClass}`} style={cardVars}>
              <CardFaceImage character={influence.character} priority={priority} />
            </div>
          )}
        </div>
        {showPreview && <CardPreviewModal character={influence.character} onClose={closePreview} />}
      </>
    );
  }

  if (influence.character) {
    return (
      <>
        <div ref={flight.ref} style={FLIGHT_TRANSFORM_STYLE} className={`card-flip-wrapper ${sizeClass}`}>
          <div
            title={influence.character}
            role={interactive ? 'button' : 'img'}
            tabIndex={interactive ? 0 : undefined}
            aria-label={`${influence.character} influence${selected ? ', selected' : ''}`}
            aria-pressed={interactive ? !!selected : undefined}
            className={`card-face ${sizeClass}
              ${interactive ? 'is-interactive' : ''}
              ${selected ? 'is-selected ring-2 ring-coup-accent' : ''}
              ${pressClass} ${flipClass}`}
            style={cardVars}
            onClick={interactive ? activate : undefined}
            onKeyDown={handleKeyDown}
            {...pressHandlers}
          >
            <CardFaceImage character={influence.character} priority={priority} />
          </div>
          {/* Card back shown during first half when flipping from back→face */}
          {flipping && flipFront === 'back' && (
            <div className={`card-face ${sizeClass} bg-coup-surface card-back card-flip-back-face ${flipClass}`}>
              <CardBackImage priority={priority} />
            </div>
          )}
        </div>
        {showPreview && <CardPreviewModal character={influence.character} onClose={closePreview} />}
      </>
    );
  }

  return (
    <div ref={flight.ref} style={FLIGHT_TRANSFORM_STYLE} className={`card-flip-wrapper ${sizeClass}`}>
      <div className={`card-face ${sizeClass} bg-coup-surface card-back`} role="img" aria-label="Hidden influence">
        <CardBackImage priority={priority} />
      </div>
    </div>
  );
}
