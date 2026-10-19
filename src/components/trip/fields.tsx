import { PinSvg, vars } from '@/components/icons';
import { CATS, CAT_KEYS } from '@/lib/constants';
import { editIdea } from '@/lib/store';
import { gmaps, isMaps } from '@/lib/trips';
import type { Idea, Trip } from '@/lib/types';

// the household's own note on a saved place; Google never fills this in
export function IdeaNote({ t, i }: { t: Trip; i: Idea }) {
  return (
    <label className="note-field"><span>Our notes</span>
      <textarea rows={2} value={i.note} onChange={e => editIdea(t.id, i.id, x => { x.note = e.target.value; })} placeholder="Add a note: booking info, what to order, who recommended it…" />
    </label>
  );
}

// fix a category Google guessed wrong; the old kind belonged to the old category, so it goes too
export function IdeaCat({ t, i }: { t: Trip; i: Idea }) {
  return (
    <div className="inline-field">Category <span className="chips">{CAT_KEYS.map(k => <button key={k} type="button" className="chip dchip" style={vars({ '--dc': CATS[k].color })} aria-pressed={i.cat === k} onClick={() => i.cat !== k && editIdea(t.id, i.id, x => { x.cat = k; delete x.kind; })}>{CATS[k].label}</button>)}</span></div>
  );
}

export function IdeaSource({ t, i }: { t: Trip; i: Idea }) {
  return (
    <label className="note-field"><span>Source</span>
      <input className="input src-in" value={i.source || ''} onChange={e => editIdea(t.id, i.id, x => { x.source = e.target.value; })} placeholder="Paste a link (Google Maps, blog, video) or who told you" />
    </label>
  );
}

// offered when the source isn't already a Google Maps link
export function MapsLink({ t, i }: { t: Trip; i: Idea }) {
  if (isMaps(i.source)) return null;
  return <div><a className="btn-sm linkbtn" href={gmaps(t, i)} target="_blank" rel="noopener noreferrer"><PinSvg />Open in Google Maps</a></div>;
}
