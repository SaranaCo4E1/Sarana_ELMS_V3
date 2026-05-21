import { Link, router, usePage } from '@inertiajs/react';
import { AlertCircle, CalendarClock, CalendarPlus, CheckCircle2, Clock3, FileText, Users } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import AppLayout from '../Layouts/AppLayout';
import type { LeaveBalance, LeaveRequest, PageProps, SystemNotification, User } from '../types';

type Props = {
  balances: LeaveBalance[];
  requests: LeaveRequest[];
  requestStats: { pending: number; approved: number; rejected: number; cancelled: number; scheduled_days: number };
  pendingApprovals: LeaveRequest[];
  teamMembers: User[];
  systemAlerts: SystemNotification[];
};

const statusStyles: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-700',
  cancelled: 'bg-slate-100 text-slate-600',
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
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <section className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <Metric icon={<Clock3 size={18} />} label="Pending" value={requestStats.pending} />
            <Metric icon={<CheckCircle2 size={18} />} label="Approved" value={requestStats.approved} />
            <Metric icon={<AlertCircle size={18} />} label="Rejected" value={requestStats.rejected} />
            <Metric icon={<CalendarClock size={18} />} label="Scheduled days" value={requestStats.scheduled_days} />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {balances.map((balance) => (
              <div key={balance.id} className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-slate-950">{balance.leave_type.name}</div>
                    <div className="text-xs text-slate-500">{balance.leave_type.code}</div>
                  </div>
                  <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs text-emerald-700">{balance.available_days} left</span>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full bg-emerald-600" style={{ width: `${Math.min(100, (Number(balance.used_days) / Math.max(1, Number(balance.allowance_days))) * 100)}%` }} />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-500">
                  <span>Quota {balance.allowance_days}</span>
                  <span>Used {balance.used_days}</span>
                  <span>Pending {balance.pending_days}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-md border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div className="font-semibold">Recent Leave Requests</div>
              <div className="flex flex-wrap gap-2">
                <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Search requests" value={query} onChange={(e) => setQuery(e.target.value)} />
                <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  {['all', 'pending', 'approved', 'rejected', 'cancelled'].map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </div>
            </div>
            <RequestTable requests={filteredRequests.slice(0, 8)} />
          </div>
        </section>

        <aside className="space-y-4">
          <Link className="flex items-center gap-2 rounded-md bg-emerald-700 p-4 text-sm font-medium text-white shadow-sm hover:bg-emerald-800" href="/apply-leave">
            <CalendarPlus size={17} /> Apply for leave
          </Link>
          {pendingApprovals.length > 0 && <Link href="/approvals" className="block rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{pendingApprovals.length} request(s) need review.</Link>}
          {['manager', 'hr', 'admin'].includes(auth.user.role) && (
            <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2 font-semibold"><Users size={18} /> Team Snapshot</div>
              <div className="space-y-2">
                {teamMembers.slice(0, 8).map((member) => <div key={member.id} className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-2 text-sm"><span>{member.name}</span><span className="text-xs text-slate-500">{member.pending_leave_requests_count ?? 0} pending</span></div>)}
                {teamMembers.length === 0 && <p className="text-sm text-slate-500">No team members assigned.</p>}
              </div>
            </div>
          )}
          <SideList title="System Alerts" empty="No alerts." items={systemAlerts.map((item) => `${item.title} · ${item.body}`)} />
          {['hr', 'admin'].includes(auth.user.role) && <a className="flex items-center gap-2 rounded-md border border-slate-200 bg-white p-4 text-sm shadow-sm" href={`/reports/monthly?month=${new Date().toISOString().slice(0, 7)}`}><FileText size={17} /> Download current month CSV</a>}
        </aside>
      </div>
    </AppLayout>
  );
}

function RequestTable({ requests }: { requests: LeaveRequest[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Type</th><th>Dates</th><th>Days</th><th>Status</th><th>Approver</th><th>Comment</th><th></th></tr></thead>
        <tbody>
          {requests.map((request) => (
            <tr key={request.id} className="border-t border-slate-100">
              <td className="px-5 py-3 font-medium">{request.leave_type.name}</td>
              <td>{formatDate(request.starts_at)} to {formatDate(request.ends_at)}</td>
              <td>{request.requested_days}</td>
              <td><Status status={request.status} /></td>
              <td>{request.approver?.name ?? '-'}</td>
              <td className="max-w-64 truncate">{request.manager_comment ?? '-'}</td>
              <td>{request.status === 'pending' && <button className="text-red-600" onClick={() => router.delete(`/leave-requests/${request.id}`, { preserveScroll: true })}>Cancel</button>}</td>
            </tr>
          ))}
          {requests.length === 0 && <tr><td colSpan={7} className="px-5 py-6 text-slate-500">No matching requests.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between text-sm text-slate-500">{label}{icon}</div><div className="mt-2 text-2xl font-semibold text-slate-950">{value}</div></div>;
}

function Status({ status }: { status: string }) {
  return <span className={`rounded-md px-2 py-1 text-xs ${statusStyles[status] ?? 'bg-slate-100 text-slate-600'}`}>{status}</span>;
}

function SideList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-3 font-semibold">{title}</div><div className="space-y-3">{items.map((item) => <div key={item} className="border-t border-slate-100 pt-3 text-sm text-slate-600 first:border-t-0 first:pt-0">{item}</div>)}{items.length === 0 && <p className="text-sm text-slate-500">{empty}</p>}</div></div>;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
