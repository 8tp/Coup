/**
 * anim/flight.ts — the one card-motion engine (ART-DIRECTION §6, §7).
 *
 * Every element that moves on this table is a record in `live`, stepped by ONE
 * `anim/clock` subscriber. No CSS transition and no WAAPI animation touches an
 * element while it is flying, for two reasons: a second timeline is a second
 * clock, and a flight has to be interruptible at any frame — a card can be
 * re-flown by a state reconcile while it is still landing, and the new flight
 * must start from where the old one actually got to, not from where CSS thinks
 * it is.
 *
 * ── THE TRANSFORM CONTRACT ────────────────────────────────────────────────
 *
 *     transform: translate(var(--fx), var(--fy)) rotate(var(--tilt)) scale(var(--fs));
 *
 * This module is the ONLY writer of those four custom properties. Translate
 * outermost is load-bearing: adding `dx` to `--fx` moves the element's centroid
 * by exactly `dx` whatever the tilt or the scale, which is what makes the
 * measured FLIP in flip.ts exact rather than approximately exact. Put rotate or
 * scale outside the translate and a measured invert lands short by
 * `dx·(1−cos θ)` and `dx·(1−s)`, which is how cards end up "almost" on their
 * slot and drifting further off with every hop.
 *
 * ── REST POSES ────────────────────────────────────────────────────────────
 *
 * Each element carries a resting pose (x, y, rotation). A discard rests tilted;
 * a hand card rests fanned. Flights land ON the rest pose, never on zero, so a
 * fan and a flight compose instead of fighting. `setRest()` during a flight
 * retargets it in place — the card lands on the NEW pose rather than landing on
 * the old one and then jumping.
 *
 * REACT DIFFERENCE. chudopoly hangs the rest pose off the DOM node as `__rx`
 * expandos, because its card nodes are persistent for the life of the game.
 * React remounts, so a node is not a stable identity and an expando would
 * outlive nothing useful. The poses live in a `WeakMap` here: a remounted node
 * is simply a node with no rest pose (0,0,0), which is the correct default, and
 * an unmounted one is collected.
 *
 * ── ALLOCATION ────────────────────────────────────────────────────────────
 *
 * Records are pooled; the live list is compacted by swap-remove (`splice`
 * returns an array — that is a per-frame allocation). The only per-frame
 * allocation left is the string a custom-property write demands, and those are
 * guarded on the QUANTISED value: 0.1px, 0.1deg, 0.001 scale. A settled element
 * costs 0 writes per frame; a moving one costs at most 4.
 *
 * ── EVERY STARTED FLIGHT RESOLVES ─────────────────────────────────────────
 *
 * A flight ends in exactly one of two callbacks: `land` or `abort`. Never both,
 * never neither. chudopoly measured 173 slide cues against 159 landing cues over
 * a seeded game — 14 swishes that begin and are never answered, because the card
 * was superseded mid-air and its record was dropped silently. A sound with no
 * consequence is the definition of noise.
 */

import { subscribe, unsubscribe } from './clock';
import { BACK, SCALE_BACK, clamp01, easeOutBack, hash1, hashKey } from './easing';

/* ── the DOM surface this module needs ───────────────────────────────────
   Structural, not `HTMLElement`, for two reasons: it documents exactly how
   little of the DOM the engine touches, and it lets the engine be tested in
   vitest's node environment without a jsdom. A real `HTMLElement` satisfies it. */

export interface FlightStyle {
  setProperty(property: string, value: string): void;
  removeProperty(property: string): void;
  getPropertyValue(property: string): string;
}

export interface FlightElement {
  readonly isConnected: boolean;
  readonly style: FlightStyle;
}

export type LandCallback = (el: FlightElement) => void;
/** `started` is false when the flight was killed inside its delay — it never
 *  announced itself, so a caller wiring cues here can stay silent. */
export type AbortCallback = (el: FlightElement, started: boolean) => void;

