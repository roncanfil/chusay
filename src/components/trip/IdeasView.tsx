'use client';

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type MouseEvent } from 'react';
import Sortable from 'sortablejs';
import { Disc } from '@/components/Disc';
import { CatIcon, KindIcon, ListSegIcon, MapSegIcon, PhotoCredit, Pic, SrcChip, vars } from '@/components/icons';
import { BUDGETS, CAT_KEYS, CATS, dayColor, DIETS, INTERESTS, PACE, TRIP_TO_MUHU } from '@/lib/constants';
import { kindLabel } from '@/lib/kinds';
import { searchCatalog, suggestions } from '@/lib/picks';
import { uid } from '@/lib/seed';
import { fromCatalog, findPlaces } from '@/lib/search';
import { editTrip, setView, toast, update, useAppState, useConfig, useView } from '@/lib/store';
import { catsOfIdea, inCat, isPast, isSomeday, isUrl, planned, scheduledDay, stayLabel } from '@/lib/trips';
import type { Cat, Idea, Pace, PlaceResult, Prefs, Trip } from '@/lib/types';
import { IdeaCat, IdeaNote, IdeaSource, MapsLink } from './fields';
import { StayDays, StayFields, StayForm } from './stays';
import { pan, type SetUI, type TabProps, type TripUI } from './ui';

const TRY = ['pastries', 'fado', 'museum', 'viewpoint', 'hotel', 'market', 'tacos', 'temple', 'riad', 'garden'];
const TRY_GOOGLE = ['bakery', 'museum', 'viewpoint', 'market'];
const toggle = (l: string[], k: string) => { const n = l.indexOf(k); if (n >= 0) l.splice(n, 1); else l.push(k); };
const setPrefs = (fn: (p: Prefs) => void) => update(s => fn(s.prefs));

