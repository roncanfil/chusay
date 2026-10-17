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

export function getDb() {
  if (db) return db;
  const file = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'chusay.db');
  const fresh = !fs.existsSync(file);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  // in demo mode a brand-new database starts with the sample trips, like the proof of concept
  if (fresh && demoMode()) replaceAll(db, seed());
  return db;
}
