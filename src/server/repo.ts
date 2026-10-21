import 'server-only';
import type { Database } from 'better-sqlite3';
import type { AppState, Cat, CityKey, MuhuCat, MuhuIdea, Pace, Prefs, Status, Trip, Visit, Vote, Want } from '@/lib/types';

type Row = Record<string, unknown>;
const json = <T,>(v: unknown, fallback: T): T => { try { return v == null ? fallback : JSON.parse(String(v)) as T; } catch { return fallback; } };

/* ---------- read: everything the app shows, in one go ---------- */
export function loadState(db: Database): AppState {
  const all = (sql: string, ...p: unknown[]) => db.prepare(sql).all(...p) as Row[];
  const trips = all('SELECT * FROM trips ORDER BY created_at, rowid');
  const days = all('SELECT * FROM days ORDER BY trip_id, position');
  const stops = all('SELECT * FROM stops ORDER BY day_id, position');
  const ideas = all('SELECT * FROM ideas ORDER BY trip_id, position, created_at');
  const feedback = new Map(all('SELECT * FROM feedback').map(r => [r.trip_id, r]));
  const votes = all('SELECT * FROM stop_votes');
  const prefs = db.prepare('SELECT * FROM preferences WHERE id = 1').get() as Row | undefined;
  return {
    trips: trips.map((r): Trip => {
      const fb = feedback.get(r.id);
      return {
        id: String(r.id), name: String(r.name), city: (r.city_key as CityKey) ?? null,
        dest: { name: String(r.destination_name), country: String(r.country_name), cid: String(r.country_code) },
        center: r.center_lat != null && r.center_lng != null ? { lat: Number(r.center_lat), lng: Number(r.center_lng) } : null,
        start: (r.start_date as string) ?? null, len: Number(r.length_days), notes: String(r.notes),
        ideas: ideas.filter(i => i.trip_id === r.id).map(i => ({
          id: String(i.id), ...(i.google_place_id ? { placeId: String(i.google_place_id) } : {}), name: String(i.name), cat: i.category as Cat, ...(i.kind ? { kind: String(i.kind) } : {}),
          hood: String(i.area), lat: i.lat as number | null, lng: i.lng as number | null,
          tags: json<string[]>(i.tags, []), note: String(i.note), ...(i.source ? { source: String(i.source) } : {}),
          ...(i.price ? { price: String(i.price) } : {}), ...(i.image ? { image: String(i.image) } : {}),
        })),
        days: days.filter(d => d.trip_id === r.id).map(d => ({
          id: String(d.id), title: String(d.title),
          stops: stops.filter(s => s.day_id === d.id).map(s => s.idea_id
            ? { id: String(s.id), idea: String(s.idea_id), time: String(s.time) }
            : { id: String(s.id), time: String(s.time), own: { title: String(s.own_title ?? ''), where: String(s.own_where ?? ''), note: String(s.own_note ?? ''), link: String(s.own_link ?? '') } }),
        })),
        feedback: {
          again: ((fb?.go_back as string) ?? '') as Trip['feedback']['again'], highlights: String(fb?.highlights ?? ''), next: String(fb?.next_time ?? ''),
          votes: Object.fromEntries(votes.filter(v => v.trip_id === r.id).map(v => [String(v.idea_id), v.vote as Vote])),
        },
      };
    }),
    muhu: all('SELECT * FROM muhu ORDER BY created_at, rowid').map(r => ({
      id: String(r.id), cid: String(r.country_code), country: String(r.country_name), name: String(r.name), cats: json<MuhuCat[]>(r.categories, []),
      want: r.want as Want, area: String(r.area), when: String(r.season), far: String(r.getting_there), note: String(r.note), ...(r.source ? { source: String(r.source) } : {}),
    })),
    world: all('SELECT * FROM country_status ORDER BY rowid').reduce<Record<string, Status[]>>((w, r) => { (w[String(r.country_code)] ??= []).push(r.status as Status); return w; }, {}),
    visits: all('SELECT * FROM visits ORDER BY month DESC').map(r => ({ id: String(r.id), cid: String(r.country_code), places: String(r.places), from: String(r.month), to: String(r.month) })),
    prefs: prefs
      ? { interests: json(prefs.interests, []), pace: prefs.pace as Pace, budget: Number(prefs.budget), diet: json(prefs.diets, []), photos: !!prefs.show_photos }
      : { interests: [], pace: 'balanced', budget: 2, diet: [], photos: true },
    dismissed: all('SELECT google_place_id FROM dismissed_picks').map(r => String(r.google_place_id)),
  };
}

