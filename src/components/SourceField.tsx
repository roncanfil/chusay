'use client';
import { OneSrc } from '@/components/icons';
import { isUrl } from '@/lib/trips';
import { useState, type KeyboardEvent } from 'react';

// an idea's sources, one per line of the same text field: each saved one shows as a link that opens in a new tab, with a small
// Edit beside it that turns it back into a box right there; "+ Add another" opens an empty box. With nothing saved, the box shows
export function SourceField({ value, set, autoFocus }: { value?: string; set: (v: string) => void; autoFocus?: boolean }) {
  const lines = value ? value.split('\n') : [];
  const saved = lines.filter(l => l.trim()).length;
  const [editing, setEditing] = useState<number | null>(null);
  const cur = editing ?? (saved ? null : 0);
  // leaving a box tidies up: an emptied one is dropped, the rest show as links again
  const done = () => { const v = lines.map(l => l.trim()).filter(Boolean).join('\n'); if (v !== (value ?? '')) set(v); setEditing(null); };
  function type(n: number, v: string) {
    const was = lines[n] ?? '', next = [...lines]; next[n] = v; set(next.join('\n'));
    // a whole link pasted into an empty box is done at once; typed text stays in the box until Enter or tapping away
    setEditing(!was.trim() && isUrl(v) ? null : n);
  }
  const key = (e: KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); done(); } else if (e.key === 'Escape') done(); };
  const remove = (n: number) => { set(lines.filter((_, k) => k !== n).map(l => l.trim()).filter(Boolean).join('\n')); setEditing(null); };
  const box = (n: number) => (
    <span className="src-edit" key={n}>
      <input className="input src-in" value={lines[n] ?? ''} autoFocus={autoFocus || editing !== null} onChange={e => type(n, e.target.value)} onBlur={done} onKeyDown={key}
        placeholder={n ? 'Paste another link' : 'Paste a link (Google Maps, blog, video) or who told you'} />
      {(lines[n] ?? '').trim() && <button type="button" className="btn-sm" onMouseDown={e => e.preventDefault()} onClick={() => remove(n)}>Remove</button>}
    </span>
  );
  return (
    <div className="note-field"><span>Source</span>
      <div className="src-list">
        {(cur !== null && cur >= lines.length ? [...lines, ''] : lines).map((l, n) => n === cur ? box(n) : l.trim() && (
          <span className="src-item" key={n}><OneSrc s={l.trim()} />
            <button type="button" className="linkish small" onClick={() => setEditing(n)} aria-label={`Edit ${l.trim()}`}>Edit</button></span>
        ))}
        {cur === null && <button type="button" className="linkish small src-add" onClick={() => setEditing(lines.length)}>+ Add another link</button>}
      </div>
    </div>
  );
}
