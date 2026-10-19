import type { Cat, Pace, Status } from './types';

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
