import { router } from '@inertiajs/react';
import { Activity, Building2, CalendarDays, Download, Plus, Search, Shield, SlidersHorizontal, ToggleLeft, ToggleRight, UserPlus, Users, ClipboardList } from 'lucide-react';
import type React from 'react';
import { useMemo, useState } from 'react';
import AppLayout from '../Layouts/AppLayout';
import type { LeaveType, User } from '../types';
import { formatDays, formatDate } from '../utils';

type Department = { id: number; name: string; code: string; manager_id?: number; manager?: User; is_active: boolean; users_count?: number };
type Holiday = { id: number; name: string; holiday_date: string; is_active: boolean };
type AuditLog = { id: number; action: string; subject_type?: string | null; subject_id?: number | null; ip_address?: string | null; created_at: string };
type Stats = { active_users: number; inactive_users: number; pending_requests: number; approved_this_month: number; departments: number; leave_types: number };

export default function Admin({ departments, leaveTypes, holidays, users, auditLogs, stats }: { departments: Department[]; leaveTypes: LeaveType[]; holidays: Holiday[]; users: User[]; auditLogs: AuditLog[]; stats: Stats }) {
  const [activeTab, setActiveTab] = useState('users');

  const [departmentForm, setDepartmentForm] = useState({ name: '', code: '', manager_id: '' });
  const [leaveTypeForm, setLeaveTypeForm] = useState({ name: '', code: '', default_allowance_days: 0, paid: true, requires_attachment: false, deducts_balance: true });
  const [holidayForm, setHolidayForm] = useState({ name: '', holiday_date: '' });
  const [userForm, setUserForm] = useState({ name: '', email: '', password: 'password', role: 'staff', department_id: '', manager_id: '', employee_code: '', job_title: '', hire_date: '', two_factor_enabled: false });
  const [balanceForm, setBalanceForm] = useState({ user_id: '', leave_type_id: '', year: new Date().getFullYear(), allowance_days: 0, adjustment_days: 0, override_reason: '' });
  
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const filteredUsers = useMemo(() => users.filter((item) => {
    const matchesRole = roleFilter === 'all' || item.role === roleFilter;
    const haystack = `${item.name} ${item.email} ${item.employee_code ?? ''} ${item.department?.name ?? ''} ${item.job_title ?? ''}`.toLowerCase();
    return matchesRole && haystack.includes(query.toLowerCase());
  }), [query, roleFilter, users]);

  const tabs = [
    { id: 'users', label: 'Users Directory', icon: <Users size={16} /> },
    { id: 'departments', label: 'Departments', icon: <Building2 size={16} /> },
    { id: 'leave-types', label: 'Leave Types', icon: <SlidersHorizontal size={16} /> },
    { id: 'holidays', label: 'Public Holidays', icon: <CalendarDays size={16} /> },
    { id: 'balances', label: 'Balance Override', icon: <Shield size={16} /> },
    { id: 'reports', label: 'Reports & Logs', icon: <ClipboardList size={16} /> },
  ];

  return (
    <AppLayout>
      <div className="space-y-8 animate-fade-in">
        {/* Metric Statistics */}
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6">
          <Metric label="Active Users" value={stats.active_users} variant="emerald" />
          <Metric label="Inactive Users" value={stats.inactive_users} variant="slate" />
          <Metric label="Pending Requests" value={stats.pending_requests} variant="amber" />
          <Metric label="Approved Month" value={stats.approved_this_month} variant="teal" />
          <Metric label="Departments" value={stats.departments} variant="indigo" />
          <Metric label="Leave Types" value={stats.leave_types} variant="indigo" />
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 overflow-x-auto whitespace-nowrap scrollbar-none gap-2">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setQuery(''); }}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                  active
                    ? 'border-emerald-600 text-emerald-700 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Contents */}
        <div className="space-y-6">
          {activeTab === 'users' && (
            <div className="grid gap-8 lg:grid-cols-[1fr_310px] items-start">
              {/* Users list directory */}
              <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-50 pb-5 mb-5">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">User Directory</h3>
                    <p className="text-xs text-slate-400">View and manage staff accounts and roles</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
                      <input
                        className="w-44 rounded-xl border border-slate-200 py-1.5 pl-8 pr-3 text-xs bg-white"
                        placeholder="Search employees..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </div>
                    <select
                      className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs bg-white font-medium text-slate-600"
                      value={roleFilter}
                      onChange={(e) => setRoleFilter(e.target.value)}
                    >
                      {['all', 'staff', 'manager', 'hr', 'admin'].map((role) => (
                        <option key={role} value={role}>
                          {role.charAt(0).toUpperCase() + role.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Mobile Card List View */}
                <div className="divide-y divide-slate-100 sm:hidden -mx-6 -mb-6">
                  {filteredUsers.map((item) => (
                    <div key={item.id} className="p-4 space-y-3 bg-white">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="font-bold text-slate-900 text-xs">{item.name}</div>
                          <div className="text-xs text-slate-400 mt-0.5">{item.email}</div>
                        </div>
                        <Toggle active={Boolean(item.is_active)} onClick={() => router.patch(`/admin/users/${item.id}/status`, { is_active: !item.is_active }, { preserveScroll: true })} />
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                        <div>
                          <div className="text-xs text-slate-400 uppercase font-semibold">Code / Role</div>
                          <div className="font-medium mt-0.5 capitalize">{item.employee_code ?? 'No Code'} · {item.role}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-400 uppercase font-semibold">Department</div>
                          <div className="font-medium mt-0.5">{item.department?.name ?? '—'}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-400 uppercase font-semibold">Manager</div>
                          <div className="font-medium mt-0.5">{item.manager?.name ?? '—'}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-400 uppercase font-semibold">Leave stats</div>
                          <div className="font-medium mt-0.5 flex flex-wrap gap-x-1 text-xs">
                            <span className="text-amber-600">{item.pending_leave_requests_count ?? 0} pending</span>
                            <span className="text-slate-300">·</span>
                            <span className="text-emerald-600">{item.approved_leave_requests_count ?? 0} approved</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {filteredUsers.length === 0 && (
                    <div className="p-8 text-center text-xs text-slate-400">
                      No matching users found.
                    </div>
                  )}
                </div>

                {/* Desktop Table View */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                      <tr>
                        <th className="px-4 py-3">Employee</th>
                        <th className="px-4 py-3">Role</th>
                        <th className="px-4 py-3">Department</th>
                        <th className="px-4 py-3">Manager</th>
                        <th className="px-4 py-3">Leave stats</th>
                        <th className="px-4 py-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredUsers.map((item) => (
                        <tr key={item.id} className="transition-all hover:bg-slate-50/40">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-900">{item.name}</div>
                            <div className="text-xs text-slate-400 mt-0.5">{item.email} · {item.employee_code ?? 'No Code'}</div>
                          </td>
                          <td className="px-4 py-3 text-slate-600 font-medium capitalize">{item.role}</td>
                          <td className="px-4 py-3 text-slate-500">{item.department?.name ?? '—'}</td>
                          <td className="px-4 py-3 text-slate-500">{item.manager?.name ?? '—'}</td>
                          <td className="px-4 py-3 text-slate-600 font-medium">
                            <span className="text-amber-600">{item.pending_leave_requests_count ?? 0} pending</span>
                            <span className="mx-1">·</span>
                            <span className="text-emerald-600">{item.approved_leave_requests_count ?? 0} approved</span>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <Toggle active={Boolean(item.is_active)} onClick={() => router.patch(`/admin/users/${item.id}/status`, { is_active: !item.is_active }, { preserveScroll: true })} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Create User Account */}
              <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <UserPlus size={16} /> Create User Account
                </h3>
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    router.post('/admin/users', userForm, {
                      preserveScroll: true,
                      onSuccess: () => setUserForm({ name: '', email: '', password: 'password', role: 'staff', department_id: '', manager_id: '', employee_code: '', job_title: '', hire_date: '', two_factor_enabled: false })
                    });
                  }}
                >
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                    Full Name
                    <input className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Name" value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} required />
                  </label>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                    Email Address
                    <input className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" type="email" placeholder="Email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} required />
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                      Employee Code
                      <input className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="EMP-01" value={userForm.employee_code} onChange={(e) => setUserForm({ ...userForm, employee_code: e.target.value })} />
                    </label>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                      Job Title
                      <input className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Title" value={userForm.job_title} onChange={(e) => setUserForm({ ...userForm, job_title: e.target.value })} />
                    </label>
                  </div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                    Hire Date
                    <input className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" type="date" value={userForm.hire_date} onChange={(e) => setUserForm({ ...userForm, hire_date: e.target.value })} />
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                      Role
                      <select className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white" value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value as any })}>
                        <option>staff</option>
                        <option>manager</option>
                        <option>hr</option>
                        <option>admin</option>
                      </select>
                    </label>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                      Department
                      <select className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white" value={userForm.department_id} onChange={(e) => setUserForm({ ...userForm, department_id: e.target.value })}>
                        <option value="">None</option>
                        {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </label>
                  </div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                    Reporting Manager
                    <select className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white" value={userForm.manager_id} onChange={(e) => setUserForm({ ...userForm, manager_id: e.target.value })}>
                      <option value="">None</option>
                      {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </label>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                    Temporary Password
                    <input className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" type="password" placeholder="Password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} required />
                  </label>
                  <Check label="Require 2FA Authentication" checked={userForm.two_factor_enabled} onChange={(checked) => setUserForm({ ...userForm, two_factor_enabled: checked })} />
                  <Submit label="Create User Account" />
                </form>
              </section>
            </div>
          )}

          {activeTab === 'departments' && (
            <div className="grid gap-8 lg:grid-cols-[1fr_310px] items-start">
              {/* Departments List */}
              <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                <div className="border-b border-slate-50 pb-4 mb-4">
                  <h3 className="text-base font-bold text-slate-900">Departments Directory</h3>
                  <p className="text-xs text-slate-400">Active organizational groupings and management</p>
                </div>
                <DataList rows={departments.map((item) => ({
                  id: item.id,
                  title: `${item.code} · ${item.name}`,
                  meta: `${item.users_count ?? 0} active employees · Manager: ${item.manager?.name ?? 'Unassigned'}`,
                  active: item.is_active,
                  toggle: () => router.patch(`/admin/departments/${item.id}/status`, { is_active: !item.is_active }, { preserveScroll: true }),
                }))} />
              </section>

              {/* Add Department Form */}
              <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <Building2 size={16} /> Add Department
                </h3>
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    router.post('/admin/departments', departmentForm, {
                      preserveScroll: true,
                      onSuccess: () => setDepartmentForm({ name: '', code: '', manager_id: '' })
                    });
                  }}
                >
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                    Department Name
                    <input className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="e.g. Technology" value={departmentForm.name} onChange={(e) => setDepartmentForm({ ...departmentForm, name: e.target.value })} required />
                  </label>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                    Code Identifier
                    <input className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="e.g. TECH" value={departmentForm.code} onChange={(e) => setDepartmentForm({ ...departmentForm, code: e.target.value })} required />
                  </label>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                    Department Manager
                    <select className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white" value={departmentForm.manager_id} onChange={(e) => setDepartmentForm({ ...departmentForm, manager_id: e.target.value })}>
                      <option value="">No manager</option>
                      {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </label>
                  <Submit label="Create Department" />
                </form>
              </section>
            </div>
          )}

          {activeTab === 'leave-types' && (
            <div className="grid gap-8 lg:grid-cols-[1fr_310px] items-start">
              {/* Leave Types List */}
              <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                <div className="border-b border-slate-50 pb-4 mb-4">
                  <h3 className="text-base font-bold text-slate-900">Leave Policies</h3>
                  <p className="text-xs text-slate-400">Configured time-off types, limits, and rules</p>
                </div>
                <DataList rows={leaveTypes.map((item) => ({
                  id: item.id,
                  title: `${item.code} · ${item.name}`,
                  meta: `${formatDays(item.default_allowance_days)} days default · ${item.paid ? 'Paid' : 'Unpaid'} · ${item.requires_attachment ? 'Attachment required' : 'No attachment'} · ${item.balances_count ?? 0} active balances`,
                  active: item.is_active,
                  toggle: () => router.patch(`/admin/leave-types/${item.id}/status`, { is_active: !item.is_active }, { preserveScroll: true }),
                }))} />
              </section>

              {/* Add Leave Type Form */}
              <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <SlidersHorizontal size={16} /> Add Leave Type
                </h3>
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    router.post('/admin/leave-types', leaveTypeForm, {
                      preserveScroll: true,
                      onSuccess: () => setLeaveTypeForm({ name: '', code: '', default_allowance_days: 0, paid: true, requires_attachment: false, deducts_balance: true })
                    });
                  }}
                >
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                    Policy Name
                    <input className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="e.g. Maternity Leave" value={leaveTypeForm.name} onChange={(e) => setLeaveTypeForm({ ...leaveTypeForm, name: e.target.value })} required />
                  </label>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                    Code Identifier
                    <input className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="e.g. MAT" value={leaveTypeForm.code} onChange={(e) => setLeaveTypeForm({ ...leaveTypeForm, code: e.target.value })} required />
                  </label>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                    Default Allowance Days
                    <input className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" type="number" min="0" step="0.5" placeholder="12" value={leaveTypeForm.default_allowance_days} onChange={(e) => setLeaveTypeForm({ ...leaveTypeForm, default_allowance_days: Number(e.target.value) })} required />
                  </label>
                  <div className="flex flex-col gap-2 pt-2">
                    <Check label="Paid Leave" checked={leaveTypeForm.paid} onChange={(checked) => setLeaveTypeForm({ ...leaveTypeForm, paid: checked })} />
                    <Check label="Require Attachment Upload" checked={leaveTypeForm.requires_attachment} onChange={(checked) => setLeaveTypeForm({ ...leaveTypeForm, requires_attachment: checked })} />
                    <Check label="Deducts Balance Quota" checked={leaveTypeForm.deducts_balance} onChange={(checked) => setLeaveTypeForm({ ...leaveTypeForm, deducts_balance: checked })} />
                  </div>
                  <Submit label="Create Leave Type" />
                </form>
              </section>
            </div>
          )}

          {activeTab === 'holidays' && (
            <div className="grid gap-8 lg:grid-cols-[1fr_310px] items-start">
              {/* Holidays List */}
              <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                <div className="border-b border-slate-50 pb-4 mb-4">
                  <h3 className="text-base font-bold text-slate-900">Public Holidays</h3>
                  <p className="text-xs text-slate-400">Ignored dates for calculation of request working days</p>
                </div>
                <DataList rows={holidays.slice(0, 12).map((item) => ({
                  id: item.id,
                  title: `${formatDate(item.holiday_date)} · ${item.name}`,
                  meta: item.is_active ? 'Excluded from working-day calculations' : 'Currently ignored',
                  active: item.is_active,
                  toggle: () => router.patch(`/admin/holidays/${item.id}/status`, { is_active: !item.is_active }, { preserveScroll: true }),
                }))} />
              </section>

              {/* Add Holiday Form */}
              <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <CalendarDays size={16} /> Add Holiday
                </h3>
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    router.post('/admin/holidays', holidayForm, {
                      preserveScroll: true,
                      onSuccess: () => setHolidayForm({ name: '', holiday_date: '' })
                    });
                  }}
                >
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                    Holiday Date
                    <input className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" type="date" value={holidayForm.holiday_date} onChange={(e) => setHolidayForm({ ...holidayForm, holiday_date: e.target.value })} required />
                  </label>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                    Holiday Name
                    <input className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="e.g. New Year Day" value={holidayForm.name} onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })} required />
                  </label>
                  <Submit label="Add Public Holiday" />
                </form>
              </section>
            </div>
          )}

          {activeTab === 'balances' && (
            <div className="max-w-2xl mx-auto rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              <div className="border-b border-slate-50 pb-5 mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-700">
                  <Shield size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Balance Override</h3>
                  <p className="text-xs text-slate-400">Directly adjust or set quota values for specific staff members</p>
                </div>
              </div>
              
              <form
                className="space-y-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  router.post('/admin/balances', balanceForm, {
                    preserveScroll: true,
                    onSuccess: () => setBalanceForm({ user_id: '', leave_type_id: '', year: new Date().getFullYear(), allowance_days: 0, adjustment_days: 0, override_reason: '' })
                  });
                }}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                    Select Employee
                    <select className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm bg-white" value={balanceForm.user_id} onChange={(e) => setBalanceForm({ ...balanceForm, user_id: e.target.value })} required>
                      <option value="">Choose User</option>
                      {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </label>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                    Leave Type
                    <select className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm bg-white" value={balanceForm.leave_type_id} onChange={(e) => setBalanceForm({ ...balanceForm, leave_type_id: e.target.value })} required>
                      <option value="">Choose Type</option>
                      {leaveTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                    Calendar Year
                    <input className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" type="number" value={balanceForm.year} onChange={(e) => setBalanceForm({ ...balanceForm, year: Number(e.target.value) })} required />
                  </label>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                    Override Allowance (Days)
                    <input className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" type="number" step="0.5" placeholder="Quota" value={balanceForm.allowance_days} onChange={(e) => setBalanceForm({ ...balanceForm, allowance_days: Number(e.target.value) })} required />
                  </label>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                    Adjustment Override (Days)
                    <input className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" type="number" step="0.5" placeholder="Adjustment" value={balanceForm.adjustment_days} onChange={(e) => setBalanceForm({ ...balanceForm, adjustment_days: Number(e.target.value) })} />
                  </label>
                </div>

                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                  Override Reason & Audit Note
                  <input className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" placeholder="e.g. Rollover from previous year" value={balanceForm.override_reason} onChange={(e) => setBalanceForm({ ...balanceForm, override_reason: e.target.value })} required />
                </label>

                <div className="pt-2">
                  <Submit label="Apply Balance Override" />
                </div>
              </form>
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="space-y-6">
              {/* Reports links */}
              <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                <div className="border-b border-slate-50 pb-4 mb-4">
                  <h3 className="text-base font-bold text-slate-900">Download Reports</h3>
                  <p className="text-xs text-slate-400">Export csv formats of monthly staff leave records</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  {[0, 1, 2].map((offset) => {
                    const date = new Date();
                    date.setMonth(date.getMonth() - offset);
                    const month = date.toISOString().slice(0, 7);
                    return (
                      <a
                        key={month}
                        className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 transition-all"
                        href={`/reports/monthly?month=${month}`}
                      >
                        <Download size={14} /> {month} CSV Report
                      </a>
                    );
                  })}
                </div>
              </section>

              {/* Audit Trail list */}
              <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                <div className="border-b border-slate-50 pb-4 mb-4">
                  <h3 className="text-base font-bold text-slate-900">Audit Trail Logs</h3>
                  <p className="text-xs text-slate-400">History of administrative and policy changes</p>
                </div>
                <div className="divide-y divide-slate-100">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="grid gap-2 py-3.5 text-xs md:grid-cols-[1fr_200px_180px] hover:bg-slate-50/20 px-2 transition-all rounded-xl">
                      <span className="font-semibold text-slate-800">{log.action}</span>
                      <span className="text-slate-500 font-medium">{log.subject_type ?? 'System'} #{log.subject_id ?? '—'}</span>
                      <span className="text-slate-400 font-medium text-right">{new Date(log.created_at).toLocaleString()}</span>
                    </div>
                  ))}
                  {auditLogs.length === 0 && (
                    <p className="py-6 text-center text-xs text-slate-400">No logs registered yet.</p>
                  )}
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

