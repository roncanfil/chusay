import type { Cat, CustomCat, MuhuCat, Pace, Status, Want } from './types';

export const CATS: Record<Cat, { label: string; color: string }> = {
  sight: { label: 'Sights', color: 'var(--c-sight)' },
  food: { label: 'Food & drink', color: 'var(--c-food)' },
  act: { label: 'Activities', color: 'var(--c-act)' }, // anytime, no booking
  tour: { label: 'Tours', color: 'var(--c-tour)' }, // booked or reserved for a set time
  stay: { label: 'Stays', color: 'var(--c-stay)' },
  shop: { label: 'Shopping', color: 'var(--c-shop)' },
};
export const CAT_KEYS = Object.keys(CATS) as Cat[];

// categories plus "our own plan" entries on the itinerary
export type IconKey = Cat | 'own';
export const KINDS: Record<IconKey, { label: string; color: string }> = { ...CATS, own: { label: 'Our own plan', color: 'var(--c-own)' } };

export const ICON: Record<IconKey, string> = {
  sight: 'M3 21h18M5 21v-10M9.5 21v-10M14.5 21v-10M19 21v-10M3 10l9-6 9 6z',
  food: 'M7 3v18M4 3v5a3 3 0 0 0 6 0V3M17 21V3c-2.2 1.4-3 4-3 8h3',
  act: 'M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4zM14.5 7v10',
  tour: 'M5 21V4M5 4h11l-2 4 2 4H5M17 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM17 16.5V18l1 .8',
  stay: 'M2 19V6M2 15h20M22 19v-4a3 3 0 0 0-3-3h-8v3M6.5 12.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z',
  shop: 'M5 8h14l-1.2 13H6.2zM9 10V7a3 3 0 0 1 6 0v3',
  own: 'M8 2v4M16 2v4M3 9h18M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM12 12.5v5M9.5 15h5',
};

export const STATUS: Record<Status, { label: string; color: string }> = {
  visited: { label: 'Visited', color: 'var(--s-visited)' },
  planning: { label: 'Planning', color: 'var(--s-planning)' },
  want: { label: 'Want to go', color: 'var(--s-want)' },
  nope: { label: 'Not interested', color: 'var(--s-nope)' },
};

export const INTERESTS: Record<string, string> = {
  markets: 'Food markets', streetfood: 'Street food', finedining: 'Special dinners', local: 'Local hangouts',
  history: 'History & museums', art: 'Art & design', views: 'Viewpoints', nature: 'Parks & nature',
  music: 'Live music', night: 'Bars & nightlife', crafts: 'Local crafts', tours: 'Guided tours', slow: 'Cafés & slow mornings',
};
export const DIETS: Record<string, string> = { veg: 'Vegetarian', vegan: 'Vegan', gf: 'Gluten-free' };
export const PACE: Record<Pace, [string, number]> = { relaxed: ['Relaxed', 3], balanced: ['Balanced', 4], packed: ['Packed', 6] };
export const BUDGETS = ['Saving', 'Moderate', 'Comfortable', 'Splurge'];

// every day gets its own color: line, dots, map route, day tags
export const DAY_COLORS = ['#12A39F', '#D9488B', '#2F86D6', '#E07B2E', '#7A9E25', '#6A55D6', '#A8743F'];
export const dayColor = (k: number) => DAY_COLORS[k % DAY_COLORS.length];

// each tab has a color too, so it's clear which page you're on
export type Tab = 'days' | 'ideas' | 'culture' | 'feedback';
export const TAB_COLORS: Record<Tab, string> = { days: '#12A39F', ideas: '#E07B2E', culture: '#6A55D6', feedback: '#D9488B' };

