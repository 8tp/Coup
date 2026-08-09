'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActionType, ChallengeRevealEvent, Character, ChatMessage, ClientGameState, ClientInfluence, ClientPlayerState, GameMode, TargetingPublication, TurnPhase } from '@/shared/types';
import { PlayerSeat } from './PlayerSeat';
import { CardFace, FLIGHT_VARS_RESET, type EnterFrom } from './CardFace';
import { CoinChangeBurst } from './CoinChangeBurst';
import { AssassinateGlyph, CoinIcon, CoupGlyph, SpeakerGlyph, SpeakerMutedGlyph, StealGlyph } from '../icons';
import { ActionBar } from './ActionBar';
import { ChallengePrompt } from './ChallengePrompt';
import { BlockPrompt } from './BlockPrompt';
import { BlockChallengePrompt } from './BlockChallengePrompt';
import { InfluenceLossPrompt } from './InfluenceLossPrompt';
import { ExchangeView } from './ExchangeView';
import { ExamineSelectionPrompt } from './ExamineSelectionPrompt';
import { ExaminePrompt } from './ExaminePrompt';
import { GameCenterTabs } from './GameCenterTabs';
import { GameOverOverlay } from './GameOverOverlay';
import { ChallengeRevealOverlay } from './ChallengeRevealOverlay';
import { PhaseStatus } from './PhaseStatus';
import { WaitingView } from './WaitingView';
import { HowToPlay } from '../home/HowToPlay';
import { ReactionBubble } from './ReactionBubble';
import { ReactionPicker } from './ReactionPicker';
import { SettingsModal } from '../settings/SettingsModal';
import { PracticeCoach } from './PracticeCoach';
import { useSoundEffects } from '../../hooks/useSoundEffects';
import { useHapticFeedback } from '../../hooks/useHapticFeedback';
import {
  fxSeatPoint,
  registerFxBanner,
  registerFxHand,
  registerFxSeat,
  useFxCues,
  type Point,
} from '../../hooks/useFxCues';
import {
  FLIGHT_TRANSFORM_STYLE,
  MAX_EVENT_MS,
  assassinate,
  blockCut,
  cancel as cancelFlight,
  challengeShove,
  coupSlam,
  fly,
  hash1,
  hashKey,
  punch,
  steal,
  useIsomorphicLayoutEffect,
  type ShoveContext,
} from '../../anim';
import fx from '../../fx';
import { getSoundEngine } from '../../audio/SoundEngine';
import { useGameStore } from '../../stores/gameStore';
import { characterCardVars } from '../../utils/characterPalette';
import { haptic } from '../../utils/haptic';

/* ======================================================================
   THE TABLE — GAME-FEEL-PLAN.md §1.4, ART-DIRECTION.md §3.2.

   One DOM tree serves both layouts, and that is a constraint rather than a
   preference: the seats register themselves with the FX position registry by
   player id (`registerFxSeat`), so a second, hidden copy of the seats for a
   different breakpoint would fight the first for the registry entry and one
   of the two would win by mount order. So there is exactly one seat element
   per player and the LAYOUT changes underneath it, in globals.css, at 1024px.

   Below 1024px: `.felt-rail` / `.felt-top` are `display: contents`, the seats
   fall through as direct grid items of `.table-felt`, and the phone column is
   the 2-or-3-column grid it has always been.

   At 1024px and up: the same three wrappers become the left rail, the top rail
   and the right rail of a felt with the deck, the treasury and the discard in
   the middle of it, and the log moves to a side rail.
   ====================================================================== */

/**
 * How many seats go on each side of the felt, for every opponent count the
 * game can produce — 1 to 5 for a player, and up to 6 for a spectator, who has
 * no seat of their own and therefore sees every player as an "opponent".
 *
 * The shape is a ring read clockwise starting at your left hand, so turn order
 * runs around the table the way it would if you were sitting at one: up the
 * left rail, across the top, down the right rail. Two seats face each other
 * rather than huddling at the top; five spread 2/1/2 so the middle of the felt
 * stays wide enough for the deck, the treasury and the discard.
 */
export function ringSplit(n: number): { left: number; top: number; right: number } {
  if (n <= 1) return { left: 0, top: Math.max(n, 0), right: 0 };
  if (n === 2) return { left: 1, top: 0, right: 1 };
  if (n === 3) return { left: 1, top: 1, right: 1 };
  if (n === 4) return { left: 1, top: 2, right: 1 };
  if (n === 5) return { left: 2, top: 1, right: 2 };
  const side = Math.floor((n - 2) / 2);
  return { left: side, top: n - 2 * side, right: side };
}

/* ══════════════════════════════════════════════════════════════════════════
   §6's VERB TABLE, AT THE MOMENTS IT DESCRIBES
   ==========================================================================

   `anim/verbs.ts` holds the four numbers per verb. It cannot hold the two
   things that make a verb happen — WHEN, and to WHAT — because it is pure and
   knows nothing about a game. This is the other half.

   WHEN comes from a state diff, the same shape as `fxDiffCues` and for the
   same reason: the server is authoritative, so the only honest signal that a
   Coup happened is that a Coup appeared in the state. Driving these off the
   local player's click would animate one seat's actions and leave the bots'
   silent.

   WHAT is decided per verb, and it is the judgement §6's table does not make:

     coup / assassinate / steal   an ACTION CARD, thrown across the felt.
         There is no card object for a declared action anywhere in this app —
         the action exists as a line of log text and a phase banner — so these
         three verbs would have had nothing to move. `ActionCardFlight` below
         is that object: one transient plate, carrying the same glyph the
         action log uses for the same verb, launched between two real seats.

     block / challenge            a SEAT, recoiling.
         §6's Refuse row is "the loser's card is shoved back". The loser's
         cards are in their seat and there are two of them; shoving one and not
         the other would read as a card slipping rather than as a person taking
         a hit, so the whole plate takes it. The displacement is still a
         fraction of a CARD's width, not of the seat's — 22% of a 15rem seat is
         a seat sliding across the table, which is a different gesture from the
         one the row describes.

   EVERY ONE OF THEM CAN DECLINE. `fxSeatPoint` returns null for a seat that is
   not on screen, and a null is never coerced to (0, 0) — see its header, and
   flip.ts's guard. No seat, no flight; the log line and the FX cue still land,
   which is the information. Below 1024px the deck and the discard do not exist
   at all (`.felt-centre` is `display: none`), but SEATS do, so the three
   action-card verbs read on a phone exactly as they do on a desktop. Only the
   Fall verb is desktop-only, because only the Fall verb needs the discard.
   ══════════════════════════════════════════════════════════════════════════ */

