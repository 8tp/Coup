/**
 * fx/particles.ts — ONE pooled particle system for the whole table.
 *
 * WHY A CANVAS. The win throws 380 confetti. As DOM that is 380 nodes laid out,
 * painted and composited every frame on top of a table that already carries a
 * dozen card nodes; on a 390×844 DPR3 phone that is the frame budget gone. One
 * canvas is one composited layer whose cost is fill-rate, and fill-rate is the
 * thing a phone GPU has spare.
 *
 * ── THE FOUR INVARIANTS ───────────────────────────────────────────────────
 *
 *  1. FIXED CAPACITY. `CAP = 600`. A spawn on a full pool is DROPPED, never
 *     queued. A queue turns a burst you cannot see into frames you can feel.
 *     380 for the win leaves 220 spare for whatever lands on top of it.
 *
 *  2. ZERO ALLOCATION IN update()/draw(). Storage is a struct-of-arrays of
 *     typed arrays; the spawn descriptor is one module-scope object (`SP`), so
 *     a spawn passes no object either. Every colour string a frame can need is
 *     built once in `ensureSprites()`.
 *
 *  3. DEATH IS SWAP-WITH-LAST, so the live range stays dense at [0, n) and the
 *     draw loop is a straight walk with no holes and no compaction pass.
 *
 *  4. INTEGRATION IS A PURE FUNCTION OF dt, handed down by anim/clock — so a
 *     backgrounded tab freezes the effect instead of teleporting it (the clock
 *     already clamps dt to 1/20s).
 *
 * ── LAZINESS ──────────────────────────────────────────────────────────────
 * The pool itself is allocated on the FIRST spawn, not at module load, so
 * importing fx/ costs nothing but the module records. 21 typed arrays × 600 is
 * ~46KB and it is allocated exactly once, before any frame runs — "preallocated"
 * means "not during update", not "at import".
 *
 * ── SSR ───────────────────────────────────────────────────────────────────
 * `document` is referenced only inside `ensureSprites()`, behind a `typeof`
 * guard. On the server, `spawn()` and `update()` work and `draw()` is a no-op.
 */

import { hash1 } from '../anim/easing';
import { COL, HEX, PALETTE_SIZE, RGB, type ColorIndex } from './palette';

const TAU = Math.PI * 2;

export const CAP = 600;

/** 3× on a 390×844 phone is 3.0 Mpx of confetti fill for no visible gain — the
 *  pieces are 6px rects. Consumed by fx/overlay.ts; declared here because it is
 *  a property of what is being drawn, not of the element it is drawn on. */
export const DPR_CAP = 2;

/* ── the sprite vocabulary ──────────────────────────────────────────────── */

export const KIND = { DOT: 0, GLINT: 1, PUFF: 2, RING: 3, CONFETTI: 4 } as const;
export type KindIndex = (typeof KIND)[keyof typeof KIND];

/**
 * Per-shape fade exponents. `alpha = alpha0 × (1 − u)^exp`.
 *
 *   LINEAR 1     — unused by the table; kept because "no fade curve" has to be
 *                  expressible or someone will encode it as 1.0001.
 *   RING   1.15  — a squared fade puts a ring below 25% alpha at the halfway
 *                  point of a travel whose entire job is to reach the far
 *                  radius visibly. Rings must survive their own expansion.
 *   SPARK  1.6   — at fade² a spark is under 30% alpha at 45% of its life, so a
 *                  burst meant to read for 300ms reads for 120. 1.6 holds the
 *                  first third and then goes.
 *   QUAD   2     — puffs and glints. Volume dissipating; the eye expects the
 *                  back half of a puff to be nearly gone.
 *   PAPER  3     — confetti. Paper is opaque until it is off screen. A cubic
 *                  fade is ~opaque until the last 18% of life, so the field
 *                  reads as paper falling rather than as fog clearing.
 */
export const FADE = { LINEAR: 0, RING: 1, SPARK: 2, QUAD: 3, PAPER: 4 } as const;
export type FadeIndex = (typeof FADE)[keyof typeof FADE];
const FADE_EXP = [1, 1.15, 1.6, 2, 3];

