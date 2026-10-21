import { connection, type NextRequest } from 'next/server';
import { buildQuirks, cachedQuirks, cultureKey, saveQuirks } from '@/server/culture';
import { getDb } from '@/server/db';
import { handle, parseQuirksEdit } from '@/server/validate';

// GET /api/culture/trip/<id> → the trip's saved local quirks, or null
export async function GET(_req: NextRequest, ctx: RouteContext<'/api/culture/trip/[id]'>) {
  await connection();
  const { id } = await ctx.params;
  return Response.json(cachedQuirks(getDb(), id));
}

// POST /api/culture/trip/<id>?place=Porto&country=Portugal&cid=620 → (re)writes them from Wikivoyage with Claude
export async function POST(req: NextRequest, ctx: RouteContext<'/api/culture/trip/[id]'>) {
  const { id } = await ctx.params, p = req.nextUrl.searchParams;
  if (!cultureKey()) return Response.json({ error: 'ANTHROPIC_API_KEY is not set' }, { status: 501 });
  try { return Response.json(await buildQuirks(getDb(), { id, place: p.get('place') || '', country: p.get('country') || '', cid: p.get('cid') || '' })); } catch (e) {
    console.error(e);
    return Response.json({ error: e instanceof Error ? e.message : 'Quirks request failed' }, { status: 502 });
  }
}

// PUT /api/culture/trip/<id>?cid=620 → the quirks as the household edited them
export async function PUT(req: NextRequest, ctx: RouteContext<'/api/culture/trip/[id]'>) {
  const { id } = await ctx.params;
  return handle(async () => { saveQuirks(getDb(), id, req.nextUrl.searchParams.get('cid') || '', parseQuirksEdit(await req.json())); });
}
