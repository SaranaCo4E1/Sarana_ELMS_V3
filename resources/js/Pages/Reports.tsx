import { Building2, CalendarDays, Shield, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import AppLayout from '../Layouts/AppLayout';
import type { LeaveType, User } from '../types';
import { formatDays, formatRole } from '../utils';
import { getLeaveStyle } from '../Components/LeaveBadge';

type Props = {
  users: User[];
  leaveTypes: LeaveType[];
  departments: { id: number; name: string }[];
};

const ROLES = ['staff', 'manager', 'hr admin', 'admin'];

type Totals = { taken: number; balance: number };

export default function Reports({ users, leaveTypes, departments }: Props) {
  const [selectedUser, setSelectedUser] = useState('all');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedRole, setSelectedRole] = useState('all');

  const years = useMemo(() => {
    const set = new Set<number>([new Date().getFullYear()]);
    users.forEach((member) => {
      (member.leave_balances ?? []).forEach((balance) => set.add(balance.year));
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [users]);

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const selectedUserRecord = useMemo(
    () => (selectedUser === 'all' ? null : users.find((user) => String(user.id) === selectedUser) ?? null),
    [selectedUser, users]
  );

  useEffect(() => {
    if (!selectedUserRecord) return;
    setSelectedDepartment(selectedUserRecord.department?.name ?? 'all');
    setSelectedRole(selectedUserRecord.role);
  }, [selectedUserRecord]);

  const filteredMembers = useMemo(() => {
    return users.filter((member) => {
      const matchesUser = selectedUser === 'all' || String(member.id) === selectedUser;
      const matchesDepartment = selectedDepartment === 'all' || member.department?.name === selectedDepartment;
      const matchesRole = selectedRole === 'all' || member.role === selectedRole;
      return matchesUser && matchesDepartment && matchesRole;
    });
  }, [users, selectedUser, selectedDepartment, selectedRole]);

  const paidTypes = useMemo(() => leaveTypes.filter((type) => type.paid), [leaveTypes]);
  const unpaidTypes = useMemo(() => leaveTypes.filter((type) => !type.paid), [leaveTypes]);

  const balanceFor = (member: User, leaveTypeId: number): Totals => {
    const balance = (member.leave_balances ?? []).find((b) => b.leave_type_id === leaveTypeId && b.year === selectedYear);
    return {
      taken: balance ? Number(balance.used_days) || 0 : 0,
      balance: balance ? Number(balance.available_days) || 0 : 0,
    };
  };

  const paidTotalFor = (member: User): Totals => {
    return paidTypes.reduce(
      (acc, type) => {
        const b = balanceFor(member, type.id);
        return { taken: acc.taken + b.taken, balance: acc.balance + b.balance };
      },
      { taken: 0, balance: 0 }
    );
  };

  const [reportPage, setReportPage] = useState(1);
  const reportItemsPerPage = 10;

  useEffect(() => {
    setReportPage(1);
  }, [selectedUser, selectedYear, selectedDepartment, selectedRole]);

  const reportTotalPages = Math.ceil(filteredMembers.length / reportItemsPerPage);

  const paginatedMembers = useMemo(() => {
    const start = (reportPage - 1) * reportItemsPerPage;
    return filteredMembers.slice(start, start + reportItemsPerPage);
  }, [filteredMembers, reportPage]);

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

  const totalColumns = 1 + paidTypes.length * 2 + (paidTypes.length > 0 ? 2 : 0) + unpaidTypes.length * 2;

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Report table */}
        <section className="rounded-xl border border-neutral-200/50 bg-white shadow-premium-sm overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200/60 px-6 py-5 bg-neutral-50/20">
            <div>
              <h2 className="text-base font-medium text-neutral-800">Leave Report</h2>
              <p className="text-sm font-medium text-neutral-500 mt-1.5">Leave taken and currently available after pending reservations, filterable by employee, year, department, and role</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="relative">
                <Users className="absolute left-3.5 top-3.5 text-neutral-400" size={14} />
                <select
                  className="rounded-lg border border-neutral-200 pl-9 pr-4 py-2.5 text-sm bg-white font-medium text-neutral-700 outline-none focus:border-orange-600 focus:ring-4 focus:ring-orange-500/5 transition-all shadow-premium-sm cursor-pointer"
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                >
                  <option value="all">All Employees</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="relative">
                <CalendarDays className="absolute left-3.5 top-3.5 text-neutral-400" size={14} />
                <select
                  className="rounded-lg border border-neutral-200 pl-9 pr-4 py-2.5 text-sm bg-white font-medium text-neutral-700 outline-none focus:border-orange-600 focus:ring-4 focus:ring-orange-500/5 transition-all shadow-premium-sm cursor-pointer"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                >
                  {years.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
              <div className="relative">
                <Building2 className="absolute left-3.5 top-3.5 text-neutral-400" size={14} />
                <select
                  className="rounded-lg border border-neutral-200 pl-9 pr-4 py-2.5 text-sm bg-white font-medium text-neutral-700 outline-none focus:border-orange-600 focus:ring-4 focus:ring-orange-500/5 transition-all shadow-premium-sm cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-neutral-50"
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  disabled={!!selectedUserRecord}
                  title={selectedUserRecord ? 'Department is set automatically from the selected employee' : undefined}
                >
                  <option value="all">All Departments</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.name}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="relative">
                <Shield className="absolute left-3.5 top-3.5 text-neutral-400" size={14} />
                <select
                  className="rounded-lg border border-neutral-200 pl-9 pr-4 py-2.5 text-sm bg-white font-medium text-neutral-700 outline-none focus:border-orange-600 focus:ring-4 focus:ring-orange-500/5 transition-all shadow-premium-sm cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-neutral-50"
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  disabled={!!selectedUserRecord}
                  title={selectedUserRecord ? 'Role is set automatically from the selected employee' : undefined}
                >
                  <option value="all">All Roles</option>
                  {ROLES.map((role) => (
                    <option key={role} value={role}>
                      {formatRole(role)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Mobile Card List View */}
          <div className="divide-y divide-neutral-100 sm:hidden">
            {paginatedMembers.map((member) => {
              const paidTotal = paidTotalFor(member);
              return (
                <div key={member.id} className="p-5 space-y-3.5 bg-white">
                  <div>
                    <div className="font-medium text-neutral-800 text-sm">{member.name}</div>
                    <div className="text-xs font-medium uppercase tracking-wider text-neutral-400 mt-1">{member.employee_code ?? 'NO CODE'}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3.5 text-sm text-neutral-600 font-medium">
                    {leaveTypes.map((type) => {
                      const b = balanceFor(member, type.id);
                      return (
                        <div key={type.id}>
                          <div className="text-xs text-neutral-400 uppercase font-medium tracking-wider">{type.name}</div>
                          <div className="mt-1">{formatDays(b.taken)} taken <span className="text-neutral-300">/</span> {formatDays(b.balance)} left</div>
                        </div>
                      );
                    })}
                    {paidTypes.length > 0 && (
                      <div>
                        <div className="text-xs text-neutral-400 uppercase font-medium tracking-wider">Paid Total</div>
                        <div className="mt-1 font-semibold text-neutral-800">{formatDays(paidTotal.taken)} taken <span className="text-neutral-300">/</span> {formatDays(paidTotal.balance)} left</div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {filteredMembers.length === 0 && (
              <div className="p-8 text-center text-sm text-neutral-400 font-medium">
                No employees match your filters.
              </div>
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-50/50 text-xs font-medium uppercase tracking-wider text-neutral-500 border-b border-neutral-100/60">
                <tr>
                  <th rowSpan={3} className="px-6 py-3 align-bottom border-r border-neutral-100">Employee</th>
                  {paidTypes.length > 0 && (
                    <th colSpan={paidTypes.length * 2 + 2} className="px-4 py-2.5 text-center border-b border-neutral-100">Paid</th>
                  )}
                  {unpaidTypes.length > 0 && (
                    <th colSpan={unpaidTypes.length * 2} className="px-4 py-2.5 text-center border-b border-neutral-100">Unpaid</th>
                  )}
                </tr>
                <tr>
                  {paidTypes.map((type) => (
                    <th key={type.id} colSpan={2} className={`px-4 py-2.5 text-center border-b border-neutral-100 ${getLeaveStyle(type.code || type.name).text}`}>
                      {type.name}
                    </th>
                  ))}
                  {paidTypes.length > 0 && (
                    <th colSpan={2} className="px-4 py-2.5 text-center border-b border-neutral-100 text-neutral-700">Total</th>
                  )}
                  {unpaidTypes.map((type) => (
                    <th key={type.id} colSpan={2} className={`px-4 py-2.5 text-center border-b border-neutral-100 ${getLeaveStyle(type.code || type.name).text}`}>
                      {type.name}
                    </th>
                  ))}
                </tr>
                <tr>
                  {paidTypes.flatMap((type) => [
                    <th key={`${type.id}-taken`} className="px-3 py-2.5 text-center font-semibold">Taken</th>,
                    <th key={`${type.id}-balance`} className="px-3 py-2.5 text-center font-semibold">Available</th>,
                  ])}
                  {paidTypes.length > 0 && [
                    <th key="total-taken" className="px-3 py-2.5 text-center font-semibold">Taken</th>,
                    <th key="total-balance" className="px-3 py-2.5 text-center font-semibold">Available</th>,
                  ]}
                  {unpaidTypes.flatMap((type) => [
                    <th key={`${type.id}-taken`} className="px-3 py-2.5 text-center font-semibold">Taken</th>,
                    <th key={`${type.id}-balance`} className="px-3 py-2.5 text-center font-semibold">Available</th>,
                  ])}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100/60">
                {paginatedMembers.map((member) => {
                  const paidTotal = paidTotalFor(member);
                  return (
                    <tr key={member.id} className="transition-all hover:bg-neutral-50/40">
                      <td className="px-6 py-4.5 border-r border-neutral-100">
                        <div className="font-medium text-neutral-800">{member.name}</div>
                        <div className="text-xs font-medium uppercase tracking-wider text-neutral-400 mt-1">{member.employee_code ?? 'NO CODE'}</div>
                      </td>
                      {paidTypes.flatMap((type) => {
                        const b = balanceFor(member, type.id);
                        return [
                          <td key={`${type.id}-taken`} className="px-3 py-4.5 text-center text-neutral-600 font-medium">{formatDays(b.taken)}</td>,
                          <td key={`${type.id}-balance`} className="px-3 py-4.5 text-center text-neutral-800 font-medium">{formatDays(b.balance)}</td>,
                        ];
                      })}
                      {paidTypes.length > 0 && [
                        <td key="total-taken" className="px-3 py-4.5 text-center text-neutral-700 font-semibold bg-neutral-50/40">{formatDays(paidTotal.taken)}</td>,
                        <td key="total-balance" className="px-3 py-4.5 text-center text-neutral-800 font-semibold bg-neutral-50/40">{formatDays(paidTotal.balance)}</td>,
                      ]}
                      {unpaidTypes.flatMap((type) => {
                        const b = balanceFor(member, type.id);
                        return [
                          <td key={`${type.id}-taken`} className="px-3 py-4.5 text-center text-neutral-600 font-medium">{formatDays(b.taken)}</td>,
                          <td key={`${type.id}-balance`} className="px-3 py-4.5 text-center text-neutral-800 font-medium">{formatDays(b.balance)}</td>,
                        ];
                      })}
                    </tr>
                  );
                })}
                {filteredMembers.length === 0 && (
                  <tr>
                    <td colSpan={totalColumns} className="px-6 py-12 text-center text-neutral-400 font-medium">
                      No employees match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {reportTotalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-neutral-100 px-6 py-4 bg-neutral-50/10">
              <div className="text-xs font-semibold text-neutral-500">
                Showing <span className="font-bold text-neutral-700">{Math.min(filteredMembers.length, (reportPage - 1) * reportItemsPerPage + 1)}</span> to{' '}
                <span className="font-bold text-neutral-700">{Math.min(filteredMembers.length, reportPage * reportItemsPerPage)}</span> of{' '}
                <span className="font-bold text-neutral-700">{filteredMembers.length}</span> results
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                <button
                  disabled={reportPage === 1}
                  onClick={() => setReportPage(prev => Math.max(1, prev - 1))}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-neutral-200 bg-white text-neutral-650 hover:bg-neutral-50 hover:text-neutral-800 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer shadow-premium-sm"
                >
                  Previous
                </button>
                {getPageNumbers(reportPage, reportTotalPages).map((page, index) => {
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
                      onClick={() => setReportPage(page as number)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                        reportPage === page
                          ? 'bg-orange-600 border-orange-600 text-white shadow-sm'
                          : 'border-neutral-200 bg-white text-neutral-650 hover:bg-neutral-50 hover:text-neutral-800 shadow-premium-sm'
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}
                <button
                  disabled={reportPage === reportTotalPages}
                  onClick={() => setReportPage(prev => Math.min(reportTotalPages, prev + 1))}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-neutral-200 bg-white text-neutral-650 hover:bg-neutral-50 hover:text-neutral-800 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer shadow-premium-sm"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
