import { getDb } from '@/server/db';
import { setCountryStatus } from '@/server/repo';
import { handle, parseStatuses } from '@/server/validate';

// the hand-set world map statuses (one or more); DELETE goes back to the status derived from trips
export async function PUT(req: Request, ctx: RouteContext<'/api/countries/[cid]'>) {
  const { cid } = await ctx.params;
  return handle(async () => { setCountryStatus(getDb(), cid, parseStatuses(await req.json())); });
}

export async function DELETE(_req: Request, ctx: RouteContext<'/api/countries/[cid]'>) {
  const { cid } = await ctx.params;
  return handle(() => { setCountryStatus(getDb(), cid, []); });
}
