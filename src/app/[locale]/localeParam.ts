import { notFound, permanentRedirect } from 'next/navigation';
import { landingRedirect, localeForSlug, localeSlug, type Locale } from '@/shared/i18n/locales';
import { LANDING_LOCALES } from '../i18n/runtime';

/**
 * The `[locale]` segment's params: one per landing locale of this build
 * (ready translations, plus the pseudo-locales in development).
 */
export function landingParams(): Array<{ locale: string }> {
  return LANDING_LOCALES.map(l => ({ locale: localeSlug(l) }));
}

/**
 * The locale a `[locale]` param names. One URL per page: another spelling
 * (`/PT-BR`, `/en`) redirects permanently, and anything that is not a landing
 * page of this build is a 404. `server.ts` answers the redirects before
 * Next.js sees them; this covers `next dev`/`next start` without it.
 */
export function landingLocaleOrNotFound(slug: string): Locale {
  const exact = localeForSlug(slug, LANDING_LOCALES);
  if (exact) return exact;
  const target = landingRedirect(`/${slug}`, LANDING_LOCALES);
  if (target) permanentRedirect(target);
  notFound();
}
