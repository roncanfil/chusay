import { getDb } from '@/server/db';
import { dismissPick } from '@/server/repo';
import { handle, parsePlace } from '@/server/validate';

// a suggestion marked "not for us"
export async function POST(req: Request) {
  return handle(async () => { dismissPick(getDb(), parsePlace(await req.json())); });
}
