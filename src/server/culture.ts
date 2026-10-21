import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import countries from 'i18n-iso-countries';
import type { Database } from 'better-sqlite3';
import type { CultureEntry, Quirks } from '@/lib/types';

// Phrases and customs per country: the country's Wikivoyage page, summarized by Claude, saved in the
// culture table and reused by every trip to that country. Refresh reruns it; Our notes live on the trip.
export const cultureKey = () => process.env.ANTHROPIC_API_KEY || '';

type Row = Record<string, unknown>;
// notes saved before the household's own phrase list, Portugal's regional words or American English are redone on next open
const AMERICAN_SINCE = '2026-10-21T23:00:00Z';
const isStale = (cid: string, c: CultureEntry) => c.fetchedAt < AMERICAN_SINCE
  || (STYLE[cid]?.phrases !== false && !c.phrases.some(([en]) => /two beers/i.test(en))) || (!!STYLE[cid]?.regional && !c.regional?.length);

export function cachedCulture(db: Database, cid: string): CultureEntry | null {
  const r = db.prepare('SELECT * FROM culture WHERE country_code = ? AND trip_id IS NULL ORDER BY id DESC LIMIT 1').get(cid) as Row | undefined;
  if (!r) return null;
  const variant = String(r.language_variant ?? '');
  return {
    lang: variant, variant, note: String(r.intro ?? ''),
    phrases: JSON.parse(String(r.phrases)), dos: JSON.parse(String(r.dos)), donts: JSON.parse(String(r.donts)),
    regional: JSON.parse(String(r.regional ?? '[]')),
    source: String(r.source_url ?? ''), fetchedAt: String(r.fetched_at ?? ''),
  };
}
export function cultureFor(db: Database, cid: string): CultureEntry | null {
  const c = cachedCulture(db, cid);
  return c && isStale(cid, c) ? { ...c, stale: true } : c;
}
function saveCulture(db: Database, cid: string, c: CultureEntry) {
  db.transaction(() => {
    db.prepare('DELETE FROM culture WHERE country_code = ? AND trip_id IS NULL').run(cid);
    db.prepare(`INSERT INTO culture (country_code, language_variant, intro, phrases, dos, donts, regional, source_url, fetched_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(cid, c.variant, c.note, JSON.stringify(c.phrases), JSON.stringify(c.dos), JSON.stringify(c.donts), JSON.stringify(c.regional ?? []), c.source, c.fetchedAt);
  })();
}

/* ---------- Wikivoyage ---------- */
// the sections a visitor needs for phrases and customs; the rest of the page is sights and transport
const SECTIONS = new Set(['Talk', 'Respect', 'Eat', 'Drink', 'Buy', 'Stay safe']);
const SECTION_MAX = 12000; // characters; a long Eat or Buy section is mostly restaurant and shop detail
const UA = 'Chusay/1.0 (household trip planner; https://github.com/roncanfil/chusay)';

const wikivoyage = (title: string) => wikivoyagePage(title, SECTIONS);

/* ---------- Claude ---------- */
// the household asked for these in every country, first and in this order
const MUST = ['Hello', 'Thank you', 'I want a beer', 'I want two beers', 'I want wine', 'I want some water', 'Where’s the bathroom?'];
// countries they want shaped differently: they live in Portugal, so no basic phrases or customs, only regional words for beer and coffee
const STYLE: Record<string, { customs: boolean; phrases?: false; note?: string; regional?: string }> = {
  '620': { customs: false, phrases: false, note: 'Two or three sentences on how ordering a beer or a coffee changes around the country', regional: 'how people ask for a beer (a small draught, a large one, a bottle) and for a coffee (an espresso, one with milk, a galão) differ between regions: Lisbon, Porto and the north, the Algarve, Madeira and the Azores. Give each region’s own words, and say where a word would puzzle people elsewhere' },
};

const SAY = { type: 'string', description: 'How to say it, in simple English spelling with the stressed syllable in capitals' };
const schema = (customs: boolean, regional: boolean, phrases: boolean, note = 'Two or three sentences on speaking with people there') => ({
  type: 'object', additionalProperties: false,
  required: ['variant', 'note', ...(phrases ? ['phrases'] : []), ...(customs ? ['dos', 'donts'] : []), ...(regional ? ['regional'] : [])],
  properties: {
    variant: { type: 'string', description: 'The language visitors meet, as a short label, e.g. "European Portuguese" or "Darija, with French widely spoken"' },
    note: { type: 'string', description: note },
    ...(phrases ? { phrases: {
      type: 'array', description: `First exactly these, in this order, with "en" written as given: ${MUST.join('; ')}. Then up to five other everyday phrases`,
      items: { type: 'object', additionalProperties: false, required: ['en', 'local', 'say'], properties: { en: { type: 'string' }, local: { type: 'string' }, say: SAY } },
    } } : {}),
    ...(customs ? {
      dos: { type: 'array', items: { type: 'string' }, description: 'Four to six customs worth following' },
      donts: { type: 'array', items: { type: 'string' }, description: 'Three to five things best avoided' },
    } : {}),
    ...(regional ? {
      regional: {
        type: 'array', description: 'Regional words, one item per word and region',
        items: { type: 'object', additionalProperties: false, required: ['what', 'region', 'local', 'say'], properties: {
          what: { type: 'string', description: 'What you get, in English, e.g. "A small draught beer" or "An espresso"' },
          region: { type: 'string', description: 'Where people say it, e.g. "Lisbon and the south"' },
          local: { type: 'string', description: 'How to ask for it there, e.g. "Uma imperial, por favor"' }, say: SAY,
        } },
      },
    } : {}),
  },
});
const SYSTEM = `You write the culture notes in a trip planner used by two travelers. From a country's Wikivoyage text, write what a polite visitor should know: the language and everyday phrases, and, when asked for, customs to follow or avoid.
Keep each custom to one plain sentence. Write a "best to avoid" item as the thing itself ("Eating the bread placed on the table unless you want it"), not as an order.
Phrases are what a visitor would say: when a phrase changes with the speaker (as "thank you" does in Portuguese), give both forms in "local".
Stick to what the text supports, plus phrases and pronunciations you are sure of. No prices, no opening hours, no restaurant or shop names.
Write in American English spelling and wording (humor, favorite, neighbor, color), whatever the source uses.
Write as advice to the travelers. Never mention the text you were given, Wikivoyage, or what the source does or doesn't cover.`;

interface Out {
  variant: string; note: string; phrases?: { en: string; local: string; say: string }[]; dos?: string[]; donts?: string[];
  regional?: { what: string; region: string; local: string; say: string }[];
}

async function summarize(cid: string, country: string, text: string): Promise<Out> {
  const style = STYLE[cid] ?? { customs: true };
  const client = new Anthropic({ apiKey: cultureKey() });
  const msg = await client.beta.messages.create({
    model: 'claude-sonnet-5-5', max_tokens: 16000,
    // a declined request is retried server-side on Anthropic's recommended fallback model
    betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: schema(style.customs, !!style.regional, style.phrases !== false, style.note) } },
    system: SYSTEM,
    messages: [{ role: 'user', content: `Wikivoyage on ${country}:\n\n${text}${style.regional ? `\n\nAlso list regional words: in ${country}, ${style.regional}.` : ''}` }],
  });
  if (msg.stop_reason === 'refusal') throw new Error('Claude declined to summarize this page');
  if (msg.stop_reason === 'max_tokens') throw new Error('Claude ran out of room summarizing this page');
  const block = msg.content.find(b => b.type === 'text');
  if (!block || block.type !== 'text') throw new Error('Claude returned no text');
  return JSON.parse(block.text) as Out;
}

// one at a time per country, so two open tabs don't pay for the same summary twice
const running = new Map<string, Promise<CultureEntry | null>>();
export function buildCulture(db: Database, cid: string, name: string): Promise<CultureEntry | null> {
  const now = running.get(cid);
  if (now) return now;
  const job = (async () => {
    const alpha2 = countries.numericToAlpha2(cid);
    const titles = [...new Set([name, alpha2 && countries.getName(alpha2, 'en')].filter((t): t is string => !!t))];
    let page = null;
    for (const t of titles) if ((page = await wikivoyage(t))) break;
    if (!page) return null;
    const out = await summarize(cid, page.title, page.text);
    const c: CultureEntry = {
      lang: out.variant, variant: out.variant, note: out.note,
      phrases: (out.phrases ?? []).map(p => [p.en, p.local, p.say]), dos: out.dos ?? [], donts: out.donts ?? [],
      regional: (out.regional ?? []).map(r => [r.what, r.region, r.local, r.say]),
      source: `https://en.wikivoyage.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`, fetchedAt: new Date().toISOString(),
    };
    saveCulture(db, cid, c);
    return c;
  })().finally(() => running.delete(cid));
  running.set(cid, job);
  return job;
}

/* ---------- the trip's own place: quirky local things, saved with the trip ---------- */
const QUIRK_SECTIONS = new Set(['Understand', 'Talk', 'Eat', 'Drink', 'Do', 'Respect', 'Buy', 'Cope']);
const QUIRK_SYSTEM = `You write the "local quirks" in a trip planner used by two travelers who live in Portugal. From a place's Wikivoyage text, pick the quirky, specific, surprising things about that place: local habits, food and drink oddities and what to order, festivals and when they happen, sayings, how people there do everyday things differently, small things locals would smile at a visitor knowing.
Six to eight items. Each has a short title and one or two plain sentences. Skip the obvious sights, prices, opening hours, and restaurant or shop names. Stick to what the text supports.
Write in American English spelling and wording (humor, favorite, neighbor, color), whatever the source uses.
Never mention the text you were given, Wikivoyage, or what the source does or doesn't cover.`;
const QUIRK_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['quirks'],
  properties: { quirks: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['title', 'text'], properties: { title: { type: 'string' }, text: { type: 'string' } } } } },
};

