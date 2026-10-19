import 'server-only';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import type { StayPreview } from '@/lib/types';

// Reads what a booking-site page shares about itself (its preview tags and listing data) so a pasted
// link shows as a stay with a picture, price and pin. Sites often block this; then the household fills in the rest.

const MAX_BYTES = 2_000_000, MAX_HOPS = 5;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

// the link comes from the household, but the server should still only ever fetch public web pages
function privateIp(ip: string) {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v.startsWith('::ffff:')) return privateIp(v.slice(7));
    return v === '::' || v === '::1' || /^f[cd]/.test(v) || /^fe[89ab]/.test(v);
  }
  const [a, b] = ip.split('.').map(Number);
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
}
async function publicUrl(raw: string) {
  const u = new URL(raw);
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('Only web links can be read');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  const ips = isIP(host) ? [host] : (await lookup(host, { all: true })).map(a => a.address);
  if (!ips.length || ips.some(privateIp)) throw new Error('That link is not a public web page');
  return u;
}

// follows redirects by hand so every hop is checked; reads at most MAX_BYTES of the page
async function fetchPage(raw: string): Promise<{ url: URL; html: string }> {
  let url = await publicUrl(raw);
  for (let hop = 0; hop <= MAX_HOPS; hop++) {
    const res = await fetch(url, { redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(8000), headers: { 'User-Agent': UA, 'Accept': 'text/html', 'Accept-Language': 'en' } });
    const next = res.status >= 300 && res.status < 400 && res.headers.get('location');
    if (next) { url = await publicUrl(new URL(next, url).href); continue; }
    if (!res.ok || !res.body) throw new Error(`The site answered ${res.status}`);
    const reader = res.body.getReader(), parts: Uint8Array[] = [];
    let size = 0;
    while (size < MAX_BYTES) { const { done, value } = await reader.read(); if (done) break; parts.push(value); size += value.length; }
    reader.cancel().catch(() => {});
    return { url, html: new TextDecoder().decode(Buffer.concat(parts)) };
  }
  throw new Error('Too many redirects');
}

const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, '\'').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));

