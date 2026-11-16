import type { MetadataRoute } from 'next';
import { landingManifest } from './i18n/landing';

/**
 * The app's manifest, in English, opening on `/`. Each translated landing
 * page links its own (`/pt-br/manifest.webmanifest`): the same app, named in
 * that language and opening on that page.
 */
export default function manifest(): MetadataRoute.Manifest {
  return landingManifest('en', undefined);
}
