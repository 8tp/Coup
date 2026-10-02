/**
 * fx/ — the impact layer. Coup had none of this: every dramatic beat resolved
 * as a text change.
 *
 * ── THE SEAM ──────────────────────────────────────────────────────────────
 *
 *   fx.mount(rootEl, shakeTargetEl)   where the overlay lives, what shakes
 *   fx.cue(event, opts)               fire one beat
 *   fx.setReducedMotion(bool)
 *   fx.reset()                        between games / on a rematch
 *   fx.stats()                        what is actually live right now
 *   fx.unmount()
 *
 * The whole cue → effect map is DATA in fx/tuning.ts, written before any of the
 * rendering code. This file is a switchboard: it resolves a cue to a row, hands
 * the row's emitter list to fx/emitters.ts, and pumps the clock. It contains no
 * tuning numbers, which is the point — the numbers are in one file where they
 * can be argued about.
 *
 * ── LAZY BY CONSTRUCTION ──────────────────────────────────────────────────
 *
 * Importing this module costs the module records and two arrays. There is no
 * canvas, no DOM node, no stylesheet, no resize listener, no clock subscriber
 * and no particle pool until the first cue fires, and all of it except the
 * overlay node comes back down when the last effect dies (fx/overlay.ts
 * explains the one exception and what `unmount()` does about it).
 *
 * `mount()` is a pure registration — it stores two element references and
 * builds nothing.
 *
 * ── PURITY ────────────────────────────────────────────────────────────────
 *
 * Nothing here imports a component, a store, or `src/shared`. The FX layer does
 * not know what a Duke is; it knows about `influence_lost` and whether it
 * happened to you. Wiring the game's events onto `cue()` is a separate layer.
 *
 * ── WHAT IS NOT HERE YET ──────────────────────────────────────────────────
 *
 * GAME-FEEL-PLAN §3.6's two-channel hold — holding a direction-less cue for one
 * synchronous task in case an event arrives to say who the victim was — belongs
 * with the game wiring, because only that layer has the event side. Until it
 * exists, `condition` defaults to `'theirs'`: an un-directed cue plays its
 * QUIET form. Failing quiet is the correct default for a layer whose first rule
 * is restraint.
 */

import { subscribe, unsubscribe } from '../anim/clock';
import { fireHaptic } from '../utils/haptic';
import * as emit from './emitters';
import * as flash from './flash';
import * as floaters from './floaters';
import * as overlay from './overlay';
import * as particles from './particles';
import * as shake from './shake';
import {
  FX_TABLE,
  LAND_CEILING,
  QUIET_TRAUMA_CEILING,
  rowFor,
  type FxCondition,
  type FxEmitter,
  type FxEvent,
  type FxFloatTone,
  type FxRow,
} from './tuning';
import type { FloatTone } from './floaters';

export {
  FX_EVENTS,
  FX_TABLE,
  LAND_CEILING,
  QUIET_TRAUMA_CEILING,
  rowFor,
  rowsFor,
  type FxCondition,
  type FxEvent,
  type FxRow,
  type LoudRow,
  type QuietRow,
} from './tuning';

export interface CueOptions {
  /** Default `'theirs'` — see the header. An un-directed cue plays quiet. */
  condition?: FxCondition;
  /** Epicentre in viewport px. Defaults to the centre of the viewport. */
  x?: number;
  y?: number;
  /** Travel vector, for the rows whose spray is thrown along the motion. */
  dx?: number;
  dy?: number;
  /** Text for a float row whose `text` is `null`. */
  text?: string;
  /** Signed magnitude, for `coins_changed`: picks the tone and the default text. */
  amount?: number;
}

export interface FxStats {
  particles: number;
  peak: number;
  dropped: number;
  cap: number;
  floats: number;
  trauma: number;
  flash: boolean;
  cues: number;
  reduced: boolean;
  pumping: boolean;
  mounted: boolean;
}