export type TableMotionKind = 'coup' | 'assassinate' | 'steal' | 'block' | 'challenge';

/**
 * One gesture, as two seats and a direction. `fromId` is where the gesture
 * originates and `toId` is what it is aimed at — for a steal that is the
 * VICTIM to the THIEF, because the thing that moves is what was taken.
 */
export interface TableMotion {
  readonly kind: TableMotionKind;
  readonly fromId: string;
  readonly toId: string;
  /** Stable identity, so one event produces exactly one gesture. */
  readonly key: string;
}

/** Everything the diff below needs, and nothing else. */
export interface TableMotionSnap {
  readonly present: boolean;
  readonly pendingKey: string | null;
  readonly pendingType: ActionType | null;
  readonly actorId: string | null;
  readonly targetId: string | null;
  readonly blockKey: string | null;
  readonly blockerId: string | null;
  readonly coins: ReadonlyMap<string, number>;
  readonly idByName: ReadonlyMap<string, string>;
  readonly reveal: ChallengeRevealEvent | null;
}

const EMPTY_MOTION_SNAP: TableMotionSnap = {
  present: false,
  pendingKey: null,
  pendingType: null,
  actorId: null,
  targetId: null,
  blockKey: null,
  blockerId: null,
  coins: new Map(),
  idByName: new Map(),
  reveal: null,
};

export function tableMotionSnapshot(
  gs: ClientGameState | null,
  reveal: ChallengeRevealEvent | null,
): TableMotionSnap {
  if (!gs) return { ...EMPTY_MOTION_SNAP, reveal };

  const pa = gs.pendingAction;
  const pb = gs.pendingBlock;
  const coins = new Map<string, number>();
  const idByName = new Map<string, string>();
  for (const p of gs.players) {
    coins.set(p.id, p.coins);
    idByName.set(p.name, p.id);
  }

  return {
    present: true,
    // Same identity as `fxSnapshot`'s: a re-broadcast of the same pending
    // action is not a second declaration.
    pendingKey: pa ? `${gs.turnNumber}|${pa.type}|${pa.actorId}|${pa.targetId ?? ''}` : null,
    pendingType: pa?.type ?? null,
    actorId: pa?.actorId ?? null,
    targetId: pa?.targetId ?? null,
    blockKey: pb ? `${gs.turnNumber}|${pb.blockerId}|${pa?.type ?? ''}` : null,
    blockerId: pb?.blockerId ?? null,
    coins,
    idByName,
    reveal,
  };
}

export interface TableMotionDriver {
  push(gs: ClientGameState | null, reveal: ChallengeRevealEvent | null): TableMotion[];
}

/**
 * The diff, and the one piece of memory it needs.
 *
 * A COUP AND AN ASSASSINATE FIRE ON DECLARATION; A STEAL FIRES ON RESOLUTION,
 * and the asymmetry is the game's rather than this file's. A Coup can be
 * neither challenged nor blocked, so its declaration IS its landing — the same
 * reasoning `fxDiffCues` uses to raise `coup_landed` there. An Assassinate is
 * §6's lunge precisely because it may yet be stopped: the knife is shown at
 * declaration and never arrives. A Steal, though, is the one action whose
 * whole gesture is a transfer that may not happen, so animating coins leaving
 * a seat that keeps them would be a lie. It is watched instead: remember the
 * victim's balance when the Steal is declared, and fly only if the balance has
 * actually fallen by the time the action leaves the table.
 *
 * A CHALLENGE FIRES WHEN THE PLATE COMES DOWN. `ChallengeRevealOverlay` owns
 * the challenge for the 1.5–2.4s it is up, behind a `bg-black/70` scrim — a
 * seat shoved under that is a seat nobody can see move. The shove is the first
 * thing the table does when the plate lifts, which puts it immediately before
 * the influence loss it caused.
 *
 * The first push is skipped, exactly as `createFxCueDriver` skips it: a player
 * rejoining mid-game receives a state that already contains a pending Coup,
 * and re-throwing it three turns late is worse than not throwing it.
 */
export function createTableMotionDriver(): TableMotionDriver {
  let prev: TableMotionSnap | null = null;
  let stealWatch: { key: string; actorId: string; targetId: string; coins: number } | null = null;

  return {
    push(gs, reveal): TableMotion[] {
      const curr = tableMotionSnapshot(gs, reveal);
      const before = prev;
      prev = curr;
      const out: TableMotion[] = [];
      if (before === null) return out;

      /* A Steal that was on the table is no longer on it. Checked BEFORE a new
         declaration is armed below, so the two can never share a turn and lose
         one of themselves. */
      if (stealWatch && curr.pendingKey !== stealWatch.key) {
        const now = curr.coins.get(stealWatch.targetId);
        const took = stealWatch;
        stealWatch = null;
        if (now !== undefined && now < took.coins) {
          out.push({
            kind: 'steal',
            fromId: took.targetId,
            toId: took.actorId,
            key: `${took.key}|took`,
          });
        }
      }

      if (curr.present && curr.pendingKey && curr.pendingKey !== before.pendingKey && curr.actorId) {
        if (curr.pendingType === ActionType.Coup && curr.targetId) {
          out.push({ kind: 'coup', fromId: curr.actorId, toId: curr.targetId, key: curr.pendingKey });
        } else if (curr.pendingType === ActionType.Assassinate && curr.targetId) {
          out.push({ kind: 'assassinate', fromId: curr.actorId, toId: curr.targetId, key: curr.pendingKey });
        } else if (curr.pendingType === ActionType.Steal && curr.targetId) {
          stealWatch = {
            key: curr.pendingKey,
            actorId: curr.actorId,
            targetId: curr.targetId,
            coins: curr.coins.get(curr.targetId) ?? 0,
          };
        }
      }

      // A block landing: the blocker shoves the actor whose action they stopped.
      if (curr.blockKey && curr.blockKey !== before.blockKey && curr.blockerId && curr.actorId) {
        out.push({ kind: 'block', fromId: curr.blockerId, toId: curr.actorId, key: curr.blockKey });
      }

      /* The reveal plate has come down. `ChallengeRevealEvent` carries NAMES,
         not ids — safe for the same reason `fxDiffCues` and useHapticFeedback
         rely on it: RoomManager rejects a join whose name matches a seated
         player case-insensitively, so a name is a key. */
      if (before.reveal && !curr.reveal) {
        const r = before.reveal;
        // wasGenuine = the challenged player held the card, so the CHALLENGER lost.
        const loserId = curr.idByName.get(r.wasGenuine ? r.challengerName : r.challengedName);
        const winnerId = curr.idByName.get(r.wasGenuine ? r.challengedName : r.challengerName);
        if (loserId && winnerId && loserId !== winnerId) {
          out.push({
            kind: 'challenge',
            fromId: winnerId,
            toId: loserId,
            key: `challenge|${r.challengerName}|${r.challengedName}|${r.character}`,
          });
        }
      }

      return out;
    },
  };
}