export function IdeasView({ t, ui, set, mapOk }: TabProps) {
  const S = useAppState()!, view = useView(), google = !!useConfig()?.places;
  const [query, setQuery] = useState('');
  const [manual, setManual] = useState<string | null>(null); // the name typed so far, when adding by hand
  const [stayUrl, setStayUrl] = useState<string | null>(null); // a pasted booking-site link being saved as a stay
  const searchSeq = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);
  // Sortable moves DOM nodes React owns; after a drop the groups are re-mounted from state
  const [dragKey, setDragKey] = useState(0);

  // drag ideas up and down inside their category, e.g. stays in order of preference; that order is the list's order.
  // Whole sections drag by their ⋮⋮ grip, and keep that order for the trip
  useEffect(() => {
    const root = listRef.current; if (!root) return;
    const sections = Sortable.create(root, {
      animation: 150, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', handle: '.grip', draggable: '[data-sec]',
      onUpdate() {
        const order = [...root.querySelectorAll<HTMLElement>(':scope > [data-sec]')].map(e => e.dataset.sec!);
        editTrip(t.id, tt => { tt.catOrder = [...order, ...(tt.catOrder ?? []).filter(k => !order.includes(k))]; });
        setDragKey(k => k + 1);
      },
    });
    const made = [...root.querySelectorAll<HTMLElement>('.group[data-cat]')].map(el => Sortable.create(el, {
      animation: 150, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', delay: 150, delayOnTouchOnly: true, preventOnFilter: false,
      draggable: '.row.link', filter: 'button,input,textarea,select,a', ghostClass: 'sortable-ghost',
      onUpdate() {
        const order = [...el.querySelectorAll<HTMLElement>('[data-row]')].map(r => r.dataset.row!), cat = el.dataset.cat;
        editTrip(t.id, tt => {
          const mine = order.map(id => tt.ideas.find(i => i.id === id)!).filter(Boolean);
          let n = 0; tt.ideas = tt.ideas.map(i => inCat(i, cat!) ? mine[n++] ?? i : i);
        });
        setDragKey(k => k + 1);
      },
    }));
    return () => { sections.destroy(); made.forEach(s => s.destroy()); };
  });
  const [comparing, setComparing] = useState<string | null>(null); // a section shown as options side by side
  const [picked, setPicked] = useState<string[] | null>(null); // picking several ideas at once; null when not picking
  const pickToggle = (id: string) => setPicked(p => p && (p.includes(id) ? p.filter(x => x !== id) : [...p, id]));
  // what's left off the maps is kept with the trip: whole categories, or single places (a stay we didn't pick)
  const catOff = (k: string) => !!t.mapOffCats?.includes(k);
  const toggleCat = (k: string) => editTrip(t.id, tt => { const l = tt.mapOffCats ?? []; tt.mapOffCats = l.includes(k) ? l.filter(x => x !== k) : [...l, k]; });

  const counts: Record<string, number> = { all: t.ideas.length };
  t.ideas.forEach(i => catsOfIdea(i).forEach(k => { counts[k] = (counts[k] || 0) + 1; }));
  const ordered = [...CAT_KEYS].sort((a, b) => rank(t, a) - rank(t, b));
  const cats = ([['all', 'All'], ...CAT_KEYS.map(k => [k, CATS[k].label])] as [Cat | 'all', string][]).filter(([k]) => counts[k]);
  const picks = suggestions(S, t), P = S.prefs, s = ui.search;

  // Google Places when the server has a key, otherwise the preview's sample results; only the latest search counts
  async function runSearch(q: string) {
    q = q.trim(); if (!q) return;
    const n = ++searchSeq.current;
    setManual(null); set({ search: { q, loading: true, results: [] } });
    try {
      const results = await findPlaces(t, q, google);
      if (n === searchSeq.current) set({ search: { q, loading: false, results } });
    } catch (e) {
      if (n === searchSeq.current) set({ search: { q, loading: false, results: [], error: `Search isn’t working right now. ${e instanceof Error ? e.message : ''}` } });
    }
  }
  function openAdd() { setQuery(''); setManual(null); setStayUrl(null); searchSeq.current++; set({ adding: true, search: null }); }
  function closeAdd() { setManual(null); setStayUrl(null); searchSeq.current++; set({ adding: false, search: null }); }
  // a link is a stay from a booking site; anything else is a place search
  function submit(q: string) {
    if (isUrl(q)) { searchSeq.current++; setManual(null); set({ search: null }); setStayUrl(q.trim()); setQuery(''); }
    else { setStayUrl(null); runSearch(q); }
  }
  // keep only what identifies the place; notes are yours to write
  function addPlace(p: PlaceResult, tags: string[] = []) {
    editTrip(t.id, tt => { tt.ideas.push({ id: uid(), ...(p.placeId ? { placeId: p.placeId } : {}), name: p.name, cat: p.cat, kind: p.kind, hood: p.hood, lat: p.lat, lng: p.lng, tags: [...tags], note: '' }); });
    if (s?.results) set({ search: { ...s, results: s.results.filter(x => x !== p) } });
    toast(`Saved ${p.name} to ${CATS[p.cat].label}.`);
  }
  // step one of the build guide's Ideas tab: a place typed in by hand, with no location
  function addManual(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget), name = String(f.get('name')).trim(), cat = f.get('cat') as Cat;
    if (!name) return;
    editTrip(t.id, tt => { tt.ideas.push({ id: uid(), name, cat, hood: String(f.get('area') || '').trim(), lat: null, lng: null, tags: [], note: '' }); });
    setManual(null); toast(`Saved ${name} to ${CATS[cat].label}.`);
  }
  const byHand = (name = '') => <button type="button" className="linkish" onClick={() => setManual(name)}>add it by hand</button>;

  const searchBox = ui.adding && (
    <div className="group searchbox">
      <form className="search row" role="search" onSubmit={e => { e.preventDefault(); submit(query); }}>
        <input className="input" value={query} onChange={e => setQuery(e.target.value)} autoFocus placeholder={`Search places in ${t.dest.name}, or paste a booking link`} autoComplete="off" />
        <button className="btn" type="submit">Search</button>
        <button className="icon-btn" type="button" onClick={closeAdd} aria-label="Close search">×</button>
      </form>
      {stayUrl ? <StayForm key={stayUrl} t={t} url={stayUrl} onDone={() => setStayUrl(null)} />
      : manual !== null ? (
        <form className="manual" onSubmit={addManual}>
          <div className="form-row">
            <label className="field">Name<input name="name" defaultValue={manual} autoFocus required placeholder="e.g. Aunt Rosa’s favorite café" /></label>
            <label className="field">Kind of place<select name="cat" defaultValue="sight">{CAT_KEYS.map(k => <option key={k} value={k}>{CATS[k].label}</option>)}</select></label>
            <label className="field">Area<input name="area" placeholder="Neighborhood (optional)" /></label>
          </div>
          <div className="section-head"><span className="faint small">It won’t have a map pin. Paste a Google Maps link as its source to find it later.</span><span className="sp" /><button type="button" className="btn quiet" onClick={() => setManual(null)}>Cancel</button><button type="submit" className="btn primary">Save</button></div>
        </form>
      ) : !s ? (() => {
        const words = google ? TRY_GOOGLE : TRY.filter(w => searchCatalog(t, w).length).slice(0, 4);
        return <div className="more" style={{ paddingLeft: 18 }}><span className="faint small">Try {words.length ? words.map((w, n) => <span key={w}>{n ? ', ' : ''}<button type="button" className="linkish" onClick={() => { setQuery(w); runSearch(w); }}>{w}</button></span>) : 'a type of place, like “market” or “hotel”'}, or {byHand()}. For a stay, paste its Airbnb or Booking.com link.</span></div>;
      })()
        : s.loading ? <><div className="shimmer" /><div className="shimmer" /></>
        : s.results.length ? <>
          {s.results.map(p => (
            <div key={p.placeId || p.name} className="row" style={vars({ '--cc': CATS[p.cat].color })}>
              <Pic p={p} /><div className="main"><span className="title">{p.name}</span><span className="meta">{kindLabel(p)}{p.hood ? ' · ' + p.hood : ''}</span></div>
              <button type="button" className="btn-sm" onClick={() => addPlace(p)}>+ Save</button>
            </div>
          ))}
          <div className="more" style={{ paddingLeft: 18 }}><span className="faint small">{google ? 'From Google. Only the name, kind, area and location are saved; notes are yours.' : 'Sample results. The real app finds places with Google but only saves the name and location. Notes are yours.'} Not here? You can {byHand(s.q)}.</span></div>
        </>
        : <div className="empty">{s.error || (google ? `Nothing found for “${s.q}”.` : `No sample results for “${s.q}”. The real search covers everything on Google Maps.`)}<span>You can {byHand(s.q)}.</span></div>}
    </div>
  );

  const prefs = (
    <div className="prefs">
      <div><span className="lbl">What we enjoy</span><div className="chips">{Object.entries(INTERESTS).map(([k, l]) => <button key={k} type="button" className="chip" aria-pressed={P.interests.includes(k)} onClick={() => setPrefs(p => toggle(p.interests, k))}>{l}</button>)}</div></div>
      <div><span className="lbl">Pace</span><div className="seg">{(Object.entries(PACE) as [Pace, [string, number]][]).map(([k, [l, n]]) => <button key={k} type="button" aria-pressed={P.pace === k} onClick={() => setPrefs(p => { p.pace = k; })}>{l}, {n} a day</button>)}</div></div>
      <div><span className="lbl">Budget</span><div className="seg">{BUDGETS.map((l, n) => <button key={l} type="button" aria-pressed={P.budget === n + 1} onClick={() => setPrefs(p => { p.budget = n + 1; })}>{l}</button>)}</div></div>
      <div><span className="lbl">In lists, show</span><div className="seg"><button type="button" aria-pressed={P.photos !== false} onClick={() => setPrefs(p => { p.photos = true; })}>Photos</button><button type="button" aria-pressed={P.photos === false} onClick={() => setPrefs(p => { p.photos = false; })}>Icons</button></div></div>
      <div><span className="lbl">Food needs</span><div className="chips">{Object.entries(DIETS).map(([k, l]) => <button key={k} type="button" className="chip" aria-pressed={P.diet.includes(k)} onClick={() => setPrefs(p => toggle(p.diet, k))}>{l}</button>)}</div></div>
    </div>
  );

  const picksBox = (
    <Disc k="picks" open={false} cls="picks tint" style={vars({ '--sc': '#12A39F' })}
      head={<><span className="pick-mark" aria-hidden="true">✦</span><b>Picks for you</b><span className="faint small">{picks.length ? picks.length + ' based on what you both enjoy' : 'none right now'}</span></>}>
      <div className="group">
        {picks.length ? picks.map(({ p, why }) => (
          <div key={p.name} className="row" style={vars({ '--cc': CATS[p.cat].color })}>
            <Pic p={p} /><div className="main"><span className="title">{p.name}</span><span className="meta">{kindLabel(p)} · {p.hood}</span><span className="why">{why}</span></div>
            <button type="button" className="btn-sm" onClick={() => addPlace(fromCatalog(p), p.tags)}>+ Save</button>
            <button type="button" className="icon-btn" onClick={() => update(st => { st.dismissed.push(p.name); })} aria-label="Not for us">×</button>
          </div>
        )) : <div className="empty">No new picks. Try changing your preferences.</div>}
      </div>
      <Disc k="prefs" open={false} cls="nested" head={<><span className="small" style={{ fontWeight: 600 }}>Our preferences</span><span className="faint small">shared by both of you</span></>}>{prefs}</Disc>
    </Disc>
  );

  const groups = (ui.cat === 'all' ? ordered : [ui.cat]).filter(k => counts[k]);
  return <>
    <div className="toolbar">
      <button type="button" className="btn primary" onClick={openAdd}>+ Add a place</button>
      {t.ideas.length > 1 && <button type="button" className="btn" aria-pressed={!!picked} onClick={() => setPicked(p => p ? null : [])}>Select</button>}
      {mapOk && (
        <div className="seg map-switch" role="group" aria-label="Map">
          <button type="button" aria-pressed={view.ideasMap} onClick={() => setView({ ideasMap: true })}><MapSegIcon />With map</button>
          <button type="button" aria-pressed={!view.ideasMap} onClick={() => setView({ ideasMap: false })}><ListSegIcon />List only</button>
        </div>
      )}
      <div className="seg cats" role="group" aria-label="Show category">
        {cats.map(([k, l]) => <button key={k} type="button" aria-pressed={ui.cat === k} onClick={() => set({ cat: k, open: null, hl: null })}>{k !== 'all' && <CatIcon cat={k} cls="ic-sm" />}{l}</button>)}
      </div>
    </div>
    {picked && <PickBar t={t} picked={picked} setPicked={setPicked} all={t.ideas.map(i => i.id)} />}
    {searchBox}
    {picksBox}
    {mapOk && view.ideasMap && t.ideas.length > 0 && (
      <div className="inline-field map-pick">On the map <span className="chips">{CAT_KEYS.filter(k => counts[k]).map(k => (
        <button key={k} type="button" className="chip dchip" style={vars({ '--dc': CATS[k].color })} aria-pressed={!catOff(k)} onClick={() => toggleCat(k)}>{CATS[k].label}</button>
      ))}</span></div>
    )}
    {!t.ideas.length
      ? <div className="group empty"><b style={{ color: 'var(--ink)' }}>No ideas saved yet</b><span>Search for places, or open your picks.</span><button type="button" className="btn primary" onClick={openAdd}>+ Add a place</button></div>
      : <div ref={listRef} key={dragKey}>{groups.map(k => (
        <div key={k} data-sec={k}><Disc k={`cat-${k}`} cls="tint" style={vars({ '--sc': CATS[k].color })} head={<><span className="grip" aria-label="Drag to reorder sections" title="Drag to reorder sections">⋮⋮</span><CatIcon cat={k} /><b>{CATS[k].label}</b><span className="faint small">{counts[k]}</span></>}>
          {counts[k] > 1 && <span className="faint small drag-hint">
            {comparing === k ? 'Side by side, in your order.' : `Drag to put them in order of preference${k === 'stay' || k === 'car' ? ', favorite first' : ''}.`}
            {(k === 'stay' || k === 'car') && <> <button type="button" className="linkish" onClick={() => setComparing(comparing === k ? null : k)}>{comparing === k ? 'Back to the list' : 'Compare them'}</button></>}
          </span>}
          {comparing === k ? <Compare t={t} list={t.ideas.filter(i => inCat(i, k))} open={id => { setComparing(null); set({ open: id, hl: id, panTo: pan(id) }); }} />
          : <div className="group" data-cat={k}>{t.ideas.filter(i => inCat(i, k)).map(i => <IdeaRow key={i.id} t={t} i={i} ui={ui} set={set} pick={picked ? { on: picked.includes(i.id), toggle: () => pickToggle(i.id) } : null} offMap={!!i.offMap} catOff={catOff(i.cat)} toggleMap={() => editTrip(t.id, tt => { const x = tt.ideas.find(y => y.id === i.id)!; if (x.offMap) delete x.offMap; else x.offMap = true; })} />)}</div>}
        </Disc></div>
      ))}</div>}
  </>;
}

