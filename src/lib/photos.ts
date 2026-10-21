import { useEffect, useSyncExternalStore } from 'react';

// Google place photos for list rows, fetched by place id when a row is shown and kept only for this visit.
export interface Photo { uri: string; author: string; authorUri: string }

const photos = new Map<string, Photo | null>(); // null = no photo, or Google couldn't give one
const asked = new Set<string>();
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

function load(id: string, w: number) {
  const key = `${id}@${w}`;
  if (asked.has(key)) return;
  asked.add(key);
  fetch(`/api/places/photo?id=${encodeURIComponent(id)}${w === 240 ? '' : `&w=${w}`}`)
    .then(r => r.ok ? r.json() as Promise<Photo | null> : null)
    .catch(() => null)
    .then(p => { photos.set(key, p); listeners.forEach(l => l()); });
}

// undefined while loading, null when there is no photo; 240px wide for list rows, 640px for tiles and the side panel
export function usePhoto(placeId: string | undefined, enabled: boolean, w: 240 | 640 = 240) {
  const on = enabled && !!placeId;
  useEffect(() => { if (on) load(placeId!, w); }, [on, placeId, w]);
  return useSyncExternalStore(subscribe, () => on ? photos.get(`${placeId}@${w}`) : null, () => undefined);
}
