'use client';

import { useEffect, useRef, useState, useSyncExternalStore, type ChangeEvent, type FormEvent, type KeyboardEvent, type MouseEvent, type RefObject } from 'react';
import { Disc } from '@/components/Disc';
import { ListSegIcon, MapSegIcon, PinSvg, SrcChip, vars } from '@/components/icons';
import { GoogleMap, useMapsFailed } from '@/components/map/GoogleMap';
import type { MapPlace, PanRequest } from '@/components/map/TripMap';
import { CATS, MUHU_CATS, MUHU_KEYS, MUHU_TO_TRIP, WANT } from '@/lib/constants';
import worldData from '@/lib/data/world.json';
import { byWant, catsOf, fromNotion, guessPlaces, mainCat, mapsUrl, placeQuery, plain, readExport, uploadPhoto, type ImportResult } from '@/lib/muhu';
import { usePhoto } from '@/lib/photos';
import { findAnywhere } from '@/lib/search';
import { uid } from '@/lib/seed';
import { editMuhu, editTrip, setView, toast, update, useAppState, useConfig, useView } from '@/lib/store';
import { isPast } from '@/lib/trips';
import type { AppState, MuhuCat, MuhuIdea, PlaceResult, Trip, Want } from '@/lib/types';

const WORLD = worldData as { c: { id: string; n: string }[] };
const SORTED = WORLD.c.map(c => [c.id, c.n] as const).sort((a, b) => a[1].localeCompare(b[1]));
const COUNTRY: Record<string, string> = Object.fromEntries(SORTED);
const PORTUGAL = '620';
const ideas = (n: number) => `${n} ${n === 1 ? 'idea' : 'ideas'}`;

export function MuhuIcon({ cat, cls = 'ic' }: { cat: MuhuCat; cls?: string }) {
  return <span className={cls} style={vars({ '--cc': MUHU_CATS[cat].color })} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={MUHU_CATS[cat].icon} /></svg></span>;
}

// how many of each category: a thin colored strip on each country tile
function Mix({ list }: { list: MuhuIdea[] }) {
  const n: Partial<Record<MuhuCat, number>> = {};
  list.forEach(m => { const c = mainCat(m); n[c] = (n[c] || 0) + 1; });
  return <span className="mix" aria-hidden="true">{MUHU_KEYS.filter(k => n[k]).map(k => <i key={k} style={vars({ '--cc': MUHU_CATS[k].color, flexGrow: String(n[k]) })} />)}</span>;
}

const CountrySelect = ({ name, value }: { name: string; value: string }) => (
  <select name={name} defaultValue={value}>{SORTED.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select>
);

function AddForm({ cid, onDone }: { cid: string; onDone: (cid: string) => void }) {
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget), name = String(f.get('name')).trim(), c = String(f.get('country')), cat = f.get('cat') as MuhuCat;
    if (!name) return;
    update(s => { s.muhu.push({ id: uid(), cid: c, country: COUNTRY[c], name, cats: [cat], want: '', area: String(f.get('area') || '').trim(), when: '', far: '', note: '' }); });
    toast(`Saved ${name} to ${COUNTRY[c]}.`); onDone(c);
  }
  return (
    <form className="group form" onSubmit={submit}>
      <div className="form-row">
        <label className="field">What<input name="name" autoFocus required placeholder="e.g. Sunset at Jardim do Morro" /></label>
        <label className="field">Country<CountrySelect name="country" value={cid} /></label>
        <label className="field">Category<select name="cat" defaultValue="outdoors">{MUHU_KEYS.map(k => <option key={k} value={k}>{MUHU_CATS[k].label}</option>)}</select></label>
        <label className="field">Where<input name="area" placeholder="Town or region (optional)" /></label>
      </div>
      <div className="section-head"><span className="faint small">Open it afterwards to add notes, when to go and how to get there.</span><span className="sp" /><button type="button" className="btn quiet" onClick={() => onDone(cid)}>Cancel</button><button type="submit" className="btn primary">Save</button></div>
    </form>
  );
}

