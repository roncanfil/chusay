import { connection } from 'next/server';

// Which commit this server runs, so CI and Claude can tell when a change is live.
// Open without the app password: the code is public, and this reveals nothing else.
export async function GET() {
  await connection();
  return Response.json({ commit: process.env.CHUSAY_COMMIT || 'dev' });
}