/* ---------- write: one trip at a time; saving a trip never touches another one ---------- */
export function saveTrip(db: Database, t: Trip) {
  db.transaction(() => {
    db.prepare(`INSERT INTO trips (id, name, destination_name, country_name, country_code, city_key, center_lat, center_lng, start_date, length_days, notes)
      VALUES (@id, @name, @dn, @cn, @cc, @city, @lat, @lng, @start, @len, @notes)
      ON CONFLICT(id) DO UPDATE SET name = excluded.name, destination_name = excluded.destination_name, country_name = excluded.country_name,
        country_code = excluded.country_code, city_key = excluded.city_key, center_lat = excluded.center_lat, center_lng = excluded.center_lng,
        start_date = excluded.start_date, length_days = excluded.length_days, notes = excluded.notes`)
      .run({ id: t.id, name: t.name, dn: t.dest.name, cn: t.dest.country, cc: t.dest.cid, city: t.city, lat: t.center?.lat ?? null, lng: t.center?.lng ?? null, start: t.start, len: t.len, notes: t.notes });
    // days and stops are rewritten in their current order; ideas are upserted so created_at survives
    db.prepare('DELETE FROM days WHERE trip_id = ?').run(t.id);
    db.prepare('DELETE FROM stop_votes WHERE trip_id = ?').run(t.id);
    db.prepare('DELETE FROM ideas WHERE trip_id = ? AND id NOT IN (SELECT value FROM json_each(?))').run(t.id, JSON.stringify(t.ideas.map(i => i.id)));
    const idea = db.prepare(`INSERT INTO ideas (id, trip_id, google_place_id, name, category, kind, area, lat, lng, tags, note, source, price, image, position)
      VALUES (@id, @trip, @place, @name, @cat, @kind, @area, @lat, @lng, @tags, @note, @source, @price, @image, @pos)
      ON CONFLICT(id) DO UPDATE SET google_place_id = excluded.google_place_id, name = excluded.name, category = excluded.category, kind = excluded.kind, area = excluded.area,
        lat = excluded.lat, lng = excluded.lng, tags = excluded.tags, note = excluded.note, source = excluded.source,
        price = excluded.price, image = excluded.image, position = excluded.position`);
    t.ideas.forEach((i, pos) => idea.run({ id: i.id, trip: t.id, place: i.placeId ?? null, name: i.name, cat: i.cat, kind: i.kind ?? null, area: i.hood, lat: i.lat, lng: i.lng, tags: JSON.stringify(i.tags), note: i.note, source: i.source ?? '', price: i.price ?? '', image: i.image ?? '', pos }));
    const day = db.prepare('INSERT INTO days (id, trip_id, position, title) VALUES (?, ?, ?, ?)');
    const stop = db.prepare(`INSERT INTO stops (id, day_id, idea_id, position, time, own_title, own_where, own_note, own_link)
      VALUES (@id, @day, @idea, @pos, @time, @title, @where, @note, @link)`);
    t.days.forEach((d, dpos) => {
      day.run(d.id, t.id, dpos, d.title);
      d.stops.forEach((s, pos) => stop.run({ id: s.id, day: d.id, idea: s.own ? null : s.idea, pos, time: s.time, title: s.own?.title ?? null, where: s.own?.where ?? null, note: s.own?.note ?? null, link: s.own?.link ?? null }));
    });
    db.prepare(`INSERT INTO feedback (trip_id, go_back, highlights, next_time) VALUES (?, ?, ?, ?)
      ON CONFLICT(trip_id) DO UPDATE SET go_back = excluded.go_back, highlights = excluded.highlights, next_time = excluded.next_time`)
      .run(t.id, t.feedback.again || null, t.feedback.highlights, t.feedback.next);
    const vote = db.prepare('INSERT INTO stop_votes (trip_id, idea_id, vote) VALUES (?, ?, ?)');
    const ids = new Set(t.ideas.map(i => i.id));
    for (const [ideaId, v] of Object.entries(t.feedback.votes)) if (v && ids.has(ideaId)) vote.run(t.id, ideaId, v);
  })();
}

