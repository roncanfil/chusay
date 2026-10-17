'use client';

import { Disc } from '@/components/Disc';
import { vars } from '@/components/icons';
import { CULTURE } from '@/lib/data/culture';
import { editTrip, toast } from '@/lib/store';
import type { Trip } from '@/lib/types';

// Useful phrases, Good to do, Best to avoid, and Our notes (never overwritten by a refresh)
export function CultureView({ t }: { t: Trip }) {
  const c = CULTURE[t.city || ''];
  if (!c) return <div className="group empty"><b style={{ color: 'var(--ink)' }}>Phrases and customs for {t.dest.name}</b><span>In the real app this fills in automatically from Wikivoyage when you save the place.</span></div>;
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
    <Disc k="notes" open={!!t.notes} cls="tint" style={vars({ '--sc': '#E3A23C' })} head={<><i className="sec-dot" /><b>Our notes</b></>}>
      <label className="field"><span className="sr">Our notes</span><textarea value={t.notes} onChange={e => editTrip(t.id, tt => { tt.notes = e.target.value; })} placeholder="A word someone taught you, a custom you noticed…" /></label>
    </Disc>
    <p className="faint small" style={{ marginTop: 18 }}>Filled in from Wikivoyage and summarized by Claude. <button type="button" className="linkish" onClick={() => toast('In the real app this pulls the latest from Wikivoyage and re-summarizes it.')}>Refresh</button></p>
  </>;
}
