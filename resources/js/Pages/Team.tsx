import { Link } from '@inertiajs/react';
import { CalendarClock, ClipboardCheck, UserCheck, Users } from 'lucide-react';
import type React from 'react';
import AppLayout from '../Layouts/AppLayout';
import type { LeaveRequest, User } from '../types';
import { formatDays, formatShortDate } from '../utils';

type Props = {
  members: User[];
  leaveCalendar: LeaveRequest[];
  pendingRequests: LeaveRequest[];
  teamStats: { members: number; pending: number; on_leave_today: number; approved_this_year: number };
};

export default function Team({ members, leaveCalendar, pendingRequests, teamStats }: Props) {
  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Statistics section */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Metric icon={<Users size={15} />} label="Team Members" value={teamStats.members} variant="indigo" />
          <Metric icon={<ClipboardCheck size={15} />} label="Pending Decisions" value={teamStats.pending} variant="amber" />
          <Metric icon={<UserCheck size={15} />} label="On Leave Today" value={teamStats.on_leave_today} variant="emerald" />
          <Metric icon={<CalendarClock size={15} />} label="Approved This Year" value={teamStats.approved_this_year} variant="teal" />
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_310px]">
          {/* Team Roster Grid */}
          <section className="rounded-2xl border border-neutral-200/50 bg-white shadow-premium-sm overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200/60 px-6 py-5 bg-neutral-50/20">
              <div>
                <h2 className="text-sm font-bold text-neutral-900">Team Roster</h2>
                <p className="text-xs font-semibold text-neutral-400">List of colleagues and staff in your active department scope</p>
              </div>
              <Link
                className="inline-flex items-center gap-1.5 rounded-xl bg-neutral-950 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-neutral-950/10 hover:bg-neutral-800 transition-all duration-200 active:scale-98"
                href="/approvals"
              >
                Review approvals
              </Link>
            </div>
            
            {/* Mobile Card List View */}
            <div className="divide-y divide-neutral-100 sm:hidden">
              {members.map((member) => (
                <div key={member.id} className="p-4 space-y-3 bg-white">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8.5 w-8.5 items-center justify-center rounded-full bg-gradient-to-br from-neutral-50 to-neutral-100 font-bold text-neutral-700 text-xs shrink-0 border border-neutral-200 shadow-premium-sm">
                      {member.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                    </div>
                    <div>
                      <div className="font-bold text-neutral-900 text-xs">{member.name}</div>
                      <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider mt-0.5">{member.employee_code ?? 'NO CODE'}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-neutral-600 font-medium">
                    <div>
                      <div className="text-xs font-bold text-neutral-500 uppercase">Role</div>
                      <div className="font-bold text-neutral-700 mt-0.5">{member.job_title ?? member.role}</div>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-neutral-500 uppercase">Department</div>
                      <div className="mt-0.5">
                        {member.department?.name ? (
                          <span className="inline-flex items-center rounded-full bg-neutral-50 border border-neutral-200/60 px-2 py-0.5 text-xs font-bold text-neutral-600">
                            {member.department.name}
                          </span>
                        ) : (
                          '—'
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-neutral-500 uppercase">Manager</div>
                      <div className="font-semibold text-neutral-700 mt-0.5">{member.manager?.name ?? '—'}</div>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-neutral-500 uppercase">Contact</div>
                      <div className="font-semibold text-neutral-700 mt-0.5 truncate" title={member.email}>{member.email}</div>
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-neutral-100 flex items-center justify-between text-xs font-bold text-neutral-500">
                    <span>Leave Summary:</span>
                    <div className="font-bold">
                      <span className="text-amber-700">{member.pending_leave_requests_count ?? 0} pending</span>
                      <span className="mx-1.5 text-neutral-300">·</span>
                      <span className="text-emerald-700">{member.approved_leave_requests_count ?? 0} approved</span>
                    </div>
                  </div>
                </div>
              ))}
              {members.length === 0 && (
                <div className="p-8 text-center text-xs text-neutral-400 font-medium">
                  No team members in your current organizational scope.
                </div>
              )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-neutral-50/50 text-xs font-bold uppercase tracking-wider text-neutral-400 border-b border-neutral-100/60">
                  <tr>
                    <th className="px-6 py-4">Employee</th>
                    <th className="px-4 py-4">Role</th>
                    <th className="px-4 py-4">Department</th>
                    <th className="px-4 py-4">Manager</th>
                    <th className="px-4 py-4">Leave Summary</th>
                    <th className="px-6 py-4">Contact Info</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100/60">
                  {members.map((member) => (
                    <tr key={member.id} className="transition-all hover:bg-neutral-50/40">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8.5 w-8.5 items-center justify-center rounded-full bg-gradient-to-br from-neutral-50 to-neutral-100 font-bold text-neutral-700 text-xs shrink-0 border border-neutral-200 shadow-premium-sm">
                            {member.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-neutral-900">{member.name}</div>
                            <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider mt-0.5">{member.employee_code ?? 'NO CODE'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-neutral-600 font-bold">
                        {member.job_title ?? member.role}
                      </td>
                      <td className="px-4 py-4">
                        {member.department?.name ? (
                          <span className="inline-flex items-center rounded-full bg-neutral-50 border border-neutral-200 px-2.5 py-0.5 text-xs font-bold text-neutral-600">
                            {member.department.name}
                          </span>
                        ) : (
                          <span className="text-neutral-400 font-semibold">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-neutral-500 font-bold">
                        {member.manager?.name ?? '—'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-neutral-600 font-bold">
                        <span className="text-amber-700">{member.pending_leave_requests_count ?? 0} pending</span>
                        <span className="mx-1.5 text-neutral-300">·</span>
                        <span className="text-emerald-700">{member.approved_leave_requests_count ?? 0} approved</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-neutral-700 font-bold">{member.email}</div>
                        {member.phone && <div className="text-xs text-neutral-400 font-semibold mt-0.5">{member.phone}</div>}
                      </td>
                    </tr>
                  ))}
                  {members.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-neutral-400 font-medium">
                        No team members in your current organizational scope.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Right sidebar panels */}
          <aside className="space-y-6">
            <Panel icon={<ClipboardCheck size={15} />} title="Pending Decisions">
              <div className="space-y-3.5">
                {pendingRequests.map((request) => (
                  <RequestLine key={request.id} request={request} />
                ))}
                {pendingRequests.length === 0 && (
                  <p className="py-4 text-center text-xs text-neutral-400 font-medium">No pending requests to resolve.</p>
                )}
              </div>
            </Panel>

            <Panel icon={<CalendarClock size={15} />} title="Upcoming Leave">
              <div className="space-y-3.5">
                {leaveCalendar.map((request) => (
                  <RequestLine key={request.id} request={request} />
                ))}
                {leaveCalendar.length === 0 && (
                  <p className="py-4 text-center text-xs text-neutral-400 font-medium">No upcoming leave schedules.</p>
                )}
              </div>
            </Panel>
          </aside>
        </div>
      </div>
    </AppLayout>
  );
}

function Metric({ label, value, icon, variant }: { label: string; value: string | number; icon: React.ReactNode; variant: 'amber' | 'emerald' | 'indigo' | 'teal' }) {
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
    indigo: {
      border: 'border-indigo-100/60',
      bg: 'bg-gradient-to-br from-indigo-500/5 to-indigo-600/5',
      iconBg: 'bg-indigo-50 text-indigo-600 border-indigo-100/70',
    },
    teal: {
      border: 'border-teal-100/60',
      bg: 'bg-gradient-to-br from-teal-500/5 to-teal-600/5',
      iconBg: 'bg-teal-50 text-teal-600 border-teal-100/70',
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

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-neutral-200/50 bg-white p-5 shadow-premium-sm">
      <h2 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-400">
        <div className="text-neutral-400">{icon}</div>
        <span>{title}</span>
      </h2>
      {children}
    </section>
  );
}

function RequestLine({ request }: { request: LeaveRequest }) {
  return (
    <div className="rounded-xl bg-neutral-50/50 border border-neutral-100 p-3.5 text-xs shadow-premium-sm">
      <div className="font-bold text-neutral-800">
        {request.user?.name} · <span className="text-emerald-700">{request.leave_type.name}</span>
      </div>
      <div className="text-xs text-neutral-500 mt-2 flex flex-wrap items-center gap-1 font-semibold">
        <span className="font-bold">{formatShortDate(request.starts_at)} – {formatShortDate(request.ends_at)}</span>
        <span>·</span>
        <span className="font-bold text-neutral-700">{formatDays(request.requested_days)} day(s)</span>
        <span>·</span>
        <span className="rounded-full bg-neutral-100 border border-neutral-200 px-1.5 py-0.2 font-bold text-neutral-600 uppercase text-xs">{request.status}</span>
      </div>
    </div>
  );
}
