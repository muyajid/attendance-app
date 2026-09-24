import { randomUUID } from 'node:crypto';

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/auth';
import { getStore } from '@/lib/db';
import { verifyLocation } from '@/lib/geofence';
import { isAttendanceRequestBody } from '@/lib/validation';
import type {
  AttendanceCreateSuccessResponse,
  AttendanceErrorResponse,
  AttendanceListResponse,
  AttendanceRecord,
} from '@/types/attendance';

/**
 * Both handlers read and mutate data at request time, so neither may be
 * prerendered or served from the route cache.
 */
export const dynamic = 'force-dynamic';

const INVALID_BODY_ERROR =
  'Invalid payload. Expected employeeId, employeeName, type ("Clock In" | "Clock Out"), latitude and longitude.';

const UNAUTHORIZED_ERROR = 'Unauthorized.';

function badRequest(): NextResponse<AttendanceErrorResponse> {
  return NextResponse.json<AttendanceErrorResponse>(
    { success: false, error: INVALID_BODY_ERROR },
    { status: 400 },
  );
}

function unauthorized(): NextResponse<AttendanceErrorResponse> {
  return NextResponse.json<AttendanceErrorResponse>(
    { success: false, error: UNAUTHORIZED_ERROR },
    { status: 401 },
  );
}

/**
 * `POST /api/attendance` - verify a punch against the office geofence and
 * persist it. Intentionally reachable without a session: this is the endpoint
 * students use to clock in.
 */
export async function POST(
  request: Request,
): Promise<NextResponse<AttendanceCreateSuccessResponse | AttendanceErrorResponse>> {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json<AttendanceErrorResponse>(
      { success: false, error: 'Request body must be valid JSON.' },
      { status: 400 },
    );
  }

  if (!isAttendanceRequestBody(payload)) {
    return badRequest();
  }

  try {
    const verification = verifyLocation(payload.latitude, payload.longitude);

    const record: AttendanceRecord = {
      id: randomUUID(),
      employeeId: payload.employeeId.trim(),
      employeeName: payload.employeeName.trim(),
      type: payload.type,
      latitude: payload.latitude,
      longitude: payload.longitude,
      distanceMeters: verification.distance,
      status: verification.status,
      timestamp: new Date().toISOString(),
    };

    await getStore().insert(record);

    return NextResponse.json<AttendanceCreateSuccessResponse>(
      {
        success: true,
        message: `${record.type} recorded successfully as ${verification.status}`,
        data: record,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Failed to persist attendance record:', error);
    return NextResponse.json<AttendanceErrorResponse>(
      { success: false, error: 'Failed to record attendance.' },
      { status: 500 },
    );
  }
}

/**
 * `GET /api/attendance` - every stored punch, newest first.
 *
 * The proxy already rejects anonymous callers, but the check is repeated next
 * to the data so a later matcher change can never expose the recap feed.
 */
export async function GET(): Promise<
  NextResponse<AttendanceListResponse | AttendanceErrorResponse>
> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token === undefined || !verifySessionToken(token)) {
    return unauthorized();
  }

  try {
    const records = await getStore().list();
    return NextResponse.json<AttendanceListResponse>({
      success: true,
      data: records,
    });
  } catch (error) {
    console.error('Failed to load attendance records:', error);
    return NextResponse.json<AttendanceErrorResponse>(
      { success: false, error: 'Failed to load attendance records.' },
      { status: 500 },
    );
  }
}
