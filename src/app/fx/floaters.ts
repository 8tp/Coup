/**
 * fx/floaters.ts — pooled floating text: coin deltas and the shouts that earn
 * one ("CAUGHT BLUFFING!", "BLOCKED!", "LOST", "ELIMINATED").
 *
 * DOM, NOT CANVAS. This is real text at real sizes. It has to inherit the app's
 * display face, it has to stay crisp on a DPR3 phone (the FX canvas is capped
 * at DPR2, which would make a 24px glyph visibly soft), and being real text
 * means it survives a browser zoom. Twelve nodes, created on first use and
 * recycled forever; a thirteenth simultaneous float takes the oldest.
 *
 * ── THE FADE HOLDS ────────────────────────────────────────────────────────
 *
 *   travel: RISE 46px over LIFE 0.9s, eased 1−(1−u)³
 *   alpha:  ramp in over the first 10%, HOLD AT 1 UNTIL 45%, then fall on ^1.4
 *
 * The hold is the whole point. The number has to be READ, and a linear fade
 * over 900ms is legible for about 300ms of it — the glyphs spend the back half
 * of their life as a smudge that is still costing a composited layer. Holding
 * to 45% and then falling steeply gives ~400ms of full-contrast reading and
 * ~500ms of getting out of the way.
 *
 * ── KEEP-OUT ──────────────────────────────────────────────────────────────
 *
 * A `−3` that lands on top of the coin counter it is describing is worse than
 * no float at all. Every spawn is clamped into a caller-supplied band — in Coup,
 * between the phase banner's bottom edge and the hand's top edge — and offset
 * UPWARD from the beat by the full RISE, so the float ends its life clear of
 * the thing it came from rather than starting clear and drifting back over it.
 *
 * ── ANTI-COLLISION ────────────────────────────────────────────────────────
 *
 * Coup pays several players in one beat — an Embezzle empties the reserve, a
 * Coup moves 7 coins and an influence at once. Two floats within STACK px on Y
 * and 120px on X are stacked instead of overlapped. 44 rather than 30: at
 * 1.5rem the glyphs are ~24px tall and 30px of separation still lets a rising
 * float clip the one above it.
 *
 * ── HALF-WIDTH IS MEASURED, NEVER ASSUMED ─────────────────────────────────
 *
 * Coup's shouts are WORDS, not numbers. "CAUGHT BLUFFING!" at scale 1.35 is
 * ~230px wide, it is anchored on a seat that may be at x≈90, and it is centred
 * with `translateX(-50%)` — so a fixed 62px guess at the half-width puts its
 * first glyph off the left edge of the viewport at the single most dramatic
 * beat in the game. The text is written to the node first, then the node's own
 * `offsetWidth` is read, then x is clamped. One layout read per spawn, and a
 * spawn is a beat.
 */

const POOL = 12;

/** px travelled over LIFE. */
export const RISE = 46;
export const LIFE = 0.9;

/** Two floats closer than this on Y (and 120px on X) are stacked. */
export const STACK_Y = 44;
export const STACK_X = 120;

/** px kept between a float's glyphs and the viewport edge. */
const EDGE = 8;

/** The fade holds at full alpha until here. */
export const HOLD_UNTIL = 0.45;
const RAMP_IN = 0.1;
const FALL_EXP = 1.4;

/** Under reduced motion the text stays and the rise goes. */
const REDUCED_LIFE = 0.75;

export type FloatTone = 'brass' | 'crimson' | 'bone' | 'ash';

const TONE_HEX: Readonly<Record<FloatTone, string>> = {
  brass: '#F2C744',
  crimson: '#F27366',
  bone: '#F1EBDE',
  ash: '#9FADA6',
};

/* ── the DOM surface ────────────────────────────────────────────────────── */

export interface FloaterStyle {
  setProperty(property: string, value: string): void;
  removeProperty(property: string): void;
}

export interface FloaterNode {
  textContent: string | null;
  readonly offsetWidth: number;
  readonly style: FloaterStyle;
  setShout(on: boolean): void;
}

/**
 * Supplies nodes. `null` — the default, and the state in the node test
 * environment and on the server — means the layer runs headless: records are
 * still created, positioned, stacked and ticked, so every rule in this file is
 * testable and `text()` still reports what would have been shown. Only the
 * pixels are absent.
 */
export interface FloaterHost {
  create(): FloaterNode;
}

let host: FloaterHost | null = null;

export function setHost(h: FloaterHost | null): void {
  if (h === host) return;
  host = h;
  // Nodes belong to the host that made them.
  for (let i = 0; i < records.length; i++) records[i].node = null;
}

/* ── the keep-out band ──────────────────────────────────────────────────── */

export interface Band {
  top: number;
  bottom: number;
  width: number;
}

/** Mutated in place by the band provider — one object, no per-spawn garbage. */
const band: Band = { top: 12, bottom: 400, width: 360 };

export type BandProvider = (out: Band) => void;

let provider: BandProvider | null = null;

/**
 * Supply the keep-out band. Called once per spawn, so the provider may read
 * layout — it is a beat, not a frame.
 */
export function setBand(fn: BandProvider | null): void {
  provider = fn;
}

function readBand(): Band {
  if (provider) provider(band);
  if (!(band.bottom > band.top + 24)) band.bottom = band.top + 24;
  return band;
}

/* ── records ────────────────────────────────────────────────────────────── */

interface Record_ {
  node: FloaterNode | null;
  text: string;
  tone: FloatTone;
  scale: number;
  x: number;
  y: number;
  t: number;
  dur: number;
  rise: number;
  alpha: number;
  /** last written quantised transform-y and alpha */
  wt: number;
  wa: number;
}

