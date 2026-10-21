import fs from 'node:fs';
import { connection } from 'next/server';
import { photoPath } from '@/server/photos';

// an uploaded picture; its name never changes, so the browser can keep it
export async function GET(_req: Request, ctx: RouteContext<'/api/muhu/photos/[name]'>) {
  await connection();
  const file = photoPath((await ctx.params).name);
  if (!file || !fs.existsSync(file)) return new Response('Not found', { status: 404 });
  return new Response(fs.readFileSync(file), { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=31536000, immutable' } });
}
