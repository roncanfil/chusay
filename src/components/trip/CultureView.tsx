'use client';

import { useEffect, useState } from 'react';
import { Disc } from '@/components/Disc';
import { vars } from '@/components/icons';
import { CULTURE } from '@/lib/data/culture';
import { editTrip, setView, toast, useConfig, useView } from '@/lib/store';
import type { Culture, CultureEntry, Quirks, Trip } from '@/lib/types';

// Useful phrases, Regional words or Good to do / Best to avoid, and Our notes (never overwritten by a refresh)
export function CultureView({ t }: { t: Trip }) {
  const cfg = useConfig();
  if (!cfg) return null;
  // with a Claude key every trip gets its country's Wikivoyage summary; without one, the preview's samples
  const sample = CULTURE[t.city || ''];
  return <>
    {cfg.culture && <TripQuirks key={t.id + t.dest.name} t={t} />}
    {cfg.culture ? <CountryCulture key={t.dest.cid} t={t} />
      : sample ? <><CultureSections c={sample} /><p className="faint small" style={{ marginTop: 18 }}>Sample notes for the preview.</p></>
      : <div className="group empty"><b style={{ color: 'var(--ink)' }}>Phrases and customs for {t.dest.country}</b><span>These fill in from Wikivoyage once the Claude key is set up on the server.</span></div>}
    <Disc k="notes" cls="tint" style={vars({ '--sc': '#E3A23C' })} head={<><i className="sec-dot" /><b>Our notes</b></>}>
      <label className="field"><span className="sr">Our notes</span><textarea value={t.notes} onChange={e => editTrip(t.id, tt => { tt.notes = e.target.value; })} placeholder="A word someone taught you, a custom you noticed…" /></label>
    </Disc>
  </>;
}

// rows of short texts, each editable, removable, and one more can be added; used for every list in the Culture tab
function RowsEditor({ rows, cols, onChange, add }: { rows: string[][]; cols: { label: string; wide?: boolean }[]; onChange: (rows: string[][]) => void; add: string }) {
  const set = (r: number, c: number, v: string) => onChange(rows.map((row, n) => n === r ? row.map((x, m) => m === c ? v : x) : row));
  return (
    <div className="rows-edit">
      {rows.map((row, r) => (
        <div key={r} className="rows-edit-row" style={vars({ '--cols': cols.map(c => c.wide ? '2fr' : '1fr').join(' ') })}>
          {cols.map((c, m) => <input key={m} className="input" value={row[m] ?? ''} onChange={e => set(r, m, e.target.value)} placeholder={c.label} aria-label={c.label} />)}
          <button type="button" className="icon-btn" aria-label="Remove" onClick={() => onChange(rows.filter((_, n) => n !== r))}>×</button>
        </div>
      ))}
      <button type="button" className="linkish small" onClick={() => onChange([...rows, cols.map(() => '')])}>{add}</button>
    </div>
  );
}
const filled = (rows: string[][]) => rows.filter(r => r.some(x => x.trim())).map(r => r.map(x => x.trim()));

