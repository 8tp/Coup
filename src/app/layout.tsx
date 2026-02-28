import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Coup Online',
  description: 'Play the classic bluffing card game with friends',
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
