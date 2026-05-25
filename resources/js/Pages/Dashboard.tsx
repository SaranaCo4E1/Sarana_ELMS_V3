import { Link, router, usePage } from '@inertiajs/react';
import { AlertCircle, CalendarClock, CalendarPlus, CheckCircle2, Clock3, FileText, Search, Users, X, CalendarDays } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import AppLayout from '../Layouts/AppLayout';
import type { LeaveBalance, LeaveRequest, PageProps, SystemNotification, User, PublicHoliday } from '../types';
import { formatDays, formatShortDate } from '../utils';

type Props = {
  balances: LeaveBalance[];
  requests: LeaveRequest[];
  requestStats: { pending: number; approved: number; rejected: number; cancelled: number; scheduled_days: number };
  pendingApprovals: LeaveRequest[];
  teamMembers: User[];
  systemAlerts: SystemNotification[];
  upcomingHolidays: PublicHoliday[];
  myUpcomingLeaves: LeaveRequest[];
  teamUpcomingLeaves: LeaveRequest[];
};

const statusStyles: Record<string, { bg: string; border: string; text: string }> = {
  pending: { bg: 'bg-amber-50/60', border: 'border-amber-100/70', text: 'text-amber-800' },
  approved: { bg: 'bg-emerald-50/60', border: 'border-emerald-100/70', text: 'text-emerald-800' },
  rejected: { bg: 'bg-rose-50/60', border: 'border-rose-100/70', text: 'text-rose-800' },
  cancelled: { bg: 'bg-neutral-50/60', border: 'border-neutral-200/70', text: 'text-neutral-500' },
};

export const getLeaveColor = (code: string) => {
  const c = code.toLowerCase();
  if (c === 'al' || c.includes('annual')) {
    return { dot: 'bg-blue-500', bar: 'bg-blue-500' };
  }
  if (c === 'sl' || c.includes('sick')) {
    return { dot: 'bg-red-500', bar: 'bg-red-500' };
  }
  if (c === 'el' || c.includes('emerg') || c.includes('cas')) {
    return { dot: 'bg-amber-500', bar: 'bg-amber-500' };
  }
  return { dot: 'bg-indigo-500', bar: 'bg-indigo-500' };
};

