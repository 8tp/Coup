import { describe, expect, it } from 'vitest';
import { clampToGraphemes, graphemeLength, graphemes, nameKey } from '@/shared/textLimits';

describe('textLimits', () => {
  it('counts user-perceived characters', () => {
    expect(graphemeLength('')).toBe(0);
    expect(graphemeLength('Ana')).toBe(3);
    expect(graphemeLength('李小龙')).toBe(3);
    // Conjuncts and vowel signs join their consonant: 2 or 3 depending on the Unicode version, never 6.
    expect(graphemeLength('प्रिया')).toBeLessThanOrEqual(3);
    expect(graphemeLength('محمد')).toBe(4);
    expect(graphemeLength('👨‍👩‍👧')).toBe(1);
    expect(graphemeLength('🇧🇷')).toBe(1);
    expect(graphemes('Nguyễn')).toHaveLength(6);
  });

  it('clamps without splitting a character', () => {
    expect(clampToGraphemes('Ana', 20)).toBe('Ana');
    expect(clampToGraphemes('प्रिया शर्मा', graphemeLength('प्रिया'))).toBe('प्रिया');
    expect(clampToGraphemes('Ana 👨‍👩‍👧 Bo', 5)).toBe('Ana 👨‍👩‍👧');
    expect(clampToGraphemes('李小龙王', 3)).toBe('李小龙');
  });

  it('compares names case- and width-insensitively', () => {
    expect(nameKey('ＢＯＢ')).toBe(nameKey('bob'));
    expect(nameKey('Nguyễn')).toBe(nameKey('NGUYỄN'));
    expect(nameKey('李小龙')).not.toBe(nameKey('李小虎'));
  });

  it('ignores the invisible joiners a name may keep, so they cannot make a look-alike', () => {
    // validateName keeps one ZWJ/ZWNJ between two visible characters (Indic
    // half forms, emoji sequences), so "B<ZWJ>ob" passes it and renders as "Bob".
    expect(nameKey('B‍ob')).toBe(nameKey('Bob'));
    expect(nameKey('Bo‌b')).toBe(nameKey('bob'));
    expect(nameKey('Bob️')).toBe(nameKey('Bob'));
  });
});
