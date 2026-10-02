/**
 * fx/overlay.ts — the FX substrate: one canvas, one flash plate, one text layer.
 *
 * OWNERSHIP. The FX layer may not touch `globals.css`, `tailwind.config.ts` or
 * any component, so it builds its own DOM and its own stylesheet at runtime.
 * Everything it creates is prefixed `fx-`, and nothing else in the app selects
 * on that prefix.
 *
 * IDLE COST. Nothing exists until the first effect fires: no node, no canvas
 * backing store, no resize listener, no clock subscriber. When the last effect
 * dies, `setActive(false)` drops the resize listeners and puts the root on
 * `display:none` so the compositor drops the layer and the backing store is
 * cleared.
 *
 * The root NODE itself survives an idle period, and that is a deliberate
 * exception to "torn down when the last one dies": a full-viewport DPR2 backing
 * store on a desktop is ~14MB, and destroying and re-creating it per beat would
 * mean a 14MB allocation on every card that lands. Idle is display:none with no
 * listeners and no clock subscriber, which is indistinguishable from absent for
 * everything except `document.getElementById`. `destroy()` — called by
 * `fx.unmount()` and route teardown — removes the node, the stylesheet and
 * every listener, and after it the page is byte-identical to one where fx/ was
 * never imported.
 *
 * SSR. `document` appears only inside functions, behind `typeof` guards. On the
 * server every accessor returns null/0 and every builder is a no-op.
 */

import { DPR_CAP } from './particles';

/** Above the table and every prompt (max in the app today is 70), because the
 *  win confetti has to fall in FRONT of the game-over overlay rather than
 *  behind it. Floating text is suppressed separately while that overlay is up
 *  (see fx/floaters.ts) — the confetti is a ceremony, a coin delta is noise. */
const Z_INDEX = 90;

const CSS = `
.fx-root{position:fixed;inset:0;z-index:${Z_INDEX};pointer-events:none;display:none;
  contain:layout style paint;overflow:hidden}
.fx-root.is-on{display:block}
.fx-canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.fx-flash{position:absolute;inset:0;pointer-events:none;opacity:0;
  will-change:opacity;mix-blend-mode:screen}
.fx-float{position:absolute;inset:0;pointer-events:none}
.fx-text{position:absolute;left:0;top:0;pointer-events:none;opacity:0;
  font:900 1.5rem/1 var(--font-display,ui-sans-serif,system-ui,sans-serif);
  letter-spacing:.02em;white-space:nowrap;color:#F1EBDE;
  text-shadow:0 1px 2px rgba(0,0,0,.92),0 0 12px rgba(0,0,0,.7);
  will-change:transform,opacity;transform:translate3d(0,0,0)}
/* A shout ("CAUGHT BLUFFING!", "BLOCKED!") lands wherever the crime was, which
   is usually ON a seat rather than on empty felt, and the drop shadow above is
   tuned for the dark table ground. A solid 3px dark ring — four offsets plus a
   tight glow — makes the glyphs legible against anything the table can put
   under them, which is what a once-a-game shout has to be. */
.fx-text.is-shout{
  text-shadow:
    0 0 3px rgba(0,0,0,1),0 0 3px rgba(0,0,0,1),
    2px 0 2px rgba(0,0,0,.95),-2px 0 2px rgba(0,0,0,.95),
    0 2px 2px rgba(0,0,0,.95),0 -2px 2px rgba(0,0,0,.95),
    0 0 16px rgba(0,0,0,.85)}
`;

let styleEl: HTMLStyleElement | null = null;
let root: HTMLDivElement | null = null;
let canvas: HTMLCanvasElement | null = null;
let ctx2d: CanvasRenderingContext2D | null = null;
let flashPlate: HTMLDivElement | null = null;
let floatLayer: HTMLDivElement | null = null;
let host: HTMLElement | null = null;

let listening = false;
let activeNow = false;
let cssW = 0;
let cssH = 0;
let dpr = 1;

/** Where the overlay is appended. `null` → `document.body` at build time. */
export function setHost(node: HTMLElement | null): void {
  if (node === host) return;
  host = node;
  if (root && node) node.appendChild(root);
}

/** Build the substrate. Called on the first effect and never again. */
export function ensure(): boolean {
  if (root) return true;
  if (typeof document === 'undefined') return false;

  styleEl = document.createElement('style');
  styleEl.setAttribute('data-fx', 'true');
  styleEl.textContent = CSS; // text, never HTML
  document.head.appendChild(styleEl);

  root = document.createElement('div');
  root.className = 'fx-root';
  root.setAttribute('aria-hidden', 'true');

  canvas = document.createElement('canvas');
  canvas.className = 'fx-canvas';
  // alpha:true is required — this composites over the table. `desynchronized`
  // lets the browser skip a frame of latency on the overlay, which it may
  // because nothing ever reads this canvas back.
  ctx2d = canvas.getContext('2d', { alpha: true, desynchronized: true });

  flashPlate = document.createElement('div');
  flashPlate.className = 'fx-flash';

  floatLayer = document.createElement('div');
  floatLayer.className = 'fx-float';

  root.appendChild(canvas);
  root.appendChild(flashPlate);
  root.appendChild(floatLayer);
  (host ?? document.body).appendChild(root);

  resize();
  return true;
}

function resize(): void {
  if (!canvas || typeof window === 'undefined') return;
  const w = Math.max(1, window.innerWidth | 0);
  const h = Math.max(1, window.innerHeight | 0);
  const d = Math.min(DPR_CAP, window.devicePixelRatio || 1);
  if (w === cssW && h === cssH && d === dpr) return;
  cssW = w;
  cssH = h;
  dpr = d;
  canvas.width = Math.round(w * d);
  canvas.height = Math.round(h * d);
}

function listen(on: boolean): void {
  if (typeof window === 'undefined' || listening === on) return;
  listening = on;
  if (on) {
    window.addEventListener('resize', resize, { passive: true });
    window.visualViewport?.addEventListener('resize', resize, { passive: true });
  } else {
    window.removeEventListener('resize', resize);
    window.visualViewport?.removeEventListener('resize', resize);
  }
}

/**
 * Show/hide the whole overlay. `display:none` rather than opacity so the
 * compositor drops the layer entirely — the point of the idle-cost rule — and
 * the resize listeners come and go with it.
 */
export function setActive(on: boolean): void {
  if (!root || activeNow === on) return;
  activeNow = on;
  root.classList.toggle('is-on', on);
  listen(on);
  if (on) resize();
  else clear();
}

export function isActive(): boolean {
  return activeNow;
}

export function ctx(): CanvasRenderingContext2D | null {
  return ctx2d;
}

export function flashEl(): HTMLDivElement | null {
  return flashPlate;
}

export function floatEl(): HTMLDivElement | null {
  return floatLayer;
}

export function width(): number {
  return cssW;
}

export function height(): number {
  return cssH;
}

export function scale(): number {
  return dpr;
}

export function exists(): boolean {
  return root !== null;
}

/** Clear the whole backing store. One call per painted frame. */
export function clear(): void {
  if (ctx2d && canvas) ctx2d.clearRect(0, 0, canvas.width, canvas.height);
}

/** Remove every node and listener this module ever created. */
export function destroy(): void {
  listen(false);
  root?.remove();
  styleEl?.remove();
  root = null;
  styleEl = null;
  canvas = null;
  ctx2d = null;
  flashPlate = null;
  floatLayer = null;
  activeNow = false;
  cssW = 0;
  cssH = 0;
  dpr = 1;
}
