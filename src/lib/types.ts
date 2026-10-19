export type Cat = 'sight' | 'food' | 'act' | 'stay' | 'shop';
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

export interface AppState {
  trips: Trip[];
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
  dos: string[];
  donts: string[];
}
