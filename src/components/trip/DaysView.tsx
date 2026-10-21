'use client';

import { useEffect, useRef, useState, type FormEvent, type MouseEvent, type ReactNode } from 'react';
import Sortable from 'sortablejs';
import { Disc } from '@/components/Disc';
import { CatIcon, KindIcon, ListSegIcon, MapSegIcon, PhotoCredit, Pic, SrcChip, vars } from '@/components/icons';
import { CATS, dayColor } from '@/lib/constants';
import { kindLabel } from '@/lib/kinds';
import { suggestDay } from '@/lib/picks';
import { uid } from '@/lib/seed';
import { discIsOpen, editTrip, openDisc, setView, toast, useSession, useView } from '@/lib/store';
import { dayDate, fmtDay, ideaOf, scheduledDay, staysOn } from '@/lib/trips';
import type { OwnPlan, Stop, Trip } from '@/lib/types';
import { IdeaCat, IdeaHero, IdeaNote, IdeaSource, MapsLink } from './fields';
import { StayDays, StayFields } from './stays';
import { pan, type SetUI, type TabProps, type TripUI } from './ui';

const QUICK = ['Meet friends', 'Dinner reservation', 'Free time', 'Rest at the hotel'];

/* ----- Itinerary: each day is a colored "subway line" of stops ----- */
export function DaysView({ t, ui, set, mapOk }: TabProps) {
  const view = useView(), session = useSession();
  const daysRef = useRef<HTMLDivElement>(null);
  // Sortable moves DOM nodes React owns; after a drop the lists are re-mounted from state
  const [dragKey, setDragKey] = useState(0);
  const [stayOpen, setStayOpen] = useState<string | null>(null); // "day:idea" of an opened "Staying at" line
  const list = view.dayAll || !mapOk, compact = view.density === 'compact';
  const unplanned = t.ideas.filter(i => scheduledDay(t, i.id) < 0);
  const canSuggest = unplanned.some(i => i.cat !== 'stay' && i.lat != null);

  // stops drag to reorder and between days; ideas drag in from "+ From ideas"
  useEffect(() => {
    const root = daysRef.current; if (!root) return;
    const made: Sortable[] = [];
    const common = { animation: 150, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', delay: 150, delayOnTouchOnly: true, preventOnFilter: false };
    root.querySelectorAll<HTMLElement>('.subway').forEach(ol => made.push(Sortable.create(ol, {
      ...common, group: { name: 'day', put: true, pull: true }, draggable: '.stn', filter: 'button,input,textarea,a,[data-nodrag]',
      onAdd(evt) {
        const to = Number(ol.dataset.day), at = evt.newDraggableIndex ?? 0, from = evt.from, item = evt.item;
        editTrip(t.id, tt => {
          let stop: Stop;
          if (from.classList.contains('subway')) {
            const src = tt.days[Number(from.dataset.day)];
            stop = src.stops.splice(src.stops.findIndex(x => x.id === item.dataset.stop), 1)[0];
          } else stop = { id: uid(), idea: item.dataset.idea, time: '' };
          tt.days[to].stops.splice(at, 0, stop);
        });
        set({ day: to }); setDragKey(n => n + 1);
      },
      onUpdate(evt) {
        const k = Number(ol.dataset.day);
        editTrip(t.id, tt => { const [s] = tt.days[k].stops.splice(evt.oldDraggableIndex!, 1); tt.days[k].stops.splice(evt.newDraggableIndex!, 0, s); });
        setDragKey(n => n + 1);
      },
    })));
    root.querySelectorAll<HTMLElement>('.adder').forEach(el => made.push(Sortable.create(el, { ...common, group: { name: 'day', pull: 'clone', put: false }, sort: false, filter: 'button' })));
    return () => made.forEach(s => s.destroy());
  });

  function addDay() {
    const k = t.days.length;
    editTrip(t.id, tt => { tt.len++; tt.days.push({ id: uid(), title: '', stops: [] }); });
    set({ day: k }); openDisc(`day-${t.id}-${k}`);
    requestAnimationFrame(() => { const all = daysRef.current?.querySelectorAll('.disc.day, .dayblock'); all?.[all.length - 1]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); });
  }
  function suggest(k: number) {
    let n = 0;
    editTrip(t.id, (tt, s) => { n = suggestDay(s, tt, k); });
    if (!n) return toast('No unplanned places left to suggest.');
    set({ day: k }); toast(`Planned ${n} places close to each other. Drag to reorder.`);
  }
  // our own entry lands in time order when a time is given
  function addOwn(k: number, title: string, time: string) {
    const s: Stop = { id: uid(), time, own: { title, where: '', note: '', link: '' } };
    editTrip(t.id, tt => {
      const d = tt.days[k]; d.stops.push(s);
      if (s.time) { const timed = d.stops.filter(x => x.time).sort((a, b) => a.time.localeCompare(b.time)); let n = 0; d.stops = d.stops.map(x => x.time ? timed[n++] : x); }
    });
    set({ day: k, sel: s.id, addPanel: null }); toast(`Added to Day ${k + 1}. You can add where and notes now.`);
  }
  function addToDay(k: number, ideaId: string) { editTrip(t.id, tt => { tt.days[k].stops.push({ id: uid(), idea: ideaId, time: '' }); }); set({ day: k }); }

  const bar = (
    <div className="viewbar">
      <div className="viewbar-l">{mapOk && <>
        <div className="seg" role="group" aria-label="Map">
          <button type="button" aria-pressed={view.dayMap} onClick={() => { setView({ dayMap: true }); set({ sel: null, hl: null }); }}><MapSegIcon />With map</button>
          <button type="button" aria-pressed={!view.dayMap} onClick={() => { setView({ dayMap: false, dayAll: true }); set({ sel: null, hl: null }); }}>List only</button>
        </div>
        <div className="seg" role="group" aria-label="Days">
          <button type="button" aria-pressed={!list} onClick={() => { setView({ dayAll: false }); set({ sel: null, hl: null }); }}>One day</button>
          <button type="button" aria-pressed={list} onClick={() => { setView({ dayAll: true }); set({ sel: null, hl: null }); }}><ListSegIcon />All days</button>
        </div>
      </>}</div>
      <div className="viewbar-r">
        <div className="seg" role="group" aria-label="How much to show">
          <button type="button" aria-pressed={!compact} onClick={() => setView({ density: 'full' })}>Detailed</button>
          <button type="button" aria-pressed={compact} onClick={() => setView({ density: 'compact' })}>Compact</button>
        </div>
        <button type="button" className="btn-sm add-day" onClick={addDay}>+ Add a day</button>
      </div>
    </div>
  );

  return <>
    {bar}
    <div key={dragKey} ref={daysRef} className={`days ${compact ? 'compact' : ''} ${list ? 'as-list' : ''}`}>
      {t.days.map((d, k) => {
        const key = `day-${t.id}-${k}`, open = list || discIsOpen(session, key, k === 0);
        const head = <span className="dh"><b className="day-pill">Day {k + 1}</b><span className="dd num">{fmtDay(dayDate(t, k))}</span>{!open && d.title && <span className="dh-title">{d.title}</span>}</span>;
        // quick add buttons sit at the top of each day, next to its name, and open their panel right there
        const ap = ui.addPanel?.day === k ? ui.addPanel.w : null;
        const pill = (w: 'ideas' | 'own', label: ReactNode) => <button type="button" className={`add-pill ${w}`} aria-expanded={ap === w} onClick={() => set({ addPanel: ap === w ? null : { day: k, w }, day: k })}>{label}</button>;
        const inner = <>
          <div className="day-top">
            <input className="day-title" value={d.title} onChange={e => editTrip(t.id, tt => { tt.days[k].title = e.target.value; })} placeholder="Name this day" aria-label={`Day ${k + 1} name`} />
            <div className="day-add">{pill('ideas', <>+ From ideas <span className="n">{unplanned.length}</span></>)}{pill('own', '+ Your own')}</div>
          </div>
          {staysOn(t, k).map(i => {
            const key = `${k}:${i.id}`, isOpen = stayOpen === key;
            return <div key={i.id} className="stay-wrap" style={vars({ '--cc': CATS[i.cat].color })}>
              <button type="button" className="stay-base" aria-expanded={isOpen} onClick={() => { setStayOpen(isOpen ? null : key); set({ day: k, hl: isOpen ? null : i.id, ...(isOpen ? {} : { panTo: pan(i.id) }) }); }}>
                <CatIcon cat={i.cat} cls="ic-sm" /><span>Staying at <b>{i.name}</b>{i.hood ? ` · ${i.hood}` : ''}</span><span className="caret" aria-hidden="true">›</span>
              </button>
              {/* everything about where we sleep, opened in place */}
              {isOpen && <div className="stay-more">
                <IdeaHero t={t} i={i} /><IdeaNote t={t} i={i} /><IdeaSource t={t} i={i} /><StayFields t={t} i={i} /><StayDays t={t} i={i} /><MapsLink t={t} i={i} /><PhotoCredit p={i} />
              </div>}
            </div>;
          })}
          {ap === 'own' && <OwnForm onAdd={(title, time) => addOwn(k, title, time)} />}
          {ap === 'ideas' && (
            <div className="add-panel">{unplanned.length
              ? <div className="adder" data-day={k}>{unplanned.map(i => (
                <div key={i.id} className="row" data-idea={i.id} style={vars({ '--cc': CATS[i.cat].color })}>
                  <Pic p={i} /><div className="main"><span className="title">{i.name}</span><span className="meta">{kindLabel(i)}{i.hood ? ' · ' + i.hood : ''}</span></div>
                  <button type="button" className="btn-sm" onClick={() => addToDay(k, i.id)}>+ Add</button>
                </div>))}</div>
              : <p className="faint small">Every idea is planned. Add more on the Ideas tab.</p>}
            </div>
          )}
          {!d.stops.length && <div className="open-day"><p>Nothing planned yet.</p>{canSuggest && <button type="button" className="btn-sm" onClick={() => suggest(k)}>Suggest a plan for this day</button>}</div>}
          <ol className="subway" data-day={k}>{d.stops.map(s => <StopItem key={s.id} t={t} k={k} s={s} ui={ui} set={set} />)}</ol>
        </>;
        return list
          ? <section key={d.id} className="dayblock" style={vars({ '--dc': dayColor(k) })}><h2 className="dayblock-head">{head}</h2>{inner}</section>
          : <Disc key={d.id} k={key} head={head} open={k === 0} cls={'day' + (ui.day === k ? ' current' : '')} style={vars({ '--dc': dayColor(k) })} onOpen={() => set({ day: k, sel: null, hl: null })}>{inner}</Disc>;
      })}
    </div>
  </>;
}

