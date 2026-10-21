'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { memo, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { STATUS } from '@/lib/constants';
import { CITY } from '@/lib/data/cities';
import worldData from '@/lib/data/world.json';
import { panZoom, type Bounds, type PanZoom } from '@/lib/map/panzoom';
import { mkTrip, uid } from '@/lib/seed';
import { toast, update, useAppState } from '@/lib/store';
import { fmtMonth, fmtRange, isoMonth, isSomeday, statusOf, today, visitList } from '@/lib/trips';
import type { AppState, CityKey, Status } from '@/lib/types';

const WORLD = worldData as { w: number; h: number; c: { id: string; n: string; d: string }[] };
const COUNTRY: Record<string, string> = Object.fromEntries(WORLD.c.map(c => [c.id, c.n]));
const SORTED = WORLD.c.map(c => [c.id, c.n] as const).sort((a, b) => a[1].localeCompare(b[1]));

// hover label: the country plus every trip, visit or ideas list there (not its status)
function tipLines(S: AppState, cid: string) {
  const lines = S.trips.filter(t => t.dest.cid === cid).map(t => [t.name, isSomeday(t) ? `${t.ideas.length} ideas` : fmtRange(t)]);
  for (const v of S.visits.filter(v => v.cid === cid)) lines.push([v.places, fmtMonth(v.from)]);
  const seeds = S.muhu.filter(m => m.cid === cid).length;
  if (seeds) lines.push(['Muhu', `${seeds} ${seeds === 1 ? 'idea' : 'ideas'}`]);
  return lines;
}

const ORDER = Object.keys(STATUS) as Status[];

// the country's main land: its biggest piece plus the pieces close to it, so Portugal isn't zoomed out to the Azores
function countryBox(d: string): Bounds {
  const parts = d.split('M').filter(Boolean).map(p => {
    const n = p.match(/-?[\d.]+/g)!.map(Number); let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let k = 0; k + 1 < n.length; k += 2) { x0 = Math.min(x0, n[k]); x1 = Math.max(x1, n[k]); y0 = Math.min(y0, n[k + 1]); y1 = Math.max(y1, n[k + 1]); }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  });
  const main = parts.reduce((a, b) => b.w * b.h > a.w * a.h ? b : a), reach = Math.max(main.w, main.h);
  const near = parts.filter(p => Math.abs(p.x + p.w / 2 - main.x - main.w / 2) < reach && Math.abs(p.y + p.h / 2 - main.y - main.h / 2) < reach);
  const x = Math.min(...near.map(p => p.x)), y = Math.min(...near.map(p => p.y));
  return { x, y, w: Math.max(...near.map(p => p.x + p.w)) - x, h: Math.max(...near.map(p => p.y + p.h)) - y };
}

// the country shapes only redraw when a status or the picked country changes.
// One status is a flat color; several blend softly into each other like watercolor.
const Countries = memo(function Countries({ statuses, picked }: { statuses: string; picked: string | null }) {
  const st = statuses.split(',');
  const mixes = [...new Set(st.filter(x => x.includes('-')))];
  return <>
    <defs>{mixes.map(m => {
      const cs = m.split('-');
      return (
        <linearGradient key={m} id={`mix-${m}`} x1="0" y1="0" x2="1" y2="1">
          {cs.map((c, n) => <stop key={c} offset={`${15 + (70 * n) / (cs.length - 1)}%`} style={{ stopColor: `var(--s-${c})` }} />)}
        </linearGradient>
      );
    })}</defs>
    {WORLD.c.map((c, n) => {
      const mix = st[n].includes('-');
      return <path key={c.id} className={`country st-${mix ? 'mix' : st[n] || 'none'} ${picked === c.id ? 'picked' : ''}`} style={mix ? { fill: `url(#mix-${st[n]})` } : undefined} d={c.d} data-cid={c.id} />;
    })}
  </>;
});

