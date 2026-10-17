import { getDb } from '@/server/db';
import { addVisit } from '@/server/repo';
import { handle, parseVisit } from '@/server/validate';

// an older trip logged by hand
export async function POST(req: Request) {
  return handle(async () => { addVisit(getDb(), parseVisit(await req.json())); });
}
