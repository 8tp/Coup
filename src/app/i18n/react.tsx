'use client';

import { Fragment, isValidElement, useMemo, type ReactNode } from 'react';
import { LOCALES, type Locale } from '@/shared/i18n/locales';
import { formatListToParts, numberFormat, type FormatOptions, type Part } from '@/shared/i18n/messageFormat';
import { makePlainTranslator, translatePartsIn, useI18nStore, type PlainTranslator } from './runtime';
import type { MessageKey } from './schema';

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
  const t = makePlainTranslator(locale) as Translator;
  t.dir = LOCALES[locale].dir;
  t.intl = LOCALES[locale].intl;
  t.rich = (key, params = {}, opts) => <>{partsToNodes(translatePartsIn(locale, key, wrapParams(params), opts))}</>;
  t.list = (items, type = 'conjunction') =>
    <>{partsToNodes(formatListToParts(items.map(item => (typeof item === 'string' ? item : { rich: item })), LOCALES[locale].intl, type))}</>;
  t.number = (value: number) => numberFormat(LOCALES[locale].intl).format(value);
  return t;
}

/**
 * The translator for the active locale. Components that call this re-render
 * when the player switches language, and again when a catalog finishes
 * loading, so a switch mid-game re-renders the log without a reload.
 */
export function useT(): Translator {
  const locale = useI18nStore(s => s.locale);
  // Re-render when this locale's catalog object changes.
  const catalog = useI18nStore(s => s.catalogs[s.locale]);
  return useMemo(() => makeTranslator(locale), [locale, catalog]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function useLocale(): Locale {
  return useI18nStore(s => s.locale);
}