// opening a row shows the note, the source, day chips to plan it, and Remove idea
// offMap: this idea left off the map; catOff: its whole category is
// pick: while picking several, a tap ticks the row instead of opening it
function IdeaRow({ t, i, ui, set, pick, offMap, catOff, toggleMap }: { t: Trip; i: Idea; ui: TripUI; set: SetUI; pick: { on: boolean; toggle: () => void } | null; offMap: boolean; catOff: boolean; toggleMap: () => void }) {
  const d = isSomeday(t) ? -1 : scheduledDay(t, i.id), open = !pick && ui.open === i.id;
  const toggleOpen = () => { if (pick) return pick.toggle(); const o = open ? null : i.id; set({ open: o, hl: o, ...(o ? { panTo: pan(o) } : {}) }); };
  const click = (e: MouseEvent) => { if (!(e.target as Element).closest('button,a')) toggleOpen(); };
  const key = (e: KeyboardEvent) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); toggleOpen(); } };
  function setDay(k: number) {
    const cur = scheduledDay(t, i.id);
    editTrip(t.id, tt => { tt.days.forEach(x => { x.stops = x.stops.filter(st => st.idea !== i.id); }); if (cur !== k) tt.days[k].stops.push({ id: uid(), idea: i.id, time: '' }); });
    toast(cur !== k ? `Added to Day ${k + 1}.` : 'Taken off the itinerary.');
  }
  function remove() {
    editTrip(t.id, tt => { tt.ideas = tt.ideas.filter(x => x.id !== i.id); tt.days.forEach(x => { x.stops = x.stops.filter(st => st.idea !== i.id); }); });
    set({ open: null, hl: null }); toast(`Removed ${i.name}.`);
  }
  return <>
    <div className={`row link ${open || pick?.on ? 'sel' : ''}`} data-row={i.id} style={vars({ '--cc': CATS[i.cat].color })} aria-expanded={pick ? undefined : open} aria-checked={pick ? pick.on : undefined} role={pick ? 'checkbox' : undefined} tabIndex={0} onClick={click} onKeyDown={key}>
      {pick && <span className={`tick ${pick.on ? 'on' : ''}`} aria-hidden="true">{pick.on ? '✓' : ''}</span>}
      <Pic p={i} />
      <div className="main"><span className="title">{i.name}</span><span className="meta"><KindIcon p={i} />{[kindLabel(i), i.price, i.hood, i.note, (offMap || catOff) && i.lat != null && !planned(t, i) && 'not on the map'].filter(Boolean).join(' · ')}</span><SrcChip v={i.source} /></div>
      {d >= 0 && <span className="tag-day" style={vars({ '--dc': dayColor(d) })}>Day {d + 1}</span>}
      {i.cat === 'stay' && !isSomeday(t) && stayLabel(t, i) && <span className="tag-day stay-tag" style={vars({ '--dc': CATS.stay.color })}>{stayLabel(t, i)}</span>}
      <span className="caret" aria-hidden="true">›</span>
    </div>
    {open && (
      <div className="more">
        <IdeaNote t={t} i={i} />
        <IdeaSource t={t} i={i} />
        <StayFields t={t} i={i} />
        <IdeaCat t={t} i={i} />
        <MapsLink t={t} i={i} />
        <PhotoCredit p={i} />
        {i.cat === 'stay' && !isSomeday(t) && <StayDays t={t} i={i} />}
        {!isSomeday(t) && <div className="inline-field">{d >= 0 ? 'Planned for' : 'Add to'} <span className="chips">{t.days.map((x, k) => <button key={x.id} type="button" className="chip dchip" style={vars({ '--dc': dayColor(k) })} aria-pressed={d === k} onClick={() => setDay(k)}>Day {k + 1}</button>)}</span></div>}
        <MoveIdea t={t} i={i} done={() => set({ open: null, hl: null })} />
        <div className="acts">
          {i.lat != null && !catOff && <button type="button" className="btn-sm" aria-pressed={!offMap} onClick={toggleMap}>{offMap ? 'Show on the map' : 'Hide from the map'}</button>}
          <button type="button" className="btn-sm" onClick={remove}>Remove idea</button>
        </div>
      </div>
    )}
  </>;
}


