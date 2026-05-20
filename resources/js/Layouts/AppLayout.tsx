import { Link, router, usePage } from '@inertiajs/react';
import { Bell, CalendarCheck, ClipboardCheck, LogOut, Settings, Sparkles } from 'lucide-react';
import type React from 'react';
import type { PageProps } from '../types';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { auth, flash } = usePage<PageProps>().props;
  const user = auth.user;
  const canApprove = ['manager', 'hr', 'admin'].includes(user.role);
  const canAdmin = ['hr', 'admin'].includes(user.role);

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white px-4 py-5 lg:block">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-700 text-white">
            <CalendarCheck size={21} />
          </div>
          <div>
            <div className="font-semibold text-slate-950">ELMS</div>
            <div className="text-xs text-slate-500">Staff operations</div>
          </div>
        </div>
        <nav className="mt-8 space-y-1 text-sm">
          <Link className="flex items-center gap-2 rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100" href="/">
            <Bell size={17} /> Dashboard
          </Link>
          {canApprove && (
            <Link className="flex items-center gap-2 rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100" href="/approvals">
              <ClipboardCheck size={17} /> Approvals
            </Link>
          )}
          {canAdmin && (
            <Link className="flex items-center gap-2 rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100" href="/admin">
              <Settings size={17} /> HR Admin
            </Link>
          )}
        </nav>
        <button
          className="absolute bottom-5 left-4 right-4 flex items-center justify-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
          onClick={() => router.post('/logout')}
        >
          <LogOut size={17} /> Sign out
        </button>
      </aside>
      <main className="lg:pl-64">
        <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-slate-950">Employee Leave Management System</h1>
              <p className="text-sm text-slate-500">{user.name} · {user.department?.name ?? 'No department'} · {user.role}</p>
            </div>
            <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              <Sparkles size={16} /> Policy FAQ module active
            </div>
          </div>
          {flash.success && <div className="mt-3 rounded-md bg-emerald-100 px-3 py-2 text-sm text-emerald-900">{flash.success}</div>}
          {flash.error && <div className="mt-3 rounded-md bg-red-100 px-3 py-2 text-sm text-red-900">{flash.error}</div>}
        </header>
        <div className="px-4 py-6 sm:px-8">{children}</div>
      </main>
    </div>
  );
}
