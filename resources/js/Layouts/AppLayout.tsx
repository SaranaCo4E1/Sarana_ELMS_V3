import { Link, router, usePage } from '@inertiajs/react';
import { Bell, Bot, CalendarCheck, CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, ClipboardCheck, IdCard, LogOut, Menu, Settings, Sparkles, Users, X } from 'lucide-react';
import type React from 'react';
import { useState, useEffect } from 'react';
import type { PageProps } from '../types';
import { canAdminRole, canApproveRole, formatRole } from '../utils';

export default function AppLayout({ children, fullHeight }: { children: React.ReactNode; fullHeight?: boolean }) {
  const { auth, flash, notifications } = usePage<PageProps>().props;
  const { url } = usePage();
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [flashVisible, setFlashVisible] = useState(true);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('sidebar_collapsed');
        return saved ? JSON.parse(saved) : false;
      } catch (e) {
        return false;
      }
    }
    return false;
  });

  const toggleSidebar = () => {
    setCollapsed((prev: boolean) => {
      const next = !prev;
      try {
        localStorage.setItem('sidebar_collapsed', JSON.stringify(next));
      } catch (e) {
        // Ignore
      }
      return next;
    });
  };

  const user = auth.user;
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

  return (
    <div className="relative flex flex-col min-h-screen overflow-hidden bg-[#fafbfa]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-40 top-0 h-[32rem] w-[32rem] rounded-full bg-gradient-to-br from-orange-400/8 to-amber-500/8 blur-3xl" />
        <div className="absolute bottom-0 left-40 h-[24rem] w-[24rem] rounded-full bg-gradient-to-tr from-orange-400/5 to-amber-300/5 blur-3xl" />
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
          className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-md border border-neutral-200 text-neutral-500 hover:bg-neutral-50"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        >
          <X size={14} />
        </button>
        <NavContent />
      </aside>

      {/* Desktop Permanent Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-30 hidden border-r border-neutral-200/70 bg-white/90 backdrop-blur-md transition-all duration-300 ease-in-out lg:block ${
        collapsed ? 'w-20' : 'w-64'
      }`}>
        <NavContent isCollapsed={collapsed} />
        
        {/* Sidebar Toggle Button */}
        <button
          onClick={toggleSidebar}
          className="absolute -right-3 top-10 z-40 flex h-6.5 w-6.5 items-center justify-center rounded-full border border-neutral-200/85 bg-white text-neutral-500 shadow-premium-sm transition-all hover:bg-neutral-50 hover:text-neutral-800 cursor-pointer hover:scale-105 active:scale-95"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
        </button>
      </aside>

      {/* Main Container */}
      <div className={`relative z-10 flex flex-col h-screen min-w-0 transition-all duration-300 ease-in-out ${
        collapsed ? 'lg:pl-20' : 'lg:pl-64'
      }`}>
        {/* Top Navbar */}
        <header className="sticky top-0 z-20 border-b border-neutral-200/50 bg-white/80 backdrop-blur-md px-3 py-3 xs:px-4 sm:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                className="flex h-8 w-8 items-center justify-center rounded-md border border-neutral-200 text-neutral-600 hover:bg-neutral-50 lg:hidden"
                onClick={() => setMobileOpen(true)}
                aria-label="Open menu"
              >
                <Menu size={16} />
              </button>
              <div>
                <h1 className="text-base font-medium tracking-tight text-neutral-900">Leave Portal</h1>
                <p className="hidden text-sm font-medium text-neutral-400 sm:block">
                  {user.department?.name ?? 'General Staff'} · {user.employee_code ?? 'EMP'}
                </p>
              </div>
            </div>

            {/* Right Action Menu: Notifications */}
            <div className="flex items-center gap-2.5">
              <Link
                href="/ai-assistant"
                className="hidden items-center gap-2 rounded-lg border border-orange-100 bg-orange-50/70 px-4 py-1.5 text-sm font-medium text-orange-800 shadow-premium-sm transition-all hover:bg-orange-50 sm:inline-flex"
              >
                <Sparkles size={14} /> Ask Copilot
              </Link>
              <Link
                href="/apply-leave"
                className="hidden h-8 w-8 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-600 shadow-premium-sm transition-all hover:bg-neutral-50 md:flex"
                aria-label="Apply for leave"
              >
                <CalendarPlus size={15} />
              </Link>
              <div className="relative">
                <button
                  className={`relative flex h-8 w-8 items-center justify-center rounded-md border border-neutral-200 text-neutral-600 transition-all hover:bg-neutral-50 hover:border-neutral-300 shadow-premium-sm ${
                    notificationOpen ? 'bg-neutral-50' : 'bg-white'
                  }`}
                  onClick={() => setNotificationOpen((open) => !open)}
                  type="button"
                  aria-label="Open notifications"
                  aria-expanded={notificationOpen}
                >
                  <Bell size={16} />
                  {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-orange-600 px-1 text-xs font-medium text-white shadow-2xs">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {notificationOpen && (
                  <div className="absolute right-0 z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-neutral-200/50 bg-white p-2.5 shadow-premium-lg animate-fade-in">
                  <div className="flex items-center justify-between border-b border-neutral-100/60 px-3 pb-2.5 mb-1.5">
                    <span className="font-normal text-sm text-neutral-800">Notifications</span>
                    <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700 border border-orange-100">
                      {unreadCount} unread
                    </span>
                  </div>
                  <div className="max-h-80 overflow-y-auto mt-1 space-y-1">
                    {notificationItems.length > 0 ? (
                      notificationItems.map((item) => (
                        <Link
                          key={item.id}
                          className={`block w-full px-3 py-2.5 text-left rounded-lg transition-all hover:bg-neutral-50 ${
                            item.read_at ? '' : 'bg-neutral-50/40'
                          }`}
                          href={`/notifications/${item.id}/read`}
                          method="patch"
                          as="button"
                          onClick={() => setNotificationOpen(false)}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="text-sm font-medium text-neutral-700">{item.title}</div>
                            {!item.read_at && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-600" />}
                          </div>
                          <div className="mt-0.5 text-sm text-neutral-500 line-clamp-2">{item.body}</div>
                          <div className="mt-1.5 text-xs font-medium text-neutral-400">
                            {formatRelativeDate(item.created_at)}
                          </div>
                        </Link>
                      ))
                    ) : (
                      <div className="py-8 text-center text-sm text-neutral-400">No notifications yet.</div>
                    )}
                  </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Flash Messages */}
          {flashVisible && flash.success && (
            <div className="mt-3 flex items-center justify-between rounded-lg border border-orange-100 bg-orange-50/70 backdrop-blur-xs px-5 py-3.5 text-sm text-orange-800 font-medium shadow-premium-sm animate-fade-in">
              <span className="font-medium">{flash.success}</span>
              <button onClick={() => setFlashVisible(false)} className="text-orange-500 hover:text-orange-700">
                <X size={14} />
              </button>
            </div>
          )}
          {flashVisible && flash.error && (
            <div className="mt-3 flex items-center justify-between rounded-lg border border-rose-100 bg-rose-50/70 backdrop-blur-xs px-5 py-3.5 text-sm text-rose-800 font-medium shadow-premium-sm animate-fade-in">
              <span className="font-medium">{flash.error}</span>
              <button onClick={() => setFlashVisible(false)} className="text-rose-500 hover:text-rose-700">
                <X size={14} />
              </button>
            </div>
          )}
        </header>

        {/* Content Body */}
        <main className={fullHeight ? 'flex flex-col flex-1 min-h-0 overflow-hidden animate-fade-in' : 'min-w-0 px-3 py-5 xs:px-4 sm:px-8 max-w-7xl mx-auto w-full overflow-y-auto animate-fade-in'}>
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

interface NavContentProps {
  isCollapsed?: boolean;
}

function NavContent({ isCollapsed = false }: NavContentProps) {
  const { auth } = usePage<PageProps>().props;
  const { url } = usePage();
  const user = auth.user;
  const canApprove = canApproveRole(user.role);
  const canAdmin = canAdminRole(user.role);

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return url === '/dashboard';
    }
    return url.startsWith(path);
  };

  const navItemClass = (path: string, isCollapsed = false) => {
    const active = isActive(path);
    return `flex items-center transition-all duration-200 rounded-lg border ${
      isCollapsed
        ? 'justify-center h-10 w-10 p-0 mx-auto'
        : 'gap-3.5 px-4.5 py-3 text-sm mx-2'
    } ${
      active
        ? 'bg-orange-50 bg-orange-50/50 border-orange-100/60 text-orange-800 font-medium shadow-premium-sm'
        : 'text-neutral-500 border-transparent hover:text-neutral-800 hover:bg-neutral-50/40 font-normal'
    }`;
  };

  return (
    <div className="flex h-full flex-col justify-between py-6 bg-white">
      <div>
        <div className={`flex items-center gap-3 px-6 transition-all duration-300 ${isCollapsed ? 'justify-center px-0' : ''}`}>
          <div className="flex h-8.5 w-8.5 items-center justify-center rounded-lg bg-orange-600 text-white shadow-md shadow-orange-600/10 border border-orange-500/10 shrink-0">
            <Bot size={16} />
          </div>
          {!isCollapsed && (
            <div className="animate-fade-in whitespace-nowrap">
              <div className="font-medium tracking-tight text-neutral-900 text-sm">NiyAI ELMS</div>
              <div className="text-xs font-normal text-neutral-400 uppercase tracking-wider mt-0.5">Workspace</div>
            </div>
          )}
        </div>

        <nav className="mt-8 space-y-1">
          <Link className={navItemClass('/dashboard', isCollapsed)} href="/dashboard" title={isCollapsed ? "Dashboard" : undefined}>
            <CalendarCheck size={16} className="shrink-0" />
            {!isCollapsed && <span className="animate-fade-in whitespace-nowrap">Dashboard</span>}
          </Link>
          <Link className={navItemClass('/calendar', isCollapsed)} href="/calendar" title={isCollapsed ? "Calendar" : undefined}>
            <CalendarDays size={16} className="shrink-0" />
            {!isCollapsed && <span className="animate-fade-in whitespace-nowrap">Calendar</span>}
          </Link>
          <Link className={navItemClass('/apply-leave', isCollapsed)} href="/apply-leave" title={isCollapsed ? "Apply Leave" : undefined}>
            <CalendarPlus size={16} className="shrink-0" />
            {!isCollapsed && <span className="animate-fade-in whitespace-nowrap">Apply Leave</span>}
          </Link>
          <Link className={navItemClass('/ai-assistant', isCollapsed)} href="/ai-assistant" title={isCollapsed ? "ELMS Copilot" : undefined}>
            <Bot size={16} className="shrink-0" />
            {!isCollapsed && <span className="animate-fade-in whitespace-nowrap">ELMS Copilot</span>}
          </Link>
          <Link className={navItemClass('/profile', isCollapsed)} href="/profile" title={isCollapsed ? "My Profile" : undefined}>
            <IdCard size={16} className="shrink-0" />
            {!isCollapsed && <span className="animate-fade-in whitespace-nowrap">My Profile</span>}
          </Link>
          
          {(canApprove || canAdmin) && (
            <div className={`my-5 border-t border-neutral-100 pt-5 transition-all duration-300 ${isCollapsed ? 'px-3' : 'px-6'}`}>
              {!isCollapsed ? (
                <span className="text-xs font-medium uppercase tracking-wider text-neutral-400 animate-fade-in whitespace-nowrap">Management</span>
              ) : (
                <div className="h-px bg-neutral-100 -mx-3" />
              )}
            </div>
          )}

          {canApprove && (
            <Link className={navItemClass('/team', isCollapsed)} href="/team" title={isCollapsed ? "Team Center" : undefined}>
              <Users size={16} className="shrink-0" />
              {!isCollapsed && <span className="animate-fade-in whitespace-nowrap">Team Center</span>}
            </Link>
          )}
          {canApprove && (
            <Link className={`${navItemClass('/approvals', isCollapsed)} relative ${!isCollapsed ? '!justify-between' : ''}`} href="/approvals" title={isCollapsed ? `Approvals (${auth.pending_approvals_count} pending)` : undefined}>
              <div className="flex items-center gap-3.5">
                <div className="relative">
                  <ClipboardCheck size={16} className="shrink-0" />
                  {isCollapsed && auth.pending_approvals_count > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-orange-600 text-[8px] font-bold text-white ring-2 ring-white">
                      {auth.pending_approvals_count}
                    </span>
                  )}
                </div>
                {!isCollapsed && <span className="animate-fade-in whitespace-nowrap">Approvals</span>}
              </div>
              {!isCollapsed && auth.pending_approvals_count > 0 && (
                <span className="inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-orange-600 px-1 text-[10px] font-semibold text-white shadow-premium-sm">
                  {auth.pending_approvals_count}
                </span>
              )}
            </Link>
          )}
          {canAdmin && (
            <Link className={navItemClass('/admin', isCollapsed)} href="/admin" title={isCollapsed ? "HR Admin" : undefined}>
              <Settings size={16} className="shrink-0" />
              {!isCollapsed && <span className="animate-fade-in whitespace-nowrap">HR Admin</span>}
            </Link>
          )}
        </nav>
      </div>

      <div className={`px-4 transition-all duration-300 ${isCollapsed ? 'px-2 flex flex-col items-center gap-4' : ''}`}>
        {/* User Mini Profile Card */}
        {isCollapsed ? (
          <div 
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 border border-orange-100 font-normal text-orange-800 text-sm shadow-premium-sm shrink-0 cursor-pointer hover:bg-orange-100/50 transition-colors"
            title={`${user.name} (${formatRole(user.role)})`}
          >
            {user.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
          </div>
        ) : (
          <div className="mb-5 flex items-center gap-4 border border-neutral-200 bg-[#fafbfa]/70 rounded-xl p-4 shadow-premium-sm animate-fade-in">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50 border border-orange-100 font-normal text-orange-800 text-sm shadow-inner shrink-0">
              {user.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-normal text-neutral-800">{user.name}</div>
              <div className="truncate text-xs font-normal text-neutral-400 uppercase tracking-wider mt-1">{formatRole(user.role)}</div>
            </div>
          </div>
        )}

        <button
          className={`flex items-center justify-center rounded-lg border border-neutral-200 bg-white text-sm font-medium text-neutral-500 transition-all hover:bg-neutral-50 hover:text-neutral-800 shadow-premium-sm active:scale-98 cursor-pointer ${
            isCollapsed ? 'h-10 w-10 px-0 py-0 shrink-0' : 'w-full px-4 py-3 gap-2'
          }`}
          onClick={() => router.post('/logout')}
          title={isCollapsed ? "Sign out" : undefined}
        >
          <LogOut size={14} /> {!isCollapsed && <span>Sign out</span>}
        </button>
      </div>
    </div>
  );
}
