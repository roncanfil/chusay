import { getDb } from '@/server/db';
import { removeMuhu } from '@/server/repo';
import { handle } from '@/server/validate';

export async function DELETE(_req: Request, ctx: RouteContext<'/api/muhu/[id]'>) {
  const { id } = await ctx.params;
  return handle(() => { removeMuhu(getDb(), id); });
}
