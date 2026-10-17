'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { vars } from '@/components/icons';
import { Thumb } from '@/components/map/Thumb';
import { CITY } from '@/lib/data/cities';
import { mkTrip } from '@/lib/seed';
import { findDestinations } from '@/lib/search';
import { toast, update, useAppState, useConfig } from '@/lib/store';
import { fmtRange, isoDate, isPast, isSomeday, relTime, today } from '@/lib/trips';
import type { CityKey, DestinationResult, Trip } from '@/lib/types';

// tiles are colored like the world map: planning, want to go (someday), visited (past)
const SECTIONS = { up: ['planning', 'Coming up'], some: ['want', 'Someday'], past: ['visited', 'Been there'] } as const;
type Section = keyof typeof SECTIONS;

function Tile({ t, kind }: { t: Trip; kind: Section }) {
  const tag = kind === 'some' ? `${t.ideas.length} ideas` : kind === 'past' ? 'Past trip' : relTime(t) || 'Coming up';
  return (
    <Link className="tile" href={`/trips/${t.id}`} style={vars({ '--sc': `var(--s-${SECTIONS[kind][0]})` })}>
      <span className="tile-map"><Thumb t={t} /></span>
      <span className="tile-txt"><b>{t.name}</b><small className="num">{t.dest.country}{isSomeday(t) ? '' : ' · ' + fmtRange(t)}</small></span>
      <span className="tile-tag">{tag}</span>
    </Link>
  );
}

function TileSection({ kind, list, note, empty }: { kind: Section; list: Trip[]; note?: string; empty: string }) {
  return (
    <section className="section">
      <div className="section-head"><h2><i className="sc-dot" style={vars({ '--sc': `var(--s-${SECTIONS[kind][0]})` })} />{SECTIONS[kind][1]}</h2>{note && <span className="faint small">{note}</span>}</div>
      {list.length ? <div className="tiles">{list.map(t => <Tile key={t.id} t={t} kind={kind} />)}</div> : <div className="group empty">{empty}</div>}
    </section>
  );
}

// a Google destination that is one of the preview's cities keeps its sample culture notes and picks
const cityKeyFor = (d: DestinationResult) => (Object.keys(CITY) as CityKey[]).find(k => CITY[k].cid === d.cid && CITY[k].name.toLowerCase() === d.name.toLowerCase()) ?? null;

// + New: a trip with dates (first day plus number of days) or a Someday list with no dates
function NewTripForm({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const google = !!useConfig()?.places;
  const [when, setWhen] = useState<'dates' | 'someday'>('dates');
  const [dq, setDq] = useState(''), [found, setFound] = useState<DestinationResult[] | null>(null), [dest, setDest] = useState<DestinationResult | null>(null);
  const some = when === 'someday';
  async function find() {
    const q = dq.trim(); if (!q) return;
    try { setFound(await findDestinations(q)); } catch { toast('Couldn’t search for places right now.'); }
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (google && !dest) { toast('Find and pick where you’re going first.'); return; }
    const f = new FormData(e.currentTarget), name = String(f.get('name') || '').trim();
    const city = dest ? cityKeyFor(dest) : f.get('city') as CityKey, where = dest ? dest.name : CITY[city!].name;
    const t = mkTrip({
      name: name || (some ? `${where} someday` : `${where} trip`), city,
      ...(dest ? { dest: { name: dest.name, country: dest.country, cid: dest.cid }, center: { lat: dest.lat, lng: dest.lng } } : {}),
      start: some ? null : String(f.get('start')), len: some ? 0 : Math.max(1, Math.min(21, Number(f.get('len')) || 4)),
    });
    update(s => { s.trips.push(t); });
    onDone();
    toast(some ? `Saved ${t.name}. Add ideas whenever you find them.` : `Created ${t.name}. Your other trips are untouched.`);
    router.push(`/trips/${t.id}`);
  }
  return (
    <form className="group form" style={{ marginTop: 18 }} onSubmit={submit}>
      <div className="seg" role="group" aria-label="Dates">
        <button type="button" aria-pressed={!some} onClick={() => setWhen('dates')}>A trip with dates</button>
        <button type="button" aria-pressed={some} onClick={() => setWhen('someday')}>Someday, no dates yet</button>
      </div>
      <div className="form-row">
        <label className="field">Name<input name="name" autoFocus placeholder={some ? 'e.g. Iceland someday' : 'e.g. Lisbon, round two'} /></label>
        {!google ? <label className="field">Where<select name="city">{Object.entries(CITY).map(([k, c]) => <option key={k} value={k}>{c.name}{c.name !== c.country ? ', ' + c.country : ''}</option>)}</select></label>
          : <div className="field">Where{dest
            ? <span className="dest-picked">{dest.name}{dest.name !== dest.country ? ', ' + dest.country : ''}<button type="button" className="linkish" onClick={() => { setDest(null); setFound(null); }}>Change</button></span>
            : <span className="search"><input className="input" value={dq} onChange={e => setDq(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); find(); } }} placeholder="City, region or country" aria-label="Where" /><button type="button" className="btn" onClick={find}>Find</button></span>}
          </div>}
        {!some && <>
          <label className="field">First day<input name="start" type="date" required defaultValue={isoDate(today())} /></label>
          <label className="field">Days<input name="len" type="number" min="1" max="21" defaultValue="4" required /></label>
        </>}
      </div>
      {google && !dest && found && (
        <div className="group dest-results">{found.length
          ? found.map(d => <button key={d.placeId} type="button" className="row link" onClick={() => setDest(d)}><div className="main"><span className="title">{d.name}</span><span className="meta">{d.address}</span></div><span className="chev" aria-hidden="true">›</span></button>)
          : <div className="empty">Nothing found for “{dq}”. Try a city or country name.</div>}
        </div>
      )}
      <div className="section-head">
        <p className="faint small">{some ? 'Save ideas now and add dates whenever you decide to go.' : google ? 'Any city, region or country.' : 'The preview knows a few places. The real app takes any destination.'}</p>
        <span className="sp" />
        <button className="btn primary" type="submit">Create</button>
      </div>
    </form>
  );
}

export function TripsPage() {
  const S = useAppState(), cfg = useConfig();
  const [newOpen, setNewOpen] = useState(false);
  if (!S || !cfg) return null;
  const upcoming = S.trips.filter(t => !isSomeday(t) && !isPast(t)).sort((a, b) => a.start!.localeCompare(b.start!));
  const someday = S.trips.filter(isSomeday);
  const past = S.trips.filter(isPast).sort((a, b) => b.start!.localeCompare(a.start!));
  return (
    <div className="wrap">
      <div className="page-head">
        <div><h1>Our trips</h1><p className="muted">Plan the next one, collect ideas for someday, and keep every trip before.</p></div>
        <button type="button" className="btn primary" onClick={() => setNewOpen(o => !o)}>{newOpen ? 'Cancel' : '+ New'}</button>
      </div>
      {newOpen && <NewTripForm onDone={() => setNewOpen(false)} />}
      <TileSection kind="up" list={upcoming} empty="Nothing booked yet." />
      <TileSection kind="some" list={someday} note="Ideas for places we want to go, no dates needed" empty="Save a place you want to go with “+ New”." />
      <TileSection kind="past" list={past} empty="Trips appear here once they are over." />
    </div>
  );
}