/* ── storage ────────────────────────────────────────────────────────────── */

interface Pool {
  readonly px: Float32Array;
  readonly py: Float32Array;
  readonly vx: Float32Array;
  readonly vy: Float32Array;
  readonly life: Float32Array;
  readonly maxLife: Float32Array;
  readonly sz0: Float32Array;
  readonly sz1: Float32Array;
  readonly drag: Float32Array;
  readonly grav: Float32Array;
  readonly rot: Float32Array;
  readonly rotVel: Float32Array;
  readonly alpha0: Float32Array;
  /** confetti: current tumble angle */
  readonly tumble: Float32Array;
  /** confetti: tumble rate, rad/s */
  readonly tumVel: Float32Array;
  /** confetti: sideways scull amplitude */
  readonly flut: Float32Array;
  /** confetti: height/width */
  readonly aspect: Float32Array;
  /** ring only: stroke width at birth */
  readonly lineW: Float32Array;
  readonly kind: Uint8Array;
  readonly col: Uint8Array;
  readonly fade: Uint8Array;
}

let pool: Pool | null = null;
let n = 0;
let peak = 0;
let dropped = 0;

function makePool(): Pool {
  return {
    px: new Float32Array(CAP),
    py: new Float32Array(CAP),
    vx: new Float32Array(CAP),
    vy: new Float32Array(CAP),
    life: new Float32Array(CAP),
    maxLife: new Float32Array(CAP),
    sz0: new Float32Array(CAP),
    sz1: new Float32Array(CAP),
    drag: new Float32Array(CAP),
    grav: new Float32Array(CAP),
    rot: new Float32Array(CAP),
    rotVel: new Float32Array(CAP),
    alpha0: new Float32Array(CAP),
    tumble: new Float32Array(CAP),
    tumVel: new Float32Array(CAP),
    flut: new Float32Array(CAP),
    aspect: new Float32Array(CAP),
    lineW: new Float32Array(CAP),
    kind: new Uint8Array(CAP),
    col: new Uint8Array(CAP),
    fade: new Uint8Array(CAP),
  };
}

export function count(): number {
  return n;
}

export function peakCount(): number {
  return peak;
}

export function droppedCount(): number {
  return dropped;
}

export function full(): boolean {
  return n >= CAP;
}

/** True once the backing arrays exist. The laziness assertion hangs off this. */
export function allocated(): boolean {
  return pool !== null;
}

export function clear(): void {
  n = 0;
}

/** Test/debug read-only view of the live range. Never used by update or draw. */
export function inspect(): Pool | null {
  return pool;
}

/* ── spawn ──────────────────────────────────────────────────────────────── */

/**
 * The ONE spawn descriptor. Fill it, call `spawn()`. No arguments, no object
 * literal, no garbage — a 380-piece confetti cannon allocates nothing.
 */
export const SP = {
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  life: 0.4,
  size0: 3,
  size1: 1,
  drag: 3,
  grav: 0,
  rot: 0,
  rotVel: 0,
  alpha: 1,
  fade: FADE.QUAD as FadeIndex,
  kind: KIND.DOT as KindIndex,
  col: COL.BONE as ColorIndex,
  tumble: 0,
  tumVel: 0,
  flutter: 0,
  aspect: 1.6,
  lineW: 2.5,
};

export function spDefaults(): void {
  SP.x = 0;
  SP.y = 0;
  SP.vx = 0;
  SP.vy = 0;
  SP.life = 0.4;
  SP.size0 = 3;
  SP.size1 = 1;
  SP.drag = 3;
  SP.grav = 0;
  SP.rot = 0;
  SP.rotVel = 0;
  SP.alpha = 1;
  SP.fade = FADE.QUAD;
  SP.kind = KIND.DOT;
  SP.col = COL.BONE;
  SP.tumble = 0;
  SP.tumVel = 0;
  SP.flutter = 0;
  SP.aspect = 1.6;
  SP.lineW = 2.5;
}

