import worldData from '@/lib/data/world.json';
import type { Trip } from '@/lib/types';
import { Thumb } from './Thumb';

// the trip tiles' picture: the outline of the country, in the tile's color, with its neighbors faint around it
const WORLD = worldData as { c: { id: string; n: string; d: string }[] };
type Box = [number, number, number, number]; // x0, y0, x1, y1

// each piece of a country (mainland, islands) with its box; the paths only use M, L and Z
function pieces(d: string): Box[] {
  return d.split('M').filter(Boolean).map(p => {
    const n = p.replace(/Z/g, '').split(/L/).map(xy => xy.split(',').map(Number));
    const xs = n.map(v => v[0]), ys = n.map(v => v[1]);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  });
}
const area = (b: Box) => (b[2] - b[0]) * (b[3] - b[1]);
const near = (a: Box, b: Box, gap: number) => b[0] < a[2] + gap && b[2] > a[0] - gap && b[1] < a[3] + gap && b[3] > a[1] - gap;

// framed on the mainland and whatever lies close to it, so the Azores don't shrink Portugal to a dot
const frames = new Map<string, Box | null>();
function frameOf(cid: string): Box | null {
  if (frames.has(cid)) return frames.get(cid)!;
  const c = WORLD.c.find(x => x.id === cid);
  let box: Box | null = null;
  if (c) {
    const ps = pieces(c.d).sort((a, b) => area(b) - area(a));
    box = [...ps[0]];
    const gap = Math.max(box[2] - box[0], box[3] - box[1]) * 0.6;
    for (const p of ps.slice(1)) if (near(box, p, gap)) box = [Math.min(box[0], p[0]), Math.min(box[1], p[1]), Math.max(box[2], p[2]), Math.max(box[3], p[3])];
  }
  frames.set(cid, box); return box;
}
const boxes = new Map<string, Box>();
const boxOf = (c: { id: string; d: string }) => boxes.get(c.id) ?? (boxes.set(c.id, pieces(c.d).reduce((a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])])), boxes.get(c.id)!);

export function CountryThumb({ t }: { t: Trip }) {
  const f = frameOf(t.dest.cid);
  if (!f) return <Thumb t={t} />; // the preview's sample places without a country on the map
  // a little room around it, wider than tall like the tile's picture, and set a bit low, under the tile's tag
  const A = 1.35, pad = Math.max(f[2] - f[0], (f[3] - f[1]) * A, 2) * 0.08;
  const cw = f[2] - f[0] + pad * 2, ch = f[3] - f[1] + pad * 2;
  const h = Math.max(ch / 0.8, cw / A), w = h * A;
  const x = (f[0] + f[2] - w) / 2, y = (f[1] + f[3]) / 2 - h * 0.57, view: Box = [x, y, x + w, y + h];
  // the whole country always shows, toward the right on wide tiles so the tag on the left stays clear of it;
  // the neighbors fill whatever room the tile has beyond the frame
  const others = WORLD.c.filter(c => c.id !== t.dest.cid && near(view, boxOf(c), w));
  const stroke = (w / 260).toFixed(2);
  return (
    <svg className="thumb shape" preserveAspectRatio="xMaxYMid meet" viewBox={`${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}`} aria-hidden="true">
      {others.map(c => <path key={c.id} d={c.d} className="shape-near" strokeWidth={stroke} />)}
      <path d={WORLD.c.find(c => c.id === t.dest.cid)!.d} className="shape-own" strokeWidth={stroke} />
    </svg>
  );
}
