import { getDb } from '@/server/db';
import { removeVisit, updateVisit } from '@/server/repo';
import { BadRequest, handle, parseVisit } from '@/server/validate';

// a visit logged by hand, changed
export async function PUT(req: Request, ctx: RouteContext<'/api/visits/[id]'>) {
  const { id } = await ctx.params;
  return handle(async () => { const v = parseVisit(await req.json()); if (v.id !== id) throw new BadRequest('visit id does not match the URL'); updateVisit(getDb(), v); });
}

export async function DELETE(_req: Request, ctx: RouteContext<'/api/visits/[id]'>) {
  const { id } = await ctx.params;
  return handle(() => { removeVisit(getDb(), id); });
}
