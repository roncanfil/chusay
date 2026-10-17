import { getDb } from '@/server/db';
import { removeVisit } from '@/server/repo';
import { handle } from '@/server/validate';

export async function DELETE(_req: Request, ctx: RouteContext<'/api/visits/[id]'>) {
  const { id } = await ctx.params;
  return handle(() => { removeVisit(getDb(), id); });
}
