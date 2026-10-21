import { produce } from 'immer';
import { useEffect, useSyncExternalStore } from 'react';
import type { AppState, Idea, MuhuIdea, Trip } from './types';

// A tiny external store: one shared state object, like the prototype's global S.
function createStore<T>(init: () => T, server: T, persist?: (v: T) => void) {
  let value: T | undefined, ready = false;
  const listeners = new Set<() => void>();
  const get = () => { if (!ready) { value = init(); ready = true; } return value as T; };
  const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
  return {
    get,
    set(next: T) { value = next; ready = true; persist?.(next); listeners.forEach(l => l()); },
    use: () => useSyncExternalStore(subscribe, get, () => server),
  };
}

function read<T>(key: string): T | null {
  try { const s = localStorage.getItem(key); return s ? JSON.parse(s) as T : null; } catch { return null; }
}
function write(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* still works without storage */ }
}

/* ---------- shared data: SQLite on the server, through the API routes, so both of you see the same ---------- */
const data = createStore<AppState | null>(() => null, null);
let loaded = false, loading = false, edits = 0;

// null until the first load arrives (and always while rendering on the server)
export function useAppState() {
  useEffect(() => { refresh(); }, []);
  return data.use();
}
export const getState = () => data.get();

export function refresh(force = false) {
  if (loading || (loaded && !force) || busy()) return;
  loading = true;
  const at = edits;
  fetch('/api/state', { cache: 'no-store' })
    .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<AppState>; })
    .then(s => { if (edits === at && !busy()) data.set(s); loaded = true; })
    .catch(() => toast('Couldn’t load your trips. Is the server running?'))
    .finally(() => { loading = false; });
}

// Every change applies here at once, then only what changed is sent: Immer keeps untouched trips identical.
export function update(fn: (draft: AppState) => void) {
  const prev = data.get(); if (!prev) return;
  const next = produce(prev, fn);
  edits++; data.set(next); sync(prev, next);
}

export async function resetData() {
  queued.forEach(q => clearTimeout(q.timer)); queued.clear();
  const r = await fetch('/api/reset', { method: 'POST' }).catch(() => null);
  if (!r?.ok) { toast('Couldn’t reset. Check the connection and try again.'); return false; }
  edits++; data.set(await r.json()); return true;
}

type Send = (keepalive: boolean) => Promise<void>;
const queued = new Map<string, { timer: ReturnType<typeof setTimeout>; send: Send }>();
let writing = 0;
const busy = () => queued.size > 0 || writing > 0;

async function call(method: string, url: string, body?: unknown, keepalive = false) {
  try {
    const r = await fetch(url, { method, keepalive, ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) });
    if (!r.ok) throw new Error(String(r.status));
  } catch { toast('Couldn’t save the last change. Check the connection and try again.'); }
}
function run(send: Send, keepalive = false) { writing++; send(keepalive).finally(() => { writing--; }); }
// typing waits for a pause; the latest version is sent
function later(key: string, send: Send, delay = 500) {
  const q = queued.get(key); if (q) clearTimeout(q.timer);
  queued.set(key, { send, timer: setTimeout(() => { queued.delete(key); run(send); }, delay) });
}
function flush() { queued.forEach(q => { clearTimeout(q.timer); run(q.send, true); }); queued.clear(); }

const muhuDirty = new Set<string>();
function sync(prev: AppState, next: AppState) {
  for (const t of next.trips) {
    if (prev.trips.find(p => p.id === t.id) === t) continue;
    later(`trip:${t.id}`, k => { const cur = getState()?.trips.find(x => x.id === t.id); return cur ? call('PUT', `/api/trips/${t.id}`, cur, k) : Promise.resolve(); });
  }
  if (prev.world !== next.world) {
    for (const cid of new Set([...Object.keys(prev.world), ...Object.keys(next.world)])) {
      const st = next.world[cid];
      if (prev.world[cid] !== st) run(() => st?.length ? call('PUT', `/api/countries/${cid}`, { statuses: st }) : call('DELETE', `/api/countries/${cid}`));
    }
  }
  if (prev.visits !== next.visits) {
    for (const v of next.visits) if (!prev.visits.some(p => p.id === v.id)) run(() => call('POST', '/api/visits', v));
    for (const v of prev.visits) if (!next.visits.some(n => n.id === v.id)) run(() => call('DELETE', `/api/visits/${v.id}`));
  }
  if (prev.muhu !== next.muhu) {
    for (const m of next.muhu) if (prev.muhu.find(p => p.id === m.id) !== m) muhuDirty.add(m.id);
    for (const m of prev.muhu) if (!next.muhu.some(n => n.id === m.id)) { muhuDirty.delete(m.id); run(() => call('DELETE', `/api/muhu/${m.id}`)); }
    // one request for everything that changed, so importing a whole list is a single save
    if (muhuDirty.size) later('muhu', k => {
      const ids = new Set(muhuDirty); muhuDirty.clear();
      const cur = getState()?.muhu.filter(m => ids.has(m.id)) ?? [];
      return cur.length ? call('PUT', '/api/muhu', cur, k) : Promise.resolve();
    });
  }
  if (prev.prefs !== next.prefs) later('prefs', k => call('PUT', '/api/preferences', getState()!.prefs, k));
  for (const place of next.dismissed) if (!prev.dismissed.includes(place)) run(() => call('POST', '/api/dismissed', { place }));
}