// a Notion table exported as CSV; nothing is saved until "Add"
function ImportForm({ S, cid, onDone }: { S: AppState; cid: string; onDone: (cid: string) => void }) {
  const [home, setHome] = useState(cid);
  const [text, setText] = useState<string | null>(null);
  const found: ImportResult | null = text === null ? null : fromNotion(text, { cid: home, country: COUNTRY[home] }, S.muhu, SORTED);
  function pick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    readExport(file).then(setText, () => toast('Couldn’t read that file. Choose the .zip from Notion or the .csv inside it.'));
  }
  const count = (found?.ideas.length ?? 0) + (found?.filled.length ?? 0);
  function add() {
    if (!count) return;
    const fill = new Map(found!.filled.map(m => [m.id, m]));
    update(s => { s.muhu = s.muhu.map(m => fill.get(m.id) ?? m); s.muhu.push(...found!.ideas); });
    toast([found!.ideas.length && `Added ${ideas(found!.ideas.length)}`, found!.filled.length && `filled in ${found!.filled.length} already saved`].filter(Boolean).join(', ') + '.'); onDone(home);
  }
  return (
    <div className="group form">
      <p className="small muted">In Notion, open the list, choose <b>⋯ → Export</b>, pick <b>Markdown &amp; CSV</b>, and choose the <b>.zip</b> it downloads here (or the <b>.csv</b> ending in <b>_all</b> inside it). Pictures stay in Notion.</p>
      <div className="form-row">
        <label className="field">Whose list is it<select value={home} onChange={e => setHome(e.target.value)}>{SORTED.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select></label>
        <label className="field">CSV file<input type="file" accept=".zip,.csv,application/zip,text/csv" onChange={pick} /></label>
      </div>
      <div className="section-head">
        <span className="faint small">{!found ? 'Categories, how much you want it, when to go, notes and links come along.'
          : found.namesOnly ? 'This file only has the names. Choose the .zip from Notion, or the .csv ending in _all, to bring the details too.'
          : !count ? 'Nothing new in this file.'
          : [found.ideas.length && `${ideas(found.ideas.length)} to add${found.moved ? `, ${found.moved} of them in another country` : ''}`,
            found.filled.length && `${found.filled.length} already saved to fill in`,
            found.skipped && `${found.skipped} already saved or repeated, skipped`].filter(Boolean).join('. ') + '.'}</span>
        <span className="sp" />
        <button type="button" className="btn quiet" onClick={() => onDone(home)}>Cancel</button>
        <button type="button" className="btn primary" disabled={!count || found?.namesOnly} onClick={add}>{found?.filled.length && !found.ideas.length ? 'Fill in' : `Add ${found?.ideas.length ? ideas(found.ideas.length) : ''}`}</button>
      </div>
    </div>
  );
}

function TextField({ label, value, set, ph }: { label: string; value: string; set: (v: string) => void; ph: string }) {
  return <label className="note-field"><span>{label}</span><input className="input" value={value} onChange={e => set(e.target.value)} placeholder={ph} /></label>;
}

// the side panel only fits on wide screens; phones open everything in place
const WIDE = '(min-width: 900px)';
const onWide = (l: () => void) => { const q = matchMedia(WIDE); q.addEventListener('change', l); return () => q.removeEventListener('change', l); };
const useWide = () => useSyncExternalStore(onWide, () => matchMedia(WIDE).matches, () => false);

// Google photos cost a request each, so a tile only asks for its photo once it's about to scroll into view
function useInView(ref: RefObject<Element | null>) {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el || seen) return;
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) setSeen(true); }, { rootMargin: '300px' });
    io.observe(el); return () => io.disconnect();
  }, [ref, seen]);
  return seen;
}

