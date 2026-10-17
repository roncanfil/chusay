import { CATS, INTERESTS, PACE } from './constants';
import { CATALOG } from './data/catalog';
import { uid } from './seed';
import { ideaOf, scheduledDay } from './trips';
import type { AppState, CatalogPlace, Idea, Trip } from './types';

// Canned stand-in for Google Places search. The real app searches Google, biased to the trip's center.
export function searchCatalog(t: Trip, q: string): CatalogPlace[] {
  const toks = q.toLowerCase().split(/[\s,]+/).filter(Boolean).map(w => w.length > 4 && w.endsWith('s') ? w.slice(0, -1) : w);
  if (!toks.length) return [];
  const have = new Set(t.ideas.map(i => i.name));
  return (CATALOG[t.city || ''] || []).filter(p => !have.has(p.name)).map(p => {
    const hay = [p.name, p.kw, CATS[p.cat].label, p.hood, ...p.tags.map(x => INTERESTS[x])].join(' ').toLowerCase();
    return { p, sc: toks.filter(w => hay.includes(w)).length };
  }).filter(x => x.sc).sort((a, b) => b.sc - a.sc || b.p.rating - a.p.rating).map(x => x.p).slice(0, 6);
}

function lovedPlaces(S: AppState, exceptId: string) {
  const out: { i: Idea; t: Trip }[] = [];
  for (const t of S.trips) if (t.id !== exceptId) for (const [id, v] of Object.entries(t.feedback.votes || {})) if (v === 'love') { const i = ideaOf(t, id); if (i) out.push({ i, t }); }
  return out;
}

// Picks for you: interests count up, places like ones we loved count up more, over-budget counts down.
export function suggestions(S: AppState, t: Trip) {
  const have = new Set(t.ideas.map(i => i.name)); const P = S.prefs; const loved = lovedPlaces(S, t.id); const used = new Set<string>();
  return (CATALOG[t.city || ''] || []).filter(p => !have.has(p.name) && !S.dismissed.includes(p.name)).map(p => {
    const hits = p.tags.filter(x => P.interests.includes(x));
    let sc = hits.length * 2 + (p.rating - 4.4), why = '';
    const lv = loved.find(l => !used.has(l.i.name) && (l.i.tags || []).some(x => hits.includes(x)));
    if (lv) { used.add(lv.i.name); sc += 2; why = `Because you loved ${lv.i.name} in ${lv.t.dest.name}`; }
    else if (hits.length) why = 'You like ' + hits.slice(0, 2).map(x => INTERESTS[x].toLowerCase()).join(' and ');
    if (p.price && p.price.length > P.budget + (p.cat === 'stay' ? 1 : 0)) sc -= 3;
    if (P.diet.length && p.cat === 'food' && !p.veg) sc -= 1;
    return { p, sc, why };
  }).filter(x => x.why && x.sc > 1).sort((a, b) => b.sc - a.sc).slice(0, 4);
}

// Suggest a plan: start where unplanned ideas cluster, then walk to the next closest place, up to the household's pace.
// Mutates the (draft) trip and returns how many places it planned.
export function suggestDay(S: AppState, t: Trip, k: number) {
  const per = PACE[S.prefs.pace][1];
  const pool = t.ideas.filter(i => i.cat !== 'stay' && i.lat != null && scheduledDay(t, i.id) < 0);
  if (!pool.length) return 0;
  const d2 = (a: Idea, b: Idea) => (a.lat! - b.lat!) ** 2 + ((a.lng! - b.lng!) * Math.cos(a.lat! * Math.PI / 180)) ** 2;
  const near = (p: Idea) => pool.filter(q => d2(p, q) < 0.0002).length;
  const start = pool.slice().sort((a, b) => near(b) - near(a))[0];
  const chosen = [start]; const rest = pool.filter(p => p !== start);
  while (chosen.length < per && rest.length) { const last = chosen[chosen.length - 1]; rest.sort((a, b) => d2(a, last) - d2(b, last)); chosen.push(rest.shift()!); }
  chosen.forEach(i => t.days[k].stops.push({ id: uid(), idea: i.id, time: '' }));
  return chosen.length;
}
