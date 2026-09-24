import type {
  AttendanceCreateSuccessResponse,
  AttendanceErrorResponse,
  AttendanceListResponse,
  AttendanceRequestBody,
  AttendanceRecord,
  AttendanceType,
  GeofenceStatus,
} from '@/types/attendance';
import type {
  AuthErrorResponse,
  AuthSuccessResponse,
  LoginRequest,
} from '@/types/auth';

/**
 * Runtime type guards for everything crossing an API boundary.
 *
 * `Request.json()` and `Response.json()` are `unknown` from TypeScript's point
 * of view, so these guards are what let the server reject malformed payloads
 * and the client narrow responses without resorting to `any` or casts.
 */

const ATTENDANCE_TYPES: readonly string[] = ['Clock In', 'Clock Out'];
const GEOFENCE_STATUSES: readonly string[] = ['On-Site', 'Out of Bounds'];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isAttendanceType(value: unknown): value is AttendanceType {
  return typeof value === 'string' && ATTENDANCE_TYPES.includes(value);
}

export function isGeofenceStatus(value: unknown): value is GeofenceStatus {
  return typeof value === 'string' && GEOFENCE_STATUSES.includes(value);
}

function isValidLatitude(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= -90 &&
    value <= 90
  );
}

function isValidLongitude(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= -180 &&
    value <= 180
  );
}

/** Narrow an arbitrary JSON value to an `AttendanceRequestBody`. */
export function isAttendanceRequestBody(
  value: unknown,
): value is AttendanceRequestBody {
  if (!isObject(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.employeeId) &&
    isNonEmptyString(value.employeeName) &&
    isAttendanceType(value.type) &&
    isValidLatitude(value.latitude) &&
    isValidLongitude(value.longitude)
  );
}

/** Narrow an arbitrary JSON value to a persisted `AttendanceRecord`. */
export function isAttendanceRecord(
  value: unknown,
): value is AttendanceRecord {
  if (!isObject(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.employeeId) &&
    isNonEmptyString(value.employeeName) &&
    isAttendanceType(value.type) &&
    isValidLatitude(value.latitude) &&
    isValidLongitude(value.longitude) &&
    typeof value.distanceMeters === 'number' &&
    Number.isFinite(value.distanceMeters) &&
    value.distanceMeters >= 0 &&
    isGeofenceStatus(value.status) &&
    isNonEmptyString(value.timestamp)
  );
}

/** Narrow an arbitrary JSON value to the `POST` success response. */
export function isAttendanceCreateSuccessResponse(
  value: unknown,
): value is AttendanceCreateSuccessResponse {
  return (
    isObject(value) &&
    value.success === true &&
    typeof value.message === 'string' &&
    isAttendanceRecord(value.data)
  );
}

/** Narrow an arbitrary JSON value to the `GET` list response. */
export function isAttendanceListResponse(
  value: unknown,
): value is AttendanceListResponse {
  return (
    isObject(value) &&
    value.success === true &&
    Array.isArray(value.data) &&
    value.data.every(isAttendanceRecord)
  );
}

/** Narrow an arbitrary JSON value to the shared error response. */
export function isAttendanceErrorResponse(
  value: unknown,
): value is AttendanceErrorResponse {
  return (
    isObject(value) && value.success === false && typeof value.error === 'string'
  );
}

/** Narrow an arbitrary JSON value to a `LoginRequest`. */
export function isLoginRequest(value: unknown): value is LoginRequest {
  return isObject(value) && isNonEmptyString(value.password);
}

/** Narrow an arbitrary JSON value to the sign-in success response. */
export function isAuthSuccessResponse(
  value: unknown,
): value is AuthSuccessResponse {
  return (
    isObject(value) &&
    value.success === true &&
    typeof value.message === 'string'
  );
}

/** Narrow an arbitrary JSON value to the sign-in error response. */
export function isAuthErrorResponse(
  value: unknown,
): value is AuthErrorResponse {
  return (
    isObject(value) && value.success === false && typeof value.error === 'string'
  );
}
