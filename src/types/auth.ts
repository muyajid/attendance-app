/**
 * Shared, strictly-typed contract for the admin authentication endpoints.
 *
 * Kept apart from the attendance contract so the public clock-in payload and
 * the private sign-in payload can never be confused for one another.
 */

/** The exact JSON body accepted by `POST /api/auth/login`. */
export interface LoginRequest {
  password: string;
}

/** `200` response returned once a password has been accepted. */
export interface AuthSuccessResponse {
  success: true;
  message: string;
}

/** Response returned for every rejected or misconfigured sign-in attempt. */
export interface AuthErrorResponse {
  success: false;
  error: string;
}

/** Discriminated union covering every `/api/auth/*` response. */
export type AuthApiResponse = AuthSuccessResponse | AuthErrorResponse;

/**
 * Attributes written alongside the session cookie.
 *
 * Declared here rather than imported from Next so the auth module stays free
 * of framework types and can be reasoned about on its own.
 */
export interface SessionCookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax';
  path: string;
  maxAge: number;
}