/* ── the cue log (GAME-FEEL-PLAN §7 gate) ───────────────────────────────── */

export interface CueRecord {
  event: FxEvent;
  condition: FxCondition;
  matched: boolean;
  t: number;
}

const CUE_LOG_CAP = 400;
const cueLog: CueRecord[] = [];

export function log(): readonly CueRecord[] {
  return cueLog;
}

/* ── state ──────────────────────────────────────────────────────────────── */

let reduced = false;
let pumping = false;
let painted = false;
let mounted = false;
let secondFall: ReturnType<typeof setTimeout> | null = null;

/* ── mount ──────────────────────────────────────────────────────────────── */

/**
 * Register where the overlay is appended and what takes the shake.
 *
 * `shakeTargetEl` must be the TABLE container — not the viewport, not the whole
 * game screen. fx/shake.ts explains why, and the two hazards of putting a
 * transform on an ancestor.
 *
 * Builds nothing. The first cue builds everything.
 */
export function mount(rootEl: HTMLElement | null, shakeTargetEl: shake.ShakeElement | null): void {
  overlay.setHost(rootEl);
  shake.setTarget(shakeTargetEl);
  mounted = true;
}

export function unmount(): void {
  reset();
  shake.setTarget(null);
  floaters.setHost(null);
  floaters.destroy();
  overlay.setHost(null);
  overlay.destroy();
  mounted = false;
}

export function isMounted(): boolean {
  return mounted;
}

/* ── reduced motion (ART-DIRECTION §7) ──────────────────────────────────── */

/**
 * Motion collapses; information does not.
 *
 *   particles — off. Pure decoration.
 *   shake     — off. Pure motion, and the one effect that can make a reader ill.
 *   flash     — STAYS, at 55% strength and 1.6× duration. Opacity-only, so it
 *               reads as a light coming up rather than a hit, and it is the only
 *               non-auditory signal that a Coup landed on you.
 *   floaters  — text stays, the 46px rise goes. The word is the information.
 *   haptics   — stay. A haptic is not motion.
 */
export function setReducedMotion(on: boolean): void {
  if (reduced === on) return;
  reduced = on;
  shake.setReduced(on);
  flash.setReduced(on);
  floaters.setReduced(on);
  if (on) particles.clear();
}

export function isReducedMotion(): boolean {
  return reduced;
}

/* ── the clock pump ─────────────────────────────────────────────────────── */

function busy(): boolean {
  return particles.count() > 0 || painted || shake.active() || flash.active() || floaters.active();
}

/**
 * `overlay.setActive(true)` is OUTSIDE the `pumping` guard on purpose. Inside
 * it, a `reset()` that hides the overlay without dropping the subscription
 * leaves the next cue finding `pumping === true`, returning early, and painting
 * a full confetti cannon into a `display:none` canvas. Showing is idempotent
 * and costs a class-list compare.
 */
function pump(): void {
  if (overlay.ensure()) {
    overlay.setActive(true);
    installFloaterHost();
  }
  if (pumping) return;
  pumping = true;
  subscribe(tick);
}

function tick(dt: number): void {
  const g = overlay.ctx();
  const anyParticles = particles.count() > 0;
  if (g && (anyParticles || painted)) {
    overlay.clear();
    particles.update(dt);
    particles.draw(g, overlay.scale());
    painted = particles.count() > 0;
  } else if (anyParticles) {
    // Headless (SSR, tests, or a cue before the canvas exists): still integrate,
    // so the pool drains and the pump stops instead of wedging on.
    particles.update(dt);
  }
  shake.tick(dt);
  flash.tick(dt);
  floaters.tick(dt);

  if (!busy()) {
    pumping = false;
    unsubscribe(tick);
    overlay.setActive(false);
  }
}

/* ── the DOM floater host ───────────────────────────────────────────────── */

let hostInstalled = false;

