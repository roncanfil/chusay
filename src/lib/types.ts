export type BuiltinCat = 'sight' | 'food' | 'act' | 'tour' | 'stay' | 'shop';
// the built-in categories, or one the household added (its id)
export type Cat = BuiltinCat | (string & {});
export type CityKey = 'morocco' | 'lisbon' | 'cdmx' | 'kyoto';
export type Status = 'visited' | 'planning' | 'want' | 'nope';
export type Vote = 'love' | 'ok' | 'skip' | '';
export type Again = 'yes' | 'maybe' | 'no' | '';
export type Pace = 'relaxed' | 'balanced' | 'packed';

// The minimum needed to draw a place: thumbnails, kind icons and labels.
export interface PlaceLike {
  name: string;
  cat: Cat;
  kind?: string;
  kw?: string;
}

// A sample search result (stands in for a Google Places result).
export interface CatalogPlace extends PlaceLike {
  lat?: number;
  lng?: number;
  rating: number;
  reviews: number;
  price: string;
  hood: string;
  hours: string;
  tags: string[];
  veg?: boolean;
  note: string;
}

export interface Idea extends PlaceLike {
  id: string;
  placeId?: string; // Google place id; the name stays the household's own label
  lat: number | null;
  lng: number | null;
  hood: string;
  note: string;
  tags: string[];
  source?: string;
  price?: string; // stays: what the listing asked, as the household typed or the link showed it
  image?: string; // stays: the listing's own preview picture, by URL (never stored as a file)
  stayDays?: string[]; // stays: the days we're staying there, by day id, or ['*'] for every day of the trip
  offMap?: boolean; // left off the maps until it's on a day (a stay we didn't pick)
}

// What a booking-site link could tell about a stay; anything missing is filled in by hand.
export interface StayPreview {
  name: string;
  image: string;
  price: string;
  lat: number | null;
  lng: number | null;
}

// A search result to save as an idea: only what identifies the place, nothing else from Google.
export interface PlaceResult extends PlaceLike {
  placeId?: string;
  kind: string;
  hood: string;
  lat: number | null;
  lng: number | null;
}

// A destination as listed while searching; picking one fetches its DestinationResult.
export interface DestinationHit {
  placeId: string;
  name: string;
  address: string;
}

// A trip's destination found with Google.
export interface DestinationResult {
  placeId: string;
  name: string;
  address: string;
  country: string;
  cid: string; // ISO 3166 numeric, like the world map
  lat: number;
  lng: number;
}

// Something the household adds itself: meeting friends, a reservation, free time.
export interface OwnPlan {
  title: string;
  where: string;
  note: string;
  link: string;
}

export interface Stop {
  id: string;
  time: string;
  idea?: string;
  own?: OwnPlan;
}

export interface Day {
  id: string;
  title: string;
  stops: Stop[];
}

export interface Feedback {
  again: Again;
  highlights: string;
  next: string;
  votes: Record<string, Vote>;
}

export interface Destination {
  name: string;
  country: string;
  cid: string;
}

// A Someday list is a trip with no start date.
export interface Trip {
  id: string;
  name: string;
  city: CityKey | null;
  dest: Destination;
  center?: { lat: number; lng: number } | null; // biases search and centers the map
  start: string | null;
  len: number;
  ideas: Idea[];
  days: Day[];
  notes: string;
  feedback: Feedback;
  mapOffCats?: string[]; // whole categories left off the maps
}

export interface Visit {
  id: string;
  cid: string;
  places: string;
  from: string;
  to: string;
}

export interface Prefs {
  interests: string[];
  pace: Pace;
  budget: number;
  diet: string[];
  photos?: boolean;
}

// Muhu ("seed" in Quechua): something we want to see in a country, saved without a trip or dates
export type MuhuCat = 'outdoors' | 'food' | 'built' | 'events' | 'fun' | 'culture' | 'kids' | 'shop' | 'other' | (string & {});
export type Want = 'high' | 'med' | 'low' | '';
export interface MuhuIdea {
  id: string;
  cid: string; // ISO 3166 numeric, like the world map
  country: string;
  name: string;
  cats: MuhuCat[]; // one or more; the first gives its color
  want: Want;
  area: string;
  when: string; // when to go: months, seasons or a festival's dates, as typed
  far: string; // how to get there from home, as typed
  note: string;
  source?: string;
  placeId?: string; // the Google place it was matched to; the name stays ours
  lat?: number | null;
  lng?: number | null;
  match?: 'auto' | 'set' | 'none'; // guessed by the app, picked by us, or not on Google: guessed only once
  image?: string; // our own picture: a link, or one uploaded to the server (/api/muhu/photos/…)
}

// a Muhu search with its filters, kept under a name for both of you
export interface SavedSearch {
  id: string;
  name: string;
  q: string;
  cats: MuhuCat[]; // none = every category
  want: Want | 'any';
}

// a category the household added, for trip ideas or for Muhu
export interface CustomCat {
  id: string;
  scope: 'trip' | 'muhu';
  label: string;
  color: string;
  icon: string; // an SVG path, from the choices offered
}

export interface AppState {
  trips: Trip[];
  muhu: MuhuIdea[];
  searches: SavedSearch[];
  categories: CustomCat[];
  world: Record<string, Status[]>;
  visits: Visit[];
  prefs: Prefs;
  dismissed: string[];
}

export interface City {
  name: string;
  country: string;
  cid: string;
  nomap?: boolean;
  coast?: boolean;
  hoods: [string, number, number][];
  parks: [number, number, number, number, string][];
  rivers: [number, number][][];
  waterLabel?: [string, number, number];
  shore?: [number, number][];
  streets?: [number, number][][];
  lanes?: [number, number][][];
}

export interface Culture {
  lang: string;
  variant: string;
  note: string;
  phrases: [string, string, string][];
  dos: string[]; // empty where the household doesn't want customs (Portugal)
  donts: string[];
  regional?: [string, string, string, string][]; // [what, region, local, say]: Portugal's beers and coffees
}
// Culture built from Wikivoyage by Claude and saved per country
// the trip's own place: quirky local things, from its Wikivoyage page
export interface Quirks {
  place: string; // the destination they were written for; a moved trip gets new ones
  items: [string, string][]; // [short title, one or two sentences]
  source: string;
  fetchedAt: string;
}
export interface CultureEntry extends Culture {
  source: string; // the Wikivoyage page, credited under CC BY-SA
  fetchedAt: string;
  stale?: boolean; // saved in an older shape; shown while it's redone
}
