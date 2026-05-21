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
        <div className="flex border-b border-neutral-200/60 overflow-x-auto whitespace-nowrap scrollbar-none gap-2">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setQuery(''); }}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                  active
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-neutral-500 hover:text-neutral-850 font-medium'
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
              <section className="rounded-2xl border border-neutral-200/50 bg-white p-6 shadow-premium-sm overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-100 pb-5 mb-5">
                  <div>
                    <h3 className="text-base font-semibold text-neutral-850">User Directory</h3>
                    <p className="text-xs text-neutral-500 font-medium mt-0.5">View and manage staff accounts and roles</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-3 text-neutral-400" size={14} />
                      <input
                        className="w-48 rounded-xl border border-neutral-200 py-2 pl-8 pr-3 text-xs bg-white font-medium text-neutral-800 placeholder-neutral-400 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/5 transition-all shadow-premium-sm"
                        placeholder="Search employees..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </div>
                    <select
                      className="rounded-xl border border-neutral-200 px-3.5 py-2 text-xs bg-white font-semibold text-neutral-700 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/5 transition-all shadow-premium-sm"
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
                <div className="divide-y divide-neutral-100 sm:hidden -mx-6 -mb-6">
                  {filteredUsers.map((item) => (
                    <div key={item.id} className="p-5 space-y-4 bg-white hover:bg-neutral-50/30 transition-all">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="font-semibold text-neutral-850 text-xs">{item.name}</div>
                          <div className="text-[11px] text-neutral-450 mt-0.5 font-medium">{item.email}</div>
                        </div>
                        <Toggle active={Boolean(item.is_active)} onClick={() => router.patch(`/admin/users/${item.id}/status`, { is_active: !item.is_active }, { preserveScroll: true })} />
                      </div>

                      <div className="grid grid-cols-2 gap-3.5 text-xs text-neutral-700">
                        <div>
                          <div className="text-[9px] font-semibold uppercase tracking-widest text-neutral-450">Code / Role</div>
                          <div className="font-medium mt-1.5 capitalize">{item.employee_code ?? 'No Code'} · {item.role}</div>
                        </div>
                        <div>
                          <div className="text-[9px] font-semibold uppercase tracking-widest text-neutral-450">Department</div>
                          <div className="font-medium mt-1.5">{item.department?.name ?? '—'}</div>
                        </div>
                        <div>
                          <div className="text-[9px] font-semibold uppercase tracking-widest text-neutral-450">Manager</div>
                          <div className="font-medium mt-1.5">{item.manager?.name ?? '—'}</div>
                        </div>
                        <div>
                          <div className="text-[9px] font-semibold uppercase tracking-widest text-neutral-450">Leave stats</div>
                          <div className="font-medium mt-1.5 flex flex-wrap gap-x-1.5 text-xs">
                            <span className="text-amber-600 font-semibold">{item.pending_leave_requests_count ?? 0} pending</span>
                            <span className="text-neutral-300">·</span>
                            <span className="text-emerald-600 font-semibold">{item.approved_leave_requests_count ?? 0} approved</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {filteredUsers.length === 0 && (
                    <div className="p-8 text-center text-xs text-neutral-450 font-semibold">
                      No matching users found.
                    </div>
                  )}
                </div>

                {/* Desktop Table View */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-neutral-50/50 text-[10px] font-semibold uppercase tracking-widest text-neutral-450 border-b border-neutral-200/60">
                      <tr>
                        <th className="px-4 py-4">Employee</th>
                        <th className="px-4 py-4">Role</th>
                        <th className="px-4 py-4">Department</th>
                        <th className="px-4 py-4">Manager</th>
                        <th className="px-4 py-4">Leave stats</th>
                        <th className="px-4 py-4 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {filteredUsers.map((item) => (
                        <tr key={item.id} className="transition-all hover:bg-neutral-50/50">
                          <td className="px-4 py-4">
                            <div className="font-semibold text-neutral-850">{item.name}</div>
                            <div className="text-xs text-neutral-500 font-medium mt-0.5">{item.email} · {item.employee_code ?? 'No Code'}</div>
                          </td>
                          <td className="px-4 py-4 text-neutral-700 font-semibold capitalize">{item.role}</td>
                          <td className="px-4 py-4 text-neutral-500 font-medium">{item.department?.name ?? '—'}</td>
                          <td className="px-4 py-4 text-neutral-500 font-medium">{item.manager?.name ?? '—'}</td>
                          <td className="px-4 py-4 text-neutral-700 font-semibold text-xs">
                            <span className="text-amber-600">{item.pending_leave_requests_count ?? 0} pending</span>
                            <span className="mx-1.5 text-neutral-300">·</span>
                            <span className="text-emerald-600">{item.approved_leave_requests_count ?? 0} approved</span>
                          </td>
                          <td className="px-4 py-4 text-right whitespace-nowrap">
                            <Toggle active={Boolean(item.is_active)} onClick={() => router.patch(`/admin/users/${item.id}/status`, { is_active: !item.is_active }, { preserveScroll: true })} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Create User Account */}
              <section className="rounded-2xl border border-neutral-200/50 bg-white p-5 shadow-premium-sm">
                <h3 className="mb-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-neutral-450">
                  <UserPlus size={15} className="text-emerald-600" /> Create User Account
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
                  <label className="block text-[10px] font-semibold uppercase tracking-widest text-neutral-450">
                    Full Name
                    <input className="mt-1.5 w-full rounded-xl border border-neutral-200/70 bg-white px-3.5 py-2.5 text-xs text-neutral-850 placeholder-neutral-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/5 shadow-premium-sm transition-all outline-none font-medium" placeholder="Name" value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} required />
                  </label>
                  <label className="block text-[10px] font-semibold uppercase tracking-widest text-neutral-450">
                    Email Address
                    <input className="mt-1.5 w-full rounded-xl border border-neutral-200/70 bg-white px-3.5 py-2.5 text-xs text-neutral-850 placeholder-neutral-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/5 shadow-premium-sm transition-all outline-none font-medium" type="email" placeholder="Email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} required />
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <label className="block text-[10px] font-semibold uppercase tracking-widest text-neutral-450">
                      Employee Code
                      <input className="mt-1.5 w-full rounded-xl border border-neutral-200/70 bg-white px-3.5 py-2.5 text-xs text-neutral-850 placeholder-neutral-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/5 shadow-premium-sm transition-all outline-none font-medium" placeholder="EMP-01" value={userForm.employee_code} onChange={(e) => setUserForm({ ...userForm, employee_code: e.target.value })} />
                    </label>
                    <label className="block text-[10px] font-semibold uppercase tracking-widest text-neutral-450">
                      Job Title
                      <input className="mt-1.5 w-full rounded-xl border border-neutral-200/70 bg-white px-3.5 py-2.5 text-xs text-neutral-850 placeholder-neutral-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/5 shadow-premium-sm transition-all outline-none font-medium" placeholder="Title" value={userForm.job_title} onChange={(e) => setUserForm({ ...userForm, job_title: e.target.value })} />
                    </label>
                  </div>
                  <label className="block text-[10px] font-semibold uppercase tracking-widest text-neutral-450">
                    Hire Date
                    <input className="mt-1.5 w-full rounded-xl border border-neutral-200/70 bg-white px-3.5 py-2.5 text-xs text-neutral-850 placeholder-neutral-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/5 shadow-premium-sm transition-all outline-none font-medium text-neutral-500" type="date" value={userForm.hire_date} onChange={(e) => setUserForm({ ...userForm, hire_date: e.target.value })} />
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <label className="block text-[10px] font-semibold uppercase tracking-widest text-neutral-450">
                      Role
                      <select className="mt-1.5 w-full rounded-xl border border-neutral-200/70 bg-white px-3.5 py-2.5 text-xs text-neutral-850 placeholder-neutral-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/5 shadow-premium-sm transition-all outline-none font-medium cursor-pointer" value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value as any })}>
                        <option>staff</option>
                        <option>manager</option>
                        <option>hr</option>
                        <option>admin</option>
                      </select>
                    </label>
                    <label className="block text-[10px] font-semibold uppercase tracking-widest text-neutral-450">
                      Department
                      <select className="mt-1.5 w-full rounded-xl border border-neutral-200/70 bg-white px-3.5 py-2.5 text-xs text-neutral-850 placeholder-neutral-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/5 shadow-premium-sm transition-all outline-none font-medium cursor-pointer" value={userForm.department_id} onChange={(e) => setUserForm({ ...userForm, department_id: e.target.value })}>
                        <option value="">None</option>
                        {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </label>
                  </div>
                  <label className="block text-[10px] font-semibold uppercase tracking-widest text-neutral-450">
                    Reporting Manager
                    <select className="mt-1.5 w-full rounded-xl border border-neutral-200/70 bg-white px-3.5 py-2.5 text-xs text-neutral-850 placeholder-neutral-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/5 shadow-premium-sm transition-all outline-none font-medium cursor-pointer" value={userForm.manager_id} onChange={(e) => setUserForm({ ...userForm, manager_id: e.target.value })}>
                      <option value="">None</option>
                      {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </label>
                  <label className="block text-[10px] font-semibold uppercase tracking-widest text-neutral-450">
                    Temporary Password
                    <input className="mt-1.5 w-full rounded-xl border border-neutral-200/70 bg-white px-3.5 py-2.5 text-xs text-neutral-850 placeholder-neutral-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/5 shadow-premium-sm transition-all outline-none font-medium" type="password" placeholder="Password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} required />
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
              <section className="rounded-2xl border border-neutral-200/50 bg-white p-6 shadow-premium-sm">
                <div className="border-b border-neutral-100 pb-4 mb-4">
                  <h3 className="text-base font-semibold text-neutral-850">Departments Directory</h3>
                  <p className="text-xs text-neutral-500 font-medium mt-0.5">Active organizational groupings and management</p>
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
              <section className="rounded-2xl border border-neutral-200/50 bg-white p-5 shadow-premium-sm">
                <h3 className="mb-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-neutral-450">
                  <Building2 size={15} className="text-emerald-600" /> Add Department
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
                  <label className="block text-[10px] font-semibold uppercase tracking-widest text-neutral-450">
                    Department Name
                    <input className="mt-1.5 w-full rounded-xl border border-neutral-200/70 bg-white px-3.5 py-2.5 text-xs text-neutral-850 placeholder-neutral-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/5 shadow-premium-sm transition-all outline-none font-medium" placeholder="e.g. Technology" value={departmentForm.name} onChange={(e) => setDepartmentForm({ ...departmentForm, name: e.target.value })} required />
                  </label>
                  <label className="block text-[10px] font-semibold uppercase tracking-widest text-neutral-450">
                    Code Identifier
                    <input className="mt-1.5 w-full rounded-xl border border-neutral-200/70 bg-white px-3.5 py-2.5 text-xs text-neutral-850 placeholder-neutral-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/5 shadow-premium-sm transition-all outline-none font-medium" placeholder="e.g. TECH" value={departmentForm.code} onChange={(e) => setDepartmentForm({ ...departmentForm, code: e.target.value })} required />
                  </label>
                  <label className="block text-[10px] font-semibold uppercase tracking-widest text-neutral-450">
                    Department Manager
                    <select className="mt-1.5 w-full rounded-xl border border-neutral-200/70 bg-white px-3.5 py-2.5 text-xs text-neutral-850 placeholder-neutral-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/5 shadow-premium-sm transition-all outline-none font-medium cursor-pointer" value={departmentForm.manager_id} onChange={(e) => setDepartmentForm({ ...departmentForm, manager_id: e.target.value })}>
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
              <section className="rounded-2xl border border-neutral-200/50 bg-white p-6 shadow-premium-sm">
                <div className="border-b border-neutral-100 pb-4 mb-4">
                  <h3 className="text-base font-semibold text-neutral-850">Leave Policies</h3>
                  <p className="text-xs text-neutral-500 font-medium mt-0.5">Configured time-off types, limits, and rules</p>
                </div>
                <DataList rows={leaveTypes.map((item) => ({
                  id: item.id,
                  title: `${item.code} · ${item.name}`,
                  meta: `${formatDays(item.default_allowance_days)} default · ${item.paid ? 'Paid' : 'Unpaid'} · ${item.requires_attachment ? 'Attachment required' : 'No attachment'} · ${item.balances_count ?? 0} active balances`,
                  active: item.is_active,
                  toggle: () => router.patch(`/admin/leave-types/${item.id}/status`, { is_active: !item.is_active }, { preserveScroll: true }),
                }))} />
              </section>

              {/* Add Leave Type Form */}
              <section className="rounded-2xl border border-neutral-200/50 bg-white p-5 shadow-premium-sm">
                <h3 className="mb-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-neutral-450">
                  <SlidersHorizontal size={15} className="text-emerald-600" /> Add Leave Type
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
                  <label className="block text-[10px] font-semibold uppercase tracking-widest text-neutral-450">
                    Policy Name
                    <input className="mt-1.5 w-full rounded-xl border border-neutral-200/70 bg-white px-3.5 py-2.5 text-xs text-neutral-850 placeholder-neutral-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/5 shadow-premium-sm transition-all outline-none font-medium" placeholder="e.g. Maternity Leave" value={leaveTypeForm.name} onChange={(e) => setLeaveTypeForm({ ...leaveTypeForm, name: e.target.value })} required />
                  </label>
                  <label className="block text-[10px] font-semibold uppercase tracking-widest text-neutral-450">
                    Code Identifier
                    <input className="mt-1.5 w-full rounded-xl border border-neutral-200/70 bg-white px-3.5 py-2.5 text-xs text-neutral-850 placeholder-neutral-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/5 shadow-premium-sm transition-all outline-none font-medium" placeholder="e.g. MAT" value={leaveTypeForm.code} onChange={(e) => setLeaveTypeForm({ ...leaveTypeForm, code: e.target.value })} required />
                  </label>
                  <label className="block text-[10px] font-semibold uppercase tracking-widest text-neutral-450">
                    Default Allowance Days
                    <input className="mt-1.5 w-full rounded-xl border border-neutral-200/70 bg-white px-3.5 py-2.5 text-xs text-neutral-850 placeholder-neutral-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/5 shadow-premium-sm transition-all outline-none font-medium" type="number" min="0" step="0.5" placeholder="12" value={leaveTypeForm.default_allowance_days} onChange={(e) => setLeaveTypeForm({ ...leaveTypeForm, default_allowance_days: Number(e.target.value) })} required />
                  </label>
                  <div className="flex flex-col gap-2.5 pt-2">
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
              <section className="rounded-2xl border border-neutral-200/50 bg-white p-6 shadow-premium-sm">
                <div className="border-b border-neutral-100 pb-4 mb-4">
                  <h3 className="text-base font-semibold text-neutral-850">Public Holidays</h3>
                  <p className="text-xs text-neutral-500 font-medium mt-0.5">Ignored dates for calculation of request working days</p>
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
              <section className="rounded-2xl border border-neutral-200/50 bg-white p-5 shadow-premium-sm">
                <h3 className="mb-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-neutral-450">
                  <CalendarDays size={15} className="text-emerald-600" /> Add Holiday
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
                  <label className="block text-[10px] font-semibold uppercase tracking-widest text-neutral-450">
                    Holiday Date
                    <input className="mt-1.5 w-full rounded-xl border border-neutral-200/70 bg-white px-3.5 py-2.5 text-xs text-neutral-850 placeholder-neutral-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/5 shadow-premium-sm transition-all outline-none font-medium text-neutral-500" type="date" value={holidayForm.holiday_date} onChange={(e) => setHolidayForm({ ...holidayForm, holiday_date: e.target.value })} required />
                  </label>
                  <label className="block text-[10px] font-semibold uppercase tracking-widest text-neutral-450">
                    Holiday Name
                    <input className="mt-1.5 w-full rounded-xl border border-neutral-200/70 bg-white px-3.5 py-2.5 text-xs text-neutral-850 placeholder-neutral-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/5 shadow-premium-sm transition-all outline-none font-medium" placeholder="e.g. New Year Day" value={holidayForm.name} onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })} required />
                  </label>
                  <Submit label="Add Public Holiday" />
                </form>
              </section>
            </div>
          )}

          {activeTab === 'balances' && (
            <div className="max-w-2xl mx-auto rounded-2xl border border-neutral-200/50 bg-white p-6 shadow-premium-sm">
              <div className="border-b border-neutral-100 pb-5 mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-50 text-neutral-500 border border-neutral-200 shadow-premium-sm">
                  <Shield size={18} className="text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-neutral-850">Balance Override</h3>
                  <p className="text-xs text-neutral-500 font-medium mt-0.5">Directly adjust or set quota values for specific staff members</p>
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
                  <label className="block text-[10px] font-semibold uppercase tracking-widest text-neutral-450">
                    Select Employee
                    <select className="mt-1.5 w-full rounded-xl border border-neutral-200/70 bg-white px-3.5 py-2.5 text-xs text-neutral-850 placeholder-neutral-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/5 shadow-premium-sm transition-all outline-none font-medium cursor-pointer" value={balanceForm.user_id} onChange={(e) => setBalanceForm({ ...balanceForm, user_id: e.target.value })} required>
                      <option value="">Choose User</option>
                      {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </label>
                  <label className="block text-[10px] font-semibold uppercase tracking-widest text-neutral-450">
                    Leave Type
                    <select className="mt-1.5 w-full rounded-xl border border-neutral-200/70 bg-white px-3.5 py-2.5 text-xs text-neutral-850 placeholder-neutral-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/5 shadow-premium-sm transition-all outline-none font-medium cursor-pointer" value={balanceForm.leave_type_id} onChange={(e) => setBalanceForm({ ...balanceForm, leave_type_id: e.target.value })} required>
                      <option value="">Choose Type</option>
                      {leaveTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <label className="block text-[10px] font-semibold uppercase tracking-widest text-neutral-450">
                    Calendar Year
                    <input className="mt-1.5 w-full rounded-xl border border-neutral-200/70 bg-white px-3.5 py-2.5 text-xs text-neutral-850 placeholder-neutral-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/5 shadow-premium-sm transition-all outline-none font-medium" type="number" value={balanceForm.year} onChange={(e) => setBalanceForm({ ...balanceForm, year: Number(e.target.value) })} required />
                  </label>
                  <label className="block text-[10px] font-semibold uppercase tracking-widest text-neutral-450">
                    Override Allowance (Days)
                    <input className="mt-1.5 w-full rounded-xl border border-neutral-200/70 bg-white px-3.5 py-2.5 text-xs text-neutral-850 placeholder-neutral-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/5 shadow-premium-sm transition-all outline-none font-medium" type="number" step="0.5" placeholder="Quota" value={balanceForm.allowance_days} onChange={(e) => setBalanceForm({ ...balanceForm, allowance_days: Number(e.target.value) })} required />
                  </label>
                  <label className="block text-[10px] font-semibold uppercase tracking-widest text-neutral-450">
                    Adjustment Override (Days)
                    <input className="mt-1.5 w-full rounded-xl border border-neutral-200/70 bg-white px-3.5 py-2.5 text-xs text-neutral-850 placeholder-neutral-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/5 shadow-premium-sm transition-all outline-none font-medium" type="number" step="0.5" placeholder="Adjustment" value={balanceForm.adjustment_days} onChange={(e) => setBalanceForm({ ...balanceForm, adjustment_days: Number(e.target.value) })} />
                  </label>
                </div>

                <label className="block text-[10px] font-semibold uppercase tracking-widest text-neutral-450">
                  Override Reason & Audit Note
                  <input className="mt-1.5 w-full rounded-xl border border-neutral-200/70 bg-white px-3.5 py-2.5 text-xs text-neutral-850 placeholder-neutral-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/5 shadow-premium-sm transition-all outline-none font-medium" placeholder="e.g. Rollover from previous year" value={balanceForm.override_reason} onChange={(e) => setBalanceForm({ ...balanceForm, override_reason: e.target.value })} required />
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
              <section className="rounded-2xl border border-neutral-200/50 bg-white p-6 shadow-premium-sm">
                <div className="border-b border-neutral-100 pb-4 mb-4">
                  <h3 className="text-base font-semibold text-neutral-850">Download Reports</h3>
                  <p className="text-xs text-neutral-500 font-medium mt-0.5">Export CSV formats of monthly staff leave records</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  {[0, 1, 2].map((offset) => {
                    const date = new Date();
                    date.setMonth(date.getMonth() - offset);
                    const month = date.toISOString().slice(0, 7);
                    return (
                      <a
                        key={month}
                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-white shadow-md shadow-emerald-600/10 hover:bg-emerald-700 transition-all cursor-pointer active:scale-98"
                        href={`/reports/monthly?month=${month}`}
                      >
                        <Download size={14} className="text-neutral-350" /> {month} CSV Report
                      </a>
                    );
                  })}
                </div>
              </section>

              {/* Audit Trail list */}
              <section className="rounded-2xl border border-neutral-200/50 bg-white p-6 shadow-premium-sm">
                <div className="border-b border-neutral-100 pb-4 mb-4">
                  <h3 className="text-base font-semibold text-neutral-850">Audit Trail Logs</h3>
                  <p className="text-xs text-neutral-500 font-medium mt-0.5">History of administrative and policy changes</p>
                </div>
                <div className="divide-y divide-neutral-100">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="grid gap-2 py-4 text-xs md:grid-cols-[1fr_200px_180px] hover:bg-neutral-50/50 px-3 transition-all rounded-xl">
                      <span className="font-semibold text-slate-800">{log.action}</span>
                      <span className="text-slate-500 font-medium">{log.subject_type ?? 'System'} #{log.subject_id ?? '—'}</span>
                      <span className="text-slate-400 font-medium text-right">{new Date(log.created_at).toLocaleString()}</span>
                    </div>
                  ))}
                  {auditLogs.length === 0 && (
                    <p className="py-6 text-center text-xs text-neutral-450 font-semibold">No logs registered yet.</p>
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
    emerald: 'bg-emerald-500/10 text-emerald-700',
    slate: 'bg-neutral-500/10 text-neutral-600',
    amber: 'bg-amber-500/10 text-amber-700',
    teal: 'bg-teal-500/10 text-teal-700',
    indigo: 'bg-indigo-500/10 text-indigo-700',
  };

  return (
    <div className="rounded-2xl border border-neutral-200/50 bg-white p-6 shadow-premium-sm">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-neutral-450">{label}</div>
      <div className="mt-3.5 flex items-baseline gap-2.5">
        <span className="text-3xl font-bold tracking-tight text-neutral-800">{value}</span>
        <span className={`inline-flex h-2 w-2 rounded-full ${styles[variant].split(' ')[0]}`}></span>
      </div>
    </div>
  );
}

function Submit({ label }: { label: string }) {
  return (
    <button className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-xs font-semibold uppercase tracking-wide text-white shadow-md shadow-emerald-600/10 hover:bg-emerald-700 active:scale-98 transition-all duration-200 cursor-pointer">
      <Plus size={14} className="text-neutral-350" /> {label}
    </button>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="inline-flex items-center gap-2 rounded-xl border border-neutral-200/70 bg-white px-4 py-3 text-xs font-semibold text-neutral-700 cursor-pointer transition-all hover:bg-neutral-50 shadow-premium-sm">
      <input type="checkbox" className="rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function Toggle({ active, onClick }: { active: boolean; onClick: () => void }) {
  const Icon = active ? ToggleRight : ToggleLeft;
  return (
    <button
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
        active
          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700'
          : 'bg-neutral-100 border-neutral-200 text-neutral-500 hover:text-neutral-750'
      }`}
      onClick={onClick}
      type="button"
    >
      <Icon size={14} />
      <span>{active ? 'Active' : 'Inactive'}</span>
    </button>
  );
}

function DataList({ rows }: { rows: { id: number; title: string; meta: string; active: boolean; toggle: () => void }[] }) {
  return (
    <div className="divide-y divide-neutral-100 text-sm">
      {rows.map((row) => (
        <div key={row.id} className="flex items-center justify-between gap-4 py-4 px-3 hover:bg-neutral-50/50 rounded-xl transition-all">
          <div>
            <div className="font-semibold text-neutral-850 text-sm">{row.title}</div>
            <div className="text-xs text-neutral-500 font-medium mt-1">{row.meta}</div>
          </div>
          <Toggle active={row.active} onClick={row.toggle} />
        </div>
      ))}
    </div>
  );
}
