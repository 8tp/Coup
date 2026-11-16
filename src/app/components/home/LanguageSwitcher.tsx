'use client';

import { useEffect, useState, type MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import { DEFAULT_LOCALE, LOCALES, type Locale } from '@/shared/i18n/locales';
import { matchNavigatorLanguages } from '@/shared/i18n/matchLocale';
import { useLocale, useT } from '../../i18n';
import { LANDING_LOCALES, landingPathFor, loadCatalog, resolvePreferredLocale, useI18nStore } from '../../i18n/runtime';
import { useSettingsStore } from '../../stores/settingsStore';

/** Every language with a landing page in this build, English first. */
const SWITCHER_LOCALES: readonly Locale[] = [DEFAULT_LOCALE, ...LANDING_LOCALES];

/** localStorage: the reader closed the "read in your language" suggestion. */
const SUGGESTION_DISMISSED_KEY = 'coup_locale_suggestion_dismissed';

/**
 * Choosing a language here is a choice like Settings > Language: it is saved,
 * and the page moves to that language's landing page (I18nBootstrap does the
 * move). A modified click (new tab, new window) just follows the link.
 */
function useChooseLanguage() {
  const router = useRouter();
  return (event: MouseEvent<HTMLAnchorElement>, locale: Locale) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const settings = useSettingsStore.getState();
    const unchanged = settings.locale === locale;
    settings.setLocale(locale);
    if (unchanged) router.push(landingPathFor(locale));
  };
}

/**
 * Links to this page in every language that has one, each named in itself.
 * Real links to the landing URLs, so crawlers follow them. Nothing renders
 * while English is the only language.
 */
export function LanguageSwitcher() {
  const t = useT();
  const current = useLocale();
  const choose = useChooseLanguage();
  if (SWITCHER_LOCALES.length < 2) return null;
  return (
    <nav className="landing-languages" aria-label={t('seo.languages')}>
      <ul>
        {SWITCHER_LOCALES.map(locale => (
          <li key={locale}>
            <a
              href={landingPathFor(locale)}
              hrefLang={locale}
              lang={locale}
              dir={LOCALES[locale].dir}
              aria-current={locale === current ? 'page' : undefined}
              className="landing-language"
              onClick={(e) => choose(e, locale)}
            >
              {LOCALES[locale].nativeName}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

interface Suggestion {
  locale: Locale;
  /** "Leia em português", from that language's catalog; the language's own name when it has none. */
  text: string;
  dismiss: string | null;
}

/**
 * On `/`, for a reader seeing English whose browser also lists a language
 * that has a landing page (an `en-IN, hi` browser, say), offer that page in
 * that language. Never a redirect, and never for someone who chose English in
 * Settings. Dismissed once, gone for good on this device. The other language's
 * catalog is fetched only for these readers.
 */
export function LanguageSuggestion() {
  const t = useT();
  const active = useI18nStore(s => s.locale);
  const saved = useSettingsStore(s => s.locale);
  const choose = useChooseLanguage();
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);

  useEffect(() => {
    setSuggestion(null);
    if (active !== DEFAULT_LOCALE || saved !== null || isDismissed()) return;
    // The page is about to switch on its own: no suggestion.
    if (resolvePreferredLocale(null) !== DEFAULT_LOCALE) return;
    const languages = navigator.languages?.length ? navigator.languages : [navigator.language];
    const match = matchNavigatorLanguages(languages, LANDING_LOCALES.filter(l => !LOCALES[l].dev));
    if (!match || match === DEFAULT_LOCALE) return;
    let cancelled = false;
    loadCatalog(match)
      .catch(() => undefined)
      .then(catalog => {
        if (cancelled) return;
        setSuggestion({
          locale: match,
          text: catalog?.seo?.suggestion || LOCALES[match].nativeName,
          dismiss: catalog?.seo?.suggestionDismiss || null,
        });
      });
    return () => { cancelled = true; };
  }, [active, saved]);

  if (!suggestion) return null;
  const { locale } = suggestion;
  const close = () => {
    try { localStorage.setItem(SUGGESTION_DISMISSED_KEY, '1'); } catch { /* storage blocked: closes for this visit only */ }
    setSuggestion(null);
  };
  return (
    <div className="lang-suggest animate-fade-in" lang={locale} dir={LOCALES[locale].dir}>
      <a
        href={landingPathFor(locale)}
        hrefLang={locale}
        className="lang-suggest-link"
        onClick={(e) => choose(e, locale)}
      >
        {suggestion.text}
      </a>
      <button
        type="button"
        className="lang-suggest-close"
        aria-label={suggestion.dismiss ?? t('seo.suggestionDismiss')}
        onClick={close}
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
          <path d="M5.3 3.9 10 8.6l4.7-4.7 1.4 1.4L11.4 10l4.7 4.7-1.4 1.4L10 11.4l-4.7 4.7-1.4-1.4L8.6 10 3.9 5.3z" />
        </svg>
      </button>
    </div>
  );
}

function isDismissed(): boolean {
  try {
    return localStorage.getItem(SUGGESTION_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}
