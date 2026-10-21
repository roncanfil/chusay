'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { clearViews } from '@/lib/map/panzoom';
import { needsSettling, settleMoved } from '@/lib/muhu';
import { resetData, toast, update, useAppState, useConfig, useToast } from '@/lib/store';

function Logo() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="15" fill="var(--accent)" />
      <path d="M8 21c3-1 4-6 8-6s4 4 8 2" fill="none" stroke="var(--on-accent)" strokeWidth="2.2" strokeLinecap="round" strokeDasharray="0.1 4.2" />
      <circle cx="8" cy="21" r="2.4" fill="var(--on-accent)" />
      <path d="M24 9.5a3.2 3.2 0 0 0-3.2 3.2c0 2.4 3.2 5.3 3.2 5.3s3.2-2.9 3.2-5.3A3.2 3.2 0 0 0 24 9.5Z" fill="var(--on-accent)" />
    </svg>
  );
}

function NavLinks({ current }: { current: 'trips' | 'muhu' | 'world' | null }) {
  return (
    <nav className="nav" aria-label="Main">
      <Link href="/" aria-current={current === 'trips' ? 'page' : undefined}>Trips</Link>
      <Link href="/muhu" aria-current={current === 'muhu' ? 'page' : undefined}>Muhu</Link>
      <Link href="/world" aria-current={current === 'world' ? 'page' : undefined}>World map</Link>
    </nav>
  );
}

function CurrentNav() {
  const path = usePathname();
  return <NavLinks current={path.startsWith('/world') ? 'world' : path.startsWith('/muhu') ? 'muhu' : 'trips'} />;
}

export function TopBar() {
  return (
    <header className="topbar">
      <div className="topbar-in">
        <Link className="brand" href="/" aria-label="Ch'usay home"><Logo />Ch’usay</Link>
        {/* the pathname isn't known while the shell of a trip page prerenders */}
        <Suspense fallback={<NavLinks current={null} />}><CurrentNav /></Suspense>
      </div>
    </header>
  );
}

export function PocNote() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const cfg = useConfig(), sample = !cfg?.mapsKey && !cfg?.places;
  if (!cfg?.demo) return null;
  // shared data now, so resetting erases it for both of you: confirm inline first
  async function reset() {
    setConfirming(false);
    if (!(await resetData())) return;
    clearViews(); router.push('/'); toast('Sample data restored.');
  }
  return (
    <p className="poc-note">
      <b>Proof of concept</b>
      <span>{sample ? 'Sample trips and search results. Drawings stand in for photos and the maps are sketches.' : 'Starts with sample trips.'} Changes are saved for both of you.</span>
      {confirming
        ? <><span>Erase everything and reload the samples?</span><button type="button" className="linkish" onClick={reset}>Yes, reset</button><button type="button" className="linkish" onClick={() => setConfirming(false)}>Cancel</button></>
        : <button type="button" className="linkish" onClick={() => setConfirming(true)}>Reset sample data</button>}
    </p>
  );
}

export function Toaster() {
  const t = useToast();
  return t && <div key={t.n} className="toast" role="status" data-out={t.out || undefined}>{t.msg}</div>;
}

// when the system flips light/dark, switch colors at once instead of fading every element together
export function InstantThemeSwitch() {
  useEffect(() => {
    const mql = matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      const style = document.createElement('style');
      style.textContent = '*,*::before,*::after{transition:none !important}';
      document.head.append(style);
      void document.body.offsetHeight; // commit the new colors while transitions are off
      requestAnimationFrame(() => requestAnimationFrame(() => style.remove()));
    };
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return null;
}

// Muhu ideas moved onto a trip come back once it's over (or when they're taken off it), whichever page is open
export function MuhuReturns() {
  const S = useAppState();
  useEffect(() => { if (S && needsSettling(S)) update(settleMoved); }, [S]);
  return null;
}
