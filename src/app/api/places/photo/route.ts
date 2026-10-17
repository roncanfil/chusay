import type { NextRequest } from 'next/server';
import { photoFor, respond } from '@/server/google';

// GET /api/places/photo?id=<place id> → { uri, author, authorUri } or null; image files are never stored
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return Response.json({ error: 'id is required' }, { status: 400 });
  return respond(() => photoFor(id), { 'Cache-Control': 'private, max-age=600' });
}
