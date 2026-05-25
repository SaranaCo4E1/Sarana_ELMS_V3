import { router } from '@inertiajs/react';
import { Check, Clock3, FileText, Search, ShieldCheck, Users, X, Eye, Download } from 'lucide-react';
import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import AppLayout from '../Layouts/AppLayout';
import type { LeaveRequest } from '../types';
import { formatDays, formatShortDate } from '../utils';
import LeaveBadge from '../Components/LeaveBadge';

type Props = {
  requests: LeaveRequest[];
  recentDecisions: LeaveRequest[];
  approvalStats: { pending: number; approved_this_month: number; rejected_this_month: number; team_members_on_leave: number };
};

const statusStyles: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  pending: { bg: 'bg-amber-500/[0.04]', border: 'border-amber-500/10', text: 'text-amber-700/90', dot: 'bg-amber-500' },
  approved: { bg: 'bg-orange-500/[0.04]', border: 'border-orange-500/10', text: 'text-orange-700/90', dot: 'bg-orange-500' },
  rejected: { bg: 'bg-rose-500/[0.04]', border: 'border-rose-500/10', text: 'text-rose-700/90', dot: 'bg-rose-500' },
  cancelled: { bg: 'bg-neutral-500/[0.04]', border: 'border-neutral-500/10', text: 'text-neutral-550/90', dot: 'bg-neutral-400' },
};

const attachmentPreviewUrl = (attachment: { id: number }) => `/approvals/attachments/${attachment.id}/preview`;
const attachmentDownloadUrl = (attachment: { id: number }) => `/approvals/attachments/${attachment.id}/download`;

