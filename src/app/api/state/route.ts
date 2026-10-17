import { connection } from 'next/server';
import { getDb } from '@/server/db';
import { loadState } from '@/server/repo';

// everything both of you see; always read fresh from SQLite
export async function GET() {
  await connection();
  return Response.json(loadState(getDb()));
}