export function WorldPage() {
  const S = useAppState();
  const router = useRouter();
  const svgRef = useRef<SVGSVGElement>(null), panelRef = useRef<HTMLDivElement>(null), api = useRef<PanZoom | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [tip, setTip] = useState<{ cid: string; x: number; y: number } | null>(null);
  const ready = !!S;

  useLayoutEffect(() => {
    const svg = svgRef.current; if (!svg) return;
    const m = panZoom(svg, 'world', { x: 0, y: 0, w: WORLD.w, h: WORLD.h }, null);
    api.current = m;
    return () => { m.destroy(); api.current = null; };
  }, [ready]);
  useEffect(() => {
    if (!country) return;
    const d = WORLD.c.find(c => c.id === country)?.d;
    if (d) api.current?.fit(countryBox(d));
    panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setCountry(null); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [country]);

  if (!S) return null;
  const status = WORLD.c.map(c => statusOf(S, c.id));
  const counts: Record<string, number> = { visited: 0, planning: 0, want: 0, nope: 0 };
  status.forEach(x => x.s.forEach(s => counts[s]++));
  const listOf = (s: Status) => WORLD.c.filter((_, n) => status[n].s.includes(s)).map(c => c.n).sort();
  // tapping a status turns it on or off, starting from what the map shows now
  const toggleStatus = (cid: string, k: Status) => {
    const cur = statusOf(S, cid).s;
    const next = ORDER.filter(s => s === k ? !cur.includes(k) : cur.includes(s));
    update(st => { if (next.length) st.world[cid] = next; else delete st.world[cid]; });
  };
  const clearStatus = (cid: string) => update(st => { delete st.world[cid]; });

  function newBoard(cid: string) {
    const ck = (Object.keys(CITY) as CityKey[]).find(k => CITY[k].cid === cid && CITY[k].nomap) || null;
    const t = mkTrip({ name: `${COUNTRY[cid]} someday`, city: ck, dest: ck ? null : { name: COUNTRY[cid], country: COUNTRY[cid], cid }, start: null, len: 0 });
    update(st => { st.trips.push(t); });
    setCountry(null); toast(`Started an ideas list for ${COUNTRY[cid]}.`);
    router.push(`/trips/${t.id}`);
  }
  function logVisit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget), from = String(f.get('when'));
    update(st => { st.visits.push({ id: uid(), cid: String(f.get('country')), places: String(f.get('places')).trim(), from, to: from }); });
    setLogOpen(false); toast('Visit logged.');
  }

  const visits = visitList(S);
  const panel = country && (() => {
    const st = statusOf(S, country), trips = S.trips.filter(t => t.dest.cid === country), board = trips.find(isSomeday);
    return (
      <div className="group country-panel" ref={panelRef}>
        <div className="row">
          <div className="main"><span className="title" style={{ fontSize: 18 }}>{COUNTRY[country]}</span>{st.auto && <span className="meta">Set automatically from {trips.length ? trips.map(t => t.name).join(', ') : 'your visit log'}</span>}</div>
          <button type="button" className="icon-btn" onClick={() => setCountry(null)} aria-label="Close">×</button>
        </div>
        <div className="row" style={{ flexWrap: 'wrap' }}><div className="chips">
          {(Object.entries(STATUS) as [Status, { label: string; color: string }][]).map(([k, s]) => <button key={k} type="button" className="chip" aria-pressed={st.s.includes(k)} onClick={() => toggleStatus(country, k)}><i style={{ background: s.color }} />{s.label}</button>)}
          {!!S.world[country]?.length && <button type="button" className="chip" onClick={() => clearStatus(country)}>Clear</button>}
        </div></div>
        <div className="row">{board
          ? <Link className="linkish" href={`/trips/${board.id}`}>Open our ideas for {COUNTRY[country]} ›</Link>
          : <button type="button" className="linkish" onClick={() => newBoard(country)}>+ Start saving ideas for {COUNTRY[country]}</button>}</div>
      </div>
    );
  })();

  return (
    <div className="wrap wide">
      <div className="page-head"><div><h1>Our world</h1><p className="muted num">{counts.visited} countries visited · {counts.planning} in planning · {counts.want} on the wish list</p></div></div>
      <section className="group world-card">
        <div className="legend">
          {(Object.entries(STATUS) as [Status, { label: string; color: string }][]).map(([k, s]) => <span key={k} className="chip"><i style={{ background: s.color }} />{s.label} <span className="n">{counts[k]}</span></span>)}
          <span className="faint small" style={{ marginLeft: 'auto' }}>Click a country to change it; it can have more than one. Drag to move, double-click to zoom.</span>
        </div>
        <div className="world-box">
          <svg ref={svgRef} viewBox={`0 0 ${WORLD.w} ${WORLD.h}`} role="img" aria-label="World map colored by travel status"
            onPointerMove={e => { const p = (e.target as Element).closest<SVGPathElement>('.country'); setTip(p && e.pointerType !== 'touch' ? { cid: p.dataset.cid!, x: e.clientX, y: e.clientY } : null); }}
            onPointerLeave={() => setTip(null)}
            onClick={e => { const p = (e.target as Element).closest<SVGPathElement>('.country'); if (p && !api.current?.dragging()) setCountry(p.dataset.cid!); }}>
            <defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="var(--s-none)" /><line x1="0" y1="0" x2="0" y2="6" stroke="var(--s-nope)" strokeWidth="3" /></pattern></defs>
            <Countries statuses={status.map(x => x.s.join('-')).join(',')} picked={country} />
          </svg>
          <div className="map-ctrl">
            <button type="button" onClick={() => api.current?.zoom(1.6)} aria-label="Zoom in">+</button>
            <button type="button" onClick={() => api.current?.zoom(0.625)} aria-label="Zoom out">−</button>
            <button type="button" onClick={() => api.current?.all()} aria-label="Show whole world" title="Whole world">⤢</button>
          </div>
        </div>
        {panel}
      </section>
      {tip && <div className="tip" style={{ left: tip.x + 12, top: tip.y + 14 }}><b>{COUNTRY[tip.cid]}</b>{tipLines(S, tip.cid).map(([a, b], n) => <div key={n}>{a} <span>{b}</span></div>)}</div>}
      <div className="world-cols">
        <section className="group">
          <div className="section-head"><h2>Where we’ve been</h2><span className="sp" /><button type="button" className="btn-sm" aria-expanded={logOpen} onClick={() => setLogOpen(o => !o)}>{logOpen ? 'Close' : '+ Log a visit'}</button></div>
          {logOpen && (
            <form className="form-row" style={{ alignItems: 'end' }} onSubmit={logVisit}>
              <label className="field">Country<select name="country">{SORTED.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select></label>
              <label className="field">Places<input name="places" placeholder="Cities, parks…" required /></label>
              <label className="field">When<input name="when" type="month" required defaultValue={isoMonth(today())} /></label>
              <button className="btn primary" type="submit">Add</button>
            </form>
          )}
          <div className="timeline">{visits.map((v, n) => {
            const y = v.from.slice(0, 4), head = !n || visits[n - 1].from.slice(0, 4) !== y;
            return (
              <div key={v.trip || v.id} style={{ display: 'contents' }}>
                {head && <div className="year num">{y}</div>}
                <div className="visit"><span className="dotv" /><div><b>{COUNTRY[v.cid] || ''}</b><small>{v.places}</small></div>
                  <div className="when num">{v.when}<br />{v.trip
                    ? <Link className="linkish" href={`/trips/${v.trip}`}>Open trip</Link>
                    : <button type="button" className="linkish" onClick={() => update(st => { st.visits = st.visits.filter(x => x.id !== v.id); })}>Remove</button>}</div>
                </div>
              </div>
            );
          })}</div>
          <p className="faint small">Past trips appear here on their own. Log older trips by hand.</p>
        </section>
        <section className="group"><h2>On our list</h2>
          {(['planning', 'want'] as const).map(s => (
            <div key={s} className="stack" style={{ gap: 8 }}><h3>{STATUS[s].label}</h3>
              <div className="chips">{listOf(s).map(n => <span key={n} className="chip"><i style={{ background: STATUS[s].color }} />{n}</span>)}{!listOf(s).length && <span className="faint">None yet</span>}</div>
            </div>
          ))}
          <p className="faint small">Saving ideas for a country, as a Someday list or in Muhu, puts it on the wish list. A trip with dates moves it to Planning, and once the trip is over it counts as Visited.</p>
        </section>
      </div>
    </div>
  );
}