/* ── constants ───────────────────────────────────────────────────────────── */

/** Duration comes from distance, clamped. §6's per-verb table lives inside it. */
export const MS_MIN = 180;
export const MS_MAX = 420;
export const MS_PER_PX = 0.42;

/**
 * A staggered event's LAST element must still be settled this long after the
 * event. Late members lose stagger, not duration: a caravan that bunches up
 * still reads; a caravan whose last card crawls does not.
 */
export const MAX_EVENT_MS = 600;

/* ── HITSTOP (ART-DIRECTION §6) ────────────────────────────────────────────
   "freeze the whole animation list for 45ms on contact, min 200ms between
   freezes, paid for at launch so the timing budget is untouched."

   CONTACT is where it fires: easeOutBack(p, BACK) crosses 1 at
       p = 1 − BACK/(1+BACK) = 1 − 0.9/1.9 = 0.5263
   — the exact frame the element's centroid reaches its destination. After it,
   the element is doing its 3% overshoot-and-return, which IS the settle.
   Freezing at p=1 instead is worthless: by then a solo landing has nothing left
   in the air to freeze, so the table is already still and the beat costs 45ms of
   nothing.

   The freeze stops the WHOLE live list, not just the landing element — that is
   the difference between a card pausing and the table taking a hit.

   The budget is not spent on it: an armed flight has HITSTOP_MS subtracted from
   its duration at launch, so contact arrives 45ms early, the table holds for
   45ms, and total wall time is exactly what it was before.

   MIN_GAP exists because a caravan is not five impacts. A 5-card exchange at
   70ms stagger would otherwise freeze the table five times for 225ms and read
   as jank; one hit per 200ms lets the FIRST card land heavy and the rest ride in
   behind it. */
export const HITSTOP_MS = 45;
export const HITSTOP_MIN_GAP_MS = 200;
/** A hop too short to pay for its own freeze would become a stutter with no travel. */
export const HITSTOP_FLOOR_MS = 90;
export const CONTACT = 1 - BACK / (1 + BACK);

/** §7: motion collapses to a fade of at most this long. Information does not collapse. */
export const REDUCED_FADE_MS = 120;

const K_FLY = 0;
const K_FADE = 1;

/* ── module state ────────────────────────────────────────────────────────── */

interface FlightRecord {
  kind: number;
  el: FlightElement | null;
  t: number;
  delay: number;
  dur: number;
  started: boolean;
  resolved: boolean;
  x0: number; y0: number; x1: number; y1: number;
  s0: number; s1: number;
  r0: number; r1: number;
  ax: number; ay: number;
  env: number;
  spin: number;
  bump: number;
  hit: boolean;
  hitDone: boolean;
  from: number; to: number;
  /** last written quantised values — the write guard */
  wx: number; wy: number; ws: number; wr: number; wo: number;
  land: LandCallback | null;
  abort: AbortCallback | null;
}

export interface RestPose {
  x: number;
  y: number;
  rot: number;
}

const pool: FlightRecord[] = [];
const live: FlightRecord[] = [];
const rests = new WeakMap<FlightElement, RestPose>();
/** One owner per channel, so a fade and a flight cannot evict each other. */
const flyOwner = new WeakMap<FlightElement, FlightRecord>();
const fadeOwner = new WeakMap<FlightElement, FlightRecord>();

let running = false;
let reducedMotion = false;
/** Seconds of table-freeze left. */
let freeze = 0;
/** Accumulated dt — the only time source in this file. */
let clockSec = 0;
let lastHit = -1e9;
let hitCount = 0;

/** How many hitstops have actually FROZEN the table since load. */
export function hitstopCount(): number {
  return hitCount;
}

export function liveCount(): number {
  return live.length;
}

export function isFlying(el: FlightElement | null | undefined): boolean {
  return !!el && flyOwner.has(el);
}

