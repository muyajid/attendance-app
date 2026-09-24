'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';

import {
  AlertTriangle,
  BadgeCheck,
  Building2,
  Crosshair,
  Loader2,
  LogIn,
  LogOut,
  MapPin,
  RefreshCw,
  UserCheck,
} from 'lucide-react';

import { OFFICE_CONFIG, verifyLocation } from '@/lib/geofence';
import {
  isAttendanceCreateSuccessResponse,
  isAttendanceErrorResponse,
} from '@/lib/validation';
import type { MapProps } from '@/components/Map';
import type {
  AttendanceType,
  Coordinates,
  FeedbackMessage,
  GeofenceVerification,
} from '@/types/attendance';

// Leaflet touches `window` during module evaluation, so it must never be
// server-rendered. `ssr: false` is only valid inside a Client Component.
// `MapProps` is passed explicitly so the props are checked rather than
// inferred from the dynamic import.
const GeofenceMap = dynamic<MapProps>(() => import('@/components/Map'), {
  ssr: false,
  loading: () => (
    <div className="mt-4 flex h-64 w-full items-center justify-center rounded-lg border border-dashed text-sm text-slate-500">
      Loading map...
    </div>
  ),
});

/**
 * The public clock-in/out page.
 *
 * Deliberately carries no recap: this is the URL shared with students, so it
 * renders only the punch form and the live geofence verdict. The records it
 * creates are readable exclusively from the protected admin recap.
 */
export default function Home(): React.JSX.Element {
  const [employeeId, setEmployeeId] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackMessage | null>(null);

  /**
   * Prompt the browser for a high-accuracy position fix.
   *
   * State is only ever written from the geolocation callbacks - never
   * synchronously - which keeps this safe to invoke directly from the mount
   * effect below.
   */
  const requestLocation = useCallback((): void => {
    if (!navigator.geolocation) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGpsError(null);
        setCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        setGpsError(
          `GPS error: ${error.message}. Please allow location access in your browser settings.`,
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }, []);

  // Acquire GPS as soon as the page mounts.
  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  /** Re-acquire the position from the UI, where state updates are allowed. */
  function refreshLocation(): void {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.');
      return;
    }
    setGpsError(null);
    requestLocation();
  }

  const liveVerification = useMemo<GeofenceVerification | null>(
    () => (coords === null ? null : verifyLocation(coords.lat, coords.lng)),
    [coords],
  );

  /** Submit a punch to the API. */
  async function handlePunch(type: AttendanceType): Promise<void> {
    if (employeeId.trim() === '' || employeeName.trim() === '') {
      setFeedback({
        type: 'error',
        text: 'Please fill in Employee ID and Full Name.',
      });
      return;
    }

    if (coords === null) {
      setFeedback({
        type: 'error',
        text: 'Location not acquired yet. Please allow GPS access.',
      });
      return;
    }

    setLoading(true);
    setFeedback(null);

    try {
      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: employeeId.trim(),
          employeeName: employeeName.trim(),
          type,
          latitude: coords.lat,
          longitude: coords.lng,
        }),
      });

      const payload: unknown = await response.json();

      if (isAttendanceCreateSuccessResponse(payload)) {
        setFeedback({ type: 'success', text: payload.message });
        return;
      }

      if (isAttendanceErrorResponse(payload)) {
        setFeedback({ type: 'error', text: payload.error });
        return;
      }

      setFeedback({
        type: 'error',
        text: 'Unexpected response from the attendance API.',
      });
    } catch {
      setFeedback({
        type: 'error',
        text: 'Network connection error. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 text-slate-900 md:p-8">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-xl border bg-white shadow-md">
        <header className="flex items-center gap-3 border-b bg-slate-900 px-6 py-5 text-white">
          <Building2 className="h-6 w-6 text-blue-400" />
          <div>
            <h1 className="text-lg font-bold">Location-Based Attendance</h1>
            <p className="text-sm text-slate-300">
              {OFFICE_CONFIG.name} &middot; {OFFICE_CONFIG.radiusMeters} m safe
              zone
            </p>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-2">
          <section>
            <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-slate-800">
              <UserCheck className="h-5 w-5 text-blue-600" /> Employee
              Attendance
            </h2>

            {feedback !== null && (
              <div
                role="status"
                className={`mb-4 rounded-lg border p-3 text-sm ${
                  feedback.type === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-red-200 bg-red-50 text-red-800'
                }`}
              >
                {feedback.text}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="employee-id"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  Employee ID
                </label>
                <input
                  id="employee-id"
                  type="text"
                  placeholder="e.g. EMP-101"
                  value={employeeId}
                  onChange={(event) => setEmployeeId(event.target.value)}
                  className="w-full rounded-lg border bg-white p-2 text-slate-900 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label
                  htmlFor="employee-name"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  Full Name
                </label>
                <input
                  id="employee-name"
                  type="text"
                  placeholder="e.g. Alex Morgan"
                  value={employeeName}
                  onChange={(event) => setEmployeeName(event.target.value)}
                  className="w-full rounded-lg border bg-white p-2 text-slate-900 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => void handlePunch('Clock In')}
                  disabled={loading || coords === null}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <LogIn className="h-4 w-4" />
                  )}
                  Clock In
                </button>
                <button
                  type="button"
                  onClick={() => void handlePunch('Clock Out')}
                  disabled={loading || coords === null}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-rose-600 py-2.5 font-medium text-white transition hover:bg-rose-700 disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <LogOut className="h-4 w-4" />
                  )}
                  Clock Out
                </button>
              </div>
            </div>
          </section>

          <section>
            <h2 className="mb-2 flex items-center gap-2 text-xl font-bold text-slate-800">
              <MapPin className="h-5 w-5 text-blue-600" /> Geofence
              Verification
            </h2>

            {gpsError !== null && (
              <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                {gpsError}
              </div>
            )}

            <div className="mb-3 space-y-2 text-sm text-slate-600">
              <p className="flex items-center gap-2">
                <Crosshair className="h-4 w-4 text-slate-400" />
                {coords === null
                  ? 'Acquiring GPS signal...'
                  : `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`}
              </p>

              {liveVerification !== null && (
                <p
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 font-medium ${
                    liveVerification.isWithinZone
                      ? 'border-blue-200 bg-blue-50 text-blue-800'
                      : 'border-amber-200 bg-amber-50 text-amber-800'
                  }`}
                >
                  {liveVerification.isWithinZone ? (
                    <BadgeCheck className="h-4 w-4" />
                  ) : (
                    <AlertTriangle className="h-4 w-4" />
                  )}
                  {liveVerification.status}
                  <span className="text-xs font-normal text-slate-500">
                    {liveVerification.distance} m from office
                  </span>
                </p>
              )}

              <button
                type="button"
                onClick={refreshLocation}
                className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Refresh location
              </button>
            </div>

            <GeofenceMap
              userLat={coords?.lat ?? null}
              userLng={coords?.lng ?? null}
            />
          </section>
        </div>
      </div>
    </main>
  );
}
