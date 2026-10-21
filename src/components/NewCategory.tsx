'use client';

import { useState, type FormEvent } from 'react';
import { vars } from '@/components/icons';
import { CATS, MUHU_CATS, NEW_CAT_COLORS, NEW_CAT_ICONS } from '@/lib/constants';
import { plain } from '@/lib/muhu';
import { uid } from '@/lib/seed';
import { toast, update } from '@/lib/store';
import type { CustomCat } from '@/lib/types';

// "+ New category" at the end of any row of categories: a name, a color and an icon, kept for both of you.
// Opens in place; onMade gets the new category's id (to put the idea in it, or to filter by it).
export function NewCategory({ scope, onMade }: { scope: CustomCat['scope']; onMade?: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [color, setColor] = useState(NEW_CAT_COLORS[0]), [icon, setIcon] = useState(Object.keys(NEW_CAT_ICONS)[0]);
  const have = Object.values(scope === 'trip' ? CATS : MUHU_CATS).map(c => plain(c.label));
  function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); e.stopPropagation();
    const label = String(new FormData(e.currentTarget).get('label')).trim();
    if (!label) return;
    if (have.includes(plain(label))) { toast(`There’s already a category called ${label}.`); return; }
    const c: CustomCat = { id: `c-${uid()}`, scope, label, color, icon: NEW_CAT_ICONS[icon] };
    update(s => { s.categories.push(c); });
    setOpen(false); onMade?.(c.id); toast(`New category: ${label}.`);
  }
  if (!open) return <button type="button" className="chip new-cat" onClick={() => setOpen(true)}>+ New category</button>;
  return (
    <form className="new-cat-form" onSubmit={save} style={vars({ '--dc': color })}>
      <input className="input" name="label" autoFocus placeholder="Name, e.g. Hot springs" aria-label="Category name" />
      <span className="swatches" role="group" aria-label="Color">{NEW_CAT_COLORS.map(c => (
        <button key={c} type="button" className="swatch" style={{ background: c }} aria-pressed={c === color} aria-label={`Color ${c}`} onClick={() => setColor(c)} />
      ))}</span>
      <span className="swatches" role="group" aria-label="Icon">{Object.entries(NEW_CAT_ICONS).map(([k, d]) => (
        <button key={k} type="button" className="icon-pick" aria-pressed={k === icon} aria-label={k} onClick={() => setIcon(k)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
        </button>
      ))}</span>
      <span className="acts"><button type="submit" className="btn-sm">Add category</button><button type="button" className="linkish small" onClick={() => setOpen(false)}>Cancel</button></span>
    </form>
  );
}
