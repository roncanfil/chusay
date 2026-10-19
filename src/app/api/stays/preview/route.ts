import { connection, type NextRequest } from 'next/server';
import { readListing } from '@/server/listing';

// GET /api/stays/preview?url=<booking link> → { name, image, price, lat, lng }; whatever the page shares
export async function GET(req: NextRequest) {
  await connection();
  const url = (req.nextUrl.searchParams.get('url') || '').trim();
  try { return Response.json(await readListing(url)); } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'Could not read that link' }, { status: 400 });
  }
}
