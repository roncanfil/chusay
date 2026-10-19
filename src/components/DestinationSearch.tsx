'use client';

import { useState } from 'react';
import { CITY } from '@/lib/data/cities';
import { destinationOf, findDestinations } from '@/lib/search';
import { toast } from '@/lib/store';
import type { CityKey, DestinationHit, DestinationResult } from '@/lib/types';

// a Google destination that is one of the preview's cities keeps its sample culture notes and picks
export const cityKeyFor = (d: DestinationResult) => (Object.keys(CITY) as CityKey[]).find(k => CITY[k].cid === d.cid && CITY[k].name.toLowerCase() === d.name.toLowerCase()) ?? null;

// Type a city, region or country and pick one of Google's matches. Returns the search box and
// the results separately so each form can place them in its own layout.
export function useDestinationSearch(onPick: (d: DestinationResult) => void) {
  const [q, setQ] = useState(''), [found, setFound] = useState<DestinationHit[] | null>(null), [busy, setBusy] = useState(false);
  // one token per search-and-pick, so Google bills the typing and the pick as one lookup
  const [session, setSession] = useState(() => crypto.randomUUID());
  async function find() {
    const v = q.trim(); if (!v) return;
    setBusy(true);
    try { setFound(await findDestinations(v, session)); } catch { toast('Couldn’t search for places right now.'); } finally { setBusy(false); }
  }
  async function pick(h: DestinationHit) {
    setBusy(true);
    try {
      const d = await destinationOf(h.placeId, session);
      if (!d) { toast(`Couldn’t place ${h.name} in one country. Try a nearby city or region.`); return; }
      setFound(null); setQ(''); setSession(crypto.randomUUID());
      onPick(d);
    } catch { toast('Couldn’t look up that place right now.'); } finally { setBusy(false); }
  }
  const input = (
    <span className="search">
      <input className="input" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); find(); } }} placeholder="City, region or country" aria-label="Where" />
      <button type="button" className="btn" onClick={find} disabled={busy}>Find</button>
    </span>
  );
  const results = found && (
    <div className="group dest-results">{found.length
      ? found.map(h => <button key={h.placeId} type="button" className="row link" disabled={busy} onClick={() => pick(h)}><div className="main"><span className="title">{h.name}</span><span className="meta">{h.address}</span></div><span className="chev" aria-hidden="true">›</span></button>)
      : <div className="empty">Nothing found for “{q}”. Check the spelling, or try a nearby city.</div>}
    </div>
  );
  return { input, results, reset: () => { setFound(null); setQ(''); } };
}
