// Pan / zoom for the SVG sketch maps. The real app uses Google Maps; this keeps the preview's maps working.
export interface View { x: number; y: number; w: number; h?: number }
export interface Bounds { x: number; y: number; w: number; h: number }
export interface PanZoom {
  zoom(f: number, cx?: number, cy?: number): void;
  apply(): void;
  center(x: number, y: number): void;
  reset(): void;
  all(): void;
  dragging(): boolean;
  destroy(): void;
}

// last view per map key, so a map keeps its place when the page redraws
export const VIEWS: Record<string, View> = {};
// the same for Google maps: center and zoom per map key
export const GVIEWS: Record<string, { lat: number; lng: number; zoom: number }> = {};
export const clearViews = () => { for (const v of [VIEWS, GVIEWS]) Object.keys(v).forEach(k => delete v[k]); };

export function svgPoint(svg: SVGSVGElement, e: MouseEvent) {
  const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
  return p.matrixTransform(svg.getScreenCTM()!.inverse());
}

export function fitTo(points: [number, number][], aspect: number, minW: number): View | null {
  if (!points.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of points) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  let w = Math.max((x1 - x0) * 1.3 + 90, minW); const h = (y1 - y0) * 1.3 + 90;
  w = Math.max(w, h * aspect);
  return { x: (x0 + x1) / 2 - w / 2, y: (y0 + y1) / 2 - w / aspect / 2, w };
}

export function panZoom(svg: SVGSVGElement, key: string, bounds: Bounds, initial: View | null, onChange?: (v: View, k: number) => void): PanZoom {
  // the aspect follows the element, so dragging the list/map divider keeps the map undistorted
  const aspect = () => svg.clientWidth / Math.max(1, svg.clientHeight) || 1.4;
  const maxW = () => Math.min(bounds.w, bounds.h * aspect());
  const home = (): View => ({ ...(initial || { x: bounds.x + (bounds.w - maxW()) / 2, y: bounds.y, w: maxW() }) });
  let v: View = VIEWS[key] ? { ...VIEWS[key] } : home();
  function clamp() {
    const mw = maxW();
    v.w = Math.min(mw, Math.max(mw / 14, v.w)); v.h = v.w / aspect();
    v.x = Math.min(bounds.x + bounds.w - v.w, Math.max(bounds.x, v.x));
    v.y = Math.min(bounds.y + bounds.h - v.h, Math.max(bounds.y, v.y));
  }
  function apply() {
    if (!svg.clientWidth) return;
    clamp(); VIEWS[key] = { x: v.x, y: v.y, w: v.w };
    svg.setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.h}`);
    onChange?.(v, v.w / svg.clientWidth);
  }
  function zoom(f: number, cx?: number, cy?: number) {
    if (cx == null || cy == null) { cx = v.x + v.w / 2; cy = v.y + v.h! / 2; }
    const mw = maxW(), nw = Math.min(mw, Math.max(mw / 14, v.w / f)), r = nw / v.w;
    v.x = cx - (cx - v.x) * r; v.y = cy - (cy - v.y) * r; v.w = nw; apply();
  }
  let drag: { x: number; y: number; vx: number; vy: number } | null = null, moved = 0;
  const down = (e: PointerEvent) => { if (e.button) return; drag = { x: e.clientX, y: e.clientY, vx: v.x, vy: v.y }; moved = 0; };
  const move = (e: PointerEvent) => {
    if (!drag || !svg.isConnected) return;
    const k = v.w / svg.clientWidth, dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) moved = Date.now();
    v.x = drag.vx - dx * k; v.y = drag.vy - dy * k; apply();
  };
  const up = () => { drag = null; };
  const dbl = (e: MouseEvent) => { const p = svgPoint(svg, e); zoom(2, p.x, p.y); };
  const ro = new ResizeObserver(() => apply());
  svg.addEventListener('pointerdown', down); svg.addEventListener('dblclick', dbl);
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  ro.observe(svg);
  apply();
  return {
    zoom, apply,
    center(x, y) { v.x = x - v.w / 2; v.y = y - v.h! / 2; apply(); },
    reset() { v = home(); apply(); },
    all() { v = { x: bounds.x, y: bounds.y, w: maxW() }; apply(); },
    dragging: () => Date.now() - moved < 250,
    destroy() {
      svg.removeEventListener('pointerdown', down); svg.removeEventListener('dblclick', dbl);
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      ro.disconnect();
    },
  };
}

// map labels and pins keep their screen size while the map zooms
export function scaleFx(svg: SVGSVGElement, k: number) {
  svg.querySelectorAll<SVGGElement>('.fx').forEach(el => el.setAttribute('transform', `translate(${el.dataset.x},${el.dataset.y}) scale(${k})`));
}

// hide labels that would sit on another pin or label; try the left side before giving up
export function declutter(svg: SVGSVGElement) {
  const labs = [...svg.querySelectorAll<SVGGElement>('.plab')]; if (!labs.length) return;
  const vb = svg.getBoundingClientRect();
  type Box = { l: number; t: number; r: number; b: number };
  const box = (el: Element): Box => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };
  const taken = [...svg.querySelectorAll('.pin:not(.dim) circle.dot')].map(box);
  const ctrl = svg.parentElement?.querySelector('.map-ctrl'); if (ctrl) taken.push(box(ctrl));
  const free = (r: Box) => r.l >= vb.left + 2 && r.r <= vb.right - 2 && r.t >= vb.top && r.b <= vb.bottom && !taken.some(o => r.l < o.r && r.r > o.l && r.t < o.b && r.b > o.t);
  labs.sort((a, b) => Number(b.classList.contains('hl')) - Number(a.classList.contains('hl')));
  for (const l of labs) {
    const tx = l.firstElementChild as SVGTextElement; l.style.visibility = '';
    tx.setAttribute('x', '16'); tx.setAttribute('text-anchor', 'start'); let r = box(tx);
    if (!free(r)) { tx.setAttribute('x', '-16'); tx.setAttribute('text-anchor', 'end'); r = box(tx); }
    if (free(r) || l.classList.contains('hl')) taken.push(r); else l.style.visibility = 'hidden';
  }
}
