import { router, usePage } from '@inertiajs/react';
import { AlertCircle, CalendarClock, CalendarPlus, CheckCircle2, Clock3, Paperclip, Send } from 'lucide-react';
import type React from 'react';
import { useMemo, useState } from 'react';
import AppLayout from '../Layouts/AppLayout';
import type { LeaveBalance, LeaveRequest, LeaveType, PageProps } from '../types';

type Holiday = { id: number; name: string; holiday_date: string };
type Props = {
  leaveTypes: LeaveType[];
  balances: LeaveBalance[];
  requests: LeaveRequest[];
  requestStats: { pending: number; approved: number; rejected: number; cancelled: number; scheduled_days: number };
  holidays: Holiday[];
};

const statusStyles: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-700',
  cancelled: 'bg-slate-100 text-slate-600',
};

export default function ApplyLeave({ leaveTypes, balances, requests, requestStats, holidays }: Props) {
  const { errors } = usePage<PageProps>().props;
  const [form, setForm] = useState({ leave_type_id: leaveTypes[0]?.id ?? '', starts_at: '', ends_at: '', duration: 'full_day', reason: '', attachments: [] as File[] });
  const [statusFilter, setStatusFilter] = useState('all');
  const [query, setQuery] = useState('');

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

  function submitLeave(e: React.FormEvent) {
    e.preventDefault();
    const data = new FormData();
    data.append('leave_type_id', String(form.leave_type_id));
    data.append('starts_at', form.starts_at);
    data.append('ends_at', form.ends_at);
    data.append('duration', form.duration);
    data.append('reason', form.reason);
    form.attachments.forEach((file) => data.append('attachments[]', file));
    router.post('/leave-requests', data, { forceFormData: true, preserveScroll: true });
  }

  return (
    <AppLayout>
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <section className="space-y-6">
          <form onSubmit={submitLeave} className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CalendarPlus size={20} className="text-emerald-700" />
                <h2 className="font-semibold text-slate-950">Apply Leave</h2>
              </div>
              <span className="rounded-md bg-slate-100 px-3 py-1 text-xs text-slate-600">{projectedDays} working day(s)</span>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-4">
              <label className="text-sm">Leave type
                <select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" value={form.leave_type_id} onChange={(e) => setForm({ ...form, leave_type_id: Number(e.target.value) })}>
                  {leaveTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
                </select>
              </label>
              <label className="text-sm">Duration
                <select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value, ends_at: e.target.value === 'half_day' ? form.starts_at : form.ends_at })}>
                  <option value="full_day">Full day</option>
                  <option value="half_day">Half day</option>
                </select>
              </label>
              <label className="text-sm">Start date
                <input type="date" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value, ends_at: form.duration === 'half_day' ? e.target.value : form.ends_at })} />
              </label>
              <label className="text-sm">End date
                <input type="date" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 disabled:bg-slate-100 disabled:text-slate-500" value={form.ends_at} disabled={form.duration === 'half_day'} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
              </label>
            </div>
            {selectedType?.requires_attachment && <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">This leave type requires an attachment.</p>}
            <textarea className="mt-4 min-h-28 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Reason and handover notes" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm">
                  <Paperclip size={16} /> Attach files
                  <input className="hidden" type="file" multiple onChange={(e) => setForm({ ...form, attachments: Array.from(e.target.files ?? []) })} />
                </label>
                {form.attachments.map((file) => <span key={file.name} className="rounded-md bg-slate-100 px-2 py-1 text-xs">{file.name}</span>)}
              </div>
              <button className="flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"><Send size={16} /> Submit</button>
            </div>
            {Object.values(errors).length > 0 && <p className="mt-3 text-sm text-red-600">{Object.values(errors)[0]}</p>}
          </form>

          <div className="rounded-md border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div className="font-semibold">Request History</div>
              <div className="flex flex-wrap gap-2">
                <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Search requests" value={query} onChange={(e) => setQuery(e.target.value)} />
                <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  {['all', 'pending', 'approved', 'rejected', 'cancelled'].map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </div>
            </div>
            <RequestTable requests={filteredRequests} />
          </div>
        </section>

        <aside className="space-y-4">
          <Metric icon={<Clock3 size={18} />} label="Pending" value={requestStats.pending} />
          <Metric icon={<CheckCircle2 size={18} />} label="Approved" value={requestStats.approved} />
          <Metric icon={<AlertCircle size={18} />} label="Rejected" value={requestStats.rejected} />
          <Metric icon={<CalendarClock size={18} />} label="Scheduled days" value={requestStats.scheduled_days} />
          <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 font-semibold">Balances</div>
            <div className="space-y-3">
              {balances.map((balance) => <div key={balance.id} className="flex items-center justify-between gap-3 text-sm"><span>{balance.leave_type.name}</span><span className="rounded-md bg-emerald-50 px-2 py-1 text-xs text-emerald-700">{balance.available_days} left</span></div>)}
            </div>
          </div>
        </aside>
      </div>
    </AppLayout>
  );
}

function RequestTable({ requests }: { requests: LeaveRequest[] }) {
  return <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Type</th><th>Dates</th><th>Days</th><th>Status</th><th>Approver</th><th>Comment</th><th></th></tr></thead><tbody>{requests.map((request) => <tr key={request.id} className="border-t border-slate-100"><td className="px-5 py-3 font-medium">{request.leave_type.name}</td><td>{formatDate(request.starts_at)} to {formatDate(request.ends_at)}</td><td>{request.requested_days}</td><td><Status status={request.status} /></td><td>{request.approver?.name ?? '-'}</td><td className="max-w-64 truncate">{request.manager_comment ?? '-'}</td><td>{request.status === 'pending' && <button className="text-red-600" onClick={() => router.delete(`/leave-requests/${request.id}`, { preserveScroll: true })}>Cancel</button>}</td></tr>)}{requests.length === 0 && <tr><td colSpan={7} className="px-5 py-6 text-slate-500">No matching requests.</td></tr>}</tbody></table></div>;
}

function Metric({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between text-sm text-slate-500">{label}{icon}</div><div className="mt-2 text-2xl font-semibold text-slate-950">{value}</div></div>;
}

function Status({ status }: { status: string }) {
  return <span className={`rounded-md px-2 py-1 text-xs ${statusStyles[status] ?? 'bg-slate-100 text-slate-600'}`}>{status}</span>;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
