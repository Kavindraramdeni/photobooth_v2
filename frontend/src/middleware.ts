import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Protects all /admin routes.
 * Exception: /admin/events/[id]?operator=true — PIN verified client-side.
 */
export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Allow operator access to a specific event page (PIN verified client-side)
  const isOperatorMode = searchParams.get('operator') === 'true';
  const isEventPage = /^\/admin\/events\/[^/]+$/.test(pathname);
  if (isOperatorMode && isEventPage) {
    return NextResponse.next();
  }

  // Protect all other /admin, /dashboard, /account routes
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
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/dashboard/:path*', '/account/:path*'],
};
