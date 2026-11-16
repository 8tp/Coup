/**
 * The site's origin, without a trailing slash: the one source for every
 * absolute URL the app prints (canonical, hreflang, sitemap, robots, Open
 * Graph, JSON-LD). Moving to another domain is a change of
 * `NEXT_PUBLIC_BASE_URL`, which Next.js inlines at build time, so set it for
 * the build as well as at runtime.
 */
const FALLBACK_SITE_URL = 'https://coup.8tp.dev';

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_BASE_URL || FALLBACK_SITE_URL).replace(/\/+$/, '');
}