/**
 * §7. When on, every flight collapses to a ≤120ms opacity fade that fires its
 * landing callback in the SAME TICK — the ramp is cosmetic and is exactly what
 * the player asked to remove, so nothing informational may hang off its end.
 */
export function setReducedMotion(on: boolean): void {
  reducedMotion = on;
}

export function isReducedMotion(): boolean {
  return reducedMotion;
}

/* ── rest poses ──────────────────────────────────────────────────────────── */

const ZERO_REST: RestPose = { x: 0, y: 0, rot: 0 };

export function getRest(el: FlightElement | null | undefined): RestPose {
  if (!el) return ZERO_REST;
  return rests.get(el) ?? ZERO_REST;
}

/** Set the resting pose. An element already in the air is retargeted in place. */
export function setRest(el: FlightElement | null | undefined, x: number, y: number, rot = 0): void {
  if (!el) return;
  const prev = rests.get(el);
  if (prev) {
    prev.x = x;
    prev.y = y;
    prev.rot = rot;
  } else {
    rests.set(el, { x, y, rot });
  }
  const r = flyOwner.get(el);
  if (r && r.kind === K_FLY) {
    r.x1 = x;
    r.y1 = y;
    r.r1 = rot;
    return;
  }
  writeRest(el);
}

export function clearRest(el: FlightElement | null | undefined): void {
  if (el) rests.delete(el);
}

/** Write the resting pose now, with no animation. */
export function writeRest(el: FlightElement | null | undefined): void {
  if (!el) return;
  const rest = getRest(el);
  const s = el.style;
  s.setProperty('--fx', fmtPx(rest.x));
  s.setProperty('--fy', fmtPx(rest.y));
  s.setProperty('--tilt', fmtDeg(rest.rot));
  s.setProperty('--fs', '1');
}

/** Clear the contract's four properties entirely (element leaves the system). */
export function clearTransform(el: FlightElement | null | undefined): void {
  if (!el) return;
  const s = el.style;
  s.removeProperty('--fx');
  s.removeProperty('--fy');
  s.removeProperty('--tilt');
  s.removeProperty('--fs');
}

/* ── record lifecycle ────────────────────────────────────────────────────── */

function take(): FlightRecord {
  const r = pool.pop();
  if (r) return r;
  return {
    kind: K_FLY, el: null, t: 0, delay: 0, dur: 0.3, started: false, resolved: false,
    x0: 0, y0: 0, x1: 0, y1: 0, s0: 1, s1: 1, r0: 0, r1: 0,
    ax: 0, ay: 0, env: 1, spin: 0, bump: 0,
    hit: false, hitDone: false,
    from: 0, to: 1,
    wx: Number.NaN, wy: Number.NaN, ws: Number.NaN, wr: Number.NaN, wo: Number.NaN,
    land: null, abort: null,
  };
}

function recycle(r: FlightRecord): void {
  r.el = null;
  r.land = null;
  r.abort = null;
  r.started = false;
  r.resolved = false;
  r.bump = 0;
  r.spin = 0;
  r.ax = 0;
  r.ay = 0;
  r.env = 1;
  r.hit = false;
  r.hitDone = false;
  r.wx = r.wy = r.ws = r.wr = r.wo = Number.NaN;
  if (pool.length < 64) pool.push(r);
}

function ownerOf(kind: number): WeakMap<FlightElement, FlightRecord> {
  return kind === K_FADE ? fadeOwner : flyOwner;
}

function attach(r: FlightRecord): void {
  const el = r.el;
  if (!el) return;
  const owners = ownerOf(r.kind);
  const prev = owners.get(el);
  if (prev && prev !== r) drop(prev, false);
  owners.set(el, r);
  live.push(r);
  if (!running) {
    running = true;
    subscribe(tick);
  }
}

/** Remove from the live list. `applyEnd` finishes it; otherwise it aborts. */
function drop(r: FlightRecord, applyEnd: boolean): void {
  const i = live.indexOf(r);
  if (i >= 0) {
    live[i] = live[live.length - 1];
    live.pop();
  }
  release(r);
  if (applyEnd) finish(r);
  else abort(r);
  recycle(r);
}

