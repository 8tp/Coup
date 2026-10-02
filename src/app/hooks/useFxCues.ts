'use client';

/**
 * hooks/useFxCues.ts — the wiring between the game's state machine and fx/.
 *
 * The FX layer is deliberately ignorant: `fx.cue('influence_lost', {condition:
 * 'mine', x, y})` is the whole vocabulary, and fx/ has never heard of a Duke, a
 * TurnPhase or a socket. This file is the only place that knows both sides.
 * It is the third hook of the same shape as `useSoundEffects` and
 * `useHapticFeedback`: diff the last `ClientGameState` against the new one,
 * decide what just happened, and fire.
 *
 * ── THE TWO-CHANNEL HOLD (GAME-FEEL-PLAN §3.6) ────────────────────────────
 *
 * §3.6 describes holding a direction-less cue for one synchronous task, waiting
 * for an event to say who the victim was. That hold is not needed here and the
 * reason is worth stating: a state diff carries BOTH channels at once. The
 * transition that says "an influence flipped to revealed" is the same object
 * that says whose it was, so `condition` is decided in the same expression that
 * decides the event. The hold only becomes necessary when the cue side is a
 * flight-engine landing callback firing at an unrelated time.
 *
 * That case now exists and it still does not need the hold, for the same
 * reason: `ChallengeRevealOverlay` fires `card_landed` from a real `land`
 * callback, and the callback closes over the reveal event that named the
 * player, so the direction is decided at launch and merely delivered on
 * landing. What the flight does add is the TRAVEL VECTOR — see `dx`/`dy` on
 * `FxCueCall`, which nothing could fill in until cards actually flew.
 *
 * ── HAPTICS: WHO OWNS THEM ────────────────────────────────────────────────
 *
 * `useHapticFeedback` keeps ownership. `fx.cue()` also calls `fireHaptic()` for
 * any row that names one (fx/index.ts, not editable from here), so both layers
 * do reach the actuator — but the result is still exactly one pattern per beat,
 * structurally:
 *
 *   • `useFxCues()` is called AFTER `useHapticFeedback()` in GameTable, so the
 *     dedicated hook — which explicitly picks the single highest-priority
 *     candidate across a whole update — always fires first and arms the floor.
 *   • utils/haptic.ts's floor drops an equal-or-lower priority inside 300ms.
 *     Every name FX would re-fire (`targeted`, `influenceLost`, `win`) is the
 *     SAME name the hook already sent, hence equal priority, hence dropped.
 *
 * The two names FX contributes that the hook never produces — `land` on your
 * own card landing and `denied` on a refusal — are additive, not duplicates.
 *
 * ── POSITIONS ─────────────────────────────────────────────────────────────
 *
 * `fx.cue` takes numbers, not elements, so the FX layer never holds a React
 * node. Seats and the hand register their element here; a cue looks the actor
 * or victim up and measures ONE `getBoundingClientRect()` at fire time. A beat
 * is a few times a turn; a rAF loop is 60 times a second, and measuring there
 * is the classic way to turn an effects layer into a layout thrash.
 */

import { useEffect, useRef } from 'react';
import fx, { type CueOptions, type FxCondition, type FxEvent } from '../fx';
import { useGameStore } from '../stores/gameStore';
import { useSettingsStore } from '../stores/settingsStore';
import { ActionType, TurnPhase } from '@/shared/types';
import type { ChallengeRevealEvent, ClientGameState } from '@/shared/types';

/* ── the position registry ──────────────────────────────────────────────── */

/**
 * Seat elements by player id. The local player's HAND is registered under the
 * local player's id, so `at: playerId` resolves for everyone at the table with
 * one lookup and the caller never has to special-case itself.
 */
const seats = new Map<string, HTMLElement>();

/** The two edges of the floater keep-out band. */
let bannerEl: HTMLElement | null = null;
let handEl: HTMLElement | null = null;

/** Ref-callback body for an opponent seat. Pass `null` to unregister. */
export function registerFxSeat(playerId: string, el: HTMLElement | null): void {
  if (el) seats.set(playerId, el);
  else if (seats.get(playerId)) seats.delete(playerId);
}

/** Ref-callback body for the local hand: a seat AND the band's lower edge. */
export function registerFxHand(playerId: string, el: HTMLElement | null): void {
  registerFxSeat(playerId, el);
  handEl = el;
}

/** Ref-callback body for the phase banner: the band's upper edge. */
export function registerFxBanner(el: HTMLElement | null): void {
  bannerEl = el;
}

