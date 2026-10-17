import type { NextRequest } from 'next/server';
import { respond, searchPlaces } from '@/server/google';

// GET /api/places/search?q=bakery&lat=38.72&lng=-9.14
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams, q = (p.get('q') || '').trim();
  const lat = Number(p.get('lat')), lng = Number(p.get('lng'));
  const near = p.has('lat') && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  return respond(async () => q ? searchPlaces(q, near) : []);
}