/** Give the element's channel back, but only if this record still owns it. */
function release(r: FlightRecord): void {
  const el = r.el;
  if (!el) return;
  const owners = ownerOf(r.kind);
  if (owners.get(el) === r) owners.delete(el);
}

function abort(r: FlightRecord): void {
  if (r.resolved) return;
  r.resolved = true;
  const cb = r.abort;
  const el = r.el;
  r.abort = null;
  r.land = null;
  if (cb && el) cb(el, r.started);
}

function finish(r: FlightRecord): void {
  const el = r.el;
  if (!el) return;
  if (r.kind === K_FLY) {
    write(r, el, r.x1, r.y1, r.s1, r.r1);
  } else {
    // The fade is cosmetic; leave the element at full opacity with no inline
    // override, so a later CSS state is not fighting a stale `opacity: 1`.
    r.wo = Number.NaN;
    el.style.removeProperty('opacity');
  }
  if (r.resolved) return;
  r.resolved = true;
  const cb = r.land;
  r.land = null;
  r.abort = null;
  if (cb) cb(el);
}

/* ── the tick ────────────────────────────────────────────────────────────── */

function tick(dt: number): void {
  clockSec += dt;

  // THE FREEZE. Nothing advances — not r.t, not a delay countdown. Game-time
  // pacing lives on other clock subscribers and is deliberately NOT frozen: the
  // hitstop is presentation.
  if (freeze > 0) {
    freeze -= dt;
    if (freeze > 0) return;
    freeze = 0;
  }

  for (let i = live.length - 1; i >= 0; i--) {
    const r = live[i];
    const el = r.el;

    // A React node can unmount mid-flight. Writing to a detached node is work
    // nobody sees, and the flight must resolve as an abort, not a landing.
    if (!el || !el.isConnected) {
      live[i] = live[live.length - 1];
      live.pop();
      release(r);
      abort(r);
      recycle(r);
      continue;
    }

    r.t += dt;
    if (r.t < r.delay) continue;
    r.started = true;

    const p = r.dur > 0 ? clamp01((r.t - r.delay) / r.dur) : 1;
    step(r, el, p);

    if (p >= 1) {
      live[i] = live[live.length - 1];
      live.pop();
      release(r);
      finish(r);
      recycle(r);
    }
  }

  if (live.length === 0) {
    running = false;
    unsubscribe(tick);
  }
}

function step(r: FlightRecord, el: FlightElement, p: number): void {
  if (r.kind === K_FADE) {
    const o = Math.round((r.from + (r.to - r.from) * p) * 100) / 100;
    if (o !== r.wo) {
      r.wo = o;
      el.style.setProperty('opacity', String(o));
    }
    return;
  }

  const e = easeOutBack(p, BACK);
  // The arc rides a sin envelope, so it is exactly 0 at both ends and the
  // measured FLIP end state is untouched. `env !== 1` skews the peak earlier,
  // which is what makes a shove read as a hit instead of a wobble.
  const env = r.env === 1 ? Math.sin(Math.PI * p) : Math.sin(Math.PI * Math.pow(p, r.env));

  write(
    r,
    el,
    r.x0 + (r.x1 - r.x0) * e + r.ax * env,
    r.y0 + (r.y1 - r.y0) * e + r.ay * env,
    r.s0 + (r.s1 - r.s0) * easeOutBack(p, SCALE_BACK) + r.bump * env,
    r.r0 + (r.r1 - r.r0) * e + r.spin * env,
  );

  // CONTACT — the centroid is on its mark. Take the hit. The counter counts
  // FREEZES APPLIED, not contacts detected: gated on HITSTOP_MS > 0 so that
  // zeroing the duration zeroes the count. A counter that kept climbing while
  // the table never actually froze would wave that regression through.
  if (r.hit && !r.hitDone && p >= CONTACT) {
    r.hitDone = true;
    if (HITSTOP_MS > 0 && clockSec - lastHit >= HITSTOP_MIN_GAP_MS / 1000) {
      lastHit = clockSec;
      freeze = HITSTOP_MS / 1000;
      hitCount++;
    }
  }
}