const records: Record_[] = [];
const live: Record_[] = [];
const free: Record_[] = [];

let reduced = false;
let suppressed = false;

export function setReduced(on: boolean): void {
  reduced = on;
}

/** The game-over overlay owns its moment; a coin delta across it is pure noise. */
export function setSuppressed(on: boolean): void {
  suppressed = on;
}

export function isSuppressed(): boolean {
  return suppressed;
}

function ensureRecords(): void {
  if (records.length) return;
  for (let i = 0; i < POOL; i++) {
    const rec: Record_ = {
      node: null,
      text: '',
      tone: 'bone',
      scale: 1,
      x: 0,
      y: 0,
      t: 0,
      dur: LIFE,
      rise: RISE,
      alpha: 0,
      wt: Number.NaN,
      wa: Number.NaN,
    };
    records.push(rec);
    free.push(rec);
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * @param x,y viewport px — where the beat happened
 * @returns false when suppressed, empty, or the pool is exhausted
 */
export function spawn(text: string, x: number, y: number, tone: FloatTone, scale = 1): boolean {
  if (!text || suppressed) return false;
  ensureRecords();

  const rec = free.pop() ?? live.shift();
  if (!rec) return false;

  const b = readBand();
  const rise = reduced ? 0 : RISE;

  // A first guess at the half-width, refined below once the glyphs exist.
  rec.x = clamp(x, 62, Math.max(64, b.width - 62));

  // Start low enough that the whole RISE stays inside the band.
  let ty = clamp(y - 10, b.top + rise, b.bottom);
  for (let guard = 0; guard < POOL; guard++) {
    let hit = false;
    for (let i = 0; i < live.length; i++) {
      const o = live[i];
      if (Math.abs(o.y - ty) < STACK_Y && Math.abs(o.x - rec.x) < STACK_X) {
        hit = true;
        break;
      }
    }
    if (!hit) break;
    ty -= STACK_Y;
    // Ran out of headroom going up: wrap to the bottom of the band rather than
    // stacking through the phase banner.
    if (ty < b.top + rise) {
      ty = b.bottom;
      break;
    }
  }

  rec.y = ty;
  rec.rise = rise;
  rec.dur = reduced ? REDUCED_LIFE : LIFE;
  rec.t = 0;
  rec.alpha = 0;
  rec.wt = Number.NaN;
  rec.wa = Number.NaN;
  rec.text = text;
  rec.tone = tone;
  rec.scale = scale;

  if (!rec.node && host) rec.node = host.create();
  const node = rec.node;
  if (node) {
    node.textContent = text; // text as text, never HTML
    node.style.setProperty('color', TONE_HEX[tone]);
    if (scale === 1) node.style.removeProperty('font-size');
    else node.style.setProperty('font-size', `${(1.5 * scale).toFixed(2)}rem`);
    node.setShout(scale !== 1);
    // Now that the glyphs are in, clamp against what they actually MEASURE.
    const half = Math.ceil(node.offsetWidth / 2) + EDGE;
    if (half > 62) rec.x = clamp(rec.x, half, Math.max(half, b.width - half));
  }

  live.push(rec);
  return true;
}

export function active(): boolean {
  return live.length > 0;
}

export function count(): number {
  return live.length;
}

/** Read-only view of a live float. Tests and the demo harness only. */
export function peek(i: number): Readonly<Record_> | null {
  return live[i] ?? null;
}

/** The alpha envelope, as a pure function of normalised life. */
export function alphaAt(u: number): number {
  if (u <= 0) return 0;
  if (u >= 1) return 0;
  if (u < RAMP_IN) return Math.round((u / RAMP_IN) * 100) / 100;
  if (u < HOLD_UNTIL) return 1;
  return Math.round((1 - (u - HOLD_UNTIL) / (1 - HOLD_UNTIL)) ** FALL_EXP * 100) / 100;
}

/** @returns whether any float is still live after this frame. */
export function tick(dt: number): boolean {
  if (live.length === 0) return false;
  let i = 0;
  while (i < live.length) {
    const rec = live[i];
    rec.t += dt;
    const u = rec.t / rec.dur;
    if (u >= 1) {
      rec.alpha = 0;
      if (rec.wa !== 0) {
        rec.wa = 0;
        rec.node?.style.setProperty('opacity', '0');
      }
      live.splice(i, 1);
      free.push(rec);
      continue;
    }
    // Ease-out travel, 1−(1−u)³ — most of the rise happens while the text is
    // still fully opaque, so the movement is what draws the eye to it.
    const e = 1 - (1 - u) * (1 - u) * (1 - u);
    const dy = Math.round(-rec.rise * e);
    const a = alphaAt(u);
    rec.alpha = a;

    const node = rec.node;
    if (node) {
      if (dy !== rec.wt) {
        rec.wt = dy;
        node.style.setProperty(
          'transform',
          `translate3d(${rec.x}px,${rec.y + dy}px,0) translateX(-50%)`,
        );
      }
      if (a !== rec.wa) {
        rec.wa = a;
        node.style.setProperty('opacity', String(a));
      }
    } else {
      rec.wt = dy;
      rec.wa = a;
    }
    i++;
  }
  return live.length > 0;
}

export function reset(): void {
  while (live.length) {
    const rec = live.pop();
    if (!rec) break;
    rec.alpha = 0;
    rec.wa = 0;
    rec.node?.style.setProperty('opacity', '0');
    free.push(rec);
  }
}

/** Drop the pool entirely — `fx.unmount()`, when the nodes are about to go. */
export function destroy(): void {
  reset();
  records.length = 0;
  free.length = 0;
  live.length = 0;
}
