import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Protects all /admin routes.
 * Checks for sb_access_token cookie — if missing, redirects to /login.
 * Token is set by the frontend after successful login.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect /admin and /dashboard routes
  if (pathname.startsWith('/admin') || pathname.startsWith('/dashboard') || pathname.startsWith('/account')) {
    const token = request.cookies.get('sb_access_token')?.value;

    if (!token) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/dashboard/:path*', '/account/:path*'],
};
