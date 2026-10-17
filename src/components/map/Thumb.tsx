import { CATS } from '@/lib/constants';
import { cityGeo } from '@/lib/map/geo';
import { fitTo } from '@/lib/map/panzoom';
import { hasMap, located } from '@/lib/trips';
import type { Trip } from '@/lib/types';
import { CityLayers } from './CityLayers';

// small map of a trip's saved places, for the trip tiles
export function Thumb({ t }: { t: Trip }) {
  const pts = located(t);
  if (!pts.length) return <span className="thumb blank" aria-hidden="true">{t.dest.name[0]}</span>;
  if (!hasMap(t)) return <DotsThumb t={t} />;
  const g = cityGeo(t.city!);
  const A = 1.35, v = fitTo(pts.map(i => g.p(i.lat!, i.lng!)), A, g.W / 6)!;
  v.w = Math.min(v.w * 1.1, g.W, g.H * A); const h = v.w / A;
  v.x = Math.max(0, Math.min(g.W - v.w, v.x)); v.y = Math.max(0, Math.min(g.H - h, v.y));
  const r = v.w / 34;
  return (
    <svg className="thumb" preserveAspectRatio="xMidYMid slice" viewBox={`${v.x.toFixed(1)} ${v.y.toFixed(1)} ${v.w.toFixed(1)} ${h.toFixed(1)}`} aria-hidden="true">
      <CityLayers city={t.city!} labels={false} />
      {pts.map(i => { const [x, y] = g.p(i.lat!, i.lng!); return <circle key={i.id} cx={x.toFixed(1)} cy={y.toFixed(1)} r={r.toFixed(1)} style={{ fill: CATS[i.cat].color, stroke: 'var(--surface)' }} strokeWidth={(r / 3).toFixed(1)} />; })}
    </svg>
  );
}

// anywhere without a sketch map: the places as category dots on a plain grid, roughly to scale
function DotsThumb({ t }: { t: Trip }) {
  const pts = located(t), lat0 = pts.reduce((a, i) => a + i.lat!, 0) / pts.length, k = Math.cos(lat0 * Math.PI / 180);
  const xy = pts.map(i => [i.lng! * k, -i.lat!] as [number, number]);
  const xs = xy.map(p => p[0]), ys = xy.map(p => p[1]), A = 1.35;
  const w = Math.max(Math.max(...xs) - Math.min(...xs), (Math.max(...ys) - Math.min(...ys)) * A, 0.01) * 1.4, h = w / A, r = w / 34;
  const x = (Math.max(...xs) + Math.min(...xs) - w) / 2, y = (Math.max(...ys) + Math.min(...ys) - h) / 2;
  return (
    <svg className="thumb" preserveAspectRatio="xMidYMid slice" viewBox={`${x} ${y} ${w} ${h}`} aria-hidden="true">
      <rect x={x} y={y} width={w} height={h} style={{ fill: 'var(--land)' }} />
      {pts.map((i, n) => <circle key={i.id} cx={xy[n][0]} cy={xy[n][1]} r={r} style={{ fill: CATS[i.cat].color, stroke: 'var(--surface)' }} strokeWidth={r / 3} />)}
    </svg>
  );
}