// our own picture first, then Google's photo of the matched place, otherwise the category's icon on its color
function MuhuPhoto({ m, cat, big = false, google = true, credit = false, cls = 'mph' }: { m: MuhuIdea; cat: MuhuCat; big?: boolean; google?: boolean; credit?: boolean; cls?: string }) {
  const cfg = useConfig(), ref = useRef<HTMLSpanElement>(null), near = useInView(ref);
  const [broken, setBroken] = useState<string | null>(null);
  const own = m.image && broken !== m.image ? m.image : null;
  const photo = usePhoto(m.placeId, google && !own && !!cfg?.places && near, big ? 640 : 240);
  const style = vars({ '--cc': MUHU_CATS[cat].color });
  /* eslint-disable @next/next/no-img-element -- pictures from other sites or Google, of unknown size */
  return <>
    <span ref={ref} className={`${cls} ${own || photo ? '' : 'blank'}`} style={style}>
      {own ? <img src={own} alt={`Our picture of ${m.name}`} loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(own)} />
        : photo ? <img src={photo.uri} alt={`Photo of ${m.name}`} title={photo.author ? `Photo: ${photo.author}` : undefined} loading="lazy" referrerPolicy="no-referrer" />
        : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={MUHU_CATS[cat].icon} /></svg>}
    </span>
    {/* Google asks for the photographer's name wherever their photo is shown large */}
    {credit && !own && photo?.author && <span className="photo-credit">Photo: {photo.authorUri ? <a href={photo.authorUri} target="_blank" rel="noopener noreferrer">{photo.author}</a> : photo.author}</span>}
  </>;
  /* eslint-enable @next/next/no-img-element */
}

// our own picture: upload one from the phone or computer, or paste a link to one
function PhotoField({ m }: { m: MuhuIdea }) {
  const [linking, setLinking] = useState(false), [busy, setBusy] = useState(false);
  async function upload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
    setBusy(true);
    try { const url = await uploadPhoto(file); editMuhu(m.id, x => { x.image = url; }); toast('Picture saved.'); }
    catch (err) { toast(err instanceof Error ? err.message : 'Couldn’t save that picture.'); }
    finally { setBusy(false); }
  }
  function link(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const url = String(new FormData(e.currentTarget).get('url')).trim();
    if (!/^https?:\/\//i.test(url)) { toast('Paste a link that starts with https://'); return; }
    editMuhu(m.id, x => { x.image = url; }); setLinking(false);
  }
  return <>
    <div className="inline-field">Photo
      <span className="faint small">{m.image ? 'our own' : m.placeId ? 'from Google' : 'none yet'}</span>
      <label className="btn-sm linkbtn" aria-disabled={busy}>{busy ? 'Saving…' : 'Upload'}<input type="file" accept="image/*" hidden disabled={busy} onChange={upload} /></label>
      <button type="button" className="btn-sm" aria-expanded={linking} onClick={() => setLinking(v => !v)}>Paste a link</button>
      {m.image && <button type="button" className="btn-sm" onClick={() => editMuhu(m.id, x => { delete x.image; })}>{m.placeId ? 'Use Google’s' : 'Remove'}</button>}
    </div>
    {linking && <form className="search" onSubmit={link}><input className="input" name="url" autoFocus placeholder="https://… a link to a picture" /><button className="btn-sm" type="submit">Use it</button></form>}
  </>;
}

// which Google place the idea is: guessed by the app, fixed here
function GoogleField({ m }: { m: MuhuIdea }) {
  const [q, setQ] = useState<string | null>(null);
  const [hits, setHits] = useState<PlaceResult[] | null>(null);
  async function search(e: FormEvent) {
    e.preventDefault(); if (!q?.trim()) return;
    setHits(null);
    try { setHits(await findAnywhere(q)); } catch (err) { toast(err instanceof Error ? err.message : 'Search isn’t working right now.'); }
  }
  const pick = (p: PlaceResult) => { editMuhu(m.id, x => { x.placeId = p.placeId; x.lat = p.lat; x.lng = p.lng; x.match = 'set'; }); setQ(null); setHits(null); toast(`Linked to ${p.name} on Google.`); };
  const unlink = () => editMuhu(m.id, x => { delete x.placeId; x.lat = null; x.lng = null; x.match = 'none'; });
  return <>
    <div className="inline-field">On Google
      <span className="faint small">{!m.placeId ? 'not linked' : m.match === 'auto' ? 'matched by name, check it' : 'linked'}</span>
      <button type="button" className="btn-sm" aria-expanded={q !== null} onClick={() => { setQ(q === null ? placeQuery(m) : null); setHits(null); }}>{m.placeId ? 'Wrong place?' : 'Find it'}</button>
      {m.placeId && <button type="button" className="btn-sm" onClick={unlink}>Unlink</button>}
    </div>
    {q !== null && (
      <div className="group">
        <form className="search row" onSubmit={search}><input className="input" value={q} onChange={e => setQ(e.target.value)} autoFocus /><button className="btn-sm" type="submit">Search</button></form>
        {hits && (hits.length ? hits.slice(0, 5).map(p => (
          <div key={p.placeId || p.name} className="row"><div className="main"><span className="title">{p.name}</span>{p.hood && <span className="meta">{p.hood}</span>}</div>
            <button type="button" className="btn-sm" onClick={() => pick(p)}>This one</button></div>
        )) : <div className="empty">Nothing found. Try fewer words.</div>)}
      </div>
    )}
  </>;
}

