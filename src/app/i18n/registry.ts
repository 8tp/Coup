import type { Locale } from '@/shared/i18n/locales';
import type { Translation } from './schema';

/**
 * Catalog loaders, one line per translated locale. Each is a separate dynamic
 * import, so the bundler emits one chunk per language and an English reader
 * downloads none of them. English is imported statically by the runtime;
 * the pseudo-locales are derived from English in development.
 *
 * Adding a language: a folder under ./messages, a line here, and a line in
 * `LOCALES` (src/shared/i18n/locales.ts). See docs/I18N.md.
 */
export const CATALOG_LOADERS: Partial<Record<Locale, () => Promise<{ default: Translation }>>> = {
  hi: () => import('./messages/hi'),
  'pt-BR': () => import('./messages/pt-BR'),
  es: () => import('./messages/es'),
  ar: () => import('./messages/ar'),
  'zh-Hans': () => import('./messages/zh-Hans'),
  vi: () => import('./messages/vi'),
};
