'use client';

import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from 'react';
import { CATS } from '@/lib/constants';
import { kindLabel, kindPath, short } from '@/lib/kinds';
import { GVIEWS } from '@/lib/map/panzoom';
import { tripCenter } from '@/lib/trips';
import type { Idea } from '@/lib/types';
import type { MapProps } from './TripMap';

type Marker = google.maps.marker.AdvancedMarkerElement;
interface Pin { marker: Marker; el: HTMLDivElement; label: HTMLSpanElement }

declare global { interface Window { gm_authFailure?: () => void } }

// Google calls gm_authFailure when it rejects the browser key (a wrong key, or a domain the key doesn't allow).
// Then the map falls back to the preview's sketch where there is one.
let mapsFailed = false;
const failListeners = new Set<() => void>();
function fail() { mapsFailed = true; failListeners.forEach(l => l()); }
export const useMapsFailed = () => useSyncExternalStore(l => { failListeners.add(l); return () => { failListeners.delete(l); }; }, () => mapsFailed, () => false);

// The Maps JavaScript API loads once per page, with the browser key from the server's environment.
let loader: Promise<typeof import('@googlemaps/js-api-loader')> | null = null;
function maps(key: string) {
  loader ??= import('@googlemaps/js-api-loader').then(m => { window.gm_authFailure = fail; m.setOptions({ key, v: 'weekly' }); return m; });
  return loader;
}

const NS = 'http://www.w3.org/2000/svg';
const remove = (p: Pin) => { p.marker.map = null; };
// a category-colored dot with the place's kind icon, and its short name beside it
function pinElement(): Pin['el'] {
  const el = document.createElement('div'); el.className = 'gpin';
  const dot = document.createElement('span'); dot.className = 'gpin-dot';
  const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 24 24');
  const path = document.createElementNS(NS, 'path');
  for (const [k, v] of Object.entries({ fill: 'none', stroke: 'currentColor', 'stroke-width': '2.6', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })) path.setAttribute(k, v);
  svg.append(path); dot.append(svg);
  const label = document.createElement('span'); label.className = 'gpin-label';
  el.append(dot, label);
  return el;
}

type Located = { idea: Idea }[];
const centerOf = (t: MapProps['t'], located: Located) => tripCenter(t) || { lat: located[0]?.idea.lat ?? 0, lng: located[0]?.idea.lng ?? 0 };
function fitPlaces(map: google.maps.Map, located: Located, fallback: google.maps.LatLngLiteral) {
  if (located.length > 1) {
    const b = new google.maps.LatLngBounds();
    located.forEach(p => b.extend({ lat: p.idea.lat!, lng: p.idea.lng! }));
    map.fitBounds(b, 60);
  } else { map.setCenter(located[0] ? { lat: located[0].idea.lat!, lng: located[0].idea.lng! } : fallback); map.setZoom(located[0] ? 15 : 12); }
}

// labels that would overlap another pin, label or the map buttons flip to the left, or hide until zoomed in
function declutter(box: HTMLElement, pins: Pin[]) {
  const vb = box.getBoundingClientRect();
  type Box = { l: number; t: number; r: number; b: number };
  const rect = (el: Element): Box => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };
  const live = pins.filter(p => !p.el.classList.contains('dim'));
  const taken = live.map(p => rect(p.el.firstElementChild!));
  const ctrl = box.parentElement?.querySelector('.map-ctrl'); if (ctrl) taken.push(rect(ctrl));
  const free = (r: Box) => r.l >= vb.left + 2 && r.r <= vb.right - 2 && r.t >= vb.top && r.b <= vb.bottom && !taken.some(o => r.l < o.r && r.r > o.l && r.t < o.b && r.b > o.t);
  live.sort((a, b) => Number(b.el.classList.contains('hl')) - Number(a.el.classList.contains('hl')));
  for (const p of live) {
    p.el.classList.remove('left', 'hidden');
    let r = rect(p.label);
    if (!free(r)) { p.el.classList.add('left'); r = rect(p.label); }
    if (free(r) || p.el.classList.contains('hl')) taken.push(r); else p.el.classList.add('hidden');
  }
}

