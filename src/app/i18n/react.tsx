'use client';

import { createContext, Fragment, isValidElement, useContext, useLayoutEffect, useMemo, type ReactNode } from 'react';
import { LOCALES, type Locale } from '@/shared/i18n/locales';
import { formatListToParts, numberFormat, type FormatOptions, type Part } from '@/shared/i18n/messageFormat';
import { plainTranslatorWith, registerCatalog, translatePartsIn, useI18nStore, type PlainTranslator } from './runtime';
import type { MessageKey, Translation } from './schema';

/**
 * Params for `t.rich`: values may be React nodes, and a function under a
 * tag's name renders that tag, for example
 *
 *   t.rich('prompts.challengeOffer', {
 *     actor: <b>{name}</b>,
 *     b: (chunks) => <strong>{chunks}</strong>,
 *   })
 *
 * so a sentence stays one message, with its own word order, in every language.
 */
export type RichParams = Readonly<Record<string, ReactNode | ((chunks: ReactNode) => ReactNode) | unknown>>;

export interface Translator extends PlainTranslator {
  /** Format to React nodes, keeping rich values and tags. */
  rich(key: MessageKey, params?: RichParams, opts?: Pick<FormatOptions, 'renderNumber'>): ReactNode;
  /** "A, B and C" in this language, items may be nodes. */
  list(items: ReactNode[], type?: 'conjunction' | 'disjunction'): ReactNode;
  dir: 'ltr' | 'rtl';
  /** BCP 47 tag for Intl APIs. */
  intl: string;
}

export function partsToNodes(parts: Part[]): ReactNode[] {
  return parts.map((p, i) => {
    if (typeof p === 'string') return p;
    const node = p.rich as ReactNode;
    return isValidElement(node) || Array.isArray(node) ? <Fragment key={i}>{node}</Fragment> : node;
  });
}

function wrapParams(params: RichParams): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(params)) {
    out[name] = typeof value === 'function'
      ? (children: Part[]) => ({ rich: (value as (chunks: ReactNode) => ReactNode)(partsToNodes(children)) })
      : value;
  }
  return out;
}

export function makeTranslator(locale: Locale): Translator {
  return translatorWith(locale, undefined);
}

/** A translator that reads `catalog` (a landing page's) instead of the loaded one, when given. */
export function translatorWith(locale: Locale, catalog: Translation | undefined): Translator {
  const t = plainTranslatorWith(locale, catalog) as Translator;
  t.dir = LOCALES[locale].dir;
  t.intl = LOCALES[locale].intl;
  t.rich = (key, params = {}, opts) => <>{partsToNodes(translatePartsIn(locale, key, wrapParams(params), opts, catalog))}</>;
  t.list = (items, type = 'conjunction') =>
    <>{partsToNodes(formatListToParts(items.map(item => (typeof item === 'string' ? item : { rich: item })), LOCALES[locale].intl, type))}</>;
  t.number = (value: number) => numberFormat(LOCALES[locale].intl).format(value);
  return t;
}

/**
 * A landing page (`/pt-br`) renders in its own language on the server and in
 * the first client render, before the runtime has activated anything. The
 * page's layout wraps it in this context with the language and the catalog
 * the server used, and `useT()` prefers it to the active locale.
 */
interface LandingLocale {
  locale: Locale;
  /** Undefined for the pseudo-locales, which are derived from English. */
  catalog?: Translation;
}

const LandingLocaleContext = createContext<LandingLocale | null>(null);

export function LandingLocaleProvider({ locale, catalog, children }: LandingLocale & { children: ReactNode }) {
  // Before any passive effect (I18nBootstrap activates this locale in one),
  // so activating it needs no download.
  useLayoutEffect(() => { registerCatalog(locale, catalog); }, [locale, catalog]);
  const value = useMemo(() => ({ locale, catalog }), [locale, catalog]);
  return <LandingLocaleContext.Provider value={value}>{children}</LandingLocaleContext.Provider>;
}

/**
 * The translator for the active locale. Components that call this re-render
 * when the player switches language, and again when a catalog finishes
 * loading, so a switch mid-game re-renders the log without a reload.
 */
export function useT(): Translator {
  const landing = useContext(LandingLocaleContext);
  const active = useI18nStore(s => s.locale);
  const locale = landing?.locale ?? active;
  // Re-render when this locale's catalog object changes.
  const loaded = useI18nStore(s => s.catalogs[locale]);
  const catalog = landing?.catalog ?? loaded;
  return useMemo(() => translatorWith(locale, catalog), [locale, catalog]);
}

export function useLocale(): Locale {
  const landing = useContext(LandingLocaleContext);
  const active = useI18nStore(s => s.locale);
  return landing?.locale ?? active;
}
