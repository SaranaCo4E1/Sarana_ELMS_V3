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
          <Metric icon={<UserCheck size={15} />} label="On Leave Today" value={teamStats.on_leave_today} variant="orange" />
          <Metric icon={<CalendarClock size={15} />} label="Approved This Year" value={teamStats.approved_this_year} variant="amber" />
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_310px]">
          {/* Team Roster Grid */}
          <section className="rounded-xl border border-neutral-200/50 bg-white shadow-premium-sm overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200/60 px-6 py-5 bg-neutral-50/20">
              <div>
                <h2 className="text-base font-medium text-neutral-800">Team Roster</h2>
                <p className="text-sm font-medium text-neutral-500 mt-1.5">List of colleagues and staff in your active department scope</p>
              </div>
              <Link
                className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-5 py-3 text-sm font-medium text-white shadow-md shadow-orange-600/10 hover:bg-orange-700 transition-all duration-200 active:scale-98"
                href="/approvals"
              >
                Review approvals
              </Link>
            </div>
            
            {/* Mobile Card List View */}
            <div className="divide-y divide-neutral-100 sm:hidden">
              {members.map((member) => (
                <div key={member.id} className="p-5 space-y-4 bg-white">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-neutral-50 to-neutral-100 font-medium text-neutral-600 text-sm shrink-0 border border-neutral-200 shadow-premium-sm">
                      {member.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-neutral-800 text-sm">{member.name}</div>
                      <div className="text-xs font-medium uppercase tracking-wider text-neutral-400 mt-1">{member.employee_code ?? 'NO CODE'}</div>
                    </div>
                  </div>
 
                  <div className="grid grid-cols-2 gap-3.5 text-sm text-neutral-600 font-medium">
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wider text-neutral-400">Role</div>
                      <div className="font-medium text-neutral-600 mt-0.5">{member.job_title ?? member.role}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wider text-neutral-400">Department</div>
                      <div className="mt-0.5">
                        {member.department?.name ? (
                          <span className="inline-flex items-center rounded-full bg-neutral-50 border border-neutral-200/50 px-2.5 py-1 text-xs font-medium text-neutral-600">
                            {member.department.name}
                          </span>
                        ) : (
                          'Ã¢â‚¬â€'
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wider text-neutral-400">Manager</div>
                      <div className="font-medium text-neutral-600 mt-0.5">{member.manager?.name ?? 'Ã¢â‚¬â€'}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wider text-neutral-400">Contact</div>
                      <div className="font-normal text-neutral-500 mt-0.5 truncate" title={member.email}>{member.email}</div>
                    </div>
                  </div>
 
                  <div className="pt-3.5 border-t border-neutral-100 flex items-center justify-between text-sm font-medium text-neutral-500">
                    <span>Leave Summary:</span>
                    <div className="font-medium">
                      <span className="text-amber-700">{member.pending_leave_requests_count ?? 0} pending</span>
                      <span className="mx-1.5 text-neutral-300">Ã‚Â·</span>
                      <span className="text-orange-700">{member.approved_leave_requests_count ?? 0} approved</span>
                    </div>
                  </div>
                </div>
              ))}
              {members.length === 0 && (
                <div className="p-8 text-center text-sm text-neutral-400 font-medium">
                  No team members in your current organizational scope.
                </div>
              )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-neutral-50/50 text-sm font-medium uppercase tracking-wider text-neutral-500 border-b border-neutral-100/60">
                  <tr>
                    <th className="px-6 py-5">Employee</th>
                    <th className="px-4 py-5">Role</th>
                    <th className="px-4 py-5">Department</th>
                    <th className="px-4 py-5">Manager</th>
                    <th className="px-4 py-5">Leave Summary</th>
                    <th className="px-6 py-5">Contact Info</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100/60">
                  {members.map((member) => (
                    <tr key={member.id} className="transition-all hover:bg-neutral-50/40">
                      <td className="px-6 py-4.5">
                        <div className="flex items-center gap-3.5">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-neutral-50 to-neutral-100 font-medium text-neutral-600 text-sm shrink-0 border border-neutral-200 shadow-premium-sm">
                            {member.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-neutral-800">{member.name}</div>
                            <div className="text-xs font-medium uppercase tracking-wider text-neutral-400 mt-1">{member.employee_code ?? 'NO CODE'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4.5 text-neutral-600 font-medium">
                        {member.job_title ?? member.role}
                      </td>
                      <td className="px-4 py-4.5">
                        {member.department?.name ? (
                          <span className="inline-flex items-center rounded-full bg-neutral-50 border border-neutral-200 px-3 py-1 text-sm font-medium text-neutral-600">
                            {member.department.name}
                          </span>
                        ) : (
                          <span className="text-neutral-400 font-medium">Ã¢â‚¬â€</span>
                        )}
                      </td>
                      <td className="px-4 py-4.5 text-neutral-500 font-medium">
                        {member.manager?.name ?? 'Ã¢â‚¬â€'}
                      </td>
                      <td className="px-4 py-4.5 whitespace-nowrap text-neutral-600 font-medium">
                        <span className="text-amber-700 font-medium">{member.pending_leave_requests_count ?? 0} pending</span>
                        <span className="mx-1.5 text-neutral-300">Ã‚Â·</span>
                        <span className="text-orange-700 font-medium">{member.approved_leave_requests_count ?? 0} approved</span>
                      </td>
                      <td className="px-6 py-4.5">
                        <div className="text-neutral-700 font-normal">{member.email}</div>
                        {member.phone && <div className="text-xs text-neutral-400 font-normal mt-1">{member.phone}</div>}
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

          <aside className="space-y-6">
            <Panel icon={<ClipboardCheck size={15} />} title="Pending Decisions">
              <div className="space-y-3.5">
                {pendingRequests.map((request) => (
                  <RequestLine key={request.id} request={request} />
                ))}
                {pendingRequests.length === 0 && (
                  <p className="py-4 text-center text-sm text-neutral-400 font-medium">No pending requests to resolve.</p>
                )}
              </div>
            </Panel>

            <Panel icon={<CalendarClock size={15} />} title="Upcoming Leave">
              <div className="space-y-3.5">
                {leaveCalendar.map((request) => (
                  <RequestLine key={request.id} request={request} />
                ))}
                {leaveCalendar.length === 0 && (
                  <p className="py-4 text-center text-sm text-neutral-400 font-medium">No upcoming leave schedules.</p>
                )}
              </div>
            </Panel>
          </aside>
        </div>
      </div>
    </AppLayout>
  );
}

function Metric({ label, value, icon, variant }: { label: string; value: string | number; icon: React.ReactNode; variant: 'amber' | 'orange' | 'indigo' }) {
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
      <div className="flex items-center justify-between text-sm font-medium uppercase tracking-wider text-neutral-500 relative z-10">
        <span>{label}</span>
        <div className={`flex h-8 w-8 items-center justify-center rounded-md border ${theme.iconBg} shadow-premium-sm transition-transform duration-300 group-hover:scale-105`}>
          {icon}
        </div>
      </div>
      <div className="mt-5 text-3xl font-medium tracking-tight text-neutral-800 relative z-10">{value}</div>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-neutral-200/50 bg-white p-5 shadow-premium-sm">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-neutral-800">
        <div className="text-neutral-400">{icon}</div>
        <span>{title}</span>
      </h2>
      {children}
    </section>
  );
}
 
function RequestLine({ request }: { request: LeaveRequest }) {
  return (
    <div className="rounded-lg bg-neutral-50/50 border border-neutral-100 p-4 text-sm shadow-premium-sm">
      <div className="font-medium text-neutral-800">
        {request.user?.name} Ã‚Â· <span className="text-orange-700">{request.leave_type.name}</span>
      </div>
      <div className="text-xs text-neutral-500 mt-2.5 flex flex-wrap items-center gap-1.5 font-medium">
        <span className="font-medium">{formatShortDate(request.starts_at)} Ã¢â‚¬â€œ {formatShortDate(request.ends_at)}</span>
        <span>Ã‚Â·</span>
        <span className="font-medium text-neutral-700">{formatDays(request.requested_days)} day(s)</span>
        <span>Ã‚Â·</span>
        <span className="rounded-full bg-neutral-100 border border-neutral-200 px-2 py-0.5 font-medium text-neutral-600 uppercase text-[10px]">{request.status}</span>
      </div>
    </div>
  );
}