/** Test hook, and route teardown. */
export function clearFxAnchors(): void {
  seats.clear();
  bannerEl = null;
  handEl = null;
}

/** px of air between a float and the furniture it must not cover. */
const BAND_PAD = 8;

/**
 * A float's `y` is the TOP of its glyph box, not its centre — floaters.ts
 * positions with `translate3d(x, y)` on a `top: 0` node. So the band's LOWER
 * edge has to be pulled up by a whole line or the clamp is off by the height of
 * the text: a `−3` clamped to `handTop − 8` still hangs its glyphs 24px into the
 * hand, and a shout at scale 1.35 hangs 32px in. Caught by looking at it — the
 * arithmetic reads correct right up until you see the number sitting on the
 * coin counter it is describing.
 *
 * 1.5rem/1 at the shout scale, rounded up.
 */
const FLOAT_LINE = 34;

/**
 * The keep-out band: between the phase banner's bottom edge and the hand's top
 * edge. Called once per float spawn — a beat, so a layout read is affordable.
 */
function readFxBand(out: { top: number; bottom: number; width: number }): void {
  const vw = typeof window === 'undefined' ? 360 : window.innerWidth;
  const vh = typeof window === 'undefined' ? 640 : window.innerHeight;
  out.width = vw;

  const banner = rectOf(bannerEl);
  const hand = rectOf(handEl);
  out.top = banner ? banner.bottom + BAND_PAD : 12;
  // No hand means a spectator or an eliminated seat that stopped rendering;
  // keep the floats off the bottom sixth of the screen rather than off nothing.
  out.bottom = (hand ? hand.top : vh - vh / 6) - BAND_PAD - FLOAT_LINE;
}

export interface Point {
  x: number;
  y: number;
}

function rectOf(el: HTMLElement | null): DOMRect | null {
  if (!el || !el.isConnected || typeof el.getBoundingClientRect !== 'function') return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return r;
}

function pointOf(playerId: string | null): Point | null {
  if (!playerId) return null;
  const r = rectOf(seats.get(playerId) ?? null);
  return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
}

/**
 * A registered seat's centre in viewport px, or null when that seat is not on
 * screen — a spectator's own seat, a seat that has unmounted, or one whose box
 * measures zero because an ancestor is `display: none`.
 *
 * NULL IS THE WHOLE POINT OF EXPORTING THIS. Flights are measured against it,
 * and flip.ts's guard says why a zero rect must never be treated as a
 * position: a card told to fly from (0, 0) flies from the top-left corner of
 * the viewport, which is the classic way an animation ends up looking like a
 * bug in the layout. Callers fall back to a centred, geography-free treatment.
 */
export function fxSeatPoint(playerId: string | null): Point | null {
  return pointOf(playerId);
}

/**
 * The deck pile's centre, or null when the deck is not a visible object.
 *
 * THIS IS A QUERY AND THAT IS A COMPROMISE. Seats push themselves into the map
 * above via a ref callback; the deck does not, because `DeckPile` in
 * GameTable.tsx renders inside `.felt-centre`, which is `display: none` below
 * 1024px (globals.css) — there is no deck OBJECT on a phone, only the count in
 * the header. A registry entry that is absent on every phone and present on
 * every desktop is a registry entry whose absence means "wrong breakpoint"
 * rather than "not mounted", so it is read the same way it renders: measure
 * it, and if it measures nothing there is nothing to fly from.
 *
 * The class is the contract. When GameTable is next editable, a
 * `registerFxDeck` ref callback should replace this and the selector should
 * go with it.
 */
const DECK_SELECTOR = '.deck-well';

export function fxDeckPoint(): Point | null {
  if (typeof document === 'undefined') return null;
  const r = rectOf(document.querySelector(DECK_SELECTOR) as HTMLElement | null);
  return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
}

/* ── the snapshot ───────────────────────────────────────────────────────── */

export interface FxPlayerSnap {
  readonly id: string;
  readonly name: string;
  readonly coins: number;
  /** How many of this player's influences are face-up. Only ever goes up. */
  readonly revealed: number;
  readonly alive: boolean;
}