// everything about an idea, all editable; opens in place, or in the side panel on wide screens
function MuhuDetails({ S, m }: { S: AppState; m: MuhuIdea }) {
  const google = !!useConfig()?.places;
  const ed = (fn: (x: MuhuIdea) => void) => editMuhu(m.id, fn);
  const trips = S.trips.filter(t => t.dest.cid === m.cid && !isPast(t));
  function toTrip(id: string) {
    editTrip(id, t => { t.ideas.push({ id: uid(), ...(m.placeId ? { placeId: m.placeId } : {}), name: m.name, cat: MUHU_TO_TRIP[mainCat(m)], hood: m.area, lat: m.lat ?? null, lng: m.lng ?? null, tags: [], note: m.note, ...(m.source ? { source: m.source } : {}) }); });
    toast(`Added to ${S.trips.find(t => t.id === id)!.name}, under ${CATS[MUHU_TO_TRIP[mainCat(m)]].label}.`);
  }
  return <>
    <label className="note-field"><span>Our notes</span>
      <textarea rows={2} value={m.note} onChange={e => ed(x => { x.note = e.target.value; })} placeholder="What it is, who told us, what to know before going…" />
    </label>
    <div className="form-row">
      <TextField label="Where" value={m.area} set={v => ed(x => { x.area = v; })} ph="Town or region" />
      <TextField label="When to go" value={m.when} set={v => ed(x => { x.when = v; })} ph="e.g. June, or Sunset" />
      <TextField label="Getting there" value={m.far} set={v => ed(x => { x.far = v; })} ph="e.g. 1 hr by car" />
    </div>
    <TextField label="Source" value={m.source || ''} set={v => ed(x => { x.source = v; })} ph="Paste a link (Google Maps, blog, video) or who told you" />
    <div className="inline-field">Category <span className="chips">{MUHU_KEYS.map(k => {
      const on = m.cats.includes(k);
      return <button key={k} type="button" className="chip dchip" style={vars({ '--dc': MUHU_CATS[k].color })} aria-pressed={on}
        onClick={() => ed(x => { x.cats = on ? x.cats.filter(c => c !== k) : [...x.cats, k]; })}>{MUHU_CATS[k].label}</button>;
    })}</span></div>
    <div className="inline-field">How much <span className="chips">{(Object.entries(WANT) as [Exclude<Want, ''>, string][]).map(([k, l]) => (
      <button key={k} type="button" className="chip" aria-pressed={m.want === k} onClick={() => ed(x => { x.want = x.want === k ? '' : k; })}>{l}</button>
    ))}</span></div>
    <PhotoField m={m} />
    {google && <GoogleField m={m} />}
    <label className="inline-field">Country
      <select className="input" style={{ width: 'auto' }} value={m.cid} onChange={e => { const c = e.target.value; ed(x => { x.cid = c; x.country = COUNTRY[c]; }); toast(`Moved to ${COUNTRY[c]}.`); }}>
        {SORTED.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
      </select>
    </label>
    {!!trips.length && <div className="inline-field">Add to a trip <span className="chips">{trips.map(t => {
      const has = t.ideas.some(i => plain(i.name) === plain(m.name));
      return <button key={t.id} type="button" className="chip" aria-pressed={has} disabled={has} onClick={() => toTrip(t.id)}>{has ? `In ${t.name}` : t.name}</button>;
    })}</span></div>}
    <div className="acts">
      <a className="btn-sm linkbtn" href={mapsUrl(m)} target="_blank" rel="noopener noreferrer"><PinSvg />Open in Google Maps</a>
      <button type="button" className="btn-sm" onClick={() => { update(s => { s.muhu = s.muhu.filter(x => x.id !== m.id); }); toast(`Removed ${m.name}.`); }}>Remove</button>
    </div>
  </>;
}

interface Pick { id: string; group: string }
interface ItemProps { S: AppState; m: MuhuIdea; cat: MuhuCat; sel: boolean; open: boolean; toggle: () => void; photos: boolean }
const clickable = (toggle: () => void) => ({
  tabIndex: 0,
  onClick: (e: MouseEvent) => { if (!(e.target as Element).closest('button,a')) toggle(); },
  onKeyDown: (e: KeyboardEvent) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); toggle(); } },
});

