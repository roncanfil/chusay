import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

// Daily copies of the database into BACKUP_DIR, kept for BACKUP_KEEP_DAYS (30 by default).
// SQLite's backup API copies a consistent snapshot while the app keeps running.
// Started from instrumentation.ts, so it works the same in Docker, CasaOS or `npm start`.
const NAME = /^chusay-(\d{4}-\d{2}-\d{2})\.db$/;
const day = (d: Date) => d.toISOString().slice(0, 10);

export async function backupNow(dir: string) {
  const file = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'chusay.db');
  if (!fs.existsSync(file)) return;
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, `chusay-${day(new Date())}.db`);
  if (!fs.existsSync(target)) {
    const db = new Database(file, { fileMustExist: true });
    try { await db.backup(target); } finally { db.close(); }
    console.log(`Backed up the database to ${target}`);
  }
  // uploaded Muhu pictures: new ones are copied in, and kept even after they're replaced in the app
  const photos = path.join(path.dirname(file), 'photos');
  if (fs.existsSync(photos)) fs.cpSync(photos, path.join(dir, 'photos'), { recursive: true, force: false });
  const keep = Number(process.env.BACKUP_KEEP_DAYS) || 30;
  const cutoff = day(new Date(Date.now() - keep * 864e5));
  for (const f of fs.readdirSync(dir)) {
    const m = f.match(NAME);
    if (m && m[1] < cutoff) fs.unlinkSync(path.join(dir, f));
  }
}

export function startBackups(dir: string) {
  const run = () => backupNow(dir).catch(e => console.error('Backup failed:', e));
  setTimeout(run, 60_000).unref(); // shortly after start, then a few times a day; one file per day
  setInterval(run, 6 * 3600_000).unref();
}