/* ── the action card ──────────────────────────────────────────────────────
   Its footprint is fixed in px rather than taken from a size class, because
   the element is `position: fixed` and centred on a measured point: the
   negative margins that centre it have to be numbers this file knows, and a
   class whose width changes at a breakpoint would put the card half a card off
   its seat on one side of 1024px. */
const ACTION_CARD_W = 60;
const ACTION_CARD_H = 84;

/**
 * How long past flight.ts's own commitment the card will wait before removing
 * itself regardless. `anim/clock` is a bare rAF loop, so a tab backgrounded
 * mid-throw stops it dead; `ensureHiddenTabSettle()` now lands those flights,
 * and this is the second belt for everything else — the same ceiling, and the
 * same reasoning, as `PHASE_CEILING_MS` in ChallengeRevealOverlay.
 */
const ACTION_FLIGHT_CEILING_MS = MAX_EVENT_MS + 400;

interface ActionFlightState {
  /** Fresh per gesture, so two Coups in a row are two flights. */
  readonly id: number;
  readonly kind: 'coup' | 'assassinate' | 'steal';
  /** Where the card RESTS: the seat the gesture ends at. */
  readonly anchor: Point;
  /** Where it launches from, or lunges at. See below — one vector serves both. */
  readonly other: Point;
  readonly key: string;
}

/**
 * The two ends of a thrown gesture, or null when the table cannot supply them.
 *
 * An Assassinate lunges FROM the actor; a Coup and a Steal land ON their
 * destination. Picking the anchor per verb is what lets one element serve both
 * `punch` and `fly` from a single `other − anchor` vector.
 *
 * NULL IS A REAL ANSWER AND THE ONLY SAFE ONE. `at` is `fxSeatPoint`, which
 * returns null for a seat that is not on screen — a spectator's own seat, a
 * seat that unmounted, a box measuring zero under a `display: none` ancestor.
 * Substituting (0, 0) for any of those throws the card from the corner of the
 * viewport, which reads as a layout bug rather than as a Coup (flip.ts's
 * guard). There is no local fallback gesture for a throw, because a throw with
 * no destination is not a throw; the log line and the FX cue still land.
 */
export function actionFlightPoints(
  kind: ActionFlightState['kind'],
  fromId: string,
  toId: string,
  at: (id: string) => Point | null,
): { anchor: Point; other: Point } | null {
  const anchor = at(kind === 'assassinate' ? fromId : toId);
  const other = at(kind === 'assassinate' ? toId : fromId);
  if (!anchor || !other) return null;
  return { anchor, other };
}

/** Enough of a card to be recognised at 60px, and nothing more. */
function ActionCardBody({ kind }: { kind: ActionFlightState['kind'] }) {
  if (kind === 'coup') {
    /* A Coup is not a claim — nobody holds a card called Coup — so §1.2 gives
       it no character hue, and the reveal overlay's treatment for exactly that
       case is the hazard material. Same statement in both places. */
    return (
      <div
        className="card-face w-full h-full gap-1"
        style={{ backgroundColor: 'rgba(95,20,28,0.45)', backgroundImage: 'var(--hazard)' }}
      >
        <CoupGlyph size={26} className="text-coup-crimson" />
        <span className="type-display text-[10px] leading-none text-coup-ink">COUP</span>
      </div>
    );
  }

  const character = kind === 'steal' ? Character.Captain : Character.Assassin;
  const Mark = kind === 'steal' ? StealGlyph : AssassinateGlyph;
  return (
    <div className="card-face w-full h-full gap-1" style={characterCardVars(character)}>
      <Mark size={26} className="text-coup-ink" />
      <span className="type-display text-[10px] leading-none text-coup-ink">
        {kind === 'steal' ? 'STEAL' : 'STRIKE'}
      </span>
    </div>
  );
}

/**
 * One thrown action card. Three of §6's verbs, one element, and the sign
 * convention is the reason they can share it:
 *
 *   `fly()` takes the FLIP INVERT — where the card IS minus where it BELONGS.
 *   `punch()` takes the PEAK DISPLACEMENT — the direction it lunges.
 *
 * Both are `other − anchor` here, because the anchor is chosen per verb to
 * make them so: a Coup rests on its TARGET and comes from the actor; a Steal
 * rests on the THIEF and comes from the victim; an Assassinate rests on the
 * ACTOR and lunges at the target. verbs.ts spells the two conventions
 * differently on purpose (`dx/dy` against `toX/toY`) and that is honoured at
 * the call below rather than papered over.
 */
function ActionCardFlight({
  flight,
  onDone,
}: {
  flight: ActionFlightState;
  onDone: (id: number) => void;
}) {
  const nodeRef = useRef<HTMLDivElement | null>(null);

  useIsomorphicLayoutEffect(() => {
    const el = nodeRef.current;
    if (!el) {
      onDone(flight.id);
      return;
    }

    const vx = flight.other.x - flight.anchor.x;
    const vy = flight.other.y - flight.anchor.y;
    let settled = false;
    /* The cue hangs off `land` and ONLY off `land`. An aborted throw — a
       superseded gesture, an unmount, the ceiling below — removes the card
       silently, because nobody saw it arrive. flight.ts guarantees exactly one
       of the two fires. */
    const done = (cue: boolean) => {
      if (settled) return;
      settled = true;
      if (cue) getSoundEngine().play('cardShuffle');
      onDone(flight.id);
    };

    const started = flight.kind === 'assassinate'
      ? (() => {
          const o = assassinate({ toX: vx, toY: vy, key: flight.key });
          return punch(el, o.dx ?? 0, o.dy ?? 0, {
            ...o,
            // A lunge does not arrive, so its resolution is silent: the knife
            // is shown, and `assassinationAlert` has already said so.
            land: () => done(false),
            abort: () => done(false),
          });
        })()
      : (() => {
          const ctx = { dx: vx, dy: vy, key: flight.key };
          const o = flight.kind === 'coup' ? coupSlam(ctx) : steal(ctx);
          return fly(el, { ...o, land: () => done(true), abort: () => done(false) });
        })();

    if (!started) done(false);

    const ceiling = setTimeout(() => {
      cancelFlight(el);
      done(false);
    }, ACTION_FLIGHT_CEILING_MS);

    return () => {
      clearTimeout(ceiling);
      /* SETTLE BEFORE CANCELLING, and this line is not defensive padding.
         `cancelFlight` fires the flight's `abort`, which is wired to `done` —
         so without it a teardown asks the PARENT to remove a card, from inside
         the teardown of that very card. React 19's StrictMode runs every effect
         mount→cleanup→mount in development, which turned that into: throw the
         card, tear it down, tell the parent to drop it, and the second mount
         renders into a component already scheduled for removal. Found in a
         browser — the Coup, the Steal and the Assassinate each flashed for one
         commit and vanished, while the two verbs that move a PERSISTENT element
         (a seat, a discard card) animated correctly the whole time. */
      settled = true;
      cancelFlight(el);
    };
  }, [flight, onDone]);

  return (
    <div
      ref={nodeRef}
      aria-hidden="true"
      /* A handle, not a style hook: there is no CSS rule for this attribute.
         The card is `position: fixed` with no class of its own, so without it
         there is nothing to point a devtools query — or a future test — at. */
      data-action-flight={flight.kind}
      style={{
        position: 'fixed',
        zIndex: 30,
        pointerEvents: 'none',
        left: flight.anchor.x - ACTION_CARD_W / 2,
        top: flight.anchor.y - ACTION_CARD_H / 2,
        width: ACTION_CARD_W,
        height: ACTION_CARD_H,
        ...FLIGHT_TRANSFORM_STYLE,
      }}
    >
      <ActionCardBody kind={flight.kind} />
    </div>
  );
}

