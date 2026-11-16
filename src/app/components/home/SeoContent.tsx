'use client';

import { usePathname } from 'next/navigation';
import { ASSASSINATE_COST, COUP_COST, FORCED_COUP_THRESHOLD, MAX_PLAYERS, MIN_PLAYERS, QUICK_PLAY_BOT_COUNT } from '@/shared/constants';
import { useLocale, useT, type Translator } from '../../i18n';
import { allLandingLocales, hreflang, landingUrl, OG_IMAGE, siteUrl } from '../../i18n/landing';
import type { MessageKey } from '../../i18n/schema';
import { LanguageSuggestion, LanguageSwitcher } from './LanguageSwitcher';

/** The FAQ, in order: question key and answer key. */
const FAQ: ReadonlyArray<readonly [MessageKey, MessageKey]> = [
  ['seo.faqFriendsQ', 'seo.faqFriendsA'],
  ['seo.faqBotsQ', 'seo.faqBotsA'],
  ['seo.faqPhoneQ', 'seo.faqPhoneA'],
  ['seo.faqFreeQ', 'seo.faqFreeA'],
  ['seo.faqPlayersQ', 'seo.faqPlayersA'],
  ['seo.faqReformationQ', 'seo.faqReformationA'],
];

/** Every number the copy quotes, from the game's constants. */
const PARAMS = {
  min: MIN_PLAYERS,
  max: MAX_PLAYERS,
  coupCost: COUP_COST,
  forcedCoup: FORCED_COUP_THRESHOLD,
  assassinateCost: ASSASSINATE_COST,
  bots: QUICK_PLAY_BOT_COUNT,
} as const;

/**
 * What the game is, how a turn works, what is free, and the questions people
 * search, under the menu on every landing page (`/` and `/pt-br`, ...), plus
 * the language switcher and the credit. Rendered on the server, so search
 * engines and assistants that do not run JavaScript can read it; the menu
 * above it fills the first screen, so a player who came to play never has to
 * scroll past it. The same text feeds the page's JSON-LD.
 */
export function SeoContent() {
  const t = useT();
  const locale = useLocale();
  return (
    <div className="landing-below">
      <section className="landing-about" aria-labelledby="landing-about-title">
        <h2 id="landing-about-title" className="landing-title">{t('seo.aboutHeading')}</h2>
        <p>{t('seo.aboutIntro', PARAMS)}</p>
        <h3 className="landing-subtitle">{t('seo.roundHeading')}</h3>
        <p>{t('seo.roundBody', PARAMS)}</p>
        <h3 className="landing-subtitle">{t('seo.freeHeading')}</h3>
        <p>{t('seo.freeBody', PARAMS)}</p>
        <h3 className="landing-subtitle">{t('seo.faqHeading')}</h3>
        <dl className="landing-faq">
          {FAQ.map(([q, a]) => (
            <div key={q} className="landing-faq-item">
              <dt>{t(q, PARAMS)}</dt>
              <dd>{t(a, PARAMS)}</dd>
            </div>
          ))}
        </dl>
      </section>
      <footer className="landing-foot">
        <LanguageSwitcher />
        <p className="landing-credit">{t('seo.credit')}</p>
      </footer>
      <script
        type="application/ld+json"
        // JSON in a <script> data block: escape `<` so no text can close it.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(landingJsonLd(t, locale)).replace(/</g, '\\u003c') }}
      />
    </div>
  );
}

/**
 * schema.org for a landing page: the site, the game (a free browser
 * `VideoGame`, credited as based on the card game Coup), and the FAQ above,
 * each with `inLanguage`. Built from the visible text, so it never says
 * anything the page does not.
 */
export function landingJsonLd(t: Translator, locale: Parameters<typeof landingUrl>[0]) {
  const url = landingUrl(locale);
  const lang = hreflang(locale);
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${siteUrl()}/#website`,
        url: landingUrl('en'),
        name: 'Coup Online',
        inLanguage: allLandingLocales().map(hreflang),
      },
      {
        '@type': 'VideoGame',
        '@id': `${url}#game`,
        name: 'Coup Online',
        url,
        description: t('seo.description'),
        inLanguage: lang,
        image: siteUrl() + OG_IMAGE.url,
        applicationCategory: 'GameApplication',
        operatingSystem: 'Any',
        gamePlatform: 'Web browser',
        playMode: ['MultiPlayer', 'SinglePlayer'],
        numberOfPlayers: { '@type': 'QuantitativeValue', minValue: MIN_PLAYERS, maxValue: MAX_PLAYERS },
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: 0, priceCurrency: 'USD' },
        isBasedOn: {
          '@type': 'Game',
          name: 'Coup',
          author: { '@type': 'Person', name: 'Rikki Tahta' },
          publisher: [
            { '@type': 'Organization', name: 'La Mame Games' },
            { '@type': 'Organization', name: 'Indie Boards & Cards' },
          ],
        },
        isPartOf: { '@id': `${siteUrl()}/#website` },
      },
      {
        '@type': 'FAQPage',
        '@id': `${url}#faq`,
        url,
        inLanguage: lang,
        mainEntity: FAQ.map(([q, a]) => ({
          '@type': 'Question',
          name: t(q, PARAMS),
          acceptedAnswer: { '@type': 'Answer', text: t(a, PARAMS) },
        })),
      },
    ],
  };
}

/**
 * The English landing page (`/`) is `src/app/page.tsx`, which this phase does
 * not own, so the root layout mounts its "About" section and the language
 * suggestion here, on `/` only. The translated landing pages mount
 * `SeoContent` in their own layout.
 */
export function RootLandingContent() {
  const pathname = usePathname();
  if (pathname !== '/') return null;
  return (
    <>
      <SeoContent />
      <LanguageSuggestion />
    </>
  );
}
