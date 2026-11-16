/**
 * Every component in the app takes its words from the catalogs
 * (docs/I18N.md). The area tests (homeLobbyStrings, learnArea, ...) guard
 * their own files; this one sweeps every `.tsx` under `src/app`, so a string
 * typed into a component nobody listed, or into a new one, fails here.
 *
 * It looks for the three ways English slips in: text between JSX tags,
 * a literal user-facing attribute, and a literal tab title. Player names,
 * room codes and the product name are not words to translate; the only
 * literals allowed are listed below with the reason.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../../..');
const APP = path.join(ROOT, 'src/app');

/** Files that are not shipped screens. */
const SKIP = new Set([
  // A development contact sheet of the glyph set; not routed anywhere.
  'src/app/components/icons/glyphs/GlyphSheet.tsx',
]);

/** Literal attribute values that are not words to translate. */
const ALLOWED_ATTRIBUTES = new Set([
  'alt=""', // decorative image
  'alt="Coup Online"', // the product name, never translated
]);

function components(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      if (full.includes(`${path.sep}i18n${path.sep}messages`)) continue;
      components(full, out);
    } else if (name.endsWith('.tsx')) {
      const rel = path.relative(ROOT, full).split(path.sep).join('/');
      if (!SKIP.has(rel)) out.push(rel);
    }
  }
  return out;
}

function source(file: string): string {
  return readFileSync(path.join(ROOT, file), 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\s\/\/ .*$/gm, '');
}

/**
 * Text between JSX tags that contains a letter: `>Join room<`, `>Bot · {`.
 * The `>` must close a tag (it follows a name, a quote, a brace or a slash
 * with no space), which keeps comparisons such as `coins > 0 && x` out.
 */
export function jsxText(code: string): string[] {
  const out: string[] = [];
  for (const m of code.matchAll(/(?<=[\w"'}/])>([^<>{};=()`?']*?[A-Za-z][^<>{};=()`?']*?)[<{]/g)) {
    const text = m[1].trim();
    // Code between two JSX values, not text: `</b>,\n second: <i>` (an
    // object of rich-text params) or `: Glyph && <Glyph />` (a ternary).
    if (/^[,:]/.test(text) || /&&|\|\|/.test(text)) continue;
    if (text && !/^&\w+;$/.test(text)) out.push(text);
  }
  return out;
}

export function literalAttributes(code: string): string[] {
  return [...code.matchAll(/\b(title|aria-label|aria-description|aria-valuetext|placeholder|alt)="([^"]*)"/g)]
    .map(m => `${m[1]}="${m[2]}"`)
    .filter(attr => !ALLOWED_ATTRIBUTES.has(attr) && /[A-Za-z]/.test(attr.slice(attr.indexOf('='))));
}

/** `document.title = '...'` with words in it, other than the product name. */
export function literalTitles(code: string): string[] {
  return [...code.matchAll(/document\.title\s*=\s*(['"`])([^'"`]*)\1/g)]
    .map(m => m[2])
    .filter(title => /[A-Za-z]/.test(title) && title !== 'Coup Online');
}

describe('every component takes its words from the catalogs', () => {
  const files = components(APP);

  it('finds the app', () => {
    expect(files.length).toBeGreaterThan(80);
    expect(files).toContain('src/app/components/game/GameTable.tsx');
  });

  for (const file of files) {
    it(file, () => {
      const code = source(file);
      expect(jsxText(code), 'JSX text').toEqual([]);
      expect(literalAttributes(code), 'attributes').toEqual([]);
      expect(literalTitles(code), 'tab title').toEqual([]);
    });
  }

  it('the checks catch what they guard against', () => {
    expect(jsxText('<button>Join room</button><span className="x">Bot · {n}</span>')).toEqual(['Join room', 'Bot ·']);
    expect(jsxText('{me.coins > 0 && <b />}{x.length > 1 ? a : b}')).toEqual([]);
    expect(jsxText("{ first: <b>{a}</b>,\n second: <i>{b}</i> }{c ? <x /> : Glyph && <Glyph />}")).toEqual([]);
    expect(literalAttributes('<b aria-label="Close" title={t(\'x\')} /><img alt="" /><i placeholder="CODE" />'))
      .toEqual(['aria-label="Close"', 'placeholder="CODE"']);
    expect(literalTitles("document.title = 'Your turn'; document.title = 'Coup Online';")).toEqual(['Your turn']);
  });
});