// + Your own: a title and an optional time, with quick chips for common ones
function OwnForm({ onAdd }: { onAdd: (title: string, time: string) => void }) {
  const [title, setTitle] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const tt = title.trim(); if (tt) onAdd(tt, String(new FormData(e.currentTarget).get('time') || ''));
  }
  return (
    <div className="add-panel own">
      <form className="own-form" onSubmit={submit}>
        <input ref={ref} className="input" name="title" value={title} onChange={e => setTitle(e.target.value)} autoFocus placeholder="What’s happening? e.g. Drinks with Ana" aria-label="What’s happening" required />
        <input className="input" type="time" name="time" aria-label="Time (optional)" />
        <button className="btn primary" type="submit">Add</button>
      </form>
      <div className="chips quick">{QUICK.map(q => <button key={q} type="button" className="chip" onClick={() => { setTitle(q); ref.current?.focus(); }}>{q}</button>)}</div>
    </div>
  );
}

// clicking a stop opens it inline to edit the note, set a time, move it to another day or take it off
function StopItem({ t, k, s, ui, set }: { t: Trip; k: number; s: Stop; ui: TripUI; set: SetUI }) {
  const i = s.own ? null : ideaOf(t, s.idea);
  if (!s.own && !i) return null;
  const sel = ui.sel === s.id;
  function pick(e: MouseEvent) {
    if ((e.target as Element).closest('button,input,textarea,label,a,[data-nodrag]')) return;
    const next = sel ? null : s.id, hl = next && i ? i.id : null;
    set({ sel: next, day: k, hl, ...(hl ? { panTo: pan(hl) } : {}) });
  }
  const controls = <StopControls t={t} k={k} s={s} set={set} removeLabel={s.own ? 'Delete this plan' : 'Take off this day'} />;
  if (s.own) {
    const o = s.own;
    return (
      <li className={`stn own ${sel ? 'sel' : ''}`} data-day={k} data-stop={s.id} style={vars({ '--cc': 'var(--c-own)' })} onClick={pick}>
        <span className="rail"><span className="station" /></span>
        <span className="nm"><CatIcon cat="own" /><span className="tx"><b>{o.title || 'Our plan'}</b><small><CatIcon cat="own" cls="ic-sm" />Our own plan{o.where ? ' · ' + o.where : ''}</small>{o.note && <span className="note">{o.note}</span>}<SrcChip v={o.link} /></span></span>
        <span className="time num">{s.time || null}</span>
        {sel && <div className="stn-more" data-nodrag>
          <OwnField t={t} k={k} s={s} f="title" label="What" ph="Meet friends, a reservation, free time…" />
          <OwnField t={t} k={k} s={s} f="where" label="Where" ph="An address, their place, a café… (optional)" />
          <OwnField t={t} k={k} s={s} f="note" label="Notes" ph="Who’s coming, what to bring…" multiline />
          <OwnField t={t} k={k} s={s} f="link" label="Link" ph="Tickets, event page, a message thread… (optional)" />
          {controls}
        </div>}
      </li>
    );
  }
  return (
    <li className={`stn ${sel ? 'sel' : ''}`} data-day={k} data-stop={s.id} data-idea={i!.id} style={vars({ '--cc': CATS[i!.cat].color })} onClick={pick}>
      <span className="rail"><span className="station" /></span>
      <span className="nm"><Pic p={i!} /><span className="tx"><b>{i!.name}</b><small><KindIcon p={i!} />{kindLabel(i!)}{i!.price ? ' · ' + i!.price : ''}{i!.hood ? ' · ' + i!.hood : ''}</small>{i!.note && <span className="note">{i!.note}</span>}<SrcChip v={i!.source} /></span></span>
      <span className="time num">{s.time || null}</span>
      {sel && <div className="stn-more" data-nodrag>
        <IdeaHero t={t} i={i!} />
        <IdeaNote t={t} i={i!} />
        <IdeaSource t={t} i={i!} />
        <StayFields t={t} i={i!} />
        {i!.cat === 'stay' && <StayDays t={t} i={i!} />}
        <IdeaCat t={t} i={i!} />
        <MapsLink t={t} i={i!} />
        <PhotoCredit p={i!} />
        {controls}
      </div>}
    </li>
  );
}