export function GoogleMap({ t, places, routes, viewKey, hl, panTo, onPin, mapsKey, mapId }: MapProps & { mapsKey: string; mapId: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const pins = useRef(new Map<string, Pin>());
  const lines = useRef<google.maps.Polyline[]>([]);
  const keyRef = useRef(viewKey);
  const located = places.filter(p => p.idea.lat != null);

  const click = useEffectEvent((id: string) => onPin(id));
  const tidy = useEffectEvent(() => { if (boxRef.current) declutter(boxRef.current, [...pins.current.values()]); });
  const center = useEffectEvent(() => centerOf(t, located));

  // create the map once per mount
  useEffect(() => {
    let live = true;
    const box = boxRef.current!, drawn = pins.current;
    maps(mapsKey).then(async m => {
      const [{ Map }, { ColorScheme }] = await Promise.all([m.importLibrary('maps'), m.importLibrary('core'), m.importLibrary('marker')]);
      if (!live) return;
      const gm = new Map(box, { mapId, center: center(), zoom: 13, disableDefaultUI: true, scaleControl: true, clickableIcons: false, gestureHandling: 'greedy', colorScheme: ColorScheme.FOLLOW_SYSTEM });
      gm.addListener('idle', () => {
        const c = gm.getCenter(); if (c) GVIEWS[keyRef.current] = { lat: c.lat(), lng: c.lng(), zoom: gm.getZoom() ?? 13 };
        tidy();
      });
      setMap(gm);
    }).catch(fail);
    return () => {
      live = false;
      drawn.forEach(remove); drawn.clear();
      lines.current.forEach(l => l.setMap(null)); lines.current = [];
    };
  }, [mapsKey, mapId]);

  // pins: add, update and remove to match the places shown
  useEffect(() => {
    if (!map) return;
    const seen = new Set<string>();
    for (const { idea: i, dim, color, icon } of located) {
      seen.add(i.id);
      let p = pins.current.get(i.id);
      if (!p) {
        const el = pinElement();
        const marker = new google.maps.marker.AdvancedMarkerElement({ map, content: el, gmpClickable: true });
        marker.addEventListener('gmp-click', () => click(i.id));
        p = { marker, el, label: el.lastElementChild as HTMLSpanElement };
        pins.current.set(i.id, p);
      }
      p.marker.position = { lat: i.lat!, lng: i.lng! };
      p.marker.title = `${i.name} · ${kindLabel(i)}`;
      p.marker.zIndex = hl === i.id ? 10 : dim ? 0 : 1;
      p.el.style.setProperty('--cc', color ?? CATS[i.cat].color);
      p.el.querySelector('path')!.setAttribute('d', icon ?? kindPath(i));
      p.el.classList.toggle('dim', !!dim); p.el.classList.toggle('hl', hl === i.id);
      p.label.textContent = hl === i.id ? i.name : short(i.name);
    }
    for (const [id, p] of pins.current) if (!seen.has(id)) { remove(p); pins.current.delete(id); }
    requestAnimationFrame(() => tidy());
  });

  // one route per day, in that day's color
  useEffect(() => {
    if (!map) return;
    lines.current.forEach(l => l.setMap(null));
    lines.current = routes.map(r => r.ideas.filter(i => i.lat != null)).map((q, n) => q.length < 2 ? null : new google.maps.Polyline({
      map, path: q.map(i => ({ lat: i.lat!, lng: i.lng! })), strokeColor: routes[n].color, strokeOpacity: .85, strokeWeight: 3.5, clickable: false,
    })).filter(l => !!l);
  }, [map, routes]);

  const fit = useEffectEvent(() => { if (map) fitPlaces(map, located, centerOf(t, located)); });
  // each view (a day, all days, a category) remembers where it was; otherwise it fits its places
  useEffect(() => {
    if (!map) return;
    keyRef.current = viewKey;
    const v = GVIEWS[viewKey];
    if (v) { map.setCenter(v); map.setZoom(v.zoom); } else fit();
  }, [map, viewKey]);

  const goTo = useEffectEvent((id: string) => {
    const i = t.ideas.find(x => x.id === id);
    if (map && i?.lat != null) map.panTo({ lat: i.lat, lng: i.lng! });
  });
  useEffect(() => { if (panTo) goTo(panTo.id); }, [panTo]);

  return (
    <div className="map-card">
      <div className="map-box">
        <div ref={boxRef} className="gmap" role="region" aria-label={`Map of ${t.dest.name}`} />
        <div className="map-ctrl">
          <button type="button" onClick={() => map?.setZoom((map.getZoom() ?? 13) + 1)} aria-label="Zoom in">+</button>
          <button type="button" onClick={() => map?.setZoom((map.getZoom() ?? 13) - 1)} aria-label="Zoom out">−</button>
          <button type="button" onClick={() => { delete GVIEWS[viewKey]; if (map) fitPlaces(map, located, centerOf(t, located)); }} aria-label="Fit to places" title="Fit to places">⤢</button>
        </div>
      </div>
    </div>
  );
}
