'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { cityKeyFor, useDestinationSearch } from '@/components/DestinationSearch';
import { vars } from '@/components/icons';
import { Thumb } from '@/components/map/Thumb';
import { CITY } from '@/lib/data/cities';
import { mkTrip } from '@/lib/seed';
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
      {/* the city (or region) the trip goes to, and its dates on their own line */}
      <span className="tile-txt"><b>{t.name}</b><small>{t.dest.name}</small>{!isSomeday(t) && <small className="num">{fmtRange(t)}</small>}</span>
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

// + New: a trip with dates (first day plus number of days) or a Someday list with no dates
function NewTripForm({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const google = !!useConfig()?.places;
  const [when, setWhen] = useState<'dates' | 'someday'>('dates');
  const [dest, setDest] = useState<DestinationResult | null>(null), where = useDestinationSearch(setDest);
  const some = when === 'someday';
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
            ? <span className="dest-picked">{dest.name}{dest.name !== dest.country ? ', ' + dest.country : ''}<button type="button" className="linkish" onClick={() => setDest(null)}>Change</button></span>
            : where.input}
          </div>}
        {!some && <>
          <label className="field">First day<input name="start" type="date" required defaultValue={isoDate(today())} /></label>
          <label className="field">Days<input name="len" type="number" min="1" max="21" defaultValue="4" required /></label>
        </>}
      </div>
      {google && !dest && where.results}
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
        <div><h1>Our Trips</h1><p className="muted">Plan the next one, collect ideas for someday, and keep every trip before.</p></div>
        <button type="button" className="btn primary" onClick={() => setNewOpen(o => !o)}>{newOpen ? 'Cancel' : '+ New'}</button>
      </div>
      {newOpen && <NewTripForm onDone={() => setNewOpen(false)} />}
      <TileSection kind="up" list={upcoming} empty="Nothing booked yet." />
      <TileSection kind="some" list={someday} note="Ideas for places we want to go, no dates needed" empty="Save a place you want to go with “+ New”." />
      <TileSection kind="past" list={past} empty="Trips appear here once they are over." />
    </div>
  );
}