/** @returns false when the pool is saturated — the spawn is DROPPED. */
export function spawn(): boolean {
  if (n >= CAP) {
    dropped++;
    return false;
  }
  const p = pool ?? (pool = makePool());
  const i = n++;
  if (n > peak) peak = n;
  p.px[i] = SP.x;
  p.py[i] = SP.y;
  p.vx[i] = SP.vx;
  p.vy[i] = SP.vy;
  p.life[i] = 0;
  p.maxLife[i] = SP.life > 0.001 ? SP.life : 0.001;
  p.sz0[i] = SP.size0;
  p.sz1[i] = SP.size1;
  p.drag[i] = SP.drag;
  p.grav[i] = SP.grav;
  p.rot[i] = SP.rot;
  p.rotVel[i] = SP.rotVel;
  p.alpha0[i] = SP.alpha;
  p.fade[i] = SP.fade;
  p.kind[i] = SP.kind;
  p.col[i] = SP.col;
  p.tumble[i] = SP.tumble;
  p.tumVel[i] = SP.tumVel;
  p.flut[i] = SP.flutter;
  p.aspect[i] = SP.aspect;
  p.lineW[i] = SP.lineW;
  return true;
}

/** Swap-with-last. `splice` returns an array, which is a per-frame allocation. */
function kill(p: Pool, i: number): void {
  const last = --n;
  if (i === last) return;
  p.px[i] = p.px[last];
  p.py[i] = p.py[last];
  p.vx[i] = p.vx[last];
  p.vy[i] = p.vy[last];
  p.life[i] = p.life[last];
  p.maxLife[i] = p.maxLife[last];
  p.sz0[i] = p.sz0[last];
  p.sz1[i] = p.sz1[last];
  p.drag[i] = p.drag[last];
  p.grav[i] = p.grav[last];
  p.rot[i] = p.rot[last];
  p.rotVel[i] = p.rotVel[last];
  p.alpha0[i] = p.alpha0[last];
  p.tumble[i] = p.tumble[last];
  p.tumVel[i] = p.tumVel[last];
  p.flut[i] = p.flut[last];
  p.aspect[i] = p.aspect[last];
  p.lineW[i] = p.lineW[last];
  p.kind[i] = p.kind[last];
  p.col[i] = p.col[last];
  p.fade[i] = p.fade[last];
}

/* ── integrate ──────────────────────────────────────────────────────────── */

export function update(dt: number): void {
  const p = pool;
  if (!p || n === 0) return;
  let i = 0;
  while (i < n) {
    const l = p.life[i] + dt;
    if (l >= p.maxLife[i]) {
      kill(p, i);
      continue;
    }
    p.life[i] = l;

    let f = 1 - p.drag[i] * dt;
    if (f < 0) f = 0;
    let ux = p.vx[i] * f;
    const uy = (p.vy[i] + p.grav[i] * dt) * f;

    if (p.kind[i] === KIND.CONFETTI) {
      // Flutter: paper sculls sideways because the falling face keeps stalling.
      // Driving it off the TUMBLE ANGLE rather than an independent sine ties
      // the sideways kick to the moment the piece is edge-on, which is what
      // makes a field of confetti look like paper instead of like snow.
      p.tumble[i] += p.tumVel[i] * dt;
      ux += Math.cos(p.tumble[i]) * p.flut[i] * dt;
    }

    p.vx[i] = ux;
    p.vy[i] = uy;
    p.px[i] += ux * dt;
    p.py[i] += uy * dt;
    p.rot[i] += p.rotVel[i] * dt;
    i++;
  }
}

function fadeOf(k: number, idx: number): number {
  const e = FADE_EXP[idx] ?? 2;
  if (e === 1) return k;
  if (e === 2) return k * k;
  if (e === 3) return k * k * k;
  return Math.pow(k, e);
}

/* ── sprites ────────────────────────────────────────────────────────────── */

/**
 * Confetti darkening ramp. The grazing phase of a tumble has to go DARK or the
 * piece reads as a glowing chip instead of paper. There is no lighting model
 * here, so |N·L| is baked into 8 pre-built strings per colour and indexed by
 * the tumble angle. 8 steps: at 6px tall the banding is sub-pixel.
 */
