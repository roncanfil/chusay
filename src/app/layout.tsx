import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans, Young_Serif } from 'next/font/google';
import { InstantThemeSwitch, MuhuReturns, PocNote, Toaster, TopBar } from '@/components/TopBar';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({ variable: '--font-jakarta', subsets: ['latin'], weight: ['400', '500', '600', '700', '800'] });
// Passport look: a classic serif for titles only; everything else stays Plus Jakarta Sans
const serif = Young_Serif({ variable: '--font-serif', subsets: ['latin'], weight: '400' });

export const metadata: Metadata = {
  title: 'Ch’usay Trip Planner',
  description: 'Plan the next trip, collect ideas for someday, and keep every trip before.',
};

export const viewport: Viewport = { viewportFit: 'cover' };

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${jakarta.variable} ${serif.variable}`}>
      <body>
        <TopBar />
        <PocNote />
        <main id="main">{children}</main>
        <Toaster />
        <InstantThemeSwitch />
        <MuhuReturns />
      </body>
    </html>
  );
}
