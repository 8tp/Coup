import { LOCALES, type Locale } from './locales';
import { resolveLocaleCore, type LocaleTable } from './matchLocale';

/** localStorage key for the saved language ("auto" or absent means match the device). */
export const LOCALE_STORAGE_KEY = 'coup_locale';
/** localStorage flag that lists unfinished translations in a production picker, for reviewers. */
export const LOCALE_PREVIEW_STORAGE_KEY = 'coup_i18n_preview';
/** On <html> while a non-English catalog loads; globals.css hides the page meanwhile. */
export const LOCALE_PENDING_CLASS = 'i18n-pending';
/** The pre-paint script gives up hiding the page after this long. */
export const LOCALE_PENDING_TIMEOUT_MS = 1500;

/**
 * The inline script `layout.tsx` puts in <head>. Before first paint it
 * resolves the locale with the same `resolveLocaleCore` the app uses, sets
 * `<html lang dir>` so a right-to-left page never paints left to right, and,
 * when the language is not English, hides the page until the catalog has
 * loaded and rendered (the runtime removes the class; a timeout is the
 * backstop). English readers pay nothing: no class, no wait.
 *
 * The server renders English (it has no per-player locale), and React's
 * first client render is English too, so hydration always matches; the
 * switch happens right after, while the page is still hidden.
 */
export function localeBootScript(table: LocaleTable, previewTable: LocaleTable): string {
  const meta: Record<string, { lang: string; dir: string }> = {};
  for (const code of Object.keys(LOCALES) as Locale[]) meta[code] = { lang: code, dir: LOCALES[code].dir };
  const config = {
    table,
    previewTable,
    meta,
    key: LOCALE_STORAGE_KEY,
    previewKey: LOCALE_PREVIEW_STORAGE_KEY,
    pending: LOCALE_PENDING_CLASS,
    timeout: LOCALE_PENDING_TIMEOUT_MS,
  };
  return `(function(c){try{var resolve=${resolveLocaleCore.toString()};`
    + `var s=localStorage.getItem(c.key);var p=localStorage.getItem(c.previewKey)==='1';`
    + `var l=resolve(p?c.previewTable:c.table,{pathname:location.pathname,saved:s&&s!=='auto'?s:null,languages:navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language]});`
    + `var m=c.meta[l]||c.meta.en;var h=document.documentElement;h.lang=m.lang;h.dir=m.dir;`
    + `if(l!=='en'){h.classList.add(c.pending);setTimeout(function(){h.classList.remove(c.pending)},c.timeout)}`
    + `}catch(e){}})(${JSON.stringify(config)})`;
}