/** Guarded, quantised writes — the whole hot path's DOM cost. */
function write(r: FlightRecord, el: FlightElement, x: number, y: number, s: number, rot: number): void {
  const s_ = el.style;
  const qx = Math.round(x * 10) / 10;
  if (qx !== r.wx) {
    r.wx = qx;
    s_.setProperty('--fx', qx + 'px');
  }
  const qy = Math.round(y * 10) / 10;
  if (qy !== r.wy) {
    r.wy = qy;
    s_.setProperty('--fy', qy + 'px');
  }
  const qs = Math.round(s * 1000) / 1000;
  if (qs !== r.ws) {
    r.ws = qs;
    s_.setProperty('--fs', qs === 1 ? '1' : String(qs));
  }
  const qr = Math.round(rot * 10) / 10;
  if (qr !== r.wr) {
    r.wr = qr;
    s_.setProperty('--tilt', qr + 'deg');
  }
}

function fmtPx(v: number): string {
  return (Math.round(v * 10) / 10) + 'px';
}

function fmtDeg(v: number): string {
  return (Math.round(v * 100) / 100) + 'deg';
}

/* ── duration ────────────────────────────────────────────────────────────── */

function clampMs(ms: number): number {
  return ms < MS_MIN ? MS_MIN : ms > MS_MAX ? MS_MAX : ms;
}

/**
 * Travel time for a distance, in ms.
 *
 * `speed` scales INSIDE the clamp. Outside it, a 1.12× steal on a long
 * cross-table flight measured 470ms and pushed the whole event past its 600ms
 * commitment; the deliberate feel of a steal is meant to come from its 120ms
 * hold, not from a slower card. Inside the clamp, `speed` is a nudge that can
 * never buy time the budget does not have.
 */
export function flightDuration(distancePx: number, speed = 1): number {
  return clampMs((MS_MIN + distancePx * MS_PER_PX) * speed);
}

/** Seconds of delay this record may have and still land inside the budget. */
function budgetDelay(ms: number, durSec: number): number {
  const room = MAX_EVENT_MS - durSec * 1000;
  const d = ms || 0;
  return (d < room ? d : Math.max(0, room)) / 1000;
}

/* ── public motion ───────────────────────────────────────────────────────── */

export interface FlyOptions {
  /** Where the element IS relative to where it belongs — the FLIP invert. */
  dx?: number;
  dy?: number;
  /** Starting scale relative to the rest scale of 1. */
  scale?: number;
  /** Explicit travel time in ms (§6's per-verb table). Still clamped. */
  dur?: number;
  /** Multiplies the duration INSIDE the clamp. */
  speed?: number;
  /** Hold at the launch pose this long first — a theft you can see coming. */
  delay?: number;
  /** Perpendicular lift in px. 0 for a straight slam. Default scales with distance. */
  arc?: number;
  /** Explicit bow, used only when `arc` is 0 or the travel is degenerate. */
  arcX?: number;
  arcY?: number;
  /** Degrees of spin ridden on the arc envelope (returns to the rest tilt). */
  spin?: number;
  /** Envelope skew. <1 peaks early: a lunge that recovers slowly. */
  env?: number;
  /** Extra scale at mid-flight (hero lift). Exactly 0 at both ends. */
  bump?: number;
  /** Start the rotation here instead of at the rest tilt. */
  tiltFrom?: number;
  /** Arm the hitstop. §6: a revealed influence, a Coup landing, a challenge resolving. */
  hit?: boolean;
  /** Seeds the deterministic arc side. Pass a stable card/player id. */
  key?: number | string;
  land?: LandCallback;
  abort?: AbortCallback;
}

