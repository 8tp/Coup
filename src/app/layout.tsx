import type { Metadata, Viewport } from 'next';
import './globals.css';

export const viewport: Viewport = {
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'Coup Online',
  description: 'Play Coup with friends online — bluff, challenge, and steal your way to victory in this multiplayer card game.',
  applicationName: 'Coup Online',
  keywords: ['coup', 'card game', 'multiplayer', 'board game', 'bluffing', 'online game', 'strategy', 'free'],
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://coup.chuds.dev'),
  alternates: {
    canonical: '/',
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/coup-logo.png',
  },
  openGraph: {
    title: 'Coup Online',
    description: 'Play Coup with friends online — bluff, challenge, and steal your way to victory in this multiplayer card game.',
    siteName: 'Coup Online',
    images: [
      {
        url: '/og-image.png',
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
    images: ['/og-image.png'],
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
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('coup_text_size');if(s==='large')document.documentElement.classList.add('text-size-large');else if(s==='xl')document.documentElement.classList.add('text-size-xl')}catch(e){}})()`,
          }}
        />
      </head>
      <body className="bg-coup-bg text-white min-h-screen">
        {children}
      </body>
    </html>
  );
}
