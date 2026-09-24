import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import {
  createSessionToken,
  isPasswordAccepted,
  isPasswordConfigured,
  isSecureRequest,
  sessionCookieOptions,
  SESSION_COOKIE_NAME,
} from '@/lib/auth';
import { isLoginRequest } from '@/lib/validation';
import type { AuthErrorResponse, AuthSuccessResponse } from '@/types/auth';

/**
 * One message for every rejected attempt, so the response cannot be used to
 * tell an unset password apart from a wrong one.
 */
const INVALID_CREDENTIALS = 'Incorrect password.';

function rejected(): NextResponse<AuthErrorResponse> {
  return NextResponse.json<AuthErrorResponse>(
    { success: false, error: INVALID_CREDENTIALS },
    { status: 401 },
  );
}

/** Mint a token, or `null` when the server cannot sign one at all. */
function mintToken(): string | null {
  try {
    return createSessionToken();
  } catch {
    return null;
  }
}

/**
 * `POST /api/auth/login` - check the password and issue the session cookie.
 *
 * The cookie is `httpOnly`, so script running on the page can never read it,
 * and `sameSite=lax`, so it travels on top-level navigations but not on
 * cross-site form posts.
 */
export async function POST(
  request: Request,
): Promise<NextResponse<AuthSuccessResponse | AuthErrorResponse>> {
  if (!isPasswordConfigured()) {
    return NextResponse.json<AuthErrorResponse>(
      {
        success: false,
        error:
          'Admin login is not configured on this server. Set ADMIN_PASSWORD.',
      },
      { status: 500 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return rejected();
  }

  if (!isLoginRequest(payload) || !isPasswordAccepted(payload.password)) {
    return rejected();
  }

  const token = mintToken();
  if (token === null) {
    return NextResponse.json<AuthErrorResponse>(
      {
        success: false,
        error:
          'Session signing is not configured on this server. Set SESSION_SECRET.',
      },
      { status: 500 },
    );
  }

  const cookieStore = await cookies();
  cookieStore.set(
    SESSION_COOKIE_NAME,
    token,
    sessionCookieOptions(isSecureRequest(request)),
  );

  return NextResponse.json<AuthSuccessResponse>({
    success: true,
    message: 'Signed in.',
  });
}
