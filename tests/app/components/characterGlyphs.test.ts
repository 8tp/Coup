import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { Character } from '@/shared/types';
import { CHARACTER_GLYPHS } from '@/app/components/icons';
import { GLYPH_STROKE_HEAVY, GLYPH_STROKE_LIGHT } from '@/app/components/icons/glyphs';

/**
 * ART-DIRECTION.md §1.2's drawing rules, made executable.
 *
 * The eight rules at the top of `src/app/components/icons/glyphs/index.ts` are
 * prose, and prose does not survive a hurried glyph. Most of them are cheap to
 * check mechanically against the source, so they are checked here — including
 * the one rule that is not a style preference but a RULING with a date on it
 * (the Duke vs the winner's crown, below).
 *
 * What this file cannot do is the part §1.2 actually cares about: whether a
 * mark READS at 16px. `BlockGlyph`'s header records a collision that only ever
 * appeared on a proof sheet, and the Duke, Assassin, Captain and Contessa marks
 * in this set were all redrawn after looking at one. Use
 * `glyphs/GlyphSheet.tsx`; do not mistake a green suite for a legible glyph.
 */

const GLYPH_DIR = fileURLToPath(new URL('../../../src/app/components/icons/glyphs', import.meta.url));

const read = (file: string) => readFileSync(`${GLYPH_DIR}/${file}`, 'utf8');

/**
 * The file with its prose removed. These rules govern the MARKUP, and every
 * glyph header in this set explains itself by naming the thing it is not doing
 * — `InquisitorGlyph` says in so many words that the illustration it replaces
 * used `strokeLinejoin="round"` and `<animate>`. Matching raw source would
 * make writing that sentence a test failure, i.e. it would punish exactly the
 * documentation these rules depend on.
 */
const markup = (file: string) =>
  read(file)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const ALL_GLYPH_FILES = readdirSync(GLYPH_DIR).filter(
  (f) => f.endsWith('Glyph.tsx') && f !== 'GlyphBase.tsx',
);

/** The six §1.2 character silhouettes. */
const CHARACTER_GLYPH_FILES: Record<Character, string> = {
  [Character.Duke]: 'DukeGlyph.tsx',
  [Character.Assassin]: 'AssassinGlyph.tsx',
  [Character.Captain]: 'CaptainGlyph.tsx',
  [Character.Ambassador]: 'AmbassadorGlyph.tsx',
  [Character.Contessa]: 'ContessaGlyph.tsx',
  [Character.Inquisitor]: 'InquisitorGlyph.tsx',
};

describe('§1.2 character glyphs — coverage', () => {
  it('gives every character exactly one silhouette', () => {
    for (const character of Object.values(Character)) {
      expect(CHARACTER_GLYPHS[character], `no glyph for ${character}`).toBeTypeOf('function');
    }
  });

  it('never reuses one silhouette for two characters', () => {
    // §1.2 puts the categorical load on shape, and §2.4 records that Assassin
    // and Captain are 1 degree of hue apart. Two characters sharing a mark
    // would leave that pair with no channel at all.
    const seen = new Map<unknown, Character>();
    for (const character of Object.values(Character)) {
      const glyph = CHARACTER_GLYPHS[character];
      const clash = seen.get(glyph);
      expect(clash, `${character} and ${clash} share a silhouette`).toBeUndefined();
      seen.set(glyph, character);
    }
  });

  it('ships each character silhouette as its own file', () => {
    for (const [character, file] of Object.entries(CHARACTER_GLYPH_FILES)) {
      expect(ALL_GLYPH_FILES, `${character}: ${file} missing`).toContain(file);
    }
  });
});

describe('§1.2 drawing rules — the whole glyph set', () => {
  it('uses no third stroke width (rule 1)', () => {
    // Any literal `strokeWidth={n}` is a third weight unless it is one of the
    // two constants. The chassis supplies the heavy weight, so a file should
    // normally only ever name GLYPH_STROKE_LIGHT.
    for (const file of ALL_GLYPH_FILES) {
      const literals = [...markup(file).matchAll(/strokeWidth=\{(\d+(?:\.\d+)?)\}/g)].map((m) =>
        Number(m[1]),
      );
      for (const width of literals) {
        expect([GLYPH_STROKE_HEAVY, GLYPH_STROKE_LIGHT], `${file}: strokeWidth ${width}`).toContain(
          width,
        );
      }
    }
  });

  it('never rounds a cap or a join (rule 2)', () => {
    for (const file of ALL_GLYPH_FILES) {
      expect(markup(file), `${file} overrides the chassis' square corners`).not.toMatch(
        /strokeLine(cap|join)=/,
      );
    }
  });

  it('uses no gradient, blur or soft shadow (rule 3)', () => {
    for (const file of ALL_GLYPH_FILES) {
      expect(markup(file), file).not.toMatch(/linearGradient|radialGradient|feGaussianBlur|filter=/);
    }
  });

  it('tints with a pattern, never with opacity (rule 4)', () => {
    for (const file of ALL_GLYPH_FILES) {
      expect(markup(file), `${file} fades instead of screening`).not.toMatch(
        /fillOpacity|strokeOpacity|\sopacity=/,
      );
    }
  });

  it('hard-codes no colour (rule 5)', () => {
    // The whole set is `currentColor` so a caller can pass the character hue,
    // the brass, or the ink. A hex here is a seventh copy of the palette —
    // exactly what `characterPalette.ts` exists to have deleted.
    for (const file of ALL_GLYPH_FILES) {
      expect(markup(file), `${file} carries a literal colour`).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    }
  });

  it('carries no text and no animation (rule 8)', () => {
    for (const file of ALL_GLYPH_FILES) {
      expect(markup(file), file).not.toMatch(/<text|<animate/);
    }
  });
});

describe('§1.2 THE CROWN RULING (2026-08-08)', () => {
  /**
   * "The crown means the winner." The Duke keeps the fractured crown and the
   * two are separated by SILHOUETTE, not by subject: the winner's is closed,
   * symmetric and sits on a solid base; the Duke's is open-topped, asymmetric,
   * three planes, no base.
   *
   * As drawn, the difference that survives 16px is mass versus line —
   * `CrownGlyph` is one filled slab with an interior, `DukeGlyph` is an open
   * stroked profile with none. That is checkable, so it is checked: these two
   * assertions are what stop a later "tidy-up" from filling the Duke or
   * outlining the crown and quietly collapsing the pair.
   *
   * They are NOT a substitute for the check the ruling actually mandates —
   * "whoever draws the Duke silhouette must check it against CrownGlyph at
   * 16px side by side, on the proof sheet, before it lands."
   */
  it('keeps the winner a filled mass', () => {
    expect(markup('CrownGlyph.tsx')).toMatch(/fill="currentColor"/);
  });

  it('keeps the Duke an open stroked profile with no fill', () => {
    const duke = markup('DukeGlyph.tsx');
    expect(duke, 'a filled Duke collapses the ruling separation').not.toMatch(/fill="currentColor"/);
    expect(duke, 'a closed Duke path is a crown, not a fracture of one').not.toMatch(/\sZ"/);
  });
});
