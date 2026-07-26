import { Link, router, usePage } from '@inertiajs/react';
import { AlertCircle, CalendarClock, CalendarPlus, CheckCircle2, Clock3, FileText, Search, Users, X, CalendarDays, Eye, Download, Loader2 } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import AppLayout from '../Layouts/AppLayout';
import type { LeaveBalance, LeaveRequest, PageProps, SystemNotification, User, PublicHoliday } from '../types';
import { canApproveRole, formatDays, formatShortDate } from '../utils';
import LeaveBadge, { getLeaveStyle } from '../Components/LeaveBadge';

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

const statusStyles: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  pending: { bg: 'bg-amber-500/[0.04]', border: 'border-amber-500/10', text: 'text-amber-700/90', dot: 'bg-amber-500' },
  approved: { bg: 'bg-green-500/[0.04]', border: 'border-green-500/10', text: 'text-green-700/90', dot: 'bg-green-500' },
  rejected: { bg: 'bg-rose-500/[0.04]', border: 'border-rose-500/10', text: 'text-rose-700/90', dot: 'bg-rose-500' },
  cancelled: { bg: 'bg-neutral-500/[0.04]', border: 'border-neutral-500/10', text: 'text-neutral-550/90', dot: 'bg-neutral-400' },
};

// Removed local getLeaveColor in favor of getLeaveStyle from LeaveBadge component

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
  const canViewTeamLeave = canApproveRole(auth.user.role);

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
            <Metric icon={<Clock3 size={15} />} label="Pending" value={requestStats.pending} variant="amber" />
            <Metric icon={<CheckCircle2 size={15} />} label="Approved" value={requestStats.approved} variant="green" />
            <Metric icon={<AlertCircle size={15} />} label="Rejected" value={requestStats.rejected} variant="rose" />
            <Metric icon={<CalendarClock size={15} />} label="Scheduled" value={formatDays(requestStats.scheduled_days)} variant="indigo" />
          </div>

          {/* Leave Balances Cards Grid */}
          <div>
            <div className="mb-5">
              <h2 className="text-base font-medium text-neutral-800">Leave Balance</h2>
              <p className="text-sm font-normal text-neutral-500 mt-1.5">Your available quotas for the current calendar year</p>
            </div>
            <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
              {balances.map((balance) => {
                const avail = Number(balance.available_days);
                const allowance = Math.max(1, Number(balance.allowance_days));
                const used = Number(balance.used_days);
                const percent = Math.min(100, (avail / allowance) * 100);
                const color = getLeaveStyle(balance.leave_type.code);

                return (
                  <div key={balance.id} className="rounded-xl border border-neutral-200 bg-white p-4 sm:p-5 shadow-premium-sm hover:shadow-premium-md transition-all duration-300">
                    {/* Top Row */}
                    <div className="flex items-center justify-between gap-2 mb-4">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`h-3 w-3 rounded-full shrink-0 ${color.dot}`} />
                        <span className="font-medium text-neutral-800 text-sm sm:text-base truncate">
                          {balance.leave_type.name}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-neutral-800 tracking-tight shrink-0">
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
                    <div className="flex items-center justify-between text-sm text-neutral-400 font-medium px-0.5">
                      <span>Used: {formatDays(balance.used_days)}</span>
                      <span>Pending: {formatDays(balance.pending_days)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Upcoming Leave Schedule Preview */}
          {((canViewTeamLeave && teamUpcomingLeaves.length > 0) || myUpcomingLeaves.length > 0) && (
            <div className="rounded-xl border border-neutral-200/50 bg-white p-4 sm:p-6 shadow-premium-sm">
              <div className="mb-5 flex justify-between items-center">
                <div>
                  <h2 className="text-base font-medium text-neutral-800">
                    {canViewTeamLeave ? 'Upcoming Team Leave Schedule' : 'My Upcoming Leave Schedule'}
                  </h2>
                  <p className="text-sm font-medium text-neutral-500 mt-1.5">
                    {canViewTeamLeave
                      ? 'Approved leaves starting soon for your direct team members'
                      : 'Your upcoming approved leave requests'}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                {canViewTeamLeave
                  ? teamUpcomingLeaves.map((leave) => (
                      <div key={leave.id} className="rounded-lg border border-neutral-100 bg-[#fafbfa]/40 p-3.5 sm:p-4.5 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2.5">
                            <span className="text-sm font-medium text-neutral-800 truncate">{leave.user?.name}</span>
                            <LeaveBadge code={leave.leave_type.code} name={leave.leave_type.name} useShortCode />
                          </div>
                          <p className="text-sm text-neutral-500 font-medium mt-2">
                            {formatShortDate(leave.starts_at)} – {formatShortDate(leave.ends_at)}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-sm font-medium text-neutral-800">{formatDays(leave.requested_days)}</span>
                          <span className="block text-xs font-medium text-neutral-400 mt-0.5">days</span>
                        </div>
                      </div>
                    ))
                  : myUpcomingLeaves.map((leave) => (
                      <div key={leave.id} className="rounded-lg border border-neutral-100 bg-[#fafbfa]/40 p-3.5 sm:p-4.5 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2.5">
                            <LeaveBadge code={leave.leave_type.code} name={leave.leave_type.name} />
                          </div>
                          <p className="text-sm text-neutral-500 font-medium mt-2">
                            {formatShortDate(leave.starts_at)} – {formatShortDate(leave.ends_at)}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-sm font-medium text-neutral-800">{formatDays(leave.requested_days)}</span>
                          <span className="block text-xs font-medium text-neutral-400 mt-0.5">days</span>
                        </div>
                      </div>
                    ))}
              </div>
            </div>
          )}

          {/* Recent Requests list */}
          <div className="rounded-xl border border-neutral-200/50 bg-white shadow-premium-sm overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-100/60 px-4 py-4 sm:px-6 sm:py-5 bg-neutral-50/20">
              <div className="min-w-0">
                <h2 className="text-base font-medium text-neutral-800">Recent Leave Requests</h2>
                <p className="text-sm text-neutral-400 mt-1.5">Track and manage your submitted applications</p>
              </div>
              <div className="flex flex-wrap gap-3 w-full sm:w-auto">
                <div className="relative w-full sm:w-auto">
                  <Search className="absolute left-3.5 top-3.5 text-neutral-400" size={14} />
                  <input
                    className="w-full sm:w-52 rounded-lg border border-neutral-200/70 bg-white py-2.5 pl-9 pr-3.5 text-sm text-neutral-700 placeholder-neutral-400 focus:border-orange-600 focus:ring-4 focus:ring-orange-500/5 transition-all outline-none"
                    placeholder="Search requests..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <select
                  className="w-full sm:w-auto rounded-lg border border-neutral-200/70 px-4 py-2.5 text-sm bg-white font-medium text-neutral-600 focus:border-orange-600 focus:ring-4 focus:ring-orange-500/5 transition-all outline-none"
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
        <aside className="space-y-6 min-w-0">
          <Link
            className="flex items-center justify-center gap-2.5 rounded-lg bg-orange-600 px-5 py-4 text-sm font-medium text-white hover:bg-orange-700 hover:-translate-y-0.5 active:translate-y-0 active:scale-98 shadow-md shadow-orange-600/10 transition-all duration-200"
            href="/apply-leave"
          >
            <CalendarPlus size={15} /> Apply for leave
          </Link>
          
          {pendingApprovals.length > 0 && (
            <Link
              href="/approvals"
              className="flex items-center justify-between rounded-lg border border-amber-100 bg-amber-50/50 px-5 py-4 text-sm font-medium text-amber-900 hover:bg-amber-50 hover:border-amber-200/60 shadow-premium-sm transition-all duration-200"
            >
              <span>{pendingApprovals.length} {pendingApprovals.length === 1 ? 'request needs' : 'requests need'} review</span>
              <span className="flex h-5 min-w-5 items-center justify-center rounded-md bg-amber-600 px-1.5 text-xs font-semibold text-white shadow-sm">
                {pendingApprovals.length}
              </span>
            </Link>
          )}

          {/* Upcoming Holidays widget */}
          <div className="rounded-xl border border-neutral-200/50 bg-white p-4 sm:p-5 shadow-premium-sm min-w-0">
            <div className="mb-4 flex items-center gap-2.5 text-xs font-medium uppercase tracking-wider text-neutral-500">
              <CalendarDays size={15} className="text-neutral-400" /> Upcoming Holidays
            </div>
            <div className="space-y-3.5">
              {upcomingHolidays.map((holiday) => (
                <div key={holiday.id} className="flex items-center gap-3 rounded-lg border border-neutral-100 bg-[#fafbfa]/40 p-3 sm:p-3.5 text-sm transition-all hover:bg-neutral-50/60 min-w-0">
                  <div className="flex h-11 w-11 flex-col items-center justify-center rounded-md bg-red-50 text-red-800 border border-red-100 font-medium shadow-premium-sm shrink-0">
                    <span className="text-[10px] uppercase font-medium tracking-tight text-red-700">
                      {new Date(holiday.holiday_date).toLocaleDateString(undefined, { month: 'short' })}
                    </span>
                    <span className="text-sm font-medium leading-none mt-0.5 text-red-800">
                      {new Date(holiday.holiday_date).toLocaleDateString(undefined, { day: 'numeric' })}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-neutral-800">{holiday.name}</div>
                    <div className="text-[10px] font-medium text-neutral-400 mt-0.5">
                      {new Date(holiday.holiday_date).toLocaleDateString(undefined, { weekday: 'long' })}
                    </div>
                  </div>
                </div>
              ))}
              {upcomingHolidays.length === 0 && (
                <p className="py-5 text-center text-sm text-neutral-400 font-medium">No upcoming holidays.</p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </AppLayout>
  );
}

function RequestTable({ requests }: { requests: LeaveRequest[] }) {
  const [cancellingIds, setCancellingIds] = useState<Record<number, boolean>>({});
  const [viewDetailsRequest, setViewDetailsRequest] = useState<LeaveRequest | null>(null);
  const [previewAttachment, setPreviewAttachment] = useState<any | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const handleCancel = (id: number) => {
    router.delete(`/leave-requests/${id}`, {
      preserveScroll: true,
      onStart: () => setCancellingIds(prev => ({ ...prev, [id]: true })),
      onSuccess: () => {
        setViewDetailsRequest(null);
        setShowCancelConfirm(false);
      },
      onFinish: () => setCancellingIds(prev => ({ ...prev, [id]: false })),
    });
  };

  const isPreviewable = (attachment: any) => {
    const mime = attachment.mime_type?.toLowerCase() ?? '';
    return mime.startsWith('image/') || mime === 'application/pdf' || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'pdf'].includes(attachment.original_name.split('.').pop()?.toLowerCase() ?? '');
  };

  const isPdf = (attachment: any) => {
    const mime = attachment.mime_type?.toLowerCase() ?? '';
    return mime === 'application/pdf' || attachment.original_name.split('.').pop()?.toLowerCase() === 'pdf';
  };

  const attachmentPreviewUrl = (attachment: { id: number }) => `/approvals/attachments/${attachment.id}/preview`;
  const attachmentDownloadUrl = (attachment: { id: number }) => `/approvals/attachments/${attachment.id}/download`;

  return (
    <div>
      {/* Mobile Card List View */}
      <div className="divide-y divide-neutral-100 sm:hidden">
        {requests.map((request) => (
          <div key={request.id} className="p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <LeaveBadge code={request.leave_type.code} name={request.leave_type.name} variant="minimal" />
              <Status status={request.status} />
            </div>
            
            <div className="flex justify-between text-sm text-neutral-500 font-medium gap-2">
              <span>{formatShortDate(request.starts_at)} – {formatShortDate(request.ends_at)}</span>
              <span className="font-medium text-neutral-700 shrink-0">{formatDays(request.requested_days)} day(s)</span>
            </div>

            {(request.manager_comment || request.approver) && (
              <div className="bg-neutral-50/50 rounded-lg p-3 sm:p-3.5 border border-neutral-100 text-sm text-neutral-500 space-y-1.5">
                {request.approver && (
                  <div>
                    <span className="font-medium text-neutral-600">Approver:</span> {request.approver.name}
                  </div>
                )}
                {request.manager_comment && (
                  <div>
                    <span className="font-medium text-neutral-600">Comment:</span> {request.manager_comment}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3.5 pt-1">
              <button
                className="text-sm font-medium text-neutral-500 hover:text-neutral-800 transition-all active:scale-95 cursor-pointer"
                onClick={() => setViewDetailsRequest(request)}
              >
                View Details
              </button>
            </div>
          </div>
        ))}
        {requests.length === 0 && (
          <div className="p-8 text-center text-sm text-neutral-400 font-medium">
            No recent requests
          </div>
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-left text-sm text-neutral-700">
          <thead className="bg-neutral-50/50 text-xs font-medium uppercase tracking-wider text-neutral-400 border-b border-neutral-100/60">
            <tr>
              <th className="px-6 py-5">Type</th>
              <th className="px-4 py-5">Dates</th>
              <th className="px-4 py-5">Days</th>
              <th className="px-4 py-5">Status</th>
              <th className="px-4 py-5">Approver</th>
              <th className="px-4 py-5">Comment</th>
              <th className="px-6 py-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100/60">
            {requests.map((request) => (
              <tr key={request.id} className="transition-all hover:bg-neutral-50/40">
                <td className="px-6 py-5 font-medium text-neutral-800">
                  <LeaveBadge code={request.leave_type.code} name={request.leave_type.name} variant="minimal" />
                </td>
                <td className="px-4 py-5 text-neutral-500 font-medium whitespace-nowrap">
                  {formatShortDate(request.starts_at)} – {formatShortDate(request.ends_at)}
                </td>
                <td className="px-4 py-5 font-medium text-neutral-700">{formatDays(request.requested_days)}</td>
                <td className="px-4 py-5">
                  <Status status={request.status} />
                </td>
                <td className="px-4 py-5 text-neutral-600 font-medium">{request.approver?.name ?? '–'}</td>
                <td className="px-4 py-5 max-w-48 truncate text-neutral-500 font-medium" title={request.manager_comment ?? ''}>
                  {request.manager_comment ?? '–'}
                </td>
                <td className="px-6 py-5 text-right whitespace-nowrap">
                  <button
                    className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-neutral-650 hover:border-orange-200 hover:text-orange-700 transition-all cursor-pointer bg-white"
                    onClick={() => setViewDetailsRequest(request)}
                  >
                    <Eye size={13} /> Details
                  </button>
                </td>
              </tr>
            ))}
            {requests.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-neutral-400 font-medium">
                  No recent requests
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Decided Request Details Modal */}
      {viewDetailsRequest && createPortal(
        <div
          onClick={() => setViewDetailsRequest(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-sm animate-fade-in cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-2xl rounded-2xl bg-white border border-neutral-200/85 shadow-premium-lg overflow-hidden flex flex-col max-h-[90vh] cursor-default animate-modal-enter"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-100 px-6 py-4">
              <div>
                <h3 className="text-base font-semibold text-neutral-800">
                  Leave Request Details
                </h3>
                <p className="mt-1 text-sm font-medium text-neutral-500">Record details of your leave request.</p>
              </div>
              <button
                className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 transition-colors cursor-pointer border border-neutral-200"
                onClick={() => setViewDetailsRequest(null)}
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              {/* Employee Info & Request details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-neutral-400">Employee</div>
                  <div className="text-sm font-semibold text-neutral-800 mt-1">{viewDetailsRequest.user?.name || 'My Request'}</div>
                  {viewDetailsRequest.user?.email && <div className="text-xs font-medium text-neutral-500 mt-0.5">{viewDetailsRequest.user.email}</div>}
                  {viewDetailsRequest.user?.department && (
                    <span className="inline-flex items-center rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-600 border border-neutral-200/50 mt-1.5">
                      {viewDetailsRequest.user.department.name}
                    </span>
                  )}
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-neutral-400">Status</div>
                  <div className="mt-1.5">
                    {(() => {
                      const style = statusStyles[viewDetailsRequest.status] ?? { bg: 'bg-neutral-500/[0.04]', border: 'border-neutral-500/10', text: 'text-neutral-655/90', dot: 'bg-neutral-400' };
                      return (
                        <span className={`inline-flex items-center rounded-md border ${style.border} ${style.bg} ${style.text} px-2.5 py-0.5 text-xs font-semibold tracking-wide uppercase`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${style.dot} mr-1.5 shrink-0`} />
                          {viewDetailsRequest.status}
                        </span>
                      );
                    })()}
                  </div>
                  {viewDetailsRequest.decided_at && (
                    <div className="text-xs text-neutral-400 font-medium mt-1">
                      Decided on: {new Date(viewDetailsRequest.decided_at).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-neutral-100 pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-neutral-400">Leave Type</div>
                  <div className="mt-1">
                    <LeaveBadge code={viewDetailsRequest.leave_type.code} name={viewDetailsRequest.leave_type.name} />
                  </div>
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-neutral-400">Duration & Quota</div>
                  <div className="text-sm font-semibold text-neutral-800 mt-1">
                    {formatShortDate(viewDetailsRequest.starts_at)} – {formatShortDate(viewDetailsRequest.ends_at)}
                  </div>
                  <div className="text-xs font-medium text-orange-700 mt-0.5">
                    {formatDays(viewDetailsRequest.requested_days)} working day(s)
                  </div>
                </div>
              </div>

              {/* Handover / Reason */}
              <div className="border-t border-neutral-100 pt-4">
                <div className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">Handover Notes / Reason</div>
                {viewDetailsRequest.reason ? (
                  <p className="pre-wrap-anywhere rounded-lg border border-neutral-200/60 bg-neutral-50/40 p-3.5 text-sm leading-relaxed text-neutral-600 italic shadow-premium-sm">
                    "{viewDetailsRequest.reason}"
                  </p>
                ) : (
                  <p className="text-sm text-neutral-400 italic font-medium">No notes provided.</p>
                )}
              </div>

              {/* Manager Comment */}
              <div className="border-t border-neutral-100 pt-4">
                <div className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">Manager Decision Comment</div>
                {viewDetailsRequest.manager_comment ? (
                  <p className="text-sm text-neutral-600 leading-relaxed bg-neutral-50/40 border border-neutral-200/60 rounded-lg p-3.5 shadow-premium-sm">
                    {viewDetailsRequest.manager_comment}
                  </p>
                ) : (
                  <p className="text-sm text-neutral-400 italic font-medium">No comments provided by approver.</p>
                )}
              </div>

              {/* Attachments */}
              <div className="border-t border-neutral-100 pt-4">
                <div className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3">Attachments</div>
                <div className="flex flex-wrap gap-2.5">
                  {(viewDetailsRequest.attachments ?? []).map((attachment) => {
                    const preview = isPreviewable(attachment);
                    const ext = attachment.original_name.split('.').pop()?.slice(0, 10).toUpperCase() ?? 'FILE';
                    return preview ? (
                      <button
                        key={attachment.id}
                        onClick={() => {
                          setViewDetailsRequest(null);
                          setPreviewAttachment(attachment);
                        }}
                        className="inline-flex max-w-full flex-wrap items-center gap-1.5 rounded-lg bg-white border border-neutral-200 px-3.5 py-1.5 text-sm font-medium text-neutral-600 transition-all hover:bg-neutral-50 hover:border-neutral-300 hover:text-neutral-800 shadow-premium-sm cursor-pointer"
                        type="button"
                      >
                        <FileText size={13} className="text-neutral-400" />
                        <span className="wrap-anywhere min-w-0 max-w-44 whitespace-normal">{attachment.original_name}</span>
                        <span className="inline-flex items-center rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-500 uppercase border border-neutral-200/40">
                          {ext}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded bg-orange-50 border border-orange-100 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700 ml-1">
                          <Eye size={10} /> Preview
                        </span>
                      </button>
                    ) : (
                      <a
                        key={attachment.id}
                        href={attachmentDownloadUrl(attachment)}
                        className="inline-flex max-w-full flex-wrap items-center gap-1.5 rounded-lg bg-white border border-neutral-200 px-3.5 py-1.5 text-sm font-medium text-neutral-600 transition-all hover:bg-neutral-50 hover:border-neutral-300 hover:text-neutral-800 shadow-premium-sm"
                        target="_blank"
                        rel="noreferrer"
                      >
                        <FileText size={13} className="text-neutral-400" />
                        <span className="wrap-anywhere min-w-0 max-w-44 whitespace-normal">{attachment.original_name}</span>
                        <span className="inline-flex items-center rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-500 uppercase border border-neutral-200/40">
                          {ext}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded bg-neutral-50 border border-neutral-200 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-500 ml-1">
                          <Download size={10} /> Download
                        </span>
                      </a>
                    );
                  })}
                  {(viewDetailsRequest.attachments ?? []).length === 0 && (
                    <span className="text-sm font-medium text-neutral-400">No attachments provided</span>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-neutral-100 px-6 py-4 bg-neutral-50/20 flex justify-between items-center">
              <div>
                {viewDetailsRequest.status === 'pending' && (
                  <button
                    className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-rose-50 px-5 py-2.5 text-sm font-semibold uppercase tracking-wide text-rose-700 transition-all hover:bg-rose-100 cursor-pointer"
                    onClick={() => setShowCancelConfirm(true)}
                    type="button"
                  >
                    Cancel Request
                  </button>
                )}
              </div>
              <button
                className="inline-flex items-center justify-center rounded-lg border border-neutral-200 bg-white px-5 py-2.5 text-sm font-semibold uppercase tracking-wide text-neutral-650 transition-all hover:bg-neutral-50 cursor-pointer"
                onClick={() => setViewDetailsRequest(null)}
                type="button"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && viewDetailsRequest && createPortal(
        <div
          onClick={() => setShowCancelConfirm(false)}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-sm animate-fade-in cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md rounded-2xl bg-white border border-neutral-200 shadow-premium-lg overflow-hidden flex flex-col cursor-default animate-modal-enter p-6 space-y-4"
          >
            <div className="flex items-center gap-3 text-rose-600">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-50 border border-rose-100">
                <AlertCircle size={20} className="text-rose-600" />
              </div>
              <h3 className="text-lg font-bold text-neutral-800">
                Cancel Leave Request
              </h3>
            </div>
            <p className="text-sm text-neutral-600 font-medium">
              Are you sure you want to cancel this leave request? This action cannot be undone and the request will be permanently removed.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                className="inline-flex items-center justify-center rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-600 transition-all hover:bg-neutral-50 cursor-pointer"
                onClick={() => setShowCancelConfirm(false)}
                type="button"
              >
                No, Keep Request
              </button>
              <button
                disabled={cancellingIds[viewDetailsRequest.id]}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-rose-700 disabled:bg-neutral-400 active:scale-95 cursor-pointer shadow-sm shadow-rose-500/10"
                onClick={() => handleCancel(viewDetailsRequest.id)}
                type="button"
              >
                {cancellingIds[viewDetailsRequest.id] ? (
                  <>
                    <Loader2 size={14} className="animate-spin text-white" /> Cancelling...
                  </>
                ) : (
                  'Yes, Cancel'
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Attachment Preview Modal */}
      {previewAttachment && createPortal(
        <div
          onClick={() => setPreviewAttachment(null)}
          className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-sm animate-fade-in cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-4xl rounded-2xl bg-white border border-neutral-200/85 shadow-premium-lg overflow-hidden flex flex-col max-h-[90vh] cursor-default animate-modal-enter"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-100 px-6 py-4">
              <div className="flex items-center gap-2.5">
                <FileText size={18} className="text-orange-600" />
                <h3 className="wrap-anywhere min-w-0 max-w-[40vw] text-base font-semibold text-neutral-800">
                  {previewAttachment.original_name}
                </h3>
                <span className="inline-flex items-center rounded-md bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-neutral-600 border border-neutral-200/50 uppercase">
                  {previewAttachment.original_name.split('.').pop()?.slice(0, 10) ?? 'FILE'}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <a
                  href={attachmentDownloadUrl(previewAttachment)}
                  className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-50 transition-colors shadow-premium-sm"
                >
                  <Download size={13} /> Download
                </a>
                <button
                  onClick={() => setPreviewAttachment(null)}
                  className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            
            {/* Content */}
            <div className="flex-1 p-6 bg-neutral-50/50 flex items-center justify-center overflow-auto">
              {isPdf(previewAttachment) ? (
                <iframe
                  src={attachmentPreviewUrl(previewAttachment)}
                  title={previewAttachment.original_name}
                  className="h-[70vh] w-full rounded-xl border border-neutral-200/60 bg-white shadow-premium-md"
                />
              ) : (
                <img
                  src={attachmentPreviewUrl(previewAttachment)}
                  alt={previewAttachment.original_name}
                  className="max-w-full max-h-[70vh] object-contain rounded-xl shadow-premium-md border border-neutral-200/50 bg-white p-2"
                />
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function Metric({ label, value, icon, variant }: { label: string; value: string | number; icon: React.ReactNode; variant: 'amber' | 'orange' | 'rose' | 'indigo' | 'green' }) {
  const themes = {
    amber: {
      border: 'border-amber-100/60',
      bg: 'bg-gradient-to-br from-amber-500/5 to-amber-600/5',
      iconBg: 'bg-amber-50 text-amber-600 border-amber-100/70',
    },
    orange: {
      border: 'border-orange-100/60',
      bg: 'bg-gradient-to-br from-orange-500/5 to-orange-600/5',
      iconBg: 'bg-orange-50 text-orange-600 border-orange-100/70',
    },
    green: {
      border: 'border-green-100/60',
      bg: 'bg-gradient-to-br from-green-500/5 to-green-600/5',
      iconBg: 'bg-green-50 text-green-600 border-green-100/70',
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
    <div className={`rounded-xl border ${theme.border} p-4 sm:p-6 bg-white shadow-premium-sm hover:shadow-premium-md transition-all duration-300 relative overflow-hidden group`}>
      <div className={`absolute top-0 right-0 w-24 h-24 rounded-full ${theme.bg} blur-2xl -mr-4 -mt-4 opacity-50 group-hover:scale-110 transition-transform duration-500`} />
      <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-neutral-400 relative z-10">
        <span>{label}</span>
        <div className={`flex h-8 w-8 items-center justify-center rounded-md border ${theme.iconBg} shadow-premium-sm transition-transform duration-300 group-hover:scale-105`}>
          {icon}
        </div>
      </div>
      <div className="mt-5 text-2xl sm:text-3xl font-medium tracking-tight text-neutral-800 relative z-10">{value}</div>
    </div>
  );
}

function Status({ status }: { status: string }) {
  const style = statusStyles[status] ?? { bg: 'bg-neutral-500/[0.04]', border: 'border-neutral-500/10', text: 'text-neutral-600/90', dot: 'bg-neutral-400' };
  return (
    <span className={`inline-flex items-center rounded-md border ${style.border} ${style.bg} ${style.text} px-2.5 py-0.5 text-xs font-semibold tracking-wide transition-all duration-300`}>
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot} mr-1.5 shrink-0`} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function SideList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div className="rounded-xl border border-neutral-200/50 bg-white p-5 shadow-premium-sm">
      <div className="mb-4 text-xs font-medium uppercase tracking-wider text-neutral-500">{title}</div>
      <div className="space-y-3.5">
        {items.map((item, idx) => (
          <div key={idx} className="border-t border-neutral-100/60 pt-3.5 text-sm text-neutral-600 font-medium first:border-t-0 first:pt-0">
            {item}
          </div>
        ))}
        {items.length === 0 && <p className="py-5 text-center text-sm text-neutral-400 font-medium">{empty}</p>}
      </div>
    </div>
  );
}
