import { useEffect, useSyncExternalStore } from 'react';

// Google place photos for list rows, fetched by place id when a row is shown and kept only for this visit.
export interface Photo { uri: string; author: string; authorUri: string }

const photos = new Map<string, Photo | null>(); // null = no photo, or Google couldn't give one
const asked = new Set<string>();
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

function load(id: string) {
  if (asked.has(id)) return;
  asked.add(id);
  fetch(`/api/places/photo?id=${encodeURIComponent(id)}`)
    .then(r => r.ok ? r.json() as Promise<Photo | null> : null)
    .catch(() => null)
    .then(p => { photos.set(id, p); listeners.forEach(l => l()); });
}

// undefined while loading, null when there is no photo
export function usePhoto(placeId: string | undefined, enabled: boolean) {
  const on = enabled && !!placeId;
  useEffect(() => { if (on) load(placeId!); }, [on, placeId]);
  return useSyncExternalStore(subscribe, () => on ? photos.get(placeId!) : null, () => undefined);
}
