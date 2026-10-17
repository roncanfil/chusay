import type { NextRequest } from 'next/server';
import { findDestinations, respond } from '@/server/google';

// GET /api/places/destinations?q=porto — cities, regions or countries for + New
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') || '').trim();
  return respond(async () => q ? findDestinations(q) : []);
}
