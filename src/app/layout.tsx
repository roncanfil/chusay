import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { InstantThemeSwitch, PocNote, Toaster, TopBar } from '@/components/TopBar';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({ variable: '--font-jakarta', subsets: ['latin'], weight: ['400', '500', '600', '700', '800'] });

export const metadata: Metadata = {
  title: 'Ch’usay Trip Planner',
  description: 'Plan the next trip, collect ideas for someday, and keep every trip before.',
};

export const viewport: Viewport = { viewportFit: 'cover' };

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body>
        <TopBar />
        <PocNote />
        <main id="main">{children}</main>
        <Toaster />
        <InstantThemeSwitch />
      </body>
    </html>
  );
}
