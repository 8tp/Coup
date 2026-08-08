import type { Metadata, Viewport } from 'next';
import './globals.css';
import {
  CRITICAL_PRELOAD_IMAGES,
  GAME_PREFETCH_IMAGES,
  TABLE_BACKGROUND_ART,
  TABLE_BACKGROUND_MOBILE_ART,
} from './utils/assets';
import { PWAInstallPrompt } from './components/pwa/PWAInstallPrompt';

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
      { url: '/favicon.ico', sizes: '32x32' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'Coup Online',
    description: 'Play Coup with friends online — bluff, challenge, and steal your way to victory in this multiplayer card game.',
    siteName: 'Coup Online',
    images: [
      {
        url: '/og-image-v2.png',
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
    images: ['/embed-image-v2.png'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
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
