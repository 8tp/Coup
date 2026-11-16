import { landingManifest, loadCatalog } from '../../i18n/landing';
import { landingLocaleOrNotFound, landingParams } from '../localeParam';

/**
 * A landing page's web app manifest: the same app as `/manifest.webmanifest`
 * (`id: '/'`, so installing from any language is one install), described
 * in this language and opening on this language's page.
 */
export const dynamic = 'force-static';

export function generateStaticParams() {
  return landingParams();
}

export async function GET(_request: Request, { params }: { params: Promise<{ locale: string }> }) {
  const locale = landingLocaleOrNotFound((await params).locale);
  return new Response(JSON.stringify(landingManifest(locale, await loadCatalog(locale))), {
    headers: { 'Content-Type': 'application/manifest+json' },
  });
}
