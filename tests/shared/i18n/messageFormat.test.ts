import { describe, expect, it } from 'vitest';
import {
  formatListToParts,
  formatToParts,
  formatToString,
  messageArguments,
  MessageSyntaxError,
  parseMessage,
  selectable,
} from '@/shared/i18n/messageFormat';
import { pseudoAccent, pseudoBidi } from '@/shared/i18n/pseudo';

const en = { locale: 'en' };
const coins = '{n, plural, one {# coin} other {# coins}}';

describe('messageFormat: interpolation', () => {
  it('interpolates strings and numbers', () => {
    expect(formatToString('Hello {name}, you have {n}.', { name: 'Ana', n: 1234 }, en)).toBe('Hello Ana, you have 1,234.');
  });

  it('formats {n, number} in the locale', () => {
    expect(formatToString('{n, number}', { n: 1234.5 }, { locale: 'pt-BR' })).toBe('1.234,5');
    expect(formatToString('{n, number}', { n: 7 }, { locale: 'ar-u-nu-latn' })).toBe('7');
  });

  it('leaves a visible placeholder and reports a missing param', () => {
    const missing: string[] = [];
    expect(formatToString('Hi {name}', {}, { locale: 'en', onMissing: n => missing.push(n) })).toBe('Hi {name}');
    expect(missing).toEqual(['name']);
  });

  it('keeps English apostrophes literal and supports ICU quoting', () => {
    expect(formatToString("{a}'s turn. Can't stop.", { a: 'Bo' }, en)).toBe("Bo's turn. Can't stop.");
    expect(formatToString("It''s '{literal}' braces", {}, en)).toBe("It's {literal} braces");
  });

  it('rejects malformed messages', () => {
    expect(() => parseMessage('{n, plural, one {x}}')).toThrow(MessageSyntaxError);
    expect(() => parseMessage('{n, sideways, other {x}}')).toThrow(MessageSyntaxError);
    expect(() => parseMessage('<b>open')).toThrow(MessageSyntaxError);
  });

  it('lists the arguments and tags a message uses', () => {
    const { args, tags } = messageArguments('<b>{a}</b> {n, plural, one {# {c}} other {#}} {s, select, x {} other {{d}}}');
    expect([...args].sort()).toEqual(['a', 'c', 'd', 'n', 's']);
    expect([...tags]).toEqual(['b']);
  });
});

describe('messageFormat: plurals through Intl.PluralRules', () => {
  const plural = (locale: string, n: number, message = '{n, plural, zero {zero} one {one} two {two} few {few} many {many} other {other}}') =>
    formatToString(message, { n }, { locale });

  it('English: one and other, with # as the formatted number', () => {
    expect(formatToString(coins, { n: 1 }, en)).toBe('1 coin');
    expect(formatToString(coins, { n: 0 }, en)).toBe('0 coins');
    expect(formatToString(coins, { n: 2 }, en)).toBe('2 coins');
    expect(formatToString(coins, { n: 1000 }, en)).toBe('1,000 coins');
  });

  it('exact =N branches win over categories', () => {
    expect(formatToString('{n, plural, =0 {none} one {# coin} other {# coins}}', { n: 0 }, en)).toBe('none');
  });

  it('Arabic: all six categories', () => {
    const ar = 'ar-u-nu-latn';
    expect(plural(ar, 0)).toBe('zero');
    expect(plural(ar, 1)).toBe('one');
    expect(plural(ar, 2)).toBe('two');
    expect(plural(ar, 3)).toBe('few');
    expect(plural(ar, 10)).toBe('few');
    expect(plural(ar, 11)).toBe('many');
    expect(plural(ar, 99)).toBe('many');
    expect(plural(ar, 100)).toBe('other');
    expect(formatToString('{n, plural, zero {لا عملات} one {عملة واحدة} two {عملتان} few {# عملات} many {# عملة} other {# عملة}}', { n: 3 }, { locale: ar })).toBe('3 عملات');
  });

  it('Vietnamese: a single category, other', () => {
    for (const n of [0, 1, 2, 5, 21]) expect(plural('vi', n)).toBe('other');
    expect(formatToString('{n, plural, other {# đồng xu}}', { n: 1 }, { locale: 'vi' })).toBe('1 đồng xu');
  });

  it('Hindi: one covers 0 and 1, other the rest', () => {
    expect(plural('hi', 0)).toBe('one');
    expect(plural('hi', 1)).toBe('one');
    expect(plural('hi', 2)).toBe('other');
    expect(plural('hi', 10)).toBe('other');
    expect(formatToString('{n, plural, one {# सिक्का} other {# सिक्के}}', { n: 2 }, { locale: 'hi' })).toBe('2 सिक्के');
  });

  it('Chinese and Brazilian Portuguese', () => {
    expect(plural('zh-Hans', 1)).toBe('other');
    expect(plural('pt-BR', 0)).toBe('one');
    expect(plural('pt-BR', 2)).toBe('other');
  });
});

