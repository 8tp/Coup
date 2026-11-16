import type { Metadata, MetadataRoute } from 'next';
import { DEFAULT_LOCALE, landingPath, LOCALES, type Locale } from '@/shared/i18n/locales';
import { LANDING_LOCALES, loadCatalog, translateIn } from './runtime';
import type { MessageKey, Translation } from './schema';
import { siteUrl } from './siteUrl';

/**
 * Search metadata for the landing pages (`/` and `/pt-br`, `/es`, ...):
 * titles, descriptions, canonical and hreflang URLs, Open Graph, the
 * sitemap and the web app manifest.
 *
 * Every absolute URL comes from `siteUrl()` (./siteUrl.ts), the one place
 * the host is known.
 */

export { siteUrl };

/**
 * The absolute URL of a locale's landing page: the bare origin for English
 * (`https://coup.8tp.dev`, the form Next.js prints for `/`, so canonical,
 * hreflang and sitemap agree to the character), `https://…/pt-br` otherwise.
 */
export function landingUrl(locale: Locale): string {
  const path = landingPath(locale);
  return path === '/' ? siteUrl() : siteUrl() + path;
}

/** Every landing page in this build, English first. */
export function allLandingLocales(): Locale[] {
  return [DEFAULT_LOCALE, ...LANDING_LOCALES];
}

/** The hreflang value of a locale: its registry code, which is BCP 47 (`pt-BR`, `zh-Hans`). */
export function hreflang(locale: Locale): string {
  return locale;
}

/**
 * The reciprocal hreflang set every landing page carries (and the sitemap
 * repeats): one entry per landing page, itself included, plus `x-default`,
 * which is `/` because `/` picks a language for visitors who match none.
 */
export function languageAlternates(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const l of allLandingLocales()) out[hreflang(l)] = landingUrl(l);
  out['x-default'] = landingUrl(DEFAULT_LOCALE);
  return out;
}

/** A translator for server code, using the catalog a landing page renders with. */
export function seoText(locale: Locale, catalog: Translation | undefined) {
  return (key: MessageKey, params?: Record<string, unknown>) => translateIn(locale, key, params, catalog);
}

export const OG_IMAGE = { url: '/og-image-v4.jpg', width: 1200, height: 630 } as const;
export const TWITTER_IMAGE = '/embed-image-v4.jpg';

/** Title, description, canonical, hreflang, Open Graph and Twitter tags for one landing page. */
export function landingMetadata(locale: Locale, catalog: Translation | undefined): Metadata {
  const t = seoText(locale, catalog);
  const title = t('seo.title');
  const description = t('seo.description');
  const url = landingUrl(locale);
  return {
    title,
    description,
    alternates: {
      canonical: url,
      languages: languageAlternates(),
    },
    openGraph: {
      title: t('seo.ogTitle'),
      description,
      url,
      siteName: 'Coup Online',
      locale: LOCALES[locale].og,
      alternateLocale: allLandingLocales().filter(l => l !== locale).map(l => LOCALES[l].og).filter((og, i, all) => og !== LOCALES[locale].og && all.indexOf(og) === i),
      images: [{ ...OG_IMAGE, alt: t('seo.ogImageAlt') }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: t('seo.ogTitle'),
      description,
      images: [TWITTER_IMAGE],
    },
  };
}

/**
 * The web app manifest for a landing page. Every language installs the same
 * app (`id: '/'`); a landing page's manifest only names it in that language
 * and opens on that language's page.
 */
export function landingManifest(locale: Locale, catalog: Translation | undefined): MetadataRoute.Manifest {
  const t = seoText(locale, catalog);
  return {
    id: '/',
    name: 'Coup Online',
    short_name: 'Coup',
    description: t('seo.manifestDescription'),
    start_url: landingPath(locale),
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    orientation: 'portrait',
    lang: locale === DEFAULT_LOCALE ? 'en-US' : locale,
    dir: LOCALES[locale].dir,
    categories: ['games', 'entertainment', 'social'],
    theme_color: '#090d0e',
    background_color: '#090d0e',
    icons: [
      { src: '/icons/icon-192-v3.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512-v3.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512-v3.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}

/** The sitemap: every landing page, each with the full hreflang set. */
export function landingSitemap(lastModified: Date = new Date()): MetadataRoute.Sitemap {
  const languages = languageAlternates();
  return allLandingLocales().map(locale => ({
    url: landingUrl(locale),
    lastModified,
    changeFrequency: 'weekly',
    priority: locale === DEFAULT_LOCALE ? 1 : 0.9,
    alternates: { languages },
  }));
}

export { loadCatalog };