function Metric({ label, value, variant }: { label: string; value: number; variant: 'emerald' | 'slate' | 'amber' | 'teal' | 'indigo' }) {
  const styles = {
    emerald: 'border-emerald-100 text-emerald-800 bg-emerald-50/20',
    slate: 'border-slate-200 text-slate-800 bg-slate-50/20',
    amber: 'border-amber-100 text-amber-800 bg-amber-50/20',
    teal: 'border-teal-100 text-teal-800 bg-teal-50/20',
    indigo: 'border-indigo-100 text-indigo-800 bg-indigo-50/20',
  };

  return (
    <div className={`rounded-2xl border ${styles[variant]} p-4 shadow-sm bg-white`}>
      <div className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</div>
      <div className="mt-2.5 text-xl font-bold tracking-tight text-slate-900">{value}</div>
    </div>
  );
}

function Submit({ label }: { label: string }) {
  return (
    <button className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 py-2.5 text-sm font-semibold text-white shadow-sm hover:from-emerald-700 hover:to-teal-600 transition-all">
      <Plus size={14} /> {label}
    </button>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 cursor-pointer bg-white transition-all hover:bg-slate-50">
      <input type="checkbox" className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function Toggle({ active, onClick }: { active: boolean; onClick: () => void }) {
  const Icon = active ? ToggleRight : ToggleLeft;
  return (
    <button
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold ${
        active
          ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
          : 'bg-slate-50 border-slate-200 text-slate-600'
      }`}
      onClick={onClick}
    >
      <Icon size={14} />
      <span>{active ? 'Active' : 'Inactive'}</span>
    </button>
  );
}

function DataList({ rows }: { rows: { id: number; title: string; meta: string; active: boolean; toggle: () => void }[] }) {
  return (
    <div className="divide-y divide-slate-100 text-sm">
      {rows.map((row) => (
        <div key={row.id} className="flex items-center justify-between gap-4 py-3.5 px-2 hover:bg-slate-50/20 rounded-xl transition-all">
          <div>
            <div className="font-bold text-slate-800">{row.title}</div>
            <div className="text-xs text-slate-400 mt-1">{row.meta}</div>
          </div>
          <Toggle active={row.active} onClick={row.toggle} />
        </div>
      ))}
    </div>
  );
}
