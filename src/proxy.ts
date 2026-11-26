import { NextResponse, type NextRequest } from 'next/server'

// The store is reached through a Cloudflare Tunnel, which passes the visitor's
// scheme and hostname in X-Forwarded-Proto / X-Forwarded-Host. A request that
// arrived over plain HTTP is upgraded here, so sign-in and session cookies are
// never sent in the clear. Local access (http://localhost:3000, which the
// deploy watcher's health check relies on) is left alone: Next adds the scheme
// header itself when a request comes without one, so the host decides.
export function proxy(request: NextRequest) {
  if (request.headers.get('x-forwarded-proto') !== 'http') return
  const host = (request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '')
    .split(',')[0]
    .trim()
  if (!host || /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host)) return
  const { pathname, search } = new URL(request.url)
  return NextResponse.redirect(`https://${host}${pathname}${search}`, 308)
}

export const config = {
  // Public static files are harmless over HTTP; everything else is upgraded.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}

export default proxy
