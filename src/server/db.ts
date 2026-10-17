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
  // 1: example — 'ALTER TABLE ideas ADD COLUMN opening_hours TEXT',
];

function migrate(d: Database.Database) {
  const done = d.pragma('user_version', { simple: true }) as number;
  MIGRATIONS.slice(done).forEach((sql, n) => d.transaction(() => { d.exec(sql); d.pragma(`user_version = ${done + n + 1}`); })());
}

export function getDb() {
  if (db) return db;
  const file = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'chusay.db');
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