function installFloaterHost(): void {
  if (hostInstalled) return;
  const layer = overlay.floatEl();
  if (!layer) return;
  hostInstalled = true;
  floaters.setHost({
    create(): floaters.FloaterNode {
      const node = document.createElement('div');
      node.className = 'fx-text';
      layer.appendChild(node);
      return {
        get offsetWidth(): number {
          return node.offsetWidth;
        },
        get textContent(): string | null {
          return node.textContent;
        },
        set textContent(v: string | null) {
          node.textContent = v;
        },
        style: node.style,
        setShout(on: boolean): void {
          node.classList.toggle('is-shout', on);
        },
      };
    },
  });
}

/* ── cue ────────────────────────────────────────────────────────────────── */

function centreX(): number {
  const w = overlay.width();
  return w > 0 ? w / 2 : 0;
}

function centreY(): number {
  const h = overlay.height();
  return h > 0 ? h / 2 : 0;
}

function floatTone(tone: FxFloatTone, amount: number): FloatTone {
  if (tone !== 'signed') return tone;
  return amount < 0 ? 'crimson' : 'brass';
}

function floatText(spec: string | null, opts: CueOptions): string {
  if (spec !== null) return spec;
  if (opts.text) return opts.text;
  const a = opts.amount ?? 0;
  return a > 0 ? `+${a}` : String(a);
}

/**
 * Fire one beat.
 *
 * @returns whether the cue matched a row. A `false` is not an error — it is the
 *          table saying this combination gets nothing (see `rowFor`).
 */
export function cue(event: FxEvent, opts: CueOptions = EMPTY): boolean {
  const condition = opts.condition ?? 'theirs';
  const row = rowFor(event, condition);

  cueLog.push({ event, condition, matched: row !== null, t: Math.round(nowMs()) });
  if (cueLog.length > CUE_LOG_CAP) cueLog.shift();

  if (!row) return false;

  const x = opts.x ?? centreX();
  const y = opts.y ?? centreY();

  // Build the substrate BEFORE dispatching to any channel.
  //
  // This used to sit at the end of the function, and it cost the first float of
  // every session: `pump()` is what calls `installFloaterHost()`, so
  // `floaters.spawn()` below ran against a host that did not exist yet and the
  // node was created headless and never rendered. Every subsequent float was
  // fine, which is exactly why it survived unit tests and only showed up when
  // somebody watched a real game's opening beat.
  //
  // Laziness is unaffected: the `!row` early-return above is what keeps an
  // unmatched cue from building anything, not the position of this call.
  pump();

  if (!reduced) {
    for (let i = 0; i < row.particles.length; i++) {
      throwEmitter(row.particles[i], x, y, opts);
    }
    if (row.trauma > 0) {
      shake.add(row.trauma, row.traumaCeiling ?? shake.CAP);
    }
  }

  if (row.flash) {
    flash.fire(row.flash.strength, row.flash.tone, row.flash.durationMs, x, y);
  }

  if (row.float) {
    floaters.spawn(
      floatText(row.float.text, opts),
      x,
      y,
      floatTone(row.float.tone, opts.amount ?? 0),
      row.float.scale,
    );
  }

  // Haptics are not motion and survive §7 untouched. `fireHaptic` owns the
  // priority-aware 300ms floor — this layer must not second-guess it.
  if (row.haptic) fireHaptic(row.haptic);

  return true;
}

