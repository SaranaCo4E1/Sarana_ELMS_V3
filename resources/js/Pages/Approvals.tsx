import { router } from '@inertiajs/react';
import { Check, Clock3, FileText, Search, ShieldCheck, Users, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import AppLayout from '../Layouts/AppLayout';
import type { LeaveRequest } from '../types';
import { formatDays, formatShortDate } from '../utils';

type Props = {
  requests: LeaveRequest[];
  recentDecisions: LeaveRequest[];
  approvalStats: { pending: number; approved_this_month: number; rejected_this_month: number; team_members_on_leave: number };
};

const statusStyles: Record<string, { bg: string; border: string; text: string }> = {
  approved: { bg: 'bg-emerald-50/60', border: 'border-emerald-100/70', text: 'text-emerald-800' },
  rejected: { bg: 'bg-rose-50/60', border: 'border-rose-100/70', text: 'text-rose-800' },
};

export default function Approvals({ requests, recentDecisions, approvalStats }: Props) {
  const [comments, setComments] = useState<Record<number, string>>({});
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState('all');

  const departments = useMemo(() => Array.from(new Set(requests.map((request) => request.user?.department?.name).filter(Boolean))) as string[], [requests]);
  
  const filtered = requests.filter((request) => {
    const matchesDepartment = department === 'all' || request.user?.department?.name === department;
    const haystack = `${request.user?.name ?? ''} ${request.user?.department?.name ?? ''} ${request.leave_type.name} ${request.reason}`.toLowerCase();
    return matchesDepartment && haystack.includes(query.toLowerCase());
  });

  const decide = (id: number, decision: 'approved' | 'rejected') => {
    router.patch(`/approvals/${id}`, { decision, manager_comment: comments[id] ?? '' }, { preserveScroll: true });
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Metric widgets */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Metric icon={<Clock3 size={15} />} label="Waiting Reviews" value={approvalStats.pending} variant="amber" />
          <Metric icon={<ShieldCheck size={15} />} label="Approved This Month" value={approvalStats.approved_this_month} variant="emerald" />
          <Metric icon={<X size={15} />} label="Rejected This Month" value={approvalStats.rejected_this_month} variant="rose" />
          <Metric icon={<Users size={15} />} label="On Leave Today" value={approvalStats.team_members_on_leave} variant="indigo" />
        </div>

        {/* Pending approvals section */}
        <div className="rounded-2xl border border-neutral-200/50 bg-white shadow-premium-sm overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200/60 px-6 py-5 bg-neutral-50/20">
            <div>
              <h2 className="text-sm font-bold text-neutral-900">Pending Approvals</h2>
              <p className="text-xs font-semibold text-neutral-400">Review time off applications and submit your decision</p>
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
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              >
                <option value="all">All departments</option>
                {departments.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="divide-y divide-neutral-200/60 bg-neutral-50/5">
            {filtered.map((request) => (
              <div key={request.id} className="grid gap-6 p-6 lg:grid-cols-[1fr_320px]">
                {/* Employee Info & Request details */}
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-neutral-900">{request.user?.name}</span>
                    <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-bold text-neutral-500 border border-neutral-200/60">
                      {request.user?.department?.name ?? 'General'}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800 border border-emerald-100">
                      {request.leave_type.name}
                    </span>
                  </div>

                  <div className="text-xs text-neutral-500 font-medium">
                    Requested: <span className="font-bold text-neutral-800">{formatShortDate(request.starts_at)}</span> to <span className="font-bold text-neutral-800">{formatShortDate(request.ends_at)}</span>
                    <span className="mx-2">·</span>
                    <span className="font-bold text-emerald-800">{formatDays(request.requested_days)} working day(s)</span>
                  </div>

                  {request.reason ? (
                    <p className="text-sm text-neutral-600 leading-relaxed bg-neutral-50/20 border border-neutral-200/60 rounded-xl p-3.5 italic shadow-premium-sm max-w-2xl">
                      "{request.reason}"
                    </p>
                  ) : (
                    <p className="text-xs text-neutral-400 italic font-medium">No notes provided.</p>
                  )}

                  <div className="flex flex-wrap gap-2 pt-1.5">
                    {(request.attachments ?? []).map((attachment) => (
                      <span
                        key={attachment.id}
                        className="inline-flex items-center gap-1.5 rounded-full bg-white border border-neutral-200 px-3 py-1 text-xs font-bold text-neutral-600 transition-all hover:bg-neutral-50 shadow-premium-sm"
                      >
                        <FileText size={12} className="text-neutral-400" />
                        <span className="truncate max-w-44">{attachment.original_name}</span>
                      </span>
                    ))}
                    {(request.attachments ?? []).length === 0 && (
                      <span className="text-xs font-bold text-neutral-400">No attachments provided</span>
                    )}
                  </div>
                </div>

                {/* Comment & Decision inputs */}
                <div className="flex flex-col justify-between rounded-2xl border border-neutral-200/50 bg-white p-4.5 shadow-premium-sm">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
                      Decision Comment
                    </label>
                    <textarea
                      className="h-24 w-full rounded-xl border border-neutral-200/70 p-3 text-sm text-neutral-700 placeholder:text-neutral-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/5 transition-all outline-none resize-none"
                      placeholder="Comment or reason for approval/rejection..."
                      value={comments[request.id] ?? ''}
                      onChange={(e) => setComments({ ...comments, [request.id]: e.target.value })}
                    />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 py-2.5 text-sm font-bold text-white transition-all shadow-md shadow-emerald-600/10 hover:from-emerald-700 hover:to-teal-600 hover:-translate-y-0.5 active:translate-y-0 active:scale-97 cursor-pointer"
                      onClick={() => decide(request.id, 'approved')}
                    >
                      <Check size={14} /> Approve
                    </button>
                    <button
                      className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-500 py-2.5 text-sm font-bold text-white transition-all shadow-md shadow-rose-600/10 hover:from-rose-700 hover:to-red-600 hover:-translate-y-0.5 active:translate-y-0 active:scale-97 cursor-pointer"
                      onClick={() => decide(request.id, 'rejected')}
                    >
                      <X size={14} /> Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="p-12 text-center text-xs text-neutral-400 font-medium">
                No pending requests in your inbox.
              </div>
            )}
          </div>
        </div>

        {/* Recent decisions log */}
        <div className="rounded-2xl border border-neutral-200/50 bg-white shadow-premium-sm overflow-hidden">
          <div className="border-b border-neutral-200/60 px-6 py-5 bg-neutral-50/20">
            <h2 className="text-sm font-bold text-neutral-900">Recent Decisions</h2>
            <p className="text-xs font-semibold text-neutral-400">Log of recently approved or rejected leave requests</p>
          </div>
          
          {/* Mobile Card List View */}
          <div className="divide-y divide-neutral-100 sm:hidden">
            {recentDecisions.map((request) => {
              const statusStyle = statusStyles[request.status] ?? { bg: 'bg-neutral-50/60', border: 'border-neutral-200/70', text: 'text-neutral-500' };
              return (
                <div key={request.id} className="p-4 space-y-3 bg-white">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-neutral-900 text-xs">{request.user?.name}</span>
                    <span className={`inline-flex items-center rounded-full border ${statusStyle.border} ${statusStyle.bg} ${statusStyle.text} px-2.5 py-0.5 text-xs font-bold`}>
                      {request.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-neutral-600">
                    <div>
                      <div className="text-xs text-neutral-400 uppercase font-bold">Leave Type</div>
                      <div className="font-bold text-neutral-700 mt-0.5">{request.leave_type.name}</div>
                    </div>
                    <div>
                      <div className="text-xs text-neutral-400 uppercase font-bold">Days</div>
                      <div className="font-bold text-neutral-700 mt-0.5">{formatDays(request.requested_days)}</div>
                    </div>
                  </div>

                  <div className="text-xs text-neutral-500 font-bold">
                    Dates: <span className="font-bold text-neutral-800">{formatShortDate(request.starts_at)} – {formatShortDate(request.ends_at)}</span>
                  </div>

                  {request.manager_comment && (
                    <div className="bg-neutral-50/50 rounded-xl p-3 border border-neutral-100 text-xs text-neutral-500">
                      <span className="font-bold text-neutral-600">Comment:</span> {request.manager_comment}
                    </div>
                  )}
                </div>
              );
            })}
            {recentDecisions.length === 0 && (
              <div className="p-8 text-center text-xs text-neutral-400 font-medium">
                No decision history found.
              </div>
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-50/50 text-xs font-bold uppercase tracking-wider text-neutral-400 border-b border-neutral-100/60">
                <tr>
                  <th className="px-6 py-4">Employee</th>
                  <th className="px-4 py-4">Leave Type</th>
                  <th className="px-4 py-4">Dates</th>
                  <th className="px-4 py-4">Days</th>
                  <th className="px-4 py-4">Status</th>
                  <th className="px-6 py-4">Manager Comment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100/60">
                {recentDecisions.map((request) => {
                  const statusStyle = statusStyles[request.status] ?? { bg: 'bg-neutral-50/60', border: 'border-neutral-200/70', text: 'text-neutral-500' };
                  return (
                    <tr key={request.id} className="transition-all hover:bg-neutral-50/40">
                      <td className="px-6 py-4 font-bold text-neutral-900">{request.user?.name}</td>
                      <td className="px-4 py-4 text-neutral-600 font-bold">{request.leave_type.name}</td>
                      <td className="px-4 py-4 text-neutral-500 font-medium whitespace-nowrap">
                        {formatShortDate(request.starts_at)} – {formatShortDate(request.ends_at)}
                      </td>
                      <td className="px-4 py-4 font-bold text-neutral-700">{formatDays(request.requested_days)}</td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center rounded-full border ${statusStyle.border} ${statusStyle.bg} ${statusStyle.text} px-2.5 py-0.5 text-xs font-bold`}>
                          {request.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 max-w-80 truncate text-neutral-500 font-medium" title={request.manager_comment ?? ''}>
                        {request.manager_comment ?? '–'}
                      </td>
                    </tr>
                  );
                })}
                {recentDecisions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-neutral-400 font-medium">
                      No decision history found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
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
      <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-neutral-400 relative z-10">
        <span>{label}</span>
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg border ${theme.iconBg} shadow-premium-sm transition-transform duration-300 group-hover:scale-105`}>
          {icon}
        </div>
      </div>
      <div className="mt-4 text-2xl font-bold tracking-tight text-neutral-900 relative z-10">{value}</div>
    </div>
  );
}
