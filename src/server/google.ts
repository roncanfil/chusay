import 'server-only';
import countries from 'i18n-iso-countries';
import { categorize } from '@/lib/place-types';
import type { DestinationHit, DestinationResult, PlaceResult } from '@/lib/types';

// Google finds places and draws maps. It never fills in the household's notes, ratings, prices or hours,
// so every call asks only for the fields shown (cost also scales with the fields requested).
const BASE = 'https://places.googleapis.com/v1';
export const placesKey = () => process.env.GOOGLE_PLACES_SERVER_KEY || '';

export class GoogleError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

interface AddressComponent { longText: string; shortText: string; types?: string[] } // Google leaves types off some components
export interface GPlace {
  id: string;
  displayName?: { text: string };
  location?: { latitude: number; longitude: number };
  primaryType?: string;
  types?: string[];
  addressComponents?: AddressComponent[];
  formattedAddress?: string;
  photos?: { name: string; authorAttributions?: { displayName: string; uri: string }[] }[];
}

async function google<T>(path: string, mask: string, body?: unknown): Promise<T> {
  const key = placesKey();
  if (!key) throw new GoogleError(501, 'GOOGLE_PLACES_SERVER_KEY is not set');
  const res = await fetch(`${BASE}/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': mask },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  if (!res.ok) {
    // keep Google's own reason (key not allowed, API off, quota) so the app can show it
    const text = await res.text();
    let why = text.slice(0, 300);
    try { why = (JSON.parse(text) as { error?: { message?: string } }).error?.message || why; } catch { /* not JSON */ }
    throw new GoogleError(502, `Google Places ${res.status}: ${why}`);
  }
  return res.json() as Promise<T>;
}

const part = (p: GPlace, ...types: string[]) => {
  for (const t of types) { const c = p.addressComponents?.find(a => a.types?.includes(t)); if (c) return c; }
};

// a place search inside a destination, biased to the trip's center
export function toPlaceResult(p: GPlace): PlaceResult {
  const { cat, kind } = categorize(p.primaryType, p.types);
  return {
    placeId: p.id, name: p.displayName?.text || 'Unnamed place', cat, kind,
    hood: part(p, 'neighborhood', 'sublocality_level_1', 'sublocality', 'locality')?.longText || '',
    lat: p.location?.latitude ?? null, lng: p.location?.longitude ?? null,
  };
}
export async function searchPlaces(q: string, near: { lat: number; lng: number } | null): Promise<PlaceResult[]> {
  const out = await google<{ places?: GPlace[] }>('places:searchText', 'places.id,places.displayName,places.location,places.primaryType,places.types,places.addressComponents', {
    textQuery: q, pageSize: 8, languageCode: 'en',
    ...(near ? { locationBias: { circle: { center: { latitude: near.lat, longitude: near.lng }, radius: 20000 } } } : {}),
  });
  return (out.places || []).map(toPlaceResult);
}

// any city, region or country for a trip's destination
export function toDestination(p: GPlace): DestinationResult | null {
  const country = part(p, 'country');
  if (!p.location || !country) return null;
  return {
    placeId: p.id, name: p.displayName?.text || country.longText, address: p.formattedAddress || '',
    country: country.longText, cid: countries.alpha2ToNumeric(country.shortText) || '',
    lat: p.location.latitude, lng: p.location.longitude,
  };
}
const DEST_MASK = 'id,displayName,location,addressComponents,formattedAddress';
// Autocomplete forgives typos ("Duoro") and knows regions and natural areas, not only cities.
// Businesses and sights are left out: a trip goes to a place on the map, not to a restaurant.
const AREA_TYPES = new Set(['political', 'country', 'locality', 'colloquial_area', 'natural_feature', 'archipelago', 'continent', 'national_park', 'postal_town']);
interface Prediction { placeId: string; types?: string[]; structuredFormat?: { mainText?: { text: string }; secondaryText?: { text: string } } }
export async function findDestinations(q: string, session?: string): Promise<DestinationHit[]> {
  const out = await google<{ suggestions?: { placePrediction?: Prediction }[] }>('places:autocomplete',
    'suggestions.placePrediction.placeId,suggestions.placePrediction.types,suggestions.placePrediction.structuredFormat',
    { input: q, languageCode: 'en', ...(session ? { sessionToken: session } : {}) });
  const hits = (out.suggestions || []).map(s => s.placePrediction).filter(p => !!p && p.types?.some(t => AREA_TYPES.has(t)))
    .slice(0, 6).map(p => ({ placeId: p!.placeId, name: p!.structuredFormat?.mainText?.text || '', address: p!.structuredFormat?.secondaryText?.text || '' }));
  if (hits.length) return hits;
  // nothing that looks like an area: fall back to a full search, which also finds a resort or an island hotel
  const found = await google<{ places?: GPlace[] }>('places:searchText', 'places.id,places.displayName,places.formattedAddress', { textQuery: q, pageSize: 5, languageCode: 'en' });
  return (found.places || []).map(p => ({ placeId: p.id, name: p.displayName?.text || '', address: p.formattedAddress || '' }));
}
// the picked destination's center and country; the session token ties it to its autocomplete for billing
export async function destination(id: string, session?: string): Promise<DestinationResult | null> {
  const qs = new URLSearchParams({ languageCode: 'en', ...(session ? { sessionToken: session } : {}) });
  return toDestination(await google<GPlace>(`places/${encodeURIComponent(id)}?${qs}`, DEST_MASK));
}

// A photo for a row, loaded by place id when the row is shown. Photo names can't be stored,
// so they're only kept in memory for a few minutes to avoid asking twice for the same screen.
export interface Photo { uri: string; author: string; authorUri: string }
const photoCache = new Map<string, { at: number; photo: Photo | null }>();
const PHOTO_TTL = 10 * 60 * 1000;
export async function photoFor(placeId: string, maxWidthPx = 240): Promise<Photo | null> {
  const key = `${placeId}@${maxWidthPx}`, hit = photoCache.get(key);
  if (hit && Date.now() - hit.at < PHOTO_TTL) return hit.photo;
  const place = await google<GPlace>(`places/${encodeURIComponent(placeId)}`, 'photos');
  const first = place.photos?.[0];
  let photo: Photo | null = null;
  if (first) {
    const res = await fetch(`${BASE}/${first.name}/media?maxWidthPx=${maxWidthPx}&skipHttpRedirect=true&key=${placesKey()}`, { cache: 'no-store' });
    if (!res.ok) throw new GoogleError(502, `Google photo ${res.status}`);
    const { photoUri } = await res.json() as { photoUri: string };
    const by = first.authorAttributions?.[0];
    photo = { uri: photoUri, author: by?.displayName || '', authorUri: by?.uri || '' };
  }
  photoCache.set(key, { at: Date.now(), photo });
  return photo;
}

// JSON for a route handler; Google failures become a status the browser can fall back on
export async function respond(fn: () => Promise<unknown>, headers?: HeadersInit) {
  try { return Response.json(await fn(), { headers }); } catch (e) {
    if (!(e instanceof GoogleError && e.status === 501)) console.error(e);
    return Response.json({ error: e instanceof Error ? e.message : 'Google request failed' }, { status: e instanceof GoogleError ? e.status : 500 });
  }
}
