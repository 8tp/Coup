'use client';

import { useSyncExternalStore, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { DEFAULT_LOCALE, landingLocaleFromPath, LOCALES } from '@/shared/i18n/locales';
import { SSR_LOCALE_ATTRIBUTE } from '@/shared/i18n/bootScript';
import { LANDING_LOCALES, useI18nStore } from './runtime';

const subscribeNever = () => () => {};

/**
 * The document's <html>, rendered by the root layout. Its `lang` and `dir`
 * come from the URL on a landing page (`/pt-br` → `lang="pt-BR"`), so the
 * HTML a crawler receives is already marked as Portuguese; everywhere else
 * the server says English, the pre-paint script corrects that before first
 * paint, and after hydration they follow the active language.
 *
 * `data-ssr-locale` tells the pre-paint script which language the server
 * rendered, so a landing page is not hidden while a catalog it already has
 * "loads".
 */
export function LocaleHtml({ className, children }: { className?: string; children: ReactNode }) {
  const pathname = usePathname();
  const landing = landingLocaleFromPath(pathname, LANDING_LOCALES);
  const active = useI18nStore(s => s.locale);
  // False on the server and in the hydrating render, true after.
  const hydrated = useSyncExternalStore(subscribeNever, () => true, () => false);
  const locale = landing ?? (hydrated ? active : DEFAULT_LOCALE);
  const ssrLocale = landing ?? DEFAULT_LOCALE;
  return (
    // The pre-paint script may already have changed `lang`/`dir` on `/` and
    // the app routes; suppressHydrationWarning covers that, on this element only.
    <html
      lang={locale}
      dir={LOCALES[locale].dir}
      className={className}
      {...{ [SSR_LOCALE_ATTRIBUTE]: ssrLocale }}
      suppressHydrationWarning
    >
      {children}
    </html>
  );
}
