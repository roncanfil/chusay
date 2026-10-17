import { getDb } from '@/server/db';
import { saveTrip } from '@/server/repo';
import { handle, parseTrip } from '@/server/validate';

// creates or replaces one trip (with its days, stops, ideas and feedback)
export async function PUT(req: Request, ctx: RouteContext<'/api/trips/[id]'>) {
  const { id } = await ctx.params;
  return handle(async () => { saveTrip(getDb(), parseTrip(await req.json(), id)); });
}