/* ── the shove ────────────────────────────────────────────────────────────── */

/**
 * A card's width inside this seat, for §6's −0.22.
 *
 * The row's fraction is of the shoved thing's OWN width and verbs.ts is
 * explicit that it is a CARD's width — 15px on the desktop deck leaf. A seat
 * is 15rem, and 22% of that is 53px of plate sliding sideways past its
 * neighbours: the same number, the wrong noun. So the seat recoils by a
 * fraction of the cards it is holding, which is 12px on a desktop seat and
 * 10px on a phone. The fallback is `card-face-sm`'s own 44px, for the moment
 * between a seat mounting and its cards measuring.
 */
const SHOVE_CARD_FALLBACK_W = 44;

export function shoveWidthOf(seat: Element | null): number {
  const card = seat?.querySelector('.card-face') ?? null;
  const w = card ? card.getBoundingClientRect().width : 0;
  return w > 0 ? w : SHOVE_CARD_FALLBACK_W;
}

/**
 * Which way a seat is pushed: directly away from whoever pushed it.
 *
 * `shove()` normalises, so handing it a raw seat-to-seat vector gives a shove
 * of the stated SIZE in the stated DIRECTION rather than one scaled by how far
 * apart the two seats happen to sit. With no winner on screen the verb's own
 * default stands — straight back, leftwards — which is a recoil with no
 * address on it rather than a recoil towards the origin of the viewport.
 */
export function shoveDirection(from: Point | null, to: Point | null): Pick<ShoveContext, 'dirX' | 'dirY'> {
  if (!from || !to) return {};
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) return {};
  return { dirX: dx, dirY: dy };
}

/**
 * The deck as an OBJECT — a pile whose height tracks `deckCount`, sunk into a
 * recess in the felt. It was 8px of text in the header, which is the whole
 * reason nothing could visibly come off it: §1.4's "flights need somewhere to
 * fly from".
 *
 * The pile is capped at 12 visible leaves for 15 cards, so the stack reads as
 * "thick" or "nearly out" rather than counting for you — the figure beside it
 * does the counting, in the monospace Figures role (§4).
 */
function DeckPile({ count }: { count: number }) {
  const leaves = Math.min(count, DECK_MAX_LEAVES);

  return (
    <div className="table-object">
      <div className="deck-well" aria-hidden="true">
        {Array.from({ length: leaves }, (_, i) => (
          <span
            key={i}
            className={`deck-leaf${i === leaves - 1 ? ' deck-leaf-top' : ''}`}
            style={{ bottom: `${6 + i * 2}px` }}
          />
        ))}
      </div>
      <span className="table-object-label">
        Deck <span className="figure text-coup-ink">{count}</span>
      </span>
    </div>
  );
}

/** Coins are circles, and §3.9 says they may stay circles. Everything else on the table is a plate. */
function CoinStack({ count, label, tone }: { count: number; label: string; tone: 'treasury' | 'reserve' }) {
  const discs = count === 0 ? 0 : Math.max(1, Math.min(COIN_MAX_DISCS, Math.round(count / 5)));

  return (
    <div className="table-object">
      <div className={`coin-well coin-well-${tone}`} aria-hidden="true">
        {Array.from({ length: discs }, (_, i) => (
          <span key={i} className="coin-disc" style={{ bottom: `${6 + i * 5}px` }} />
        ))}
      </div>
      <span className="table-object-label">
        {label} <span className="figure text-coup-brass-lit">{count}</span>
      </span>
    </div>
  );
}

/**
 * One card in the discard, with the two things §6's Fall verb needs that a
 * bare `ClientInfluence` cannot carry: a STABLE IDENTITY and WHOSE it was.
 */
export interface DiscardEntry {
  /** `<playerId>:<influence index>` — stable for the life of the game. */
  readonly id: string;
  readonly ownerId: string;
  readonly influence: ClientInfluence;
  /** This card has only just arrived, and is the only one allowed to move. */
  readonly fresh: boolean;
}

/**
 * Every influence anyone has lost, in the order it fell, with an identity.
 *
 * INDEXES WERE NOT IDENTITIES, and that had to be fixed before anything could
 * fly out of a seat. The pile is derived by walking `players` in seat order,
 * so a loss by an early seat INSERTS into the middle of the list; keyed by
 * position, every card after it would take on a different influence, a
 * different tilt, and — worst — the newest card would be attributed to
 * whichever player happened to end up last.
 */
export function discardEntries(players: readonly ClientPlayerState[], seen: ReadonlySet<string> | null): DiscardEntry[] {
  const out: DiscardEntry[] = [];
  for (const p of players) {
    p.influences.forEach((influence, i) => {
      if (!influence.revealed || !influence.character) return;
      const id = `${p.id}:${i}`;
      // `seen === null` is the very first render: nothing is fresh, so a player
      // who joins a game already three influences deep does not watch three
      // retroactive cards tumble into the pile. Same skip as the FX driver's.
      out.push({ id, ownerId: p.id, influence, fresh: seen !== null && !seen.has(id) });
    });
  }
  return out;
}

