import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';

// Optional shared password for the whole site, for setups with nothing in front that adds one (CasaOS, plain Docker).
// Set APP_PASSWORD to turn it on; the app has no accounts of its own.
// A plain page with one password field (password managers fill it, unlike the browser's Basic-auth prompt),
// then a cookie remembers it for a year. Use HTTPS when it's reachable from outside your home network.
const COOKIE = 'chusay-login';

export async function proxy(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  const path = req.nextUrl.pathname;
  if (!password || path === '/api/version' || path === '/icon.svg') return NextResponse.next();
  const token = tokenFor(password);
  if (same(req.cookies.get(COOKIE)?.value || '', token)) return NextResponse.next();

  if (path === '/api/login' && req.method === 'POST') {
    const form = await req.formData();
    const next = safeNext(String(form.get('next') || '/'));
    if (!same(String(form.get('password') || ''), password)) return loginPage(next, true);
    const res = NextResponse.redirect(new URL(next, req.url), 303);
    const secure = (req.headers.get('x-forwarded-proto') || req.nextUrl.protocol).startsWith('https');
    res.cookies.set(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: 60 * 60 * 24 * 365 });
    return res;
  }
  if (path.startsWith('/api/') || path.startsWith('/_next/')) return new NextResponse('Please log in.', { status: 401 });
  return loginPage(path + req.nextUrl.search, false);
}

// the cookie holds a hash of the password, so changing APP_PASSWORD signs everyone out
function tokenFor(password: string) {
  return createHash('sha256').update('chusay:' + password).digest('hex');
}

// only paths on this site, never another one ("//evil.com")
function safeNext(next: string) {
  return next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

// compares without leaking how much of the password was right through timing
function same(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// its own small page, so nothing of the app (which would need the password to load) runs before signing in
function loginPage(next: string, wrong: boolean) {
  const attr = next.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  return new NextResponse(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ch’usay</title><link rel="icon" href="/icon.svg">
<style>
:root { --bg: #FFFFFF; --ink: #18211F; --ink-2: #56625F; --line: #E8EDEC; --accent: #12A39F; --on-accent: #FFFFFF; --warn: #CC5B46; color-scheme: light dark; }
@media (prefers-color-scheme: dark) { :root { --bg: #121716; --ink: #E9EFEE; --ink-2: #AEBBB8; --line: #263030; --accent: #2EC6C1; --on-accent: #062624; --warn: #F08A76; } }
* { box-sizing: border-box; }
body { margin: 0; min-height: 100dvh; display: grid; place-items: center; padding: 16px; background: var(--bg); color: var(--ink); font-family: "Plus Jakarta Sans", system-ui, -apple-system, "Segoe UI", sans-serif; }
form { width: 100%; max-width: 340px; display: grid; gap: 14px; }
h1 { margin: 0 0 6px; font-size: 24px; font-weight: 800; display: flex; align-items: center; gap: 10px; }
h1 img { width: 32px; height: 32px; }
label { display: grid; gap: 6px; font-size: 14px; font-weight: 600; color: var(--ink-2); }
input { font: inherit; font-size: 16px; font-weight: 400; color: var(--ink); background: var(--bg); border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; width: 100%; }
input:focus-visible, button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
button { font: inherit; font-size: 15px; font-weight: 600; border: 0; border-radius: 999px; padding: 10px 16px; background: var(--accent); color: var(--on-accent); cursor: pointer; }
p { margin: 0; color: var(--warn); font-size: 14px; font-weight: 500; }
</style></head>
<body><form method="post" action="/api/login">
<h1><img src="/icon.svg" alt="">Ch’usay</h1>
<input type="hidden" name="next" value="${attr}">
<label>Password<input type="password" name="password" autocomplete="current-password" required autofocus></label>
${wrong ? '<p>That’s not the password. Try again.</p>' : ''}
<button type="submit">Sign in</button>
</form></body></html>`, { status: 401, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}
