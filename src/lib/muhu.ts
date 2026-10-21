import { WANT } from './constants';
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

export interface ImportResult { ideas: MuhuIdea[]; skipped: number; moved: number }

// countries: [cid, name] from the world map; names found in a row's name or location move it to that country
export function fromNotion(text: string, home: { cid: string; country: string }, have: MuhuIdea[], countries: (readonly [string, string])[]): ImportResult {
  const [head, ...rows] = parseCsv(text);
  if (!head) return { ideas: [], skipped: 0, moved: 0 };
  const col = Object.fromEntries(COLS.map(([k]) => [k, [] as number[]])) as Cols;
  head.forEach((h, n) => { const hit = COLS.find(([, re]) => re.test(plain(h))); if (hit) col[hit[0]].push(n); });
  if (!col.name.length) col.name.push(0);
  const seen = new Set(have.map(m => `${m.cid}|${plain(m.name)}`));
  // accents count here, so "Mação" doesn't read as Macao
  const named = countries.map(([cid, n]) => [cid, n, new RegExp(`\\b${n.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)] as const);
  const out: MuhuIdea[] = []; let skipped = 0, moved = 0;
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
    seen.add(key); if (other) moved++;
    out.push({ id: uid(), cid, country, name, cats, want: wantOf(get('want')[0] || ''), area, when, far, note, ...(source ? { source } : {}) });
  }
  return { ideas: out, skipped, moved };
}