// take an idea off this trip and keep it elsewhere: another trip, or Muhu for some later trip (it leaves this trip's days too)
// takes ideas off this trip (and its days), and keeps them in another trip, in Muhu, or nowhere (removed)
function moveIdeas(t: Trip, ids: string[], to: string | 'muhu' | null) {
  update(s => {
    const from = s.trips.find(x => x.id === t.id)!, moving = from.ideas.filter(x => ids.includes(x.id));
    from.ideas = from.ideas.filter(x => !ids.includes(x.id));
    from.days.forEach(d => { d.stops = d.stops.filter(x => !x.idea || !ids.includes(x.idea)); });
    ids.forEach(id => { delete from.feedback.votes[id]; });
    for (const i of moving) {
      // a new id: an idea belongs to one trip, and the old one is deleted with this trip's next save
      const copy: Idea = { ...i, id: uid() }; delete copy.stayDays; delete copy.offMap; // its days and map choice belonged to this trip
      if (to === 'muhu') s.muhu.push({ id: uid(), cid: t.dest.cid, country: t.dest.country, name: i.name, cats: [TRIP_TO_MUHU[i.cat] ?? 'other'], want: '', area: i.hood, when: '', far: '', note: i.note,
        ...(i.source ? { source: i.source } : {}), ...(i.placeId ? { placeId: i.placeId, match: 'set' as const } : {}), lat: i.lat, lng: i.lng, ...(i.image ? { image: i.image } : {}) });
      else if (to) s.trips.find(x => x.id === to)!.ideas.push(copy);
    }
  });
}
const otherTrips = (S: { trips: Trip[] }, t: Trip) => S.trips.filter(x => x.id !== t.id && !isPast(x)).sort((a, b) => Number(b.dest.cid === t.dest.cid) - Number(a.dest.cid === t.dest.cid));
const whereTo = (S: { trips: Trip[] }, t: Trip, to: string) => to === 'muhu' ? `Muhu, under ${t.dest.country}` : S.trips.find(x => x.id === to)!.name;

