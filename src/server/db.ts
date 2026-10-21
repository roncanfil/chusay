import 'server-only';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { seed } from '@/lib/seed';
import { demoMode } from './mode';
import { SCHEMA } from './schema';
import { replaceAll } from './repo';

// One SQLite file, on a Docker volume in production. Back up this file.
let db: Database.Database | undefined;

// Changes to existing tables, in order. Each runs once per database (tracked in PRAGMA user_version).
// Never edit or remove one that has shipped: the household's real data has already been migrated by it.
// Make the same change in SCHEMA too, so a new database starts with it (and skips these).
// New tables only need SCHEMA.
const MIGRATIONS: string[] = [
  // 1: a country can hold several statuses (visited and want to go); keeps every existing one
  `CREATE TABLE country_status_new (
    country_code TEXT NOT NULL,
    status       TEXT NOT NULL CHECK (status IN ('visited', 'planning', 'want', 'nope')),
    PRIMARY KEY (country_code, status)
  );
  INSERT INTO country_status_new (country_code, status) SELECT country_code, status FROM country_status;
  DROP TABLE country_status;
  ALTER TABLE country_status_new RENAME TO country_status;`,
  // 2: stays saved from a booking-site link keep its price and preview picture
  `ALTER TABLE ideas ADD COLUMN price TEXT NOT NULL DEFAULT '';
  ALTER TABLE ideas ADD COLUMN image TEXT NOT NULL DEFAULT '';`,
  // 3: culture notes can hold regional words (Portugal's beers and coffees)
  `ALTER TABLE culture ADD COLUMN regional TEXT NOT NULL DEFAULT '[]';`,
  // 4: a Tours category (booked or reserved); SQLite can't loosen a CHECK, so ideas is copied into a new table
  `CREATE TABLE ideas_new (
    id              TEXT PRIMARY KEY,
    trip_id         TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    google_place_id TEXT,
    name            TEXT NOT NULL,
    category        TEXT NOT NULL CHECK (category IN ('sight', 'food', 'act', 'tour', 'stay', 'shop')),
    kind            TEXT,
    area            TEXT NOT NULL DEFAULT '',
    lat             REAL,
    lng             REAL,
    tags            TEXT NOT NULL DEFAULT '[]',
    note            TEXT NOT NULL DEFAULT '',
    source          TEXT NOT NULL DEFAULT '',
    price           TEXT NOT NULL DEFAULT '',
    image           TEXT NOT NULL DEFAULT '',
    position        INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );
  INSERT INTO ideas_new (id, trip_id, google_place_id, name, category, kind, area, lat, lng, tags, note, source, price, image, position, created_at)
    SELECT id, trip_id, google_place_id, name, category, kind, area, lat, lng, tags, note, source, price, image, position, created_at FROM ideas;
  DROP TABLE ideas;
  ALTER TABLE ideas_new RENAME TO ideas;
  CREATE INDEX IF NOT EXISTS ideas_trip ON ideas(trip_id, position);`,
  // 5: Muhu ideas get a Google place, a map location and our own picture. Copied into a new table rather than
  // altered, so it works whether muhu was created before (old columns) or just now by SCHEMA (already new)
  `CREATE TABLE muhu_new (
    id           TEXT PRIMARY KEY,
    country_code TEXT NOT NULL,
    country_name TEXT NOT NULL,
    name         TEXT NOT NULL,
    categories   TEXT NOT NULL DEFAULT '[]',
    want         TEXT NOT NULL DEFAULT '' CHECK (want IN ('high', 'med', 'low', '')),
    area         TEXT NOT NULL DEFAULT '',
    season       TEXT NOT NULL DEFAULT '',
    getting_there TEXT NOT NULL DEFAULT '',
    note         TEXT NOT NULL DEFAULT '',
    source       TEXT NOT NULL DEFAULT '',
    google_place_id TEXT,
    lat          REAL,
    lng          REAL,
    google_match TEXT NOT NULL DEFAULT '' CHECK (google_match IN ('auto', 'set', 'none', '')),
    image        TEXT NOT NULL DEFAULT '',
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );
  INSERT INTO muhu_new (id, country_code, country_name, name, categories, want, area, season, getting_there, note, source, created_at)
    SELECT id, country_code, country_name, name, categories, want, area, season, getting_there, note, source, created_at FROM muhu ORDER BY created_at, rowid;
  DROP TABLE muhu;
  ALTER TABLE muhu_new RENAME TO muhu;`,
];

// foreign keys are off while migrating, so rebuilding a table (copy, drop, rename) doesn't cascade-delete
// the rows that point at it (dropping ideas would otherwise delete every stop and vote)
function migrate(d: Database.Database) {
  const done = d.pragma('user_version', { simple: true }) as number;
  if (done >= MIGRATIONS.length) return;
  d.pragma('foreign_keys = OFF');
  try {
    MIGRATIONS.slice(done).forEach((sql, n) => d.transaction(() => {
      d.exec(sql);
      if ((d.pragma('foreign_key_check') as unknown[]).length) throw new Error(`Migration ${done + n + 1} left broken references`);
      d.pragma(`user_version = ${done + n + 1}`);
    })());
  } finally { d.pragma('foreign_keys = ON'); }
}

export const dbFile = () => process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'chusay.db');

export function getDb() {
  if (db) return db;
  const file = dbFile();
  const fresh = !fs.existsSync(file);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  if (fresh) db.pragma(`user_version = ${MIGRATIONS.length}`); // a new database already has the latest schema
  else migrate(db);
  // in demo mode a brand-new database starts with the sample trips, like the proof of concept
  if (fresh && demoMode()) replaceAll(db, seed());
  return db;
}
