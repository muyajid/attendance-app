import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import {
  expiredSessionCookieOptions,
  isSecureRequest,
  SESSION_COOKIE_NAME,
} from '@/lib/auth';
import type { AuthSuccessResponse } from '@/types/auth';

/**
 * `POST /api/auth/logout` - expire the session cookie.
 *
 * The value is overwritten with an already-expired one rather than deleted,
 * because writing the cookie from the server is the only way to guarantee the
 * browser drops it for the same `path` it was issued with.
 */
export async function POST(
  request: Request,
): Promise<NextResponse<AuthSuccessResponse>> {
  const cookieStore = await cookies();
  cookieStore.set(
    SESSION_COOKIE_NAME,
    '',
    expiredSessionCookieOptions(isSecureRequest(request)),
  );

  return NextResponse.json<AuthSuccessResponse>({
    success: true,
    message: 'Signed out.',
  });
}
