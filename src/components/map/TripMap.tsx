'use client';

import { useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef } from 'react';
import { CATS } from '@/lib/constants';
import { kindLabel, kindPath, short } from '@/lib/kinds';
import { cityGeo } from '@/lib/map/geo';
import { declutter, fitTo, panZoom, scaleFx, VIEWS, type PanZoom } from '@/lib/map/panzoom';
import { useConfig } from '@/lib/store';
import { hasMap } from '@/lib/trips';
import type { Idea, Trip } from '@/lib/types';
import { CityLayers, Fx } from './CityLayers';
import { GoogleMap, useMapsFailed } from './GoogleMap';

export interface MapPlace { idea: Idea; dim?: boolean; color?: string; icon?: string } // color and icon: Muhu's own categories
export interface MapRoute { color: string; ideas: Idea[] }
export interface PanRequest { id: string; seq: number }

export interface MapProps {
  t: Trip;
  places: MapPlace[];
  routes: MapRoute[];
  viewKey: string;
  hl: string | null;
  panTo: PanRequest | null;
  onPin: (ideaId: string) => void;
  onMove?: (ideaId: string, lat: number, lng: number) => void; // Google maps only: the highlighted pin can be dragged
}

// Google Maps when the server has a browser key; otherwise the preview's sketch maps
export function TripMap(props: MapProps) {
  const cfg = useConfig(), failed = useMapsFailed();
  if (cfg?.mapsKey && !failed) return <GoogleMap {...props} mapsKey={cfg.mapsKey} mapId={cfg.mapId} />;
  const why = 'Google Maps didn’t load. Check the browser key and the domains it allows in Google Cloud.';
  if (!hasMap(props.t)) return <div className="map-card"><div className="nomap">{failed ? why : 'The preview only has maps for Lisbon, Mexico City and Kyoto. In the real app every place you save shows up on Google Maps.'}</div></div>;
  return <SketchMap {...props} credit={failed ? `${why} Showing the sketch map.` : undefined} />;
}

// Sketch map of the trip's city with category pins, name labels and day routes. The real app uses Google Maps.
function SketchMap({ t, places, routes, viewKey, hl, panTo, onPin, credit }: MapProps & { credit?: string }) {
  const city = t.city!;
  const g = useMemo(() => cityGeo(city), [city]);
  const svgRef = useRef<SVGSVGElement>(null), barRef = useRef<HTMLElement>(null), lblRef = useRef<HTMLSpanElement>(null);
  const api = useRef<PanZoom | null>(null);
  const pl = places.filter(p => p.idea.lat != null);
  const xy = (i: Idea) => g.p(i.lat!, i.lng!);

  const initialView = useEffectEvent((svg: SVGSVGElement) => fitTo(pl.map(p => xy(p.idea)), svg.clientWidth / Math.max(1, svg.clientHeight) || 1.4, g.W / 6));
  useLayoutEffect(() => {
    const svg = svgRef.current!;
    const m = panZoom(svg, viewKey, { x: 0, y: 0, w: g.W, h: g.H }, initialView(svg), (_v, k) => {
      scaleFx(svg, k); declutter(svg);
      const pxPerKm = g.kmpx / k, km = [0.25, 0.5, 1, 2, 5].filter(c => c * pxPerKm <= 110).pop() || 0.25;
      if (barRef.current && lblRef.current) { barRef.current.style.width = (km * pxPerKm).toFixed(0) + 'px'; lblRef.current.textContent = km < 1 ? km * 1000 + ' m' : km + ' km'; }
    });
    api.current = m;
    return () => { m.destroy(); api.current = null; };
  }, [viewKey, g]);
  // new pins and labels need scaling and decluttering after every render
  useLayoutEffect(() => { api.current?.apply(); });

  const centerOn = useEffectEvent((id: string) => {
    const i = t.ideas.find(x => x.id === id);
    if (i && i.lat != null) { const [x, y] = xy(i); api.current?.center(x, y); }
  });
  useEffect(() => { if (panTo) centerOn(panTo.id); }, [panTo]);

  const fit = () => { delete VIEWS[viewKey]; api.current?.reset(); };
  const pin = (id: string) => { if (!api.current?.dragging()) onPin(id); };

  return (
    <div className="map-card">
      <div className="map-box">
        <svg ref={svgRef} viewBox={`0 0 ${g.W} ${g.H}`} role="img" aria-label={`Map of ${t.dest.name}`}>
          <CityLayers city={city} />
          {routes.map((r, n) => {
            const q = r.ideas.filter(i => i.lat != null);
            return q.length > 1 && <polyline key={n} points={q.map(i => xy(i).map(v => v.toFixed(1)).join(',')).join(' ')} fill="none" stroke={r.color} strokeWidth="3.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" opacity=".85" />;
          })}
          {pl.map(({ idea: i, dim }) => {
            const [x, y] = xy(i);
            return (
              <Fx key={i.id} x={x} y={y} cls={`pin ${dim ? 'dim' : ''} ${hl === i.id ? 'hl' : ''}`} onClick={() => pin(i.id)}>
                <circle className="halo" r="15" />
                <circle className="dot" r="12" style={{ fill: CATS[i.cat].color }} />
                <path d={kindPath(i)} transform="translate(-7,-7) scale(.5833)" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                <title>{`${i.name} · ${kindLabel(i)}`}</title>
              </Fx>
            );
          })}
          {pl.filter(p => !p.dim).map(({ idea: i }) => {
            const [x, y] = xy(i);
            return <Fx key={i.id} x={x} y={y} cls={`plab ${hl === i.id ? 'hl' : ''}`}><text className="pin-label" x="16" y="4">{hl === i.id ? i.name : short(i.name)}</text></Fx>;
          })}
        </svg>
        <div className="map-ctrl">
          <button type="button" onClick={() => api.current?.zoom(1.6)} aria-label="Zoom in">+</button>
          <button type="button" onClick={() => api.current?.zoom(0.625)} aria-label="Zoom out">−</button>
          <button type="button" onClick={fit} aria-label="Fit to places" title="Fit to places">⤢</button>
        </div>
        <div className="scalebar"><span ref={lblRef}>1 km</span><i ref={barRef} /></div>
      </div>
      <div className="map-credit">{credit || 'Sketch map for the preview. The real app uses Google Maps.'}</div>
    </div>
  );
}