export interface FxSnapshot {
  readonly present: boolean;
  readonly myId: string | null;
  readonly myName: string | null;
  readonly players: readonly FxPlayerSnap[];
  /** Identity of the pending action, so a re-broadcast is not a new event. */
  readonly pendingKey: string | null;
  readonly pendingType: ActionType | null;
  readonly pendingActorId: string | null;
  readonly pendingTargetId: string | null;
  /** Identity of the pending block, same reason. */
  readonly blockKey: string | null;
  readonly blockerId: string | null;
  /** The action the pending block is aimed at. */
  readonly blockedType: ActionType | null;
  /** Who is exchanging right now, or null. Public — not the private hand. */
  readonly exchangeActorId: string | null;
  readonly reveal: ChallengeRevealEvent | null;
  readonly winnerId: string | null;
  readonly error: string | null;
}

const EMPTY_SNAPSHOT: FxSnapshot = {
  present: false,
  myId: null,
  myName: null,
  players: [],
  pendingKey: null,
  pendingType: null,
  pendingActorId: null,
  pendingTargetId: null,
  blockKey: null,
  blockerId: null,
  blockedType: null,
  exchangeActorId: null,
  reveal: null,
  winnerId: null,
  error: null,
};

export function fxSnapshot(
  gs: ClientGameState | null,
  reveal: ChallengeRevealEvent | null,
  error: string | null,
): FxSnapshot {
  if (!gs) return { ...EMPTY_SNAPSHOT, reveal, error };

  const me = gs.players.find((p) => p.id === gs.myId);
  const pa = gs.pendingAction;
  const pb = gs.pendingBlock;

  return {
    present: true,
    myId: gs.myId,
    myName: me?.name ?? null,
    players: gs.players.map((p) => ({
      id: p.id,
      name: p.name,
      coins: p.coins,
      revealed: p.influences.filter((i) => i.revealed).length,
      alive: p.isAlive,
    })),
    pendingKey: pa ? `${gs.turnNumber}|${pa.type}|${pa.actorId}|${pa.targetId ?? ''}` : null,
    pendingType: pa?.type ?? null,
    pendingActorId: pa?.actorId ?? null,
    pendingTargetId: pa?.targetId ?? null,
    blockKey: pb ? `${gs.turnNumber}|${pb.blockerId}|${pa?.type ?? ''}` : null,
    blockerId: pb?.blockerId ?? null,
    blockedType: pb ? (pa?.type ?? null) : null,
    // The private `exchangeState` is only sent to the exchanging player, so it
    // cannot tell a bystander that somebody else finished. The phase plus the
    // public pending action can, and it is the same fact.
    exchangeActorId:
      gs.turnPhase === TurnPhase.AwaitingExchange
        ? (pa?.actorId ?? gs.players[gs.currentPlayerIndex]?.id ?? null)
        : null,
    reveal,
    winnerId: gs.winnerId,
    error,
  };
}

/* ── the diff ───────────────────────────────────────────────────────────── */

export interface FxCueCall {
  readonly event: FxEvent;
  readonly condition: FxCondition;
  /** Whose seat is the epicentre. `null` = the centre of the viewport. */
  readonly at: string | null;
  /** Signed, for `coins_changed`. */
  readonly amount?: number;
  /**
   * An explicit epicentre in viewport px, for a beat that did not happen at a
   * seat. Wins over `at`, which is why both can be present: a challenge reveal
   * lands in the MIDDLE of the table but is still the accused player's card, so
   * `at` stays set for anything that wants to know whose it was.
   */
  readonly x?: number;
  readonly y?: number;
  /**
   * The travel vector of the flight that produced this cue, in px.
   *
   * `card_landed / mine` throws a 2.0rad spark fan ALONG the travel, and
   * fx/index.ts only uses it when `dx² + dy² > 144` — a fan thrown along a zero
   * vector is a fan pointing right, which reads as a wind rather than an
   * impact, so it falls back to omnidirectional. Nothing passed one of these
   * until flights owned real geography, so every landing spark in the app was
   * the fallback. Only a real flight may fill this in: a state diff knows a
   * card arrived but not from where, and inventing a direction there would be
   * worse than the fallback it replaced.
   */
  readonly dx?: number;
  readonly dy?: number;
}

/**
 * Everything the tuning table names, in the order the beats read.
 *
 *   coup_landed          a Coup declaration appears           against_me / mine / theirs
 *   assassinate_blocked  a block lands on an Assassinate      against_me / mine / theirs
 *   challenge_won        a reveal resolves, winner's seat     mine / theirs
 *   challenge_lost       ...and the loser's                   against_me / theirs
 *   card_landed          an influence flips face-up           mine / theirs
 *   influence_lost       the same flip, as a loss             mine / theirs
 *   card_landed          an exchange closes                   mine / theirs
 *   coins_changed        your coin total moved                mine only (see below)
 *   player_eliminated    a seat goes out                      mine / theirs
 *   game_over            a winner appears                     mine / theirs
 *   denied               the server refused something of yours mine
 */