/**
 * Launch an element from `dx,dy` (where it is) to its rest pose (where it
 * belongs). Returns false only if there was nothing to fly.
 */
export function fly(el: FlightElement | null | undefined, o: FlyOptions = {}): boolean {
  if (!el) return false;

  const rest = getRest(el);
  const rx = rest.x;
  const ry = rest.y;
  const rt = rest.rot;
  const dx = o.dx ?? 0;
  const dy = o.dy ?? 0;

  if (reducedMotion) return collapse(el, o);

  const dist = Math.sqrt(dx * dx + dy * dy);

  const r = take();
  r.kind = K_FLY;
  r.el = el;
  r.t = 0;
  r.hit = !!o.hit;
  r.hitDone = false;

  const ms = clampMs((o.dur ?? MS_MIN + dist * MS_PER_PX) * (o.speed ?? 1));
  // An armed flight pays for its own hitstop: contact lands HITSTOP_MS early,
  // the table then holds for HITSTOP_MS, and the budget is untouched.
  r.dur = (r.hit ? Math.max(HITSTOP_FLOOR_MS, ms - HITSTOP_MS) : ms) / 1000;
  r.delay = budgetDelay(o.delay ?? 0, r.dur);
  r.started = false;
  r.resolved = false;
  r.x0 = rx + dx;
  r.y0 = ry + dy;
  r.x1 = rx;
  r.y1 = ry;
  r.s0 = o.scale ?? 1;
  r.s1 = 1;
  r.r0 = o.tiltFrom ?? rt;
  r.r1 = rt;
  r.env = o.env ?? 1;
  r.spin = o.spin ?? 0;
  r.bump = o.bump ?? 0;
  r.land = o.land ?? null;
  r.abort = o.abort ?? null;
  r.wx = r.wy = r.ws = r.wr = Number.NaN;

  // ARC — a lift PERPENDICULAR to travel, biased upward so an element always
  // rises off the felt rather than sliding sideways through it. Travel is
  // (−dx, −dy); its normals are ±(dy, −dx)/dist and we take the upward one.
  // Straight-up travel has no upward normal, so the side is picked from a
  // deterministic hash of the caller's key and is therefore identical in every
  // screenshot run — no Math.random anywhere in this file.
  const arc = o.arc ?? Math.min(30, Math.max(5, dist * 0.14));
  if (arc !== 0 && dist > 0.5) {
    let px = dy / dist;
    let py = -dx / dist;
    if (py > 0.001) {
      px = -px;
      py = -py;
    } else if (Math.abs(py) <= 0.001) {
      const sign = hash1(hashKey(o.key) + 11) < 0.5 ? -1 : 1;
      px *= sign;
      py *= sign;
    }
    r.ax = px * arc;
    r.ay = py * arc;
  } else {
    r.ax = o.arcX ?? 0;
    r.ay = o.arcY ?? 0;
  }

  // Hold at the start of the path through any delay, so a staggered caravan
  // does not show its later members sitting at the destination first.
  write(r, el, r.x0, r.y0, r.s0, r.r0);
  attach(r);
  return true;
}

/**
 * A there-and-back shove with no net travel: §6's Refuse verb (the loser's card
 * shoved back) and Assassinate's 34% lunge. `env` peaks at ~35% so it lunges out
 * fast and recovers slowly — a symmetric sine reads as a wobble, not a hit.
 */
