import 'server-only';
import type { CustomCat, MuhuIdea, Prefs, SavedSearch, Status, Trip, Visit } from '@/lib/types';

// Light shape checks for what the browser sends; SQLite's constraints catch the rest.
export class BadRequest extends Error {}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown, what: string) => { if (typeof v !== 'string') throw new BadRequest(`${what} must be text`); return v; };
const arr = (v: unknown, what: string) => { if (!Array.isArray(v)) throw new BadRequest(`${what} must be a list`); return v as unknown[]; };
const STATUSES = ['visited', 'planning', 'want', 'nope'];

export function parseTrip(v: unknown, id: string): Trip {
  if (!isObj(v) || v.id !== id) throw new BadRequest('trip id does not match the URL');
  str(v.name, 'name');
  if (!isObj(v.dest)) throw new BadRequest('dest is missing');
  str(v.dest.name, 'dest.name'); str(v.dest.country, 'dest.country'); str(v.dest.cid, 'dest.cid');
  if (v.start !== null) str(v.start, 'start');
  if (typeof v.len !== 'number') throw new BadRequest('len must be a number');
  for (const i of arr(v.ideas, 'ideas')) { if (!isObj(i)) throw new BadRequest('bad idea'); str(i.id, 'idea.id'); str(i.name, 'idea.name'); arr(i.tags, 'idea.tags'); }
  for (const d of arr(v.days, 'days')) {
    if (!isObj(d)) throw new BadRequest('bad day');
    str(d.id, 'day.id');
    for (const s of arr(d.stops, 'stops')) { if (!isObj(s) || (!s.idea && !isObj(s.own))) throw new BadRequest('a stop needs an idea or its own title'); str(s.id, 'stop.id'); }
  }
  if (!isObj(v.feedback) || !isObj(v.feedback.votes)) throw new BadRequest('feedback is missing');
  return v as unknown as Trip;
}

export function parseStatuses(v: unknown): Status[] {
  if (!isObj(v)) throw new BadRequest('statuses are missing');
  const list = arr(v.statuses, 'statuses');
  if (!list.length || list.some(s => !STATUSES.includes(s as string))) throw new BadRequest('statuses must be visited, planning, want or nope');
  return list as Status[];
}

export function parseVisit(v: unknown): Visit {
  if (!isObj(v)) throw new BadRequest('bad visit');
  str(v.id, 'id'); str(v.cid, 'cid'); str(v.places, 'places');
  if (!/^\d{4}-\d{2}$/.test(str(v.from, 'from'))) throw new BadRequest('from must be YYYY-MM');
  return v as unknown as Visit;
}

const WANTS = ['high', 'med', 'low', ''];
export function parseMuhu(v: unknown): MuhuIdea[] {
  return arr(v, 'muhu').map(m => {
    if (!isObj(m)) throw new BadRequest('bad muhu idea');
    for (const k of ['id', 'cid', 'country', 'name', 'area', 'when', 'far', 'note']) str(m[k], k);
    arr(m.cats, 'cats');
    if (!WANTS.includes(m.want as string)) throw new BadRequest('want must be high, med, low or empty');
    if (m.match !== undefined && !['auto', 'set', 'none'].includes(m.match as string)) throw new BadRequest('match must be auto, set or none');
    if (m.image !== undefined && !/^(https?:\/\/|\/api\/muhu\/photos\/)/.test(str(m.image, 'image'))) throw new BadRequest('image must be a link');
    return m as unknown as MuhuIdea;
  });
}

export function parseSearch(v: unknown): SavedSearch {
  if (!isObj(v)) throw new BadRequest('bad search');
  for (const k of ['id', 'name', 'q', 'want']) str(v[k], k);
  arr(v.cats, 'cats').forEach(c => str(c, 'cats'));
  return v as unknown as SavedSearch;
}

export function parseCategory(v: unknown): CustomCat {
  if (!isObj(v)) throw new BadRequest('bad category');
  for (const k of ['id', 'label', 'icon']) str(v[k], k);
  if (!/^#[0-9a-f]{6}$/i.test(str(v.color, 'color'))) throw new BadRequest('color must look like #12A39F');
  if (v.scope !== 'trip' && v.scope !== 'muhu') throw new BadRequest('scope must be trip or muhu');
  return v as unknown as CustomCat;
}

export function parsePrefs(v: unknown): Prefs {
  if (!isObj(v)) throw new BadRequest('bad preferences');
  arr(v.interests, 'interests'); arr(v.diet, 'diet');
  return v as unknown as Prefs;
}

export function parsePlace(v: unknown): string {
  if (!isObj(v)) throw new BadRequest('bad body');
  return str(v.place, 'place');
}

// turns a thrown BadRequest into a 400 instead of a crash
export async function handle(fn: () => unknown | Promise<unknown>) {
  try {
    const out = await fn();
    return out === undefined ? new Response(null, { status: 204 }) : Response.json(out);
  } catch (e) {
    if (e instanceof BadRequest || e instanceof SyntaxError) return Response.json({ error: e.message }, { status: 400 });
    console.error(e);
    return Response.json({ error: 'Could not save' }, { status: 500 });
  }
}
