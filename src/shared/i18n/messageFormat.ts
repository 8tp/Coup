/**
 * A small ICU MessageFormat subset, enough for this game and no more.
 *
 *   Hello {name}                      interpolation
 *   {count, number}                   locale number formatting
 *   {count, plural, =0 {none} one {# coin} other {# coins}}
 *                                     plurals through Intl.PluralRules (all six
 *                                     Arabic categories work); `#` is the number
 *   {actor, select, you {You take} other {{actor} takes}}
 *                                     select on a string, or on a `selectable()`
 *   <b>bold {name}</b>, <emblem/>     rich-text tags, rendered by a function
 *                                     passed under the tag's name
 *
 * Apostrophes follow ICU's "double optional" rule: `'` is literal unless it is
 * followed by `{`, `}`, `<`, `>`, `#` or another `'`. So "{actor}'s turn" and
 * "can't" need no escaping, `''` is one apostrophe, and `'{'` is a literal brace.
 *
 * Pure, no DOM, no React: the server, tests and scripts can format too. The
 * React layer (`src/app/i18n`) passes React nodes as values and tag renderers.
 */

export type Part = string | { readonly rich: unknown };

type Node =
  | string
  | { t: 'arg'; name: string; style?: 'number' }
  | { t: 'pound' }
  | { t: 'plural'; name: string; options: Record<string, Node[]> }
  | { t: 'select'; name: string; options: Record<string, Node[]> }
  | { t: 'tag'; name: string; children: Node[] };

export class MessageSyntaxError extends Error {}

const SELECTABLE = Symbol('selectable');

/** A value that renders as `value` but is matched by `select` as `selector`. */
export interface Selectable<V = unknown> {
  readonly [SELECTABLE]: true;
  readonly selector: string;
  readonly value: V;
}

export function selectable<V>(value: V, selector: string): Selectable<V> {
  return { [SELECTABLE]: true, selector, value };
}

function isSelectable(v: unknown): v is Selectable {
  return typeof v === 'object' && v !== null && (v as Record<symbol, unknown>)[SELECTABLE] === true;
}

// ─── Parser ───

const SPECIAL_AFTER_APOSTROPHE = new Set(['{', '}', '<', '>', '#', "'"]);

class Parser {
  i = 0;
  constructor(private readonly src: string) {}

  parse(): Node[] {
    const nodes = this.message(false, null);
    if (this.i < this.src.length) throw this.error(`unexpected "${this.src[this.i]}"`);
    return nodes;
  }

  private error(msg: string): MessageSyntaxError {
    return new MessageSyntaxError(`${msg} at ${this.i} in "${this.src}"`);
  }

  /** Parse until an unmatched `}` (sub-message) or `</closeTag>`. */
  private message(inPlural: boolean, closeTag: string | null): Node[] {
    const out: Node[] = [];
    let text = '';
    const flush = () => { if (text) { out.push(text); text = ''; } };
    const src = this.src;
    while (this.i < src.length) {
      const ch = src[this.i];
      if (ch === "'") {
        const next = src[this.i + 1];
        if (next === "'") { text += "'"; this.i += 2; continue; }
        if (next !== undefined && SPECIAL_AFTER_APOSTROPHE.has(next)) {
          // Quoted literal until the next lone apostrophe.
          this.i += 1;
          while (this.i < src.length) {
            if (src[this.i] === "'") {
              if (src[this.i + 1] === "'") { text += "'"; this.i += 2; continue; }
              this.i += 1;
              break;
            }
            text += src[this.i++];
          }
          continue;
        }
        text += ch; this.i += 1; continue;
      }
      if (ch === '{') { flush(); out.push(this.argument(inPlural)); continue; }
      if (ch === '}') break;
      if (ch === '#' && inPlural) { flush(); out.push({ t: 'pound' }); this.i += 1; continue; }
      if (ch === '<') {
        if (closeTag !== null && src.startsWith(`</${closeTag}>`, this.i)) break;
        const tag = /^<([A-Za-z][\w-]*)(\/?)>/.exec(src.slice(this.i));
        if (tag) {
          flush();
          this.i += tag[0].length;
          if (tag[2] === '/') { out.push({ t: 'tag', name: tag[1], children: [] }); continue; }
          const children = this.message(inPlural, tag[1]);
          if (!src.startsWith(`</${tag[1]}>`, this.i)) throw this.error(`unclosed <${tag[1]}>`);
          this.i += tag[1].length + 3;
          out.push({ t: 'tag', name: tag[1], children });
          continue;
        }
      }
      text += ch; this.i += 1;
    }
    flush();
    return out;
  }

