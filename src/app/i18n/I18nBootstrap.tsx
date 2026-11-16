'use client';

import { useEffect } from 'react';
import { useSettingsStore } from '../stores/settingsStore';
import { activateLocale, resolvePreferredLocale } from './runtime';

/**
 * Mounted once in the root layout. After hydration (which always renders
 * English, matching the server) it resolves the locale, loads its catalog and
 * switches; then it follows Settings > Language. Renders nothing.
 */
export function I18nBootstrap() {
  useEffect(() => {
    const apply = (saved: string | null) => { void activateLocale(resolvePreferredLocale(saved)); };
    apply(useSettingsStore.getState().locale);
    return useSettingsStore.subscribe((state, prev) => {
      if (state.locale !== prev.locale) apply(state.locale);
    });
  }, []);
  return null;
}