function MoveIdea({ t, i, done }: { t: Trip; i: Idea; done: () => void }) {
  const S = useAppState()!;
  const move = (to: string) => { moveIdeas(t, [i.id], to); done(); toast(`Moved ${i.name} to ${whereTo(S, t, to)}.`); };
  return (
    <div className="inline-field">Move to <span className="chips">
      <button type="button" className="chip" onClick={() => move('muhu')}>Muhu, for later</button>
      {otherTrips(S, t).map(x => <button key={x.id} type="button" className="chip" onClick={() => move(x.id)}>{x.name}</button>)}
    </span></div>
  );
}

// several ideas at once: tick them, then move them all to Muhu or another trip, or remove them (asked once more first)
function PickBar({ t, picked, setPicked, all }: { t: Trip; picked: string[]; setPicked: (p: string[] | null) => void; all: string[] }) {
  const S = useAppState()!;
  const [sure, setSure] = useState(false);
  const n = picked.length, what = `${n} ${n === 1 ? 'idea' : 'ideas'}`;
  const move = (to: string) => { moveIdeas(t, picked, to); setPicked(null); toast(`Moved ${what} to ${whereTo(S, t, to)}.`); };
  return (
    <div className="pick-bar">
      <b>{n ? `${what} picked` : 'Tap ideas to pick them'}</b>
      <button type="button" className="linkish small" onClick={() => setPicked(n === all.length ? [] : all)}>{n === all.length ? 'Pick none' : 'Pick all'}</button>
      <span className="sp" />
      {n > 0 && (sure
        ? <><span className="small">Remove {what} from this trip?</span><button type="button" className="btn-sm danger" onClick={() => { moveIdeas(t, picked, null); setPicked(null); toast(`Removed ${what}.`); }}>Yes, remove</button><button type="button" className="btn-sm" onClick={() => setSure(false)}>No</button></>
        : <span className="chips">
          <button type="button" className="chip" onClick={() => move('muhu')}>Move to Muhu</button>
          {otherTrips(S, t).map(x => <button key={x.id} type="button" className="chip" onClick={() => move(x.id)}>Move to {x.name}</button>)}
          <button type="button" className="chip" onClick={() => setSure(true)}>Remove</button>
        </span>)}
      <button type="button" className="btn-sm" onClick={() => setPicked(null)}>Done</button>
    </div>
  );
}

