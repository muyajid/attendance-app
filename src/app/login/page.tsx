'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Loader2, LogIn, ShieldCheck } from 'lucide-react';

import { isAuthErrorResponse, isAuthSuccessResponse } from '@/lib/validation';

/**
 * Admin sign-in form.
 *
 * The password is the only credential, so nothing sensitive is persisted on
 * the client: the session arrives as an httpOnly cookie this page cannot read
 * or copy.
 */
export default function LoginPage(): React.JSX.Element {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const payload: unknown = await response.json();

      if (isAuthSuccessResponse(payload)) {
        router.push('/admin');
        return;
      }

      if (isAuthErrorResponse(payload)) {
        setError(payload.error);
        return;
      }

      setError('Unexpected response from the server.');
    } catch {
      setError('Network connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4 text-slate-900">
      <div className="w-full max-w-sm rounded-xl border bg-white p-6 shadow-md">
        <div className="mb-5 flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-blue-600" />
          <div>
            <h1 className="text-lg font-bold">Admin Recap</h1>
            <p className="text-sm text-slate-500">
              Sign in to review attendance records.
            </p>
          </div>
        </div>

        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="space-y-4"
        >
          <div>
            <label
              htmlFor="admin-password"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Password
            </label>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border bg-white p-2 text-slate-900 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error !== null && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || password.length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogIn className="h-4 w-4" />
            )}
            Sign in
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-500">
          Need to punch in instead?{' '}
          <Link href="/" className="font-medium text-blue-600 hover:underline">
            Open the clock page
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
