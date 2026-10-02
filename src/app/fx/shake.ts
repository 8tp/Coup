/**
 * fx/shake.ts — trauma-model screen shake.
 *
 * ── THE MODEL ─────────────────────────────────────────────────────────────
 *
 * `trauma ∈ [0, CAP]`, decaying linearly at `DECAY`/s. Displacement is
 * **trauma²**, so a small trauma is genuinely small — that is the entire
 * difference between juice and nausea. The squared curve is also what makes the
 * small values honestly small: the 0.16 a card landing adds is 0.38px, i.e.
 * almost nothing, which is correct — it is there so that a run of landings is
 * felt and one is not.
 *
 * Three DECORRELATED value-noise channels — x, y, rotation. The phase offsets
 * `+0 / +31.3 / +77.1` are load-bearing: equal seeds put x and y on the same
 * line and the shake reads as a single diagonal slider being dragged rather
 * than as a table taking a hit.
 *
 * ── THE PERCEPTUAL FLOOR ──────────────────────────────────────────────────
 *
 * `tick()` quantises the write to 0.1px, so a trauma whose peak displacement is
 * under ~0.3px is three quantisation steps of nothing: it holds a transform and
 * a stacking context, runs the clock, and cannot be seen. chudopoly measured
 * SIX of its ten shake triggers below that line — dead code that still held a
 * transform. `sqrt(0.30/15) = 0.141`; anything under it is REFUSED here rather
 * than silently rendered as stillness, so "this shake does nothing" is a fact
 * the call site has to deal with instead of a comment claiming it is deliberate.
 *
 * Stacking is the one honest exception: if something is already shaking, a
 * sub-floor contribution really does add, so it is allowed through.
 *
 * ── THE TRANSFORM SUBSTRATE, AND ITS TWO HAZARDS ──────────────────────────
 *
 * The target is supplied by the caller — in Coup it must be the TABLE
 * container, not the viewport and not the whole game screen. The phase banner,
 * the action bar and your hand are siblings of the table; shaking them makes a
 * challenge prompt unreadable at the exact moment you have to answer it.
 *
 * Writing `transform` on an ancestor does two things that are easy to miss:
 *
 *   1. IT BECOMES THE CONTAINING BLOCK FOR `position: fixed` DESCENDANTS. A
 *      fixed modal inside the shake target stops being viewport-fixed and
 *      starts being target-fixed — and then shakes with it. Keep every fixed
 *      element (modals, toasts, this layer's own overlay root) OUTSIDE the
 *      target subtree.
 *
 *   2. IT CREATES A STACKING CONTEXT, which traps any descendant that was
 *      relying on a high `z-index` to escape its parent — a dragged or
 *      hero-lifted card, for instance.
 *
 * Both are avoided structurally rather than by care: the property is REMOVED
 * entirely (not set to `none`) the moment trauma reaches 0, so at rest the
 * stacking tree is identical to a build with no FX layer at all. The only
 * frames that have a stacking context are frames the table is visibly shaking
 * on. `transform: none` would NOT do this — a computed `none` still counts as
 * "has a transform" for the containing-block rule in some engines, and it keeps
 * the style property alive in the inline style attribute where a reader will
 * assume it means something.
 *
 * FLIP is unaffected as long as this stays translate+rotate with NO SCALE: a
 * measure → move → measure pair inside one synchronous task carries the same
 * shake offset in both rects and a translate delta cancels exactly. A scale
 * delta would not — it would scale the delta.
 */

import { hash1 } from '../anim/easing';

export const DECAY = 1.5;

/**
 * Cap 0.75, not 1.0. trauma² × MAX_X at the cap is 8.4px of translate and 0.62°
 * of rotation, and the cap is only reachable by STACKING — the single loudest
 * event on its own is the win at 0.60 → 5.4px.
 */
export const CAP = 0.75;

export const MAX_X = 15;
export const MAX_Y = 11;
export const MAX_R = 1.1;

/** Hz. Below ~18 it reads as a wobble, above ~34 as noise. */
export const FREQ = 26;

