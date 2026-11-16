import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import {
  CRITICAL_PRELOAD_IMAGES,
  GAME_PREFETCH_IMAGES,
} from './utils/assets';
import { PWAInstallPrompt } from './components/pwa/PWAInstallPrompt';
import { I18nBootstrap } from './i18n/I18nBootstrap';
import { LocaleHtml } from './i18n/LocaleHtml';
import { localeTables } from './i18n/runtime';
import { landingMetadata, siteUrl } from './i18n/landing';
import { RootLandingContent } from './components/home/SeoContent';
import { localeBootScript } from '@/shared/i18n/bootScript';

/**
 * ART-DIRECTION.md §4 — the Display role.
 *
 * Oswald. It is a revival of Alternate Gothic, the condensed grotesque of
 * mid-century civic and transit signage and of screen-printed poster stock —
 * which is §0's world ("screen-printed civic propaganda", 1970s dystopian
 * civic-design language) rather than a decorative approximation of it. Three
 * things earned it over the other candidates:
 *
 *  - Flat terminals, vertical stress, near-square joins. It is the same line
 *    language §1.2 imposes on the glyph set (miter joins, butt caps, no
 *    gradient), so wordmark, glyphs and type read as one printing.
 *  - It is *narrow*. Player names, the phase banner and action names all sit
 *    in a 512px column (§3.2) and must survive a size step without wrapping;
 *    a normal-width poster face cannot take the 2.5x §4 asks for here.
 *  - It carries ALL-CAPS at weight 700 without turning into a slab novelty,
 *    which matters because the wordmark it sits under is exactly that.
 *
 * Explicitly not Inter or Space Grotesk: those are the generic default and
 * would restate the "web app" tell §3 exists to kill.
 *
 * Loaded with next/font/local from vendored variable woff2 files, one family
 * per Google Fonts subset (latin ~28KB, latin-ext ~24KB, vietnamese ~8KB; all
 * Oswald v57, SIL OFL, see src/app/fonts/OFL.txt). Each declares its
 * `unicode-range`, so a browser fetches latin-ext or vietnamese only when a
 * glyph on screen needs it; only latin is preloaded. `--font-display` stacks
 * them in globals.css. §4 requires no CDN dependency because the app is
 * offline-capable (public/sw.js), and the CSP is `font-src 'self'`.
 *
 * Arabic display text uses Noto Kufi Arabic (~124KB, SIL OFL, see
 * src/app/fonts/OFL-NotoKufiArabic.txt): a geometric Kufi is the Arabic
 * counterpart of a condensed civic grotesque. Its range is Arabic only, so
 * nobody else downloads it. Chinese uses system faces (see globals.css,
 * "Per-language type"). docs/I18N.md records why.
 */
// next/font needs literal options, so the shared ones are repeated per call.
// adjustFontFallback is off because Oswald is far narrower than any
// metric-adjustable system face; a synthesised override would make the swap jump.
const displayLatin = localFont({
  weight: '200 700',
  style: 'normal',
  display: 'swap',
  adjustFontFallback: false,
  src: './fonts/Oswald-Variable-latin.woff2',
  variable: '--font-display-latin',
  preload: true,
  declarations: [{ prop: 'unicode-range', value: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD' }],
});

const displayLatinExt = localFont({
  weight: '200 700',
  style: 'normal',
  display: 'swap',
  adjustFontFallback: false,
  src: './fonts/Oswald-Variable-latin-ext.woff2',
  variable: '--font-display-latin-ext',
  preload: false,
  declarations: [{ prop: 'unicode-range', value: 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF' }],
});

const displayVietnamese = localFont({
  weight: '200 700',
  style: 'normal',
  display: 'swap',
  adjustFontFallback: false,
  src: './fonts/Oswald-Variable-vietnamese.woff2',
  variable: '--font-display-vietnamese',
  preload: false,
  declarations: [{ prop: 'unicode-range', value: 'U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB' }],
});

const displayArabic = localFont({
  src: './fonts/NotoKufiArabic-Variable-arabic.woff2',
  weight: '100 900',
  style: 'normal',
  display: 'swap',
  adjustFontFallback: false,
  variable: '--font-display-arabic',
  preload: false,
  declarations: [{ prop: 'unicode-range', value: 'U+0600-06FF, U+0750-077F, U+0870-08FF, U+200C-200E, U+2010-2011, U+204F, U+2E41, U+FB50-FDFF, U+FE70-FEFC' }],
});

const FONT_VARIABLES = [displayLatin, displayLatinExt, displayVietnamese, displayArabic].map(f => f.variable).join(' ');

const { strict: LOCALE_TABLE, preview: LOCALE_PREVIEW_TABLE } = localeTables();

export const viewport: Viewport = {
  viewportFit: 'cover',
  themeColor: '#090d0e',
};

/**
 * The English landing page's search metadata (`/`), from the `seo` catalog:
 * title, description, canonical, the hreflang set of every landing page,
 * Open Graph and Twitter. The translated landing pages (`[locale]/layout.tsx`)
 * override the same fields in their own language. The app routes inherit
 * this too, but robots.ts keeps crawlers out of them.
 */
export const metadata: Metadata = {
  ...landingMetadata('en', undefined),
  applicationName: 'Coup Online',
  keywords: ['coup', 'card game', 'multiplayer', 'board game', 'bluffing', 'online game', 'strategy', 'free'],
  appleWebApp: {
    capable: true,
    title: 'Coup Online',
    statusBarStyle: 'black-translucent',
  },
  metadataBase: new URL(siteUrl()),
  icons: {
    icon: [
      { url: '/favicon-v3.ico', sizes: '16x16 32x32 48x48' },
      { url: '/favicon-32x32-v3.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192-v3.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/apple-touch-icon-v3.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // <html lang dir> is the landing page's language on `/pt-br` and the like,
    // English elsewhere; on `/` and the app routes the locale script below
    // rewrites it before first paint (LocaleHtml explains).
    <LocaleHtml className={FONT_VARIABLES}>
      <head>
        {CRITICAL_PRELOAD_IMAGES.map(href => (
          <link key={href} rel="preload" href={href} as="image" fetchPriority="high" />
        ))}
        {GAME_PREFETCH_IMAGES.map(href => (
          <link key={href} rel="prefetch" href={href} as="image" />
        ))}
        <script dangerouslySetInnerHTML={{ __html: localeBootScript(LOCALE_TABLE, LOCALE_PREVIEW_TABLE) }} />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('coup_text_size');if(s==='large')document.documentElement.classList.add('text-size-large');else if(s==='xl')document.documentElement.classList.add('text-size-xl');if(localStorage.getItem('coup_reduced_motion')==='true')document.documentElement.classList.add('reduce-motion')}catch(e){}})()`,
          }}
        />
      </head>
      <body className="bg-coup-bg text-white min-h-screen">
        <I18nBootstrap />
        {children}
        <RootLandingContent />
        <PWAInstallPrompt />
      </body>
    </LocaleHtml>
  );
}