function metaTags(html: string) {
  const out = new Map<string, string>();
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attr = (k: string) => tag.match(new RegExp(`\\b${k}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'));
    const key = attr('property') || attr('name') || attr('itemprop'), val = attr('content');
    if (key && val) { const k = (key[2] ?? key[3]).toLowerCase(); if (!out.has(k)) out.set(k, decode(val[2] ?? val[3])); }
  }
  return out;
}

type Node = Record<string, unknown>;
function ldNodes(html: string): Node[] {
  const out: Node[] = [];
  const walk = (v: unknown) => { if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') { out.push(v as Node); if ('@graph' in v) walk((v as Node)['@graph']); } };
  for (const [, body] of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) { try { walk(JSON.parse(body)); } catch { /* broken JSON-LD is common */ } }
  return out;
}
const LODGING = /hotel|lodging|vacationrental|accommodation|apartment|house|bedandbreakfast|resort|hostel|campground|product|place/i;

const SYMBOL: Record<string, string> = { EUR: '€', USD: '$', GBP: '£', JPY: '¥', MXN: 'MX$', CAD: 'CA$', AUD: 'A$', BRL: 'R$', MAD: 'MAD ' };
const money = (amount: unknown, cur: unknown) => {
  const n = Number(String(amount ?? '').replace(/,/g, ''));
  if (!Number.isFinite(n) || n <= 0) return '';
  const c = String(cur || '').toUpperCase();
  return `${SYMBOL[c] ?? (c ? c + ' ' : '')}${Math.round(n).toLocaleString('en')}`;
};
const priceIn = (text: string) => text.match(/(?:[€$£¥]|\b[A-Z]{3}\s?)\s?\d[\d,.]*/)?.[0].trim() || '';

const coord = (lat: unknown, lng: unknown) => {
  const a = Number(lat), b = Number(lng);
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180 && (a !== 0 || b !== 0) ? { lat: a, lng: b } : null;
};

// "Memmo Alfama, Lisbon (updated prices 2025)" → "Memmo Alfama, Lisbon"; "Loft in Lisbon · ★4.9 · 1 bed" → "Loft in Lisbon"
const tidy = (s: string) => decode(s).split(' · ')[0].replace(/\s*\((?:updated|prices?)[^)]*\)/i, '').replace(/\s*[–—|-]\s*(?:updated \d{4} prices|airbnb|booking\.com|vrbo|expedia|hotels\.com|tripadvisor).*$/i, '').replace(/\s+/g, ' ').trim();

// when the page can't be read, the link itself often names the place: /hotel/pt/memmo-alfama.html → Memmo Alfama
export function nameFromUrl(u: URL) {
  const seg = u.pathname.split('/').filter(Boolean).map(s => decodeURIComponent(s).replace(/\..*$/, '')).reverse().find(s => /[a-z]{3}/i.test(s) && !/^(rooms?|hotel|l|listing|h|en-\w+)$/i.test(s));
  const site = u.hostname.replace(/^www\./, '').split('.')[0];
  return seg ? seg.replace(/[-_+]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : `${site.charAt(0).toUpperCase()}${site.slice(1)} stay`;
}

export function parseListing(html: string, url: URL): StayPreview {
  const meta = metaTags(html), ld = ldNodes(html);
  const main = ld.find(n => LODGING.test(String(n['@type'] ?? '')) && (n.name || n.geo)) || ld.find(n => n.geo) || {};
  const m = (...keys: string[]) => keys.map(k => meta.get(k)).find(Boolean) || '';

  const title = String(main.name || '') || m('og:title', 'twitter:title') || html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || '';
  const name = tidy(title) || nameFromUrl(url);

  const ldImg = main.image, img0 = Array.isArray(ldImg) ? ldImg[0] : ldImg;
  const rawImg = m('og:image', 'og:image:url', 'og:image:secure_url', 'twitter:image') || (typeof img0 === 'string' ? img0 : String((img0 as Node | undefined)?.url || ''));
  let image = '';
  try { const iu = new URL(decode(rawImg), url); if (iu.protocol === 'https:') image = iu.href; } catch { /* no picture */ }

  const offers = (Array.isArray(main.offers) ? main.offers[0] : main.offers) as Node | undefined;
  const price = money(offers?.price ?? offers?.lowPrice, offers?.priceCurrency)
    || money(m('product:price:amount', 'og:price:amount'), m('product:price:currency', 'og:price:currency'))
    || priceIn(String(main.priceRange || ''));

  const geo = main.geo as Node | undefined, pair = (re: RegExp) => { const x = html.match(re); return x ? coord(x[1], x[2]) : null; };
  const at = coord(geo?.latitude, geo?.longitude)
    || coord(m('place:location:latitude', 'og:latitude', 'latitude'), m('place:location:longitude', 'og:longitude', 'longitude'))
    || pair(/data-atlas-latlng="(-?\d+\.\d+),(-?\d+\.\d+)"/)
    || pair(/"lat(?:itude)?"\s*:\s*"?(-?\d{1,2}\.\d{3,})"?\s*,\s*"(?:lng|lon|longitude)"\s*:\s*"?(-?\d{1,3}\.\d{3,})/)
    || pair(/[?&](?:center|markers)=(-?\d+\.\d+)(?:,|%2C)(-?\d+\.\d+)/);

  return { name, image, price, lat: at?.lat ?? null, lng: at?.lng ?? null };
}

// a link that can't be read (blocked, offline, not public) still gives a name from its own words
export async function readListing(raw: string): Promise<StayPreview> {
  const start = new URL(raw);
  if (start.protocol !== 'https:' && start.protocol !== 'http:') throw new Error('Only web links can be read');
  try {
    const { url, html } = await fetchPage(start.href);
    return parseListing(html, url);
  } catch (e) {
    console.warn(`Could not read ${start.hostname}: ${e instanceof Error ? e.message : e}`);
    return { name: nameFromUrl(start), image: '', price: '', lat: null, lng: null };
  }
}