if (typeof window !== 'undefined') {
  // pick up the other person's changes when coming back to the tab; send anything waiting when leaving
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refresh(true); else flush(); });
  window.addEventListener('pagehide', flush);
}

export const findTrip = (s: AppState, id: string) => s.trips.find(t => t.id === id) as Trip;
export const editTrip = (id: string, fn: (t: Trip, s: AppState) => void) => update(s => fn(findTrip(s, id), s));
export const editMuhu = (id: string, fn: (m: MuhuIdea) => void) => update(s => { const m = s.muhu.find(x => x.id === id); if (m) fn(m); });
export const editIdea = (tripId: string, ideaId: string, fn: (i: Idea) => void) => editTrip(tripId, t => fn(t.ideas.find(i => i.id === ideaId)!));

/* ---------- which Google services are switched on: read from the server's environment at runtime ---------- */
export interface Config { mapsKey: string | null; mapId: string; places: boolean; culture: boolean; demo: boolean }
const NO_GOOGLE: Config = { mapsKey: null, mapId: '', places: false, culture: false, demo: false };
const config = createStore<Config | null>(() => null, null);
let configLoading = false;
// null until loaded; without keys the app keeps the preview's sketch maps and sample search
export function useConfig() {
  useEffect(() => {
    if (configLoading || config.get()) return;
    configLoading = true;
    fetch('/api/config').then(r => r.json() as Promise<Config>).then(c => config.set(c), () => config.set(NO_GOOGLE));
  }, []);
  return config.use();
}

/* ---------- view settings: per screen, remembered in this browser ---------- */
// muhuTiles: Muhu ideas as tiles (or a list); muhuSide: on wide screens, the picked idea's photo and map beside them
export interface ViewPrefs { dayMap: boolean; dayAll: boolean; density: 'full' | 'compact'; ideasMap: boolean; listW: number | null; sayIt: boolean; muhuTiles: boolean; muhuSide: boolean }
const VIEW_DEFAULTS: ViewPrefs = { dayMap: true, dayAll: false, density: 'full', ideasMap: true, listW: null, sayIt: false, muhuTiles: true, muhuSide: true };
const view = createStore<ViewPrefs>(() => ({ ...VIEW_DEFAULTS, ...read<Partial<ViewPrefs>>('chusay-view') }), VIEW_DEFAULTS, v => write('chusay-view', v));
export const useView = view.use;
export const setView = (patch: Partial<ViewPrefs>) => view.set({ ...view.get(), ...patch });

/* ---------- open/closed sections and the phone map toggle: this session only ---------- */
interface Session { closed: string[]; opened: string[]; mapHidden: boolean }
const SESSION_DEFAULTS: Session = { closed: [], opened: [], mapHidden: false };
const session = createStore<Session>(() => SESSION_DEFAULTS, SESSION_DEFAULTS);
export const useSession = session.use;
export const discIsOpen = (s: Session, key: string, def: boolean) => s.closed.includes(key) ? false : s.opened.includes(key) ? true : def;
export function toggleDisc(key: string, def: boolean, isOpen: boolean) {
  const s = session.get();
  const closed = s.closed.filter(k => k !== key), opened = s.opened.filter(k => k !== key);
  if (isOpen && def) closed.push(key);
  if (!isOpen && !def) opened.push(key);
  session.set({ ...s, closed, opened });
}
export function openDisc(key: string) {
  const s = session.get();
  session.set({ ...s, closed: s.closed.filter(k => k !== key), opened: [...s.opened.filter(k => k !== key), key] });
}
export const toggleMapHidden = () => session.set({ ...session.get(), mapHidden: !session.get().mapHidden });

/* ---------- toast ---------- */
const toastStore = createStore<{ msg: string; n: number; out?: boolean } | null>(() => null, null);
let toastTimer: ReturnType<typeof setTimeout> | undefined;
export const useToast = toastStore.use;
export function toast(msg: string) {
  toastStore.set({ msg, n: (toastStore.get()?.n ?? 0) + 1 });
  // fade out briefly before it goes, so it doesn't just vanish
  clearTimeout(toastTimer); toastTimer = setTimeout(() => {
    toastStore.set({ ...toastStore.get()!, out: true });
    toastTimer = setTimeout(() => toastStore.set(null), 150);
  }, 2600);
}
