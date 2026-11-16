import type { MetadataRoute } from 'next';
import { landingSitemap } from './i18n/landing';

/**
 * Every landing page (`/` and each ready language's `/pt-br`, ...), each
 * listing all of them as language alternates, `x-default` included.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return landingSitemap();
}