// a tile: the photo, the name and where it is; opening it shows the details right below its row
function MuhuTile({ S, m, cat, sel, open, toggle, photos }: ItemProps) {
  return <>
    <div className={`mi-tile ${sel ? 'sel' : ''}`} style={vars({ '--cc': MUHU_CATS[cat].color })} aria-expanded={sel} {...clickable(toggle)}>
      <MuhuPhoto m={m} cat={cat} big google={photos} />
      {m.want === 'high' && <span className="must">{WANT.high}</span>}
      <b>{m.name}</b>
      {(m.area || m.when) && <small>{[m.area, m.when].filter(Boolean).join(' · ')}</small>}
    </div>
    {open && <div className="tile-more" style={vars({ '--cc': MUHU_CATS[cat].color })}><MuhuPhoto m={m} cat={cat} big credit cls="mph hero" /><MuhuDetails S={S} m={m} /></div>}
  </>;
}

function MuhuRow({ S, m, cat, sel, open, toggle, photos }: ItemProps) {
  return <>
    <div className={`row link ${sel ? 'sel' : ''}`} style={vars({ '--cc': MUHU_CATS[cat].color })} aria-expanded={sel} {...clickable(toggle)}>
      <MuhuPhoto m={m} cat={cat} google={photos} cls="mph thumb-sm" />
      <div className="main">
        <span className="title">{m.name}{m.want === 'high' && <span className="must">{WANT.high}</span>}</span>
        {(m.area || m.when) && <span className="meta">{[m.area, m.when].filter(Boolean).join(' · ')}</span>}
        <SrcChip v={m.source} />
      </div>
      <span className="caret" aria-hidden="true">›</span>
    </div>
    {open && <div className="more"><MuhuPhoto m={m} cat={cat} big credit cls="mph hero" /><MuhuDetails S={S} m={m} /></div>}
  </>;
}

