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
/** sessionStorage key: the landing page language this tab came in through (matchLocale.ts, step 2). */
export const LOCALE_SESSION_STORAGE_KEY = 'coup_landing_locale';
/** On <html>: the locale the server rendered this page in (`en` everywhere except the landing pages). */
export const SSR_LOCALE_ATTRIBUTE = 'data-ssr-locale';

/**
 * The inline script `layout.tsx` puts in <head>. Before first paint it
 * resolves the locale with the same `resolveLocaleCore` the app uses, sets
 * `<html lang dir>` so a right-to-left page never paints left to right, and,
 * when the language differs from the one the server rendered, hides the page
 * until the catalog has loaded and rendered (the runtime removes the class;
 * a timeout is the backstop). English readers pay nothing: no class, no wait.
 *
 * The server renders English everywhere except the landing pages (`/pt-br`),
 * which it renders in their own language and marks with `data-ssr-locale`;
 * there the script resolves that same language and hides nothing. React's
 * first client render uses the same language as the server, so hydration
 * always matches; any switch happens right after, while the page is hidden.
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
    sessionKey: LOCALE_SESSION_STORAGE_KEY,
    ssrAttr: SSR_LOCALE_ATTRIBUTE,
    pending: LOCALE_PENDING_CLASS,
    timeout: LOCALE_PENDING_TIMEOUT_MS,
  };
  return `(function(c){try{var resolve=${resolveLocaleCore.toString()};`
    + `var s=localStorage.getItem(c.key);var p=localStorage.getItem(c.previewKey)==='1';`
    + `var t=null;try{t=sessionStorage.getItem(c.sessionKey)}catch(e){}`
    + `var l=resolve(p?c.previewTable:c.table,{pathname:location.pathname,session:t,saved:s&&s!=='auto'?s:null,languages:navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language]});`
    + `var m=c.meta[l]||c.meta.en;var h=document.documentElement;h.lang=m.lang;h.dir=m.dir;`
    + `var r=(h.getAttribute&&h.getAttribute(c.ssrAttr))||'en';`
    + `if(l!==r){h.classList.add(c.pending);setTimeout(function(){h.classList.remove(c.pending)},c.timeout)}`
    + `}catch(e){}})(${JSON.stringify(config)})`;
}
