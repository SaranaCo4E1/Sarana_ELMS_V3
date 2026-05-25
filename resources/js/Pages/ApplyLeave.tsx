import { router, usePage } from '@inertiajs/react';
import { AlertCircle, Bot, CalendarClock, CalendarPlus, CheckCircle2, Clock3, Paperclip, Search, Send, Sparkles, X } from 'lucide-react';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import DatePicker from 'react-datepicker';
import AppLayout from '../Layouts/AppLayout';
import type { LeaveBalance, LeaveRequest, LeaveType, PageProps } from '../types';
import { formatDays, formatShortDate } from '../utils';

type Holiday = { id: number; name: string; holiday_date: string };
type Props = {
  leaveTypes: LeaveType[];
  balances: LeaveBalance[];
  requests: LeaveRequest[];
  requestStats: { pending: number; approved: number; rejected: number; cancelled: number; scheduled_days: number };
  holidays: Holiday[];
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

export default function ApplyLeave({ leaveTypes, balances, requests, requestStats, holidays }: Props) {
  const { errors } = usePage<PageProps>().props;
  const [form, setForm] = useState({
    leave_type_id: leaveTypes[0]?.id ?? '',
    starts_at: '',
    ends_at: '',
    duration: 'full_day',
    reason: '',
    attachments: [] as File[]
  });
  const [statusFilter, setStatusFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [aiDraftImported, setAiDraftImported] = useState(false);

  // Date states for react-datepicker
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  const selectedType = leaveTypes.find((type) => type.id === Number(form.leave_type_id));
  const filteredRequests = requests.filter((request) => {
    const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
    const haystack = `${request.leave_type.name} ${request.reason} ${request.manager_comment ?? ''}`.toLowerCase();
    return matchesStatus && haystack.includes(query.toLowerCase());
  });

  const projectedDays = useMemo(() => {
    if (!form.starts_at || !form.ends_at) return 0;
    const start = new Date(`${form.starts_at}T00:00:00`);
    const end = new Date(`${form.ends_at}T00:00:00`);
    if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf()) || end < start) return 0;
    
    const holidaySet = new Set(holidays.map((holiday) => holiday.holiday_date.slice(0, 10)));
    let days = 0;
    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      const day = date.getDay();
      const iso = date.toISOString().slice(0, 10);
      if (day !== 0 && day !== 6 && !holidaySet.has(iso)) days += 1;
    }
    return form.duration === 'half_day' && form.starts_at === form.ends_at && days === 1 ? 0.5 : days;
  }, [form.duration, form.starts_at, form.ends_at, holidays]);

  const handleDateRangeChange = (dates: [Date | null, Date | null]) => {
    const [start, end] = dates;
    setStartDate(start);
    setEndDate(end);

    const startStr = start ? start.toLocaleDateString('sv').slice(0, 10) : '';
    const endStr = end ? end.toLocaleDateString('sv').slice(0, 10) : '';

    setForm((prev) => ({
      ...prev,
      starts_at: startStr,
      ends_at: startStr && endStr ? endStr : startStr,
    }));
  };

  const handleSingleDateChange = (date: Date | null) => {
    setStartDate(date);
    setEndDate(date);

    const dateStr = date ? date.toLocaleDateString('sv').slice(0, 10) : '';

    setForm((prev) => ({
      ...prev,
      starts_at: dateStr,
      ends_at: dateStr,
    }));
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('source') !== 'ai') return;

    const leaveTypeHint = params.get('leave_type')?.toLowerCase() ?? '';
    const matchedType = leaveTypes.find((type) => {
      const name = type.name.toLowerCase();
      const code = type.code.toLowerCase();
      return leaveTypeHint && (name.includes(leaveTypeHint) || leaveTypeHint.includes(name) || code === leaveTypeHint);
    });
    const startsAt = params.get('starts_at') ?? '';
    const endsAt = params.get('ends_at') ?? startsAt;
    const duration = params.get('duration') === 'half_day' ? 'half_day' : 'full_day';

    setForm((prev) => ({
      ...prev,
      leave_type_id: matchedType?.id ?? prev.leave_type_id,
      starts_at: startsAt,
      ends_at: duration === 'half_day' ? startsAt : endsAt,
      duration,
      reason: params.get('reason') ?? prev.reason,
    }));
    setStartDate(parseDateParam(startsAt));
    setEndDate(parseDateParam(duration === 'half_day' ? startsAt : endsAt));
    setAiDraftImported(true);
  }, [leaveTypes]);

  const handleDurationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextDuration = e.target.value;
    setForm((prev) => {
      const isHalf = nextDuration === 'half_day';
      return {
        ...prev,
        duration: nextDuration,
        ends_at: isHalf ? prev.starts_at : prev.ends_at
      };
    });
    if (nextDuration === 'half_day') {
      setEndDate(startDate);
    }
  };

  function removeAttachment(index: number) {
    setForm((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index),
    }));
  }

  function submitLeave(e: React.FormEvent) {
    e.preventDefault();
    const data = new FormData();
    data.append('leave_type_id', String(form.leave_type_id));
    data.append('starts_at', form.starts_at);
    data.append('ends_at', form.ends_at);
    data.append('duration', form.duration);
    data.append('reason', form.reason);
    form.attachments.forEach((file) => data.append('attachments[]', file));
    
    router.post('/leave-requests', data, {
      forceFormData: true,
      preserveScroll: true,
      onSuccess: () => {
        // Reset form on success
        setForm((prev) => ({ ...prev, starts_at: '', ends_at: '', reason: '', attachments: [] }));
        setStartDate(null);
        setEndDate(null);
      }
    });
  }

  return (
    <AppLayout>
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        {/* Main section */}
        <section className="space-y-6 animate-fade-in">
          {aiDraftImported && (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4.5 shadow-premium-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-100 bg-white text-emerald-700 shadow-premium-sm">
                    <Bot size={16} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-emerald-950">AI draft imported</div>
                    <div className="text-xs font-medium text-emerald-800/80">Review the leave type, dates, and handover notes before submitting.</div>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-700">
                  <Sparkles size={11} /> Autofill
                </span>
              </div>
            </div>
          )}

          {/* Apply Leave form */}
          <form onSubmit={submitLeave} className="rounded-2xl border border-neutral-200/50 bg-white p-6 shadow-premium-sm hover:shadow-premium-md transition-all duration-300">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-100/60 pb-5 mb-5">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-neutral-200 text-neutral-600 bg-neutral-50 shadow-premium-sm">
                  <CalendarPlus size={15} />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-neutral-850">Request Time Off</h2>
                  <p className="text-xs font-medium text-neutral-455 mt-1">Submit a leave request for approvals</p>
                </div>
              </div>
              <span className="inline-flex items-center rounded-full border border-emerald-100 bg-emerald-50 px-3.5 py-1 text-xs font-semibold text-emerald-700 shadow-sm">
                {formatDays(projectedDays)} working day(s) calculated
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-neutral-450">
                Leave Type
                <select
                  className="mt-1.5 w-full rounded-xl border border-neutral-200/70 px-3 py-2.5 text-sm bg-white font-medium text-neutral-700 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/5 transition-all outline-none"
                  value={form.leave_type_id}
                  onChange={(e) => setForm({ ...form, leave_type_id: Number(e.target.value) })}
                >
                  {leaveTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-[10px] font-semibold uppercase tracking-widest text-neutral-450">
                Duration
                <select
                  className="mt-1.5 w-full rounded-xl border border-neutral-200/70 px-3 py-2.5 text-sm bg-white font-medium text-neutral-700 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/5 transition-all outline-none"
                  value={form.duration}
                  onChange={handleDurationChange}
                >
                  <option value="full_day">Full day</option>
                  <option value="half_day">Half day</option>
                </select>
              </label>

              <div className="sm:col-span-2 block text-[10px] font-semibold uppercase tracking-widest text-neutral-450">
                Date Selection
                <div className="mt-1.5 relative">
                  {form.duration === 'half_day' ? (
                    <DatePicker
                      selected={startDate}
                      onChange={handleSingleDateChange}
                      className="w-full rounded-xl border border-neutral-200/70 px-3 py-2.5 text-sm bg-white font-medium text-neutral-700 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/5 transition-all outline-none"
                      placeholderText="Select date"
                      dateFormat="yyyy-MM-dd"
                    />
                  ) : (
                    <DatePicker
                      selectsRange
                      startDate={startDate}
                      endDate={endDate}
                      onChange={handleDateRangeChange}
                      className="w-full rounded-xl border border-neutral-200/70 px-3 py-2.5 text-sm bg-white font-medium text-neutral-700 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/5 transition-all outline-none"
                      placeholderText="Select start and end date"
                      dateFormat="yyyy-MM-dd"
                    />
                  )}
                </div>
              </div>
            </div>

            {selectedType?.requires_attachment && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-amber-100 bg-amber-50/40 px-4 py-3 text-xs text-amber-900 font-medium animate-fade-in">
                <AlertCircle size={14} className="shrink-0 text-amber-600" />
                <span>An official attachment is required for this leave type (e.g. medical certificate).</span>
              </div>
            )}

            <div className="mt-4">
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-neutral-455">
                Reason & Handover Notes
                <textarea
                  className="mt-1.5 min-h-[90px] w-full rounded-xl border border-neutral-200/70 p-3 text-sm font-normal text-neutral-700 placeholder:text-neutral-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/5 transition-all outline-none resize-y"
                  placeholder="Details for coverage, client handover, or reason for time off request..."
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                />
              </label>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-neutral-100/60">
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-neutral-200 px-3.5 py-2 text-sm font-semibold text-neutral-650 transition-all hover:bg-neutral-50 hover:text-neutral-800 bg-white shadow-premium-sm active:scale-98">
                  <Paperclip size={12} /> Attach Files
                  <input
                    className="hidden"
                    type="file"
                    multiple
                    onChange={(e) => setForm({ ...form, attachments: [...form.attachments, ...Array.from(e.target.files ?? [])] })}
                  />
                </label>

                {form.attachments.map((file, index) => (
                  <span key={index} className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-semibold text-neutral-600 animate-fade-in">
                    <span className="truncate max-w-28">{file.name}</span>
                    <button type="button" onClick={() => removeAttachment(index)} className="text-neutral-400 hover:text-neutral-600 transition-colors">
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>

              <button
                className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4.5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 hover:-translate-y-0.5 active:translate-y-0 active:scale-98 shadow-md shadow-emerald-600/10 transition-all duration-200"
                type="submit"
              >
                <Send size={12} /> Submit Request
              </button>
            </div>

            {Object.values(errors).length > 0 && (
              <p className="mt-3 text-xs font-semibold text-rose-600">{Object.values(errors)[0]}</p>
            )}
          </form>

          {/* Request History */}
          <div className="rounded-2xl border border-neutral-200/50 bg-white shadow-premium-sm overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-100/60 px-6 py-5 bg-neutral-50/20">
              <div>
                <h2 className="text-base font-semibold text-neutral-850">Request History</h2>
                <p className="text-xs font-medium text-neutral-450 mt-1">View all previous leave applications</p>
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
            <RequestTable requests={filteredRequests} />
          </div>
        </section>

        {/* Sidebar section */}
        <aside className="space-y-6">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-1">
            <Metric icon={<Clock3 size={15} />} label="Pending" value={requestStats.pending} variant="amber" />
            <Metric icon={<CheckCircle2 size={15} />} label="Approved" value={requestStats.approved} variant="emerald" />
            <Metric icon={<AlertCircle size={15} />} label="Rejected" value={requestStats.rejected} variant="rose" />
            <Metric icon={<CalendarClock size={15} />} label="Scheduled days" value={formatDays(requestStats.scheduled_days)} variant="indigo" />
          </div>

          <div className="rounded-2xl border border-neutral-200/50 bg-white p-5 shadow-premium-sm">
            <div className="mb-4 text-[10px] font-semibold uppercase tracking-widest text-neutral-450">
              My Balances
            </div>
            <div className="space-y-4">
              {balances.map((balance) => {
                const avail = Number(balance.available_days);
                const allowance = Math.max(1, Number(balance.allowance_days));
                const used = Number(balance.used_days);
                const percent = Math.min(100, (avail / allowance) * 100);
                const color = getLeaveColor(balance.leave_type.code);

                return (
                  <div key={balance.id} className="space-y-2 border-b border-neutral-100 pb-3 last:border-0 last:pb-0">
                    {/* Top Row */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${color.dot}`} />
                        <span className="font-semibold text-neutral-800 text-xs truncate max-w-[130px]" title={balance.leave_type.name}>
                          {balance.leave_type.name}
                        </span>
                      </div>
                      <span className="text-xs font-extrabold text-neutral-800 shrink-0">
                        {formatDays(balance.available_days)} / {formatDays(balance.allowance_days)}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-1.5 w-full rounded-full bg-neutral-100 overflow-hidden">
                      <div
                        className={`h-full ${color.bar} rounded-full transition-all duration-500 ease-out`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>

                    {/* Footer Row */}
                    <div className="flex justify-between text-[10px] text-neutral-455 text-neutral-450 font-medium px-0.5">
                      <span>Used: {formatDays(balance.used_days)}</span>
                      <span>Pending: {formatDays(balance.pending_days)}</span>
                    </div>
                  </div>
                );
              })}
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
            No leave requests found.
          </div>
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50/50 text-[10px] font-semibold uppercase tracking-widest text-neutral-450 border-b border-neutral-100/60">
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
                  No leave requests found.
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

function parseDateParam(value: string) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.valueOf()) ? null : date;
}
