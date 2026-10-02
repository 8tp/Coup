/**
 * fx/emitters.ts — the emitter vocabulary. Each function is ONE recognisable
 * shape; fx/tuning.ts decides which shape a beat gets and how much of it.
 *
 * Speeds are px/s in viewport space, sizes are CSS px, lives are seconds.
 * Gravity is px/s² and is positive DOWN, because this is screen space and the
 * table is a table — everything settles.
 *
 * Every function here fills the module-scope `SP` descriptor and calls
 * `spawn()`. Nothing allocates, and a saturated pool simply returns early: the
 * confetti cannon stops firing rather than queueing frames you can feel.
 */

import {
  FADE,
  KIND,
  SP,
  rnd,
  rndRange,
  spDefaults,
  spawn,
  type FadeIndex,
} from './particles';
import { COL, type ColorIndex } from './palette';

const TAU = Math.PI * 2;

/* ── sparks ─────────────────────────────────────────────────────────────── */

export interface SparkOptions {
  speed: number;
  life: number;
  size: number;
  grav: number;
  /** Radians. `undefined` → a full circle. */
  spread?: number;
  /** Radians. The centre of the fan; only meaningful with `spread`. */
  dir?: number;
  alpha?: number;
  drag?: number;
}

/** Spark dots thrown out of a point. The contact material. */
export function sparks(x: number, y: number, count: number, col: ColorIndex, o: SparkOptions): void {
  const spread = o.spread ?? TAU;
  const dir = o.dir ?? 0;
  const alpha = o.alpha ?? 1;
  const drag = o.drag ?? 3.4;
  for (let i = 0; i < count; i++) {
    spDefaults();
    const a = spread >= TAU ? rnd() * TAU : dir + (rnd() - 0.5) * spread;
    const v = o.speed * (0.55 + rnd() * 0.65);
    SP.kind = KIND.DOT;
    SP.col = col;
    SP.x = x + rndRange(-2, 2);
    SP.y = y + rndRange(-2, 2);
    SP.vx = Math.cos(a) * v;
    SP.vy = Math.sin(a) * v;
    SP.life = o.life * (0.75 + rnd() * 0.5);
    SP.size0 = o.size * (0.7 + rnd() * 0.6);
    SP.size1 = SP.size0 * 0.3;
    SP.grav = o.grav;
    SP.drag = drag;
    SP.alpha = alpha;
    SP.fade = FADE.SPARK;
    if (!spawn()) return;
  }
}

/* ── ring ───────────────────────────────────────────────────────────────── */

/** The shockwave. One hard-edged stroked annulus, r0 → r1 over `life`. */
export function ring(
  x: number,
  y: number,
  r0: number,
  r1: number,
  col: ColorIndex,
  life: number,
  lineWidth: number,
  alpha: number,
): boolean {
  spDefaults();
  SP.kind = KIND.RING;
  SP.col = col;
  SP.x = x;
  SP.y = y;
  SP.size0 = r0;
  SP.size1 = r1;
  SP.life = life;
  SP.alpha = alpha;
  SP.fade = FADE.RING;
  SP.lineW = lineWidth;
  SP.drag = 0;
  return spawn();
}

/* ── flare ──────────────────────────────────────────────────────────────── */

/**
 * One stationary starburst at the epicentre. A ring plus scattered sparks reads
 * as "something happened somewhere near here"; adding a single flare at the
 * exact point is what makes it read as "HERE". Only the two beats that must be
 * located precisely get one.
 */
export function flare(
  x: number,
  y: number,
  size: number,
  col: ColorIndex,
  life: number,
  alpha: number,
): boolean {
  spDefaults();
  SP.kind = KIND.GLINT;
  SP.col = col;
  SP.x = x;
  SP.y = y;
  SP.life = life;
  SP.size0 = size;
  SP.size1 = size * 0.25;
  SP.rot = rnd() * TAU;
  SP.rotVel = 1.1;
  SP.drag = 0;
  SP.grav = 0;
  SP.alpha = alpha;
  SP.fade = FADE.QUAD;
  return spawn();
}

/* ── puff ───────────────────────────────────────────────────────────────── */

/** Dissipating volume — an influence that went away quietly. */
export function puff(
  x: number,
  y: number,
  count: number,
  col: ColorIndex,
  life: number,
  from: number,
  to: number,
  alpha: number,
): void {
  for (let i = 0; i < count; i++) {
    spDefaults();
    const a = rnd() * TAU;
    SP.kind = KIND.PUFF;
    SP.col = col;
    SP.x = x + rndRange(-8, 8);
    SP.y = y + rndRange(-6, 6);
    SP.vx = Math.cos(a) * rndRange(14, 48);
    SP.vy = Math.sin(a) * rndRange(10, 36) - 22;
    SP.life = life * (0.75 + rnd() * 0.5);
    SP.size0 = from;
    SP.size1 = to;
    SP.drag = 3.2;
    SP.grav = -12;
    SP.alpha = alpha;
    SP.fade = FADE.QUAD;
    if (!spawn()) return;
  }
}