// beside the ideas on wide screens: the picked idea's photo, its pin on the map, and its details; with nothing picked, every pin
function SidePanel({ S, list, pick, onPin, viewKey }: { S: AppState; list: MuhuIdea[]; pick: MuhuIdea | null; onPin: (id: string) => void; viewKey: string }) {
  const cfg = useConfig(), failed = useMapsFailed();
  const [pan, setPan] = useState<PanRequest | null>(null);
  const [panFor, setPanFor] = useState<string | null>(null);
  if ((pick?.id ?? null) !== panFor) { setPanFor(pick?.id ?? null); if (pick) setPan(p => ({ id: pick.id, seq: (p?.seq ?? 0) + 1 })); }
  const located = list.filter(m => m.lat != null);
  // the map draws trip ideas; Muhu's colors and icons ride along
  const places: MapPlace[] = located.map(m => ({
    idea: { id: m.id, name: m.name, cat: MUHU_TO_TRIP[mainCat(m)], hood: m.area, lat: m.lat!, lng: m.lng!, note: '', tags: [] },
    color: MUHU_CATS[mainCat(m)].color, icon: MUHU_CATS[mainCat(m)].icon, dim: !!pick && pick.id !== m.id,
  }));
  const t: Trip = { id: 'muhu', name: 'Muhu', city: null, dest: { name: pick?.country || located[0]?.country || '', country: '', cid: '' }, center: null, start: null, len: 0, ideas: places.map(p => p.idea), days: [], notes: '', feedback: { again: '', highlights: '', next: '', votes: {} } };
  const map = cfg?.mapsKey && !failed && !!located.length && (pick ? pick.lat != null : true)
    && <GoogleMap t={t} places={places} routes={[]} viewKey={viewKey} hl={pick?.id ?? null} panTo={pan} onPin={onPin} mapsKey={cfg.mapsKey} mapId={cfg.mapId} />;
  if (!pick) return <aside className="muhu-side">{map}<p className="faint small">Pick an idea to see its photo, where it is and everything you saved about it.{cfg?.places && located.length < list.length ? ` ${list.length - located.length} aren’t on the map yet: open one and use “Find it”.` : ''}</p></aside>;
  const cat = mainCat(pick);
  return (
    <aside className="muhu-side" style={vars({ '--cc': MUHU_CATS[cat].color })}>
      <MuhuPhoto key={pick.id} m={pick} cat={cat} big credit cls="mph side-photo" />
      {map}
      <div className="side-card">
        <div className="section-head"><h2>{pick.name}</h2><span className="sp" /><button type="button" className="icon-btn" onClick={() => onPin(pick.id)} aria-label="Close">×</button></div>
        <MuhuDetails S={S} m={pick} />
      </div>
    </aside>
  );
}

