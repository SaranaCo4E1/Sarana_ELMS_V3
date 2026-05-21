import { Link, router, usePage } from '@inertiajs/react';
import { AlertCircle, CalendarClock, CalendarPlus, CheckCircle2, Clock3, FileText, Search, Users, X } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import AppLayout from '../Layouts/AppLayout';
import type { LeaveBalance, LeaveRequest, PageProps, SystemNotification, User } from '../types';
import { formatDays, formatShortDate } from '../utils';

type Props = {
  balances: LeaveBalance[];
  requests: LeaveRequest[];
  requestStats: { pending: number; approved: number; rejected: number; cancelled: number; scheduled_days: number };
  pendingApprovals: LeaveRequest[];
  teamMembers: User[];
  systemAlerts: SystemNotification[];
};

const statusStyles: Record<string, { bg: string; border: string; text: string }> = {
  pending: { bg: 'bg-amber-50/60', border: 'border-amber-100/70', text: 'text-amber-800' },
  approved: { bg: 'bg-emerald-50/60', border: 'border-emerald-100/70', text: 'text-emerald-800' },
  rejected: { bg: 'bg-rose-50/60', border: 'border-rose-100/70', text: 'text-rose-800' },
  cancelled: { bg: 'bg-neutral-50/60', border: 'border-neutral-200/70', text: 'text-neutral-500' },
};

