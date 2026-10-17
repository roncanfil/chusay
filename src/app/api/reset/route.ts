import { seed } from '@/lib/seed';
import { getDb } from '@/server/db';
import { demoMode } from '@/server/mode';
import { loadState, replaceAll } from '@/server/repo';
import { handle } from '@/server/validate';

// the proof of concept's "Reset sample data": erases everything for both of you
export async function POST() {
  if (!demoMode()) return Response.json({ error: 'Resetting is only available with DEMO_MODE=true' }, { status: 403 });
  return handle(() => { const db = getDb(); replaceAll(db, seed()); return loadState(db); });
}
