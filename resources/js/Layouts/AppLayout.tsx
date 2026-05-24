import { Link, router, usePage } from '@inertiajs/react';
import { Bell, Bot, CalendarCheck, CalendarDays, CalendarPlus, ClipboardCheck, IdCard, LogOut, Menu, Settings, Sparkles, Users, X } from 'lucide-react';
import type React from 'react';
import { useState, useEffect } from 'react';
import type { PageProps } from '../types';

export default function AppLayout({ children, fullHeight }: { children: React.ReactNode; fullHeight?: boolean }) {
  const { auth, flash, notifications } = usePage<PageProps>().props;
  const { url } = usePage();
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [flashVisible, setFlashVisible] = useState(true);

  const user = auth.user;
  const canApprove = ['manager', 'hr', 'admin'].includes(user.role);
  const canAdmin = ['hr', 'admin'].includes(user.role);
  const unreadCount = notifications?.unread_count ?? 0;
  const notificationItems = notifications?.items ?? [];

  // Reset flash visibility when flash changes
  useEffect(() => {
    if (flash.success || flash.error) {
      setFlashVisible(true);
    }
  }, [flash]);

  // Close mobile menu on navigate
  useEffect(() => {
    setMobileOpen(false);
  }, [url]);

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return url === '/dashboard';
    }
    return url.startsWith(path);
  };

  const navItemClass = (path: string) => {
    const active = isActive(path);
    return `flex items-center gap-3.5 px-4.5 py-3 text-sm transition-all duration-200 rounded-xl mx-2 border ${
      active
        ? 'bg-emerald-55 bg-emerald-50/50 border-emerald-100/60 text-emerald-800 font-semibold shadow-premium-sm'
        : 'text-neutral-500 border-transparent hover:text-neutral-800 hover:bg-neutral-50/40 font-medium'
    }`;
  };

  const NavContent = () => (
    <div className="flex h-full flex-col justify-between py-6 bg-white">
      <div>
        <div className="flex items-center gap-3 px-6">
          <div className="flex h-8.5 w-8.5 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-600/10 border border-emerald-500/10">
            <Bot size={16} />
          </div>
          <div>
            <div className="font-semibold tracking-tight text-neutral-900 text-sm">NiyAI ELMS</div>
            <div className="text-[10px] font-semibold text-neutral-400 uppercase tracking-widest mt-0.5">Workspace</div>
          </div>
        </div>

        <nav className="mt-8 space-y-1">
          <Link className={navItemClass('/dashboard')} href="/dashboard">
            <CalendarCheck size={16} className="shrink-0 text-neutral-400 group-hover:text-neutral-700" /> Dashboard
          </Link>
          <Link className={navItemClass('/calendar')} href="/calendar">
            <CalendarDays size={16} className="shrink-0 text-neutral-400 group-hover:text-neutral-700" /> Calendar
          </Link>
          <Link className={navItemClass('/apply-leave')} href="/apply-leave">
            <CalendarPlus size={16} className="shrink-0 text-neutral-400 group-hover:text-neutral-700" /> Apply Leave
          </Link>
          <Link className={navItemClass('/ai-assistant')} href="/ai-assistant">
            <Bot size={16} className="shrink-0 text-neutral-400 group-hover:text-neutral-700" /> ELMS Copilot
          </Link>
          <Link className={navItemClass('/profile')} href="/profile">
            <IdCard size={16} className="shrink-0 text-neutral-400 group-hover:text-neutral-700" /> My Profile
          </Link>
          
          {(canApprove || canAdmin) && (
            <div className="my-4 border-t border-neutral-100 px-6 pt-4">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">Management</span>
            </div>
          )}

          {canApprove && (
            <Link className={navItemClass('/team')} href="/team">
              <Users size={16} className="shrink-0" /> Team Center
            </Link>
          )}
          {canApprove && (
            <Link className={navItemClass('/approvals')} href="/approvals">
              <ClipboardCheck size={16} className="shrink-0" /> Approvals
            </Link>
          )}
          {canAdmin && (
            <Link className={navItemClass('/admin')} href="/admin">
              <Settings size={16} className="shrink-0" /> HR Admin
            </Link>
          )}
        </nav>
      </div>

      <div className="px-4">
        {/* User Mini Profile Card */}
        <div className="mb-4 flex items-center gap-3.5 border border-neutral-200 bg-[#fafbfa]/70 rounded-2xl p-3.5 shadow-premium-sm">
          <div className="flex h-8.5 w-8.5 items-center justify-center rounded-xl bg-emerald-50 border border-emerald-100 font-semibold text-emerald-800 text-xs shadow-inner shrink-0">
            {user.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-semibold text-neutral-800">{user.name}</div>
            <div className="truncate text-[10px] font-semibold text-neutral-450 uppercase tracking-widest mt-1">{user.role}</div>
          </div>
        </div>

        <button
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-500 transition-all hover:bg-neutral-50 hover:text-neutral-800 shadow-premium-sm active:scale-98"
          onClick={() => router.post('/logout')}
        >
          <LogOut size={14} /> Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="relative flex flex-col min-h-screen overflow-hidden bg-[#fafbfa]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-40 top-0 h-[32rem] w-[32rem] rounded-full bg-gradient-to-br from-emerald-400/8 to-teal-500/8 blur-3xl" />
        <div className="absolute bottom-0 left-40 h-[24rem] w-[24rem] rounded-full bg-gradient-to-tr from-emerald-400/5 to-amber-300/5 blur-3xl" />
      </div>
      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-neutral-800/15 transition-opacity duration-300 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Drawer Menu */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 transform bg-white border-r border-neutral-200 transition-transform duration-200 ease-in-out lg:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <button
          className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 hover:bg-neutral-50"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        >
          <X size={14} />
        </button>
        <NavContent />
      </aside>

      {/* Desktop Permanent Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-neutral-200/70 bg-white/90 backdrop-blur-md lg:block">
        <NavContent />
      </aside>

      {/* Main Container */}
      <div className="relative z-10 lg:pl-64 flex flex-col h-screen">
        {/* Top Navbar */}
        <header className="sticky top-0 z-20 border-b border-neutral-200/50 bg-white/80 backdrop-blur-md px-4 py-3 sm:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-50 lg:hidden"
                onClick={() => setMobileOpen(true)}
                aria-label="Open menu"
              >
                <Menu size={16} />
              </button>
              <div>
                <h1 className="text-base font-semibold tracking-tight text-neutral-900">Leave Portal</h1>
                <p className="hidden text-xs font-medium text-neutral-450 sm:block">
                  {user.department?.name ?? 'General Staff'} · {user.employee_code ?? 'EMP'}
                </p>
              </div>
            </div>

            {/* Right Action Menu: Notifications */}
            <div className="flex items-center gap-2.5">
              <Link
                href="/ai-assistant"
                className="hidden items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50/70 px-3.5 py-2 text-xs font-semibold text-emerald-800 shadow-premium-sm transition-all hover:bg-emerald-50 sm:inline-flex"
              >
                <Sparkles size={13} /> Ask Copilot
              </Link>
              <Link
                href="/apply-leave"
                className="hidden h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-600 shadow-premium-sm transition-all hover:bg-neutral-50 md:flex"
                aria-label="Apply for leave"
              >
                <CalendarPlus size={15} />
              </Link>
              <div className="relative">
                <button
                  className={`relative flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 transition-all hover:bg-neutral-50 hover:border-neutral-300 shadow-premium-sm ${
                    notificationOpen ? 'bg-neutral-50' : 'bg-white'
                  }`}
                  onClick={() => setNotificationOpen((open) => !open)}
                  type="button"
                  aria-label="Open notifications"
                  aria-expanded={notificationOpen}
                >
                  <Bell size={16} />
                  {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-semibold text-white shadow-2xs">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {notificationOpen && (
                  <div className="absolute right-0 z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-neutral-200/50 bg-white p-2.5 shadow-premium-lg animate-fade-in">
                  <div className="flex items-center justify-between border-b border-neutral-100/60 px-3 pb-2.5 mb-1.5">
                    <span className="font-semibold text-xs text-neutral-800">Notifications</span>
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-100">
                      {unreadCount} unread
                    </span>
                  </div>
                  <div className="max-h-80 overflow-y-auto mt-1 space-y-1">
                    {notificationItems.length > 0 ? (
                      notificationItems.map((item) => (
                        <Link
                          key={item.id}
                          className={`block w-full px-3 py-2.5 text-left rounded-xl transition-all hover:bg-neutral-50 ${
                            item.read_at ? '' : 'bg-neutral-50/40'
                          }`}
                          href={`/notifications/${item.id}/read`}
                          method="patch"
                          as="button"
                          onClick={() => setNotificationOpen(false)}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="text-xs font-semibold text-neutral-750">{item.title}</div>
                            {!item.read_at && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600" />}
                          </div>
                          <div className="mt-0.5 text-xs text-neutral-500 line-clamp-2">{item.body}</div>
                          <div className="mt-1.5 text-xs font-medium text-neutral-400">
                            {formatRelativeDate(item.created_at)}
                          </div>
                        </Link>
                      ))
                    ) : (
                      <div className="py-8 text-center text-xs text-neutral-400">No notifications yet.</div>
                    )}
                  </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Flash Messages */}
          {flashVisible && flash.success && (
            <div className="mt-3 flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50/70 backdrop-blur-xs px-4.5 py-3 text-xs text-emerald-800 font-semibold shadow-premium-sm animate-fade-in">
              <span className="font-semibold">{flash.success}</span>
              <button onClick={() => setFlashVisible(false)} className="text-emerald-500 hover:text-emerald-700">
                <X size={14} />
              </button>
            </div>
          )}
          {flashVisible && flash.error && (
            <div className="mt-3 flex items-center justify-between rounded-xl border border-rose-100 bg-rose-50/70 backdrop-blur-xs px-4.5 py-3 text-xs text-rose-800 font-semibold shadow-premium-sm animate-fade-in">
              <span className="font-semibold">{flash.error}</span>
              <button onClick={() => setFlashVisible(false)} className="text-rose-500 hover:text-rose-700">
                <X size={14} />
              </button>
            </div>
          )}
        </header>

        {/* Content Body */}
        <main className={fullHeight ? 'flex flex-col flex-1 min-h-0 overflow-hidden animate-fade-in' : 'px-4 py-6 sm:px-8 max-w-7xl mx-auto w-full overflow-y-auto animate-fade-in'}>
          {children}
        </main>
      </div>
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