describe('messageFormat: select and rich text', () => {
  const take = '{actor, select, you {You take} other {{actor} takes}} Income.';

  it('selects on a selectable while interpolating its value', () => {
    expect(formatToString(take, { actor: selectable('Ana', 'other') }, en)).toBe('Ana takes Income.');
    expect(formatToString(take, { actor: selectable('you', 'you') }, en)).toBe('You take Income.');
  });

  it('keeps rich values as parts in sentence order', () => {
    const node = { type: 'strong', name: 'Ana' };
    const parts = formatToParts('{actor} blocks with {character}.', { actor: node, character: 'Duke' }, en);
    expect(parts).toEqual([{ rich: node }, ' blocks with Duke.']);
  });

  it('renders tags through a function, children formatted', () => {
    const parts = formatToParts('Pay <b>{n, plural, one {# coin} other {# coins}}</b> now', {
      n: 3,
      b: (children: unknown[]) => ({ rich: { bold: children } }),
    }, en);
    expect(parts).toEqual(['Pay ', { rich: { bold: ['3 coins'] } }, ' now']);
    expect(formatToString('Pay <b>{n, number}</b> now', { n: 3 }, en)).toBe('Pay 3 now');
  });

  it('self-closing tags render with no children', () => {
    expect(formatToParts('A<sep/>B', { sep: () => ({ rich: '|' }) }, en)).toEqual(['A', { rich: '|' }, 'B']);
  });

  it('renderNumber styles every number, # included', () => {
    const parts = formatToParts(coins, { n: 2 }, { locale: 'en', renderNumber: s => ({ rich: `[${s}]` }) });
    expect(parts).toEqual([{ rich: '[2]' }, ' coins']);
  });

  it('transformLiteral rewrites catalog text only, never params', () => {
    const out = formatToString('{name} takes Income', { name: 'Ana' }, { locale: 'en', transformLiteral: pseudoAccent });
    expect(out.startsWith('Ana ')).toBe(true);
    expect(out).toContain('ţááķéé');
  });
});

describe('lists', () => {
  it('uses the locale conjunction and keeps rich items', () => {
    expect(formatListToParts(['A', 'B', 'C'], 'en').join('')).toBe('A, B, and C');
    expect(formatListToParts(['A', 'B'], 'es').join('')).toBe('A y B');
    const node = { rich: 'X' };
    expect(formatListToParts(['A', node], 'en')).toEqual(['A', ' and ', node]);
  });
});

describe('pseudo-locales', () => {
  it('accents and lengthens', () => {
    const out = pseudoAccent('Steal 2 coins');
    expect(out).not.toMatch(/[a-z]{2}/);
    expect(out.length).toBeGreaterThan('Steal 2 coins'.length * 1.25);
  });

  it('wraps bidi text in an override', () => {
    expect(pseudoBidi('Log')).toBe('\u2067\u202eLog\u202c\u2069');
    expect(pseudoBidi(' ')).toBe(' ');
  });
});
