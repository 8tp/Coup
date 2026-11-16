import type { Metadata } from 'next';
import { localeSlug } from '@/shared/i18n/locales';
import { LandingLocaleProvider } from '../i18n/react';
import { landingMetadata, loadCatalog } from '../i18n/landing';
import { SeoContent } from '../components/home/SeoContent';
import { landingLocaleOrNotFound, landingParams } from './localeParam';

/**
 * A translated landing page: `/pt-br`, `/es`, `/ar`, `/zh-hans`, `/vi`, `/hi`
 * (docs/I18N.md, "Landing pages and search"). One per language whose
 * registry status is ready, plus the pseudo-locales in development; a
 * language that becomes ready gets its page with no change here.
 *
 * The page is rendered on the server in its own language: the catalog is
 * loaded here and handed to the client provider, so the HTML a crawler
 * receives, and React's first client render, are already translated.
 */

type Params = Promise<{ locale: string }>;

export function generateStaticParams() {
  return landingParams();
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const locale = landingLocaleOrNotFound((await params).locale);
  return {
    ...landingMetadata(locale, await loadCatalog(locale)),
    // The English keyword list from the root layout says nothing about this page.
    keywords: null,
    manifest: `/${localeSlug(locale)}/manifest.webmanifest`,
  };
}

export default async function LandingLayout({ children, params }: { children: React.ReactNode; params: Params }) {
  const locale = landingLocaleOrNotFound((await params).locale);
  const catalog = await loadCatalog(locale);
  return (
    <LandingLocaleProvider locale={locale} catalog={catalog}>
      {children}
      <SeoContent />
    </LandingLocaleProvider>
  );
}
