import type { MetadataRoute } from 'next';
import { siteUrl } from './i18n/siteUrl';

/**
 * Crawl the landing pages, never a room. robots.txt matches by prefix, so
 * `/lobby` and `/game` cover `/lobby/ABCD`, `/lobby/ABCD?x=1`, `/lobby/` and
 * `/lobby` alike, and the same for `/game`. Rooms never take a locale prefix.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/lobby', '/game'],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
