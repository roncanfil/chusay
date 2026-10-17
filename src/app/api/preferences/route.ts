import { getDb } from '@/server/db';
import { savePrefs } from '@/server/repo';
import { handle, parsePrefs } from '@/server/validate';

// the household's shared preferences
export async function PUT(req: Request) {
  return handle(async () => { savePrefs(getDb(), parsePrefs(await req.json())); });
}
