import { useState, type CSSProperties } from 'react';
import { artFor } from '@/lib/art';
import { CATS, ICON, KINDS, type IconKey } from '@/lib/constants';
import { kindPath } from '@/lib/kinds';
import { usePhoto } from '@/lib/photos';
import { useAppState, useConfig } from '@/lib/store';
import { host, isMaps, isUrl } from '@/lib/trips';
import type { PlaceLike } from '@/lib/types';

// CSS custom properties (--cc, --dc, --sc, …) carry the color coding
export const vars = (v: Record<string, string | undefined>) => v as CSSProperties;

const stroke = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export function CatIcon({ cat, cls = 'ic' }: { cat: IconKey; cls?: string }) {
  return <span className={cls} style={vars({ '--cc': KINDS[cat].color })} aria-hidden="true"><svg viewBox="0 0 24 24" {...stroke} strokeWidth="2"><path d={ICON[cat]} /></svg></span>;
}

export function KindIcon({ p, cls = 'ic-sm' }: { p: PlaceLike; cls?: string }) {
  return <span className={cls} style={vars({ '--cc': CATS[p.cat].color })} aria-hidden="true"><svg viewBox="0 0 24 24" {...stroke} strokeWidth="2"><path d={kindPath(p)} /></svg></span>;
}

type Photographed = PlaceLike & { placeId?: string; image?: string };

// list thumbnail: a stay's listing picture, the Google place photo (a drawing for sample places), or the category icon if photos are off;
// big: the wide picture at the top of an opened place
export function Pic({ p, onBroken, big = false }: { p: Photographed; onBroken?: () => void; big?: boolean }) {
  const S = useAppState(), cfg = useConfig();
  const [broken, setBroken] = useState<string | null>(null); // a listing picture that failed to load falls back to the drawing
  const on = S?.prefs.photos !== false, photo = usePhoto(p.placeId, on && !!cfg?.places && !p.image, big ? 640 : 240), ph = big ? 'ph big' : 'ph';
  if (!on) return <CatIcon cat={p.cat} />;
  // eslint-disable-next-line @next/next/no-img-element
  if (p.image && broken !== p.image) return <span className={ph}><img src={p.image} alt={`Picture of ${p.name}`} loading="lazy" referrerPolicy="no-referrer" onError={() => { setBroken(p.image!); onBroken?.(); }} /></span>;
  if (photo) {
    // a remote Google photo of unknown size; next/image would add nothing here
    // eslint-disable-next-line @next/next/no-img-element
    return <span className={ph}><img src={photo.uri} alt={`Photo of ${p.name}`} title={photo.author ? `Photo: ${photo.author}` : undefined} loading="lazy" referrerPolicy="no-referrer" /></span>;
  }
  if (photo === undefined && p.placeId && cfg?.places) return <span className={ph} aria-hidden="true" />;
  return <span className={ph} role="img" aria-label={`Photo of ${p.name}`}><svg viewBox="0 0 64 64" preserveAspectRatio="xMidYMid slice" aria-hidden="true" dangerouslySetInnerHTML={{ __html: artFor(p) }} /></span>;
}

// Google requires the photographer's name wherever their photo is shown; opened rows show it in full
export function PhotoCredit({ p }: { p: Photographed }) {
  const S = useAppState(), cfg = useConfig();
  const photo = usePhoto(p.placeId, S?.prefs.photos !== false && !!cfg?.places);
  if (!photo?.author) return null;
  return <span className="photo-credit">Photo: {photo.authorUri ? <a href={photo.authorUri} target="_blank" rel="noopener noreferrer">{photo.author}</a> : photo.author}</span>;
}

export const LinkSvg = () => <svg viewBox="0 0 24 24" {...stroke} strokeWidth="2.2" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" /></svg>;
export const TalkSvg = () => <svg viewBox="0 0 24 24" {...stroke} strokeWidth="2.2" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12z" /></svg>;
export const PinSvg = () => <svg viewBox="0 0 24 24" {...stroke} strokeWidth="2.2" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>;
export const MapSegIcon = () => <svg viewBox="0 0 24 24" {...stroke} strokeWidth="2" aria-hidden="true"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14" /></svg>;
export const ListSegIcon = () => <svg viewBox="0 0 24 24" {...stroke} strokeWidth="2" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" /></svg>;

// where an idea came from: a link (blog, video, post) opens it; plain text is who told us
export function SrcChip({ v }: { v?: string }) {
  const s = (v || '').trim(); if (!s) return null;
  if (isMaps(s)) return <a className="src maps" href={s} target="_blank" rel="noopener noreferrer" title={s}><PinSvg /><span>Google Maps</span></a>;
  if (isUrl(s)) return <a className="src" href={s} target="_blank" rel="noopener noreferrer" title={s}><LinkSvg /><span>{host(s)}</span></a>;
  return <span className="src said"><TalkSvg /><span>{s}</span></span>;
}