export function cachedQuirks(db: Database, tripId: string): Quirks | null {
  const r = db.prepare('SELECT * FROM culture WHERE trip_id = ? ORDER BY id DESC LIMIT 1').get(tripId) as Row | undefined;
  return r ? { place: String(r.intro ?? ''), items: JSON.parse(String(r.quirks ?? '[]')), source: String(r.source_url ?? ''), fetchedAt: String(r.fetched_at ?? '') } : null;
}

// the sections that matter from a Wikivoyage page, each with its subsections
async function wikivoyagePage(title: string, sections: Set<string>): Promise<{ title: string; text: string } | null> {
  const qs = new URLSearchParams({ action: 'query', prop: 'extracts', explaintext: '1', redirects: '1', titles: title, format: 'json', formatversion: '2' });
  const res = await fetch(`https://en.wikivoyage.org/w/api.php?${qs}`, { headers: { 'User-Agent': UA }, cache: 'no-store' });
  if (!res.ok) throw new Error(`Wikivoyage ${res.status}`);
  const page = (await res.json() as { query?: { pages?: { title: string; missing?: boolean; extract?: string }[] } }).query?.pages?.[0];
  if (!page || page.missing || !page.extract) return null;
  const parts = page.extract.split(/^== (.+?) ==$/m), kept: string[] = [];
  for (let i = 1; i < parts.length; i += 2) if (sections.has(parts[i].trim())) kept.push(`## ${parts[i].trim()}\n${parts[i + 1].trim().slice(0, SECTION_MAX)}`);
  return kept.length ? { title: page.title, text: kept.join('\n\n') } : null;
}

