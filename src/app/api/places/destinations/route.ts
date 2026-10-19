import type { NextRequest } from 'next/server';
import { destination, findDestinations, respond } from '@/server/google';

// GET /api/places/destinations?q=douro — cities, regions or countries for a trip's destination
// GET /api/places/destinations?id=<place id> — the picked one, with its center and country (or null)
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams, q = (p.get('q') || '').trim(), id = p.get('id'), session = p.get('session') || undefined;
  if (id) return respond(() => destination(id, session));
  return respond(async () => q ? findDestinations(q, session) : []);
}