/**
 * The resting tilt, off the card's identity rather than its position.
 *
 * The old comment on `DISCARD_TILTS` — "fixed, so a card in the discard does
 * not jump when another lands beside it" — was the right intent read off the
 * wrong key: a tilt indexed by POSITION changes for every card after an
 * insertion, which is exactly the jump it was guarding against. Hashed, a
 * card's tilt is decided once, by which card it is.
 */
export function discardTilt(id: string): number {
  return DISCARD_TILTS[Math.floor(hash1(hashKey(id)) * DISCARD_TILTS.length) % DISCARD_TILTS.length];
}

/** Where a lost influence lands and STAYS (§1.4). Face-up, in the order it fell. */
function DiscardPile({ entries }: { entries: DiscardEntry[] }) {
  return (
    <div className="table-object table-object-grow">
      <div className="discard-well">
        {entries.length === 0 ? (
          <span className="table-object-label">Nothing lost yet</span>
        ) : (
          entries.map(entry => (
            /* The tilt is on a wrapper, never on the card: `.card-flip-wrapper`
               owns `transform` for the flight engine (anim/flight.ts) and a
               second author there would be overwritten mid-flight. */
            <span key={entry.id} className="discard-card" style={{ ['--discard-tilt' as string]: `${discardTilt(entry.id)}deg` }}>
              <CardFace
                influence={entry.influence}
                size="sm"
                disablePreview
                /* §6's Fall. Only a card that has just arrived is given an
                   origin; every other card in the pile has already landed and
                   must stay exactly where it is. The thunk is resolved inside
                   CardFace's mount effect — see EnterFrom's header. */
                enterFrom={entry.fresh ? (() => fxSeatPoint(entry.ownerId)) satisfies EnterFrom : undefined}
              />
            </span>
          ))
        )}
      </div>
      <span className="table-object-label">
        Discard <span className="figure text-coup-ink">{entries.length}</span>
      </span>
    </div>
  );
}

/** Cap on the visible leaves of the deck pile. 15 cards, 12 leaves. */
const DECK_MAX_LEAVES = 12;
/** Cap on the coin discs in a stack. One disc per ~5 coins. */
const COIN_MAX_DISCS = 9;
/** The eight resting tilts a discarded card can take. See `discardTilt`. */
const DISCARD_TILTS = [-4, 3, -2, 5, -5, 2, 4, -3];

interface GameTableProps {
  gameState: ClientGameState;
  chatMessages: ChatMessage[];
  onSendChat: (message: string) => void;
  onSendReaction: (reactionId: string) => void;
  isHost: boolean;
  onRematch: () => void;
  isSpectator?: boolean;
  isPracticeRoom?: boolean;
  onExitPractice?: () => void;
  onStopSpectating?: () => void;
}