  private skipWs(): void {
    while (this.i < this.src.length && /\s/.test(this.src[this.i])) this.i += 1;
  }

  private word(): string {
    this.skipWs();
    const m = /^[^\s{},]+/.exec(this.src.slice(this.i));
    if (!m) throw this.error('expected a name');
    this.i += m[0].length;
    this.skipWs();
    return m[0];
  }

  private expect(ch: string): void {
    if (this.src[this.i] !== ch) throw this.error(`expected "${ch}"`);
    this.i += 1;
  }

  private argument(inPlural: boolean): Node {
    this.expect('{');
    const name = this.word();
    if (this.src[this.i] === '}') { this.i += 1; return { t: 'arg', name }; }
    this.expect(',');
    const type = this.word();
    if (type === 'number') {
      if (this.src[this.i] === ',') { this.i += 1; this.word(); }
      this.expect('}');
      return { t: 'arg', name, style: 'number' };
    }
    if (type !== 'plural' && type !== 'select') throw this.error(`unknown argument type "${type}"`);
    this.expect(',');
    const options: Record<string, Node[]> = {};
    this.skipWs();
    while (this.src[this.i] !== '}') {
      if (this.i >= this.src.length) throw this.error('unterminated argument');
      const key = this.word();
      this.expect('{');
      options[key] = this.message(type === 'plural' || inPlural, null);
      this.expect('}');
      this.skipWs();
    }
    this.i += 1;
    if (!options.other) throw this.error(`"${name}" ${type} needs an "other" branch`);
    return { t: type, name, options };
  }
}

const parseCache = new Map<string, Node[]>();

export function parseMessage(message: string): Node[] {
  let ast = parseCache.get(message);
  if (!ast) {
    ast = new Parser(message).parse();
    parseCache.set(message, ast);
  }
  return ast;
}

/** Names of every argument and tag a message uses (for catalog checks). */
export function messageArguments(message: string): { args: Set<string>; tags: Set<string> } {
  const args = new Set<string>();
  const tags = new Set<string>();
  const walk = (nodes: Node[]) => {
    for (const n of nodes) {
      if (typeof n === 'string' || n.t === 'pound') continue;
      if (n.t === 'tag') { tags.add(n.name); walk(n.children); continue; }
      args.add(n.name);
      if (n.t === 'plural' || n.t === 'select') Object.values(n.options).forEach(walk);
    }
  };
  walk(parseMessage(message));
  return { args, tags };
}

// ─── Formatter ───

export type TagRenderer = (children: Part[]) => Part;

export interface FormatOptions {
  /** BCP 47 tag for Intl. */
  locale: string;
  /** Rewrites literal text only (never argument values). Used by the pseudo-locale. */
  transformLiteral?: (text: string) => string;
  /** Renders a formatted number (plural `#`, `{n, number}`, numeric args). Defaults to the string. */
  renderNumber?: (formatted: string, name: string, value: number) => Part;
  /** Called when a message references a parameter that was not passed. */
  onMissing?: (name: string) => void;
}

const pluralRulesCache = new Map<string, Intl.PluralRules>();
const numberFormatCache = new Map<string, Intl.NumberFormat>();

function pluralRules(locale: string): Intl.PluralRules {
  let r = pluralRulesCache.get(locale);
  if (!r) { r = new Intl.PluralRules(locale); pluralRulesCache.set(locale, r); }
  return r;
}

export function numberFormat(locale: string): Intl.NumberFormat {
  let f = numberFormatCache.get(locale);
  if (!f) { f = new Intl.NumberFormat(locale); numberFormatCache.set(locale, f); }
  return f;
}

/**
 * Format to parts: strings, plus whatever non-string values and tag renderers
 * returned (React nodes in the app). Adjacent strings are merged.
 */
