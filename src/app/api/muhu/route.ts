import { getDb } from '@/server/db';
import { dropPhoto } from '@/server/photos';
import { muhuImages, saveMuhu } from '@/server/repo';
import { handle, parseMuhu } from '@/server/validate';

// creates or updates the Muhu seeds sent (only the ones that changed); an uploaded picture that was replaced is deleted
export async function PUT(req: Request) {
  return handle(async () => {
    const db = getDb(), list = parseMuhu(await req.json()), before = muhuImages(db, list.map(m => m.id));
    saveMuhu(db, list);
    for (const m of list) if (before.get(m.id) !== (m.image ?? '')) dropPhoto(before.get(m.id));
  });
}