const EMPTY: CueOptions = Object.freeze({});

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function throwEmitter(e: FxEmitter, x: number, y: number, opts: CueOptions): void {
  switch (e.emit) {
    case 'sparks': {
      const dx = opts.dx ?? 0;
      const dy = opts.dy ?? 0;
      // Directional only when the card actually travelled. A 2.0rad fan thrown
      // along a zero vector is a fan pointing right, which reads as a wind.
      const travelled = dx * dx + dy * dy > 144;
      emit.sparks(x, y, e.count, e.color, {
        speed: e.speed,
        life: e.life,
        size: e.size,
        grav: e.grav,
        alpha: e.alpha,
        spread: e.directional && travelled ? e.spread : undefined,
        dir: e.directional && travelled ? Math.atan2(dy, dx) : undefined,
      });
      return;
    }
    case 'ring':
      emit.ring(x, y, e.from, e.to, e.color, e.life, e.lineWidth, e.alpha);
      return;
    case 'flare':
      emit.flare(x, y, e.size, e.color, e.life, e.alpha);
      return;
    case 'puff':
      emit.puff(x, y, e.count, e.color, e.life, e.from, e.to, e.alpha);
      return;
    case 'cross':
      emit.sparkCross(x, y, e.perArm, e.color, e.speed, e.size, e.life, e.alpha);
      return;
    case 'confetti': {
      const w = overlay.width() || 1;
      const h = overlay.height() || 1;
      emit.confetti(w, h, e.count, e.life);
      if (e.delayMs && e.delayMs > 0) armSecondFall(e.delayMs, Math.round(e.count * 0.34), e.life);
      return;
    }
    case 'settle': {
      const w = overlay.width() || 1;
      const h = overlay.height() || 1;
      emit.settle(w, h, e.count, e.color);
      return;
    }
  }
}

/**
 * A lighter second wave after the win, so the celebration overlaps the
 * game-over overlay's own entrance instead of ending underneath it. Cleared by
 * `reset()` — a rematch started inside the window must not rain on the new deal.
 */
function armSecondFall(delayMs: number, count: number, life: number): void {
  if (secondFall !== null) clearTimeout(secondFall);
  secondFall = setTimeout(() => {
    secondFall = null;
    if (reduced) return;
    if (!overlay.ensure()) return;
    emit.confetti(overlay.width() || 1, overlay.height() || 1, count, life * 0.9);
    pump();
  }, delayMs);
}

/* ── lifecycle ──────────────────────────────────────────────────────────── */

export function stats(): FxStats {
  return {
    particles: particles.count(),
    peak: particles.peakCount(),
    dropped: particles.droppedCount(),
    cap: particles.CAP,
    floats: floaters.count(),
    trauma: shake.level(),
    flash: flash.active(),
    cues: cueLog.length,
    reduced,
    pumping,
    mounted,
  };
}

/** Between games, on a rematch, on a route change. Keeps the mount. */
export function reset(): void {
  if (secondFall !== null) {
    clearTimeout(secondFall);
    secondFall = null;
  }
  particles.reset();
  floaters.reset();
  shake.reset();
  flash.reset();
  painted = false;
  cueLog.length = 0;
  if (pumping) {
    pumping = false;
    unsubscribe(tick);
  }
  overlay.clear();
  overlay.setActive(false);
}

/** Suppress floating text — the game-over overlay owns its moment. */
export const setFloatersSuppressed = floaters.setSuppressed;

export type { FloatTone } from './floaters';
export type { FxEmitter, FxFlash, FxFloatSpec, FxTone, QuietTone } from './tuning';
export { COL, HEX, type ColorIndex } from './palette';
export { CAP as PARTICLE_CAP, DPR_CAP } from './particles';
export { MIN_TRAUMA, MAX_X, MAX_Y, MAX_R, FREQ, DECAY } from './shake';
export { RISE, LIFE, STACK_X, STACK_Y, HOLD_UNTIL } from './floaters';

/** Namespaced default, so a call site reads `fx.cue(...)`. */
const fx = {
  mount,
  unmount,
  isMounted,
  cue,
  reset,
  stats,
  log,
  setReducedMotion,
  isReducedMotion,
  setFloatersSuppressed,
  setBand: floaters.setBand,
};

export default fx;
export { fx };

/** Re-exported for the tuning tests, which assert on the table's shape. */
export const TABLE_SIZE = FX_TABLE.length;