/** sqrt(0.30/15) — the write quantisation, expressed as trauma. */
export const MIN_TRAUMA = 0.141;

/** Routine landings must never out-shake the win. */
export const LAND_CEILING = 0.34;

/* ── the DOM surface ────────────────────────────────────────────────────── */

export interface ShakeStyle {
  setProperty(property: string, value: string): void;
  removeProperty(property: string): void;
}

export interface ShakeElement {
  readonly isConnected: boolean;
  readonly style: ShakeStyle;
}

/* ── state ──────────────────────────────────────────────────────────────── */

let trauma = 0;
let clock = 0;
let el: ShakeElement | null = null;
let written = false;
let wx = 0;
let wy = 0;
let wr = 0;
let reduced = false;

/** Smooth value noise in [0,1). Pure function of t — no allocation, no state. */
function noise1(t: number): number {
  const i = Math.floor(t);
  const f = t - i;
  const s = f * f * (3 - 2 * f);
  const a = hash1(i);
  const b = hash1(i + 1);
  return a + (b - a) * s;
}

/** ART-DIRECTION §7: motion collapses. Shake is pure motion, so it goes. */
export function setReduced(on: boolean): void {
  reduced = on;
  if (reduced) {
    trauma = 0;
    release();
  }
}

export function isReduced(): boolean {
  return reduced;
}

export function setTarget(node: ShakeElement | null): void {
  if (node === el) return;
  release();
  el = node;
}

export function target(): ShakeElement | null {
  return el;
}

/**
 * Add trauma.
 *
 * @param amount   from the tuning table
 * @param ceiling  clamp the RESULTING trauma. A caravan of landings capped at
 *                 `LAND_CEILING` cannot stack to the cap and out-shake the win.
 *                 The clamp can never LOWER trauma that is already higher —
 *                 a landing arriving during the win must not cut the win short.
 * @returns whether any trauma was actually added.
 */
export function add(amount: number, ceiling: number = CAP): boolean {
  if (reduced || !(amount > 0)) return false;
  if (amount < MIN_TRAUMA && trauma <= 0) return false;

  const limit = ceiling < CAP ? ceiling : CAP;
  let next = trauma + amount;
  if (next > limit) next = trauma > limit ? trauma : limit;
  if (next > CAP) next = CAP;
  if (next <= trauma) return false;
  trauma = next;
  return true;
}

export function active(): boolean {
  return trauma > 0.0005;
}

export function level(): number {
  return trauma;
}

function release(): void {
  if (el && written) {
    el.style.removeProperty('transform');
    el.style.removeProperty('will-change');
  }
  written = false;
  wx = 0;
  wy = 0;
  wr = 0;
}

/** @returns whether the shake is still live after this frame. */
export function tick(dt: number): boolean {
  if (trauma <= 0) {
    if (written) release();
    return false;
  }
  clock += dt;
  trauma -= DECAY * dt;
  if (trauma <= 0) {
    trauma = 0;
    release();
    return false;
  }

  const node = el;
  if (!node || !node.isConnected) return true;

  const tr = trauma * trauma;
  const t = clock * FREQ;
  const x = Math.round((noise1(t) * 2 - 1) * tr * MAX_X * 10) / 10;
  const y = Math.round((noise1(t + 31.3) * 2 - 1) * tr * MAX_Y * 10) / 10;
  const r = Math.round((noise1(t + 77.1) * 2 - 1) * tr * MAX_R * 100) / 100;

  if (x !== wx || y !== wy || r !== wr || !written) {
    wx = x;
    wy = y;
    wr = r;
    if (!written) {
      node.style.setProperty('will-change', 'transform');
      written = true;
    }
    node.style.setProperty('transform', `translate3d(${x}px,${y}px,0) rotate(${r}deg)`);
  }
  return true;
}

/** The last values written, for the tests and the demo harness. */
export function displacement(): { x: number; y: number; rot: number } {
  return { x: wx, y: wy, rot: wr };
}

export function hasTransform(): boolean {
  return written;
}

export function reset(): void {
  trauma = 0;
  clock = 0;
  release();
}