/* ── cross ──────────────────────────────────────────────────────────────── */

/**
 * A metallic cross — two orthogonal fans. The block signature: two things met
 * at right angles and neither of them bent.
 */
export function sparkCross(
  x: number,
  y: number,
  perArm: number,
  col: ColorIndex,
  speed: number,
  size: number,
  life: number,
  alpha: number,
): void {
  const base = Math.PI * 0.25;
  for (let arm = 0; arm < 4; arm++) {
    sparks(x, y, perArm, col, {
      speed,
      life,
      size,
      alpha,
      grav: 180,
      drag: 6.5,
      spread: 0.42,
      dir: base + arm * (Math.PI / 2),
    });
  }
}

/* ── confetti ───────────────────────────────────────────────────────────── */

/**
 * The win cannon. Paper, not gravel: heavy drag, low gravity, a per-piece
 * tumble that drives a per-piece sideways scull (see `particles.update`). Fired
 * from the top edge across the full width — a cone from one point reads as a
 * firework, and this beat is a ceremony, not an explosion.
 *
 * The spawn stagger is HALF a screen height, not the 1.35 that arithmetic
 * suggests: grav 210 against drag 0.85 gives a terminal velocity of ~247px/s,
 * so a piece starting 1.35 screen-heights up needs ~3.9s to enter frame against
 * a life of 2.3–3.7s and a quarter of the field expires above the fold. At 0.5
 * the arrival spreads over ~1.5s and nothing dies unseen.
 *
 * @returns how many pieces actually spawned (the pool may saturate).
 */
const CONFETTI_COLS: readonly ColorIndex[] = [
  COL.BRASS,
  COL.BRASS_LIT,
  COL.BONE,
  COL.BRASS_LIT,
  COL.ASH,
  COL.BRASS,
];

export function confetti(w: number, h: number, count: number, life: number): number {
  const spread = 0.86;
  const x0 = w * (0.5 - spread / 2);
  for (let i = 0; i < count; i++) {
    spDefaults();
    SP.kind = KIND.CONFETTI;
    SP.col = CONFETTI_COLS[(rnd() * CONFETTI_COLS.length) | 0];
    SP.x = x0 + rnd() * w * spread;
    SP.y = -rnd() * h * 0.5 - 12;
    SP.vx = rndRange(-70, 70);
    SP.vy = rndRange(190, 330);
    SP.life = life * (0.72 + rnd() * 0.45);
    // 5.5–10.5, not 4.5–8.5. The smaller range was measured on a phone-shaped
    // viewport; on the 1495px desktop capture a 4.5px rect is a speck and the
    // ceremony reads as dust. The piece still has to be small enough that the
    // tumble foreshortening is what identifies it as paper, so the top of the
    // range is bounded by that rather than by taste.
    SP.size0 = rndRange(5.5, 10.5);
    SP.size1 = SP.size0;
    SP.aspect = rndRange(1.15, 2.0);
    SP.grav = 210;
    SP.drag = 0.85;
    SP.rot = rnd() * TAU;
    SP.rotVel = rndRange(-3.4, 3.4);
    SP.tumble = rnd() * TAU;
    SP.tumVel = rndRange(4.5, 11);
    SP.flutter = rndRange(120, 320);
    SP.alpha = 1;
    SP.fade = FADE.PAPER;
    if (!spawn()) return i;
  }
  return count;
}

/* ── settle ─────────────────────────────────────────────────────────────── */

/** Nothing exploded; a player just stopped being at the table. */
export function settle(w: number, h: number, count: number, col: ColorIndex): number {
  for (let i = 0; i < count; i++) {
    spDefaults();
    SP.kind = KIND.PUFF;
    SP.col = col;
    SP.x = rnd() * w;
    SP.y = h * rndRange(0.12, 0.62);
    SP.vx = rndRange(-10, 10);
    SP.vy = rndRange(6, 26);
    SP.life = rndRange(1.0, 1.8);
    SP.size0 = rndRange(10, 26);
    SP.size1 = SP.size0 * 1.7;
    SP.drag = 1.4;
    SP.grav = 8;
    SP.alpha = 0.14;
    SP.fade = FADE.QUAD;
    if (!spawn()) return i;
  }
  return count;
}

/** Re-exported so the demo harness and the tests can name a curve. */
export type { FadeIndex };