// the trip's own order of sections; ones it hasn't placed keep the usual order after them
const rank = (t: Trip, k: string) => { const n = t.catOrder?.indexOf(k) ?? -1; return n < 0 ? 100 + CAT_KEYS.indexOf(k) : n; };

// stays or rental cars side by side, in the order of preference; "Open" goes back to the list with that one opened
function Compare({ t, list, open }: { t: Trip; list: Idea[]; open: (id: string) => void }) {
  return (
    <div className="compare-n">{list.map(i => (
      <div key={i.id} className="cmp-col" style={vars({ '--cc': CATS[i.cat].color })}>
        <Pic p={i} big />
        <b className="cmp-name">{i.name}</b>
        {i.price && <div><span className="lbl">Price</span>{i.price}</div>}
        {i.hood && <div><span className="lbl">{i.cat === 'car' ? 'Pick up' : 'Area'}</span>{i.hood}</div>}
        {i.cat === 'stay' && stayLabel(t, i) && <div><span className="lbl">Staying</span>{stayLabel(t, i)}</div>}
        {i.note && <div><span className="lbl">Our notes</span><span className="cmp-note">{i.note}</span></div>}
        <SrcChip v={i.source} />
        <div className="acts"><button type="button" className="btn-sm" onClick={() => open(i.id)}>Open</button></div>
      </div>
    ))}</div>
  );
}
