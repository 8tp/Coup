'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { isLandingPath, landingLocaleFromPath } from '@/shared/i18n/locales';
import { useSettingsStore } from '../stores/settingsStore';
import { activateLocale, LANDING_LOCALES, landingPathFor, resolvePreferredLocale, setLandingSession } from './runtime';

/**
 * Mounted once in the root layout. Renders nothing.
 *
 * After hydration (which renders the language the server rendered: English,
 * or a landing page's own) it resolves the locale, loads its catalog and
 * switches. Then:
 *
 * - Arriving at a landing page re-resolves: `/pt-br` is Portuguese and this
 *   tab remembers it (so `/game/ABCD`, reloaded mid-game, stays Portuguese);
 *   `/` forgets it and uses the saved or browser language.
 * - Moving from a landing page into the app (`/lobby/ABCD`, `/game/ABCD`)
 *   keeps the language on screen.
 * - A choice in Settings > Language, made on a landing page, moves to the
 *   landing page of that language (`/pt-br` → `/es`, or `/`), which is a
 *   normal navigation, so Back returns to the previous one. Made anywhere
 *   else, it switches in place.
 */
export function I18nBootstrap() {
  const pathname = usePathname();
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    const landing = landingLocaleFromPath(pathname, LANDING_LOCALES);
    if (landing) setLandingSession(landing);
    else if (pathname === '/') setLandingSession(null);
    else if (started.current) return; // into the app: keep the language on screen
    started.current = true;
    void activateLocale(resolvePreferredLocale(useSettingsStore.getState().locale));
  }, [pathname]);

  useEffect(() => useSettingsStore.subscribe((state, prev) => {
    if (state.locale === prev.locale) return;
    setLandingSession(null);
    const here = window.location.pathname;
    if (isLandingPath(here, LANDING_LOCALES)) {
      const target = landingPathFor(state.locale ?? resolvePreferredLocale(null, null));
      if (target !== here) {
        router.push(target);
        return; // the pathname effect above switches once the new page is on screen
      }
    }
    void activateLocale(resolvePreferredLocale(state.locale));
  }), [router]);

  return null;
}
