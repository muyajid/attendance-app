import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';

import { RecapDashboard } from '@/components/RecapDashboard';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/auth';
import { getStore, isDurableStorage } from '@/lib/db';

/**
 * The admin-only recap page.
 *
 * Reading `cookies()` is what forces this route to render per request - without
 * it Next would prerender the table at build time and the numbers would never
 * move. The proxy already redirects anonymous visitors, and re-checking here
 * means the records cannot be rendered even if that matcher is edited later.
 */
export default async function AdminPage(): Promise<React.JSX.Element> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token === undefined || !verifySessionToken(token)) {
    redirect('/login');
  }

  const records = await getStore().list();

  return (
    <main className="min-h-screen bg-slate-50 p-4 text-slate-900 md:p-8">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-xl border bg-white shadow-md">
        <header className="flex items-center gap-3 border-b bg-slate-900 px-6 py-5 text-white">
          <ShieldCheck className="h-6 w-6 text-blue-400" />
          <div>
            <h1 className="text-lg font-bold">Location-Based Attendance</h1>
            <p className="text-sm text-slate-300">Admin recap &middot; private</p>
          </div>
        </header>

        <RecapDashboard initialRecords={records} durable={isDurableStorage()} />
      </div>
    </main>
  );
}
