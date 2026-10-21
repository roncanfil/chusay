import { getDb } from '@/server/db';
import { removeSearch } from '@/server/repo';
import { handle } from '@/server/validate';

export async function DELETE(_req: Request, ctx: RouteContext<'/api/muhu/searches/[id]'>) {
  const { id } = await ctx.params;
  return handle(() => { removeSearch(getDb(), id); });
}
