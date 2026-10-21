import { connection, type NextRequest } from 'next/server';
import { buildCulture, cultureFor, cultureKey, saveCulture } from '@/server/culture';
import { getDb } from '@/server/db';
import { handle, parseCultureEdit } from '@/server/validate';

// GET /api/culture/620 → the saved phrases and customs for Portugal, or null
export async function GET(_req: NextRequest, ctx: RouteContext<'/api/culture/[cid]'>) {
  await connection();
  const { cid } = await ctx.params;
  return Response.json(cultureFor(getDb(), cid));
}

// POST /api/culture/620?name=Portugal → (re)builds them from Wikivoyage with Claude; null when Wikivoyage has no page
export async function POST(req: NextRequest, ctx: RouteContext<'/api/culture/[cid]'>) {
  const { cid } = await ctx.params;
  if (!cultureKey()) return Response.json({ error: 'ANTHROPIC_API_KEY is not set' }, { status: 501 });
  try { return Response.json(await buildCulture(getDb(), cid, req.nextUrl.searchParams.get('name') || '')); } catch (e) {
    console.error(e);
    return Response.json({ error: e instanceof Error ? e.message : 'Culture request failed' }, { status: 502 });
  }
}

// PUT /api/culture/620 → the notes as the household edited them; they stay until someone asks for a rewrite
export async function PUT(req: NextRequest, ctx: RouteContext<'/api/culture/[cid]'>) {
  const { cid } = await ctx.params;
  return handle(async () => { saveCulture(getDb(), cid, parseCultureEdit(await req.json())); });
}