export default function Approvals({ requests, recentDecisions, approvalStats }: Props) {
  const [comments, setComments] = useState<Record<number, string>>({});
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState('all');
  const [previewAttachment, setPreviewAttachment] = useState<any | null>(null);

  const isPreviewable = (attachment: any) => {
    const mime = attachment.mime_type?.toLowerCase() ?? '';
    if (mime.startsWith('image/') || mime === 'application/pdf') {
      return true;
    }
    const ext = attachment.original_name.split('.').pop()?.toLowerCase();
    return ['png', 'jpg', 'jpeg', 'webp', 'gif', 'pdf'].includes(ext ?? '');
  };

  const isPdf = (attachment: any) => {
    const mime = attachment.mime_type?.toLowerCase() ?? '';
    if (mime === 'application/pdf') {
      return true;
    }
    const ext = attachment.original_name.split('.').pop()?.toLowerCase();
    return ext === 'pdf';
  };

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
          <Metric icon={<ShieldCheck size={15} />} label="Approved This Month" value={approvalStats.approved_this_month} variant="orange" />
          <Metric icon={<X size={15} />} label="Rejected This Month" value={approvalStats.rejected_this_month} variant="rose" />
          <Metric icon={<Users size={15} />} label="On Leave Today" value={approvalStats.team_members_on_leave} variant="indigo" />
        </div>

        {/* Pending approvals section */}
        <div className="rounded-xl border border-neutral-200/50 bg-white shadow-premium-sm overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200/60 px-6 py-5 bg-neutral-50/20">
            <div>
              <h2 className="text-base font-medium text-neutral-800">Pending Approvals</h2>
              <p className="text-sm font-medium text-neutral-500 mt-1.5">Review time off applications and submit your decision</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="relative">
                <Search className="absolute left-3.5 top-3 text-neutral-400" size={14} />
                <input
                  className="w-52 rounded-lg border border-neutral-200/70 bg-white py-2.5 pl-9 pr-3.5 text-sm text-neutral-700 placeholder-neutral-400 focus:border-orange-600 focus:ring-4 focus:ring-orange-500/5 transition-all outline-none"
                  placeholder="Search requests..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <select
                className="rounded-lg border border-neutral-200/70 px-4 py-2.5 text-sm bg-white font-medium text-neutral-600 focus:border-orange-600 focus:ring-4 focus:ring-orange-500/5 transition-all outline-none"
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
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="text-sm font-medium text-neutral-800">{request.user?.name}</span>
                    <span className="inline-flex items-center rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-600 border border-neutral-200/50">
                      {request.user?.department?.name ?? 'General'}
                    </span>
                    <LeaveBadge code={request.leave_type.code} name={request.leave_type.name} />
                  </div>

                  <div className="text-sm text-neutral-500 font-medium">
                    Requested: <span className="font-medium text-neutral-800">{formatShortDate(request.starts_at)}</span> to <span className="font-medium text-neutral-800">{formatShortDate(request.ends_at)}</span>
                    <span className="mx-2.5">·</span>
                    <span className="font-medium text-orange-700">{formatDays(request.requested_days)} working day(s)</span>
                  </div>

                  {request.reason ? (
                    <p className="text-sm text-neutral-600 leading-relaxed bg-neutral-50/20 border border-neutral-200/60 rounded-lg p-3.5 italic shadow-premium-sm max-w-2xl">
                      "{request.reason}"
                    </p>
                  ) : (
                    <p className="text-sm text-neutral-400 italic font-medium">No notes provided.</p>
                  )}

                  <div className="flex flex-wrap gap-2.5 pt-1.5">
                    {(request.attachments ?? []).map((attachment) => {
                      const preview = isPreviewable(attachment);
                      const ext = attachment.original_name.split('.').pop()?.toUpperCase() ?? 'FILE';
                      return preview ? (
                        <button
                          key={attachment.id}
                          onClick={() => setPreviewAttachment(attachment)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-neutral-200 px-3.5 py-1.5 text-sm font-medium text-neutral-600 transition-all hover:bg-neutral-50 hover:border-neutral-300 hover:text-neutral-800 shadow-premium-sm cursor-pointer animate-fade-in"
                          type="button"
                        >
                          <FileText size={13} className="text-neutral-400" />
                          <span className="truncate max-w-44">{attachment.original_name}</span>
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
                          className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-neutral-200 px-3.5 py-1.5 text-sm font-medium text-neutral-600 transition-all hover:bg-neutral-50 hover:border-neutral-300 hover:text-neutral-800 shadow-premium-sm"
                          target="_blank"
                          rel="noreferrer"
                        >
                          <FileText size={13} className="text-neutral-400" />
                          <span className="truncate max-w-44">{attachment.original_name}</span>
                          <span className="inline-flex items-center rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-500 uppercase border border-neutral-200/40">
                            {ext}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded bg-neutral-50 border border-neutral-200 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-500 ml-1">
                            <Download size={10} /> Download
                          </span>
                        </a>
                      );
                    })}
                    {(request.attachments ?? []).length === 0 && (
                      <span className="text-sm font-medium text-neutral-400">No attachments provided</span>
                    )}
                  </div>
                </div>

                {/* Comment & Decision inputs */}
                <div className="flex flex-col justify-between rounded-xl border border-neutral-200/50 bg-white p-5 shadow-premium-sm">
                  <div>
                    <label className="block text-xs font-medium uppercase tracking-wider text-neutral-500 mb-2">
                      Decision Comment
                    </label>
                    <textarea
                      className="h-24 w-full rounded-lg border border-neutral-200/70 p-3 text-sm text-neutral-700 placeholder:text-neutral-400 focus:border-orange-600 focus:ring-4 focus:ring-orange-500/5 transition-all outline-none resize-none"
                      placeholder="Comment or reason for approval/rejection..."
                      value={comments[request.id] ?? ''}
                      onChange={(e) => setComments({ ...comments, [request.id]: e.target.value })}
                    />
                  </div>
                  <div className="mt-4.5 grid grid-cols-2 gap-3">
                    <button
                      className="flex items-center justify-center gap-2 rounded-lg bg-orange-600 py-2.5 text-sm font-semibold text-white transition-all hover:bg-orange-700 active:scale-98 cursor-pointer shadow-premium-sm"
                      onClick={() => decide(request.id, 'approved')}
                    >
                      <Check size={15} /> Approve
                    </button>
                    <button
                      className="flex items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50/50 py-2.5 text-sm font-semibold text-rose-700 transition-all hover:bg-rose-50 hover:border-rose-300 hover:text-rose-800 active:scale-98 cursor-pointer shadow-premium-sm"
                      onClick={() => decide(request.id, 'rejected')}
                    >
                      <X size={15} /> Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="p-12 text-center text-sm text-neutral-400 font-medium">
                No pending requests in your inbox.
              </div>
            )}
          </div>
        </div>
        {/* Recent decisions log */}
        <div className="rounded-xl border border-neutral-200/50 bg-white shadow-premium-sm overflow-hidden">
          <div className="border-b border-neutral-200/60 px-6 py-5 bg-neutral-50/20">
            <h2 className="text-base font-medium text-neutral-800">Recent Decisions</h2>
            <p className="text-sm font-medium text-neutral-500 mt-1.5">Log of recently approved or rejected leave requests</p>
          </div>
          
          {/* Mobile Card List View */}
          <div className="divide-y divide-neutral-100 sm:hidden">
            {recentDecisions.map((request) => {
              const statusStyle = statusStyles[request.status] ?? { bg: 'bg-neutral-50/60', border: 'border-neutral-200/70', text: 'text-neutral-500' };
              return (
                <div key={request.id} className="p-5 space-y-4 bg-white">
                  <div className="flex items-center justify-between gap-2.5">
                    <span className="font-medium text-neutral-800 text-sm">{request.user?.name}</span>
                    <span className={`inline-flex items-center rounded-md border ${statusStyle.border} ${statusStyle.bg} ${statusStyle.text} px-2.5 py-0.5 text-xs font-semibold tracking-wide transition-all duration-300`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${statusStyle.dot} mr-1.5 shrink-0`} />
                      {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3.5 text-sm text-neutral-500">
                    <div>
                      <div className="text-xs text-neutral-400 uppercase font-medium tracking-wider">Leave Type</div>
                      <div className="mt-1">
                        <LeaveBadge code={request.leave_type.code} name={request.leave_type.name} variant="minimal" />
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-neutral-400 uppercase font-medium tracking-wider">Days</div>
                      <div className="font-medium text-neutral-700 mt-1">{formatDays(request.requested_days)}</div>
                    </div>
                  </div>

                  <div className="text-sm text-neutral-500 font-medium">
                    Dates: <span className="font-medium text-neutral-800">{formatShortDate(request.starts_at)} – {formatShortDate(request.ends_at)}</span>
                  </div>

                  {request.manager_comment && (
                    <div className="bg-neutral-50/50 rounded-lg p-3.5 border border-neutral-100 text-sm text-neutral-500 font-medium">
                      <span className="font-medium text-neutral-600">Comment:</span> {request.manager_comment}
                    </div>
                  )}
                </div>
              );
            })}
            {recentDecisions.length === 0 && (
              <div className="p-8 text-center text-sm text-neutral-400 font-medium">
                No decision history found.
              </div>
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-50/50 text-xs font-medium uppercase tracking-wider text-neutral-500 border-b border-neutral-100/60">
                <tr>
                  <th className="px-6 py-5">Employee</th>
                  <th className="px-4 py-5">Leave Type</th>
                  <th className="px-4 py-5">Dates</th>
                  <th className="px-4 py-5">Days</th>
                  <th className="px-4 py-5">Status</th>
                  <th className="px-6 py-5">Manager Comment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100/60">
                {recentDecisions.map((request) => {
                  const statusStyle = statusStyles[request.status] ?? { bg: 'bg-neutral-50/60', border: 'border-neutral-200/70', text: 'text-neutral-500' };
                  return (
                    <tr key={request.id} className="transition-all hover:bg-neutral-50/40">
                      <td className="px-6 py-4.5 font-medium text-neutral-800">{request.user?.name}</td>
                      <td className="px-4 py-4.5 text-neutral-600 font-medium">
                        <LeaveBadge code={request.leave_type.code} name={request.leave_type.name} variant="minimal" />
                      </td>
                      <td className="px-4 py-4.5 text-neutral-500 font-medium whitespace-nowrap">
                        {formatShortDate(request.starts_at)} – {formatShortDate(request.ends_at)}
                      </td>
                      <td className="px-4 py-4.5 font-medium text-neutral-700">{formatDays(request.requested_days)}</td>
                      <td className="px-4 py-4.5">
                        <span className={`inline-flex items-center rounded-md border ${statusStyle.border} ${statusStyle.bg} ${statusStyle.text} px-2.5 py-0.5 text-xs font-semibold tracking-wide transition-all duration-300`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${statusStyle.dot} mr-1.5 shrink-0`} />
                          {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4.5 max-w-80 truncate text-neutral-500 font-medium" title={request.manager_comment ?? ''}>
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

      {/* Attachment Preview Modal */}
      {previewAttachment && createPortal(
        <div
          onClick={() => setPreviewAttachment(null)}
          className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-sm animate-fade-in cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-4xl rounded-2xl bg-white border border-neutral-200/85 shadow-premium-lg overflow-hidden flex flex-col max-h-[90vh] cursor-default"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-100 px-6 py-4">
              <div className="flex items-center gap-2.5">
                <FileText size={18} className="text-orange-600" />
                <h3 className="text-base font-semibold text-neutral-800 truncate max-w-[40vw]">
                  {previewAttachment.original_name}
                </h3>
                <span className="inline-flex items-center rounded-md bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-neutral-600 border border-neutral-200/50 uppercase">
                  {previewAttachment.original_name.split('.').pop() ?? 'FILE'}
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
    </AppLayout>
  );
}

function Metric({ label, value, icon, variant }: { label: string; value: string | number; icon: React.ReactNode; variant: 'amber' | 'orange' | 'rose' | 'indigo' }) {
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
    <div className={`rounded-xl border ${theme.border} p-6 bg-white shadow-premium-sm hover:shadow-premium-md transition-all duration-300 relative overflow-hidden group`}>
      <div className={`absolute top-0 right-0 w-24 h-24 rounded-full ${theme.bg} blur-2xl -mr-4 -mt-4 opacity-50 group-hover:scale-110 transition-transform duration-500`} />
      <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-neutral-500 relative z-10">
        <span>{label}</span>
        <div className={`flex h-8 w-8 items-center justify-center rounded-md border ${theme.iconBg} shadow-premium-sm transition-transform duration-300 group-hover:scale-105`}>
          {icon}
        </div>
      </div>
      <div className="mt-5 text-3xl font-medium tracking-tight text-neutral-800 relative z-10">{value}</div>
    </div>
  );
}