const quirking = new Map<string, Promise<Quirks | null>>();
// the destination's own page first (Porto, the Algarve, Madeira), then its country's
export function buildQuirks(db: Database, trip: { id: string; place: string; country: string; cid: string }): Promise<Quirks | null> {
  const now = quirking.get(trip.id);
  if (now) return now;
  const job = (async () => {
    let page = null;
    for (const t of [...new Set([trip.place, trip.country].filter(Boolean))]) if ((page = await wikivoyagePage(t, QUIRK_SECTIONS))) break;
    if (!page) return null;
    const client = new Anthropic({ apiKey: cultureKey() });
    const msg = await client.beta.messages.create({
      model: 'claude-sonnet-5-5', max_tokens: 8000, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: QUIRK_SCHEMA } },
      system: QUIRK_SYSTEM,
      messages: [{ role: 'user', content: `Wikivoyage on ${page.title}${page.title !== trip.place ? ` (the trip goes to ${trip.place})` : ''}:\n\n${page.text}` }],
    });
    if (msg.stop_reason === 'refusal') throw new Error('Claude declined to summarize this page');
    const block = msg.content.find(b => b.type === 'text');
    if (!block || block.type !== 'text') throw new Error('Claude returned no text');
    const out = JSON.parse(block.text) as { quirks: { title: string; text: string }[] };
    const q: Quirks = { place: trip.place, items: out.quirks.map(x => [x.title, x.text]), source: `https://en.wikivoyage.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`, fetchedAt: new Date().toISOString() };
    db.transaction(() => {
      db.prepare('DELETE FROM culture WHERE trip_id = ?').run(trip.id);
      db.prepare('INSERT INTO culture (trip_id, country_code, intro, quirks, source_url, fetched_at) VALUES (?, ?, ?, ?, ?, ?)').run(trip.id, trip.cid, q.place, JSON.stringify(q.items), q.source, q.fetchedAt);
    })();
    return q;
  })().finally(() => quirking.delete(trip.id));
  quirking.set(trip.id, job);
  return job;
}