export function GameTable({ gameState, chatMessages, onSendChat, onSendReaction, isHost, onRematch, isSpectator, isPracticeRoom, onExitPractice, onStopSpectating }: GameTableProps) {
  useSoundEffects();
  useHapticFeedback();
  // Deliberately AFTER useHapticFeedback: that hook picks the single
  // highest-priority pattern for an update and arms utils/haptic.ts's 300ms
  // floor first, so the haptics fx/ fires from its own tuning rows collide at
  // equal priority and are dropped. One buzz per beat, chosen by the layer that
  // can see every candidate. See the header of useFxCues.ts.
  useFxCues();
  const tableRef = useRef<HTMLDivElement>(null);
  const challengeReveal = useGameStore(s => s.challengeReveal);
  /**
   * The seat ELEMENTS, beside the FX registry's seat POINTS.
   *
   * `useFxCues` deliberately hands out coordinates and never nodes — fx/ must
   * not hold a React element. §6's Refuse verb has the opposite requirement:
   * it does not want to know where the seat is, it wants to move it. Two maps
   * filled from one ref callback is the honest version of that; a registry
   * that returned nodes would let anything in the app animate anything.
   */
  const seatEls = useRef(new Map<string, HTMLElement>());
  const isMuted = useGameStore(s => s.isMuted);
  const setMuted = useGameStore(s => s.setMuted);
  const reconnecting = useGameStore(s => s.reconnecting);
  const spectators = useGameStore(s => s.spectators);
  /* Target selection, published by the ActionBar (see its header and
     `gameStore.targeting`). The seats are the other half of a pick that used
     to happen entirely in a list of buttons while the table sat inert. */
  const targeting = useGameStore(s => s.targeting);
  const [showRules, setShowRules] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const me = isSpectator ? undefined : gameState.players.find(p => p.id === gameState.myId);
  /**
   * Seating order: clockwise from your left, so the ring around the felt runs
   * in turn order from where YOU sit. `players` is in seat order but always
   * starts at seat 0, so it is rotated to start at the player after you —
   * which is also the order the phone column falls into, and a better one than
   * it had (the player who acts next is now the first seat you read).
   */
  const opponents = useMemo(() => {
    const players = gameState.players;
    if (isSpectator) return players;
    const myIndex = players.findIndex(p => p.id === gameState.myId);
    if (myIndex < 0) return players.filter(p => p.id !== gameState.myId);
    return [...players.slice(myIndex + 1), ...players.slice(0, myIndex)];
  }, [gameState.players, gameState.myId, isSpectator]);
  const currentPlayerId = gameState.players[gameState.currentPlayerIndex]?.id;
  const isMyActionTurn = !isSpectator
    && me?.isAlive
    && currentPlayerId === gameState.myId
    && gameState.turnPhase === TurnPhase.AwaitingAction;

  // Determine which player should show the timer bar on their seat
  const timerPlayerId = gameState.influenceLossRequest?.playerId
    ?? (gameState.turnPhase === TurnPhase.AwaitingExamineSelection
      ? gameState.examineSelectionState?.targetId
      : null)
    ?? ((gameState.turnPhase === TurnPhase.AwaitingExchange || gameState.turnPhase === TurnPhase.AwaitingExamineDecision)
        && gameState.pendingAction?.actorId
      ? gameState.pendingAction.actorId
      : currentPlayerId);

  /**
   * Mount the FX layer.
   *
   * ROOT is `null` — i.e. `document.body`. The overlay is `position: fixed`,
   * and fx/shake.ts's first hazard is that a transform on an ancestor makes a
   * fixed descendant target-fixed: parked inside the shake target it would
   * shake WITH the table, which is the one thing a full-viewport flash plate
   * must never do. `document.body` is the only host guaranteed to stay outside
   * the target's subtree no matter how this component is restructured later.
   *
   * SHAKE TARGET is `tableRef` — the opponents grid plus the log/chat centre,
   * and nothing else. The phase banner, the prompts and your hand are siblings
   * of it, so a challenge prompt stays readable at the exact moment you have to
   * answer it. (ART-DIRECTION §6; fx/shake.ts.)
   *
   * `mount()` is pure registration: no canvas, no listener, no clock
   * subscriber exists until the first cue fires.
   */
  useEffect(() => {
    fx.mount(null, tableRef.current);
    return () => {
      fx.unmount();
    };
  }, []);

  /* ── §6's verbs, fired ─────────────────────────────────────────────────
     One driver, one slot. The three thrown verbs share a single
     `actionFlight` slot because the game cannot produce two of them at once —
     a turn has one action on the table — and a slot rather than a list means a
     gesture that somehow arrived on top of another supersedes it through the
     flight engine's own abort path instead of leaving two cards in the air. */
  const [actionFlight, setActionFlight] = useState<ActionFlightState | null>(null);
  const flightIdRef = useRef(0);
  const motionDriver = useRef<TableMotionDriver | null>(null);
  if (motionDriver.current === null) motionDriver.current = createTableMotionDriver();

  const clearActionFlight = useCallback((id: number) => {
    // Guarded on the id: a card removing itself must not remove its successor.
    setActionFlight(prev => (prev && prev.id === id ? null : prev));
  }, []);

  useEffect(() => {
    const motions = motionDriver.current?.push(gameState, challengeReveal) ?? [];
    for (const m of motions) {
      if (m.kind === 'block' || m.kind === 'challenge') {
        const el = seatEls.current.get(m.toId);
        // A seat that is not mounted cannot recoil, and there is nothing else
        // sensible to shove in its place.
        if (!el) continue;
        const ctx: ShoveContext = {
          width: shoveWidthOf(el),
          key: m.toId,
          ...shoveDirection(fxSeatPoint(m.fromId), fxSeatPoint(m.toId)),
        };
        const o = m.kind === 'challenge' ? challengeShove(ctx) : blockCut(ctx);
        // `punch`: dx/dy are the PEAK displacement and the seat ends exactly
        // where it started. Nothing hangs off the landing — a block already
        // has its own sound and a challenge has just had a whole plate.
        punch(el, o.dx ?? 0, o.dy ?? 0, o);
        continue;
      }

      // Two real seats or no gesture — see `actionFlightPoints`.
      const ends = actionFlightPoints(m.kind, m.fromId, m.toId, fxSeatPoint);
      if (!ends) continue;
      flightIdRef.current += 1;
      setActionFlight({ id: flightIdRef.current, kind: m.kind, key: m.key, ...ends });
    }
  }, [gameState, challengeReveal]);

  useEffect(() => {
    const titleSuffix = `Coup ${gameState.roomCode}`;
    let title = titleSuffix;

    if (isSpectator) {
      title = `Watching | ${titleSuffix}`;
    } else if (me && !me.isAlive) {
      title = `Eliminated | ${titleSuffix}`;
    } else if (me) {
      const challengePassed = gameState.challengeState?.passedPlayerIds.includes(gameState.myId) ?? false;
      const blockPassed = gameState.blockPassedPlayerIds?.includes(gameState.myId) ?? false;

      if (gameState.turnPhase === TurnPhase.AwaitingAction && currentPlayerId === gameState.myId) {
        title = `Your turn | ${titleSuffix}`;
      } else if (
        gameState.turnPhase === TurnPhase.AwaitingActionChallenge &&
        gameState.pendingAction?.actorId !== gameState.myId &&
        !challengePassed
      ) {
        title = `Challenge? | ${titleSuffix}`;
      } else if (
        gameState.turnPhase === TurnPhase.AwaitingBlock &&
        gameState.pendingAction?.actorId !== gameState.myId &&
        !blockPassed &&
        (!gameState.pendingAction?.targetId || gameState.pendingAction.targetId === gameState.myId)
      ) {
        title = `Block? | ${titleSuffix}`;
      } else if (
        gameState.turnPhase === TurnPhase.AwaitingBlockChallenge &&
        gameState.pendingBlock?.blockerId !== gameState.myId &&
        !challengePassed
      ) {
        title = `Challenge block? | ${titleSuffix}`;
      } else if (
        gameState.turnPhase === TurnPhase.AwaitingInfluenceLoss &&
        gameState.influenceLossRequest?.playerId === gameState.myId
      ) {
        title = `Reveal influence | ${titleSuffix}`;
      } else if (gameState.turnPhase === TurnPhase.AwaitingExchange && gameState.exchangeState) {
        title = `Choose cards | ${titleSuffix}`;
      } else if (
        gameState.turnPhase === TurnPhase.AwaitingExamineSelection &&
        gameState.examineSelectionState?.targetId === gameState.myId
      ) {
        title = `Choose a card | ${titleSuffix}`;
      } else if (gameState.turnPhase === TurnPhase.AwaitingExamineDecision && gameState.examineState) {
        title = `Examine card | ${titleSuffix}`;
      }
    }

    document.title = title;
    return () => {
      document.title = 'Coup Online';
    };
  }, [currentPlayerId, gameState, isSpectator, me]);

  /* Which seats the current selection can and cannot take. `action` is null
     whenever nothing is being aimed, which is most of the time. */
  const aiming: TargetingPublication | null = targeting && targeting.action !== null ? targeting : null;
  const declaredTargetId = gameState.pendingAction?.targetId ?? null;

  const renderSeat = (p: ClientPlayerState) => {
    const eligible = !!aiming?.eligibleIds.includes(p.id);
    const illegalReason = aiming?.reasons[p.id];
    const inSelection = eligible || !!illegalReason;
    /* The hazard material means "in the crosshairs", which covers both halves
       of that: a seat you are about to pick, and the seat an action already on
       the table is aimed at. Never a red ring — see PlayerSeat's `isTarget`. */
    const isTarget = eligible || p.id === declaredTargetId;

    return (
      /* Two registrations and one cleanup. The cleanup is what makes the seat
         safe to fly: a `punch` in progress when the seat unmounts must abort
         at detach time rather than whenever the next frame notices a detached
         node — the same contract useFlight's ref gives a card. */
      <div
        key={p.id}
        className="table-seat relative"
        /* THE SEAT IS A FLIGHT ELEMENT. flight.ts writes --fx/--fy/--tilt/--fs
           and something has to compose them; nothing in globals.css does, and
           a seat that is written to but never reads is a shove that happens
           entirely in the computed-style panel. Found in a browser: the
           variables were animating to 11.6px / −8.6° and the plate had not
           moved a pixel. (verbs.ts's FLIGHT_TRANSFORM header.) */
        style={FLIGHT_TRANSFORM_STYLE}
        ref={(node) => {
          registerFxSeat(p.id, node);
          // React 19 skips the null call entirely once a cleanup is returned,
          // so the null branch here is only the type's.
          if (!node) return;
          seatEls.current.set(p.id, node);
          return () => {
            registerFxSeat(p.id, null);
            if (seatEls.current.get(p.id) === node) seatEls.current.delete(p.id);
            cancelFlight(node);
          };
        }}
      >
        <ReactionBubble playerId={p.id} />
        <PlayerSeat
          player={p}
          isCurrentTurn={p.id === currentPlayerId}
          isMe={false}
          isTarget={isTarget}
          selectable={eligible}
          illegalReason={illegalReason}
          /* The SAME handler the ActionBar's own target list calls, so a tap on
             the person and a tap on their name are one action with one set of
             refusal rules. */
          onSelect={aiming && inSelection ? () => aiming.onSelect(p.id) : undefined}
          timerExpiry={p.id === timerPlayerId ? gameState.timerExpiry : null}
        />
      </div>
    );
  };

  const ring = ringSplit(opponents.length);
  const leftSeats = opponents.slice(0, ring.left);
  const topSeats = opponents.slice(ring.left, ring.left + ring.top);
  const rightSeats = opponents.slice(ring.left + ring.top);

  /* The discard: every influence anyone has lost, in the order it fell. There
     is no discard array on the wire — a revealed influence stays in its
     owner's hand — so the pile is derived.

     `seenDiscardRef` is what makes §6's Fall verb fire once per loss rather
     than once per render: a card is FRESH exactly on the render it first
     appears, and the effect below closes the door behind it. Null on the very
     first render means "nothing is fresh", so a mid-game join does not replay
     the whole pile. */
  const seenDiscardRef = useRef<Set<string> | null>(null);
  const discarded = discardEntries(gameState.players, seenDiscardRef.current);
  useEffect(() => {
    // No dependency array on purpose: this closes the door after EVERY render,
    // and it runs after the cards' own layout effects have already launched.
    const seen = seenDiscardRef.current ?? new Set<string>();
    seenDiscardRef.current = seen;
    for (const entry of discarded) seen.add(entry.id);
  });

  return (
    /* `.table-root` carries the width, not `max-w-lg lg:max-w-xl`: the phone
       column stays 32rem, and at 1024px the cap comes off entirely so the
       desktop layout below can use the room (§3.2 — "not a widened phone"). */
    <div className="table-root h-dvh flex flex-col mx-auto px-3 py-3 overflow-hidden" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))', paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
      {/* Header bar */}
      <div className="flex items-center justify-between mb-2 text-xs text-gray-500">
        <span>Room: <span className="text-gray-400 font-mono">{gameState.roomCode}</span></span>
        <span className="flex items-center gap-2">
          Turn {gameState.turnNumber}
          {spectators.length > 0 && (
            <span className="text-purple-400">{spectators.length} watching</span>
          )}
        </span>
        <div className="flex items-center gap-2.5">
          {/* On the desktop table these two are objects on the felt (the deck
              pile and the treasury), so the header stops repeating them. */}
          <span className="lg:hidden">Deck: <span className="figure">{gameState.deckCount}</span></span>
          {gameState.gameMode === GameMode.Reformation && (
            <span className="lg:hidden text-coup-gold" title="Treasury Reserve">Reserve: <span className="figure">{gameState.treasuryReserve}</span></span>
          )}
          <button
            onClick={() => { haptic(); setMuted(!isMuted); }}
            className="w-9 h-9 rounded-full border border-gray-600 text-gray-400 hover:border-coup-accent hover:text-coup-accent transition text-xs flex items-center justify-center"
            title={isMuted ? 'Unmute sound effects' : 'Mute sound effects'}
            aria-label={isMuted ? 'Unmute sound effects' : 'Mute sound effects'}
            aria-pressed={isMuted}
          >
            {isMuted ? <SpeakerMutedGlyph size={16} /> : <SpeakerGlyph size={16} />}
          </button>
          <button
            onClick={() => { haptic(); setShowSettings(true); }}
            className="w-9 h-9 rounded-full border border-gray-600 text-gray-400 hover:border-coup-accent hover:text-coup-accent transition flex items-center justify-center"
            title="Settings"
            aria-label="Settings"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
          </button>
          <ReactionPicker onReact={onSendReaction} disabled={isSpectator || (me ? !me.isAlive : true)} />
          <button
            onClick={() => { haptic(); setShowRules(true); }}
            className="w-8 h-8 rounded-full border border-gray-600 text-gray-400 hover:border-coup-accent hover:text-coup-accent transition text-xs font-bold flex items-center justify-center"
            title="How to Play"
            aria-label="How to Play"
          >
            ?
          </button>
        </div>
      </div>

      {/* Spectator banner */}
      {isSpectator && (
        <div className="bg-purple-900/60 border border-purple-600 text-purple-200 text-xs text-center py-1.5 px-3 rounded-lg mb-2 flex items-center justify-between">
          <span>Spectating</span>
          {onStopSpectating && (
            <button
              onClick={() => { haptic(); onStopSpectating(); }}
              className="text-purple-300 hover:text-white transition text-xs font-medium"
            >
              Leave
            </button>
          )}
        </div>
      )}

      {/* Reconnecting banner */}
      {reconnecting && (
        <div className="bg-yellow-900/80 border border-yellow-600 text-yellow-200 text-xs text-center py-1.5 px-3 rounded-lg mb-2 animate-pulse">
          Reconnecting to server...
        </div>
      )}

      {/* Phase status banner — the upper edge of the floater keep-out band, and
          deliberately OUTSIDE the shake target. */}
      <div className="mb-3" ref={(node) => { registerFxBanner(node); }}>
        <PhaseStatus
          key={`${gameState.turnNumber}-${gameState.turnPhase}-${gameState.pendingAction?.type ?? 'none'}-${gameState.pendingBlock?.claimedCharacter ?? 'none'}`}
          gameState={gameState}
        />
      </div>

      {isPracticeRoom && !isSpectator && (
        <div className="mb-3 shrink-0">
          <PracticeCoach gameState={gameState} onOpenRules={() => setShowRules(true)} />
        </div>
      )}

      {/*
        THE TABLE — and the only thing the shake is allowed to move.

        This wrapper did not exist before: the opponents grid and the centre
        column were siblings, and the prompts lived INSIDE the centre column.
        Shaking either of those would have shaken the action bar and the
        challenge prompt with them. The prompts and the hand are siblings of
        this ref, so the subtree under it is exactly "the felt and the log".

        THAT IS THE INVARIANT, and it survived the desktop layout: the phase
        banner above, the prompt stack and your hand below are all outside, so
        a challenge prompt stays still at the exact moment you have to answer
        it. Measured after the rebuild by transforming this element and reading
        all four rects: only the felt moves. (fx/shake.ts; ART-DIRECTION §6.)

        Its own box lives in globals.css (`.table-shake`) rather than in
        utilities here, because a Tailwind utility outranks a components-layer
        rule in every media query — `flex` on this element silently beat the
        desktop `display: grid` until it moved.
      */}
      <div ref={tableRef} className="table-shake">
        {/* The felt. On a phone this is the seat grid and nothing else; at
            1024px the three rails become the sides of a table with the deck,
            treasury and discard sunk into the middle of it. See globals.css
            "THE TABLE" and `ringSplit()` above. */}
        <div className="table-felt" data-cols={opponents.length <= 4 ? '2' : '3'}>
          <div className="felt-rail felt-left">{leftSeats.map(renderSeat)}</div>
          <div className="felt-rail felt-top">{topSeats.map(renderSeat)}</div>
          <div className="felt-rail felt-right">{rightSeats.map(renderSeat)}</div>

          <div className="felt-centre">
            <DeckPile count={gameState.deckCount} />
            <DiscardPile entries={discarded} />
            <CoinStack count={gameState.treasury} label="Treasury" tone="treasury" />
            {gameState.gameMode === GameMode.Reformation && (
              <CoinStack count={gameState.treasuryReserve} label="Reserve" tone="reserve" />
            )}
          </div>
        </div>

        {/* Log / chat: under the felt on a phone, a rail beside it on desktop. */}
        <GameCenterTabs
          log={gameState.actionLog}
          chatMessages={chatMessages}
          myId={gameState.myId}
          myName={me?.name ?? ''}
          onSendChat={onSendChat}
          turnPhase={gameState.turnPhase}
          showLogExplanations={isPracticeRoom}
        />
      </div>

      {/* The bottom band: the prompts and your hand. A SIBLING of the table,
          never a descendant — the shake target is `tableRef` above, and a
          challenge prompt that shakes while you are reading it to decide
          whether to challenge is a prompt you cannot answer (fx/shake.ts).
          `.table-bottom` only caps its width on desktop, so the hand sits
          under the middle of the felt instead of stretching to 1456px. */}
      <div className="table-bottom">
      {/* Interactive prompts - only one shows at a time (hidden for spectators). */}
      {!isSpectator && (
        <div className="table-bottom-prompts flex flex-col gap-2 mt-2">
          <ActionBar gameState={gameState} />
          <ChallengePrompt gameState={gameState} />
          <BlockPrompt gameState={gameState} />
          <BlockChallengePrompt gameState={gameState} />
          <InfluenceLossPrompt gameState={gameState} />
          <ExchangeView gameState={gameState} />
          <ExamineSelectionPrompt gameState={gameState} />
          <ExaminePrompt gameState={gameState} />
          <WaitingView gameState={gameState} />
        </div>
      )}

      {/* My hand — pinned to bottom, and your own seat for every purpose the
          opponents' seats serve: the FX registry, and §6's Refuse verb, which
          shoves this plate when the challenge or the block landed on you. */}
      {me && (
        <div
          className="table-bottom-hand relative mt-2"
          /* Same contract as an opponent's seat above. */
          style={FLIGHT_TRANSFORM_STYLE}
          ref={(node) => {
            registerFxHand(me.id, node);
            if (!node) return;
            seatEls.current.set(me.id, node);
            return () => {
              registerFxHand(me.id, null);
              if (seatEls.current.get(me.id) === node) seatEls.current.delete(me.id);
              cancelFlight(node);
            };
          }}
        >
          <ReactionBubble playerId={me.id} />
        <div className={`card-container !px-3 !py-2.5 ${!me.isAlive ? 'opacity-50' : 'seat-mine'} ${
          isMyActionTurn ? 'turn-ready-ring' : ''
        } ${
          me.faction === 'Loyalist' ? 'border-l-[3px] border-l-blue-400 bg-blue-500/[0.07]' :
          me.faction === 'Reformist' ? 'border-l-[3px] border-l-red-400 bg-red-500/[0.07]' : ''
        }`}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-bold text-coup-accent text-sm lg:text-base flex items-center gap-1.5">
              Your Hand
              {isMyActionTurn && (
                <span className="your-move-chip">Your move</span>
              )}
              {me.faction && (
                <span className={`text-xs font-medium ${
                  me.faction === 'Loyalist' ? 'text-blue-300' : 'text-red-300'
                }`}>
                  ({me.faction === 'Loyalist' ? '▲ Loyalist' : '◆ Reformist'})
                </span>
              )}
            </span>
            <span className="figure flex items-center gap-1 text-coup-gold font-bold text-sm relative">
              <CoinIcon size={16} />
              {me.coins}
              <CoinChangeBurst coins={me.coins} />
            </span>
          </div>
          {/* `hand-cards`: globals.css steps your own cards from md (56x80) up
              to the lg footprint (80x112) at >=1024px. The label-plate scale
              steps with them, so the printed strip keeps its proportion
              instead of shrinking into a card that grew around it. */}
          {/* The inheritance stop, for the same reason PlayerSeat carries one:
              this whole plate is a flight element now, and `--fx` inherits. */}
          <div className="hand-cards flex gap-2 justify-center" style={FLIGHT_VARS_RESET}>
            {me.influences.map((inf, i) => (
              <CardFace key={i} influence={inf} size="md" priority />
            ))}
          </div>
          {!me.isAlive && (
            <p className="text-center text-red-400 text-xs mt-2 font-medium">You have been eliminated</p>
          )}
        </div>
        </div>
      )}
      </div>

      <GameOverOverlay
        gameState={gameState}
        isHost={isHost && !isSpectator}
        onRematch={onRematch}
        isSpectator={isSpectator}
        isPracticeRoom={isPracticeRoom}
        onExitPractice={onExitPractice}
      />
      <ChallengeRevealOverlay />
      {/* §6's Strike and Take-from rows. `position: fixed` and outside the
          shake target: the card is thrown ACROSS a table that is shaking, and
          a card carried by the shake is a card that never left the seat. */}
      {actionFlight && <ActionCardFlight flight={actionFlight} onDone={clearActionFlight} />}
      <HowToPlay open={showRules} onClose={() => setShowRules(false)} />
      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}
