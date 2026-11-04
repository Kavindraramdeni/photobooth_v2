import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Protects all /admin, /dashboard, and /account routes.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect all /admin, /dashboard, /account routes
  if (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/account')
  ) {
    const token = request.cookies.get('sb_access_token')?.value;
    if (!token) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Lightweight JWT expiry check to prevent access with stale cookies.
    // (Full signature verification still happens on backend-protected APIs.)
    try {
      const payloadBase64 = token.split('.')[1];
      if (!payloadBase64) throw new Error('invalid token');
      const normalized = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
      const payload = JSON.parse(atob(padded));
      const now = Math.floor(Date.now() / 1000);
      if (payload?.exp && payload.exp < now) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('from', pathname);
        const res = NextResponse.redirect(loginUrl);
        res.cookies.set('sb_access_token', '', { path: '/', maxAge: 0 });
        return res;
      }
    } catch {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('from', pathname);
      const res = NextResponse.redirect(loginUrl);
      res.cookies.set('sb_access_token', '', { path: '/', maxAge: 0 });
      return res;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/dashboard/:path*', '/account/:path*'],
};
