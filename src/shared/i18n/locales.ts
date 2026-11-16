/**
 * The language registry. One line per language; see docs/I18N.md, "Adding a
 * language". The catalog loaders live next to the catalogs in
 * `src/app/i18n/registry.ts`, keyed by the same codes, so this file stays free
 * of client imports and the server and tests can read it.
 *
 * `status: 'in-progress'` keeps a language out of automatic detection and out
 * of the production picker until its translation is reviewed. Flip it to
 * `'ready'` in the same change that lands a reviewed catalog. That one flip
 * also gives the language its landing page (`/pt-br`), its sitemap entry and
 * its place in every hreflang set (see `landingLocales` below).
 */
export const LOCALES = {
  en: { nativeName: 'English', englishName: 'English', dir: 'ltr', intl: 'en', og: 'en_US', status: 'ready', dev: false },
  hi: { nativeName: 'हिन्दी', englishName: 'Hindi', dir: 'ltr', intl: 'hi', og: 'hi_IN', status: 'in-progress', dev: false },
  'pt-BR': { nativeName: 'Português (Brasil)', englishName: 'Portuguese (Brazil)', dir: 'ltr', intl: 'pt-BR', og: 'pt_BR', status: 'in-progress', dev: false },
  es: { nativeName: 'Español', englishName: 'Spanish', dir: 'ltr', intl: 'es', og: 'es_LA', status: 'in-progress', dev: false },
  // Latin digits, matching the coin figures on the table (ART-DIRECTION §4 Figures).
  ar: { nativeName: 'العربية', englishName: 'Arabic', dir: 'rtl', intl: 'ar-u-nu-latn', og: 'ar_AR', status: 'in-progress', dev: false },
  'zh-Hans': { nativeName: '简体中文', englishName: 'Chinese (Simplified)', dir: 'ltr', intl: 'zh-Hans', og: 'zh_CN', status: 'in-progress', dev: false },
  vi: { nativeName: 'Tiếng Việt', englishName: 'Vietnamese', dir: 'ltr', intl: 'vi', og: 'vi_VN', status: 'in-progress', dev: false },
  // Development-only pseudo-locales (docs/I18N.md, "Pseudo-locales"). Never shipped in a production build.
  'en-XA': { nativeName: 'Ƥšéúðö (accented)', englishName: 'Pseudo, accented', dir: 'ltr', intl: 'en', og: 'en_US', status: 'ready', dev: true },
  'ar-XB': { nativeName: 'Pseudo RTL', englishName: 'Pseudo, right to left', dir: 'rtl', intl: 'en', og: 'en_US', status: 'ready', dev: true },
} as const satisfies Record<string, LocaleInfo>;

export interface LocaleInfo {
  /** The language named in itself, as the picker shows it. */
  nativeName: string;
  englishName: string;
  dir: 'ltr' | 'rtl';
  /** BCP 47 tag handed to Intl (plurals, numbers, lists). */
  intl: string;
  /** Open Graph locale (`og:locale`), in the language_TERRITORY form social sites read. */
  og: string;
  status: 'ready' | 'in-progress';
  /** Pseudo-locales: available in development only. */
  dev: boolean;
}

export type Locale = keyof typeof LOCALES;

export const DEFAULT_LOCALE: Locale = 'en';

/** Real languages, in picker order (the order of `LOCALES`). */
export const SHIPPED_LOCALES: readonly Locale[] = (Object.keys(LOCALES) as Locale[]).filter(l => !LOCALES[l].dev);
/** Development-only pseudo-locales. */
export const PSEUDO_LOCALES: readonly Locale[] = (Object.keys(LOCALES) as Locale[]).filter(l => LOCALES[l].dev);

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(LOCALES, value);
}

export function localeInfo(locale: Locale): LocaleInfo {
  return LOCALES[locale];
}

export function isRtl(locale: Locale): boolean {
  return LOCALES[locale].dir === 'rtl';
}

/**
 * Locales a player may pick or be matched to in this build. Pseudo-locales
 * only when `includeDev`; unfinished translations only when `includeInProgress`.
 */
export function availableLocales(opts: { includeDev: boolean; includeInProgress: boolean }): Locale[] {
  const real = SHIPPED_LOCALES.filter(l => opts.includeInProgress || LOCALES[l].status === 'ready');
  return opts.includeDev ? [...real, ...PSEUDO_LOCALES] : [...real];
}

// ─── Landing pages (docs/I18N.md, "Landing pages and search") ───

/**
 * Locales with their own landing URL in this build: every ready translation
 * except English (which is `/`), plus the pseudo-locales in development.
 * Unfinished translations never get a URL, even in development, so nothing
 * half-translated can be crawled.
 */
export function landingLocales(opts: { includeDev: boolean }): Locale[] {
  return (Object.keys(LOCALES) as Locale[]).filter(l =>
    l !== DEFAULT_LOCALE && LOCALES[l].status === 'ready' && (opts.includeDev || !LOCALES[l].dev));
}

/** The URL path segment of a locale: its registry code in lower case (`pt-BR` → `pt-br`). */
export function localeSlug(locale: Locale): string {
  return locale.toLowerCase();
}

/** A locale's landing path: `/` for English, `/<slug>` for the others. */
export function landingPath(locale: Locale): string {
  return locale === DEFAULT_LOCALE ? '/' : `/${localeSlug(locale)}`;
}

/** The locale among `candidates` whose slug is exactly `slug` (lower case only; `pt-BR` is not a slug). */
export function localeForSlug(slug: string | null | undefined, candidates: readonly Locale[]): Locale | null {
  if (!slug) return null;
  for (const l of candidates) if (localeSlug(l) === slug) return l;
  return null;
}

/** The landing locale a path names (`/pt-br` → `pt-BR`), or null for `/`, app routes and anything else. */
export function landingLocaleFromPath(pathname: string | null | undefined, candidates: readonly Locale[]): Locale | null {
  const match = /^\/([^/?#]+)\/?$/.exec(pathname ?? '');
  return match ? localeForSlug(match[1], candidates) : null;
}

/**
 * One URL per landing page: where another spelling of one should redirect
 * (`/PT-BR` → `/pt-br`, `/en` → `/`), or null when the path is not one.
 * `server.ts` answers these with a 308 before Next.js sees them.
 */
export function landingRedirect(pathname: string, candidates: readonly Locale[]): string | null {
  const match = /^\/([^/]+)\/?$/.exec(pathname);
  if (!match) return null;
  let segment = match[1];
  try { segment = decodeURIComponent(segment); } catch { /* keep it as it came */ }
  const lower = segment.toLowerCase();
  if (lower === localeSlug(DEFAULT_LOCALE)) return '/';
  const locale = localeForSlug(lower, candidates);
  return locale && segment !== lower ? landingPath(locale) : null;
}

/** `/` and every landing path among `candidates`. */
export function isLandingPath(pathname: string | null | undefined, candidates: readonly Locale[]): boolean {
  return pathname === '/' || landingLocaleFromPath(pathname, candidates) !== null;
}
