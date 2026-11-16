/**
 * Message integrity beyond the completeness report (catalogs.test.ts): for
 * every message in every locale,
 *
 * - each plural uses only categories its language has (an Arabic `few` in
 *   Chinese, or a `one` in Vietnamese, can never be chosen and hides a
 *   mistake), plus exact `=N` matches;
 * - each select uses only branch names the English select on the same
 *   argument offers, since those are the only values the app passes
 *   (`you` and `other` for players); a misspelt branch is dead text;
 * - it renders without throwing and without a leftover `{placeholder}` at
 *   boundary counts and for player names full of ICU and HTML syntax, quotes,
 *   emoji and right-to-left text.
 */
import { describe, expect, it } from 'vitest';
import en from '@/app/i18n/messages/en';
import { CATALOG_LOADERS } from '@/app/i18n/registry';
import { LOCALES, type Locale } from '@/shared/i18n/locales';
import { formatToParts, formatToString, parseMessage } from '@/shared/i18n/messageFormat';

type AstNode = ReturnType<typeof parseMessage>[number];
type Catalog = Record<string, Record<string, string | undefined> | undefined>;

const COUNTS = [0, 1, 2, 3, 11, 100];
const NAMES = ['{name}', '<b>x</b>', `O'Brien "Q"`, '😀🎉 Zoë', 'محمد', '#1 }{ <emblem/>', "''", 'אבג 123'];

function flatten(catalog: Catalog): Map<string, string> {
  const out = new Map<string, string>();
  for (const [ns, entries] of Object.entries(catalog)) {
    for (const [key, message] of Object.entries(entries ?? {})) {
      if (typeof message === 'string' && message !== '') out.set(`${ns}.${key}`, message);
    }
  }
  return out;
}

interface Shape {
  plurals: Map<string, string[][]>;
  selects: Map<string, Set<string>>;
  args: Set<string>;
  tags: Set<string>;
}

function shape(message: string): Shape {
  const s: Shape = { plurals: new Map(), selects: new Map(), args: new Set(), tags: new Set() };
  const walk = (nodes: AstNode[]) => {
    for (const n of nodes) {
      if (typeof n === 'string' || n.t === 'pound') continue;
      if (n.t === 'tag') { s.tags.add(n.name); walk(n.children); continue; }
      s.args.add(n.name);
      if (n.t === 'plural') {
        s.plurals.set(n.name, [...(s.plurals.get(n.name) ?? []), Object.keys(n.options)]);
        Object.values(n.options).forEach(walk);
      } else if (n.t === 'select') {
        const set = s.selects.get(n.name) ?? new Set<string>();
        Object.keys(n.options).forEach(k => set.add(k));
        s.selects.set(n.name, set);
        Object.values(n.options).forEach(walk);
      }
    }
  };
  walk(parseMessage(message));
  return s;
}

/** Every combination of params the app can pass for a message, at one count and one name. */
function paramSets(source: Shape, translation: Shape, count: number, name: string): Array<Record<string, unknown>> {
  const base: Record<string, unknown> = {};
  for (const tag of new Set([...source.tags, ...translation.tags])) base[tag] = () => ({ rich: tag });
  const numeric = new Set([...source.plurals.keys(), ...translation.plurals.keys()]);
  for (const a of source.args) {
    if (numeric.has(a)) base[a] = count;
    else if (!source.selects.has(a)) base[a] = name;
  }
  let sets = [base];
  for (const [a, branches] of source.selects) {
    if (numeric.has(a)) continue;
    sets = sets.flatMap(p => [...branches].map(b => ({ ...p, [a]: b === 'other' ? name : b })));
  }
  return sets;
}

const locales: Array<[Locale, () => Promise<{ default: unknown }>]> = [
  ['en', async () => ({ default: en })],
  ...(Object.entries(CATALOG_LOADERS) as Array<[Locale, () => Promise<{ default: unknown }>]>),
];
const english = flatten(en as Catalog);

describe.each(locales)('%s messages', (locale, load) => {
  const intl = LOCALES[locale].intl;
  const categories = new Set<string>(new Intl.PluralRules(intl).resolvedOptions().pluralCategories);

  it('use only plural categories the language has and select branches English offers', async () => {
    const problems: string[] = [];
    for (const [key, message] of flatten((await load()).default as Catalog)) {
      const source = english.get(key);
      if (source === undefined) continue;
      const own = shape(message);
      const src = shape(source);
      for (const [arg, lists] of own.plurals) {
        for (const list of lists) {
          const unusable = list.filter(c => !c.startsWith('=') && !categories.has(c));
          if (unusable.length) problems.push(`${key}: plural ${arg} has ${unusable.join(', ')}`);
        }
      }
      for (const [arg, branches] of own.selects) {
        const allowed = src.selects.get(arg) ?? new Set(['you', 'other']);
        const unknown = [...branches].filter(b => !allowed.has(b));
        if (unknown.length) problems.push(`${key}: select ${arg} has ${unknown.join(', ')}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('render at boundary counts and with hostile names, with no param left unfilled', async () => {
    const problems = new Set<string>();
    for (const [key, message] of flatten((await load()).default as Catalog)) {
      const source = english.get(key);
      if (source === undefined) continue;
      const own = shape(message);
      const src = shape(source);
      for (const count of COUNTS) {
        for (const name of NAMES) {
          for (const params of paramSets(src, own, count, name)) {
            const missing: string[] = [];
            try {
              const text = formatToString(message, params, { locale: intl, onMissing: m => missing.push(m) });
              formatToParts(message, params, { locale: intl });
              if (missing.length) problems.add(`${key}: missing ${missing.join(', ')}`);
              if (/\{[A-Za-z_]+\}/.test(text.split(name).join(''))) problems.add(`${key}: placeholder left in "${text}"`);
            } catch (err) {
              problems.add(`${key}: throws ${(err as Error).message}`);
            }
          }
        }
      }
    }
    expect([...problems]).toEqual([]);
  });
});
