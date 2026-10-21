import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { dbFile } from './db';

// Pictures uploaded for Muhu ideas: JPEG files next to the database, in the same data folder (and backed up with it).
// The browser shrinks them before sending, so each is a few hundred KB.
export const photoDir = () => path.join(path.dirname(dbFile()), 'photos');
export const PHOTO_URL = '/api/muhu/photos/';
const NAME = /^[a-z0-9]{8,32}\.jpg$/;

export function photoPath(name: string) { return NAME.test(name) ? path.join(photoDir(), name) : null; }

export function savePhoto(bytes: Uint8Array) {
  const name = `${crypto.randomUUID().replaceAll('-', '')}.jpg`;
  fs.mkdirSync(photoDir(), { recursive: true });
  fs.writeFileSync(path.join(photoDir(), name), bytes);
  return PHOTO_URL + name;
}

// only files this app uploaded; a pasted link is left alone
export function dropPhoto(url: string | undefined) {
  const file = url?.startsWith(PHOTO_URL) && photoPath(url.slice(PHOTO_URL.length));
  if (file) fs.rmSync(file, { force: true });
}
