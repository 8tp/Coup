import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import {
  CRITICAL_PRELOAD_IMAGES,
  GAME_PREFETCH_IMAGES,
  TABLE_BACKGROUND_ART,
  TABLE_BACKGROUND_MOBILE_ART,
} from './utils/assets';
import { PWAInstallPrompt } from './components/pwa/PWAInstallPrompt';

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
 * Loaded with next/font/local from a vendored variable woff2 (latin +
 * latin-ext, ~52KB total, SIL OFL — see src/app/fonts/OFL.txt). §4 requires
 * no CDN dependency because the app is offline-capable (public/sw.js); local
 * also means the production build never needs the network to succeed.
 */
const displayFont = localFont({
  src: [
    {
      path: './fonts/Oswald-Variable-latin.woff2',
      weight: '200 700',
      style: 'normal',
    },
    {
      path: './fonts/Oswald-Variable-latin-ext.woff2',
      weight: '200 700',
      style: 'normal',
    },
  ],
  variable: '--font-display',
  display: 'swap',
  preload: true,
  // Oswald is far narrower than any metric-adjustable system face; letting
  // Next synthesise a fallback metric override would make the swap jump.
  adjustFontFallback: false,
  fallback: ['Haettenschweiler', 'Arial Narrow', 'Impact', 'system-ui', 'sans-serif'],
});

export const viewport: Viewport = {
  viewportFit: 'cover',
  themeColor: '#090d0e',
};

export const metadata: Metadata = {
  title: 'Coup Online',
  description: 'Play Coup with friends online — bluff, challenge, and steal your way to victory in this multiplayer card game.',
  applicationName: 'Coup Online',
  keywords: ['coup', 'card game', 'multiplayer', 'board game', 'bluffing', 'online game', 'strategy', 'free'],
  appleWebApp: {
    capable: true,
    title: 'Coup Online',
    statusBarStyle: 'black-translucent',
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://coup.8tp.dev'),
  alternates: {
    canonical: '/',
  },
  icons: {
    icon: [
      { url: '/favicon-v2.ico', sizes: '16x16 32x32 48x48' },
      { url: '/favicon-32x32-v2.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192-v2.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/apple-touch-icon-v2.png',
  },
  openGraph: {
    title: 'Coup Online',
    description: 'Play Coup with friends online — bluff, challenge, and steal your way to victory in this multiplayer card game.',
    siteName: 'Coup Online',
    images: [
      {
        url: '/og-image-v3.png',
        width: 1200,
        height: 630,
        alt: 'Coup Online — Multiplayer Bluffing Card Game',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Coup Online',
    description: 'Play Coup with friends online — bluff, challenge, and steal your way to victory in this multiplayer card game.',
    images: ['/embed-image-v3.png'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={displayFont.variable} suppressHydrationWarning>
      <head>
        {CRITICAL_PRELOAD_IMAGES.map(href => (
          <link key={href} rel="preload" href={href} as="image" fetchPriority="high" />
        ))}
        <link rel="preload" href={TABLE_BACKGROUND_ART} as="image" media="(min-width: 641px)" />
        <link rel="preload" href={TABLE_BACKGROUND_MOBILE_ART} as="image" media="(max-width: 640px)" />
        {GAME_PREFETCH_IMAGES.map(href => (
          <link key={href} rel="prefetch" href={href} as="image" />
        ))}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('coup_text_size');if(s==='large')document.documentElement.classList.add('text-size-large');else if(s==='xl')document.documentElement.classList.add('text-size-xl');if(localStorage.getItem('coup_reduced_motion')==='true')document.documentElement.classList.add('reduce-motion')}catch(e){}})()`,
          }}
        />
      </head>
      <body className="bg-coup-bg text-white min-h-screen">
        {children}
        <PWAInstallPrompt />
      </body>
    </html>
  );
}
