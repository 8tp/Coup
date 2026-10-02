/**
 * Test doubles for the motion engine.
 *
 * The suite runs in vitest's default node environment (no jsdom), which is
 * deliberate: `src/app/anim` is typed against the smallest DOM surface it
 * actually uses, so it can be driven by plain objects here and by real
 * `HTMLElement`s in the app. These fakes also record every write, which is how
 * the quantisation tests count them.
 */

import type { FlightElement, FlightStyle } from '@/app/anim/flight';
import type { MeasurableElement, RectLike } from '@/app/anim/flip';

export interface StyleWrite {
  property: string;
  value: string | null;
}

export class FakeStyle implements FlightStyle {
  readonly props = new Map<string, string>();
  readonly writes: StyleWrite[] = [];

  setProperty(property: string, value: string): void {
    this.props.set(property, value);
    this.writes.push({ property, value });
  }

  removeProperty(property: string): void {
    this.props.delete(property);
    this.writes.push({ property, value: null });
  }

  getPropertyValue(property: string): string {
    return this.props.get(property) ?? '';
  }
}

export class FakeElement implements MeasurableElement {
  isConnected = true;
  readonly style = new FakeStyle();
  offsetWidth = 100;
  rect: RectLike = { left: 0, top: 0, width: 100, height: 140 };

  getBoundingClientRect(): RectLike {
    return this.rect;
  }

  /** Number of property writes since the marker, for the write-budget tests. */
  writeCount(): number {
    return this.style.writes.length;
  }

  num(property: string): number {
    return parseFloat(this.style.getPropertyValue(property));
  }
}

export function el(): FakeElement {
  return new FakeElement();
}

export function asFlightElement(e: FakeElement): FlightElement {
  return e;
}

/* ── a rAF the test drives by hand ───────────────────────────────────────── */

export interface RafHarness {
  /** Advance one frame of `ms`, running whatever the clock scheduled. */
  frame(ms: number): void;
  /** Advance `total` ms in `stepMs` slices. */
  run(total: number, stepMs?: number): void;
  /** Jump the timestamp without slicing — a backgrounded tab. */
  stall(ms: number): void;
  pending(): number;
  elapsedMs(): number;
  restore(): void;
}

interface RafGlobals {
  requestAnimationFrame?: (cb: (t: number) => void) => number;
  cancelAnimationFrame?: (id: number) => void;
}

/**
 * Install a deterministic requestAnimationFrame. Never uses real timers: a test
 * that waits on a real frame is a test that flakes on a loaded CI box.
 */
export function installRaf(): RafHarness {
  const g = globalThis as RafGlobals;
  const prevRaf = g.requestAnimationFrame;
  const prevCancel = g.cancelAnimationFrame;

  const scheduled = new Map<number, (t: number) => void>();
  let nextId = 1;
  let t = 0;

  g.requestAnimationFrame = (cb: (time: number) => void): number => {
    const id = nextId++;
    scheduled.set(id, cb);
    return id;
  };
  g.cancelAnimationFrame = (id: number): void => {
    scheduled.delete(id);
  };

  const fire = (): void => {
    if (scheduled.size === 0) return;
    const due = Array.from(scheduled.entries());
    scheduled.clear();
    for (const [, cb] of due) cb(t);
  };

  return {
    frame(ms: number): void {
      t += ms;
      fire();
    },
    run(total: number, stepMs = 16): void {
      let left = total;
      while (left > 0) {
        const s = Math.min(stepMs, left);
        t += s;
        left -= s;
        fire();
      }
    },
    stall(ms: number): void {
      t += ms;
      fire();
    },
    pending(): number {
      return scheduled.size;
    },
    elapsedMs(): number {
      return t;
    },
    restore(): void {
      scheduled.clear();
      if (prevRaf) g.requestAnimationFrame = prevRaf;
      else delete g.requestAnimationFrame;
      if (prevCancel) g.cancelAnimationFrame = prevCancel;
      else delete g.cancelAnimationFrame;
    },
  };
}
