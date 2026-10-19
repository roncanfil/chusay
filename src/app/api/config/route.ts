import { connection } from 'next/server';
import { demoMode } from '@/server/mode';

// Read at request time, so a Docker image built without keys picks them up from the container's environment.
// The browser key is meant to be seen: restrict it to your domain in Google Cloud.
export async function GET() {
  await connection();
  return Response.json({
    mapsKey: process.env.GOOGLE_MAPS_BROWSER_KEY || null,
    mapId: process.env.GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID',
    places: !!process.env.GOOGLE_PLACES_SERVER_KEY,
    culture: !!process.env.ANTHROPIC_API_KEY,
    demo: demoMode(),
  });
}
