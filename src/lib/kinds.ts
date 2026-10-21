import { CATS, ICON } from './constants';
import type { Cat, PlaceLike } from './types';

// A finer "kind" inside each category, so two food spots can look different on the map.
// The real app takes this from Google's place type (primaryType); the preview guesses it from the name.
export const KIND: Record<string, [string, string]> = {
  restaurant: ['Restaurant', ICON.food], bakery: ['Bakery', 'M6 11h12l-1.5 9h-9zM5 11c0-3.5 3-6 7-6s7 2.5 7 6M10 11l.7 9M14 11l-.7 9'],
  cafe: ['Café', 'M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM17 10h1.5a2.5 2.5 0 0 1 0 5H17M8 3v3M12 3v3'], bar: ['Bar', 'M4 4h16l-8 9zM12 13v7M8 20h8'],
  market: ['Market', 'M3 9l2-5h14l2 5M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0M5 12v8h14v-8M10 20v-5h4v5'],
  landmark: ['Landmark', ICON.sight], museum: ['Museum', 'M3 21h18M4 10h16M12 3l9 5H3zM6 10v8M10 10v8M14 10v8M18 10v8M4 18h16'],
  view: ['Viewpoint', 'M2 20l7-10 4 6 3-4 6 8zM18 7a2 2 0 1 0-4 0 2 2 0 0 0 4 0'], park: ['Park or garden', 'M12 22v-6M12 2a6 6 0 0 0-6 6c0 2 1 3.5 2 4.5A4 4 0 0 0 12 16a4 4 0 0 0 4-3.5c1-1 2-2.5 2-4.5a6 6 0 0 0-6-6z'],
  castle: ['Castle', 'M4 21V9h3v2h3V9h4v2h3V9h3v12zM10 21v-4a2 2 0 0 1 4 0v4'], temple: ['Temple or church', 'M12 2v4M10 4h4M6 21V11l6-5 6 5v10zM10 21v-5h4v5M3 21h18'],
  activity: ['Activity', ICON.act], music: ['Live music', 'M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z'],
  tour: ['Walk or tour', 'M5 21V4M5 4h11l-2 4 2 4H5'], ride: ['Ride', 'M6 4h12a1 1 0 0 1 1 1v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a1 1 0 0 1 1-1zM5 11h14M8 22l2-4M16 22l-2-4'],
  aquarium: ['Aquarium', 'M3 12c3-5 10-6 14 0-4 6-11 5-14 0zM17 12l4-3v6zM8 11.5h.01'],
  stay: ['Stay', ICON.stay], shop: ['Shop', ICON.shop],
};
const KIND_RULES: Partial<Record<Cat, [RegExp, string][]>> = {
  food: [[/pastel|past[eé]is|bakery|manteigaria|nata|padaria|panader/, 'bakery'], [/caf[eé]|coffee|kiosk|\btea\b/, 'cafe'], [/\bbar\b|ginj|cocktail|rooftop|wine|pub/, 'bar'], [/market|mercado|food hall/, 'market']],
  sight: [[/miradouro|viewpoint|mirador|lookout/, 'view'], [/\bpark|jardim|garden|parque|bamboo|grove/, 'park'], [/castelo|castle|castillo/, 'castle'], [/monaster|church|igreja|temple|templo|shrine|cathedral|-ji\b|dera|taisha|s[ée]\b/, 'temple'], [/muse|museum|gallery/, 'museum']],
  act: [[/fado|music|jazz|concert|mariachi/, 'music'], [/tour|walk|path/, 'tour'], [/tram|boat|bike|ride|cruise|cable/, 'ride'], [/ocean|aquar/, 'aquarium']],
  shop: [[/feira|flea|souk|tianguis|market|mercado/, 'market']],
};
const DEF_KIND: Partial<Record<Cat, string>> = { food: 'restaurant', sight: 'landmark', act: 'activity', tour: 'tour', stay: 'stay', shop: 'shop' };

export function kindOf(i: PlaceLike): string {
  if (i.kind && KIND[i.kind]) return i.kind;
  const hay = [i.name, i.kw || ''].join(' ').toLowerCase();
  const hit = (KIND_RULES[i.cat] || []).find(([re]) => re.test(hay));
  return hit ? hit[1] : DEF_KIND[i.cat] ?? i.cat; // a category the household added is its own kind
}
export const kindLabel = (i: PlaceLike) => KIND[kindOf(i)]?.[0] ?? CATS[i.cat]?.label ?? '';
export const kindPath = (i: PlaceLike) => KIND[kindOf(i)]?.[1] ?? ICON[i.cat] ?? ICON.sight;
export const short = (n: string, max = 24) => n.length > max ? n.slice(0, max - 1).replace(/[\s,]+\S*$/, '') + '…' : n;
