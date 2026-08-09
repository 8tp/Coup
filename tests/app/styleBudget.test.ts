import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';

/**
 * ART-DIRECTION.md §2.3 / §3.1 / §8 — the ship-gate ratchet.
 *
 * Two of the §8 gate lines are counted, not argued:
 *
 *   "Every text token >= 4.5:1 on every ground it appears on"
 *   "Zero `border: 1px solid` / `border-2` on table furniture"
 *
 * A sweep with no gate silently regrows, so the counts are asserted here.
 * The budgets are what the sweep actually achieved, NOT zero — every unit
 * still on the books is listed below with the reason it is still there. A
 * budget of zero would be a lie that fails on the next commit; a budget at
 * the true number is a ratchet that only ever tightens.
 *
 * If you are *reducing* one of these, lower the budget in the same commit.
 * If a number needs to go up, that is the conversation this file exists to
 * force.
 */

const APP_DIR = path.resolve(__dirname, '../../src/app');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else if (/\.(tsx?|css)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/** Comments are documentation, not shipped CSS — §8 counts what renders. */
function stripComments(source: string, file: string): string {
  if (file.endsWith('.css')) return source.replace(/\/\*[\s\S]*?\*\//g, '');
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

interface Hit {
  file: string;
  line: number;
  text: string;
}

function scan(predicate: (line: string) => boolean): Hit[] {
  const hits: Hit[] = [];
  for (const file of walk(APP_DIR)) {
    const rel = path.relative(APP_DIR, file);
    const lines = stripComments(readFileSync(file, 'utf8'), file).split('\n');
    lines.forEach((text, i) => {
      if (predicate(text)) hits.push({ file: rel, line: i + 1, text: text.trim() });
    });
  }
  return hits;
}

function describeHits(hits: Hit[]): string {
  return hits.map(h => `${h.file}:${h.line}  ${h.text.slice(0, 110)}`).join('\n');
}

describe('ART-DIRECTION §8 — text contrast budget', () => {
  /**
   * Computed on `--raised` #22302b, the worst ground any of these lands on:
   *   text-gray-500 #6b7280  2.85:1   FAIL
   *   text-gray-600 #4b5563  1.82:1   FAIL
   *   text-gray-700 #374151  1.34:1   FAIL
   *   text-coup-ink-mute #9fada6  5.90:1  pass
   *   text-gray-400 #9ca3af  5.42:1  pass  (left alone, §8 note)
   *   text-gray-300 #d1d5db  9.34:1  pass  (left alone)
   *
   * Budget 4: three `text-gray-500` and one `text-gray-600` survive, all four
   * inside ActionBar/PlayerSeat/GameTable, which were owned by a concurrent
   * change when this sweep ran. Nothing else in src/app may use them.
   */
  const FAILING_TEXT_BUDGET = 4;

  it('uses no grey text utility that falls below 4.5:1', () => {
    const hits = scan(l => /\btext-gray-(500|600|700)\b/.test(l));
    expect(
      hits.length,
      `Sub-4.5:1 grey text utilities found (budget ${FAILING_TEXT_BUDGET}). ` +
        `Use text-coup-ink-mute (#9fada6, 5.90:1 on --raised) or text-coup-ink.\n${describeHits(hits)}`,
    ).toBeLessThanOrEqual(FAILING_TEXT_BUDGET);
  });

  it('uses no placeholder colour below 4.5:1', () => {
    const hits = scan(l => /placeholder-gray-(500|600|700)\b/.test(l));
    expect(hits.length, describeHits(hits)).toBe(0);
  });
});

describe('ART-DIRECTION §3.1 — table furniture is debossed, never outlined', () => {
  /**
   * Budget 7. What is left, and why:
   *   globals.css `.btn-secondary` and `.input-field`  — CONTROLS, not panels.
   *     §3.1 is about panels; §5 gives pressables their own hard-offset
   *     language, so they keep a stroke until §5 lands on them.
   *   PlayerSeat.tsx x1, GameTable.tsx x3, ActionBar.tsx x1 — owned by a
   *     concurrent change when this sweep ran.
   * Every other `border-gray-*` in src/app is gone: panels take `.panel-sunk`
   * (the §5 deboss at the 2px furniture radius) and the surviving hairlines
   * are tokenised to `--line` via `border-coup-line`.
   */
  const BORDER_GRAY_BUDGET = 7;

  it('has no untokenised grey border outside the known exemptions', () => {
    const hits = scan(l => /\bborder-gray-\d/.test(l));
    expect(
      hits.length,
      `border-gray-* utilities found (budget ${BORDER_GRAY_BUDGET}). ` +
        `Panels get .panel-sunk; hairlines get border-coup-line.\n${describeHits(hits)}`,
    ).toBeLessThanOrEqual(BORDER_GRAY_BUDGET);
  });

  /**
   * The §8 proxy metric: one source line carrying BOTH a `rounded-*` and a
   * `border` utility is the rounded-rect-plus-stroke web-app tell.
   *
   * Budget 61, down from 96 at the start of this sweep and 110 when §8 was
   * written. It is not lower because the remainder are deliberately NOT
   * panels: bordered pressables (§5's language, not §3.1's), rounded-full
   * badge pills (§3.9, a separate fix), card mock-ups in the tutorials (§5
   * puts cards at 6px with a paper shadow, and the card frame lives in
   * CardFace), and the Reformation faction demo plates, which must keep
   * whatever language PlayerSeat uses or the tutorial stops teaching the
   * game. Ratchet this down as each of those sections lands.
   */
  const ROUNDED_PLUS_BORDER_BUDGET = 61;

  it('holds the rounded-rect + stroke line count', () => {
    const hits = scan(l => /rounded-[a-z0-9]+/.test(l) && /\bborder\b|border-\d/.test(l));
    expect(
      hits.length,
      `rounded-* + border lines found (budget ${ROUNDED_PLUS_BORDER_BUDGET}).\n${describeHits(hits)}`,
    ).toBeLessThanOrEqual(ROUNDED_PLUS_BORDER_BUDGET);
  });

  it('keeps the shared debossed-panel class in globals.css', () => {
    const css = readFileSync(path.join(APP_DIR, 'globals.css'), 'utf8');
    expect(css).toContain('.panel-sunk');
    expect(css).toContain('--deboss');
  });
});
