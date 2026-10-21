import { WANT } from './constants';
import { findAnywhere } from './search';
import { editMuhu } from './store';
import { uid } from './seed';
import type { MuhuCat, MuhuIdea, Want } from './types';

// lowercase without accents, so "Áustria" finds Austria and "Piódão" matches "Piodão"
export const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// most wanted first, then in the order they were saved
const RANK: Record<Want, number> = { high: 0, med: 1, '': 2, low: 3 };
export const byWant = (a: MuhuIdea, b: MuhuIdea) => RANK[a.want] - RANK[b.want];
export const mainCat = (m: MuhuIdea): MuhuCat => m.cats[0] || 'other';
export const catsOf = (m: MuhuIdea): MuhuCat[] => m.cats.length ? m.cats : ['other'];
export const wantLabel = (w: Want) => w ? WANT[w] : '';

/* ---------- reading a CSV, quotes and line breaks inside cells included ---------- */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], cell = '', q = false;
  text = text.replace(/^﻿/, '');
  for (let n = 0; n < text.length; n++) {
    const c = text[n];
    if (q) {
      if (c === '"' && text[n + 1] === '"') { cell += '"'; n++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[n + 1] === '\n') n++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

/* ---------- a Notion table exported as CSV: columns are found by their names ---------- */
const COLS: [keyof Cols, RegExp][] = [
  ['name', /^(name|title|place)$/], ['cats', /categor|^tags?$|^type$/], ['want', /desire|priority|interest|want/], ['area', /location|^area$|^where$|city|region/],
  ['address', /address/], ['note', /^text$|note|descr|comment/], ['links', /link|url|source|website/], ['when', /when|season|month/],
  ['dates', /date/], ['directions', /direction/], ['far', /transport|getting|distance|from /], ['kind', /^kind$/],
];
type Cols = Record<'name' | 'cats' | 'want' | 'area' | 'address' | 'note' | 'links' | 'when' | 'dates' | 'directions' | 'far' | 'kind', number[]>;

// Notion's own categories, by keyword; anything else (like "in Porto" or "Madeira") is a region and goes with the area
const CAT_WORDS: [MuhuCat, RegExp][] = [
  ['outdoors', /outdoor|nature|beach|hik|trail|water/], ['food', /food|drink|restaurant|cafe|\bbar\b|\beat/], ['built', /architect|rural|village|castle|building|histor/],
  ['events', /special|festiv|event|occasion|holiday|celebrat|carnaval/], ['fun', /^fun|activit|adventure/], ['culture', /cultur|museum|\bart\b|music/],
  ['kids', /kid|crian|child|famil/], ['shop', /shop|market/], ['other', /^other|misc/],
];
function wantOf(v: string): Want {
  const w = plain(v);
  if (!w) return '';
  if (/^(high|must|top)/.test(w)) return 'high';
  if (/^(low|if nearby|maybe)/.test(w)) return 'low';
  return 'med'; // Med-high, Med, Med-low
}
const split = (v: string) => v.split(/,\s*/).map(x => x.trim()).filter(Boolean);
const isLink = (v: string) => /^https?:\/\//i.test(v) || /^[\w-]+\.[a-z]{2,}(\/|$)/i.test(v);
const useful = (v: string) => !!v && !/^n\/?a$/i.test(v);

// what an import would do: new ideas, saved ones whose blanks it fills in, and whether the file had more than names
export interface ImportResult { ideas: MuhuIdea[]; filled: MuhuIdea[]; skipped: number; moved: number; namesOnly: boolean }

// fills only what's still empty in a saved idea, so nothing typed in the app is overwritten
function fillBlanks(m: MuhuIdea, x: MuhuIdea): MuhuIdea | null {
  const out = { ...m, cats: m.cats.length ? m.cats : x.cats, want: m.want || x.want, area: m.area || x.area, when: m.when || x.when, far: m.far || x.far, note: m.note || x.note, ...(m.source || x.source ? { source: m.source || x.source } : {}) };
  return (Object.keys(out) as (keyof MuhuIdea)[]).some(k => out[k] !== m[k]) ? out : null;
}

// countries: [cid, name] from the world map; names found in a row's name or location move it to that country
export function fromNotion(text: string, home: { cid: string; country: string }, have: MuhuIdea[], countries: (readonly [string, string])[]): ImportResult {
  const [head, ...rows] = parseCsv(text);
  if (!head) return { ideas: [], filled: [], skipped: 0, moved: 0, namesOnly: true };
  const col = Object.fromEntries(COLS.map(([k]) => [k, [] as number[]])) as Cols;
  head.forEach((h, n) => { const hit = COLS.find(([, re]) => re.test(plain(h))); if (hit) col[hit[0]].push(n); });
  if (!col.name.length) col.name.push(0);
  const saved = new Map(have.map(m => [`${m.cid}|${plain(m.name)}`, m])), seen = new Set<string>();
  // accents count here, so "Mação" doesn't read as Macao
  const named = countries.map(([cid, n]) => [cid, n, new RegExp(`\\b${n.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)] as const);
  const out: MuhuIdea[] = [], filled: MuhuIdea[] = []; let skipped = 0, moved = 0;
  for (const r of rows) {
    const get = (k: keyof Cols) => col[k].map(n => (r[n] || '').trim()).filter(useful);
    const name = get('name')[0];
    if (!name) continue;
    const cats: MuhuCat[] = [], regions: string[] = [];
    for (const c of get('cats').flatMap(split)) {
      const hit = CAT_WORDS.find(([, re]) => re.test(plain(c)));
      if (hit) { if (!cats.includes(hit[0])) cats.push(hit[0]); } else regions.push(c.replace(/^in\s+/i, ''));
    }
    const links = get('links').flatMap(split).filter(isLink), address = get('address').filter(a => !isLink(a));
    const dirs = get('directions'), dirLinks = dirs.filter(isLink);
    let area = get('area')[0] || address[0] || '';
    for (const g of regions) if (!plain(area).includes(plain(g))) area = area ? `${area}, ${g}` : g;
    const source = links[0] || dirLinks[0] || '';
    const note = [
      ...get('note'),
      ...(address.length && address[0] !== area ? [`Address: ${address[0]}`] : []),
      ...get('kind').map(k => `Kind: ${k}`),
      ...links.filter(l => l !== source), ...dirLinks.filter(l => l !== source).map(l => `Directions: ${l}`),
    ].join('\n');
    const far = [...dirs.filter(d => !isLink(d)), ...col.far.flatMap(n => useful((r[n] || '').trim()) ? [`${head[n].trim().replace(/^./, c => c.toUpperCase())}: ${r[n].trim()}`] : [])].join(' · ');
    const when = [...get('when'), ...get('dates')].filter((v, n, a) => a.indexOf(v) === n).join(' · ');
    // "Islas Cies (Spain)" or "Áustria" belong to another country than the one being imported
    const where = `${name} ${get('area').join(' ')}`.toLowerCase();
    const other = named.find(([cid, , re]) => cid !== home.cid && re.test(where));
    const cid = other ? other[0] : home.cid, country = other ? other[1] : home.country;
    const key = `${cid}|${plain(name)}`;
    if (seen.has(key)) { skipped++; continue; }
    seen.add(key);
    const idea: MuhuIdea = { id: uid(), cid, country, name, cats, want: wantOf(get('want')[0] || ''), area, when, far, note, ...(source ? { source } : {}) };
    const was = saved.get(key);
    if (was) { const f = fillBlanks(was, idea); if (f) filled.push(f); else skipped++; continue; }
    if (other) moved++;
    out.push(idea);
  }
  const namesOnly = (Object.keys(col) as (keyof Cols)[]).every(k => k === 'name' || !col[k].length);
  return { ideas: out, filled, skipped, moved, namesOnly };
}

/* ---------- a Notion export arrives as a .zip (sometimes one inside another); its CSVs are read without a library ---------- */
async function csvsInZip(buf: ArrayBuffer): Promise<string[]> {
  const v = new DataView(buf), u8 = new Uint8Array(buf), out: string[] = [];
  let end = buf.byteLength - 22;
  while (end >= 0 && v.getUint32(end, true) !== 0x06054b50) end--;
  if (end < 0) throw new Error('Not a zip file');
  let p = v.getUint32(end + 16, true);
  for (let n = v.getUint16(end + 10, true); n > 0; n--) {
    const method = v.getUint16(p + 10, true), size = v.getUint32(p + 20, true), nl = v.getUint16(p + 28, true), local = v.getUint32(p + 42, true);
    const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nl));
    p += 46 + nl + v.getUint16(p + 30, true) + v.getUint16(p + 32, true);
    if (!/\.(csv|zip)$/i.test(name) || (method !== 0 && method !== 8)) continue;
    const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    const raw = u8.slice(start, start + size);
    const data = method === 8 ? await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer() : raw.buffer;
    if (/\.zip$/i.test(name)) out.push(...await csvsInZip(data)); else out.push(new TextDecoder().decode(data));
  }
  return out;
}

// Notion exports the visible columns and, in a file ending in _all, every column: the widest CSV wins
export async function readExport(file: File): Promise<string> {
  if (!/\.zip$/i.test(file.name) && file.type !== 'application/zip') return file.text();
  const csvs = await csvsInZip(await file.arrayBuffer());
  if (!csvs.length) throw new Error('No list in this zip');
  const width = (t: string) => parseCsv(t.slice(0, t.indexOf('\n') + 1 || undefined))[0]?.length ?? 0;
  return csvs.reduce((a, b) => width(b) > width(a) ? b : a);
}

/* ---------- Google: each idea is looked up once by its name and area; a wrong guess is fixed by hand ---------- */
export const placeQuery = (m: MuhuIdea) => [m.name, m.area, m.country].filter(Boolean).join(', ');
export const mapsUrl = (m: MuhuIdea) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeQuery(m))}${m.placeId ? '&query_place_id=' + encodeURIComponent(m.placeId) : ''}`;

let guessing = false, stopped = false;
export async function guessPlaces(list: MuhuIdea[]) {
  if (guessing || stopped) return;
  const todo = list.filter(m => !m.match && !m.placeId);
  if (!todo.length) return;
  guessing = true;
  let n = 0;
  const work = async () => {
    while (n < todo.length && !stopped) {
      const m = todo[n++], hit = (await findAnywhere(placeQuery(m)))[0];
      editMuhu(m.id, x => {
        if (x.match || x.placeId) return; // picked by hand meanwhile
        if (hit?.placeId) { x.placeId = hit.placeId; x.lat = hit.lat; x.lng = hit.lng; x.match = 'auto'; } else x.match = 'none';
      });
    }
  };
  // a few at a time; if Google says no (key, quota), stop until the next visit
  await Promise.all([work(), work(), work()]).catch(() => { stopped = true; });
  guessing = false;
}

/* ---------- our own pictures: shrunk in the browser to a JPEG of at most 1600px, then kept on the server ---------- */
export async function uploadPhoto(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  const jpeg = await new Promise<Blob>((ok, no) => c.toBlob(b => b ? ok(b) : no(new Error('Couldn’t read that picture')), 'image/jpeg', 0.85));
  const r = await fetch('/api/muhu/photos', { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: jpeg });
  if (!r.ok) throw new Error(((await r.json().catch(() => null)) as { error?: string } | null)?.error || 'Upload failed');
  return ((await r.json()) as { url: string }).url;
}
