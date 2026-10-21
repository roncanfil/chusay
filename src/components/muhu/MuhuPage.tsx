'use client';

import { useState, type ChangeEvent, type FormEvent, type KeyboardEvent, type MouseEvent } from 'react';
import { Disc } from '@/components/Disc';
import { PinSvg, SrcChip, vars } from '@/components/icons';
import { CATS, MUHU_CATS, MUHU_KEYS, MUHU_TO_TRIP, WANT } from '@/lib/constants';
import worldData from '@/lib/data/world.json';
import { byWant, catsOf, fromNotion, mainCat, plain, readExport, type ImportResult } from '@/lib/muhu';
import { uid } from '@/lib/seed';
import { editMuhu, editTrip, toast, update, useAppState } from '@/lib/store';
import { isMaps, isPast } from '@/lib/trips';
import type { AppState, MuhuCat, MuhuIdea, Want } from '@/lib/types';

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

// opening a seed shows everything about it, all editable in place
// cat: the section it's listed in, which gives its icon and color
function MuhuRow({ S, m, cat, open, toggle }: { S: AppState; m: MuhuIdea; cat: MuhuCat; open: boolean; toggle: () => void }) {
  const click = (e: MouseEvent) => { if (!(e.target as Element).closest('button,a')) toggle(); };
  const key = (e: KeyboardEvent) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); toggle(); } };
  const ed = (fn: (x: MuhuIdea) => void) => editMuhu(m.id, fn);
  const trips = S.trips.filter(t => t.dest.cid === m.cid && !isPast(t));
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([m.name, m.area, m.country].filter(Boolean).join(', '))}`;
  function toTrip(id: string) {
    editTrip(id, t => { t.ideas.push({ id: uid(), name: m.name, cat: MUHU_TO_TRIP[mainCat(m)], hood: m.area, lat: null, lng: null, tags: [], note: m.note, ...(m.source ? { source: m.source } : {}) }); });
    toast(`Added to ${S.trips.find(t => t.id === id)!.name}, under ${CATS[MUHU_TO_TRIP[mainCat(m)]].label}.`);
  }
  return <>
    <div className={`row link ${open ? 'sel' : ''}`} style={vars({ '--cc': MUHU_CATS[cat].color })} aria-expanded={open} tabIndex={0} onClick={click} onKeyDown={key}>
      <MuhuIcon cat={cat} />
      <div className="main">
        <span className="title">{m.name}{m.want === 'high' && <span className="must">{WANT.high}</span>}</span>
        {(m.area || m.when) && <span className="meta">{[m.area, m.when].filter(Boolean).join(' · ')}</span>}
        <SrcChip v={m.source} />
      </div>
      <span className="caret" aria-hidden="true">›</span>
    </div>
    {open && (
      <div className="more">
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
          {!isMaps(m.source) && <a className="btn-sm linkbtn" href={maps} target="_blank" rel="noopener noreferrer"><PinSvg />Open in Google Maps</a>}
          <button type="button" className="btn-sm" onClick={() => { update(s => { s.muhu = s.muhu.filter(x => x.id !== m.id); }); toast(`Removed ${m.name}.`); }}>Remove</button>
        </div>
      </div>
    )}
  </>;
}

// Muhu: seeds for future trips, by country or by category
export function MuhuPage() {
  const S = useAppState();
  const [by, setBy] = useState<'country' | 'cat'>('country');
  const [cid, setCid] = useState<string | null>(null);
  const [cat, setCat] = useState<MuhuCat | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [panel, setPanel] = useState<'add' | 'import' | null>(null);
  if (!S) return null;

  const countries = [...new Set(S.muhu.map(m => m.cid))].map(c => ({ cid: c, name: COUNTRY[c] || S.muhu.find(m => m.cid === c)!.country, list: S.muhu.filter(m => m.cid === c) }))
    .sort((a, b) => b.list.length - a.list.length || a.name.localeCompare(b.name));
  const inCat = (k: MuhuCat) => S.muhu.filter(m => catsOf(m).includes(k));
  const cats = MUHU_KEYS.filter(k => inCat(k).length);
  const country = countries.find(c => c.cid === cid) || countries[0], category = cat && cats.includes(cat) ? cat : cats[0];
  const done = (c: string) => { setPanel(null); setBy('country'); setCid(c); };
  const rows = (list: MuhuIdea[], cat: MuhuCat, group: string) => (
    <div className="group">{[...list].sort(byWant).map(m => {
      const k = `${group}:${m.id}`;
      return <MuhuRow key={m.id} S={S} m={m} cat={cat} open={open === k} toggle={() => setOpen(open === k ? null : k)} />;
    })}</div>
  );

  return (
    <div className="wrap">
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
        {by === 'country' ? <>
          <div className="mtiles">{countries.map(c => (
            <button key={c.cid} type="button" className="mtile" style={vars({ '--sc': 'var(--s-want)' })} aria-pressed={c.cid === country.cid} onClick={() => { setCid(c.cid); setOpen(null); }}>
              <b>{c.name}</b><small className="num">{ideas(c.list.length)}</small><Mix list={c.list} />
            </button>
          ))}</div>
          <div className="muhu-list">{MUHU_KEYS.map(k => {
            const list = country.list.filter(m => catsOf(m).includes(k));
            return !!list.length && (
              <Disc key={k} k={`muhu-${country.cid}-${k}`} cls="tint" style={vars({ '--sc': MUHU_CATS[k].color })} head={<><MuhuIcon cat={k} /><b>{MUHU_CATS[k].label}</b><span className="faint small">{list.length}</span></>}>
                {rows(list, k, k)}
              </Disc>
            );
          })}</div>
        </> : <>
          <div className="mtiles">{cats.map(k => (
            <button key={k} type="button" className="mtile with-ic" style={vars({ '--sc': MUHU_CATS[k].color })} aria-pressed={k === category} onClick={() => { setCat(k); setOpen(null); }}>
              <MuhuIcon cat={k} /><b>{MUHU_CATS[k].label}</b><small className="num">{ideas(inCat(k).length)}</small>
            </button>
          ))}</div>
          <div className="muhu-list">{countries.map(c => {
            const list = c.list.filter(m => catsOf(m).includes(category));
            return !!list.length && (
              <Disc key={c.cid} k={`muhu-${category}-${c.cid}`} cls="tint" style={vars({ '--sc': MUHU_CATS[category].color })} head={<><b>{c.name}</b><span className="faint small">{list.length}</span></>}>
                {rows(list, category, c.cid)}
              </Disc>
            );
          })}</div>
        </>}
      </>}
    </div>
  );
}
