import { CITY_GEO } from './data/city-geo';
import type { AppState, Idea, Status, Trip } from './types';

// "today" at noon, so day maths never trips over time zones; only called in the browser
export function today() { const d = new Date(); d.setHours(12, 0, 0, 0); return d; }
const pad = (n: number) => String(n).padStart(2, '0');
export const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const isoMonth = (d: Date) => isoDate(d).slice(0, 7);

export const isSomeday = (t: Trip) => !t.start;
export function dayDate(t: Trip, k: number) { const d = new Date(t.start + 'T12:00:00'); d.setDate(d.getDate() + k); return d; }
export const endDate = (t: Trip) => dayDate(t, t.len - 1);
export const isPast = (t: Trip) => !isSomeday(t) && endDate(t) < today();
// the preview's sketch maps exist for three cities
export const hasMap = (t: Trip) => !!(t.city && CITY_GEO[t.city]);
export const located = (t: Trip) => t.ideas.filter(i => i.lat != null);
// the trip's center: set from Google for new destinations, or the middle of a sample city
export function tripCenter(t: Trip) {
  if (t.center) return t.center;
  const b = t.city && CITY_GEO[t.city]?.bbox;
  return b ? { lat: (b[1] + b[3]) / 2, lng: (b[0] + b[2]) / 2 } : null;
}
// with a Google Maps key any trip with a center or a located idea gets a map; without one, only the sketch cities
export const canMap = (t: Trip, google: boolean) => google ? !!tripCenter(t) || located(t).length > 0 : hasMap(t);
export const ideaOf = (t: Trip, id?: string) => t.ideas.find(i => i.id === id);
export const scheduledDay = (t: Trip, ideaId: string) => t.days.findIndex(d => d.stops.some(s => s.idea === ideaId));
// left off the maps (by hand, or with its whole category) until it's planned on a day
// an idea is listed under its main category and any others it was given
export const inCat = (i: Idea, k: string) => i.cat === k || !!i.extraCats?.includes(k);
export const catsOfIdea = (i: Idea) => [i.cat, ...(i.extraCats ?? [])];
// options compared and picked from, rather than places to visit
export const isOption = (i: Idea) => i.cat === 'stay' || i.cat === 'car';
export const offMap = (t: Trip, i: Idea) => !!i.offMap || !!t.mapOffCats?.includes(i.cat);
// on a day, or a stay we're sleeping at: shown on the maps whatever was hidden
export const planned = (t: Trip, i: Idea) => scheduledDay(t, i.id) >= 0 || !!i.stayDays?.length;
// the stays we're sleeping at on day k
export const staysOn = (t: Trip, k: number) => t.ideas.filter(i => i.cat === 'stay' && i.stayDays?.some(d => d === '*' || d === t.days[k]?.id));
// "All days", "Day 2" or "Days 1, 2, 4", for a stay's tag
export function stayLabel(t: Trip, i: Idea) {
  const ds = i.stayDays ?? [];
  if (!ds.length) return '';
  if (ds.includes('*')) return 'All days';
  const ks = t.days.map((d, k) => ds.includes(d.id) ? k + 1 : 0).filter(Boolean);
  return ks.length === t.days.length ? 'All days' : ks.length === 1 ? `Day ${ks[0]}` : ks.length ? `Days ${ks.join(', ')}` : '';
}

export const fmtDay = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
export const fmtMonth = (ym: string) => new Date(ym + '-15T12:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
export function fmtRange(t: Trip) {
  if (isSomeday(t)) return 'No dates yet';
  const a = dayDate(t, 0), b = endDate(t);
  const m = (d: Date) => d.toLocaleDateString('en-US', { month: 'short' });
  if (a.getMonth() === b.getMonth()) return `${m(a)} ${a.getDate()}–${b.getDate()}, ${b.getFullYear()}`;
  return `${m(a)} ${a.getDate()} – ${m(b)} ${b.getDate()}, ${b.getFullYear()}`;
}
export function relTime(t: Trip) {
  if (isSomeday(t)) return '';
  const days = Math.round((dayDate(t, 0).getTime() - today().getTime()) / 864e5);
  if (days > 60) return `in ${Math.round(days / 30.4)} months`;
  if (days > 1) return `in ${days} days`;
  if (days >= -t.len) return 'happening now';
  return '';
}

/* ---------- where an idea came from ---------- */
export const isUrl = (v?: string) => /^https?:\/\/\S+$/i.test((v || '').trim());
export const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
export const isMaps = (v?: string) => isUrl(v) && /(^|\.)google\.[a-z.]+\/maps|maps\.google\.|maps\.app\.goo\.gl|goo\.gl\/maps/i.test(v!.trim().replace(/^https?:\/\/(www\.)?/i, ''));
export const gmaps = (t: Trip, i: Idea) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(i.name + ', ' + t.dest.name)}${i.placeId ? '&query_place_id=' + encodeURIComponent(i.placeId) : ''}`;

/* ---------- world map ---------- */
// statuses come from trips automatically and can be overridden by hand; a country can hold several
export function statusOf(S: AppState, cid: string): { s: Status[]; auto: boolean } {
  if (S.world[cid]?.length) return { s: S.world[cid], auto: false };
  const ts = S.trips.filter(t => t.dest.cid === cid);
  if (ts.some(isPast) || S.visits.some(v => v.cid === cid)) return { s: ['visited'], auto: true };
  if (ts.some(t => !isSomeday(t))) return { s: ['planning'], auto: true };
  if (ts.length || S.muhu.some(m => m.cid === cid)) return { s: ['want'], auto: true };
  return { s: [], auto: false };
}
export interface VisitRow { cid: string; places: string; from: string; when: string; trip?: string; id?: string }
export function visitList(S: AppState): VisitRow[] {
  const out: VisitRow[] = S.trips.filter(isPast).map(t => ({ cid: t.dest.cid, places: t.name, from: t.start!.slice(0, 7), when: fmtRange(t), trip: t.id }));
  for (const v of S.visits) out.push({ cid: v.cid, places: v.places, from: v.from, when: fmtMonth(v.from), id: v.id });
  return out.sort((a, b) => b.from.localeCompare(a.from));
}
