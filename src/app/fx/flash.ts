/**
 * fx/flash.ts — the screen flash plate.
 *
 * ── WHY `mix-blend-mode: screen` ──────────────────────────────────────────
 *
 * A crimson wash at 0.3 alpha over the dark teal table (`--ground #090D0E`,
 * `--surface #17231F`) is a GREY WASH: normal alpha compositing pulls every
 * pixel toward the same colour, so the felt, the cards and the type all lose
 * their separation at once and the table looks like it went out of focus.
 * `screen` is `1 − (1−a)(1−b)` — it can only lift. The table keeps its own value
 * structure and the flash reads as a light being thrown across it, which is
 * what a light being thrown across it looks like.
 *
 * ── THE ENVELOPE ──────────────────────────────────────────────────────────
 *
 *   attack:  linear over the first 8% of the duration
 *   release: SQUARED over the remaining 92%
 *
 * The attack is not zero because an instant-on flash on a 60Hz panel is one
 * frame of full opacity and reads as a dropped frame, not as an impact. 8% of
 * 500ms is 40ms — two or three frames, enough for the eye to register a rise.
 * The squared release front-loads the decay so the plate is at 25% by the
 * halfway mark and out of the way of whatever the player has to read next.
 *
 * ── REDUCED MOTION (ART-DIRECTION §7) ─────────────────────────────────────
 *
 * The flash STAYS, at 55% strength and 1.6× duration. It is opacity-only — no
 * translation, no scale, nothing that moves — so it reads as a light coming up
 * rather than as a hit. Remove it and the player who asked for less motion
 * becomes the one player at the table with no non-auditory evidence that a Coup
 * landed on them. Motion collapses; information does not.
 *
 * ── STATE WITHOUT A PLATE ─────────────────────────────────────────────────
 *
 * The envelope runs whether or not a DOM plate exists. On the server, and in
 * the node test environment, `fire()` still arms it and `active()` still
 * reports true — which is exactly what the reduced-motion test asserts. The
 * plate is a renderer, not the state.
 */

import type { FxTone } from './tuning';
import * as overlay from './overlay';

/**
 * Radial gradients, one per tone. The centre percentages are placeholders that
 * `fire()` rewrites to the epicentre of the beat — a flash that always blooms
 * from the middle of the screen tells you something happened; one that blooms
 * from the seat that was couped tells you where.
 */
const TONE: Readonly<Record<FxTone, string>> = {
  // --brass #D6A12A lifted toward --brass-lit #F2C744 in the core.
  brass:
    'radial-gradient(62% 48% at CX CY, rgba(242,199,68,.95) 0%, rgba(214,161,42,.55) 42%, rgba(214,161,42,0) 78%)',
  // --crimson #F27366. The only tone a bystander beat may not wear.
  crimson:
    'radial-gradient(66% 52% at CX CY, rgba(255,150,138,.9) 0%, rgba(242,115,102,.5) 40%, rgba(242,115,102,0) 76%)',
  // --ink #F1EBDE. A refusal, a block: bright and colourless.
  bone: 'radial-gradient(60% 46% at CX CY, rgba(241,235,222,.75) 0%, rgba(241,235,222,.3) 44%, rgba(241,235,222,0) 78%)',
  // --ink-mute #9FADA6. Steel — cold, and quieter than bone.
  ash: 'radial-gradient(60% 46% at CX CY, rgba(214,224,218,.7) 0%, rgba(159,173,166,.32) 44%, rgba(159,173,166,0) 78%)',
};

const REDUCED_STRENGTH = 0.55;
const REDUCED_STRETCH = 1.6;

let peak = 0;
let t = 0;
let dur = 0;
let alpha = 0;
let written = -1;
let reduced = false;
let fired = 0;

export function setReduced(on: boolean): void {
  reduced = on;
}

/**
 * Arm the plate.
 *
 * @param strength peak opacity, from the tuning table
 * @param tone     which gradient
 * @param durMs    duration in ms
 * @param x,y      epicentre in viewport px; `null` centres the gradient
 */
export function fire(
  strength: number,
  tone: FxTone,
  durMs: number,
  x: number | null,
  y: number | null,
): void {
  if (!(strength > 0) || !(durMs > 0)) return;
  fired++;

  const s = reduced ? strength * REDUCED_STRENGTH : strength;
  const d = (reduced ? durMs * REDUCED_STRETCH : durMs) / 1000;

  // Two flashes inside one beat take the LOUDER peak and the LONGER remaining
  // tail, rather than restarting: a Coup that lands and then costs an influence
  // is one event, and re-attacking mid-release would read as a strobe.
  peak = peak > s ? peak : s;
  const remaining = dur - t;
  dur = remaining > d ? remaining : d;
  t = 0;

  const plate = overlay.flashEl();
  if (!plate) return;
  const w = overlay.width();
  const h = overlay.height();
  let cx = '50%';
  let cy = '46%';
  if (x !== null && y !== null && w > 0 && h > 0) {
    cx = `${Math.round((x / w) * 100)}%`;
    cy = `${Math.round((y / h) * 100)}%`;
  }
  plate.style.setProperty('background', TONE[tone].replace('CX', cx).replace('CY', cy));
}

export function active(): boolean {
  return dur > 0;
}

/** Current plate opacity. The test reads the envelope through this. */
export function alphaNow(): number {
  return alpha;
}

export function firedCount(): number {
  return fired;
}

/** @returns whether the flash is still live after this frame. */
export function tick(dt: number): boolean {
  if (dur <= 0) return false;
  t += dt;
  const u = t / dur;
  if (u >= 1) {
    dur = 0;
    peak = 0;
    t = 0;
    alpha = 0;
    write(0);
    return false;
  }
  const k = u < 0.08 ? u / 0.08 : (1 - (u - 0.08) / 0.92) ** 2;
  alpha = Math.round(peak * k * 100) / 100;
  write(alpha);
  return true;
}

function write(a: number): void {
  if (a === written) return;
  written = a;
  overlay.flashEl()?.style.setProperty('opacity', String(a));
}

export function reset(): void {
  dur = 0;
  peak = 0;
  t = 0;
  alpha = 0;
  overlay.flashEl()?.style.setProperty('opacity', '0');
  // −1, not 0: the plate may be about to be destroyed and rebuilt, and a fresh
  // plate has never been written to whatever `written` remembers.
  written = -1;
  fired = 0;
}
