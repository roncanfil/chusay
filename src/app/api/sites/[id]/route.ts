import { getDb } from '@/server/db';
import { removeSite, saveSite } from '@/server/repo';
import { BadRequest, handle, parseSite } from '@/server/validate';

// a site to browse, added or changed
export async function PUT(req: Request, ctx: RouteContext<'/api/sites/[id]'>) {
  const { id } = await ctx.params;
  return handle(async () => { const x = parseSite(await req.json()); if (x.id !== id) throw new BadRequest('site id does not match the URL'); saveSite(getDb(), x); });
}

export async function DELETE(_req: Request, ctx: RouteContext<'/api/sites/[id]'>) {
  const { id } = await ctx.params;
  return handle(() => { removeSite(getDb(), id); });
}