const SHADE_STEPS = 8;
/**
 * MEASURED ON COUP'S GROUND, and this is where the number departs from
 * chudopoly's 0.34. Coup's table is `--surface #17231F` falling off to
 * `--ground #090D0E`; chudopoly's felt is navy and its confetti colours are
 * brighter. Brass at 0.34 is rgb(73,55,14), which against #0d1513 is a HOLE
 * rather than a piece of paper turned edge-on — the grazing phase does not go
 * dark, it goes absent, and roughly a third of the field is missing at any
 * instant. On the 1495×812 capture the 380-piece win read visibly thinner than
 * the count says it should. 0.55 keeps the turn-over legible (there is still a
 * 2.1× swing from grazing to face-on) while never letting a piece drop below
 * the ground it is falling in front of.
 */
const SHADE_MIN = 0.55;
const SHADE_MAX = 1.18;
const SHADE: string[][] = [];

type Sprite = CanvasImageSource;
/** [kind][colour]. Only DOT, GLINT and PUFF have sprites; rings and confetti
 *  are drawn as geometry, because a stroked circle and a filled rect are
 *  sharper at every size than any bitmap that has to be scaled to them. */
let sprites: Sprite[][] | null = null;

function tintCanvas(size: number, draw: (g: CanvasRenderingContext2D, r: number) => void): Sprite {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  if (g) {
    g.translate(size / 2, size / 2);
    draw(g, size / 2);
  }
  return c;
}

function stops(
  grad: CanvasGradient,
  list: readonly (readonly [number, number])[],
  r: number,
  g: number,
  b: number,
): CanvasGradient {
  for (let i = 0; i < list.length; i++) {
    grad.addColorStop(list[i][0], `rgba(${r},${g},${b},${list[i][1]})`);
  }
  return grad;
}

/**
 * Build every sprite in code, once, on the first effect. 3 shapes × 6 colours =
 * 18 offscreen canvases, ≤64px each.
 *
 * @returns false when there is no `document` (SSR / the vitest node env).
 */
export function ensureSprites(): boolean {
  if (sprites) return true;
  if (typeof document === 'undefined') return false;

  const built: Sprite[][] = [[], [], []];
  for (let c = 0; c < PALETTE_SIZE; c++) {
    const [r, g, b] = RGB[c];

    // DOT — the spark. A PLATEAU CORE, NOT A GAUSSIAN. With the first shoulder
    // at 0.16 the visible core of an 8px dot is ~2px and the burst simply does
    // not exist against a textured ground; Coup's table art is gouache with
    // grain on it, which is at least as busy as chudopoly's felt. Holding full
    // alpha out to 0.30 of the radius is the difference between a spark and a
    // smudge.
    built[KIND.DOT][c] = tintCanvas(32, (x, rad) => {
      x.fillStyle = stops(
        x.createRadialGradient(0, 0, 0, 0, 0, rad * 0.98),
        [
          [0, 1],
          [0.3, 1],
          [0.52, 0.58],
          [0.8, 0.1],
          [1, 0],
        ],
        r,
        g,
        b,
      );
      x.fillRect(-rad, -rad, rad * 2, rad * 2);
    });

    // GLINT — a card-corner catch of light: a small core with two crossed bars.
    // Drawn rotated per particle so a set of glints does not read as a grid of
    // plus signs. Bars at 0.20 of the radius, not 0.14: at a 26px draw size the
    // thinner bar is under 2 device px and antialiases itself away.
    built[KIND.GLINT][c] = tintCanvas(48, (x, rad) => {
      x.globalCompositeOperation = 'lighter';
      x.fillStyle = stops(
        x.createRadialGradient(0, 0, 0, 0, 0, rad * 0.34),
        [
          [0, 1],
          [0.3, 0.85],
          [1, 0],
        ],
        r,
        g,
        b,
      );
      x.fillRect(-rad, -rad, rad * 2, rad * 2);
      for (let axis = 0; axis < 2; axis++) {
        const lg = x.createLinearGradient(-rad, 0, rad, 0);
        stops(
          lg,
          [
            [0, 0],
            [0.3, 0.2],
            [0.5, 1],
            [0.7, 0.2],
            [1, 0],
          ],
          r,
          g,
          b,
        );
        x.save();
        if (axis) x.rotate(Math.PI / 2);
        x.fillStyle = lg;
        x.fillRect(-rad, -rad * 0.1, rad * 2, rad * 0.2);
        x.restore();
      }
    });

    // PUFF — volume, not glow. A flat plateau so a dissipating puff reads as
    // smoke rather than as a big soft spark.
    built[KIND.PUFF][c] = tintCanvas(64, (x, rad) => {
      x.fillStyle = stops(
        x.createRadialGradient(0, 0, 0, 0, 0, rad * 0.98),
        [
          [0, 0.82],
          [0.46, 0.76],
          [0.7, 0.38],
          [0.9, 0.06],
          [1, 0],
        ],
        r,
        g,
        b,
      );
      x.fillRect(-rad, -rad, rad * 2, rad * 2);
    });

    const ramp = new Array<string>(SHADE_STEPS);
    for (let s = 0; s < SHADE_STEPS; s++) {
      const k = SHADE_MIN + (SHADE_MAX - SHADE_MIN) * (s / (SHADE_STEPS - 1));
      ramp[s] =
        `rgb(${Math.min(255, r * k) | 0},${Math.min(255, g * k) | 0},${Math.min(255, b * k) | 0})`;
    }
    SHADE[c] = ramp;
  }
  sprites = built;
  return true;
}

