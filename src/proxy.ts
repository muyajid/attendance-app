import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/auth';
import type { AttendanceErrorResponse } from '@/types/attendance';

/**
 * Gate every admin surface before it renders.
 *
 * This runs on the Node.js runtime, so it can share the exact HMAC
 * verification the page and the route handler use. Guarding the recap *feed*
 * as well as the page is deliberate: protecting only the HTML would leave
 * `GET /api/attendance` open to anyone who guessed the endpoint, and the
 * punches themselves must stay reachable so students can still clock in.
 */
export function proxy(request: NextRequest): NextResponse {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const signedIn = token !== undefined && verifySessionToken(token);
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/admin') && !signedIn) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Sending an already-signed-in admin back to the form they came from.
  if (pathname === '/login' && signedIn) {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  if (
    pathname === '/api/attendance' &&
    request.method !== 'POST' &&
    !signedIn
  ) {
    return NextResponse.json<AttendanceErrorResponse>(
      { success: false, error: 'Unauthorized.' },
      { status: 401 },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/login', '/api/attendance'],
};
