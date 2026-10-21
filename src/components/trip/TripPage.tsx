'use client';

import Link from 'next/link';
import { useCallback, useRef, useState, type FormEvent, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { cityKeyFor, useDestinationSearch } from '@/components/DestinationSearch';
import { vars } from '@/components/icons';
import { TripMap, type MapPlace, type MapRoute } from '@/components/map/TripMap';
import { dayColor, TAB_COLORS, type Tab } from '@/lib/constants';
import { CITY } from '@/lib/data/cities';
import { uid } from '@/lib/seed';
import { editTrip, openDisc, setView, toast, toggleMapHidden, useAppState, useConfig, useSession, useView } from '@/lib/store';
import { canMap, fmtRange, ideaOf, isoDate, isPast, isSomeday, relTime, scheduledDay, staysOn, today } from '@/lib/trips';
import type { CityKey, DestinationResult, Trip } from '@/lib/types';
import { CultureView } from './CultureView';
import { DaysView } from './DaysView';
import { FeedbackView } from './FeedbackView';
import { IdeasView } from './IdeasView';
import { initialUI, type TripUI } from './ui';

export function TripPage({ id }: { id: string }) {
  const S = useAppState(), cfg = useConfig();
  if (!S || !cfg) return null;
  const t = S.trips.find(x => x.id === id);
  if (!t) return <div className="wrap"><div className="group empty" style={{ marginTop: 32 }}><b style={{ color: 'var(--ink)' }}>This trip isn’t here</b><span>It may have been removed, or the sample data was reset.</span><Link className="btn primary" href="/">All trips</Link></div></div>;
  return <TripView key={t.id} t={t} />;
}

// map pins and routes for the itinerary: one day's stops, or every day's route in its own color
function dayMapSpec(t: Trip, day: number, all: boolean): { places: MapPlace[]; routes: MapRoute[]; key: string } {
  if (all) {
    const routes = t.days.map((d, k) => ({ color: dayColor(k), ideas: d.stops.map(s => ideaOf(t, s.idea)).filter(i => !!i) }));
    const shown = routes.flatMap(r => r.ideas), stays = t.days.flatMap((_, k) => staysOn(t, k)).filter((i, n, a) => a.indexOf(i) === n && !shown.includes(i));
    return { places: [...shown, ...stays].filter((i, n, a) => a.indexOf(i) === n).map(i => ({ idea: i })), routes, key: `days-all-${t.id}` };
  }
  const d = t.days[day];
  // an empty day shows the unplanned ideas, dimmed
  const places = !d ? [] : d.stops.length ? d.stops.map(s => ideaOf(t, s.idea)).filter(i => !!i).map(i => ({ idea: i }))
    : t.ideas.filter(i => scheduledDay(t, i.id) < 0).map(i => ({ idea: i, dim: true }));
  const routes = d && d.stops.length ? [{ color: dayColor(day), ideas: places.map(p => p.idea) }] : [];
  // where we sleep that day is always on its map, outside the day's route
  const stays = staysOn(t, day).filter(i => !places.some(p => p.idea === i)).map(i => ({ idea: i }));
  return { places: [...places.filter(p => !stays.some(s => s.idea === p.idea)), ...stays], routes, key: `day-${t.id}-${day}` };
}

const clampListW = (lay: HTMLElement, px: number) => Math.round(Math.max(320, Math.min(lay.clientWidth - 280, px)));

function TripView({ t }: { t: Trip }) {
  const view = useView(), { mapHidden } = useSession(), cfg = useConfig();
  const [ui, setUI] = useState<TripUI>(() => initialUI(t));
  const set = useCallback((patch: Partial<TripUI>) => setUI(u => ({ ...u, ...patch })), []);
  const layoutRef = useRef<HTMLDivElement>(null);

  const someday = isSomeday(t), past = isPast(t);
  const tabs: [Tab, string][] = someday ? [['ideas', 'Ideas'], ['culture', 'Culture']] : [['days', 'Itinerary'], ['ideas', 'Ideas'], ['culture', 'Culture'], ['feedback', past ? 'How it went' : 'Feedback']];
  const tab = tabs.some(([k]) => k === ui.tab) ? ui.tab : tabs[0][0];
  const mapOk = canMap(t, !!cfg?.mapsKey);
  const showMap = mapOk && ((tab === 'days' && view.dayMap) || (tab === 'ideas' && view.ideasMap));
  const mspec = tab === 'days' ? dayMapSpec(t, ui.day, view.dayAll)
    : { places: t.ideas.filter(i => (ui.cat === 'all' || i.cat === ui.cat) && !ui.mapOff.includes(i.id) && !ui.mapOff.includes('cat:' + i.cat)).map(i => ({ idea: i })), routes: [], key: `ideas-${t.id}-${ui.cat}` };

  // clicking a pin opens its row, and the row scrolls into view
  function onPin(id: string) {
    let hl: string | null;
    if (tab === 'ideas') {
      const open = ui.open === id ? null : id, idea = ideaOf(t, id)!;
      hl = open;
      set({ open, hl, ...(open && ui.cat !== 'all' && idea.cat !== ui.cat ? { cat: 'all' as const } : {}) });
      if (open) openDisc('cat-' + idea.cat);
    } else {
      const s = t.days[ui.day]?.stops.find(x => x.idea === id);
      const sel = s && ui.sel !== s.id ? s.id : null;
      hl = sel ? id : null;
      set({ sel, hl });
    }
    if (hl) requestAnimationFrame(() => layoutRef.current?.querySelector(tab === 'ideas' ? `[data-row="${id}"]` : `.stn[data-idea="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
  }

  // drag the divider between list and map; the width is remembered, double-click resets it
  function startResize(e: ReactPointerEvent) {
    e.preventDefault();
    const lay = layoutRef.current!, x0 = lay.getBoundingClientRect().left;
    let w: number | null = null;
    document.body.classList.add('resizing');
    const move = (ev: PointerEvent) => { w = clampListW(lay, ev.clientX - x0 - 20); lay.style.setProperty('--list-w', w + 'px'); };
    const up = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      document.body.classList.remove('resizing');
      if (w) setView({ listW: w });
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  }
  function resizeKey(e: KeyboardEvent) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const lay = layoutRef.current!, cur = view.listW || lay.querySelector('.trip-body')!.getBoundingClientRect().width;
    setView({ listW: clampListW(lay, cur + (e.key === 'ArrowRight' ? 40 : -40)) });
  }

  // Pick dates turns a Someday list into a trip and keeps every idea
  function pickDates(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget), start = String(f.get('start')), len = Math.max(1, Math.min(21, Number(f.get('len')) || 5));
    editTrip(t.id, tt => { tt.start = start; tt.len = len; tt.days = Array.from({ length: len }, () => ({ id: uid(), title: '', stops: [] })); });
    toast(`${t.name} now has dates. All ${t.ideas.length} ideas came with it.`);
    setUI({ ...initialUI(t), tab: 'days' });
    scrollTo(0, 0);
  }

  // new dates for a trip that has them: added days start empty; dropped days put their places back in Ideas (nothing is deleted)
  // and move their own plans (meeting friends, reservations) to the new last day
  function changeDates(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget), start = String(f.get('start')), len = Math.max(1, Math.min(21, Number(f.get('len')) || t.len));
    editTrip(t.id, tt => {
      tt.start = start;
      while (tt.days.length < len) tt.days.push({ id: uid(), title: '', stops: [] });
      if (tt.days.length > len) tt.days[len - 1].stops.push(...tt.days.splice(len).flatMap(d => d.stops.filter(x => x.own)));
      tt.len = len;
    });
    set({ datesOpen: false, day: Math.min(ui.day, len - 1) });
    toast(len < t.len ? `Dates changed. Places from the days you dropped are back in Ideas.` : 'Dates changed.');
  }
  const [naming, setNaming] = useState(false);
  function rename(v: string) { const name = v.trim(); if (name && name !== t.name) { editTrip(t.id, tt => { tt.name = name; }); toast('Renamed.'); } setNaming(false); }

  // moving the trip to another place keeps its ideas, days and name; the map and search follow the new center
  const where = useDestinationSearch(movePlace);
  function movePlace(d: DestinationResult) {
    editTrip(t.id, tt => { tt.dest = { name: d.name, country: d.country, cid: d.cid }; tt.center = { lat: d.lat, lng: d.lng }; tt.city = cityKeyFor(d); });
    set({ placeOpen: false });
    toast(`${t.name} is now in ${d.name}. Ideas and days stayed as they were.`);
  }
  function moveSample(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const k = new FormData(e.currentTarget).get('city') as CityKey, c = CITY[k];
    editTrip(t.id, tt => { tt.dest = { name: c.name, country: c.country, cid: c.cid }; tt.center = null; tt.city = k; });
    set({ placeOpen: false });
    toast(`${t.name} is now in ${c.name}.`);
  }

  const tabProps = { t, ui: { ...ui, tab }, set, mapOk };
  return (
    <div ref={layoutRef} className={`wrap wide trip-layout ${showMap ? 'has-map' : ''} tab-${tab}`} style={vars({ '--tc': TAB_COLORS[tab], '--list-w': view.listW ? view.listW + 'px' : undefined })}>
      <div className="trip-head">
        <div><Link className="linkish" href="/">‹ All trips</Link></div>
        {naming
          ? <input className="input title-in" defaultValue={t.name} autoFocus aria-label="Trip name" onBlur={e => rename(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setNaming(false); }} />
          : <div className="title-row"><h1>{t.name}</h1><button type="button" className="btn-sm" onClick={() => setNaming(true)}>Rename</button></div>}
        <div className="meta num">
          <span>{t.dest.name}{t.dest.name !== t.dest.country ? ', ' + t.dest.country : ''}</span>
          <button type="button" className="btn-sm" aria-expanded={ui.placeOpen} onClick={() => { where.reset(); set({ placeOpen: !ui.placeOpen }); }}>{ui.placeOpen ? 'Cancel' : 'Change place'}</button>
          <span>·</span><span>{fmtRange(t)}</span>
          {someday ? <button type="button" className="btn-sm" aria-expanded={ui.datesOpen} onClick={() => set({ datesOpen: !ui.datesOpen })}>{ui.datesOpen ? 'Cancel' : 'Pick dates'}</button>
            : <button type="button" className="btn-sm" aria-expanded={ui.datesOpen} onClick={() => set({ datesOpen: !ui.datesOpen })}>{ui.datesOpen ? 'Cancel' : 'Change dates'}</button>}
          {!someday && (past ? <span className="pill">Past trip</span> : relTime(t) ? <span className="pill go">{relTime(t)}</span> : null)}
        </div>
        {!someday && ui.datesOpen && (
          <form className="group dates-form" onSubmit={changeDates}>
            <label className="field">First day<input name="start" type="date" required defaultValue={t.start!} /></label>
            <label className="field">Days<input name="len" type="number" min="1" max="21" defaultValue={t.len} required /></label>
            <button className="btn primary" type="submit">Save dates</button>
          </form>
        )}
        {someday && ui.datesOpen && (
          <form className="group dates-form" onSubmit={pickDates}>
            <label className="field">First day<input name="start" type="date" required defaultValue={isoDate(today())} /></label>
            <label className="field">Days<input name="len" type="number" min="1" max="21" defaultValue="5" required /></label>
            <button className="btn primary" type="submit">Make it a trip</button>
          </form>
        )}
        {ui.placeOpen && (cfg?.places
          ? <div className="group dates-form place-form"><label className="field">Where is this trip?{where.input}</label>{where.results}</div>
          : <form className="group dates-form" onSubmit={moveSample}>
            <label className="field">Where is this trip?<select name="city" defaultValue={t.city ?? undefined}>{Object.entries(CITY).map(([k, c]) => <option key={k} value={k}>{c.name}{c.name !== c.country ? ', ' + c.country : ''}</option>)}</select></label>
            <button className="btn primary" type="submit">Move trip</button>
          </form>)}
        <div className="tabs" role="tablist">
          {tabs.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} style={vars({ '--tc': TAB_COLORS[k] })} onClick={() => set({ tab: k, hl: null, sel: null, open: null })}><i className="tab-dot" />{l}</button>)}
        </div>
      </div>
      {showMap && (
        <aside className={`mapcol ${mapHidden ? 'collapsed' : ''}`}>
          <div className="split-handle" role="separator" aria-orientation="vertical" aria-label="Drag to resize the list and map" tabIndex={0} title="Drag to resize. Double-click to reset."
            onPointerDown={startResize} onDoubleClick={() => setView({ listW: null })} onKeyDown={resizeKey}><i /></div>
          <button type="button" className="map-toggle" aria-expanded={!mapHidden} onClick={toggleMapHidden}><span className="caret" aria-hidden="true">›</span>Map</button>
          <TripMap t={t} places={mspec.places} routes={mspec.routes} viewKey={mspec.key} hl={ui.hl} panTo={ui.panTo} onPin={onPin} />
        </aside>
      )}
      <div className="trip-body">
        {tab === 'days' ? <DaysView {...tabProps} /> : tab === 'ideas' ? <IdeasView {...tabProps} /> : tab === 'culture' ? <CultureView t={t} /> : <FeedbackView t={t} />}
      </div>
    </div>
  );
}