export default function Dashboard({ balances, requests, requestStats, pendingApprovals, teamMembers, systemAlerts }: Props) {
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

          {/* Leave balances cards */}
          <div>
            <div className="mb-4">
              <h2 className="text-sm font-bold text-neutral-900">Leave Balance</h2>
              <p className="text-xs font-semibold text-neutral-400">Your available quotas for the current calendar year</p>
            </div>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
              {balances.map((balance) => {
                const used = Number(balance.used_days);
                const allowance = Math.max(1, Number(balance.allowance_days));
                const percent = Math.min(100, (used / allowance) * 100);
                
                return (
                  <div key={balance.id} className="relative overflow-hidden rounded-2xl border border-neutral-200/50 bg-white p-5 shadow-premium-sm hover:shadow-premium-md transition-all duration-300 group">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-bold text-neutral-900 group-hover:text-emerald-700 transition-colors duration-250">{balance.leave_type.name}</div>
                        <div className="text-xs font-bold uppercase tracking-wider text-neutral-400 mt-0.5">{balance.leave_type.code}</div>
                      </div>
                      <span className="inline-flex items-center rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                        {formatDays(balance.available_days)} left
                      </span>
                    </div>

                    <div className="mt-5">
                      <div className="flex justify-between text-xs font-bold text-neutral-400 mb-1.5">
                        <span>Used: {formatDays(balance.used_days)}</span>
                        <span>{Math.round(percent)}%</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden bg-neutral-100">
                        <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full transition-all duration-500 ease-out" style={{ width: `${percent}%` }} />
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-neutral-100/60 grid grid-cols-2 gap-2 text-xs text-neutral-400 font-medium">
                      <div>Quota: <span className="font-bold text-neutral-700">{formatDays(balance.allowance_days)}</span></div>
                      <div className="text-right font-medium">Pending: <span className="font-bold text-neutral-700">{formatDays(balance.pending_days)}</span></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Requests list */}
          <div className="rounded-2xl border border-neutral-200/50 bg-white shadow-premium-sm overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-100/60 px-5 py-4 bg-neutral-50/20">
              <div>
                <h2 className="text-sm font-bold text-neutral-900">Recent Leave Requests</h2>
                <p className="text-xs font-semibold text-neutral-400">Track and manage your submitted applications</p>
              </div>
              <div className="flex flex-wrap gap-2.5">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 text-neutral-400" size={13} />
                  <input
                    className="w-44 rounded-xl border border-neutral-200/70 bg-white py-1.5 pl-8 pr-3 text-xs text-neutral-800 placeholder-neutral-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/5 transition-all outline-none"
                    placeholder="Search requests..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <select
                  className="rounded-xl border border-neutral-200/70 px-3 py-1.5 text-xs bg-white font-bold text-neutral-600 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/5 transition-all outline-none"
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
            className="flex items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 py-3 text-xs font-bold text-white hover:bg-neutral-800 hover:-translate-y-0.5 active:translate-y-0 active:scale-98 shadow-md shadow-neutral-950/10 transition-all duration-200"
            href="/apply-leave"
          >
            <CalendarPlus size={14} /> Apply for leave
          </Link>
          
          {pendingApprovals.length > 0 && (
            <Link
              href="/approvals"
              className="flex items-center justify-between rounded-xl border border-amber-100 bg-amber-50/50 px-4 py-3 text-xs font-bold text-amber-900 hover:bg-amber-50 hover:border-amber-200/60 shadow-premium-sm transition-all duration-200"
            >
              <span>{pendingApprovals.length} request(s) need review</span>
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-600 px-1 text-xs font-bold text-white shadow-sm">
                {pendingApprovals.length}
              </span>
            </Link>
          )}

          {['manager', 'hr', 'admin'].includes(auth.user.role) && (
            <div className="rounded-2xl border border-neutral-200/50 bg-white p-4 shadow-premium-sm">
              <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-500">
                <Users size={14} className="text-neutral-400" /> Team Snapshot
              </div>
              <div className="space-y-2">
                {teamMembers.slice(0, 8).map((member) => (
                  <div key={member.id} className="flex items-center justify-between gap-3 rounded-xl border border-neutral-100 bg-neutral-50/30 px-3.5 py-2.5 text-xs">
                    <span className="font-semibold text-neutral-700">{member.name}</span>
                    <span className="bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700 border border-amber-100/50 rounded-full">
                      {member.pending_leave_requests_count ?? 0} pending
                    </span>
                  </div>
                ))}
                {teamMembers.length === 0 && <p className="py-4 text-center text-xs text-neutral-400 font-medium">No team members assigned.</p>}
              </div>
            </div>
          )}

          <SideList title="System Alerts" empty="No active alerts." items={systemAlerts.map((item) => `${item.title} · ${item.body}`)} />
          
          {['hr', 'admin'].includes(auth.user.role) && (
            <a
              className="flex items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-xs font-bold text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 shadow-premium-sm transition-all duration-200 active:scale-98"
              href={`/reports/monthly?month=${new Date().toISOString().slice(0, 7)}`}
            >
              <FileText size={14} /> Download current month CSV
            </a>
          )}
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
          <div key={request.id} className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-neutral-900 text-xs">{request.leave_type.name}</span>
              <Status status={request.status} />
            </div>
            
            <div className="flex justify-between text-xs text-neutral-500 font-medium">
              <span>{formatShortDate(request.starts_at)} – {formatShortDate(request.ends_at)}</span>
              <span className="font-bold text-neutral-700">{formatDays(request.requested_days)} day(s)</span>
            </div>

            {(request.manager_comment || request.approver) && (
              <div className="bg-neutral-50/50 rounded-xl p-3 border border-neutral-100 text-xs text-neutral-500 space-y-1.5">
                {request.approver && (
                  <div>
                    <span className="font-bold text-neutral-600">Approver:</span> {request.approver.name}
                  </div>
                )}
                {request.manager_comment && (
                  <div>
                    <span className="font-bold text-neutral-600">Comment:</span> {request.manager_comment}
                  </div>
                )}
              </div>
            )}

            {request.status === 'pending' && (
              <div className="flex justify-end pt-1">
                <button
                  className="text-xs font-bold text-rose-600 hover:text-rose-700 transition-all active:scale-95"
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
          <thead className="bg-neutral-50/50 text-xs font-bold uppercase tracking-wider text-neutral-500 border-b border-neutral-100/60">
            <tr>
              <th className="px-6 py-4">Type</th>
              <th className="px-4 py-4">Dates</th>
              <th className="px-4 py-4">Days</th>
              <th className="px-4 py-4">Status</th>
              <th className="px-4 py-4">Approver</th>
              <th className="px-4 py-4">Comment</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100/60">
            {requests.map((request) => (
              <tr key={request.id} className="transition-all hover:bg-neutral-50/40">
                <td className="px-6 py-4 font-bold text-neutral-900">{request.leave_type.name}</td>
                <td className="px-4 py-4 text-neutral-500 font-medium whitespace-nowrap">
                  {formatShortDate(request.starts_at)} – {formatShortDate(request.ends_at)}
                </td>
                <td className="px-4 py-4 font-bold text-neutral-700">{formatDays(request.requested_days)}</td>
                <td className="px-4 py-4">
                  <Status status={request.status} />
                </td>
                <td className="px-4 py-4 text-neutral-600 font-medium">{request.approver?.name ?? '–'}</td>
                <td className="px-4 py-4 max-w-48 truncate text-neutral-500 font-medium" title={request.manager_comment ?? ''}>
                  {request.manager_comment ?? '–'}
                </td>
                <td className="px-6 py-4 text-right whitespace-nowrap">
                  {request.status === 'pending' && (
                    <button
                      className="text-xs font-bold text-rose-600 hover:text-rose-700 transition-all active:scale-95"
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
    <div className={`rounded-2xl border ${theme.border} p-5 bg-white shadow-premium-sm hover:shadow-premium-md transition-all duration-300 relative overflow-hidden group`}>
      <div className={`absolute top-0 right-0 w-24 h-24 rounded-full ${theme.bg} blur-2xl -mr-4 -mt-4 opacity-50 group-hover:scale-110 transition-transform duration-500`} />
      <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-neutral-500 relative z-10">
        <span>{label}</span>
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg border ${theme.iconBg} shadow-premium-sm transition-transform duration-300 group-hover:scale-105`}>
          {icon}
        </div>
      </div>
      <div className="mt-4 text-2xl font-bold tracking-tight text-neutral-900 relative z-10">{value}</div>
    </div>
  );
}

function Status({ status }: { status: string }) {
  const style = statusStyles[status] ?? { bg: 'bg-neutral-50/60', border: 'border-neutral-200/70', text: 'text-neutral-600' };
  return (
    <span className={`inline-flex items-center rounded-full border ${style.border} ${style.bg} ${style.text} px-2.5 py-0.5 text-xs font-bold tracking-wide`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function SideList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200/50 bg-white p-5 shadow-premium-sm">
      <div className="mb-3 text-xs font-bold uppercase tracking-wider text-neutral-500">{title}</div>
      <div className="space-y-3">
        {items.map((item, idx) => (
          <div key={idx} className="border-t border-neutral-100 pt-3 text-xs text-neutral-600 font-medium first:border-t-0 first:pt-0">
            {item}
          </div>
        ))}
        {items.length === 0 && <p className="py-4 text-center text-xs text-neutral-400 font-medium">{empty}</p>}
      </div>
    </div>
  );
}
