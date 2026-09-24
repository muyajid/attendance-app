import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

import type { SessionCookieOptions } from '@/types/auth';

/**
 * Stateless admin sessions.
 *
 * The cookie is an HMAC of its own expiry rather than a server-side record,
 * because a serverless deployment has no shared memory between invocations:
 * every instance has to validate a cookie on its own, with no lookup round-trip
 * and no shared session table.
 */

/** Cookie that carries the signed admin session. */
export const SESSION_COOKIE_NAME = 'attendance_admin_session';

/** How long a session stays valid before the admin must sign in again. */
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Version prefix, so a token from an older scheme can never be replayed. */
const TOKEN_VERSION = 'v1';

function readSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret === undefined || secret.trim() === '') {
    throw new Error(
      'SESSION_SECRET is not set. Add it to .env.local for development and to your Vercel project settings for production.',
    );
  }
  return secret;
}

function signatureFor(expiresAt: number): string {
  return createHmac('sha256', readSecret())
    .update(`${TOKEN_VERSION}:${expiresAt}`)
    .digest('hex');
}

/** Mint a token that stays valid for `SESSION_TTL_MS` measured from `now`. */
export function createSessionToken(now: number = Date.now()): string {
  const expiresAt = now + SESSION_TTL_MS;
  return `${TOKEN_VERSION}.${expiresAt}.${signatureFor(expiresAt)}`;
}

/**
 * Validate a cookie value.
 *
 * Every failure returns `false` rather than throwing: this runs on each
 * guarded request, including inside the proxy, where a missing secret or a
 * mangled cookie must simply read as "not signed in".
 */
export function verifySessionToken(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return false;
  }

  const [version, rawExpiresAt, providedSignature] = parts;
  if (version !== TOKEN_VERSION) {
    return false;
  }

  const expiresAt = Number(rawExpiresAt);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Date.now()) {
    return false;
  }

  try {
    const expected = Buffer.from(signatureFor(expiresAt), 'utf8');
    const provided = Buffer.from(providedSignature, 'utf8');
    return (
      expected.length === provided.length &&
      timingSafeEqual(expected, provided)
    );
  } catch {
    return false;
  }
}

/** Whether an admin password has been supplied to this server. */
export function isPasswordConfigured(): boolean {
  const password = process.env.ADMIN_PASSWORD;
  return password !== undefined && password.length > 0;
}

/**
 * Constant-time password check.
 *
 * Both sides are hashed first so `timingSafeEqual` always receives
 * equal-length buffers, and so the comparison leaks neither the configured
 * password's length nor its contents.
 */
export function isPasswordAccepted(candidate: string): boolean {
  if (!isPasswordConfigured()) {
    return false;
  }

  const expected = createHash('sha256')
    .update(process.env.ADMIN_PASSWORD ?? '', 'utf8')
    .digest();
  const provided = createHash('sha256').update(candidate, 'utf8').digest();

  return timingSafeEqual(expected, provided);
}

/** Attributes for a freshly issued session cookie. */
export function sessionCookieOptions(secure: boolean): SessionCookieOptions {
  return {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  };
}

/** Attributes used to overwrite the session cookie when signing out. */
export function expiredSessionCookieOptions(
  secure: boolean,
): SessionCookieOptions {
  return { ...sessionCookieOptions(secure), maxAge: 0 };
}

/**
 * Whether the connection is actually HTTPS.
 *
 * The `secure` flag has to follow the real scheme: Vercel terminates TLS and
 * forwards `x-forwarded-proto: https`, while a local `next start` is plain
 * HTTP. Marking a cookie `Secure` on plain HTTP makes the browser drop it
 * silently, so sign-in would appear to succeed and then expire instantly.
 */
export function isSecureRequest(request: Request): boolean {
  const forwardedProto = request.headers.get('x-forwarded-proto');
  if (forwardedProto !== null && forwardedProto.startsWith('https')) {
    return true;
  }
  return new URL(request.url).protocol === 'https:';
}
