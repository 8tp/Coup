/**
 * anim/clock.ts — the ONE clock (GAME-FEEL-PLAN §2.1).
 *
 * Every animated thing in this app is stepped by this single rAF loop. A second
 * timeline (a CSS transition, a WAAPI animation, a `setInterval`) is a second
 * clock: it drifts against this one, it cannot be frozen for a hitstop, and it
 * cannot be interrupted mid-frame — and a Coup flight must be interruptible,
 * because a card can be re-flown by a reconcile while it is still landing.
 *
 * ALLOCATION. The subscriber list is a plain array walked by index; add/remove
 * during a tick go into pending arrays drained between frames, so a frame never
 * allocates and never mutates the array it is walking.
 *
 * SSR. `requestAnimationFrame` is never referenced at module scope, only inside
 * `start()`/`stop()` behind a `typeof` guard. Importing this module on the
 * server is inert: `subscribe()` records the subscriber and the loop simply
 * never runs, so nothing throws and nothing leaks.
 */

export type ClockSubscriber = (dt: number, elapsed: number) => void;
export type Unsubscribe = () => void;

/** A 3s tab stall must not teleport a card. */
const MAX_DT = 1 / 20;

const subs: ClockSubscriber[] = [];
const pendingAdd: ClockSubscriber[] = [];
const pendingRemove: ClockSubscriber[] = [];

let running = false;
let ticking = false;
let rafId = 0;
/** Timestamp of the previous frame. NaN means "no previous frame" → dt 0. */
let last = Number.NaN;
let elapsed = 0;
let frames = 0;

function hasRaf(): boolean {
  return typeof globalThis.requestAnimationFrame === 'function';
}

/**
 * Register a per-frame callback. Returns its own unsubscribe so a caller never
 * has to keep the function identity around.
 */
export function subscribe(fn: ClockSubscriber): Unsubscribe {
  if (ticking) pendingAdd.push(fn);
  else if (subs.indexOf(fn) < 0) subs.push(fn);
  start();
  return () => unsubscribe(fn);
}

export function unsubscribe(fn: ClockSubscriber): void {
  if (ticking) {
    pendingRemove.push(fn);
    return;
  }
  const i = subs.indexOf(fn);
  if (i >= 0) subs.splice(i, 1);
}

/** Seconds since the clock first ran, summed from CLAMPED dt. Presentation only. */
export function now(): number {
  return elapsed;
}

export function frameCount(): number {
  return frames;
}

export function subCount(): number {
  return subs.length;
}

export function isRunning(): boolean {
  return running;
}

function drain(): void {
  for (let i = 0; i < pendingAdd.length; i++) {
    if (subs.indexOf(pendingAdd[i]) < 0) subs.push(pendingAdd[i]);
  }
  pendingAdd.length = 0;
  for (let i = 0; i < pendingRemove.length; i++) {
    const j = subs.indexOf(pendingRemove[i]);
    if (j >= 0) subs.splice(j, 1);
  }
  pendingRemove.length = 0;
}

function tick(t: number): void {
  rafId = globalThis.requestAnimationFrame(tick);

  let dt = Number.isFinite(last) ? (t - last) / 1000 : 0;
  last = t;
  // Both ends of the clamp are load-bearing: a backwards or NaN timestamp is 0,
  // and a long stall is one slow frame rather than a teleport.
  if (!(dt > 0)) dt = 0;
  else if (dt > MAX_DT) dt = MAX_DT;
  elapsed += dt;
  frames++;

  ticking = true;
  try {
    for (let i = 0; i < subs.length; i++) subs[i](dt, elapsed);
  } finally {
    ticking = false;
    drain();
  }

  // The loop stops itself. Nothing animating costs nothing.
  if (subs.length === 0) stop();
}

export function start(): void {
  if (running || !hasRaf()) return;
  running = true;
  last = Number.NaN;
  rafId = globalThis.requestAnimationFrame(tick);
}

export function stop(): void {
  if (!running) return;
  running = false;
  if (rafId && typeof globalThis.cancelAnimationFrame === 'function') {
    globalThis.cancelAnimationFrame(rafId);
  }
  rafId = 0;
  last = Number.NaN;
}

/**
 * Drop every subscriber and stop. Route teardown and tests — never gameplay.
 */
export function reset(): void {
  subs.length = 0;
  pendingAdd.length = 0;
  pendingRemove.length = 0;
  stop();
  elapsed = 0;
  frames = 0;
}
