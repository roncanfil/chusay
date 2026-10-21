import { getDb } from '@/server/db';
import { dropPhoto } from '@/server/photos';
import { muhuImages, removeMuhu } from '@/server/repo';
import { handle } from '@/server/validate';

export async function DELETE(_req: Request, ctx: RouteContext<'/api/muhu/[id]'>) {
  const { id } = await ctx.params;
  return handle(() => { const db = getDb(), image = muhuImages(db, [id]).get(id); removeMuhu(db, id); dropPhoto(image); });
}
