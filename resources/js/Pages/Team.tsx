import { Link } from '@inertiajs/react';
import { CalendarClock, ClipboardCheck, Search, UserCheck, Users, X } from 'lucide-react';
import type React from 'react';
import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import AppLayout from '../Layouts/AppLayout';
import type { LeaveRequest, User } from '../types';
import { formatDays, formatRole, formatShortDate } from '../utils';
import LeaveBadge from '../Components/LeaveBadge';

type Props = {
  members: User[];
  leaveCalendar: LeaveRequest[];
  pendingRequests: LeaveRequest[];
  teamStats: { members: number; pending: number; on_leave_today: number; approved_this_year: number };
  requestYear: number;
};

export default function Team({ members, leaveCalendar, pendingRequests, teamStats, requestYear }: Props) {
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [selectedMember, setSelectedMember] = useState<User | null>(null);

  useEffect(() => {
    if (!selectedMember) {
      return;
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedMember(null);
      }
    };

    document.addEventListener('keydown', closeOnEscape);

    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [selectedMember]);

  const departments = useMemo(() => {
    return Array.from(new Set(members.map((m) => m.department?.name).filter(Boolean))) as string[];
  }, [members]);

  const filteredMembers = useMemo(() => {
    return members.filter((member) => {
      const matchesRole = roleFilter === 'all' || member.role === roleFilter;
      const matchesDept = deptFilter === 'all' || member.department?.name === deptFilter;
      const haystack = `${member.name} ${member.employee_code ?? ''} ${member.job_title ?? ''} ${member.email} ${member.department?.name ?? ''}`.toLowerCase();
      return matchesRole && matchesDept && haystack.includes(query.toLowerCase());
    });
  }, [query, roleFilter, deptFilter, members]);

  const [rosterPage, setRosterPage] = useState(1);
  const rosterItemsPerPage = 10;

  useEffect(() => {
    setRosterPage(1);
  }, [query, roleFilter, deptFilter]);

  const rosterTotalPages = Math.ceil(filteredMembers.length / rosterItemsPerPage);

  const paginatedMembers = useMemo(() => {
    const start = (rosterPage - 1) * rosterItemsPerPage;
    return filteredMembers.slice(start, start + rosterItemsPerPage);
  }, [filteredMembers, rosterPage]);

  const getPageNumbers = (current: number, total: number) => {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: (number | string)[] = [];
    pages.push(1);
    if (current > 3) pages.push('...');
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    if (current < total - 2) pages.push('...');
    pages.push(total);
    return pages;
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Statistics section */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Metric icon={<Users size={15} />} label="Team Members" value={teamStats.members} variant="indigo" />
          <Link href="/approvals" aria-label={`Review ${teamStats.pending} pending decisions`}>
            <Metric icon={<ClipboardCheck size={15} />} label="Pending Decisions" value={teamStats.pending} variant="amber" />
          </Link>
          <Metric icon={<UserCheck size={15} />} label="On Leave Today" value={teamStats.on_leave_today} variant="orange" />
          <Metric icon={<CalendarClock size={15} />} label="Approved This Year" value={teamStats.approved_this_year} variant="green" />
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_310px]">
          {/* Team Roster Grid */}
          <section className="rounded-xl border border-neutral-200/50 bg-white shadow-premium-sm overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200/60 px-6 py-5 bg-neutral-50/20">
              <div>
                <h2 className="text-base font-medium text-neutral-800">Team Roster</h2>
                <p className="text-sm font-medium text-neutral-500 mt-1.5">List of colleagues and staff in your active department scope</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <div className="relative">
                  <Search className="absolute left-3.5 top-3.5 text-neutral-400" size={14} />
                  <input
                    className="w-52 rounded-lg border border-neutral-200 py-2.5 pl-9 pr-3.5 text-sm bg-white font-medium text-neutral-850 placeholder-neutral-400 outline-none focus:border-orange-600 focus:ring-4 focus:ring-orange-500/5 transition-all shadow-premium-sm"
                    placeholder="Search roster..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <select
                  className="rounded-lg border border-neutral-200 px-4 py-2.5 text-sm bg-white font-medium text-neutral-700 outline-none focus:border-orange-600 focus:ring-4 focus:ring-orange-500/5 transition-all shadow-premium-sm cursor-pointer"
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                >
                  <option value="all">All Roles</option>
                  {['staff', 'manager', 'hr admin', 'admin'].map((role) => (
                    <option key={role} value={role}>
                      {formatRole(role)}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded-lg border border-neutral-200 px-4 py-2.5 text-sm bg-white font-medium text-neutral-700 outline-none focus:border-orange-600 focus:ring-4 focus:ring-orange-500/5 transition-all shadow-premium-sm cursor-pointer"
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                >
                  <option value="all">All Departments</option>
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
                <Link
                  className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-5 py-3 text-sm font-medium text-white shadow-md shadow-orange-600/10 hover:bg-orange-700 transition-all duration-200 active:scale-98"
                  href="/approvals"
                >
                  Review approvals
                </Link>
              </div>
            </div>
            
            {/* Mobile Card List View */}
            <div className="divide-y divide-neutral-100 sm:hidden">
              {paginatedMembers.map((member) => (
                <div key={member.id} className="p-5 space-y-4 bg-white">
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-lg text-left outline-none transition-colors hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-orange-500/30"
                    onClick={() => setSelectedMember(member)}
                    aria-label={`View ${member.name}'s ${requestYear} leave requests`}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-neutral-50 to-neutral-100 font-medium text-neutral-600 text-sm shrink-0 border border-neutral-200 shadow-premium-sm">
                      {member.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-neutral-800 text-sm">{member.name}</div>
                      <div className="text-xs font-medium uppercase tracking-wider text-neutral-400 mt-1">{member.employee_code ?? 'NO CODE'}</div>
                    </div>
                  </button>
 
                  <div className="grid grid-cols-2 gap-3.5 text-sm text-neutral-600 font-medium">
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wider text-neutral-400">Role</div>
                      <div className="font-medium text-neutral-600 mt-0.5">{member.job_title ?? formatRole(member.role)}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wider text-neutral-400">Department</div>
                      <div className="mt-0.5">
                        {member.department?.name ? (
                          <span className="inline-flex items-center rounded-md bg-neutral-50 border border-neutral-200/50 px-2 py-0.5 text-xs font-semibold text-neutral-600">
                            {member.department.name}
                          </span>
                        ) : (
                          '—'
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wider text-neutral-400">Manager</div>
                      <div className="font-medium text-neutral-600 mt-0.5">{member.manager?.name ?? '—'}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wider text-neutral-400">Contact</div>
                      <div className="font-normal text-neutral-500 mt-0.5 truncate" title={member.email}>{member.email}</div>
                    </div>
                  </div>
 
                  <div className="pt-3.5 border-t border-neutral-100 flex items-center justify-between text-sm font-medium text-neutral-500">
                    <span>Leave Summary:</span>
                    <div className="font-medium">
                      <Link className="rounded text-amber-700 hover:text-amber-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/30" href="/approvals">
                        {member.pending_leave_requests_count ?? 0} pending
                      </Link>
                      <span className="mx-1.5 text-neutral-300">·</span>
                      <span className="text-green-700">{member.approved_leave_requests_count ?? 0} approved</span>
                    </div>
                  </div>
                </div>
              ))}
              {filteredMembers.length === 0 && (
                <div className="p-8 text-center text-sm text-neutral-400 font-medium">
                  No matching team members found.
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
                  {paginatedMembers.map((member) => (
                    <tr key={member.id} className="transition-all hover:bg-neutral-50/40">
                      <td className="px-6 py-4.5">
                        <button
                          type="button"
                          className="flex items-center gap-3.5 rounded-lg text-left outline-none transition-colors hover:text-orange-700 focus-visible:ring-2 focus-visible:ring-orange-500/30"
                          onClick={() => setSelectedMember(member)}
                          aria-label={`View ${member.name}'s ${requestYear} leave requests`}
                        >
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-neutral-50 to-neutral-100 font-medium text-neutral-600 text-sm shrink-0 border border-neutral-200 shadow-premium-sm">
                            {member.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-neutral-800">{member.name}</div>
                            <div className="text-xs font-medium uppercase tracking-wider text-neutral-400 mt-1">{member.employee_code ?? 'NO CODE'}</div>
                          </div>
                        </button>
                      </td>
                      <td className="px-4 py-4.5 text-neutral-600 font-medium">
                        {member.job_title ?? formatRole(member.role)}
                      </td>
                      <td className="px-4 py-4.5">
                        {member.department?.name ? (
                          <span className="inline-flex items-center rounded-md bg-neutral-50 border border-neutral-200 px-2 py-0.5 text-xs font-semibold text-neutral-600">
                            {member.department.name}
                          </span>
                        ) : (
                          <span className="text-neutral-400 font-medium">— </span>
                        )}
                      </td>
                      <td className="px-4 py-4.5 text-neutral-500 font-medium">
                        {member.manager?.name ?? '—'}
                      </td>
                      <td className="px-4 py-4.5 whitespace-nowrap text-neutral-600 font-medium">
                        <Link className="rounded text-amber-700 font-medium hover:text-amber-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/30" href="/approvals">
                          {member.pending_leave_requests_count ?? 0} pending
                        </Link>
                        <span className="mx-1.5 text-neutral-300">·</span>
                        <span className="text-green-700 font-medium">{member.approved_leave_requests_count ?? 0} approved</span>
                      </td>
                      <td className="px-6 py-4.5">
                        <div className="text-neutral-700 font-normal">{member.email}</div>
                        {member.phone && <div className="text-xs text-neutral-400 font-normal mt-1">{member.phone}</div>}
                      </td>
                    </tr>
                  ))}
                  {filteredMembers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-neutral-400 font-medium">
                        No matching team members found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {rosterTotalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-neutral-100 px-6 py-4 bg-neutral-50/10">
                <div className="text-xs font-semibold text-neutral-500">
                  Showing <span className="font-bold text-neutral-700">{Math.min(filteredMembers.length, (rosterPage - 1) * rosterItemsPerPage + 1)}</span> to{' '}
                  <span className="font-bold text-neutral-700">{Math.min(filteredMembers.length, rosterPage * rosterItemsPerPage)}</span> of{' '}
                  <span className="font-bold text-neutral-700">{filteredMembers.length}</span> results
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  <button
                    disabled={rosterPage === 1}
                    onClick={() => setRosterPage(prev => Math.max(1, prev - 1))}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-neutral-200 bg-white text-neutral-650 hover:bg-neutral-50 hover:text-neutral-800 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer shadow-premium-sm"
                  >
                    Previous
                  </button>
                  {getPageNumbers(rosterPage, rosterTotalPages).map((page, index) => {
                    if (page === '...') {
                      return (
                        <span key={`dots-${index}`} className="px-2 py-1.5 text-xs font-bold text-neutral-400">
                          ...
                        </span>
                      );
                    }
                    return (
                      <button
                        key={page}
                        onClick={() => setRosterPage(page as number)}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                          rosterPage === page
                            ? 'bg-orange-600 border-orange-600 text-white shadow-sm'
                            : 'border-neutral-200 bg-white text-neutral-650 hover:bg-neutral-50 hover:text-neutral-800 shadow-premium-sm'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}
                  <button
                    disabled={rosterPage === rosterTotalPages}
                    onClick={() => setRosterPage(prev => Math.min(rosterTotalPages, prev + 1))}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-neutral-200 bg-white text-neutral-650 hover:bg-neutral-50 hover:text-neutral-800 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer shadow-premium-sm"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
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

      {selectedMember && createPortal(
        <EmployeeRequestsModal
          member={selectedMember}
          requestYear={requestYear}
          onClose={() => setSelectedMember(null)}
        />,
        document.body,
      )}
    </AppLayout>
  );
}

function Metric({ label, value, icon, variant }: { label: string; value: string | number; icon: React.ReactNode; variant: 'amber' | 'orange' | 'indigo' | 'green' }) {
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
  const statusStyles: Record<string, { bg: string; border: string; text: string; dot: string }> = {
    pending: { bg: 'bg-amber-500/[0.04]', border: 'border-amber-500/10', text: 'text-amber-700/90', dot: 'bg-amber-500' },
    approved: { bg: 'bg-green-500/[0.04]', border: 'border-green-500/10', text: 'text-green-700/90', dot: 'bg-green-500' },
    rejected: { bg: 'bg-rose-500/[0.04]', border: 'border-rose-500/10', text: 'text-rose-700/90', dot: 'bg-rose-500' },
    cancelled: { bg: 'bg-neutral-500/[0.04]', border: 'border-neutral-500/10', text: 'text-neutral-550/90', dot: 'bg-neutral-400' },
  };
  const style = statusStyles[request.status] ?? { bg: 'bg-neutral-500/[0.04]', border: 'border-neutral-500/10', text: 'text-neutral-600/90', dot: 'bg-neutral-400' };

  const content = (
    <div className={`rounded-lg bg-neutral-50/50 border border-neutral-100 p-4 text-sm shadow-premium-sm ${request.status === 'pending' ? 'transition-all group-hover:border-amber-200 group-hover:bg-amber-50/40 group-hover:shadow-premium-md' : ''}`}>
      <div className="font-medium text-neutral-800 flex items-center gap-1.5 flex-wrap">
        <span>{request.user?.name}</span>
        <span>·</span>
        <LeaveBadge code={request.leave_type.code} name={request.leave_type.name} variant="minimal" />
      </div>
      <div className="text-xs text-neutral-500 mt-2.5 flex flex-wrap items-center gap-1.5 font-medium">
        <span className="font-medium">{formatShortDate(request.starts_at)} – {formatShortDate(request.ends_at)}</span>
        <span>·</span>
        <span className="font-medium text-neutral-700">{formatDays(request.requested_days)} day(s)</span>
        <span>·</span>
        <span className={`inline-flex items-center rounded-md border ${style.border} ${style.bg} ${style.text} px-2 py-0.5 text-[10px] font-semibold tracking-wide transition-all duration-300 uppercase`}>
          <span className={`h-1.5 w-1.5 rounded-full ${style.dot} mr-1.5 shrink-0`} />
          {request.status}
        </span>
      </div>
    </div>
  );

  if (request.status === 'pending') {
    return (
      <Link
        className="group block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-orange-500/30"
        href={`/approvals#request-${request.id}`}
        aria-label={`Review ${request.user?.name ?? 'employee'}'s pending ${request.leave_type.name} request`}
      >
        {content}
      </Link>
    );
  }

  return content;
}

function EmployeeRequestsModal({ member, requestYear, onClose }: { member: User; requestYear: number; onClose: () => void }) {
  const requests = member.leave_requests ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/60 p-4 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      role="presentation"
    >
      <section
        aria-labelledby="employee-requests-title"
        aria-modal="true"
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-neutral-200/85 bg-white shadow-premium-lg"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="flex items-start justify-between gap-4 border-b border-neutral-100 px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-gradient-to-br from-neutral-50 to-neutral-100 text-sm font-medium text-neutral-600 shadow-premium-sm">
              {member.name.split(' ').map((name) => name[0]).slice(0, 2).join('').toUpperCase()}
            </div>
            <div className="min-w-0">
              <h2 id="employee-requests-title" className="truncate text-base font-semibold text-neutral-800">
                {member.name}
              </h2>
              <p className="mt-1 text-sm font-medium text-neutral-500">
                {requests.length} leave request{requests.length === 1 ? '' : 's'} in {requestYear}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="rounded-lg border border-neutral-200 p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/30"
            onClick={onClose}
            aria-label="Close employee request details"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          {requests.length > 0 ? (
            <div className="space-y-4">
              {requests.map((request) => (
                <EmployeeRequestCard key={request.id} request={request} />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50/50 px-6 py-12 text-center">
              <CalendarClock className="mx-auto text-neutral-300" size={28} />
              <p className="mt-3 text-sm font-medium text-neutral-500">No leave requests in {requestYear}.</p>
            </div>
          )}
        </div>

        <footer className="flex justify-end border-t border-neutral-100 bg-neutral-50/20 px-5 py-4 sm:px-6">
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-lg border border-neutral-200 bg-white px-5 py-2.5 text-sm font-semibold text-neutral-600 transition-all hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/30"
            onClick={onClose}
          >
            Close
          </button>
        </footer>
      </section>
    </div>
  );
}

function EmployeeRequestCard({ request }: { request: LeaveRequest }) {
  const statusStyles: Record<string, { container: string; dot: string }> = {
    pending: { container: 'border-amber-200 bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
    approved: { container: 'border-green-200 bg-green-50 text-green-700', dot: 'bg-green-500' },
    rejected: { container: 'border-rose-200 bg-rose-50 text-rose-700', dot: 'bg-rose-500' },
    cancelled: { container: 'border-neutral-200 bg-neutral-50 text-neutral-600', dot: 'bg-neutral-400' },
  };
  const style = statusStyles[request.status] ?? statusStyles.cancelled;

  return (
    <article className="rounded-xl border border-neutral-200/70 bg-white p-4 shadow-premium-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <LeaveBadge code={request.leave_type.code} name={request.leave_type.name} />
          <p className="mt-2 text-sm font-semibold text-neutral-800">
            {formatShortDate(request.starts_at)} – {formatShortDate(request.ends_at)}
          </p>
          <p className="mt-1 text-xs font-medium text-orange-700">{formatDays(request.requested_days)} working day(s)</p>
        </div>
        <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${style.container}`}>
          <span className={`mr-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${style.dot}`} />
          {request.status}
        </span>
      </div>

      <dl className="mt-4 grid gap-4 border-t border-neutral-100 pt-4 sm:grid-cols-2">
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Reason</dt>
          <dd className="mt-1 text-sm leading-relaxed text-neutral-600">{request.reason || 'No reason provided.'}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Decision</dt>
          <dd className="mt-1 text-sm leading-relaxed text-neutral-600">
            {request.manager_comment || (request.status === 'pending' ? 'Awaiting manager review.' : 'No manager comment.')}
          </dd>
          {request.approver?.name && <p className="mt-1 text-xs font-medium text-neutral-400">By {request.approver.name}</p>}
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Submitted</dt>
          <dd className="mt-1 text-sm text-neutral-600">
            {request.submitted_at ? new Date(request.submitted_at).toLocaleString() : 'Not recorded'}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Decided</dt>
          <dd className="mt-1 text-sm text-neutral-600">
            {request.decided_at ? new Date(request.decided_at).toLocaleString() : 'Not decided yet'}
          </dd>
        </div>
      </dl>

      {request.status === 'pending' && (
        <div className="mt-4 flex justify-end border-t border-neutral-100 pt-4">
          <Link
            className="inline-flex items-center rounded-lg bg-orange-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/30"
            href={`/approvals#request-${request.id}`}
          >
            Review request
          </Link>
        </div>
      )}
    </article>
  );
}