/* ── draw ───────────────────────────────────────────────────────────────── */

/**
 * The subset of the 2D context this module touches. Structural rather than
 * `CanvasRenderingContext2D` for the same reason anim/flight.ts types its
 * element structurally: it documents exactly how little of the API is in play.
 */
export type FxContext2D = Pick<
  CanvasRenderingContext2D,
  | 'setTransform'
  | 'globalAlpha'
  | 'globalCompositeOperation'
  | 'drawImage'
  | 'fillStyle'
  | 'fillRect'
  | 'strokeStyle'
  | 'lineWidth'
  | 'beginPath'
  | 'arc'
  | 'stroke'
>;

/**
 * TWO PASSES over the live range, so `globalCompositeOperation` is set exactly
 * twice per frame instead of once per particle: opaque things (confetti, puffs)
 * under, additive things (dots, glints, rings) over. Toggling the composite op
 * per particle costs ~0.9ms/frame at 380 pieces.
 *
 * @param dpr device pixel ratio the canvas backing store was sized at
 */
export function draw(g: FxContext2D, dpr: number): void {
  const p = pool;
  if (!p || n === 0) return;
  if (!ensureSprites() || !sprites) return;
  const d = dpr;

  /* ── pass 1: source-over. Paper and smoke. ── */
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-over';
  for (let i = 0; i < n; i++) {
    const k = p.kind[i];
    if (k !== KIND.CONFETTI && k !== KIND.PUFF) continue;
    const u = p.life[i] / p.maxLife[i];
    const a = p.alpha0[i] * fadeOf(1 - u, p.fade[i]);
    if (a <= 0.004) continue;
    g.globalAlpha = a > 1 ? 1 : a;

    if (k === KIND.PUFF) {
      const s = (p.sz0[i] + (p.sz1[i] - p.sz0[i]) * u) * d;
      g.drawImage(sprites[KIND.PUFF][p.col[i]], p.px[i] * d - s / 2, p.py[i] * d - s / 2, s, s);
      continue;
    }

    // CONFETTI is a real fillRect, foreshortened by the tumble angle and SHADED
    // by it. Both halves matter: foreshortening alone gives you a rectangle
    // that gets thin, which reads as a shrinking chip; shading it dark through
    // the grazing pass is what makes it read as a sheet of paper turning over.
    const c = Math.cos(p.tumble[i]);
    const ac = c < 0 ? -c : c;
    const w = p.sz0[i] * d;
    const h = w * p.aspect[i] * (0.1 + 0.9 * ac);
    const ramp = SHADE[p.col[i]];
    // smoothstep on |cos| — the piece spends most of its tumble bright and
    // snaps dark through the grazing pass, which is where the flutter kick is.
    const smooth = ac * ac * (3 - 2 * ac);
    let si = (smooth * (SHADE_STEPS - 1) + 0.5) | 0;
    if (si > SHADE_STEPS - 1) si = SHADE_STEPS - 1;
    g.fillStyle = ramp[si];
    const cs = Math.cos(p.rot[i]);
    const sn = Math.sin(p.rot[i]);
    g.setTransform(cs, sn, -sn, cs, p.px[i] * d, p.py[i] * d);
    g.fillRect(-w / 2, -h / 2, w, h);
    g.setTransform(1, 0, 0, 1, 0, 0);
  }

  /* ── pass 2: lighter. Sparks, glints, shockwaves. ── */
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const k = p.kind[i];
    if (k === KIND.CONFETTI || k === KIND.PUFF) continue;
    const u = p.life[i] / p.maxLife[i];
    const a0 = p.alpha0[i] * fadeOf(1 - u, p.fade[i]);
    if (a0 <= 0.004) continue;
    const a = a0 > 1 ? 1 : a0;
    g.globalAlpha = a;

    if (k === KIND.RING) {
      // THE HARD EDGE. A shockwave drawn as a soft radial smear carries ~0.1
      // alpha over a third of its area and vanishes against any busy surface —
      // here, painted gouache. A STROKED ANNULUS puts its contrast at the edge,
      // which reads on any ground and matches the flat, hard-edged drawing
      // language of the cards.
      //
      // TWO STROKES, NOT ONE. A single 2.5px stroke fading as (1−u)² is
      // invisible past the halfway point of its travel. The BAND (wide, 45%
      // alpha) carries the energy and the FILAMENT (1.6px, full alpha) carries
      // the edge; additively they read as a bright wire inside a glow, which is
      // what a shockwave looks like and what a smear does not.
      const r = (p.sz0[i] + (p.sz1[i] - p.sz0[i]) * u) * d;
      if (r <= 0.5) continue;
      g.strokeStyle = HEX[p.col[i]];
      g.globalAlpha = a * 0.45;
      g.lineWidth = Math.max(1.5, p.lineW[i] * (1 - 0.35 * u)) * d;
      g.beginPath();
      g.arc(p.px[i] * d, p.py[i] * d, r, 0, TAU);
      g.stroke();
      g.globalAlpha = a;
      g.lineWidth = 1.6 * d;
      g.beginPath();
      g.arc(p.px[i] * d, p.py[i] * d, r, 0, TAU);
      g.stroke();
      continue;
    }

    const s = (p.sz0[i] + (p.sz1[i] - p.sz0[i]) * u) * d;
    const sprite = sprites[k][p.col[i]];
    if (k === KIND.GLINT && p.rot[i] !== 0) {
      const cs = Math.cos(p.rot[i]);
      const sn = Math.sin(p.rot[i]);
      g.setTransform(cs, sn, -sn, cs, p.px[i] * d, p.py[i] * d);
      g.drawImage(sprite, -s / 2, -s / 2, s, s);
      g.setTransform(1, 0, 0, 1, 0, 0);
    } else {
      g.drawImage(sprite, p.px[i] * d - s / 2, p.py[i] * d - s / 2, s, s);
    }
  }

  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
}

/* ── deterministic jitter ───────────────────────────────────────────────── */

/**
 * The FX layer's OWN counter-driven hash.
 *
 * Coup's deck is shuffled with Fisher–Yates off the engine's randomness, and
 * the engine's randomness is state that a replay or a seeded bot test has to
 * reproduce. A particle that consumed from it would mean a spark changed the
 * deck. So fx keeps its own stream: same seed → same burst, screenshots
 * reproduce, and the game cannot tell whether the FX layer ran at all.
 *
 * `hash1` is anim/easing's — one hash implementation in the app, not two.
 */
let seedN = 0;

export function rnd(): number {
  seedN = (seedN + 1) | 0;
  return hash1(seedN);
}

export function rndRange(a: number, b: number): number {
  return a + (b - a) * rnd();
}

export function resetJitter(): void {
  seedN = 0;
}

/** Full teardown: drop the live set, the counters and the jitter stream. The
 *  backing arrays and the sprites survive — rebuilding them per burst is the
 *  allocation this module exists to avoid. */
export function reset(): void {
  n = 0;
  peak = 0;
  dropped = 0;
  resetJitter();
}
