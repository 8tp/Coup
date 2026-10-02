/**
 * anim/easing.ts — allocation-free easing. No object returns, no DOM, no state.
 *
 * The two `back` constants below are the whole squash-and-stretch budget of this
 * game, so they are documented rather than tuned in place.
 */

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * Overshoot for POSITION and ROTATION.
 *
 * ART-DIRECTION §6 and GAME-FEEL-PLAN §2.2 both annotate this constant
 * "~4.5% overshoot". The constant is what is ratified; the annotation is a slip.
 * The closed form peaks at v = 2k/(3(k+1)) = 0.3158, giving
 * `1 + 0.9v² − 1.9v³ = 1.0299` — **2.99%**. (The classic 1.70158 peaks at
 * exactly 10%, which is where the "19px past the slot" measurement below comes
 * from: 10% of a 190px travel.) Stated here because a wrong number in a comment
 * gets copied into the next tuning session.
 *
 * Not the classic `1.70158`. That constant is derived to overshoot ~10%, which
 * on a wide table puts a card roughly 19px past the slot it is landing in
 * (chudopoly, measured on a 1280px table) and reads as a *bounce* — a card that
 * hit something and came back. 0.9 reads as a *landing*: the card arrives, the
 * paper flexes, it settles. Same code, different physics.
 */
export const BACK = 0.9;

/**
 * Overshoot for SCALE — the free squash-and-stretch.
 *
 * Scale used to be eased with `easeOutCubic`, which is monotonic: a card grew to
 * its final size and simply stopped, so every landing read as a teleport with a
 * sound on it. `easeOutBack` on the *scale* axis costs nothing and gives the
 * landing a direction — a card growing (deck 26px → hand 62px) overshoots and
 * settles back, and a card shrinking (hand → a small seat slot) undershoots and
 * springs open. That is squash-and-stretch for one changed easing function.
 *
 * 0.55 rather than 0.9 because scale overshoot is measured in edge travel, not
 * in fraction: at 0.9 a hand-sized card's 3% overshoot is ~1.9px of edge
 * movement on every side at once, which reads as a bounce again. 0.55 peaks at
 * 1.03%.
 */
export const SCALE_BACK = 0.55;

/**
 * Back-out easing. `easeOutBack(0, k) === 0`, `easeOutBack(1, k) === 1`, and it
 * exceeds 1 in between — that excursion IS the settle.
 *
 * Crosses 1 (i.e. the element's centroid is exactly on its mark) at
 * `p = 1 − k/(1+k)`; see `CONTACT` in flight.ts, which is the frame the hitstop
 * fires on.
 */
export function easeOutBack(p: number, back: number = BACK): number {
  // The endpoints are pinned rather than computed: `1 + (k+1)(−1)³ + k` is 0 in
  // algebra and 1.1e-16 in floating point, and an element whose flight ends
  // 1e-16 off its rest pose is an element that never quite equals its rest pose.
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  const u = p - 1;
  return 1 + (back + 1) * u * u * u + back * u * u;
}

/** Hermite S-curve on [0,1], clamped. Symmetric — no overshoot. */
export function smoothstep(p: number): number {
  const t = clamp01(p);
  return t * t * (3 - 2 * t);
}

export function easeOutCubic(p: number): number {
  const u = 1 - clamp01(p);
  return 1 - u * u * u;
}

/* ── the ratified settle curve ─────────────────────────────────────────────
   ART-DIRECTION names `cubic-bezier(.22, 1, .36, 1)` by its coefficients, so it
   is SOLVED rather than approximated. `easeOutQuint` — the obvious stand-in —
   deviates by up to 1.14%, peaking at p≈0.058 where the curve is steepest and
   the eye is most sensitive to the release; it is 0.23% off at p=0.15. (The
   brief quotes "3.1% off at p=0.15"; measured against the real curve it is
   0.23%, and the honest argument for solving is not the size of that error but
   that the coefficients are ratified, so the curve should be the curve.)

   Newton on the x-polynomial, 4 iterations, allocation-free. 4 because the 5th
   moved the result by <1e-6 for every p sampled at 1/240s across the curve. */
const BZ_X1 = 0.22;
const BZ_Y1 = 1;
const BZ_X2 = 0.36;
const BZ_Y2 = 1;

function bezAxis(t: number, a1: number, a2: number): number {
  const u = 1 - t;
  return 3 * u * u * t * a1 + 3 * u * t * t * a2 + t * t * t;
}

function bezSlope(t: number, a1: number, a2: number): number {
  const u = 1 - t;
  return 3 * u * u * a1 + 6 * u * t * (a2 - a1) + 3 * t * t * (1 - a2);
}

/** `cubic-bezier(.22, 1, .36, 1)` solved by Newton's method, 4 iterations. */
export function settle(p: number): number {
  if (!(p > 0)) return 0;
  if (p >= 1) return 1;
  let t = p;
  for (let i = 0; i < 4; i++) {
    const d = bezSlope(t, BZ_X1, BZ_X2);
    if (d < 1e-5) break;
    t -= (bezAxis(t, BZ_X1, BZ_X2) - p) / d;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
  }
  return bezAxis(t, BZ_Y1, BZ_Y2);
}

/**
 * Deterministic 1D hash in [0,1). A pure function of `n`, NOT an RNG: the arc
 * side of a straight-up flight is picked with it precisely so a screenshot run
 * reproduces frame for frame.
 */
export function hash1(n: number): number {
  let h = Math.imul(n | 0, 374761393);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** FNV-1a so a React key (a string id) can seed `hash1` as stably as a number. */
export function hashKey(key: number | string | undefined | null): number {
  if (key == null) return 0;
  if (typeof key === 'number') return key | 0;
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h | 0;
}
