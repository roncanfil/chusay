'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { clearViews } from '@/lib/map/panzoom';
import { needsSettling, settleMoved } from '@/lib/muhu';
import { resetData, toast, update, useAppState, useConfig, useToast } from '@/lib/store';

function Logo() {
  // hummingbird in a compass ring (picked 2026-11-16; same drawing as src/app/icon.svg)
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <g fill="var(--accent)"><polygon points="32,0.5 35.5,7 28.5,7"/><polygon points="63.5,32 57,35.5 57,28.5"/><polygon points="32,63.5 28.5,57 35.5,57"/><polygon points="0.5,32 7,28.5 7,35.5"/></g>
      <circle cx="32" cy="32" r="24" fill="none" stroke="var(--accent)" strokeWidth="3" />
      <g fill="var(--accent)" transform="translate(16 15.5) scale(.5)"><polygon points="2,12 18.5,19 17.5,22.5" /><circle cx="23" cy="22" r="6.2" /><path d="M18 23 C18 35 27 44 40 48 C43 49 45 47 44 44 C40 35 34 27 28 19 Z" /><path d="M25 22 C31 11 42 5 59 2 C53 11 46 23 35.5 33 Z" /><path d="M39 46 L46 61 L47 51 L56 56 L44 44 Z" /></g>
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
