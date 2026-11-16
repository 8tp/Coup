import { DEFAULT_LOCALE, LOCALES, SHIPPED_LOCALES, type Locale, isLocale } from './locales';

/**
 * Locale resolution, in this order (docs/I18N.md):
 *
 *   1. an explicit locale as the first URL path segment (`/pt-BR/...`), kept
 *      for translated landing pages; the app's own routes never start with one;
 *   2. the player's saved choice (Settings > Language);
 *   3. the best match from `navigator.languages`;
 *   4. English.
 *
 * Regional variants map to the language we have: any `pt-*` to `pt-BR`, any
 * `es-*` to `es`, `zh`, `zh-CN`, `zh-SG` and `zh-Hans-*` to `zh-Hans`.
 *
 * Traditional Chinese (`zh-TW`, `zh-HK`, `zh-MO`, `zh-Hant-*`) is a WEAK match
 * for `zh-Hans`: those readers can read Simplified, but many would rather read
 * another language they listed, and some find Simplified unwelcome. So the
 * weak match is used only when nothing else in `navigator.languages` matches
 * outright. Ship a `zh-Hant` catalog and it becomes an exact match instead,
 * with no code change here.
 *
 * `resolveLocaleCore` is deliberately self-contained (no imports, no outer
 * references, ES5-style code) because the pre-paint script in `layout.tsx`
 * runs its source via `Function.prototype.toString`, so there is exactly one
 * implementation of these rules. `tests/app/i18n/locale.test.ts` runs both.
 */
export interface LocaleTable {
  /** Real locales that may appear in a URL path. */
  shipped: readonly string[];
  /** Locales a saved or path choice may select. */
  selectable: readonly string[];
  /** Locales automatic detection may select (ready translations only). */
  detectable: readonly string[];
  /** Implied script for a language-region pair with no explicit script, e.g. "zh-tw" → "hant". */
  impliedScripts: Readonly<Record<string, string>>;
  /** Default script of a bare language tag, e.g. "zh" → "hans". */
  defaultScripts: Readonly<Record<string, string>>;
  fallback: string;
}

export interface LocaleInputs {
  pathname?: string | null;
  saved?: string | null;
  languages?: readonly string[] | null;
}

export function resolveLocaleCore(table: LocaleTable, input: LocaleInputs): string {
  function lower(s: string): string { return String(s).toLowerCase(); }
  function has(list: readonly string[], code: string): boolean {
    for (var i = 0; i < list.length; i++) if (list[i] === code) return true;
    return false;
  }
  function findIgnoringCase(list: readonly string[], value: string): string | null {
    var v = lower(value);
    for (var i = 0; i < list.length; i++) if (lower(list[i]) === v) return list[i];
    return null;
  }
  function parse(tag: string): { lang: string; script: string | null; region: string | null } {
    var parts = lower(tag).replace(/_/g, '-').split('-');
    var script: string | null = null;
    var region: string | null = null;
    for (var i = 1; i < parts.length; i++) {
      var p = parts[i];
      if (p.length === 4 && script === null) script = p;
      else if ((p.length === 2 || /^\d{3}$/.test(p)) && region === null) region = p;
    }
    if (script === null && region !== null && table.impliedScripts[parts[0] + '-' + region]) script = table.impliedScripts[parts[0] + '-' + region];
    if (script === null && table.defaultScripts[parts[0]]) script = table.defaultScripts[parts[0]];
    return { lang: parts[0], script: script, region: region };
  }
  function match(tag: string): { locale: string; weak: boolean } | null {
    var norm = String(tag || '').trim();
    if (!norm) return null;
    var exact = findIgnoringCase(table.detectable, norm.replace(/_/g, '-'));
    if (exact) return { locale: exact, weak: false };
    var want = parse(norm);
    var sameLanguage: string | null = null;
    for (var i = 0; i < table.detectable.length; i++) {
      var c = parse(table.detectable[i]);
      if (c.lang !== want.lang) continue;
      if (want.script !== null && c.script === want.script) return { locale: table.detectable[i], weak: false };
      if (sameLanguage === null) sameLanguage = table.detectable[i];
    }
    if (sameLanguage === null) return null;
    var have = parse(sameLanguage);
    return { locale: sameLanguage, weak: want.script !== null && have.script !== null && want.script !== have.script };
  }

  var first = String(input.pathname || '').split('/').filter(function (s) { return s.length > 0; })[0];
  var fromPath = first ? findIgnoringCase(table.shipped, first) : null;
  if (fromPath && has(table.selectable, fromPath)) return fromPath;

  if (input.saved && has(table.selectable, input.saved)) return input.saved;

  var languages = input.languages || [];
  var weak: string | null = null;
  for (var i = 0; i < languages.length; i++) {
    var m = match(languages[i]);
    if (!m) continue;
    if (!m.weak) return m.locale;
    if (weak === null) weak = m.locale;
  }
  return weak !== null ? weak : table.fallback;
}

const IMPLIED_SCRIPTS: Record<string, string> = { 'zh-tw': 'hant', 'zh-hk': 'hant', 'zh-mo': 'hant' };
const DEFAULT_SCRIPTS: Record<string, string> = { zh: 'hans' };

export function buildLocaleTable(selectable: readonly Locale[], detectable: readonly Locale[]): LocaleTable {
  return {
    shipped: SHIPPED_LOCALES,
    selectable,
    detectable: detectable.filter(l => !LOCALES[l].dev),
    impliedScripts: IMPLIED_SCRIPTS,
    defaultScripts: DEFAULT_SCRIPTS,
    fallback: DEFAULT_LOCALE,
  };
}

export interface ResolveLocaleInput extends LocaleInputs {
  /** Locales the player may be put in by a saved or URL choice. */
  selectable: readonly Locale[];
  /** Locales automatic detection may choose. */
  detectable: readonly Locale[];
}

export function resolveLocale(input: ResolveLocaleInput): Locale {
  const result = resolveLocaleCore(buildLocaleTable(input.selectable, input.detectable), input);
  return isLocale(result) ? result : DEFAULT_LOCALE;
}

/** The best locale for `navigator.languages` alone, or null when nothing matches. */
export function matchNavigatorLanguages(languages: readonly string[], candidates: readonly Locale[]): Locale | null {
  const table = { ...buildLocaleTable([], candidates), fallback: '' };
  const result = resolveLocaleCore(table, { languages });
  return isLocale(result) ? result : null;
}

/** The explicit locale in a URL path's first segment, if any (`/pt-BR/rules` → `pt-BR`). */
export function localeFromPath(pathname: string | null | undefined): Locale | null {
  const table = { ...buildLocaleTable(SHIPPED_LOCALES, []), fallback: '' };
  const result = resolveLocaleCore(table, { pathname });
  return isLocale(result) ? result : null;
}
