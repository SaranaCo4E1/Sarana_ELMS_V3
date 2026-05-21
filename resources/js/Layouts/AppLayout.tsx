import { Link, router, usePage } from '@inertiajs/react';
import { Bell, Bot, CalendarCheck, CalendarDays, CalendarPlus, ClipboardCheck, IdCard, LogOut, Settings, Users } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import type { PageProps } from '../types';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { auth, flash, notifications } = usePage<PageProps>().props;
  const [notificationOpen, setNotificationOpen] = useState(false);
  const user = auth.user;
  const canApprove = ['manager', 'hr', 'admin'].includes(user.role);
  const canAdmin = ['hr', 'admin'].includes(user.role);
  const unreadCount = notifications?.unread_count ?? 0;
  const notificationItems = notifications?.items ?? [];

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
          <Link className="flex items-center gap-2 rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100" href="/calendar">
            <CalendarDays size={17} /> Calendar
          </Link>
          <Link className="flex items-center gap-2 rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100" href="/apply-leave">
            <CalendarPlus size={17} /> Apply Leave
          </Link>
          <Link className="flex items-center gap-2 rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100" href="/ai-assistant">
            <Bot size={17} /> AI Chatbot
          </Link>
          <Link className="flex items-center gap-2 rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100" href="/profile">
            <IdCard size={17} /> My Profile
          </Link>
          {canApprove && (
            <Link className="flex items-center gap-2 rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100" href="/team">
              <Users size={17} /> Team Center
            </Link>
          )}
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
            <div className="relative">
              <button
                className="relative flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                onClick={() => setNotificationOpen((open) => !open)}
                type="button"
                aria-label="Open notifications"
                aria-expanded={notificationOpen}
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-rose-600 px-1.5 text-xs font-semibold text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              {notificationOpen && (
                <div className="absolute right-0 z-20 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-md border border-slate-200 bg-white shadow-xl">
                  <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                    <div className="font-semibold text-slate-950">Notifications</div>
                    <div className="text-xs text-slate-500">{unreadCount} unread</div>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notificationItems.length > 0 ? notificationItems.map((item) => (
                      <Link
                        key={item.id}
                        className={`block w-full border-b border-slate-100 px-4 py-3 text-left last:border-b-0 hover:bg-slate-50 ${item.read_at ? '' : 'bg-sky-50/70'}`}
                        href={`/notifications/${item.id}/read`}
                        method="patch"
                        as="button"
                        onClick={() => setNotificationOpen(false)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="text-sm font-medium text-slate-950">{item.title}</div>
                          {!item.read_at && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-sky-600" />}
                        </div>
                        <div className="mt-1 text-sm text-slate-600">{item.body}</div>
                        <div className="mt-2 text-xs text-slate-400">{formatRelativeDate(item.created_at)}</div>
                      </Link>
                    )) : (
                      <div className="px-4 py-8 text-center text-sm text-slate-500">No notifications yet.</div>
                    )}
                  </div>
                </div>
              )}
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

function formatRelativeDate(value: string) {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
