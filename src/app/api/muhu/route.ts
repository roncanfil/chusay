import { getDb } from '@/server/db';
import { saveMuhu } from '@/server/repo';
import { handle, parseMuhu } from '@/server/validate';

// creates or updates the Muhu seeds sent (only the ones that changed)
export async function PUT(req: Request) {
  return handle(async () => { saveMuhu(getDb(), parseMuhu(await req.json())); });
}
