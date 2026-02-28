import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Coup Online',
  description: 'Play Coup with friends online — bluff, challenge, and steal your way to victory in this multiplayer card game.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://coup.live'),
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
  icons: {
    icon: '/coup-logo.png',
    apple: '/coup-logo.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-coup-bg text-white min-h-screen">
        {children}
      </body>
    </html>
  );
}
