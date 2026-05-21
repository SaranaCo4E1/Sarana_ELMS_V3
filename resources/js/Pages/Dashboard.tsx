import { Link, router, usePage } from '@inertiajs/react';
import {
  ArrowRight,
  Calendar,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  Eye,
  FileText,
  Image as ImageIcon,
  MessageSquare,
  Paperclip,
  Send,
  Trash2,
  User2,
  X,
  XCircle,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import DatePicker from '../Components/DatePicker';
import Select from '../Components/Select';
import AppLayout from '../Layouts/AppLayout';
import type { LeaveBalance, LeaveRequest, LeaveType, PageProps } from '../types';

type Props = {
  activePage: 'dashboard' | 'leave-request';
  leaveTypes: LeaveType[];
  balances: LeaveBalance[];
  requests: LeaveRequest[];
  pendingApprovals: LeaveRequest[];
  notifications: { id: number; title: string; body: string; created_at: string; type?: string; reference_id?: number | null }[];
  faqs: { id: number; question: string; answer: string }[];
};

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800',
  cancelled: 'bg-slate-100 text-slate-500',
};

const RING_COLORS = ['#059669', '#0ea5e9', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const TAB_LINKS = [
  { id: 'dashboard', label: 'Dashboard', href: '/' },
  { id: 'leave-request', label: 'Leave Request', href: '/leave-requests' },
] as const;

export default function Dashboard({ activePage, leaveTypes, balances, requests, pendingApprovals, notifications, faqs }: Props) {
  const page = usePage<PageProps>();
  const { errors } = page.props;

  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(() => {
    const id = new URLSearchParams(window.location.search).get('request');
    return id ? requests.find((r) => r.id === Number(id)) ?? null : null;
  });

  function openRequest(r: LeaveRequest) {
    setSelectedRequest(r);
    const url = new URL(window.location.href);
    url.searchParams.set('request', String(r.id));
    window.history.replaceState({}, '', url.toString());
  }

  function closeRequest() {
    setSelectedRequest(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('request');
    window.history.replaceState({}, '', url.toString());
  }

  const mergedNotifications = [
    ...(pendingApprovals.length > 0
      ? [{ id: -1, title: 'Pending Approvals', body: `${pendingApprovals.length} request(s) awaiting your review`, created_at: new Date().toISOString(), type: 'approval' }]
      : []),
    ...notifications,
  ];

  return (
    <AppLayout notifications={mergedNotifications} faqs={faqs}>
      {/* Mobile nav (sidebar hidden on small screens) */}
      <div className="mb-5 flex gap-1 rounded-xl bg-slate-100 p-1 lg:hidden">
        {TAB_LINKS.map((t) => (
          <Link
            key={t.id}
            href={t.href}
            className={`flex-1 rounded-lg px-3 py-2 text-center text-sm transition-colors ${activePage === t.id ? 'bg-white font-medium text-slate-900 shadow-sm' : 'text-slate-500'}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {activePage === 'dashboard' && <DashboardView balances={balances} requests={requests} />}
      {activePage === 'leave-request' && (
        <LeaveRequestView
          leaveTypes={leaveTypes}
          balances={balances}
          requests={requests}
          errors={errors}
          onOpenRequest={openRequest}
          selectedRequest={selectedRequest}
          onCloseRequest={closeRequest}
        />
      )}
    </AppLayout>
  );
}

/* ------------------------------------------------------------------ */
/*  Dashboard Tab                                                      */
/* ------------------------------------------------------------------ */

function DashboardView({
  balances,
  requests,
}: {
  balances: LeaveBalance[];
  requests: LeaveRequest[];
}) {
  const ringCount = Math.min(balances.length, 4);

  return (
    <div className="space-y-6">
      {/* Quota Progress Rings — max 4, always stretch to fill */}
      <section
        className={`grid gap-4 grid-cols-1 sm:grid-cols-2 ${
          ({ 1: 'lg:grid-cols-1', 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4' } as Record<number, string>)[ringCount] ?? 'lg:grid-cols-3'
        }`}
      >
        {balances.slice(0, 4).map((b, i) => (
          <ProgressRing
            key={b.id}
            label={b.leave_type.name}
            used={parseFloat(b.used_days) || 0}
            pending={parseFloat(b.pending_days) || 0}
            total={parseFloat(b.allowance_days) || 0}
            available={b.available_days}
            color={RING_COLORS[i % RING_COLORS.length]}
          />
        ))}
      </section>

      {/* Analytical Charts */}
      <section className="grid gap-6 lg:grid-cols-2">
        <MonthlyTrendsChart requests={requests} />
        <TypeDistributionChart balances={balances} />
      </section>

      {/* Compact report download */}
      <div className="flex items-center justify-end">
        <a
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
          href={`/reports/monthly?month=${new Date().toISOString().slice(0, 7)}`}
        >
          <Download size={15} /> Download monthly report
        </a>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Leave Request Tab                                                  */
/* ------------------------------------------------------------------ */

function calcWorkingDays(start: string, end: string): number | null {
  if (!start || !end) return null;
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return null;
  let count = 0;
  const cur = new Date(s);
  while (cur <= e) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function formatDateFull(raw: string): string {
  return new Date(raw).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}

const INPUT_CLS = 'w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 transition-colors placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500';

function LeaveRequestView({
  leaveTypes,
  balances,
  requests,
  errors,
  onOpenRequest,
  selectedRequest,
  onCloseRequest,
}: {
  leaveTypes: LeaveType[];
  balances: LeaveBalance[];
  requests: LeaveRequest[];
  errors: Record<string, string>;
  onOpenRequest: (r: LeaveRequest) => void;
  selectedRequest: LeaveRequest | null;
  onCloseRequest: () => void;
}) {
  const [form, setForm] = useState({
    leave_type_id: leaveTypes[0]?.id ?? '',
    starts_at: '',
    ends_at: '',
    is_half_day: false,
    reason: '',
    attachments: [] as File[],
  });

  const rawDays = useMemo(() => calcWorkingDays(form.starts_at, form.ends_at), [form.starts_at, form.ends_at]);
  const isSingleDay = form.starts_at !== '' && form.starts_at === form.ends_at;
  const days = rawDays !== null && form.is_half_day && isSingleDay ? 0.5 : rawDays;

  const selectedBalance = balances.find((b) => b.leave_type.id === Number(form.leave_type_id));
  const available = selectedBalance?.available_days ?? null;
  const isOverLimit = available !== null && days !== null && days > available;

  function submitLeave(e: React.FormEvent) {
    e.preventDefault();
    if (isOverLimit) return;
    const data = new FormData();
    data.append('leave_type_id', String(form.leave_type_id));
    data.append('starts_at', form.starts_at);
    data.append('ends_at', form.ends_at);
    if (form.is_half_day && isSingleDay) data.append('is_half_day', '1');
    data.append('reason', form.reason);
    form.attachments.forEach((file) => data.append('attachments[]', file));
    router.post('/leave-requests', data, { forceFormData: true });
  }

  function removeFile(idx: number) {
    setForm((f) => ({ ...f, attachments: f.attachments.filter((_, i) => i !== idx) }));
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      {/* ── Submit Form ─────────────────────────────────────────── */}
      <form onSubmit={submitLeave} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Form Header */}
        <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <CalendarPlus size={20} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">New Leave Request</h2>
            <p className="text-sm text-slate-500">Fill in the details below to submit a request</p>
          </div>
        </div>

        <div className="p-6">
          {/* Validation errors */}
          {Object.values(errors).length > 0 && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {Object.values(errors)[0]}
            </div>
          )}

          {/* Leave Type */}
          <div className="mb-5">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Leave Type</label>
            <Select
              value={String(form.leave_type_id)}
              onChange={(v) => setForm({ ...form, leave_type_id: Number(v) })}
              options={leaveTypes.map((t) => ({ value: String(t.id), label: t.name }))}
              placeholder="Select leave type"
              icon={<FileText size={16} />}
            />
            {available !== null && (
              <div className={`mt-2 text-xs font-medium ${isOverLimit ? 'text-red-500' : 'text-slate-400'}`}>
                Available: {available} {available === 1 ? 'day' : 'days'}
              </div>
            )}
          </div>

          {/* Date Range */}
          <div className="mb-5">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Date Range</label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <div className="flex-1">
                <DatePicker
                  value={form.starts_at}
                  label="Start date"
                  minDate={today}
                  onChange={(val) =>
                    setForm((f) => {
                      const ends = f.ends_at && f.ends_at < val ? val : f.ends_at;
                      return { ...f, starts_at: val, ends_at: ends, is_half_day: val === ends ? f.is_half_day : false };
                    })
                  }
                />
              </div>

              <div className="hidden shrink-0 pt-2.5 sm:flex">
                <ArrowRight size={18} className="text-slate-300" />
              </div>

              <div className="flex-1">
                <DatePicker
                  value={form.ends_at}
                  label="End date"
                  minDate={form.starts_at || today}
                  onChange={(val) => setForm({ ...form, ends_at: val, is_half_day: form.starts_at === val ? form.is_half_day : false })}
                />
              </div>

              {/* Days badge */}
              {days !== null && (
                <div className="flex h-[42px] shrink-0 items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-700">
                  <Clock size={14} />
                  {days} {days === 1 || days === 0.5 ? 'day' : 'days'}
                </div>
              )}
            </div>

            {/* Half / Full day toggle */}
            {isSingleDay && (
              <div className="mt-3 flex items-center gap-1 rounded-xl bg-slate-100 p-1">
                {([false, true] as const).map((half) => (
                  <button
                    key={half ? 'half' : 'full'}
                    type="button"
                    className={`flex-1 rounded-lg px-4 py-2 text-sm transition-colors ${
                      form.is_half_day === half
                        ? 'bg-white font-medium text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                    onClick={() => setForm((f) => ({ ...f, is_half_day: half }))}
                  >
                    {half ? 'Half Day (0.5)' : 'Full Day (1.0)'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Reason */}
          <div className="mb-5">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Reason</label>
            <textarea
              className="min-h-[100px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 transition-colors placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="Briefly describe the reason for your leave..."
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
            />
          </div>

          {/* Attachments */}
          <div className="mb-6">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Attachments</label>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-2.5 text-sm text-slate-500 transition-colors hover:border-emerald-400 hover:bg-emerald-50/50 hover:text-emerald-700">
                <Paperclip size={15} /> Browse files
                <input
                  className="hidden"
                  type="file"
                  multiple
                  onChange={(e) => setForm((f) => ({ ...f, attachments: [...f.attachments, ...Array.from(e.target.files ?? [])] }))}
                />
              </label>
              {form.attachments.map((file, i) => (
                <span
                  key={`${file.name}-${i}`}
                  className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700"
                >
                  {file.name.length > 20 ? file.name.slice(0, 17) + '...' : file.name}
                  <button type="button" className="text-slate-400 hover:text-red-500" onClick={() => removeFile(i)}>
                    <X size={13} />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Over-limit warning */}
          {isOverLimit && (
            <div className="mb-5 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <XCircle size={16} className="shrink-0" />
              <span>
                You are requesting <strong>{days} {days === 1 ? 'day' : 'days'}</strong> but only have <strong>{available} {available === 1 ? 'day' : 'days'}</strong> available for this leave type.
              </span>
            </div>
          )}

          {/* Submit */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isOverLimit}
              className={`inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-colors ${
                isOverLimit ? 'cursor-not-allowed bg-slate-300' : 'bg-emerald-700 hover:bg-emerald-800'
              }`}
            >
              <Send size={16} /> Submit Request
            </button>
          </div>
        </div>
      </form>

      {/* ── Request History ──────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
              <CalendarDays size={20} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Request History</h2>
              <p className="text-sm text-slate-500">{requests.length} {requests.length === 1 ? 'request' : 'requests'} total</p>
            </div>
          </div>
        </div>

        {requests.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <CalendarDays size={28} />
            </div>
            <p className="mt-4 text-sm font-medium text-slate-500">No leave requests yet</p>
            <p className="mt-1 text-xs text-slate-400">Your submitted requests will appear here</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {requests.map((r) => {
              const statusStyle = STATUS_STYLE[r.status] ?? 'bg-slate-100 text-slate-600';
              const isPending = r.status === 'pending';
              return (
                <button
                  key={r.id}
                  type="button"
                  className="flex w-full items-start justify-between gap-4 px-6 py-4 text-left transition-colors hover:bg-slate-50/60"
                  onClick={() => onOpenRequest(r)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">{r.leave_type.name}</span>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusStyle}`}>
                        {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <Calendar size={13} className="text-slate-400" />
                        {formatDateFull(r.starts_at)}
                        <ChevronRight size={12} className="text-slate-300" />
                        {formatDateFull(r.ends_at)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock size={13} className="text-slate-400" />
                        {r.requested_days} {parseFloat(r.requested_days) === 1 ? 'day' : 'days'}
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={16} className="mt-1.5 shrink-0 text-slate-300" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Detail Modal ────────────────────────────────────────── */}
      {selectedRequest && (
        <RequestDetailModal
          request={selectedRequest}
          onClose={onCloseRequest}
          onCancel={(id) => { onCloseRequest(); router.delete(`/leave-requests/${id}`); }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Request Detail Modal                                               */
/* ------------------------------------------------------------------ */

const STATUS_ICON: Record<string, React.ReactNode> = {
  pending: <Clock size={16} className="text-amber-600" />,
  approved: <CheckCircle2 size={16} className="text-emerald-600" />,
  rejected: <XCircle size={16} className="text-red-500" />,
  cancelled: <XCircle size={16} className="text-slate-400" />,
};

const STATUS_LABEL_STYLE: Record<string, string> = {
  pending: 'border-amber-200 bg-amber-50 text-amber-700',
  approved: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  rejected: 'border-red-200 bg-red-50 text-red-700',
  cancelled: 'border-slate-200 bg-slate-50 text-slate-500',
};

function RequestDetailModal({
  request: r,
  onClose,
  onCancel,
}: {
  request: LeaveRequest;
  onClose: () => void;
  onCancel: (id: number) => void;
}) {
  const statusLabelStyle = STATUS_LABEL_STYLE[r.status] ?? 'border-slate-200 bg-slate-50 text-slate-500';
  const isPending = r.status === 'pending';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg animate-[scaleIn_0.15s_ease-out] overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <FileText size={18} />
            </div>
            <h3 className="text-base font-semibold text-slate-900">Request Details</h3>
          </div>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
          {/* Status banner */}
          <div className={`mb-5 flex items-center gap-2.5 rounded-xl border px-4 py-3 ${statusLabelStyle}`}>
            {STATUS_ICON[r.status] ?? <Clock size={16} />}
            <span className="text-sm font-semibold">{r.status.charAt(0).toUpperCase() + r.status.slice(1)}</span>
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-4">
            <DetailField label="Leave Type" value={r.leave_type.name} />
            <DetailField label="Duration" value={`${r.requested_days} ${parseFloat(r.requested_days) === 1 ? 'day' : 'days'}`} />
            <DetailField label="Start Date" value={formatDateFull(r.starts_at)} />
            <DetailField label="End Date" value={formatDateFull(r.ends_at)} />
          </div>

          {/* Reason */}
          <div className="mt-5">
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Reason</div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3 text-sm leading-relaxed text-slate-700">
              {r.reason || <span className="italic text-slate-400">No reason provided</span>}
            </div>
          </div>

          {/* Manager comment */}
          {r.manager_comment && (
            <div className="mt-5">
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Manager Comment</div>
              <div className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3">
                <MessageSquare size={15} className="mt-0.5 shrink-0 text-slate-400" />
                <div className="text-sm leading-relaxed text-slate-700">
                  {r.manager_comment}
                  {r.approver && (
                    <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-400">
                      <User2 size={11} /> {r.approver.name}
                      {r.decided_at && <> &middot; {formatDateFull(r.decided_at)}</>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Attachments */}
          {r.attachments && r.attachments.length > 0 && (
            <AttachmentViewer attachments={r.attachments} />
          )}

          {/* Timeline */}
          <div className="mt-5">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Timeline</div>
            <div className="space-y-2.5">
              {r.submitted_at && (
                <TimelineRow icon={<Send size={13} />} label="Submitted" date={r.submitted_at} color="text-sky-600 bg-sky-100" />
              )}
              {!r.submitted_at && r.created_at && (
                <TimelineRow icon={<Send size={13} />} label="Created" date={r.created_at} color="text-sky-600 bg-sky-100" />
              )}
              {r.status === 'approved' && r.decided_at && (
                <TimelineRow icon={<CheckCircle2 size={13} />} label="Approved" date={r.decided_at} color="text-emerald-600 bg-emerald-100" />
              )}
              {r.status === 'rejected' && r.decided_at && (
                <TimelineRow icon={<XCircle size={13} />} label="Rejected" date={r.decided_at} color="text-red-500 bg-red-100" />
              )}
              {r.status === 'cancelled' && (
                <TimelineRow icon={<XCircle size={13} />} label="Cancelled" date={r.decided_at ?? r.created_at ?? ''} color="text-slate-400 bg-slate-100" />
              )}
              {r.status === 'pending' && (
                <TimelineRow icon={<Clock size={13} />} label="Awaiting approval" date="" color="text-amber-600 bg-amber-100" />
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
          {isPending && (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-100"
              onClick={() => onCancel(r.id)}
            >
              <Trash2 size={14} /> Cancel Request
            </button>
          )}
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
      <div className="mt-1 text-sm font-medium text-slate-800">{value}</div>
    </div>
  );
}

function TimelineRow({ icon, label, date, color }: { icon: React.ReactNode; label: string; date: string; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`flex h-6 w-6 items-center justify-center rounded-full ${color}`}>{icon}</div>
      <div className="flex flex-1 items-center justify-between">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        {date && (
          <span className="text-xs text-slate-400">
            {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Attachment Viewer                                                  */
/* ------------------------------------------------------------------ */

type Attachment = { id: number; original_name: string; path: string; mime_type: string };

function isImage(mime: string) {
  return mime.startsWith('image/');
}

function attachmentUrl(id: number, inline = false) {
  return `/attachments/${id}${inline ? '?inline=1' : ''}`;
}

function AttachmentViewer({ attachments }: { attachments: Attachment[] }) {
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);

  const images = attachments.filter((a) => isImage(a.mime_type));
  const files = attachments.filter((a) => !isImage(a.mime_type));

  return (
    <div className="mt-5">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        Attachments ({attachments.length})
      </div>

      {images.length > 0 && (
        <div className="mb-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {images.map((a) => {
            const idx = attachments.indexOf(a);
            return (
              <button
                key={a.id}
                type="button"
                className="group relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-50 transition-all hover:border-emerald-300 hover:shadow-md"
                onClick={() => setPreviewIdx(idx)}
              >
                <img
                  src={attachmentUrl(a.id, true)}
                  alt={a.original_name}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
                  <Eye size={20} className="text-white opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {files.length > 0 && (
        <div className="space-y-1.5">
          {files.map((a) => (
            <a
              key={a.id}
              href={attachmentUrl(a.id)}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm transition-colors hover:border-emerald-300 hover:bg-emerald-50/30"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                <FileIcon mime={a.mime_type} />
              </div>
              <span className="min-w-0 flex-1 truncate font-medium text-slate-700">{a.original_name}</span>
              <Download size={14} className="shrink-0 text-slate-400" />
            </a>
          ))}
        </div>
      )}

      {previewIdx !== null && (
        <ImageLightbox
          attachments={attachments.filter((a) => isImage(a.mime_type))}
          initialIndex={images.indexOf(attachments[previewIdx])}
          onClose={() => setPreviewIdx(null)}
        />
      )}
    </div>
  );
}

function FileIcon({ mime }: { mime: string }) {
  if (mime.includes('pdf')) return <FileText size={16} />;
  if (mime.includes('image')) return <ImageIcon size={16} />;
  return <Paperclip size={16} />;
}

function ImageLightbox({
  attachments,
  initialIndex,
  onClose,
}: {
  attachments: Attachment[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(initialIndex);
  const current = attachments[idx];
  if (!current) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={onClose}>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
      <div className="relative flex max-h-[90vh] max-w-[90vw] flex-col items-center" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex w-full items-center justify-between">
          <span className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium text-white backdrop-blur">
            {current.original_name}
          </span>
          <div className="flex items-center gap-2">
            <a
              href={attachmentUrl(current.id)}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white transition-colors hover:bg-white/20"
              title="Download"
            >
              <Download size={16} />
            </a>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white transition-colors hover:bg-white/20"
              onClick={onClose}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <img
          src={attachmentUrl(current.id, true)}
          alt={current.original_name}
          className="max-h-[80vh] max-w-full rounded-lg object-contain shadow-2xl"
        />

        {attachments.length > 1 && (
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 disabled:opacity-30"
              disabled={idx === 0}
              onClick={() => setIdx((i) => i - 1)}
            >
              <ChevronRight size={18} className="rotate-180" />
            </button>
            <span className="text-sm text-white/70">
              {idx + 1} / {attachments.length}
            </span>
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 disabled:opacity-30"
              disabled={idx === attachments.length - 1}
              onClick={() => setIdx((i) => i + 1)}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SVG Progress Ring                                                  */
/* ------------------------------------------------------------------ */

function ProgressRing({
  label,
  used,
  pending,
  total,
  available,
  color,
}: {
  label: string;
  used: number;
  pending: number;
  total: number;
  available: number;
  color: string;
}) {
  const R = 50;
  const C = 2 * Math.PI * R;
  const pct = total > 0 ? Math.max(0, Math.min(used / total, 1)) : 0;
  const offset = C * (1 - pct);

  return (
    <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-white px-4 py-5 shadow-sm">
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={R} fill="none" stroke="#f1f5f9" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r={R}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={C}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 60 60)"
          style={{ transition: 'stroke-dashoffset 0.7s ease' }}
        />
        <text x="60" y="55" textAnchor="middle" fontSize="26" fontWeight="700" fill="#0f172a">
          {available}
        </text>
        <text x="60" y="72" textAnchor="middle" fontSize="11" fill="#64748b">
          available
        </text>
      </svg>
      <div className="mt-1 text-center">
        <div className="text-sm font-semibold text-slate-900">{label}</div>
        <div className="mt-1 flex flex-wrap justify-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
          <span>{total} quota</span>
          <span>{used} used</span>
          <span>{pending} pending</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Monthly Bar Chart                                                  */
/* ------------------------------------------------------------------ */

function MonthlyTrendsChart({ requests }: { requests: LeaveRequest[] }) {
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const year = new Date().getFullYear();
  const curMonth = new Date().getMonth();

  const monthly = MONTHS.map((_, i) =>
    requests
      .filter((r) => {
        const d = new Date(r.starts_at);
        return d.getFullYear() === year && d.getMonth() === i && r.status !== 'cancelled';
      })
      .reduce((s, r) => s + (parseFloat(r.requested_days) || 0), 0),
  );

  const peak = Math.max(...monthly, 1);
  const BAR = 32;
  const GAP = 14;
  const H = 150;
  const W = MONTHS.length * (BAR + GAP);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="font-semibold text-slate-900">Leave Taken Trends</h3>
      <p className="mt-1 text-xs text-slate-500">{year} &middot; working days per month</p>
      <div className="mt-5 overflow-x-auto pb-1">
        <svg width={W} height={H + 26} style={{ minWidth: W }}>
          {MONTHS.map((m, i) => {
            const h = peak > 0 ? (monthly[i] / peak) * (H - 16) : 0;
            const x = i * (BAR + GAP) + GAP / 2;
            const y = H - 16 - h;
            const cur = i === curMonth;
            return (
              <g key={m}>
                <rect x={x} y={0} width={BAR} height={H - 16} rx={6} fill="#f1f5f9" />
                {h > 0 && (
                  <rect
                    x={x}
                    y={y}
                    width={BAR}
                    height={h}
                    rx={6}
                    fill={cur ? '#059669' : '#6ee7b7'}
                    style={{ transition: 'height 0.5s ease, y 0.5s ease' }}
                  />
                )}
                <text
                  x={x + BAR / 2}
                  y={H + 2}
                  textAnchor="middle"
                  fontSize="10"
                  fill={cur ? '#059669' : '#94a3b8'}
                  fontWeight={cur ? '600' : '400'}
                >
                  {m}
                </text>
                {monthly[i] > 0 && (
                  <text x={x + BAR / 2} y={y - 6} textAnchor="middle" fontSize="10" fontWeight="600" fill="#334155">
                    {monthly[i]}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Donut Distribution Chart                                           */
/* ------------------------------------------------------------------ */

function TypeDistributionChart({ balances }: { balances: LeaveBalance[] }) {
  const slices = balances
    .map((b, i) => ({
      name: b.leave_type.name,
      value: parseFloat(b.used_days) || 0,
      color: RING_COLORS[i % RING_COLORS.length],
    }))
    .filter((s) => s.value > 0);

  const total = slices.reduce((s, d) => s + d.value, 0);
  const R = 50;
  const C = 2 * Math.PI * R;
  let acc = 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="font-semibold text-slate-900">Leave Type Distribution</h3>
      <p className="mt-1 text-xs text-slate-500">Breakdown by type used</p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-8">
        <svg width="130" height="130" viewBox="0 0 130 130">
          {total === 0 ? (
            <circle cx="65" cy="65" r={R} fill="none" stroke="#f1f5f9" strokeWidth="14" />
          ) : (
            slices.map((s) => {
              const pct = s.value / total;
              const len = pct * C;
              const rot = acc * 360 - 90;
              acc += pct;
              return (
                <circle
                  key={s.name}
                  cx="65"
                  cy="65"
                  r={R}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="14"
                  strokeDasharray={`${len} ${C - len}`}
                  transform={`rotate(${rot} 65 65)`}
                  style={{ transition: 'stroke-dasharray 0.5s ease' }}
                />
              );
            })
          )}
          <text x="65" y="60" textAnchor="middle" fontSize="22" fontWeight="700" fill="#0f172a">
            {total}
          </text>
          <text x="65" y="78" textAnchor="middle" fontSize="11" fill="#64748b">
            days
          </text>
        </svg>

        <div className="space-y-2.5">
          {slices.length > 0 ? (
            slices.map((s) => (
              <div key={s.name} className="flex items-center gap-2.5">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="text-sm text-slate-600">{s.name}</span>
                <span className="text-sm font-semibold text-slate-900">{s.value}d</span>
                <span className="text-xs text-slate-400">({Math.round((s.value / total) * 100)}%)</span>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-400">No leave taken yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