export function fxDiffCues(prev: FxSnapshot, curr: FxSnapshot): FxCueCall[] {
  const out: FxCueCall[] = [];
  const myId = curr.myId;

  // A refusal is always yours, and it is not a table event — emit it whether or
  // not there is a game in progress.
  if (curr.error !== null && curr.error !== prev.error) {
    out.push({ event: 'denied', condition: 'mine', at: myId });
  }

  if (!curr.present || !prev.present || !myId) return out;

  const prevById = new Map(prev.players.map((p) => [p.id, p]));
  const idByName = (name: string): string | null =>
    curr.players.find((p) => p.name === name)?.id ?? null;

  // ─── A Coup was declared ───
  // Coup is unblockable and unchallengeable, so its declaration IS its landing.
  if (curr.pendingKey && curr.pendingKey !== prev.pendingKey && curr.pendingType === ActionType.Coup) {
    const condition: FxCondition =
      curr.pendingTargetId === myId ? 'against_me' : curr.pendingActorId === myId ? 'mine' : 'theirs';
    out.push({ event: 'coup_landed', condition, at: curr.pendingTargetId });
  }

  // ─── A knife met a Contessa ───
  // `against_me` is the ASSASSIN: a block is done to the actor. The blocker gets
  // `mine`, which falls through to the same loud row — both parties to a
  // collision feel it, and the row is colourless because nobody bled.
  if (
    curr.blockKey &&
    curr.blockKey !== prev.blockKey &&
    curr.blockedType === ActionType.Assassinate
  ) {
    const condition: FxCondition =
      curr.pendingActorId === myId ? 'against_me' : curr.blockerId === myId ? 'mine' : 'theirs';
    out.push({ event: 'assassinate_blocked', condition, at: curr.blockerId });
  }

  // ─── A challenge resolved ───
  // ChallengeRevealEvent carries NAMES, not ids, so the local player is matched
  // by name; `wasGenuine` decides which side lost. Safe because names are unique
  // per room: RoomManager rejects a join whose name case-insensitively matches a
  // seated player (RoomManager.ts:83, :111). That invariant is what this rests
  // on — if it is ever relaxed, this needs challengerId/challengedId on the
  // event instead. Identical reasoning to useHapticFeedback.ts.
  if (curr.reveal && curr.reveal !== prev.reveal) {
    const r = curr.reveal;
    // wasGenuine = the challenged player held the card, so the challenger lost.
    const loserId = idByName(r.wasGenuine ? r.challengerName : r.challengedName);
    const winnerId = idByName(r.wasGenuine ? r.challengedName : r.challengerName);
    out.push({
      event: 'challenge_won',
      condition: winnerId === myId ? 'mine' : 'theirs',
      at: winnerId,
    });
    out.push({
      event: 'challenge_lost',
      condition: loserId === myId ? 'against_me' : 'theirs',
      at: loserId,
    });
  }

  // ─── An influence flipped face-up ───
  // The card arrives (card_landed) and then it is gone (influence_lost). Two
  // events for one flip is deliberate: the first is physical, the second is the
  // consequence, and the tuning table gives them different material.
  for (const p of curr.players) {
    const before = prevById.get(p.id);
    if (!before || p.revealed <= before.revealed) continue;
    const condition: FxCondition = p.id === myId ? 'mine' : 'theirs';
    out.push({ event: 'card_landed', condition, at: p.id });
    out.push({ event: 'influence_lost', condition, at: p.id });
  }

  // ─── An exchange closed ───
  // The only landing the DIFF is allowed to claim beyond the influence flip
  // above. Real landings — a card that measurably flew from one box to another
  // — are cued by the flight's own `land` callback through `emitFxCue`, with a
  // travel vector attached. Everything else stays unclaimed: inventing landings
  // makes the felt glitter permanently, which is what tuning.ts's rule 1
  // forbids.
  if (prev.exchangeActorId && !curr.exchangeActorId) {
    out.push({
      event: 'card_landed',
      condition: prev.exchangeActorId === myId ? 'mine' : 'theirs',
      at: prev.exchangeActorId,
    });
  }

  // ─── Coins ───
  // Only the local total is diffed, and that is the whole rule: `coins_changed /
  // theirs` is an EMPTY row on purpose — six players taking Income is six floats
  // a turn, which is a scoreboard, not a game. Firing it would be six no-op
  // cues and six lines of cue log saying nothing.
  const meNow = curr.players.find((p) => p.id === myId);
  const meBefore = prevById.get(myId);
  if (meNow && meBefore && meNow.coins !== meBefore.coins) {
    out.push({
      event: 'coins_changed',
      condition: 'mine',
      at: myId,
      amount: meNow.coins - meBefore.coins,
    });
  }

  // ─── A seat went out ───
  for (const p of curr.players) {
    const before = prevById.get(p.id);
    if (!before || !before.alive || p.alive) continue;
    out.push({
      event: 'player_eliminated',
      condition: p.id === myId ? 'mine' : 'theirs',
      at: p.id,
    });
  }

  // ─── The game turned ───
  if (curr.winnerId && !prev.winnerId) {
    out.push({
      event: 'game_over',
      condition: curr.winnerId === myId ? 'mine' : 'theirs',
      at: curr.winnerId,
    });
  }

  return out;
}

