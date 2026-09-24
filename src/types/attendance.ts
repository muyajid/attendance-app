/**
 * Shared, strictly-typed contract between the attendance API and the UI.
 *
 * Keeping these in a single module guarantees the client and the server can
 * never drift apart on the shape of an attendance payload.
 */

/** The two mutually exclusive punch actions an employee can perform. */
export type AttendanceType = 'Clock In' | 'Clock Out';

/** Result of evaluating a coordinate against the office geofence. */
export type GeofenceStatus = 'On-Site' | 'Out of Bounds';

/** A WGS84 coordinate pair captured from the device geolocation API. */
export interface Coordinates {
  lat: number;
  lng: number;
}

/** A single persisted attendance punch. */
export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  type: AttendanceType;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  status: GeofenceStatus;
  timestamp: string;
}

/** The exact JSON body accepted by `POST /api/attendance`. */
export interface AttendanceRequestBody {
  employeeId: string;
  employeeName: string;
  type: AttendanceType;
  latitude: number;
  longitude: number;
}

/** The return value of `verifyLocation`. */
export interface GeofenceVerification {
  isWithinZone: boolean;
  distance: number;
  status: GeofenceStatus;
}

/** `201` response returned after a punch is recorded. */
export interface AttendanceCreateSuccessResponse {
  success: true;
  message: string;
  data: AttendanceRecord;
}

/** `200` response returned by `GET /api/attendance`, newest punch first. */
export interface AttendanceListResponse {
  success: true;
  data: AttendanceRecord[];
}

/** Response returned for every non-2xx outcome. */
export interface AttendanceErrorResponse {
  success: false;
  error: string;
}

/** Discriminated union covering every possible `/api/attendance` response. */
export type AttendanceApiResponse =
  | AttendanceCreateSuccessResponse
  | AttendanceListResponse
  | AttendanceErrorResponse;

/** Transient UI feedback shown after a punch attempt. */
export interface FeedbackMessage {
  type: 'success' | 'error';
  text: string;
}
