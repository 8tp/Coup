import { create } from 'zustand';
import { availableLocales, DEFAULT_LOCALE, LOCALES, type Locale } from '@/shared/i18n/locales';
import { formatToParts, formatToString, numberFormat, type FormatOptions, type Part } from '@/shared/i18n/messageFormat';
import { PSEUDO_CLOSE, PSEUDO_OPEN, pseudoTransform } from '@/shared/i18n/pseudo';
import { LOCALE_PENDING_CLASS, LOCALE_PREVIEW_STORAGE_KEY } from '@/shared/i18n/bootScript';
import { buildLocaleTable, resolveLocale } from '@/shared/i18n/matchLocale';
import en from './messages/en';
import { CATALOG_LOADERS } from './registry';
import type { MessageKey, Translation } from './schema';

/**
 * The i18n runtime: which locale is active, which catalogs are loaded, and
 * plain-string translation. React components use `useT()` from `./react`,
 * which re-renders on a language switch; this module's `getT()` is for code
 * outside render (socket handlers, toasts built in callbacks).
 */
export const IS_DEV = process.env.NODE_ENV !== 'production';

interface I18nState {
  /** The locale being rendered. Always one whose catalog is loaded. */
  locale: Locale;
  catalogs: Partial<Record<Locale, Translation>>;
}

export const useI18nStore = create<I18nState>(() => ({ locale: DEFAULT_LOCALE, catalogs: {} }));

const PSEUDO: Partial<Record<Locale, 'accent' | 'bidi'>> = { 'en-XA': 'accent', 'ar-XB': 'bidi' };

function previewEnabled(): boolean {
  try {
    return typeof window !== 'undefined' && localStorage.getItem(LOCALE_PREVIEW_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Languages the picker offers in this build: unfinished ones only in development or preview. */
export function selectableLocales(): Locale[] {
  return availableLocales({ includeDev: IS_DEV, includeInProgress: IS_DEV || previewEnabled() });
}

/** Languages automatic detection may choose: finished translations only. */
export function detectableLocales(): Locale[] {
  return availableLocales({ includeDev: false, includeInProgress: false });
}

export function localeTables() {
  const strict = buildLocaleTable(availableLocales({ includeDev: IS_DEV, includeInProgress: IS_DEV }), detectableLocales());
  const preview = buildLocaleTable(availableLocales({ includeDev: IS_DEV, includeInProgress: true }), detectableLocales());
  return { strict, preview };
}

export function resolvePreferredLocale(saved: string | null): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  return resolveLocale({
    pathname: window.location.pathname,
    saved,
    languages: navigator.languages?.length ? navigator.languages : [navigator.language],
    selectable: selectableLocales(),
    detectable: detectableLocales(),
  });
}

// ─── Lookup ───

const warned = new Set<string>();

function splitKey(key: string): [string, string] {
  const dot = key.indexOf('.');
  return [key.slice(0, dot), key.slice(dot + 1)];
}

/**
 * The raw message for a key and whether it is the locale's own: the locale's
 * text, else English. A fallback is English text, so it is formatted with
 * English plural rules ("1 coin", never "1 coins").
 */
function resolveMessage(locale: Locale, key: MessageKey | string): { message: string; fallback: boolean } | undefined {
  const [ns, k] = splitKey(key);
  const own = (useI18nStore.getState().catalogs[locale] as Record<string, Record<string, string> | undefined> | undefined)?.[ns]?.[k];
  if (own !== undefined && own !== '') return { message: own, fallback: false };
  const english = (en as Record<string, Record<string, string>>)[ns]?.[k];
  if (english === undefined) {
    if (IS_DEV && !warned.has(key)) {
      warned.add(key);
      console.warn(`[i18n] missing key "${key}"`);
    }
    return undefined;
  }
  return { message: english, fallback: !isPseudo(locale) && locale !== DEFAULT_LOCALE };
}

/** The raw message for a key: the locale's own text, else English. */
export function lookupMessage(locale: Locale, key: MessageKey | string): string | undefined {
  return resolveMessage(locale, key)?.message;
}

export function hasMessage(key: string): boolean {
  const [ns, k] = splitKey(key);
  return (en as Record<string, Record<string, string>>)[ns]?.[k] !== undefined;
}

export function formatOptionsFor(locale: Locale): FormatOptions {
  const mode = PSEUDO[locale];
  return {
    locale: LOCALES[locale].intl,
    transformLiteral: mode ? pseudoTransform(mode) : undefined,
    onMissing: IS_DEV ? (name) => {
      if (!warned.has(`param:${name}`)) { warned.add(`param:${name}`); console.warn(`[i18n] missing param "${name}"`); }
    } : undefined,
  };
}

export function isPseudo(locale: Locale): boolean {
  return PSEUDO[locale] !== undefined;
}

/** Format a key to a plain string in a locale. */
export function translateIn(locale: Locale, key: MessageKey, params: Readonly<Record<string, unknown>> = {}): string {
  const found = resolveMessage(locale, key);
  if (found === undefined) return key;
  const text = formatToString(found.message, params, formatOptionsFor(found.fallback ? DEFAULT_LOCALE : locale));
  return isPseudo(locale) && text ? `${PSEUDO_OPEN}${text}${PSEUDO_CLOSE}` : text;
}

/** Format a key to parts (strings and rich values) in a locale. */
export function translatePartsIn(locale: Locale, key: MessageKey, params: Readonly<Record<string, unknown>>, opts?: Partial<FormatOptions>): Part[] {
  const found = resolveMessage(locale, key);
  if (found === undefined) return [key];
  const parts = formatToParts(found.message, params, { ...formatOptionsFor(found.fallback ? DEFAULT_LOCALE : locale), ...opts });
  return isPseudo(locale) && parts.length ? [PSEUDO_OPEN, ...parts, PSEUDO_CLOSE] : parts;
}

export interface PlainTranslator {
  (key: MessageKey, params?: Readonly<Record<string, unknown>>): string;
  locale: Locale;
  number(value: number): string;
}

export function makePlainTranslator(locale: Locale): PlainTranslator {
  const t = ((key: MessageKey, params?: Readonly<Record<string, unknown>>) => translateIn(locale, key, params)) as PlainTranslator;
  t.locale = locale;
  t.number = (value: number) => numberFormat(LOCALES[locale].intl).format(value);
  return t;
}

/** A translator for the active locale, for use outside render. */
export function getT(): PlainTranslator {
  return makePlainTranslator(useI18nStore.getState().locale);
}

// ─── Switching ───

let activation = 0;

/** Load a locale's catalog if needed, then make it active and update <html>. */
export async function activateLocale(locale: Locale): Promise<void> {
  const token = ++activation;
  const loader = CATALOG_LOADERS[locale];
  if (loader && !useI18nStore.getState().catalogs[locale]) {
    try {
      const mod = await loader();
      useI18nStore.setState(s => ({ catalogs: { ...s.catalogs, [locale]: mod.default } }));
    } catch (err) {
      console.error(`[i18n] could not load ${locale}`, err);
      if (token === activation) applyDocumentLocale(useI18nStore.getState().locale);
      return;
    }
  }
  if (token !== activation) return;
  useI18nStore.setState({ locale });
  applyDocumentLocale(locale);
}

export function applyDocumentLocale(locale: Locale): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.lang = locale;
  root.dir = LOCALES[locale].dir;
  // Let the switched render paint before showing the page.
  requestAnimationFrame(() => root.classList.remove(LOCALE_PENDING_CLASS));
}
