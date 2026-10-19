import { kindOf } from './kinds';
import { searchCatalog } from './picks';
import { tripCenter } from './trips';
import type { CatalogPlace, DestinationHit, DestinationResult, PlaceResult, Trip } from './types';

// keep only what identifies a sample place, like a Google result
export const fromCatalog = (p: CatalogPlace): PlaceResult => ({ name: p.name, cat: p.cat, kind: kindOf(p), hood: p.hood, lat: p.lat ?? null, lng: p.lng ?? null });

async function getJSON<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Search failed (${r.status})`);
  return r.json() as Promise<T>;
}

// Google Places when the server has a key, biased to the trip's center; otherwise the preview's sample results
export async function findPlaces(t: Trip, q: string, google: boolean): Promise<PlaceResult[]> {
  if (!google) { await new Promise(r => setTimeout(r, 450)); return searchCatalog(t, q).map(fromCatalog); }
  const c = tripCenter(t);
  const params = new URLSearchParams(c ? { q, lat: String(c.lat), lng: String(c.lng) } : { q: `${q} in ${t.dest.name}` });
  const ids = new Set(t.ideas.map(i => i.placeId).filter(Boolean)), names = new Set(t.ideas.map(i => i.name));
  return (await getJSON<PlaceResult[]>(`/api/places/search?${params}`)).filter(p => !(p.placeId && ids.has(p.placeId)) && !names.has(p.name));
}

// a trip's destination: list matches while typing, then look up the picked one's center and country
export const findDestinations = (q: string, session: string) => getJSON<DestinationHit[]>(`/api/places/destinations?${new URLSearchParams({ q, session })}`);
export const destinationOf = (id: string, session: string) => getJSON<DestinationResult | null>(`/api/places/destinations?${new URLSearchParams({ id, session })}`);