/* ── the driver ─────────────────────────────────────────────────────────── */

export type FxCueSink = (call: FxCueCall) => void;

/** The default sink: resolve the epicentre, then hand the numbers to fx/. */
export function emitFxCue(call: FxCueCall): void {
  const opts: CueOptions = { condition: call.condition };
  // An explicit point beats a seat lookup: the caller measured, and it measured
  // where the thing actually happened.
  if (call.x !== undefined && call.y !== undefined) {
    opts.x = call.x;
    opts.y = call.y;
  } else {
    const p = pointOf(call.at);
    if (p) {
      opts.x = p.x;
      opts.y = p.y;
    }
  }
  if (call.amount !== undefined) opts.amount = call.amount;
  if (call.dx !== undefined) opts.dx = call.dx;
  if (call.dy !== undefined) opts.dy = call.dy;
  fx.cue(call.event, opts);
}

export interface FxCueDriver {
  push(
    gs: ClientGameState | null,
    reveal: ChallengeRevealEvent | null,
    error: string | null,
  ): void;
}

/**
 * Holds the previous snapshot and the first-render skip.
 *
 * The skip is why a player rejoining mid-game does not get a burst of
 * retroactive effects: the first state they receive already contains three
 * revealed influences and two dead players, and every one of those would
 * otherwise diff against nothing and fire.
 */
export function createFxCueDriver(emit: FxCueSink = emitFxCue): FxCueDriver {
  let prev: FxSnapshot | null = null;
  return {
    push(gs, reveal, error): void {
      const curr = fxSnapshot(gs, reveal, error);
      const before = prev;
      prev = curr;
      if (before === null) return;
      const calls = fxDiffCues(before, curr);
      for (let i = 0; i < calls.length; i++) emit(calls[i]);
    },
  };
}

/* ── the hook ───────────────────────────────────────────────────────────── */

export function useFxCues(): void {
  const gameState = useGameStore((s) => s.gameState);
  const challengeReveal = useGameStore((s) => s.challengeReveal);
  const error = useGameStore((s) => s.error);
  const reducedMotionEnabled = useSettingsStore((s) => s.reducedMotionEnabled);

  const driverRef = useRef<FxCueDriver | null>(null);
  if (driverRef.current === null) driverRef.current = createFxCueDriver();

  // The band is a function, not a rect: it is evaluated per spawn, so it stays
  // correct across a rotation, a keyboard opening, or a prompt changing height.
  useEffect(() => {
    fx.setBand(readFxBand);
    return () => {
      fx.setBand(null);
    };
  }, []);

  // ART-DIRECTION §7. Two sources, same as the rest of the app: the in-app
  // toggle (which also writes `html.reduce-motion`) and the OS preference,
  // live — a player who flips the system setting mid-game must not have to
  // reload to be believed.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      fx.setReducedMotion(reducedMotionEnabled);
      return;
    }
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = (): void => {
      fx.setReducedMotion(reducedMotionEnabled || mq.matches);
    };
    apply();
    mq.addEventListener('change', apply);
    return () => {
      mq.removeEventListener('change', apply);
    };
  }, [reducedMotionEnabled]);

  useEffect(() => {
    driverRef.current?.push(gameState, challengeReveal, error);
  }, [gameState, challengeReveal, error]);

  // The game-over overlay owns its moment: confetti falls in front of it, a
  // coin delta across it is noise.
  const finished = gameState?.winnerId != null;
  useEffect(() => {
    fx.setFloatersSuppressed(finished);
    return () => {
      fx.setFloatersSuppressed(false);
    };
  }, [finished]);
}
