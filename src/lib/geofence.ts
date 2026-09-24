import { getDistance } from 'geolib';

import type { GeofenceVerification } from '@/types/attendance';

/**
 * Office geofence configuration.
 *
 * Defaults match the office at Lat -6.200000 / Lng 106.816666 with a 100 m
 * safe zone. Every value can be overridden through `NEXT_PUBLIC_*` variables
 * so the same configuration is inlined into both the server bundle (used by
 * the API route) and the browser bundle (used by the map).
 */
function readCoordinate(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const OFFICE_CONFIG = {
  name: process.env.NEXT_PUBLIC_OFFICE_NAME ?? 'Headquarters',
  latitude: readCoordinate(process.env.NEXT_PUBLIC_OFFICE_LAT, -6.2),
  longitude: readCoordinate(process.env.NEXT_PUBLIC_OFFICE_LNG, 106.816666),
  radiusMeters: readCoordinate(process.env.NEXT_PUBLIC_OFFICE_RADIUS, 100),
} as const;

/**
 * Measures the distance between a user coordinate and the office center and
 * reports whether the user is inside the configured safe zone.
 *
 * @param userLat - Latitude reported by the device, in degrees.
 * @param userLng - Longitude reported by the device, in degrees.
 * @returns Whole-meter distance plus the derived on-site verdict.
 */
export function verifyLocation(
  userLat: number,
  userLng: number,
): GeofenceVerification {
  const distance = getDistance(
    { latitude: userLat, longitude: userLng },
    { latitude: OFFICE_CONFIG.latitude, longitude: OFFICE_CONFIG.longitude },
  );

  const isWithinZone = distance <= OFFICE_CONFIG.radiusMeters;

  return {
    isWithinZone,
    distance,
    status: isWithinZone ? 'On-Site' : 'Out of Bounds',
  };
}