export function punch(
  el: FlightElement | null | undefined,
  dx: number,
  dy: number,
  o: FlyOptions = {},
): boolean {
  if (!el) return false;
  if (reducedMotion) return collapse(el, o);

  const rest = getRest(el);
  const r = take();
  r.kind = K_FLY;
  r.el = el;
  r.t = 0;
  r.hit = !!o.hit;
  r.hitDone = false;
  const ms = clampMs((o.dur ?? 300) * (o.speed ?? 1));
  r.dur = (r.hit ? Math.max(HITSTOP_FLOOR_MS, ms - HITSTOP_MS) : ms) / 1000;
  r.delay = budgetDelay(o.delay ?? 0, r.dur);
  r.started = false;
  r.resolved = false;
  r.x0 = r.x1 = rest.x;
  r.y0 = r.y1 = rest.y;
  r.s0 = o.scale ?? 1;
  r.s1 = 1;
  r.r0 = r.r1 = rest.rot;
  r.ax = dx;
  r.ay = dy;
  r.env = o.env ?? 0.62;
  r.spin = o.spin ?? 0;
  r.bump = o.bump ?? 0;
  r.land = o.land ?? null;
  r.abort = o.abort ?? null;
  r.wx = r.wy = r.ws = r.wr = Number.NaN;
  write(r, el, r.x0, r.y0, r.s0, r.r0);
  attach(r);
  return true;
}

/**
 * §7's collapse. The element is placed at its destination IMMEDIATELY and the
 * landing callback fires in this same tick; the fade that follows is decoration
 * with nothing hanging off it.
 */
function collapse(el: FlightElement, o: FlyOptions): boolean {
  const prev = flyOwner.get(el);
  if (prev) drop(prev, false);
  writeRest(el);
  const land = o.land;
  if (land) land(el);
  fade(el, REDUCED_FADE_MS);
  return true;
}

/** A ≤120ms opacity ramp. Purely cosmetic: it carries no callback, by design. */
export function fade(el: FlightElement | null | undefined, ms = REDUCED_FADE_MS, from = 0.35): boolean {
  if (!el) return false;
  const r = take();
  r.kind = K_FADE;
  r.el = el;
  r.t = 0;
  r.dur = Math.min(REDUCED_FADE_MS, Math.max(40, ms)) / 1000;
  r.delay = 0;
  r.started = false;
  r.resolved = false;
  r.from = from;
  r.to = 1;
  r.land = null;
  r.abort = null;
  r.wo = Number.NaN;
  el.style.setProperty('opacity', String(from));
  attach(r);
  return true;
}

/**
 * Kill whatever this element is doing. Live flights fire `abort`, never `land`.
 */
export function cancel(el: FlightElement | null | undefined): void {
  if (!el) return;
  const f = flyOwner.get(el);
  if (f) drop(f, false);
  const d = fadeOwner.get(el);
  if (d) drop(d, false);
}

/**
 * Milliseconds until nothing is moving. Read straight after an event's
 * choreography is scheduled and it is exactly how long the table has committed
 * to being in motion. 0 = settled.
 */
export function busyUntil(): number {
  let ms = 0;
  for (let i = 0; i < live.length; i++) {
    const r = live[i];
    // An armed flight has already had HITSTOP_MS taken out of r.dur, so the
    // freeze it is going to spend must be added back or this number reports the
    // table settling before it does.
    const hold = r.hit && !r.hitDone ? HITSTOP_MS : 0;
    const left = (r.delay + r.dur - r.t) * 1000 + hold;
    if (left > ms) ms = left;
  }
  return ms + freeze * 1000;
}

/**
 * Snap every live record to its end state and fire its landing callback. A
 * reconnect or a fixture load: the state is already true, the motion is not.
 */
export function finishAll(): void {
  freeze = 0;
  while (live.length) {
    const r = live[live.length - 1];
    live.pop();
    release(r);
    finish(r);
    recycle(r);
  }
  running = false;
  unsubscribe(tick);
}

/**
 * Tear everything down. Live flights ABORT (the contract holds even here) and
 * the hitstop bookkeeping resets. Route teardown and tests — never gameplay.
 */
export function resetFlights(): void {
  while (live.length) {
    const r = live[live.length - 1];
    live.pop();
    release(r);
    abort(r);
    recycle(r);
  }
  running = false;
  unsubscribe(tick);
  freeze = 0;
  clockSec = 0;
  lastHit = -1e9;
  hitCount = 0;
  reducedMotion = false;
}
