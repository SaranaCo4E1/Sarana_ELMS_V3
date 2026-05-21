import { Link } from '@inertiajs/react';
import { CalendarClock, ClipboardCheck, UserCheck, Users } from 'lucide-react';
import type React from 'react';
import AppLayout from '../Layouts/AppLayout';
import type { LeaveRequest, User } from '../types';

type Props = {
  members: User[];
  leaveCalendar: LeaveRequest[];
  pendingRequests: LeaveRequest[];
  teamStats: { members: number; pending: number; on_leave_today: number; approved_this_year: number };
};

export default function Team({ members, leaveCalendar, pendingRequests, teamStats }: Props) {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          <Metric icon={<Users size={18} />} label="Members" value={teamStats.members} />
          <Metric icon={<ClipboardCheck size={18} />} label="Pending" value={teamStats.pending} />
          <Metric icon={<UserCheck size={18} />} label="On leave today" value={teamStats.on_leave_today} />
          <Metric icon={<CalendarClock size={18} />} label="Approved year" value={teamStats.approved_this_year} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_390px]">
          <section className="rounded-md border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <h2 className="font-semibold text-slate-950">Team Roster</h2>
              <Link className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white" href="/approvals">Review approvals</Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Employee</th><th>Role</th><th>Department</th><th>Manager</th><th>Leave load</th><th>Contact</th></tr></thead>
                <tbody>
                  {members.map((member) => <tr key={member.id} className="border-t border-slate-100"><td className="px-5 py-3"><div className="font-medium text-slate-950">{member.name}</div><div className="text-xs text-slate-500">{member.employee_code ?? 'No employee code'}</div></td><td>{member.job_title ?? member.role}</td><td>{member.department?.name ?? '-'}</td><td>{member.manager?.name ?? '-'}</td><td>{member.pending_leave_requests_count ?? 0} pending · {member.approved_leave_requests_count ?? 0} approved</td><td>{member.email}{member.phone ? <div className="text-xs text-slate-500">{member.phone}</div> : null}</td></tr>)}
                  {members.length === 0 && <tr><td colSpan={6} className="px-5 py-6 text-slate-500">No team members in your current scope.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="space-y-6">
            <Panel icon={<ClipboardCheck size={18} />} title="Pending Decisions">
              <div className="space-y-2">{pendingRequests.map((request) => <RequestLine key={request.id} request={request} />)}{pendingRequests.length === 0 && <p className="text-sm text-slate-500">No pending requests.</p>}</div>
            </Panel>
            <Panel icon={<CalendarClock size={18} />} title="Upcoming Leave">
              <div className="space-y-2">{leaveCalendar.map((request) => <RequestLine key={request.id} request={request} />)}{leaveCalendar.length === 0 && <p className="text-sm text-slate-500">No upcoming team leave.</p>}</div>
            </Panel>
          </aside>
        </div>
      </div>
    </AppLayout>
  );
}

function Metric({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between text-sm text-slate-500">{label}{icon}</div><div className="mt-2 text-2xl font-semibold text-slate-950">{value}</div></div>;
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-4 flex items-center gap-2 font-semibold">{icon}{title}</h2>{children}</section>;
}

function RequestLine({ request }: { request: LeaveRequest }) {
  return <div className="rounded-md bg-slate-50 px-3 py-2 text-sm"><div className="font-medium text-slate-950">{request.user?.name} · {request.leave_type.name}</div><div className="text-xs text-slate-500">{formatDate(request.starts_at)} to {formatDate(request.ends_at)} · {request.requested_days} day(s) · {request.status}</div></div>;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
