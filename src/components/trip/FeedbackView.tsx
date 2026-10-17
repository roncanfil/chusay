'use client';

import { Disc } from '@/components/Disc';
import { Pic, vars } from '@/components/icons';
import { CATS, dayColor } from '@/lib/constants';
import { editTrip } from '@/lib/store';
import { dayDate, endDate, fmtDay, ideaOf, isPast } from '@/lib/trips';
import type { Again, Feedback, Trip, Vote } from '@/lib/types';

const AGAIN: [Again, string][] = [['yes', 'Yes'], ['maybe', 'Maybe'], ['no', 'No']];
const VOTES: [Vote, string][] = [['love', 'Loved it'], ['ok', 'Fine'], ['skip', 'Skip']];

// Would we go back, highlights, next time, and a vote per stop. No star ratings. Votes feed future picks.
export function FeedbackView({ t }: { t: Trip }) {
  const f = t.feedback;
  const edit = (fn: (fb: Feedback) => void) => editTrip(t.id, tt => fn(tt.feedback));
  return <>
    {!isPast(t) && <div className="banner">This trip hasn’t happened yet. Come back after {fmtDay(endDate(t))} to note what you loved. It shapes future picks.</div>}
    <Disc k="fb-overall" cls="tint" style={vars({ '--sc': '#12A39F' })} head={<><i className="sec-dot" /><b>Overall</b></>}>
      <div className="group">
        <div className="row"><div className="main"><span className="title">Would we go back?</span></div>
          <div className="seg">{AGAIN.map(([k, l]) => <button key={k} type="button" data-act="again" data-k={k} aria-pressed={f.again === k} onClick={() => edit(fb => { fb.again = k; })}>{l}</button>)}</div>
        </div>
      </div>
    </Disc>
    <Disc k="fb-notes" cls="tint" style={vars({ '--sc': '#E3A23C' })} head={<><i className="sec-dot" /><b>Highlights and next time</b></>}>
      <div className="stack">
        <label className="field">Highlights<textarea value={f.highlights} onChange={e => edit(fb => { fb.highlights = e.target.value; })} placeholder="What made the trip?" /></label>
        <label className="field">Next time we’d…<textarea value={f.next} onChange={e => edit(fb => { fb.next = e.target.value; })} placeholder="Stay somewhere else, skip something, add a day…" /></label>
      </div>
    </Disc>
    {t.days.map((d, k) => {
      const stops = d.stops.filter(s => s.idea);
      if (!stops.length) return null;
      return (
        <Disc key={d.id} k={`fb-day-${k}`} open={k === 0} cls="tint" style={vars({ '--sc': dayColor(k), '--dc': dayColor(k) })}
          head={<><b className="day-pill">Day {k + 1}</b><span className="faint">{d.title || fmtDay(dayDate(t, k))}</span><span className="sp" /><span className="faint small">{stops.filter(s => f.votes[s.idea!]).length} of {stops.length} rated</span></>}>
          <div className="group">{stops.map(s => {
            const i = ideaOf(t, s.idea); if (!i) return null;
            const v = f.votes[i.id] || '';
            return (
              <div key={s.id} className="row" style={vars({ '--cc': CATS[i.cat].color, flexWrap: 'wrap' } as Record<string, string>)}>
                <Pic p={i} /><div className="main" style={{ minWidth: 150 }}><span className="title">{i.name}</span></div>
                <div className="seg">{VOTES.map(([k2, l]) => <button key={k2} type="button" data-act="vote" data-k={k2} aria-pressed={v === k2} onClick={() => edit(fb => { fb.votes[i.id] = v === k2 ? '' : k2; })}>{l}</button>)}</div>
              </div>
            );
          })}</div>
        </Disc>
      );
    })}
  </>;
}
