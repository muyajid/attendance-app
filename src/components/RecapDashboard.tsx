'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  AlertTriangle,
  BadgeCheck,
  Clock,
  ListFilter,
  LogIn,
  LogOut,
  RefreshCw,
  Users,
} from 'lucide-react';

import { isAttendanceListResponse } from '@/lib/validation';
import type { AttendanceRecord } from '@/types/attendance';

/** Aggregated numbers shown at the top of the admin recap. */
interface RecapStats {
  total: number;
  onSite: number;
  outOfBounds: number;
  clockIns: number;
  clockOuts: number;
}

interface RecapDashboardProps {
  /** Records rendered on the first paint, fetched by the server page. */
  initialRecords: AttendanceRecord[];
  /** `false` means the server is only holding records in memory. */
  durable: boolean;
}

const EMPTY_RECAP: RecapStats = {
  total: 0,
  onSite: 0,
  outOfBounds: 0,
  clockIns: 0,
  clockOuts: 0,
};

export function RecapDashboard({
  initialRecords,
  durable,
}: RecapDashboardProps): React.JSX.Element {
  const router = useRouter();
  const [records, setRecords] = useState<AttendanceRecord[]>(initialRecords);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recap = useMemo<RecapStats>(
    () =>
      records.reduce<RecapStats>(
        (stats, record) => ({
          total: stats.total + 1,
          onSite: stats.onSite + (record.status === 'On-Site' ? 1 : 0),
          outOfBounds:
            stats.outOfBounds + (record.status === 'Out of Bounds' ? 1 : 0),
          clockIns: stats.clockIns + (record.type === 'Clock In' ? 1 : 0),
          clockOuts: stats.clockOuts + (record.type === 'Clock Out' ? 1 : 0),
        }),
        EMPTY_RECAP,
      ),
    [records],
  );

  /**
   * Reload the recap. Started from the click handler rather than an effect,
   * so state is never written during render.
   */
  async function refresh(): Promise<void> {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/attendance');
      const payload: unknown = await response.json();

      if (isAttendanceListResponse(payload)) {
        setRecords(payload.data);
      } else {
        setError('Could not reload the records.');
      }
    } catch {
      setError('Network connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function signOut(): Promise<void> {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Clearing the cookie is best effort - the redirect below still leaves.
    }
    router.push('/login');
  }

  return (
    <div className="p-6">
      {!durable && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Records are being held in memory and disappear when the server
            restarts. Set DATABASE_URL to keep them.
          </span>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xl font-bold text-slate-800">
          <ListFilter className="h-5 w-5 text-blue-600" /> Attendance Recap
        </h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
            />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => void signOut()}
            className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </div>

      {error !== null && (
        <div
          role="status"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <RecapCard
          label="Total Records"
          value={recap.total}
          icon={<Clock className="h-4 w-4 text-blue-600" />}
        />
        <RecapCard
          label="On-Site"
          value={recap.onSite}
          icon={<BadgeCheck className="h-4 w-4 text-emerald-600" />}
        />
        <RecapCard
          label="Out of Bounds"
          value={recap.outOfBounds}
          icon={<AlertTriangle className="h-4 w-4 text-amber-600" />}
        />
        <RecapCard
          label="Clock Ins"
          value={recap.clockIns}
          icon={<LogIn className="h-4 w-4 text-slate-600" />}
        />
        <RecapCard
          label="Clock Outs"
          value={recap.clockOuts}
          icon={<LogOut className="h-4 w-4 text-slate-600" />}
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b bg-slate-100 text-slate-600">
              <th className="p-3 font-semibold">Time</th>
              <th className="p-3 font-semibold">Employee</th>
              <th className="p-3 font-semibold">Type</th>
              <th className="p-3 font-semibold">Distance</th>
              <th className="p-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-slate-500">
                  No records submitted yet.
                </td>
              </tr>
            ) : (
              records.map((record) => (
                <tr
                  key={record.id}
                  className="border-b transition hover:bg-slate-50"
                >
                  <td className="p-3 whitespace-nowrap text-slate-700">
                    {new Date(record.timestamp).toLocaleString()}
                  </td>
                  <td className="p-3 font-medium text-slate-800">
                    {record.employeeName}
                    <span className="block text-xs font-normal text-slate-500">
                      {record.employeeId}
                    </span>
                  </td>
                  <td className="p-3">
                    <span
                      className={`rounded px-2 py-1 text-xs font-semibold ${
                        record.type === 'Clock In'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {record.type}
                    </span>
                  </td>
                  <td className="p-3 whitespace-nowrap text-slate-600">
                    {record.distanceMeters} m
                  </td>
                  <td className="p-3">
                    <span
                      className={`rounded px-2 py-1 text-xs font-semibold ${
                        record.status === 'On-Site'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {record.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-4 flex items-center gap-2 text-xs text-slate-500">
        <Users className="h-3.5 w-3.5" />
        {recap.total} punch{recap.total === 1 ? '' : 'es'}, newest first.
      </p>
    </div>
  );
}

interface RecapCardProps {
  label: string;
  value: number;
  icon: React.JSX.Element;
}

function RecapCard({ label, value, icon }: RecapCardProps): React.JSX.Element {
  return (
    <div className="rounded-lg border bg-slate-50 p-3">
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold text-slate-800">{value}</div>
    </div>
  );
}