// "your own" entries: what, where, notes and a link (tickets, an event page)
function OwnField({ t, k, s, f, label, ph, multiline }: { t: Trip; k: number; s: Stop; f: keyof OwnPlan; label: string; ph: string; multiline?: boolean }) {
  const change = (v: string) => editTrip(t.id, tt => { tt.days[k].stops.find(x => x.id === s.id)!.own![f] = v; });
  return (
    <label className="note-field"><span>{label}</span>
      {multiline ? <textarea rows={2} value={s.own![f]} onChange={e => change(e.target.value)} placeholder={ph} />
        : <input className="input" value={s.own![f]} onChange={e => change(e.target.value)} placeholder={ph} />}
    </label>
  );
}

function StopControls({ t, k, s, set, removeLabel }: { t: Trip; k: number; s: Stop; set: SetUI; removeLabel: string }) {
  function move(to: number) {
    editTrip(t.id, tt => { const from = tt.days[k]; const n = from.stops.findIndex(x => x.id === s.id); tt.days[to].stops.push(from.stops.splice(n, 1)[0]); });
    set({ sel: null, hl: null }); toast(`Moved to Day ${to + 1}.`);
  }
  function remove() { editTrip(t.id, tt => { tt.days[k].stops = tt.days[k].stops.filter(x => x.id !== s.id); }); set({ sel: null, hl: null }); }
  return <>
    <label className="inline-field">Time <input type="time" value={s.time} onChange={e => editTrip(t.id, tt => { tt.days[k].stops.find(x => x.id === s.id)!.time = e.target.value; })} /></label>
    {t.days.length > 1 && <div className="inline-field">Move to <span className="chips">{t.days.map((d, j) => j === k ? null : <button key={d.id} type="button" className="chip dchip" style={vars({ '--dc': dayColor(j) })} onClick={() => move(j)}>Day {j + 1}</button>)}</span></div>}
    <div><button type="button" className="btn-sm" onClick={remove}>{removeLabel}</button></div>
  </>;
}
