import type { Metadata } from 'next';
import { Cormorant_Garamond, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const sans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600', '700'],
});

const display = Cormorant_Garamond({
  subsets: ['latin'],
  variable: '--font-display',
  style: ['normal', 'italic'],
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'SAVA LIVE — Live Event Gallery & Moments',
  description: 'Galeri momen langsung dan dokumentasi instan untuk acara istimewa Anda.',
  openGraph: {
    title: 'SAVA LIVE — Live Event Gallery & Moments',
    description: 'Galeri momen langsung dan dokumentasi instan untuk acara istimewa Anda.',
    siteName: 'SAVA LIVE',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={`${sans.variable} ${display.variable}`}>
      <body className="bg-neutral-950 text-neutral-100 font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
