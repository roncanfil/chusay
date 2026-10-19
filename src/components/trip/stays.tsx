'use client';

import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Pic } from '@/components/icons';
import { CATS } from '@/lib/constants';
import { uid } from '@/lib/seed';
import { findPlaces, previewStay } from '@/lib/search';
import { editIdea, editTrip, toast, useConfig } from '@/lib/store';
import { host, tripCenter } from '@/lib/trips';
import type { Idea, PlaceResult, StayPreview, Trip } from '@/lib/types';

type Pin = { lat: number; lng: number; hood: string; found?: string };

// a page lists other places too; a pin far from the trip is more likely one of those than the stay
function nearTrip(t: Trip, p: StayPreview): Pin | null {
  if (p.lat == null || p.lng == null) return null;
  const c = tripCenter(t);
  if (c && Math.hypot(p.lat - c.lat, (p.lng - c.lng) * Math.cos(c.lat * Math.PI / 180)) > 3) return null;
  return { lat: p.lat, lng: p.lng, hood: '' };
}

// find an address or area with the place search, and keep only its location
export function PinFinder({ t, label, onPick }: { t: Trip; label: string; onPick: (p: Pin) => void }) {
  const google = !!useConfig()?.places;
  const [q, setQ] = useState('');
  const [res, setRes] = useState<PlaceResult[] | 'loading' | null>(null);
  // not a <form>: it sits inside the stay form
  async function find() {
    if (!q.trim()) return;
    setRes('loading');
    try { setRes((await findPlaces(t, q.trim(), google)).filter(p => p.lat != null)); } catch { setRes([]); }
  }
  return (
    <div className="note-field"><span>{label}</span>
      <div className="search row" role="search" style={{ padding: 0, border: 0 }}>
        <input className="input" value={q} onChange={e => setQ(e.target.value)} onKeyDown={(e: KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); find(); } }} placeholder="Address, street or neighborhood" autoComplete="off" />
        <button className="btn" type="button" onClick={find}>Find</button>
      </div>
      {res === 'loading' ? <div className="shimmer" />
        : res && (res.length
          ? <span className="chips">{res.slice(0, 5).map(p => <button key={p.placeId || p.name} type="button" className="chip" onClick={() => { onPick({ lat: p.lat!, lng: p.lng!, hood: p.hood || p.name }); setRes(null); setQ(''); }}>{p.name}{p.hood ? ` · ${p.hood}` : ''}</button>)}</span>
          : <span className="faint small" style={{ fontWeight: 400 }}>Nothing found for “{q}”.</span>)}
    </div>
  );
}

// a pasted booking link: read what the page shares, let them fix or fill the rest, then save it as a stay
export function StayForm({ t, url, onDone }: { t: Trip; url: string; onDone: () => void }) {
  const google = !!useConfig()?.places;
  const [p, setP] = useState<StayPreview | null>(null);
  const [name, setName] = useState(''), [price, setPrice] = useState('');
  const [picked, setPin] = useState<Pin | null | undefined>(undefined); // undefined: use the listing's own location
  const [broken, setBroken] = useState(false); // the listing's picture didn't load
  useEffect(() => {
    let live = true;
    (async () => {
      const r = await previewStay(url).catch((): StayPreview => ({ name: `Stay on ${host(url)}`, image: '', price: '', lat: null, lng: null }));
      if (!live) return;
      setP(r); setName(r.name); setPrice(r.price);
      if (nearTrip(t, r)) return;
      // no location in the listing (Booking.com hides it): look the stay up by name, preferring lodging
      const hits = await findPlaces(t, r.name, google).catch(() => []);
      const words = new Set(r.name.toLowerCase().match(/\p{L}{4,}/gu) || []);
      const ok = hits.filter(x => x.lat != null && (x.name.toLowerCase().match(/\p{L}{4,}/gu) || []).some(w => words.has(w)));
      const h = ok.find(x => x.cat === 'stay') || ok[0];
      if (live && h) setPin(cur => cur === undefined ? { lat: h.lat!, lng: h.lng!, hood: h.hood, found: h.name } : cur);
    })();
    return () => { live = false; };
  // runs once per link; the form is keyed by it
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!p) return <div className="manual"><span className="faint small">Reading {host(url)}…</span><div className="shimmer" /></div>;
  const pin = picked === undefined ? nearTrip(t, p) : picked;
  function save(e: FormEvent) {
    e.preventDefault();
    const n = name.trim() || p!.name;
    editTrip(t.id, tt => { tt.ideas.push({ id: uid(), name: n, cat: 'stay', hood: pin?.hood || '', lat: pin?.lat ?? null, lng: pin?.lng ?? null, tags: [], note: '', source: url, ...(price.trim() ? { price: price.trim() } : {}), ...(p!.image && !broken ? { image: p!.image } : {}) }); });
    toast(`Saved ${n} to ${CATS.stay.label}.`); onDone();
  }
  const missing = [(!p.image || broken) && 'picture', !p.price && 'price', !pin && 'location'].filter(Boolean);
  return (
    <form className="manual" onSubmit={save}>
      <div className="row" style={{ padding: 0, border: 0 }}>
        <Pic p={{ name, cat: 'stay', image: p.image }} onBroken={() => setBroken(true)} />
        <div className="main"><span className="title">{name || p.name}</span><span className="meta">{[price, host(url)].filter(Boolean).join(' · ')}</span></div>
      </div>
      <div className="form-row">
        <label className="field">Name<input value={name} onChange={e => setName(e.target.value)} required /></label>
        <label className="field">Price<input value={price} onChange={e => setPrice(e.target.value)} placeholder="e.g. €140 a night" /></label>
      </div>
      {pin
        ? <span className="faint small">{pin.found ? `Pinned at ${pin.found}${pin.hood ? ', ' + pin.hood : ''}, found by its name.` : picked ? `Pinned at ${pin.hood}.` : 'Pinned on the map from the listing.'} <button type="button" className="linkish" onClick={() => setPin(null)}>{picked && !pin.found ? 'Change' : 'Place it myself'}</button></span>
        : <PinFinder t={t} label="Where is it? (for the map pin)" onPick={setPin} />}
      <div className="section-head">
        <span className="faint small">{missing.length ? `${host(url)} didn’t share the ${missing.join(' or ')}; you can add ${missing.length > 1 ? 'them' : 'it'} here.` : 'Only the link, name, price, picture and location are saved.'}</span>
        <span className="sp" /><button type="button" className="btn quiet" onClick={onDone}>Cancel</button><button type="submit" className="btn primary">Save stay</button>
      </div>
    </form>
  );
}

// in an opened stay: its price, and a pin if it doesn't have one yet
export function StayFields({ t, i }: { t: Trip; i: Idea }) {
  if (i.cat !== 'stay') return null;
  return <>
    <label className="note-field"><span>Price</span>
      <input className="input" value={i.price || ''} onChange={e => editIdea(t.id, i.id, x => { x.price = e.target.value; })} placeholder="e.g. €140 a night" />
    </label>
    {i.lat == null && <PinFinder t={t} label="Place it on the map" onPick={p => editIdea(t.id, i.id, x => { x.lat = p.lat; x.lng = p.lng; if (!x.hood) x.hood = p.hood; })} />}
  </>;
}
