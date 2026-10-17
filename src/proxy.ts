import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';

// Optional shared login for the whole site, for setups with nothing in front that adds one (CasaOS, plain Docker).
// Set APP_PASSWORD (and APP_USER, default "us") to turn it on; the app has no accounts of its own.
// The browser asks once and remembers. Use HTTPS when it's reachable from outside your home network.
export function proxy(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.next();
  const [scheme, encoded] = (req.headers.get('authorization') || '').split(' ');
  if (scheme === 'Basic' && encoded) {
    const [user, ...rest] = Buffer.from(encoded, 'base64').toString('utf8').split(':');
    if (same(user, process.env.APP_USER || 'us') && same(rest.join(':'), password)) return NextResponse.next();
  }
  return new NextResponse('Please log in.', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Chusay", charset="UTF-8"' } });
}

// compares without leaking how much of the password was right through timing
function same(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