// Muhu: seeds for future trips, by country or by category
export function MuhuPage() {
  const S = useAppState(), cfg = useConfig(), view = useView(), wide = useWide();
  const [by, setBy] = useState<'country' | 'cat'>('country');
  const [cid, setCid] = useState<string | null>(null);
  const [cat, setCat] = useState<MuhuCat | null>(null);
  const [open, setOpen] = useState<Pick | null>(null);
  const [panel, setPanel] = useState<'add' | 'import' | null>(null);
  // ideas not yet looked up on Google get the app's best guess, once
  const google = !!cfg?.places, list = S?.muhu;
  useEffect(() => { if (google && list) guessPlaces(list); }, [google, list]);
  if (!S) return null;

  const side = wide && view.muhuSide, photos = S.prefs.photos !== false;
  const countries = [...new Set(S.muhu.map(m => m.cid))].map(c => ({ cid: c, name: COUNTRY[c] || S.muhu.find(m => m.cid === c)!.country, list: S.muhu.filter(m => m.cid === c) }))
    .sort((a, b) => b.list.length - a.list.length || a.name.localeCompare(b.name));
  const inCat = (k: MuhuCat) => S.muhu.filter(m => catsOf(m).includes(k));
  const cats = MUHU_KEYS.filter(k => inCat(k).length);
  const country = countries.find(c => c.cid === cid) || countries[0], category = cat && cats.includes(cat) ? cat : cats[0];
  const shown = by === 'country' ? country?.list ?? [] : category ? inCat(category) : [];
  const pick = open && S.muhu.find(m => m.id === open.id) || null;
  const done = (c: string) => { setPanel(null); setBy('country'); setCid(c); };
  const choose = (id: string, group: string) => setOpen(o => o?.id === id && (side || o.group === group) ? null : { id, group });
  const items = (list: MuhuIdea[], cat: MuhuCat, group: string) => {
    const Item = view.muhuTiles ? MuhuTile : MuhuRow;
    const all = [...list].sort(byWant).map(m => {
      const sel = !!open && open.id === m.id && (side || open.group === group);
      return <Item key={m.id} S={S} m={m} cat={cat} sel={sel} open={sel && !side} toggle={() => choose(m.id, group)} photos={photos} />;
    });
    return view.muhuTiles ? <div className="mideas">{all}</div> : <div className="group">{all}</div>;
  };

  return (
    <div className={`wrap ${side ? 'wide' : ''}`}>
      <div className="page-head">
        <div><h1>Muhu</h1><p className="muted">Seeds for future trips: what we’d love to see, country by country. No trip or dates needed.</p></div>
        <button type="button" className="btn" aria-expanded={panel === 'import'} onClick={() => setPanel(p => p === 'import' ? null : 'import')}>Import from Notion</button>
        <button type="button" className="btn primary" aria-expanded={panel === 'add'} onClick={() => setPanel(p => p === 'add' ? null : 'add')}>{panel === 'add' ? 'Cancel' : '+ Add an idea'}</button>
      </div>
      {panel && <div style={{ marginTop: 18 }}>{panel === 'add'
        ? <AddForm cid={country?.cid || PORTUGAL} onDone={done} />
        : <ImportForm S={S} cid={country?.cid || PORTUGAL} onDone={done} />}</div>}

      {!S.muhu.length ? (
        <div className="group empty" style={{ marginTop: 28 }}>
          <b style={{ color: 'var(--ink)' }}>Nothing saved yet</b>
          <span>Add the places, food and festivals you hear about, or bring in a list from Notion.</span>
        </div>
      ) : <>
        <div className="seg muhu-by" role="group" aria-label="Show">
          <button type="button" aria-pressed={by === 'country'} onClick={() => setBy('country')}>By country</button>
          <button type="button" aria-pressed={by === 'cat'} onClick={() => setBy('cat')}>By category</button>
        </div>
        {by === 'country'
          ? <div className="mtiles">{countries.map(c => (
            <button key={c.cid} type="button" className="mtile" style={vars({ '--sc': 'var(--s-want)' })} aria-pressed={c.cid === country.cid} onClick={() => { setCid(c.cid); setOpen(null); }}>
              <b>{c.name}</b><small className="num">{ideas(c.list.length)}</small><Mix list={c.list} />
            </button>
          ))}</div>
          : <div className="mtiles">{cats.map(k => (
            <button key={k} type="button" className="mtile with-ic" style={vars({ '--sc': MUHU_CATS[k].color })} aria-pressed={k === category} onClick={() => { setCat(k); setOpen(null); }}>
              <MuhuIcon cat={k} /><b>{MUHU_CATS[k].label}</b><small className="num">{ideas(inCat(k).length)}</small>
            </button>
          ))}</div>}
        <div className="toolbar muhu-tools">
          <div className="seg" role="group" aria-label="Show ideas as">
            <button type="button" aria-pressed={view.muhuTiles} onClick={() => setView({ muhuTiles: true })}>Tiles</button>
            <button type="button" aria-pressed={!view.muhuTiles} onClick={() => setView({ muhuTiles: false })}><ListSegIcon />List</button>
          </div>
          {wide && (
            <div className="seg" role="group" aria-label="Beside the ideas">
              <button type="button" aria-pressed={view.muhuSide} onClick={() => setView({ muhuSide: true })}><MapSegIcon />Photo &amp; map</button>
              <button type="button" aria-pressed={!view.muhuSide} onClick={() => setView({ muhuSide: false })}>Ideas only</button>
            </div>
          )}
        </div>
        <div className={side ? 'muhu-split' : ''}>
          <div className="muhu-list">{by === 'country' ? MUHU_KEYS.map(k => {
            const list = country.list.filter(m => catsOf(m).includes(k));
            return !!list.length && (
              <Disc key={k} k={`muhu-${country.cid}-${k}`} cls="tint" style={vars({ '--sc': MUHU_CATS[k].color })} head={<><MuhuIcon cat={k} /><b>{MUHU_CATS[k].label}</b><span className="faint small">{list.length}</span></>}>
                {items(list, k, k)}
              </Disc>
            );
          }) : countries.map(c => {
            const list = c.list.filter(m => catsOf(m).includes(category));
            return !!list.length && (
              <Disc key={c.cid} k={`muhu-${category}-${c.cid}`} cls="tint" style={vars({ '--sc': MUHU_CATS[category].color })} head={<><b>{c.name}</b><span className="faint small">{list.length}</span></>}>
                {items(list, category, c.cid)}
              </Disc>
            );
          })}</div>
          {side && <SidePanel S={S} list={shown} pick={pick} viewKey={`muhu-${by}-${by === 'country' ? country.cid : category}`} onPin={id => choose(id, 'pin')} />}
        </div>
      </>}
    </div>
  );
}