// how to say each phrase stays hidden until asked for; remembered on this device.
// onSave: the tips can be changed, removed or added to; they're kept for every trip to the country
function CultureSections({ c, onSave }: { c: Culture; onSave?: (c: Culture) => void }) {
  const sayIt = useView().sayIt;
  const [draft, setDraft] = useState<Culture | null>(null);
  const toggle = <button type="button" className="btn-sm" style={{ justifySelf: 'start' }} aria-pressed={sayIt} onClick={() => setView({ sayIt: !sayIt })}>{sayIt ? 'Hide pronunciation' : 'Show pronunciation'}</button>;
  if (draft) {
    const put = (patch: Partial<Culture>) => setDraft({ ...draft, ...patch });
    const one = (l: string[]) => l.map(x => [x]);
    return (
      <div className="culture-edit">
        <label className="note-field"><span>Intro</span><textarea rows={3} value={draft.note} onChange={e => put({ note: e.target.value })} /></label>
        {(!!c.phrases.length || !!draft.phrases.length) && <div className="note-field"><span>Useful phrases</span>
          <RowsEditor rows={draft.phrases} cols={[{ label: 'In English' }, { label: 'How they say it' }, { label: 'Pronunciation' }]} onChange={r => put({ phrases: r as Culture['phrases'] })} add="+ Add a phrase" /></div>}
        <div className="note-field"><span>Regional words</span>
          <RowsEditor rows={draft.regional ?? []} cols={[{ label: 'What you get' }, { label: 'Where' }, { label: 'How to ask' }, { label: 'Pronunciation' }]} onChange={r => put({ regional: r as Culture['regional'] })} add="+ Add a word" /></div>
        <div className="note-field"><span>Good to do</span><RowsEditor rows={one(draft.dos)} cols={[{ label: 'A custom worth following', wide: true }]} onChange={r => put({ dos: r.map(x => x[0]) })} add="+ Add one" /></div>
        <div className="note-field"><span>Best to avoid</span><RowsEditor rows={one(draft.donts)} cols={[{ label: 'Something best avoided', wide: true }]} onChange={r => put({ donts: r.map(x => x[0]) })} add="+ Add one" /></div>
        <div className="acts">
          <button type="button" className="btn primary" onClick={() => { onSave!({ ...draft, phrases: filled(draft.phrases) as Culture['phrases'], regional: filled(draft.regional ?? []) as Culture['regional'], dos: draft.dos.map(x => x.trim()).filter(Boolean), donts: draft.donts.map(x => x.trim()).filter(Boolean) }); setDraft(null); }}>Save</button>
          <button type="button" className="btn quiet" onClick={() => setDraft(null)}>Cancel</button>
        </div>
      </div>
    );
  }
  return <>
    <div className="culture-top"><p className="muted culture-note">{c.note}</p>{onSave && <button type="button" className="btn-sm" onClick={() => setDraft(c)}>Edit tips</button>}</div>
    {!!c.phrases.length && (
      <Disc k="phrases" cls="tint" style={vars({ '--sc': '#2F86D6' })} head={<><i className="sec-dot" /><b>Useful phrases</b><span className="faint small">{c.variant}</span></>}>
        <div className="group">
          {c.phrases.map(([en, loc, say]) => <div key={en} className="row"><div className="main phr"><span className="en">{en}</span><span className="loc">{loc}</span>{sayIt && <span className="say">{say}</span>}</div></div>)}
          <div className="more">{toggle}</div>
        </div>
      </Disc>
    )}
    {!!c.regional?.length && (
      <Disc k="regional" cls="tint" style={vars({ '--sc': '#8E5BD0' })} head={<><i className="sec-dot" /><b>Regional words</b><span className="faint small">they change across the country</span></>}>
        <div className="group">
          {c.regional.map(([what, region, loc, say]) => <div key={what + region} className="row"><div className="main phr"><span className="en">{what}<br /><span className="faint small">{region}</span></span><span className="loc">{loc}</span>{sayIt && <span className="say">{say}</span>}</div></div>)}
          <div className="more">{toggle}</div>
        </div>
      </Disc>
    )}
    {!!c.dos.length && (
      <Disc k="dos" cls="tint" style={vars({ '--sc': '#2E9E5B' })} head={<><i className="sec-dot" /><b>Good to do</b><span className="faint small">{c.dos.length}</span></>}>
        <ul className="group bul do">{c.dos.map(x => <li key={x}>{x}</li>)}</ul>
      </Disc>
    )}
    {!!c.donts.length && (
      <Disc k="donts" cls="tint" style={vars({ '--sc': '#D9534A' })} head={<><i className="sec-dot" /><b>Best to avoid</b><span className="faint small">{c.donts.length}</span></>}>
        <ul className="group bul dont">{c.donts.map(x => <li key={x}>{x}</li>)}</ul>
      </Disc>
    )}
  </>;
}

