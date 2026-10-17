import { memo, type ReactNode, type SVGProps } from 'react';
import { CITY } from '@/lib/data/cities';
import { CITY_GEO } from '@/lib/data/city-geo';
import { cityGeo } from '@/lib/map/geo';
import type { CityKey } from '@/lib/types';

// A group anchored at a map point that keeps its screen size while zooming (see scaleFx).
export function Fx({ x, y, cls = '', children, ...rest }: { x: number; y: number; cls?: string; children: ReactNode } & SVGProps<SVGGElement>) {
  return <g className={`fx ${cls}`} data-x={x.toFixed(1)} data-y={y.toFixed(1)} transform={`translate(${x.toFixed(1)},${y.toFixed(1)})`} {...rest}>{children}</g>;
}

// colors go through style so CSS variables (and dark mode) apply
const road = { fill: 'none', vectorEffect: 'non-scaling-stroke', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

// The hand-drawn city sketch: water, land, a 1 km grid, streets, parks, rivers and neighborhood names.
export const CityLayers = memo(function CityLayers({ city, labels = true }: { city: string; labels?: boolean }) {
  const g = cityGeo(city), C = CITY[city as CityKey];
  const pt = (lat: number, lng: number) => g.p(lat, lng).map(n => n.toFixed(1)).join(',');
  const pl = (r: [number, number][]) => r.map(([lat, lng]) => pt(lat, lng)).join(' ');
  const land = CITY_GEO[city].land.map(r => 'M' + r.map(([lng, lat]) => pt(lat, lng)).join('L') + 'Z').join('');
  let grid = '';
  for (let x = 0; x <= g.W; x += g.kmpx) grid += `M${x.toFixed(1)},0V${g.H.toFixed(1)}`;
  for (let y = 0; y <= g.H; y += g.kmpx) grid += `M0,${y.toFixed(1)}H${g.W}`;
  const shore = C.shore && (() => { const f = C.shore[0], l = C.shore[C.shore.length - 1]; return pl([...C.shore, [38.600, l[1]], [38.600, f[1]]]); })();
  return (
    <>
      <rect x="0" y="0" width={g.W} height={g.H} style={{ fill: C.coast ? 'var(--water)' : 'var(--land)' }} />
      <path d={land} style={{ fill: 'var(--land)' }} fillRule="evenodd" />
      <path d={grid} style={{ stroke: 'var(--grid)' }} strokeWidth="1" vectorEffect="non-scaling-stroke" fill="none" />
      {shore && <polygon points={shore} style={{ fill: 'var(--water)' }} />}
      {(C.lanes || []).map((r, n) => <polyline key={`l${n}`} points={pl(r)} {...road} style={{ stroke: 'var(--road)' }} strokeWidth="2.5" />)}
      {(C.streets || []).map((r, n) => <polyline key={`s${n}`} points={pl(r)} {...road} style={{ stroke: 'var(--road)' }} strokeWidth="5" />)}
      {C.parks.map(([lat, lng, rx, ry, n]) => {
        const [x, y] = g.p(lat, lng);
        return (
          <g key={n}>
            <ellipse cx={x.toFixed(1)} cy={y.toFixed(1)} rx={(rx * g.kmpx).toFixed(1)} ry={(ry * g.kmpx).toFixed(1)} style={{ fill: 'var(--park)' }} />
            {labels && <Fx x={x} y={y}><text className="park-label" textAnchor="middle">{n}</text></Fx>}
          </g>
        );
      })}
      {C.rivers.map((r, n) => <polyline key={`r${n}`} points={pl(r)} fill="none" style={{ stroke: 'var(--water)' }} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />)}
      {labels && C.hoods.map(([n, lat, lng]) => { const [x, y] = g.p(lat, lng); return <Fx key={n} x={x} y={y}><text className="hood" textAnchor="middle">{n}</text></Fx>; })}
      {labels && C.waterLabel && (() => { const [n, lat, lng] = C.waterLabel; const [x, y] = g.p(lat, lng); return <Fx x={x} y={y}><text className="park-label" textAnchor="middle" style={{ fontSize: 13 }}>{n}</text></Fx>; })()}
    </>
  );
});
