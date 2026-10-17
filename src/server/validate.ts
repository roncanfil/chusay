import 'server-only';
import type { Prefs, Status, Trip, Visit } from '@/lib/types';

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

export function parseStatus(v: unknown): Status {
  if (!isObj(v) || !STATUSES.includes(v.status as string)) throw new BadRequest('status must be visited, planning, want or nope');
  return v.status as Status;
}

export function parseVisit(v: unknown): Visit {
  if (!isObj(v)) throw new BadRequest('bad visit');
  str(v.id, 'id'); str(v.cid, 'cid'); str(v.places, 'places');
  if (!/^\d{4}-\d{2}$/.test(str(v.from, 'from'))) throw new BadRequest('from must be YYYY-MM');
  return v as unknown as Visit;
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
