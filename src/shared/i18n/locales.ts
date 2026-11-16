/**
 * The language registry. One line per language; see docs/I18N.md, "Adding a
 * language". The catalog loaders live next to the catalogs in
 * `src/app/i18n/registry.ts`, keyed by the same codes, so this file stays free
 * of client imports and the server and tests can read it.
 *
 * `status: 'in-progress'` keeps a language out of automatic detection and out
 * of the production picker until its translation is reviewed. Flip it to
 * `'ready'` in the same change that lands a reviewed catalog.
 */
export const LOCALES = {
  en: { nativeName: 'English', englishName: 'English', dir: 'ltr', intl: 'en', status: 'ready', dev: false },
  hi: { nativeName: 'हिन्दी', englishName: 'Hindi', dir: 'ltr', intl: 'hi', status: 'in-progress', dev: false },
  'pt-BR': { nativeName: 'Português (Brasil)', englishName: 'Portuguese (Brazil)', dir: 'ltr', intl: 'pt-BR', status: 'in-progress', dev: false },
  es: { nativeName: 'Español', englishName: 'Spanish', dir: 'ltr', intl: 'es', status: 'in-progress', dev: false },
  // Latin digits, matching the coin figures on the table (ART-DIRECTION §4 Figures).
  ar: { nativeName: 'العربية', englishName: 'Arabic', dir: 'rtl', intl: 'ar-u-nu-latn', status: 'in-progress', dev: false },
  'zh-Hans': { nativeName: '简体中文', englishName: 'Chinese (Simplified)', dir: 'ltr', intl: 'zh-Hans', status: 'in-progress', dev: false },
  vi: { nativeName: 'Tiếng Việt', englishName: 'Vietnamese', dir: 'ltr', intl: 'vi', status: 'in-progress', dev: false },
  // Development-only pseudo-locales (docs/I18N.md, "Pseudo-locales"). Never shipped in a production build.
  'en-XA': { nativeName: 'Ƥšéúðö (accented)', englishName: 'Pseudo, accented', dir: 'ltr', intl: 'en', status: 'ready', dev: true },
  'ar-XB': { nativeName: 'Pseudo RTL', englishName: 'Pseudo, right to left', dir: 'rtl', intl: 'en', status: 'ready', dev: true },
} as const satisfies Record<string, LocaleInfo>;

export interface LocaleInfo {
  /** The language named in itself, as the picker shows it. */
  nativeName: string;
  englishName: string;
  dir: 'ltr' | 'rtl';
  /** BCP 47 tag handed to Intl (plurals, numbers, lists). */
  intl: string;
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