// kept while the page is open, so switching tabs doesn't ask again
const seen = new Map<string, CultureEntry>();
type Status = 'loading' | 'building' | 'ready' | 'none' | 'error';

async function call(method: 'GET' | 'POST', t: Trip) {
  const r = await fetch(`/api/culture/${encodeURIComponent(t.dest.cid)}?${new URLSearchParams({ name: t.dest.country })}`, { method });
  if (!r.ok) throw new Error(`Culture failed (${r.status})`);
  const c = await r.json() as CultureEntry | null;
  if (c) seen.set(t.dest.cid, c);
  return c;
}

// the country's saved notes; the first visit builds them from Wikivoyage, which takes a little while
function CountryCulture({ t }: { t: Trip }) {
  const [c, setC] = useState<CultureEntry | null>(() => seen.get(t.dest.cid) ?? null);
  const [status, setStatus] = useState<Status>(c ? 'ready' : 'loading');
  async function build() {
    setStatus('building');
    try { const n = await call('POST', t); setC(n ?? c); setStatus(n ? 'ready' : c ? 'ready' : 'none'); if (!n && c) toast(`Wikivoyage has no page for ${t.dest.country} right now. Kept the notes you had.`); }
    catch { setStatus(c ? 'ready' : 'error'); if (c) toast('Couldn’t refresh right now. Kept the notes you had.'); }
  }
  useEffect(() => {
    if (seen.has(t.dest.cid)) return;
    let live = true;
    (async () => {
      try {
        const saved = await call('GET', t);
        if (!live) return;
        if (saved) { setC(saved); setStatus('ready'); }
        // older notes stay on screen while they're redone with the new phrase list
        if (!saved || saved.stale) build();
      } catch { if (live) setStatus('error'); }
    })();
    return () => { live = false; };
  // runs once per country; the component is keyed by it
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const country = t.dest.country;
  if (!c) return <div className="group empty">{
    status === 'none' ? <><b style={{ color: 'var(--ink)' }}>Nothing on Wikivoyage for {country}</b><span>Add what you learn under Our notes.</span></>
      : status === 'error' ? <><b style={{ color: 'var(--ink)' }}>Couldn’t gather phrases and customs</b><button type="button" className="btn" onClick={build}>Try again</button></>
      : <><b style={{ color: 'var(--ink)' }}>Gathering phrases and customs for {country}</b><span>Reading Wikivoyage. The first time takes up to a minute.</span></>
  }</div>;
  // the household's edits are kept for every trip to the country, until they ask for a rewrite
  async function save(d: Culture) {
    const n: CultureEntry = { ...c!, ...d, fetchedAt: new Date().toISOString(), stale: false };
    setC(n); seen.set(t.dest.cid, n);
    const r = await fetch(`/api/culture/${encodeURIComponent(t.dest.cid)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(n) }).catch(() => null);
    toast(r?.ok ? `Saved. These tips show on every trip to ${t.dest.country}.` : 'Couldn’t save the tips. Check the connection and try again.');
  }
  return <>
    <CultureSections c={c} onSave={save} />
    <p className="faint small" style={{ marginTop: 18 }}>
      For all of {country}, from <a className="linkish" href={c.source} target="_blank" rel="noopener noreferrer">Wikivoyage</a> (CC BY-SA), summarized by Claude, with your edits.{' '}
      <button type="button" className="linkish" disabled={status === 'building'} onClick={build}>{status === 'building' ? 'Rewriting…' : 'Rewrite from Wikivoyage (replaces edits)'}</button>
    </p>
  </>;
}

// quirky things about this trip's own place, first in the tab; written once per trip, and again when the trip moves
const quirksSeen = new Map<string, Quirks>();
function TripQuirks({ t }: { t: Trip }) {
  const [q, setQ] = useState<Quirks | null>(() => quirksSeen.get(t.id) ?? null);
  const [status, setStatus] = useState<Status>(q ? 'ready' : 'loading');
  const url = `/api/culture/trip/${encodeURIComponent(t.id)}`;
  async function build() {
    setStatus('building');
    try {
      const r = await fetch(`${url}?${new URLSearchParams({ place: t.dest.name, country: t.dest.country, cid: t.dest.cid })}`, { method: 'POST' });
      if (!r.ok) throw new Error(String(r.status));
      const n = await r.json() as Quirks | null;
      if (n) { quirksSeen.set(t.id, n); setQ(n); }
      setStatus(n || q ? 'ready' : 'none');
    } catch { setStatus(q ? 'ready' : 'error'); }
  }
  useEffect(() => {
    if (quirksSeen.get(t.id)?.place === t.dest.name) return;
    let live = true;
    fetch(url).then(r => r.json() as Promise<Quirks | null>).then(saved => {
      if (!live) return;
      if (saved?.place === t.dest.name) { quirksSeen.set(t.id, saved); setQ(saved); setStatus('ready'); } else build();
    }, () => { if (live) setStatus('error'); });
    return () => { live = false; };
  // once per trip and place; the component is keyed by them
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const where = t.dest.name;
  const [draft, setDraft] = useState<string[][] | null>(null);
  async function save(items: string[][]) {
    const n: Quirks = { place: where, items: filled(items) as Quirks['items'], source: q?.source ?? '', fetchedAt: new Date().toISOString() };
    quirksSeen.set(t.id, n); setQ(n); setDraft(null); setStatus('ready');
    const r = await fetch(`${url}?${new URLSearchParams({ cid: t.dest.cid })}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(n) }).catch(() => null);
    toast(r?.ok ? 'Quirks saved.' : 'Couldn’t save. Check the connection and try again.');
  }
  return (
    <Disc k="quirks" cls="tint" style={vars({ '--sc': '#E07B2E' })} head={<><i className="sec-dot" /><b>Local quirks</b><span className="faint small">{where}</span></>}>
      {draft ? <div className="culture-edit">
        <RowsEditor rows={draft} cols={[{ label: 'Short title' }, { label: 'What to know', wide: true }]} onChange={setDraft} add="+ Add a quirk" />
        <div className="acts"><button type="button" className="btn primary" onClick={() => save(draft)}>Save</button><button type="button" className="btn quiet" onClick={() => setDraft(null)}>Cancel</button></div>
      </div> : q ? <>
        <ul className="group bul quirks">{q.items.map(([title, text]) => <li key={title}><span><b>{title}.</b> {text}</span></li>)}</ul>
        <p className="faint small"><button type="button" className="btn-sm" onClick={() => setDraft(q.items.map(x => [...x]))}>Edit quirks</button>{' '}
          {q.source && <>About {q.place}, from <a className="linkish" href={q.source} target="_blank" rel="noopener noreferrer">Wikivoyage</a> (CC BY-SA), picked by Claude, with your edits.{' '}</>}
          <button type="button" className="linkish" disabled={status === 'building'} onClick={build}>{status === 'building' ? 'Rewriting…' : 'Rewrite from Wikivoyage (replaces edits)'}</button></p>
      </> : <div className="group empty">{status === 'none' ? <span>Wikivoyage has nothing on {where} yet. Add what you find under Our notes.</span>
        : status === 'error' ? <><span>Couldn’t gather quirks for {where}.</span><button type="button" className="btn" onClick={build}>Try again</button></>
        : <span>Gathering quirky things about {where} from Wikivoyage. The first time takes up to a minute.</span>}
        {status !== 'loading' && status !== 'building' && <button type="button" className="btn-sm" onClick={() => setDraft([['', '']])}>Write our own</button>}</div>}
    </Disc>
  );
}
