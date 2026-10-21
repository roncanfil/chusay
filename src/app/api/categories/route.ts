import { getDb } from '@/server/db';
import { addCategory } from '@/server/repo';
import { handle, parseCategory } from '@/server/validate';

// a category the household added, for trip ideas or for Muhu
export async function POST(req: Request) {
  return handle(async () => { addCategory(getDb(), parseCategory(await req.json())); });
}