export default function Dashboard({
  balances,
  requests,
  requestStats,
  pendingApprovals,
  teamMembers,
  systemAlerts,
  upcomingHolidays = [],
  myUpcomingLeaves = [],
  teamUpcomingLeaves = [],
}: Props) {
  const { auth } = usePage<PageProps>().props;
  const [statusFilter, setStatusFilter] = useState('all');
  const [query, setQuery] = useState('');

  const filteredRequests = requests.filter((request) => {
    const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
    const haystack = `${request.leave_type.name} ${request.reason} ${request.manager_comment ?? ''}`.toLowerCase();
    return matchesStatus && haystack.includes(query.toLowerCase());
  });

  return (
    <AppLayout>
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        {/* Left main section */}
        <section className="space-y-6">
          {/* Metrics section */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
            <Metric icon={<Clock3 size={15} />} label="Pending Requests" value={requestStats.pending} variant="amber" />
            <Metric icon={<CheckCircle2 size={15} />} label="Approved Requests" value={requestStats.approved} variant="emerald" />
            <Metric icon={<AlertCircle size={15} />} label="Rejected Requests" value={requestStats.rejected} variant="rose" />
            <Metric icon={<CalendarClock size={15} />} label="Scheduled Days" value={formatDays(requestStats.scheduled_days)} variant="indigo" />
          </div>

          {/* Leave Balances Cards Grid */}
          <div>
            <div className="mb-5">
              <h2 className="text-base font-semibold text-neutral-850">Leave Balance</h2>
              <p className="text-xs font-medium text-neutral-450 mt-1">Your available quotas for the current calendar year</p>
            </div>
            <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
              {balances.map((balance) => {
                const avail = Number(balance.available_days);
                const allowance = Math.max(1, Number(balance.allowance_days));
                const used = Number(balance.used_days);
                const percent = Math.min(100, (avail / allowance) * 100);
                const color = getLeaveColor(balance.leave_type.code);

                return (
                  <div key={balance.id} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-premium-sm hover:shadow-premium-md transition-all duration-300">
                    {/* Top Row */}
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <div className="flex items-center gap-2.5">
                        <span className={`h-3 w-3 rounded-full shrink-0 ${color.dot}`} />
                        <span className="font-semibold text-neutral-850 text-sm sm:text-base">
                          {balance.leave_type.name}
                        </span>
                      </div>
                      <span className="text-sm font-extrabold text-neutral-850 tracking-tight">
                        {formatDays(balance.available_days)} / {formatDays(balance.allowance_days)}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-1.5 w-full rounded-full bg-neutral-100 mb-3 overflow-hidden">
                      <div
                        className={`h-full ${color.bar} rounded-full transition-all duration-500 ease-out`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>

                    {/* Footer Row */}
                    <div className="flex items-center justify-between text-xs text-neutral-455 text-neutral-450 font-medium px-0.5">
                      <span>Used: {formatDays(balance.used_days)}</span>
                      <span>Pending: {formatDays(balance.pending_days)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Upcoming Leave Schedule Preview */}
          {((auth.user.role !== 'staff' && teamUpcomingLeaves.length > 0) || myUpcomingLeaves.length > 0) && (
            <div className="rounded-2xl border border-neutral-200/50 bg-white p-6 shadow-premium-sm">
              <div className="mb-5 flex justify-between items-center">
                <div>
                  <h2 className="text-base font-semibold text-neutral-850">
                    {['manager', 'hr', 'admin'].includes(auth.user.role) ? 'Upcoming Team Leave Schedule' : 'My Upcoming Leave Schedule'}
                  </h2>
                  <p className="text-xs font-medium text-neutral-450 mt-1">
                    {['manager', 'hr', 'admin'].includes(auth.user.role)
                      ? 'Approved leaves starting soon for your direct team members'
                      : 'Your upcoming approved leave requests'}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                {['manager', 'hr', 'admin'].includes(auth.user.role)
                  ? teamUpcomingLeaves.map((leave) => (
                      <div key={leave.id} className="rounded-xl border border-neutral-100 bg-[#fafbfa]/40 p-4 flex items-center justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-neutral-850 truncate">{leave.user?.name}</span>
                            <span className="px-2 py-0.5 rounded bg-emerald-50 text-[10px] font-semibold text-emerald-750 border border-emerald-100/50 uppercase shrink-0">
                              {leave.leave_type.code}
                            </span>
                          </div>
                          <p className="text-xs text-neutral-500 font-medium mt-1.5">
                            {formatShortDate(leave.starts_at)} – {formatShortDate(leave.ends_at)}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xs font-extrabold text-neutral-800">{formatDays(leave.requested_days)}</span>
                          <span className="block text-[10px] font-semibold text-neutral-450 mt-0.5">days</span>
                        </div>
                      </div>
                    ))
                  : myUpcomingLeaves.map((leave) => (
                      <div key={leave.id} className="rounded-xl border border-neutral-100 bg-[#fafbfa]/40 p-4 flex items-center justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-emerald-50 text-[10px] font-semibold text-emerald-750 border border-emerald-100/50 uppercase shrink-0">
                              {leave.leave_type.name}
                            </span>
                          </div>
                          <p className="text-xs text-neutral-500 font-medium mt-1.5">
                            {formatShortDate(leave.starts_at)} – {formatShortDate(leave.ends_at)}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xs font-extrabold text-neutral-800">{formatDays(leave.requested_days)}</span>
                          <span className="block text-[10px] font-semibold text-neutral-450 mt-0.5">days</span>
                        </div>
                      </div>
                    ))}
              </div>
            </div>
          )}

          {/* Recent Requests list */}
          <div className="rounded-2xl border border-neutral-200/50 bg-white shadow-premium-sm overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-100/60 px-6 py-5 bg-neutral-50/20">
              <div>
                <h2 className="text-base font-semibold text-neutral-850">Recent Leave Requests</h2>
                <p className="text-xs font-medium text-neutral-450 mt-1">Track and manage your submitted applications</p>
              </div>
              <div className="flex flex-wrap gap-2.5">
                <div className="relative">
                  <Search className="absolute left-3 top-3 text-neutral-400" size={13} />
                  <input
                    className="w-48 rounded-xl border border-neutral-200/70 bg-white py-2 pl-8 pr-3 text-xs text-neutral-700 placeholder-neutral-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/5 transition-all outline-none"
                    placeholder="Search requests..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <select
                  className="rounded-xl border border-neutral-200/70 px-3 py-2 text-xs bg-white font-semibold text-neutral-600 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/5 transition-all outline-none"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  {['all', 'pending', 'approved', 'rejected', 'cancelled'].map((status) => (
                    <option key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <RequestTable requests={filteredRequests.slice(0, 8)} />
          </div>
        </section>

        {/* Right sidebar */}
        <aside className="space-y-6">
          <Link
            className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3.5 text-xs font-semibold text-white hover:bg-emerald-700 hover:-translate-y-0.5 active:translate-y-0 active:scale-98 shadow-md shadow-emerald-600/10 transition-all duration-200"
            href="/apply-leave"
          >
            <CalendarPlus size={14} /> Apply for leave
          </Link>
          
          {pendingApprovals.length > 0 && (
            <Link
              href="/approvals"
              className="flex items-center justify-between rounded-xl border border-amber-100 bg-amber-50/50 px-4 py-3.5 text-xs font-semibold text-amber-900 hover:bg-amber-50 hover:border-amber-200/60 shadow-premium-sm transition-all duration-200"
            >
              <span>{pendingApprovals.length} {pendingApprovals.length === 1 ? 'request needs' : 'requests need'} review</span>
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-600 px-1 text-[10px] font-bold text-white shadow-sm">
                {pendingApprovals.length}
              </span>
            </Link>
          )}

          {/* Upcoming Holidays widget */}
          <div className="rounded-2xl border border-neutral-200/50 bg-white p-5 shadow-premium-sm">
            <div className="mb-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-neutral-450">
              <CalendarDays size={14} className="text-neutral-400" /> Upcoming Holidays
            </div>
            <div className="space-y-3">
              {upcomingHolidays.map((holiday) => (
                <div key={holiday.id} className="flex items-center gap-3 rounded-xl border border-neutral-100 bg-[#fafbfa]/40 p-3 text-xs transition-all hover:bg-neutral-50/60">
                  <div className="flex h-10 w-10 flex-col items-center justify-center rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-100 font-semibold shadow-premium-sm shrink-0">
                    <span className="text-[10px] uppercase font-bold tracking-tight text-emerald-700">
                      {new Date(holiday.holiday_date).toLocaleDateString(undefined, { month: 'short' })}
                    </span>
                    <span className="text-sm font-extrabold leading-none mt-0.5 text-emerald-800">
                      {new Date(holiday.holiday_date).toLocaleDateString(undefined, { day: 'numeric' })}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-neutral-850">{holiday.name}</div>
                    <div className="text-[10px] font-medium text-neutral-400 mt-0.5">
                      {new Date(holiday.holiday_date).toLocaleDateString(undefined, { weekday: 'long' })}
                    </div>
                  </div>
                </div>
              ))}
              {upcomingHolidays.length === 0 && (
                <p className="py-4 text-center text-xs text-neutral-400 font-medium">No upcoming holidays.</p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </AppLayout>
  );
}

function RequestTable({ requests }: { requests: LeaveRequest[] }) {
  return (
    <div>
      {/* Mobile Card List View */}
      <div className="divide-y divide-neutral-100 sm:hidden">
        {requests.map((request) => (
          <div key={request.id} className="p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-neutral-850 text-xs">{request.leave_type.name}</span>
              <Status status={request.status} />
            </div>
            
            <div className="flex justify-between text-xs text-neutral-500 font-medium">
              <span>{formatShortDate(request.starts_at)} – {formatShortDate(request.ends_at)}</span>
              <span className="font-semibold text-neutral-700">{formatDays(request.requested_days)} day(s)</span>
            </div>

            {(request.manager_comment || request.approver) && (
              <div className="bg-neutral-50/50 rounded-xl p-3.5 border border-neutral-100 text-xs text-neutral-500 space-y-1.5">
                {request.approver && (
                  <div>
                    <span className="font-semibold text-neutral-600">Approver:</span> {request.approver.name}
                  </div>
                )}
                {request.manager_comment && (
                  <div>
                    <span className="font-semibold text-neutral-600">Comment:</span> {request.manager_comment}
                  </div>
                )}
              </div>
            )}

            {request.status === 'pending' && (
              <div className="flex justify-end pt-1">
                <button
                  className="text-xs font-semibold text-rose-600 hover:text-rose-700 transition-all active:scale-95"
                  onClick={() => router.delete(`/leave-requests/${request.id}`, { preserveScroll: true })}
                >
                  Cancel Request
                </button>
              </div>
            )}
          </div>
        ))}
        {requests.length === 0 && (
          <div className="p-8 text-center text-xs text-neutral-400 font-medium">
            No matching requests found.
          </div>
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-left text-sm text-neutral-700">
          <thead className="bg-neutral-50/50 text-[10px] font-semibold uppercase tracking-widest text-neutral-400 border-b border-neutral-100/60">
            <tr>
              <th className="px-6 py-4.5">Type</th>
              <th className="px-4 py-4.5">Dates</th>
              <th className="px-4 py-4.5">Days</th>
              <th className="px-4 py-4.5">Status</th>
              <th className="px-4 py-4.5">Approver</th>
              <th className="px-4 py-4.5">Comment</th>
              <th className="px-6 py-4.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100/60">
            {requests.map((request) => (
              <tr key={request.id} className="transition-all hover:bg-neutral-50/40">
                <td className="px-6 py-4.5 font-semibold text-neutral-850">{request.leave_type.name}</td>
                <td className="px-4 py-4.5 text-neutral-500 font-medium whitespace-nowrap">
                  {formatShortDate(request.starts_at)} – {formatShortDate(request.ends_at)}
                </td>
                <td className="px-4 py-4.5 font-semibold text-neutral-700">{formatDays(request.requested_days)}</td>
                <td className="px-4 py-4.5">
                  <Status status={request.status} />
                </td>
                <td className="px-4 py-4.5 text-neutral-600 font-medium">{request.approver?.name ?? '–'}</td>
                <td className="px-4 py-4.5 max-w-48 truncate text-neutral-500 font-medium" title={request.manager_comment ?? ''}>
                  {request.manager_comment ?? '–'}
                </td>
                <td className="px-6 py-4.5 text-right whitespace-nowrap">
                  {request.status === 'pending' && (
                    <button
                      className="text-xs font-semibold text-rose-600 hover:text-rose-700 transition-all active:scale-95"
                      onClick={() => router.delete(`/leave-requests/${request.id}`, { preserveScroll: true })}
                    >
                      Cancel
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {requests.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-neutral-400 font-medium">
                  No matching requests found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Metric({ label, value, icon, variant }: { label: string; value: string | number; icon: React.ReactNode; variant: 'amber' | 'emerald' | 'rose' | 'indigo' }) {
  const themes = {
    amber: {
      border: 'border-amber-100/60',
      bg: 'bg-gradient-to-br from-amber-500/5 to-amber-600/5',
      iconBg: 'bg-amber-50 text-amber-600 border-amber-100/70',
    },
    emerald: {
      border: 'border-emerald-100/60',
      bg: 'bg-gradient-to-br from-emerald-500/5 to-emerald-600/5',
      iconBg: 'bg-emerald-50 text-emerald-600 border-emerald-100/70',
    },
    rose: {
      border: 'border-rose-100/60',
      bg: 'bg-gradient-to-br from-rose-500/5 to-rose-600/5',
      iconBg: 'bg-rose-50 text-rose-600 border-rose-100/70',
    },
    indigo: {
      border: 'border-indigo-100/60',
      bg: 'bg-gradient-to-br from-indigo-500/5 to-indigo-600/5',
      iconBg: 'bg-indigo-50 text-indigo-600 border-indigo-100/70',
    },
  };

  const theme = themes[variant];

  return (
    <div className={`rounded-2xl border ${theme.border} p-6 bg-white shadow-premium-sm hover:shadow-premium-md transition-all duration-300 relative overflow-hidden group`}>
      <div className={`absolute top-0 right-0 w-24 h-24 rounded-full ${theme.bg} blur-2xl -mr-4 -mt-4 opacity-50 group-hover:scale-110 transition-transform duration-500`} />
      <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-widest text-neutral-400 relative z-10">
        <span>{label}</span>
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg border ${theme.iconBg} shadow-premium-sm transition-transform duration-300 group-hover:scale-105`}>
          {icon}
        </div>
      </div>
      <div className="mt-5 text-3xl font-bold tracking-tight text-neutral-800 relative z-10">{value}</div>
    </div>
  );
}

function Status({ status }: { status: string }) {
  const style = statusStyles[status] ?? { bg: 'bg-neutral-50/60', border: 'border-neutral-200/70', text: 'text-neutral-600' };
  return (
    <span className={`inline-flex items-center rounded-full border ${style.border} ${style.bg} ${style.text} px-2.5 py-0.5 text-[11px] font-semibold tracking-wide shadow-sm`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function SideList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200/50 bg-white p-5 shadow-premium-sm">
      <div className="mb-4 text-[10px] font-semibold uppercase tracking-widest text-neutral-450">{title}</div>
      <div className="space-y-3">
        {items.map((item, idx) => (
          <div key={idx} className="border-t border-neutral-100/60 pt-3 text-xs text-neutral-600 font-medium first:border-t-0 first:pt-0">
            {item}
          </div>
        ))}
        {items.length === 0 && <p className="py-4 text-center text-xs text-neutral-400 font-medium">{empty}</p>}
      </div>
    </div>
  );
}
