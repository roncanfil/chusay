import { getDb } from '@/server/db';
import { addSearch } from '@/server/repo';
import { handle, parseSearch } from '@/server/validate';

// a Muhu search and its filters, saved under a name
export async function POST(req: Request) {
  return handle(async () => { addSearch(getDb(), parseSearch(await req.json())); });
}