export function formatToParts(message: string, params: Readonly<Record<string, unknown>>, opts: FormatOptions): Part[] {
  const out: Part[] = [];
  const push = (p: Part | Part[]) => {
    for (const x of Array.isArray(p) ? p : [p]) {
      if (typeof x === 'string') {
        if (!x) continue;
        const last = out.length - 1;
        if (last >= 0 && typeof out[last] === 'string') out[last] = (out[last] as string) + x;
        else out.push(x);
      } else {
        out.push(x);
      }
    }
  };
  render(parseMessage(message), params, opts, null, push);
  return out;
}

/** Format to a plain string. Rich values are stringified; tags keep their text. */
export function formatToString(message: string, params: Readonly<Record<string, unknown>>, opts: FormatOptions): string {
  const plainParams: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) plainParams[k] = typeof v === 'function' ? undefined : v;
  return formatToParts(message, plainParams, { ...opts, renderNumber: undefined })
    .map(p => (typeof p === 'string' ? p : String((p as { rich: unknown }).rich)))
    .join('');
}

function formatNumberValue(value: number, name: string, opts: FormatOptions): Part {
  const s = numberFormat(opts.locale).format(value);
  return opts.renderNumber ? opts.renderNumber(s, name, value) : s;
}

function valueToParts(value: unknown, name: string, opts: FormatOptions): Part {
  const v = isSelectable(value) ? value.value : value;
  if (typeof v === 'number') return formatNumberValue(v, name, opts);
  if (typeof v === 'string') return v;
  if (v === null || v === undefined || typeof v === 'boolean') return '';
  return { rich: v };
}

function render(
  nodes: Node[],
  params: Readonly<Record<string, unknown>>,
  opts: FormatOptions,
  plural: { value: number; name: string } | null,
  push: (p: Part | Part[]) => void,
): void {
  for (const n of nodes) {
    if (typeof n === 'string') { push(opts.transformLiteral ? opts.transformLiteral(n) : n); continue; }
    switch (n.t) {
      case 'pound':
        if (plural) push(formatNumberValue(plural.value, plural.name, opts));
        break;
      case 'arg': {
        const value = params[n.name];
        if (value === undefined) { opts.onMissing?.(n.name); push(`{${n.name}}`); break; }
        if (n.style === 'number') {
          const num = Number(isSelectable(value) ? value.value : value);
          push(formatNumberValue(num, n.name, opts));
        } else {
          const part = valueToParts(value, n.name, opts);
          push(part);
        }
        break;
      }
      case 'plural': {
        const raw = params[n.name];
        if (raw === undefined) opts.onMissing?.(n.name);
        const value = Number(isSelectable(raw) ? raw.value : raw);
        const exact = n.options[`=${value}`];
        const branch = exact ?? n.options[pluralRules(opts.locale).select(value)] ?? n.options.other;
        render(branch, params, opts, { value, name: n.name }, push);
        break;
      }
      case 'select': {
        const raw = params[n.name];
        if (raw === undefined) opts.onMissing?.(n.name);
        const key = isSelectable(raw) ? raw.selector : String(raw);
        render(n.options[key] ?? n.options.other, params, opts, plural, push);
        break;
      }
      case 'tag': {
        const renderer = params[n.name];
        const children: Part[] = [];
        render(n.children, params, opts, plural, p => {
          for (const x of Array.isArray(p) ? p : [p]) {
            const last = children.length - 1;
            if (typeof x === 'string' && last >= 0 && typeof children[last] === 'string') children[last] = (children[last] as string) + x;
            else if (x !== '') children.push(x);
          }
        });
        if (typeof renderer === 'function') push((renderer as TagRenderer)(children));
        else push(children);
        break;
      }
    }
  }
}

// ─── Lists ───

/**
 * "A, B and C" in the locale's own conjunction and order, keeping each item's
 * part (React nodes stay nodes). Falls back to ", " where Intl.ListFormat is
 * missing.
 */
export function formatListToParts(items: Part[], locale: string, type: 'conjunction' | 'disjunction' = 'conjunction'): Part[] {
  if (items.length === 0) return [];
  if (typeof Intl.ListFormat !== 'function') {
    return items.flatMap((item, i) => (i === 0 ? [item] : [', ', item]));
  }
  const placeholders = items.map((_, i) => `\u0000${i}\u0000`);
  const formatted = new Intl.ListFormat(locale, { style: 'long', type }).formatToParts(placeholders);
  return formatted.map(p => {
    if (p.type === 'element') {
      const index = Number(p.value.slice(1, -1));
      return items[index];
    }
    return p.value;
  });
}
