import type { PanRequest } from '@/components/map/TripMap';
import type { Tab } from '@/lib/constants';
import type { Cat, PlaceResult, Trip } from '@/lib/types';

// What's open, selected and highlighted on one trip page. Lives as long as the page does.
export interface TripUI {
  tab: Tab;
  day: number;
  sel: string | null; // the opened itinerary stop
  open: string | null; // the opened idea row
  hl: string | null; // the highlighted map pin (an idea id)
  panTo: PanRequest | null;
  cat: Cat | 'all';
  adding: boolean;
  search: { q: string; loading: boolean; results: PlaceResult[]; error?: string } | null;
  datesOpen: boolean;
  addPanel: { day: number; w: 'ideas' | 'own' } | null;
}
export type SetUI = (patch: Partial<TripUI>) => void;
// mapOk: this trip can show a map (Google, or a preview sketch)
export interface TabProps { t: Trip; ui: TripUI; set: SetUI; mapOk: boolean }

export const initialUI = (t: Trip): TripUI => ({
  tab: t.start ? 'days' : 'ideas', day: 0, sel: null, open: null, hl: null, panTo: null,
  cat: 'all', adding: false, search: null, datesOpen: false, addPanel: null,
});

// ask the map to center on a place
let panSeq = 0;
export const pan = (id: string): PanRequest => ({ id, seq: ++panSeq });