// replaces the country's whole set; an empty one goes back to the status derived from trips
export function setCountryStatus(db: Database, cid: string, statuses: Status[]) {
  db.transaction(() => {
    db.prepare('DELETE FROM country_status WHERE country_code = ?').run(cid);
    const add = db.prepare('INSERT OR IGNORE INTO country_status (country_code, status) VALUES (?, ?)');
    statuses.forEach(s => add.run(cid, s));
  })();
}

// only the seeds that changed are sent; created_at stays from the first save
export function saveMuhu(db: Database, list: MuhuIdea[]) {
  const put = db.prepare(`INSERT INTO muhu (id, country_code, country_name, name, categories, want, area, season, getting_there, note, source)
    VALUES (@id, @cid, @country, @name, @cats, @want, @area, @when, @far, @note, @source)
    ON CONFLICT(id) DO UPDATE SET country_code = excluded.country_code, country_name = excluded.country_name, name = excluded.name, categories = excluded.categories,
      want = excluded.want, area = excluded.area, season = excluded.season, getting_there = excluded.getting_there, note = excluded.note, source = excluded.source`);
  db.transaction(() => { list.forEach(m => put.run({ ...m, cats: JSON.stringify(m.cats), source: m.source ?? '' })); })();
}
export function removeMuhu(db: Database, id: string) { db.prepare('DELETE FROM muhu WHERE id = ?').run(id); }

export function addVisit(db: Database, v: Visit) {
  db.prepare('INSERT INTO visits (id, country_code, places, month) VALUES (?, ?, ?, ?)').run(v.id, v.cid, v.places, v.from);
}
export function removeVisit(db: Database, id: string) { db.prepare('DELETE FROM visits WHERE id = ?').run(id); }

export function savePrefs(db: Database, p: Prefs) {
  db.prepare(`INSERT INTO preferences (id, interests, pace, budget, diets, show_photos) VALUES (1, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET interests = excluded.interests, pace = excluded.pace, budget = excluded.budget, diets = excluded.diets, show_photos = excluded.show_photos`)
    .run(JSON.stringify(p.interests), p.pace, p.budget, JSON.stringify(p.diet), p.photos === false ? 0 : 1);
}

export function dismissPick(db: Database, place: string) { db.prepare('INSERT OR IGNORE INTO dismissed_picks (google_place_id) VALUES (?)').run(place); }

// the proof of concept's "Reset sample data": wipes everything and loads the given state
export function replaceAll(db: Database, s: AppState) {
  db.transaction(() => {
    for (const table of ['stop_votes', 'stops', 'days', 'ideas', 'feedback', 'culture', 'trips', 'country_status', 'visits', 'preferences', 'dismissed_picks', 'muhu']) db.prepare(`DELETE FROM ${table}`).run();
    s.trips.forEach(t => saveTrip(db, t));
    saveMuhu(db, s.muhu);
    for (const [cid, st] of Object.entries(s.world)) setCountryStatus(db, cid, st);
    s.visits.forEach(v => addVisit(db, v));
    savePrefs(db, s.prefs);
    s.dismissed.forEach(p => dismissPick(db, p));
  })();
}
