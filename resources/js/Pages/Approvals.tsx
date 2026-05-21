import { router } from '@inertiajs/react';
import { Check, Clock3, FileText, Search, ShieldCheck, Users, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import AppLayout from '../Layouts/AppLayout';
import type { LeaveRequest } from '../types';

type Props = {
  requests: LeaveRequest[];
  recentDecisions: LeaveRequest[];
  approvalStats: { pending: number; approved_this_month: number; rejected_this_month: number; team_members_on_leave: number };
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
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          <Metric icon={<Clock3 size={18} />} label="Waiting" value={approvalStats.pending} />
          <Metric icon={<ShieldCheck size={18} />} label="Approved this month" value={approvalStats.approved_this_month} />
          <Metric icon={<X size={18} />} label="Rejected this month" value={approvalStats.rejected_this_month} />
          <Metric icon={<Users size={18} />} label="On leave today" value={approvalStats.team_members_on_leave} />
        </div>

        <div className="rounded-md border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div>
              <div className="font-semibold">Pending Team Requests</div>
              <div className="text-sm text-slate-500">Review reason, attachment names, balance impact, and handover notes before deciding.</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                <input className="rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm" placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
              <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={department} onChange={(e) => setDepartment(e.target.value)}>
                <option value="all">All departments</option>
                {departments.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {filtered.map((request) => (
              <div key={request.id} className="grid gap-4 p-5 lg:grid-cols-[1fr_320px]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-medium text-slate-950">{request.user?.name}</div>
                    <span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">{request.user?.department?.name ?? 'No department'}</span>
                    <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs text-emerald-700">{request.leave_type.name}</span>
                  </div>
                  <div className="mt-2 text-sm text-slate-500">{formatDate(request.starts_at)} to {formatDate(request.ends_at)} · {request.requested_days} working day(s)</div>
                  <p className="mt-3 whitespace-pre-wrap text-sm">{request.reason}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                    {(request.attachments ?? []).map((attachment) => <span key={attachment.id} className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1"><FileText size={13} /> {attachment.original_name}</span>)}
                    {(request.attachments ?? []).length === 0 && <span>No attachments</span>}
                  </div>
                </div>
                <div>
                  <textarea className="h-28 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Decision comment" value={comments[request.id] ?? ''} onChange={(e) => setComments({ ...comments, [request.id]: e.target.value })} />
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button className="flex items-center justify-center gap-2 rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-800" onClick={() => decide(request.id, 'approved')}><Check size={16} /> Approve</button>
                    <button className="flex items-center justify-center gap-2 rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700" onClick={() => decide(request.id, 'rejected')}><X size={16} /> Reject</button>
                  </div>
                </div>
              </div>
            ))}
            {filtered.length === 0 && <div className="p-5 text-sm text-slate-500">No matching pending requests.</div>}
          </div>
        </div>

        <div className="rounded-md border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4 font-semibold">Recent Decisions</div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Employee</th><th>Leave</th><th>Dates</th><th>Status</th><th>Comment</th></tr></thead>
              <tbody>
                {recentDecisions.map((request) => (
                  <tr key={request.id} className="border-t border-slate-100">
                    <td className="px-5 py-3">{request.user?.name}</td>
                    <td>{request.leave_type.name}</td>
                    <td>{formatDate(request.starts_at)} to {formatDate(request.ends_at)}</td>
                    <td><span className={`rounded-md px-2 py-1 text-xs ${request.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'}`}>{request.status}</span></td>
                    <td className="max-w-96 truncate">{request.manager_comment ?? '-'}</td>
                  </tr>
                ))}
                {recentDecisions.length === 0 && <tr><td colSpan={5} className="px-5 py-6 text-slate-500">No recent decisions.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function Metric({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between text-sm text-slate-500">{label}{icon}</div><div className="mt-2 text-2xl font-semibold text-slate-950">{value}</div></div>;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