// Muhu has its own categories, for things to see in a country rather than stops on a trip
export const MUHU_CATS: Record<MuhuCat, { label: string; color: string; icon: string }> = {
  outdoors: { label: 'Outdoors', color: '#2E9E5B', icon: 'M2 20l7-10 4 6 3-4 6 8zM18 7a2 2 0 1 0-4 0 2 2 0 0 0 4 0' },
  food: { label: 'Food & drink', color: 'var(--c-food)', icon: ICON.food },
  built: { label: 'Villages & buildings', color: 'var(--c-sight)', icon: 'M4 21V9h3v2h3V9h4v2h3V9h3v12zM10 21v-4a2 2 0 0 1 4 0v4' },
  events: { label: 'Festivals & events', color: '#D9488B', icon: 'M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8' },
  fun: { label: 'Fun', color: 'var(--c-act)', icon: ICON.act },
  culture: { label: 'Culture', color: 'var(--c-stay)', icon: 'M3 21h18M4 10h16M12 3l9 5H3zM6 10v8M10 10v8M14 10v8M18 10v8M4 18h16' },
  kids: { label: 'For the kids', color: '#2F86D6', icon: 'M12 3a5 5 0 0 0-5 5c0 3.5 3 6 5 6s5-2.5 5-6a5 5 0 0 0-5-5zM12 14l-1 2h2zM12 16c0 2-2 3-1 5' },
  shop: { label: 'Shopping', color: 'var(--c-shop)', icon: ICON.shop },
  other: { label: 'Other', color: 'var(--ink-3)', icon: 'M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z' },
};
export const MUHU_KEYS = Object.keys(MUHU_CATS) as MuhuCat[];
// how much we want to go, in words; the most wanted come first
export const WANT: Record<Exclude<Want, ''>, string> = { high: 'Must do', med: 'Would like to', low: 'If we’re nearby' };
// a seed copied onto a trip lands in the closest trip category
// and the other way, for an idea moved off a trip into Muhu
export const TRIP_TO_MUHU: Record<string, MuhuCat> = { sight: 'built', food: 'food', act: 'fun', tour: 'fun', stay: 'other', shop: 'shop' };
export const MUHU_TO_TRIP: Record<MuhuCat, Cat> = { outdoors: 'sight', food: 'food', built: 'sight', events: 'act', fun: 'act', culture: 'sight', kids: 'act', shop: 'shop', other: 'sight' };

/* ---------- categories the household added: merged into the same lookups, so every list, chip, filter and map pin knows them ---------- */
export const NEW_CAT_COLORS = ['#12A39F', '#D9488B', '#2F86D6', '#E07B2E', '#7A9E25', '#6A55D6', '#A8743F', '#C94F4F', '#3E7C8C', '#B58B00'];
export const NEW_CAT_ICONS: Record<string, string> = {
  heart: 'M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z',
  waves: 'M2 10c2-2 4-2 6 0s4 2 6 0 4-2 6 0M2 15c2-2 4-2 6 0s4 2 6 0 4-2 6 0',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  music: 'M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  boat: 'M3 16l2 4h14l2-4zM12 3v11M12 3l6 9h-6',
  tag: 'M3 12V4h8l10 10-8 8zM7.5 8.5h.01',
  leaf: 'M5 19c0-9 5-14 15-14 0 10-5 15-14 15M5 19l7-7',
};
let applied = '';
export function addCustomCats(list: CustomCat[] = []) {
  const key = JSON.stringify(list); if (key === applied) return; applied = key;
  for (const c of list) {
    if (c.scope === 'trip') {
      CATS[c.id] = { label: c.label, color: c.color }; KINDS[c.id] = CATS[c.id]; ICON[c.id] = c.icon;
      if (!CAT_KEYS.includes(c.id)) CAT_KEYS.push(c.id);
    } else {
      MUHU_CATS[c.id] = { label: c.label, color: c.color, icon: c.icon }; MUHU_TO_TRIP[c.id] = 'sight';
      if (!MUHU_KEYS.includes(c.id)) MUHU_KEYS.splice(MUHU_KEYS.indexOf('other'), 0, c.id); // "Other" stays last
    }
  }
}
