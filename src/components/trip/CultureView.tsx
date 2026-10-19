'use client';

import { useEffect, useState } from 'react';
import { Disc } from '@/components/Disc';
import { vars } from '@/components/icons';
import { CULTURE } from '@/lib/data/culture';
import { editTrip, toast, useConfig } from '@/lib/store';
import type { Culture, CultureEntry, Trip } from '@/lib/types';

// Useful phrases, Good to do, Best to avoid, and Our notes (never overwritten by a refresh)
export function CultureView({ t }: { t: Trip }) {
  const cfg = useConfig();
  if (!cfg) return null;
  // with a Claude key every trip gets its country's Wikivoyage summary; without one, the preview's samples
  const sample = CULTURE[t.city || ''];
  return <>
    {cfg.culture ? <CountryCulture key={t.dest.cid} t={t} />
      : sample ? <><CultureSections c={sample} /><p className="faint small" style={{ marginTop: 18 }}>Sample notes for the preview.</p></>
      : <div className="group empty"><b style={{ color: 'var(--ink)' }}>Phrases and customs for {t.dest.country}</b><span>These fill in from Wikivoyage once the Claude key is set up on the server.</span></div>}
    <Disc k="notes" open={!!t.notes} cls="tint" style={vars({ '--sc': '#E3A23C' })} head={<><i className="sec-dot" /><b>Our notes</b></>}>
      <label className="field"><span className="sr">Our notes</span><textarea value={t.notes} onChange={e => editTrip(t.id, tt => { tt.notes = e.target.value; })} placeholder="A word someone taught you, a custom you noticed…" /></label>
    </Disc>
  </>;
}

function CultureSections({ c }: { c: Culture }) {
  return <>
    <p className="muted culture-note">{c.note}</p>
    <Disc k="phrases" cls="tint" style={vars({ '--sc': '#2F86D6' })} head={<><i className="sec-dot" /><b>Useful phrases</b><span className="faint small">{c.variant}</span></>}>
      <div className="group">{c.phrases.map(([en, loc, say]) => <div key={en} className="row"><div className="main phr"><span className="en">{en}</span><span className="loc">{loc}</span><span className="say">{say}</span></div></div>)}</div>
    </Disc>
    <Disc k="dos" cls="tint" style={vars({ '--sc': '#2E9E5B' })} head={<><i className="sec-dot" /><b>Good to do</b><span className="faint small">{c.dos.length}</span></>}>
      <ul className="group bul do">{c.dos.map(x => <li key={x}>{x}</li>)}</ul>
    </Disc>
    <Disc k="donts" cls="tint" style={vars({ '--sc': '#D9534A' })} head={<><i className="sec-dot" /><b>Best to avoid</b><span className="faint small">{c.donts.length}</span></>}>
      <ul className="group bul dont">{c.donts.map(x => <li key={x}>{x}</li>)}</ul>
    </Disc>
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
        if (saved) { setC(saved); setStatus('ready'); } else build();
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
  return <>
    <CultureSections c={c} />
    <p className="faint small" style={{ marginTop: 18 }}>
      For all of {country}, from <a className="linkish" href={c.source} target="_blank" rel="noopener noreferrer">Wikivoyage</a> (CC BY-SA), summarized by Claude.{' '}
      <button type="button" className="linkish" disabled={status === 'building'} onClick={build}>{status === 'building' ? 'Refreshing…' : 'Refresh'}</button>
    </p>
  </>;
}
