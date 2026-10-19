import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import countries from 'i18n-iso-countries';
import type { Database } from 'better-sqlite3';
import type { CultureEntry } from '@/lib/types';

// Phrases and customs per country: the country's Wikivoyage page, summarized by Claude, saved in the
// culture table and reused by every trip to that country. Refresh reruns it; Our notes live on the trip.
export const cultureKey = () => process.env.ANTHROPIC_API_KEY || '';

type Row = Record<string, unknown>;
export function cachedCulture(db: Database, cid: string): CultureEntry | null {
  const r = db.prepare('SELECT * FROM culture WHERE country_code = ? AND trip_id IS NULL ORDER BY id DESC LIMIT 1').get(cid) as Row | undefined;
  if (!r) return null;
  const variant = String(r.language_variant ?? '');
  return {
    lang: variant, variant, note: String(r.intro ?? ''),
    phrases: JSON.parse(String(r.phrases)), dos: JSON.parse(String(r.dos)), donts: JSON.parse(String(r.donts)),
    source: String(r.source_url ?? ''), fetchedAt: String(r.fetched_at ?? ''),
  };
}
function saveCulture(db: Database, cid: string, c: CultureEntry) {
  db.transaction(() => {
    db.prepare('DELETE FROM culture WHERE country_code = ? AND trip_id IS NULL').run(cid);
    db.prepare(`INSERT INTO culture (country_code, language_variant, intro, phrases, dos, donts, source_url, fetched_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(cid, c.variant, c.note, JSON.stringify(c.phrases), JSON.stringify(c.dos), JSON.stringify(c.donts), c.source, c.fetchedAt);
  })();
}

/* ---------- Wikivoyage ---------- */
// the sections a visitor needs for phrases and customs; the rest of the page is sights and transport
const SECTIONS = new Set(['Talk', 'Respect', 'Eat', 'Drink', 'Buy', 'Stay safe']);
const SECTION_MAX = 12000; // characters; a long Eat or Buy section is mostly restaurant and shop detail
const UA = 'Chusay/1.0 (household trip planner; https://github.com/roncanfil/chusay)';

async function wikivoyage(title: string): Promise<{ title: string; text: string } | null> {
  const qs = new URLSearchParams({ action: 'query', prop: 'extracts', explaintext: '1', redirects: '1', titles: title, format: 'json', formatversion: '2' });
  const res = await fetch(`https://en.wikivoyage.org/w/api.php?${qs}`, { headers: { 'User-Agent': UA }, cache: 'no-store' });
  if (!res.ok) throw new Error(`Wikivoyage ${res.status}`);
  const page = (await res.json() as { query?: { pages?: { title: string; missing?: boolean; extract?: string }[] } }).query?.pages?.[0];
  if (!page || page.missing || !page.extract) return null;
  // keep the level-2 sections that matter, each with its subsections
  const parts = page.extract.split(/^== (.+?) ==$/m), kept: string[] = [];
  for (let i = 1; i < parts.length; i += 2) if (SECTIONS.has(parts[i].trim())) kept.push(`## ${parts[i].trim()}\n${parts[i + 1].trim().slice(0, SECTION_MAX)}`);
  return kept.length ? { title: page.title, text: kept.join('\n\n') } : null;
}

/* ---------- Claude ---------- */
const SCHEMA = {
  type: 'object', additionalProperties: false, required: ['variant', 'note', 'phrases', 'dos', 'donts'],
  properties: {
    variant: { type: 'string', description: 'The language visitors meet, as a short label, e.g. "European Portuguese" or "Darija, with French widely spoken"' },
    note: { type: 'string', description: 'Two or three sentences on speaking with people there' },
    phrases: {
      type: 'array', description: 'About ten everyday phrases',
      items: { type: 'object', additionalProperties: false, required: ['en', 'local', 'say'], properties: { en: { type: 'string' }, local: { type: 'string' }, say: { type: 'string', description: 'How to say it, in simple English spelling with the stressed syllable in capitals' } } },
    },
    dos: { type: 'array', items: { type: 'string' }, description: 'Four to six customs worth following' },
    donts: { type: 'array', items: { type: 'string' }, description: 'Three to five things best avoided' },
  },
};
const SYSTEM = `You write the culture notes in a trip planner used by two travelers. From a country's Wikivoyage text, write what a polite visitor should know: the language, everyday phrases, and customs to follow or avoid.
Keep each custom to one plain sentence. Write a "best to avoid" item as the thing itself ("Eating the bread placed on the table unless you want it"), not as an order.
Stick to what the text supports, plus phrases and pronunciations you are sure of. No prices, no opening hours, no restaurant or shop names.`;

interface Out { variant: string; note: string; phrases: { en: string; local: string; say: string }[]; dos: string[]; donts: string[] }

async function summarize(country: string, text: string): Promise<Out> {
  const client = new Anthropic({ apiKey: cultureKey() });
  const msg = await client.beta.messages.create({
    model: 'claude-opus-5-5', max_tokens: 16000,
    // a declined request is retried server-side on Anthropic's recommended fallback model
    betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
    system: SYSTEM,
    messages: [{ role: 'user', content: `Wikivoyage on ${country}:\n\n${text}` }],
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
    const out = await summarize(page.title, page.text);
    const c: CultureEntry = {
      lang: out.variant, variant: out.variant, note: out.note,
      phrases: out.phrases.map(p => [p.en, p.local, p.say]), dos: out.dos, donts: out.donts,
      source: `https://en.wikivoyage.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`, fetchedAt: new Date().toISOString(),
    };
    saveCulture(db, cid, c);
    return c;
  })().finally(() => running.delete(cid));
  running.set(cid, job);
  return job;
}
