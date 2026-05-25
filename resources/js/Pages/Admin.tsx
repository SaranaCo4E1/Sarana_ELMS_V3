import { router, usePage } from '@inertiajs/react';
import { AlertCircle, Building2, Calculator, CalendarDays, CheckCircle2, ClipboardList, Clock, Download, Edit3, Eye, EyeOff, Plus, Search, Shield, SlidersHorizontal, ToggleLeft, ToggleRight, UserPlus, Users, X } from 'lucide-react';
import type React from 'react';
import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import AppLayout from '../Layouts/AppLayout';
import type { LeaveType, PageProps, User } from '../types';
import { formatDays, formatDate, formatRole } from '../utils';

type Department = { id: number; name: string; code: string; manager_id?: number; manager?: User; is_active: boolean; users_count?: number };
type Holiday = { id: number; name: string; holiday_date: string; is_active: boolean };
type AuditLog = { id: number; action: string; subject_type?: string | null; subject_id?: number | null; ip_address?: string | null; created_at: string };
type Stats = { active_users: number; inactive_users: number; pending_requests: number; approved_this_month: number; departments: number; leave_types: number };
type AdminModal =
  | { type: 'user'; mode: 'create' | 'edit'; record?: User }
  | { type: 'department'; mode: 'create' | 'edit'; record?: Department }
  | { type: 'leaveType'; mode: 'create' | 'edit'; record?: LeaveType }
  | { type: 'holiday'; mode: 'create' | 'edit'; record?: Holiday };

const emptyDepartmentForm = { name: '', code: '', manager_id: '' };
const emptyLeaveTypeForm = { name: '', code: '', default_allowance_days: 0, paid: true, requires_attachment: false, deducts_balance: true };
const emptyHolidayForm = { name: '', holiday_date: '' };
const emptyUserForm = { name: '', email: '', password: 'password', role: 'staff', department_id: '', manager_id: '', employee_code: '', job_title: '', hire_date: '', two_factor_enabled: false };

export default function Admin({ departments, leaveTypes, holidays, users, auditLogs, stats }: { departments: Department[]; leaveTypes: LeaveType[]; holidays: Holiday[]; users: User[]; auditLogs: AuditLog[]; stats: Stats }) {
  const { errors } = usePage<PageProps>().props;
  const [activeTab, setActiveTab] = useState('users');
  const [modal, setModal] = useState<AdminModal | null>(null);
  const [isModalClosing, setIsModalClosing] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const [isConfirmClosing, setIsConfirmClosing] = useState(false);

  const currentMonthStr = useMemo(() => new Date().toISOString().slice(0, 7), []);
  const [exportType, setExportType] = useState<'leave' | 'audit'>('leave');
  const [startMonth, setStartMonth] = useState(currentMonthStr);
  const [endMonth, setEndMonth] = useState(currentMonthStr);

  const handleToggleUser = (user: User) => {
    const nextStatus = !user.is_active;
    setConfirmToggle({
      title: nextStatus ? 'Activate User' : 'Deactivate User',
      message: nextStatus
        ? `Are you sure you want to activate ${user.name}? They will be allowed to log in, apply for leave, and access their account.`
        : `Are you sure you want to deactivate ${user.name}? This will immediately revoke their access and they won't be able to log in or apply for leave.`,
      onConfirm: () => {
        router.patch(`/admin/users/${user.id}/status`, { is_active: nextStatus }, { preserveScroll: true });
      }
    });
  };

  const handleToggleDepartment = (department: Department) => {
    const nextStatus = !department.is_active;
    setConfirmToggle({
      title: nextStatus ? 'Activate Department' : 'Deactivate Department',
      message: nextStatus
        ? `Are you sure you want to activate the ${department.name} department?`
        : `Are you sure you want to deactivate the ${department.name} department? Employees in this department will still be active but the department grouping will be marked inactive.`,
      onConfirm: () => {
        router.patch(`/admin/departments/${department.id}/status`, { is_active: nextStatus }, { preserveScroll: true });
      }
    });
  };

  const handleToggleLeaveType = (leaveType: LeaveType) => {
    const nextStatus = !leaveType.is_active;
    setConfirmToggle({
      title: nextStatus ? 'Activate Leave Type' : 'Deactivate Leave Type',
      message: nextStatus
        ? `Are you sure you want to activate the leave policy: ${leaveType.name}? Employees will be able to apply for this leave type again.`
        : `Are you sure you want to deactivate the leave policy: ${leaveType.name}? Employees will no longer be able to submit new requests for this leave type.`,
      onConfirm: () => {
        router.patch(`/admin/leave-types/${leaveType.id}/status`, { is_active: nextStatus }, { preserveScroll: true });
      }
    });
  };

  const handleToggleHoliday = (holiday: Holiday) => {
    const nextStatus = !holiday.is_active;
    setConfirmToggle({
      title: nextStatus ? 'Activate Holiday' : 'Deactivate Holiday',
      message: nextStatus
        ? `Are you sure you want to activate the holiday: ${holiday.name}? This date will be excluded from working-day calculations.`
        : `Are you sure you want to deactivate the holiday: ${holiday.name}? This date will no longer be excluded from working-day calculations.`,
      onConfirm: () => {
        router.patch(`/admin/holidays/${holiday.id}/status`, { is_active: nextStatus }, { preserveScroll: true });
      }
    });
  };

  const [departmentForm, setDepartmentForm] = useState(emptyDepartmentForm);
  const [leaveTypeForm, setLeaveTypeForm] = useState(emptyLeaveTypeForm);
  const [holidayForm, setHolidayForm] = useState(emptyHolidayForm);
  const [userForm, setUserForm] = useState(emptyUserForm);
  const [balanceForm, setBalanceForm] = useState({ user_id: '', leave_type_id: '', year: new Date().getFullYear(), allowance_days: 0, adjustment_days: 0, override_reason: '' });

  const selectedUser = useMemo(() => {
    return users.find(u => String(u.id) === String(balanceForm.user_id));
  }, [balanceForm.user_id, users]);

  const selectedLeaveType = useMemo(() => {
    return leaveTypes.find(t => String(t.id) === String(balanceForm.leave_type_id));
  }, [balanceForm.leave_type_id, leaveTypes]);

  const currentBalance = useMemo(() => {
    if (!selectedUser || !selectedLeaveType) return null;
    return selectedUser.leaveBalances?.find(
      b => String(b.leave_type_id) === String(selectedLeaveType.id) && Number(b.year) === Number(balanceForm.year)
    ) || null;
  }, [selectedUser, selectedLeaveType, balanceForm.year]);

  const currentDetails = useMemo(() => {
    const defaultAllowance = selectedLeaveType ? Number(selectedLeaveType.default_allowance_days) : 0;
    
    if (currentBalance) {
      const allowance = Number(currentBalance.allowance_days);
      const carried = Number(currentBalance.carried_forward_days || 0);
      const adjustment = Number(currentBalance.adjustment_days || 0);
      const used = Number(currentBalance.used_days || 0);
      const pending = Number(currentBalance.pending_days || 0);
      const available = allowance + carried + adjustment - used - pending;
      
      return {
        allowance,
        carried,
        adjustment,
        used,
        pending,
        available,
        isCustomAllowance: allowance !== defaultAllowance,
        hasOverride: true
      };
    }
    
    return {
      allowance: defaultAllowance,
      carried: 0,
      adjustment: 0,
      used: 0,
      pending: 0,
      available: defaultAllowance,
      isCustomAllowance: false,
      hasOverride: false
    };
  }, [selectedLeaveType, currentBalance]);

  const projectedAvailable = useMemo(() => {
    const allowance = Number(balanceForm.allowance_days || 0);
    const adjustment = Number(balanceForm.adjustment_days || 0);
    const carried = currentDetails.carried;
    const used = currentDetails.used;
    const pending = currentDetails.pending;
    return allowance + carried + adjustment - used - pending;
  }, [balanceForm.allowance_days, balanceForm.adjustment_days, currentDetails]);

  const handleBalanceSelectionChange = (updates: Partial<typeof balanceForm>) => {
    const nextForm = { ...balanceForm, ...updates };
    
    const userId = nextForm.user_id;
    const leaveTypeId = nextForm.leave_type_id;
    const year = Number(nextForm.year);
    
    if (userId && leaveTypeId) {
      const u = users.find(user => String(user.id) === String(userId));
      const t = leaveTypes.find(type => String(type.id) === String(leaveTypeId));
      
      const balance = u?.leaveBalances?.find(
        b => String(b.leave_type_id) === String(leaveTypeId) && Number(b.year) === year
      );
      
      if (balance) {
        nextForm.allowance_days = Number(balance.allowance_days);
        nextForm.adjustment_days = Number(balance.adjustment_days);
        nextForm.override_reason = balance.override_reason ?? '';
      } else if (t) {
        nextForm.allowance_days = Number(t.default_allowance_days);
        nextForm.adjustment_days = 0;
        nextForm.override_reason = '';
      }
    }
    
    setBalanceForm(nextForm as typeof balanceForm);
  };

  const closeModal = () => {
    setIsModalClosing(true);
    setTimeout(() => {
      setModal(null);
      setIsModalClosing(false);
      setShowAdminPassword(false);
    }, 180);
  };

  const closeConfirm = () => {
    setIsConfirmClosing(true);
    setTimeout(() => {
      setConfirmToggle(null);
      setIsConfirmClosing(false);
    }, 180);
  };

  const openCreateModal = (type: AdminModal['type']) => {
    if (type === 'user') setUserForm(emptyUserForm);
    if (type === 'department') setDepartmentForm(emptyDepartmentForm);
    if (type === 'leaveType') setLeaveTypeForm(emptyLeaveTypeForm);
    if (type === 'holiday') setHolidayForm(emptyHolidayForm);
    setModal({ type, mode: 'create' } as AdminModal);
  };

  const openEditUser = (user: User) => {
    setUserForm({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      department_id: user.department?.id ? String(user.department.id) : '',
      manager_id: user.manager?.id ? String(user.manager.id) : '',
      employee_code: user.employee_code ?? '',
      job_title: user.job_title ?? '',
      hire_date: user.hire_date ?? '',
      two_factor_enabled: Boolean(user.two_factor_enabled),
    });
    setModal({ type: 'user', mode: 'edit', record: user });
  };

  const openEditDepartment = (department: Department) => {
    setDepartmentForm({
      name: department.name,
      code: department.code,
      manager_id: department.manager_id ? String(department.manager_id) : '',
    });
    setModal({ type: 'department', mode: 'edit', record: department });
  };

  const openEditLeaveType = (leaveType: LeaveType) => {
    setLeaveTypeForm({
      name: leaveType.name,
      code: leaveType.code,
      default_allowance_days: Number(leaveType.default_allowance_days),
      paid: leaveType.paid,
      requires_attachment: leaveType.requires_attachment,
      deducts_balance: leaveType.deducts_balance,
    });
    setModal({ type: 'leaveType', mode: 'edit', record: leaveType });
  };

  const openEditHoliday = (holiday: Holiday) => {
    setHolidayForm({
      name: holiday.name,
      holiday_date: holiday.holiday_date,
    });
    setModal({ type: 'holiday', mode: 'edit', record: holiday });
  };

  const submitModal = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!modal) return;

    const options = { preserveScroll: true, onSuccess: closeModal };

    if (modal.type === 'user') {
      if (modal.mode === 'edit' && modal.record) {
        router.patch(`/admin/users/${modal.record.id}`, userForm, options);
      } else {
        router.post('/admin/users', userForm, options);
      }
    }

    if (modal.type === 'department') {
      if (modal.mode === 'edit' && modal.record) {
        router.patch(`/admin/departments/${modal.record.id}`, departmentForm, options);
      } else {
        router.post('/admin/departments', departmentForm, options);
      }
    }

    if (modal.type === 'leaveType') {
      if (modal.mode === 'edit' && modal.record) {
        router.patch(`/admin/leave-types/${modal.record.id}`, leaveTypeForm, options);
      } else {
        router.post('/admin/leave-types', leaveTypeForm, options);
      }
    }

    if (modal.type === 'holiday') {
      if (modal.mode === 'edit' && modal.record) {
        router.patch(`/admin/holidays/${modal.record.id}`, holidayForm, options);
      } else {
        router.post('/admin/holidays', holidayForm, options);
      }
    }
  };

  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const filteredUsers = useMemo(() => users.filter((item) => {
    const matchesRole = roleFilter === 'all' || item.role === roleFilter;
    const haystack = `${item.name} ${item.email} ${item.employee_code ?? ''} ${item.department?.name ?? ''} ${item.job_title ?? ''}`.toLowerCase();
    return matchesRole && haystack.includes(query.toLowerCase());
  }), [query, roleFilter, users]);

  const reportingManagers = useMemo(() => users.filter((user) => ['manager', 'admin'].includes(user.role)), [users]);

  const tabs = [
    { id: 'users', label: 'Users', icon: <Users size={16} /> },
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
          <Metric label="Active Users" value={stats.active_users} variant="orange" />
          <Metric label="Inactive Users" value={stats.inactive_users} variant="slate" />
          <Metric label="Pending Requests" value={stats.pending_requests} variant="amber" />
          <Metric label="Approved Month" value={stats.approved_this_month} variant="green" />
          <Metric label="Departments" value={stats.departments} variant="indigo" />
          <Metric label="Leave Types" value={stats.leave_types} variant="indigo" />
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-neutral-200/60 overflow-x-auto whitespace-nowrap scrollbar-none gap-3">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setQuery(''); }}
                className={`flex items-center gap-2 px-4.5 py-4 text-sm font-medium uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                  active
                    ? 'border-orange-600 text-orange-700'
                    : 'border-transparent text-neutral-500 hover:text-neutral-800 font-medium'
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
            <div className="grid gap-8 items-start">
              {/* Users list directory */}
              <section className="rounded-xl border border-neutral-200/50 bg-white p-6 shadow-premium-sm overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-100 pb-5 mb-5">
                  <div>
                    <h3 className="text-base font-medium text-neutral-800">User Directory</h3>
                    <p className="text-sm text-neutral-500 font-medium mt-1">View and manage staff accounts and roles</p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <div className="relative">
                      <Search className="absolute left-3.5 top-3.5 text-neutral-400" size={14} />
                      <input
                        className="w-52 rounded-lg border border-neutral-200 py-2.5 pl-9 pr-3.5 text-sm bg-white font-medium text-neutral-800 placeholder-neutral-400 outline-none focus:border-orange-600 focus:ring-4 focus:ring-orange-500/5 transition-all shadow-premium-sm"
                        placeholder="Search employees..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </div>
                    <select
                      className="rounded-lg border border-neutral-200 px-4 py-2.5 text-sm bg-white font-medium text-neutral-700 outline-none focus:border-orange-600 focus:ring-4 focus:ring-orange-500/5 transition-all shadow-premium-sm"
                      value={roleFilter}
                      onChange={(e) => setRoleFilter(e.target.value)}
                    >
                      {['all', 'staff', 'manager', 'hr admin', 'admin'].map((role) => (
                        <option key={role} value={role}>
                          {role === 'all' ? 'All' : formatRole(role)}
                        </option>
                      ))}
                    </select>
                    <button
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-medium uppercase tracking-wide text-white shadow-md shadow-orange-600/10 hover:bg-orange-700 active:scale-98 transition-all cursor-pointer"
                      onClick={() => openCreateModal('user')}
                      type="button"
                    >
                      <UserPlus size={14} /> Add User
                    </button>
                  </div>
                </div>

                {/* Mobile Card List View */}
                <div className="divide-y divide-neutral-100 sm:hidden -mx-6 -mb-6">
                  {filteredUsers.map((item) => (
                    <div key={item.id} className="p-5 space-y-4 bg-white hover:bg-neutral-50/30 transition-all">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="font-medium text-neutral-800 text-sm">{item.name}</div>
                          <div className="text-xs text-neutral-400 mt-1 font-medium">{item.email}</div>
                        </div>
                        <Toggle active={Boolean(item.is_active)} onClick={() => handleToggleUser(item)} />
                      </div>
 
                      <div className="grid grid-cols-2 gap-3.5 text-sm text-neutral-700">
                        <div>
                          <div className="text-xs font-medium uppercase tracking-wider text-neutral-500">Code / Role</div>
                          <div className="font-medium mt-1.5">{item.employee_code ?? 'No Code'} · {formatRole(item.role)}</div>
                        </div>
                        <div>
                          <div className="text-xs font-medium uppercase tracking-wider text-neutral-500">Department</div>
                          <div className="font-medium mt-1.5">{item.department?.name ?? '—'}</div>
                        </div>
                        <div>
                          <div className="text-xs font-medium uppercase tracking-wider text-neutral-500">Manager</div>
                          <div className="font-medium mt-1.5">{item.manager?.name ?? '—'}</div>
                        </div>
                        <div>
                          <div className="text-xs font-medium uppercase tracking-wider text-neutral-500">Leave stats</div>
                          <div className="font-medium mt-1.5 flex flex-wrap gap-x-1.5 text-sm">
                            <span className="text-amber-600 font-medium">{item.pending_leave_requests_count ?? 0} pending</span>
                            <span className="text-neutral-300">·</span>
                            <span className="text-green-600 font-medium">{item.approved_leave_requests_count ?? 0} approved</span>
                          </div>
                        </div>
                      </div>
                      <button
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-200 px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-neutral-600 hover:border-orange-200 hover:text-orange-700 transition-all"
                        onClick={() => openEditUser(item)}
                        type="button"
                      >
                        <Edit3 size={13} /> Edit User
                      </button>
                    </div>
                  ))}
                  {filteredUsers.length === 0 && (
                    <div className="p-8 text-center text-xs text-neutral-400 font-semibold">
                      No matching users found.
                    </div>
                  )}
                </div>

                {/* Desktop Table View */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-neutral-50/50 text-xs font-medium uppercase tracking-wider text-neutral-500 border-b border-neutral-200/60">
                      <tr>
                        <th className="px-4 py-4.5">Employee</th>
                        <th className="px-4 py-4.5">Role</th>
                        <th className="px-4 py-4.5">Department</th>
                        <th className="px-4 py-4.5">Manager</th>
                        <th className="px-4 py-4.5">Leave stats</th>
                        <th className="px-4 py-4.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {filteredUsers.map((item) => (
                        <tr key={item.id} className="transition-all hover:bg-neutral-50/50">
                          <td className="px-4 py-4.5">
                            <div className="font-medium text-neutral-800">{item.name}</div>
                            <div className="text-sm text-neutral-500 font-medium mt-1">{item.email} · {item.employee_code ?? 'No Code'}</div>
                          </td>
                          <td className="px-4 py-4.5 text-neutral-700 font-medium">{formatRole(item.role)}</td>
                          <td className="px-4 py-4.5 text-neutral-500 font-medium">{item.department?.name ?? '—'}</td>
                          <td className="px-4 py-4.5 text-neutral-500 font-medium">{item.manager?.name ?? '—'}</td>
                          <td className="px-4 py-4.5 text-neutral-700 font-medium text-sm">
                            <span className="text-amber-600">{item.pending_leave_requests_count ?? 0} pending</span>
                            <span className="mx-1.5 text-neutral-300">·</span>
                            <span className="text-green-600">{item.approved_leave_requests_count ?? 0} approved</span>
                          </td>
                          <td className="px-4 py-4.5 text-right whitespace-nowrap">
                            <button
                              className="mr-2 inline-flex items-center gap-1.5 rounded-md border border-neutral-200 px-2 py-1 text-xs font-semibold uppercase tracking-wider text-neutral-600 hover:border-orange-200 hover:text-orange-700 transition-all"
                              onClick={() => openEditUser(item)}
                              type="button"
                            >
                              <Edit3 size={13} /> Edit
                            </button>
                            <Toggle active={Boolean(item.is_active)} onClick={() => handleToggleUser(item)} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'departments' && (
            <div className="grid gap-8 items-start">
              {/* Departments List */}
              <section className="rounded-xl border border-neutral-200/50 bg-white p-6 shadow-premium-sm">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-100 pb-4 mb-4">
                  <div>
                    <h3 className="text-base font-medium text-neutral-800">Departments Directory</h3>
                    <p className="text-sm text-neutral-500 font-medium mt-1">Active organizational groupings and management</p>
                  </div>
                  <button
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-medium uppercase tracking-wide text-white shadow-md shadow-orange-600/10 hover:bg-orange-700 active:scale-98 transition-all cursor-pointer"
                    onClick={() => openCreateModal('department')}
                    type="button"
                  >
                    <Plus size={14} /> Add Department
                  </button>
                </div>
                <DataList rows={departments.map((item) => ({
                  id: item.id,
                  title: `${item.code} · ${item.name}`,
                  meta: `${item.users_count ?? 0} active employees · Manager: ${item.manager?.name ?? 'Unassigned'}`,
                  active: item.is_active,
                  toggle: () => handleToggleDepartment(item),
                  edit: () => openEditDepartment(item),
                }))} />
              </section>
            </div>
          )}

          {activeTab === 'leave-types' && (
            <div className="grid gap-8 items-start">
              {/* Leave Types List */}
              <section className="rounded-xl border border-neutral-200/50 bg-white p-6 shadow-premium-sm">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-100 pb-4 mb-4">
                  <div>
                    <h3 className="text-base font-semibold text-neutral-800">Leave Policies</h3>
                    <p className="text-sm text-neutral-500 font-medium mt-1">Configured time-off types, limits, and rules</p>
                  </div>
                  <button
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-medium uppercase tracking-wide text-white shadow-md shadow-orange-600/10 hover:bg-orange-700 active:scale-98 transition-all cursor-pointer"
                    onClick={() => openCreateModal('leaveType')}
                    type="button"
                  >
                    <Plus size={14} /> Add Leave Type
                  </button>
                </div>
                <DataList rows={leaveTypes.map((item) => ({
                  id: item.id,
                  title: `${item.code} · ${item.name}`,
                  meta: `${formatDays(item.default_allowance_days)} default · ${item.paid ? 'Paid' : 'Unpaid'} · ${item.requires_attachment ? 'Attachment required' : 'No attachment'} · ${item.balances_count ?? 0} active balances`,
                  active: item.is_active,
                  toggle: () => handleToggleLeaveType(item),
                  edit: () => openEditLeaveType(item),
                }))} />
              </section>
            </div>
          )}

          {activeTab === 'holidays' && (
            <div className="grid gap-8 items-start">
              {/* Holidays List */}
              <section className="rounded-xl border border-neutral-200/50 bg-white p-6 shadow-premium-sm">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-100 pb-4 mb-4">
                  <div>
                    <h3 className="text-base font-medium text-neutral-800">Public Holidays</h3>
                    <p className="text-sm text-neutral-500 font-medium mt-1">Ignored dates for calculation of request working days</p>
                  </div>
                  <button
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-medium uppercase tracking-wide text-white shadow-md shadow-orange-600/10 hover:bg-orange-700 active:scale-98 transition-all cursor-pointer"
                    onClick={() => openCreateModal('holiday')}
                    type="button"
                  >
                    <Plus size={14} /> Add Holiday
                  </button>
                </div>
                <DataList rows={holidays.slice(0, 12).map((item) => ({
                  id: item.id,
                  title: `${formatDate(item.holiday_date)} · ${item.name}`,
                  meta: item.is_active ? 'Excluded from working-day calculations' : 'Currently ignored',
                  active: item.is_active,
                  toggle: () => handleToggleHoliday(item),
                  edit: () => openEditHoliday(item),
                }))} />
              </section>
            </div>
          )}

          {activeTab === 'balances' && (
            <div className="max-w-5xl mx-auto grid gap-8 lg:grid-cols-[1fr_380px] items-start animate-fade-in">
              <div className="rounded-xl border border-neutral-200/50 bg-white p-6 shadow-premium-sm">
                <div className="border-b border-neutral-100 pb-5 mb-5 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-50 text-neutral-500 border border-neutral-200 shadow-premium-sm">
                    <Shield size={18} className="text-orange-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-medium text-neutral-800">Balance Override</h3>
                    <p className="text-sm text-neutral-500 font-medium mt-1">Directly adjust or set quota values for specific staff members</p>
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
                    <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500">
                      Select Employee
                      <select 
                        className="mt-1.5 w-full rounded-lg border border-neutral-200/70 bg-white px-4 py-3 text-sm text-neutral-800 placeholder-neutral-400 focus:border-orange-600 focus:ring-4 focus:ring-orange-500/5 shadow-premium-sm transition-all outline-none font-medium cursor-pointer" 
                        value={balanceForm.user_id} 
                        onChange={(e) => handleBalanceSelectionChange({ user_id: e.target.value })} 
                        required
                      >
                        <option value="">Choose User</option>
                        {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                    </label>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500">
                      Leave Type
                      <select 
                        className="mt-1.5 w-full rounded-lg border border-neutral-200/70 bg-white px-4 py-3 text-sm text-neutral-800 placeholder-neutral-400 focus:border-orange-600 focus:ring-4 focus:ring-orange-500/5 shadow-premium-sm transition-all outline-none font-medium cursor-pointer" 
                        value={balanceForm.leave_type_id} 
                        onChange={(e) => handleBalanceSelectionChange({ leave_type_id: e.target.value })} 
                        required
                      >
                        <option value="">Choose Type</option>
                        {leaveTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500">
                      Calendar Year
                      <input 
                        className="mt-1.5 w-full rounded-lg border border-neutral-200/70 bg-white px-4 py-3 text-sm text-neutral-800 placeholder-neutral-400 focus:border-orange-600 focus:ring-4 focus:ring-orange-500/5 shadow-premium-sm transition-all outline-none font-medium" 
                        type="number" 
                        value={balanceForm.year} 
                        onChange={(e) => handleBalanceSelectionChange({ year: Number(e.target.value) })} 
                        required 
                      />
                    </label>

                    <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500">
                      Manual Balance Adjustment (Days)
                      <span className="block text-[10px] text-neutral-400 normal-case font-normal mt-0.5">Add (+) or subtract (-) days from quota</span>
                      <input 
                        className="mt-1 w-full rounded-lg border border-neutral-200/70 bg-white px-4 py-3 text-sm text-neutral-800 placeholder-neutral-400 focus:border-orange-600 focus:ring-4 focus:ring-orange-500/5 shadow-premium-sm transition-all outline-none font-medium" 
                        type="number" 
                        step="0.5" 
                        placeholder="e.g. +2.0 or -1.5" 
                        value={balanceForm.adjustment_days} 
                        onChange={(e) => setBalanceForm({ ...balanceForm, adjustment_days: Number(e.target.value) })} 
                      />
                    </label>
                  </div>

                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Override Reason & Audit Note
                    <input 
                      className="mt-1.5 w-full rounded-lg border border-neutral-200/70 bg-white px-4 py-3 text-sm text-neutral-800 placeholder-neutral-400 focus:border-orange-600 focus:ring-4 focus:ring-orange-500/5 shadow-premium-sm transition-all outline-none font-medium" 
                      placeholder="e.g. Rollover from previous year" 
                      value={balanceForm.override_reason} 
                      onChange={(e) => setBalanceForm({ ...balanceForm, override_reason: e.target.value })} 
                      required 
                    />
                  </label>

                  <div className="pt-2">
                    <Submit label="Apply Balance Override" />
                  </div>
                </form>
              </div>

              {/* Dynamic Context Card & Info Panel */}
              {selectedUser && selectedLeaveType ? (
                <div className="space-y-6">
                  <div className="rounded-xl border border-neutral-200/50 bg-white p-5 shadow-premium-sm space-y-5">
                    <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                        <Clock size={14} className="text-orange-600" /> Current Balance Status
                      </h4>
                      <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-0.5 text-2xs font-semibold uppercase tracking-wider text-neutral-600">
                        {balanceForm.year}
                      </span>
                    </div>

                    <div className="space-y-3.5">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-neutral-500 font-medium">Employee</span>
                        <span className="font-semibold text-neutral-800">{selectedUser.name}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-neutral-500 font-medium">Leave Policy</span>
                        <span className="font-semibold text-neutral-800">{selectedLeaveType.name}</span>
                      </div>

                      <div className="border-t border-dashed border-neutral-100 my-2 pt-3 space-y-2.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-neutral-500 font-medium">Base Annual Quota:</span>
                          <div className="flex items-center gap-1.5 font-semibold text-neutral-800">
                            <span>{currentDetails.allowance} days</span>
                            {currentDetails.isCustomAllowance ? (
                              <span className="inline-flex items-center rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 ring-1 ring-inset ring-amber-600/10">Overridden</span>
                            ) : (
                              <span className="inline-flex items-center rounded bg-neutral-50 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600 ring-1 ring-inset ring-neutral-500/10">Standard</span>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-neutral-500 font-medium">Carried Forward:</span>
                          <span className="font-semibold text-neutral-700">{currentDetails.carried} days</span>
                        </div>

                        <div className="flex justify-between items-center text-xs">
                          <span className="text-neutral-500 font-medium">Active Adjustment:</span>
                          <span className="font-semibold text-neutral-700">
                            {currentDetails.adjustment > 0 ? `+${currentDetails.adjustment}` : currentDetails.adjustment} days
                          </span>
                        </div>

                        <div className="flex justify-between items-center text-xs">
                          <span className="text-neutral-500 font-medium">Used / Taken:</span>
                          <span className="font-semibold text-neutral-700">{currentDetails.used} days</span>
                        </div>

                        <div className="flex justify-between items-center text-xs">
                          <span className="text-neutral-500 font-medium">Pending Approval:</span>
                          <span className="font-semibold text-neutral-700">{currentDetails.pending} days</span>
                        </div>
                      </div>

                      <div className="border-t border-neutral-100 pt-3 flex justify-between items-center">
                        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Current Available:</span>
                        <span className="text-base font-bold text-neutral-800 bg-neutral-50 px-2.5 py-1.5 rounded-lg border border-neutral-200">
                          {currentDetails.available} days
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Projection Visualizer */}
                  <div className="rounded-xl border border-orange-100 bg-orange-50/[0.04] p-5 shadow-premium-sm space-y-4 animate-fade-in">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-orange-850 flex items-center gap-1.5">
                      <Calculator size={14} className="text-orange-600" /> Real-time Projected Balance
                    </h4>

                    <div className="bg-white rounded-lg p-4 border border-orange-100/50 space-y-3 shadow-premium-xs">
                      <div className="text-2xs font-bold uppercase tracking-wider text-neutral-400">Formula Calculation</div>
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-neutral-600 font-semibold leading-relaxed">
                        <span className="bg-neutral-50 text-neutral-800 px-1.5 py-0.5 rounded border border-neutral-200" title="New Base Quota">
                          {balanceForm.allowance_days}
                        </span>
                        <span className="text-neutral-400 font-normal">+</span>
                        <span className="text-neutral-700" title="Carried Forward">
                          {currentDetails.carried}
                        </span>
                        <span className="text-neutral-400 font-normal">+</span>
                        <span className="bg-neutral-50 text-neutral-800 px-1.5 py-0.5 rounded border border-neutral-200" title="New Adjustment">
                          {balanceForm.adjustment_days >= 0 ? `+${balanceForm.adjustment_days}` : balanceForm.adjustment_days}
                        </span>
                        <span className="text-neutral-400 font-normal">-</span>
                        <span className="text-neutral-700" title="Used Days">
                          {currentDetails.used}
                        </span>
                        <span className="text-neutral-400 font-normal">-</span>
                        <span className="text-neutral-700" title="Pending Days">
                          {currentDetails.pending}
                        </span>
                      </div>

                      <div className="border-t border-dashed border-neutral-100 pt-3.5 flex justify-between items-center">
                        <span className="text-xs font-semibold text-neutral-600">Projected Available Balance:</span>
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500/10 px-3 py-1.5 text-sm font-bold text-orange-700 border border-orange-500/10 transition-all duration-200">
                          <CheckCircle2 size={14} className="text-orange-600" />
                          {projectedAvailable} days
                        </span>
                      </div>
                    </div>

                    <div className="text-2xs text-neutral-400 font-medium leading-relaxed flex gap-2">
                      <AlertCircle size={14} className="text-neutral-400 shrink-0 mt-0.5" />
                      <span>Saving this override will commit this balance breakdown as the official audit record for {balanceForm.year}.</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-neutral-200/80 bg-neutral-50/50 p-8 text-center text-sm text-neutral-400 font-medium h-[280px] flex flex-col items-center justify-center space-y-3.5 shadow-premium-xs">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-neutral-300 border border-neutral-200 shadow-premium-sm">
                    <Shield size={22} className="text-neutral-400" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1">Select Context</h4>
                    <p className="max-w-[240px] text-xs text-neutral-400 leading-relaxed font-semibold">Choose an employee and leave type to view active balance status and real-time projections.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="space-y-6 animate-fade-in">
              {/* Reports links */}
              <section className="rounded-xl border border-neutral-200/50 bg-white p-6 shadow-premium-sm">
                <div className="border-b border-neutral-100 pb-5 mb-5 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-50 border border-neutral-200 shadow-premium-sm">
                    <Download size={18} className="text-orange-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-neutral-800">Export Center</h3>
                    <p className="text-sm text-neutral-500 font-medium mt-1">Export filtered records and logs within your specified date range</p>
                  </div>
                </div>

                {/* Exporter Form */}
                <div className="grid gap-6">
                  {/* Segmented Selector for Export Type */}
                  <div className="space-y-2">
                    <span className="block text-xs font-bold uppercase tracking-wider text-neutral-500">Select Export Type</span>
                    <div className="flex gap-2 p-1 bg-neutral-100/80 rounded-lg max-w-md border border-neutral-200/40">
                      <button
                        type="button"
                        onClick={() => setExportType('leave')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold uppercase tracking-wider rounded-md transition-all cursor-pointer ${
                          exportType === 'leave'
                            ? 'bg-white text-orange-700 shadow-premium-sm'
                            : 'text-neutral-500 hover:text-neutral-800'
                        }`}
                      >
                        <ClipboardList size={14} />
                        Leave Requests
                      </button>
                      <button
                        type="button"
                        onClick={() => setExportType('audit')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold uppercase tracking-wider rounded-md transition-all cursor-pointer ${
                          exportType === 'audit'
                            ? 'bg-white text-orange-700 shadow-premium-sm'
                            : 'text-neutral-500 hover:text-neutral-800'
                        }`}
                      >
                        <Shield size={14} />
                        Audit Trail Logs
                      </button>
                    </div>
                  </div>

                  {/* Range Selectors */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500">
                      Start Month
                      <input
                        type="month"
                        value={startMonth}
                        onChange={(e) => setStartMonth(e.target.value)}
                        className="mt-1.5 w-full rounded-lg border border-neutral-200/70 bg-white px-4 py-3 text-sm text-neutral-800 placeholder-neutral-400 focus:border-orange-600 focus:ring-4 focus:ring-orange-500/5 shadow-premium-sm transition-all outline-none font-medium cursor-pointer"
                      />
                    </label>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500">
                      End Month
                      <input
                        type="month"
                        value={endMonth}
                        onChange={(e) => setEndMonth(e.target.value)}
                        className="mt-1.5 w-full rounded-lg border border-neutral-200/70 bg-white px-4 py-3 text-sm text-neutral-800 placeholder-neutral-400 focus:border-orange-600 focus:ring-4 focus:ring-orange-500/5 shadow-premium-sm transition-all outline-none font-medium cursor-pointer"
                      />
                    </label>
                  </div>

                  {/* Validation and Action Button */}
                  <div className="pt-2 flex flex-col gap-3">
                    {startMonth > endMonth && (
                      <p className="text-xs font-semibold text-red-600 flex items-center gap-1.5 bg-red-50 p-3 rounded-lg border border-red-100">
                        <AlertCircle size={14} className="shrink-0" />
                        Start month cannot be after end month. Please select a valid date range.
                      </p>
                    )}

                    <div className="flex">
                      {startMonth > endMonth ? (
                        <button
                          type="button"
                          disabled
                          className="inline-flex items-center justify-center gap-2 rounded-lg bg-neutral-100 border border-neutral-200 px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-neutral-400 cursor-not-allowed w-full sm:w-auto"
                        >
                          <Download size={14} /> Export CSV Report
                        </button>
                      ) : (
                        <a
                          href={
                            exportType === 'leave'
                              ? `/reports/monthly?start_month=${startMonth}&end_month=${endMonth}`
                              : `/reports/audit-logs?start_month=${startMonth}&end_month=${endMonth}`
                          }
                          className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-white shadow-md shadow-orange-600/10 hover:bg-orange-700 active:scale-98 transition-all cursor-pointer w-full sm:w-auto text-center"
                        >
                          <Download size={14} /> Export CSV Report
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Quick Exports Section */}
                <div className="border-t border-neutral-100 mt-8 pt-6">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-4">Quick Single-Month Exports</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h5 className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-2.5 flex items-center gap-1.5">
                        <ClipboardList size={13} className="text-neutral-400" /> Recent Leave Reports
                      </h5>
                      <div className="flex flex-wrap gap-2">
                        {[0, 1, 2].map((offset) => {
                          const date = new Date();
                          date.setMonth(date.getMonth() - offset);
                          const month = date.toISOString().slice(0, 7);
                          return (
                            <a
                              key={`leave-${month}`}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-600 hover:border-orange-200 hover:text-orange-700 transition-all cursor-pointer"
                              href={`/reports/monthly?month=${month}`}
                            >
                              <Download size={12} /> {month}
                            </a>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <h5 className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-2.5 flex items-center gap-1.5">
                        <Shield size={13} className="text-neutral-400" /> Recent Audit Logs
                      </h5>
                      <div className="flex flex-wrap gap-2">
                        {[0, 1, 2].map((offset) => {
                          const date = new Date();
                          date.setMonth(date.getMonth() - offset);
                          const month = date.toISOString().slice(0, 7);
                          return (
                            <a
                              key={`audit-${month}`}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-600 hover:border-orange-200 hover:text-orange-700 transition-all cursor-pointer"
                              href={`/reports/audit-logs?month=${month}`}
                            >
                              <Download size={12} /> {month}
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Audit Trail list */}
              <section className="rounded-xl border border-neutral-200/50 bg-white p-6 shadow-premium-sm">
                <div className="border-b border-neutral-100 pb-4 mb-4 flex items-center gap-2">
                  <Shield size={16} className="text-orange-600" />
                  <div>
                    <h3 className="text-base font-semibold text-neutral-800">Recent Audit Trail Logs</h3>
                    <p className="text-sm text-neutral-500 font-medium mt-1">Live timeline of administrative actions and policy adjustments</p>
                  </div>
                </div>
                <div className="divide-y divide-neutral-100">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="grid gap-2.5 py-4.5 text-sm md:grid-cols-[1fr_200px_180px] hover:bg-neutral-50/50 px-4 transition-all rounded-lg">
                      <span className="font-medium text-slate-800">{log.action}</span>
                      <span className="text-slate-500 font-medium">{log.subject_type ?? 'System'} #{log.subject_id ?? '—'}</span>
                      <span className="text-slate-400 font-medium text-right">{new Date(log.created_at).toLocaleString()}</span>
                    </div>
                  ))}
                  {auditLogs.length === 0 && (
                    <p className="py-8 text-center text-sm text-neutral-500 font-medium">No logs registered yet.</p>
                  )}
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
      {modal && typeof document !== 'undefined' && createPortal(
        <div 
          className={`fixed inset-0 z-50 flex items-center justify-center px-4 py-6 ${
            isModalClosing ? 'animate-backdrop-leave' : 'animate-backdrop-enter'
          }`}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeModal();
            }
          }}
        >
          <div className={`max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-neutral-200 bg-white shadow-2xl ${
            isModalClosing ? 'animate-modal-leave' : 'animate-modal-enter'
          }`}>
            <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-neutral-100 bg-white px-6 py-4">
              <div>
                <h3 className="text-base font-semibold text-neutral-800">
                  {modal.mode === 'edit' ? 'Edit' : 'Add'} {modal.type === 'leaveType' ? 'Leave Type' : modal.type.charAt(0).toUpperCase() + modal.type.slice(1)}
                </h3>
                <p className="mt-1 text-sm font-medium text-neutral-500">Changes are saved to the HR admin directory.</p>
              </div>
              <button
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 transition-all hover:border-orange-200 hover:text-orange-700"
                onClick={closeModal}
                type="button"
              >
                <X size={16} />
              </button>
            </div>

            <form className="space-y-4.5 p-6" onSubmit={submitModal}>
              {modal.type === 'user' && (
                <>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FieldError label="Full Name" error={errors.name}>
                      <input className="mt-1.5 w-full rounded-lg border border-neutral-200/70 bg-white px-4 py-3 text-sm font-medium text-neutral-800 outline-none transition-all placeholder-neutral-400 shadow-premium-sm focus:border-orange-600 focus:ring-4 focus:ring-orange-500/5" placeholder="Name" value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} required />
                    </FieldError>
                    <FieldError label="Email Address" error={errors.email}>
                      <input className="mt-1.5 w-full rounded-lg border border-neutral-200/70 bg-white px-4 py-3 text-sm font-medium text-neutral-800 outline-none transition-all placeholder-neutral-400 shadow-premium-sm focus:border-orange-600 focus:ring-4 focus:ring-orange-500/5" type="email" placeholder="Email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} required />
                    </FieldError>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FieldError label="Employee Code" error={errors.employee_code}>
                      <input className="mt-1.5 w-full rounded-lg border border-neutral-200/70 bg-white px-4 py-3 text-sm font-medium text-neutral-800 outline-none transition-all placeholder-neutral-400 shadow-premium-sm focus:border-orange-600 focus:ring-4 focus:ring-orange-500/5" placeholder="EMP-01" value={userForm.employee_code} onChange={(e) => setUserForm({ ...userForm, employee_code: e.target.value })} />
                    </FieldError>
                    <FieldError label="Job Title" error={errors.job_title}>
                      <input className="mt-1.5 w-full rounded-lg border border-neutral-200/70 bg-white px-4 py-3 text-sm font-medium text-neutral-800 outline-none transition-all placeholder-neutral-400 shadow-premium-sm focus:border-orange-600 focus:ring-4 focus:ring-orange-500/5" placeholder="Title" value={userForm.job_title} onChange={(e) => setUserForm({ ...userForm, job_title: e.target.value })} />
                    </FieldError>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FieldError label="Role" error={errors.role}>
                      <select className="mt-1.5 w-full cursor-pointer rounded-lg border border-neutral-200/70 bg-white px-4 py-3 text-sm font-medium text-neutral-800 outline-none transition-all shadow-premium-sm focus:border-orange-600 focus:ring-4 focus:ring-orange-500/5" value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value as typeof userForm.role })}>
                        <option>staff</option>
                        <option>manager</option>
                        <option>hr admin</option>
                        <option>admin</option>
                      </select>
                    </FieldError>
                    <FieldError label="Hire Date" error={errors.hire_date}>
                      <input className="mt-1.5 w-full rounded-lg border border-neutral-200/70 bg-white px-4 py-3 text-sm font-medium text-neutral-500 outline-none transition-all placeholder-neutral-400 shadow-premium-sm focus:border-orange-600 focus:ring-4 focus:ring-orange-500/5" type="date" value={userForm.hire_date} onChange={(e) => setUserForm({ ...userForm, hire_date: e.target.value })} />
                    </FieldError>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FieldError label="Department" error={errors.department_id}>
                      <select className="mt-1.5 w-full cursor-pointer rounded-lg border border-neutral-200/70 bg-white px-4 py-3 text-sm font-medium text-neutral-800 outline-none transition-all shadow-premium-sm focus:border-orange-600 focus:ring-4 focus:ring-orange-500/5" value={userForm.department_id} onChange={(e) => setUserForm({ ...userForm, department_id: e.target.value })}>
                        <option value="">None</option>
                        {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </FieldError>
                    <FieldError label="Reporting Manager" error={errors.manager_id}>
                      <select className="mt-1.5 w-full cursor-pointer rounded-lg border border-neutral-200/70 bg-white px-4 py-3 text-sm font-medium text-neutral-800 outline-none transition-all shadow-premium-sm focus:border-orange-600 focus:ring-4 focus:ring-orange-500/5" value={userForm.manager_id} onChange={(e) => setUserForm({ ...userForm, manager_id: e.target.value })}>
                        <option value="">None</option>
                        {reportingManagers.filter((u) => modal.mode !== 'edit' || u.id !== modal.record?.id).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                    </FieldError>
                  </div>
                  <FieldError label={modal.mode === 'edit' ? 'New Password' : 'Temporary Password'} error={errors.password}>
                    <div className="relative mt-1.5">
                      <input 
                        className="w-full rounded-lg border border-neutral-200/70 bg-white pl-4 pr-11 py-3 text-sm font-medium text-neutral-800 outline-none transition-all placeholder-neutral-400 shadow-premium-sm focus:border-orange-600 focus:ring-4 focus:ring-orange-500/5" 
                        type={showAdminPassword ? "text" : "password"} 
                        placeholder={modal.mode === 'edit' ? 'Leave blank to keep current password' : 'Password'} 
                        value={userForm.password} 
                        onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} 
                        required={modal.mode === 'create'} 
                      />
                      <button
                        type="button"
                        onClick={() => setShowAdminPassword(!showAdminPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-neutral-400 hover:text-neutral-600 transition-colors focus:outline-none"
                      >
                        {showAdminPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </FieldError>
                  <Check label="Require 2FA Authentication" checked={userForm.two_factor_enabled} onChange={(checked) => setUserForm({ ...userForm, two_factor_enabled: checked })} />
                </>
              )}

              {modal.type === 'department' && (
                <>
                  <FieldError label="Department Name" error={errors.name}>
                    <input className="mt-1.5 w-full rounded-lg border border-neutral-200/70 bg-white px-4 py-3 text-sm font-medium text-neutral-800 outline-none transition-all placeholder-neutral-400 shadow-premium-sm focus:border-orange-600 focus:ring-4 focus:ring-orange-500/5" placeholder="e.g. Technology" value={departmentForm.name} onChange={(e) => setDepartmentForm({ ...departmentForm, name: e.target.value })} required />
                  </FieldError>
                  <FieldError label="Code Identifier" error={errors.code}>
                    <input className="mt-1.5 w-full rounded-lg border border-neutral-200/70 bg-white px-4 py-3 text-sm font-medium text-neutral-800 outline-none transition-all placeholder-neutral-400 shadow-premium-sm focus:border-orange-600 focus:ring-4 focus:ring-orange-500/5" placeholder="e.g. TECH" value={departmentForm.code} onChange={(e) => setDepartmentForm({ ...departmentForm, code: e.target.value })} required />
                  </FieldError>
                  <FieldError label="Department Manager" error={errors.manager_id}>
                    <select className="mt-1.5 w-full cursor-pointer rounded-lg border border-neutral-200/70 bg-white px-4 py-3 text-sm font-medium text-neutral-800 outline-none transition-all shadow-premium-sm focus:border-orange-600 focus:ring-4 focus:ring-orange-500/5" value={departmentForm.manager_id} onChange={(e) => setDepartmentForm({ ...departmentForm, manager_id: e.target.value })}>
                      <option value="">No manager</option>
                      {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </FieldError>
                </>
              )}

              {modal.type === 'leaveType' && (
                <>
                  <FieldError label="Policy Name" error={errors.name}>
                    <input className="mt-1.5 w-full rounded-lg border border-neutral-200/70 bg-white px-4 py-3 text-sm font-medium text-neutral-800 outline-none transition-all placeholder-neutral-400 shadow-premium-sm focus:border-orange-600 focus:ring-4 focus:ring-orange-500/5" placeholder="e.g. Maternity Leave" value={leaveTypeForm.name} onChange={(e) => setLeaveTypeForm({ ...leaveTypeForm, name: e.target.value })} required />
                  </FieldError>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FieldError label="Code Identifier" error={errors.code}>
                      <input className="mt-1.5 w-full rounded-lg border border-neutral-200/70 bg-white px-4 py-3 text-sm font-medium text-neutral-800 outline-none transition-all placeholder-neutral-400 shadow-premium-sm focus:border-orange-600 focus:ring-4 focus:ring-orange-500/5" placeholder="e.g. MAT" value={leaveTypeForm.code} onChange={(e) => setLeaveTypeForm({ ...leaveTypeForm, code: e.target.value })} required />
                    </FieldError>
                    <FieldError label="Default Allowance Days" error={errors.default_allowance_days}>
                      <input className="mt-1.5 w-full rounded-lg border border-neutral-200/70 bg-white px-4 py-3 text-sm font-medium text-neutral-800 outline-none transition-all placeholder-neutral-400 shadow-premium-sm focus:border-orange-600 focus:ring-4 focus:ring-orange-500/5" type="number" min="0" step="0.5" placeholder="12" value={leaveTypeForm.default_allowance_days} onChange={(e) => setLeaveTypeForm({ ...leaveTypeForm, default_allowance_days: Number(e.target.value) })} required />
                    </FieldError>
                  </div>
                  <div className="grid grid-cols-1 gap-2.5 pt-1 sm:grid-cols-3">
                    <Check label="Paid Leave" checked={leaveTypeForm.paid} onChange={(checked) => setLeaveTypeForm({ ...leaveTypeForm, paid: checked })} />
                    <Check label="Require Attachment" checked={leaveTypeForm.requires_attachment} onChange={(checked) => setLeaveTypeForm({ ...leaveTypeForm, requires_attachment: checked })} />
                    <Check label="Deducts Balance" checked={leaveTypeForm.deducts_balance} onChange={(checked) => setLeaveTypeForm({ ...leaveTypeForm, deducts_balance: checked })} />
                  </div>
                </>
              )}

              {modal.type === 'holiday' && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FieldError label="Holiday Date" error={errors.holiday_date}>
                    <input className="mt-1.5 w-full rounded-lg border border-neutral-200/70 bg-white px-4 py-3 text-sm font-medium text-neutral-500 outline-none transition-all placeholder-neutral-400 shadow-premium-sm focus:border-orange-600 focus:ring-4 focus:ring-orange-500/5" type="date" value={holidayForm.holiday_date} onChange={(e) => setHolidayForm({ ...holidayForm, holiday_date: e.target.value })} required />
                  </FieldError>
                  <FieldError label="Holiday Name" error={errors.name}>
                    <input className="mt-1.5 w-full rounded-lg border border-neutral-200/70 bg-white px-4 py-3 text-sm font-medium text-neutral-800 outline-none transition-all placeholder-neutral-400 shadow-premium-sm focus:border-orange-600 focus:ring-4 focus:ring-orange-500/5" placeholder="e.g. New Year Day" value={holidayForm.name} onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })} required />
                  </FieldError>
                </div>
              )}

              <div className="flex flex-wrap justify-end gap-3 border-t border-neutral-100 pt-5">
                <button className="inline-flex items-center justify-center rounded-lg border border-neutral-200 px-5 py-3 text-sm font-medium uppercase tracking-wide text-neutral-600 transition-all hover:bg-neutral-50" onClick={closeModal} type="button">
                  Cancel
                </button>
                <button className="inline-flex items-center justify-center gap-2.5 rounded-lg bg-orange-600 px-5 py-3 text-sm font-medium uppercase tracking-wide text-white shadow-md shadow-orange-600/10 transition-all hover:bg-orange-700 active:scale-98" type="submit">
                  <Plus size={14} /> {modal.mode === 'edit' ? 'Save Changes' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {confirmToggle && typeof document !== 'undefined' && createPortal(
        <div 
          className={`fixed inset-0 z-[60] flex items-center justify-center px-4 py-6 ${
            isConfirmClosing ? 'animate-backdrop-leave' : 'animate-backdrop-enter'
          }`}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeConfirm();
            }
          }}
        >
          <div className={`w-full max-w-md overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-2xl p-6 ${
            isConfirmClosing ? 'animate-modal-leave' : 'animate-modal-enter'
          }`}>
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-600 border border-orange-100">
                <AlertCircle size={20} />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-neutral-800">{confirmToggle.title}</h3>
                <p className="mt-2 text-sm text-neutral-500 font-medium leading-relaxed">{confirmToggle.message}</p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                className="inline-flex items-center justify-center rounded-lg border border-neutral-200 bg-white px-4.5 py-2.5 text-xs font-semibold uppercase tracking-wider text-neutral-600 transition-all hover:bg-neutral-50"
                onClick={closeConfirm}
                type="button"
              >
                Cancel
              </button>
              <button
                className="inline-flex items-center justify-center rounded-lg bg-orange-600 px-4.5 py-2.5 text-xs font-semibold uppercase tracking-wider text-white shadow-md shadow-orange-600/10 transition-all hover:bg-orange-700 active:scale-98"
                onClick={() => {
                  confirmToggle.onConfirm();
                  closeConfirm();
                }}
                type="button"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </AppLayout>
  );
}

function Metric({ label, value, variant }: { label: string; value: number; variant: 'orange' | 'slate' | 'amber' | 'indigo' | 'green' }) {
  const styles = {
    orange: 'bg-orange-500/10 text-orange-700',
    slate: 'bg-neutral-500/10 text-neutral-600',
    amber: 'bg-amber-500/10 text-amber-700',
    indigo: 'bg-indigo-500/10 text-indigo-700',
    green: 'bg-green-500/10 text-green-700',
  };

  return (
    <div className="rounded-xl border border-neutral-200/50 bg-white p-6 shadow-premium-sm">
      <div className="text-xs font-medium uppercase tracking-wider text-neutral-500">{label}</div>
      <div className="mt-3.5 flex items-baseline gap-2.5">
        <span className="text-3xl font-semibold tracking-tight text-neutral-800">{value}</span>
        <span className={`inline-flex h-2 w-2 rounded-full ${styles[variant].split(' ')[0]}`}></span>
      </div>
    </div>
  );
}

function Submit({ label }: { label: string }) {
  return (
    <button className="w-full inline-flex items-center justify-center gap-2.5 rounded-lg bg-orange-600 py-3.5 text-sm font-medium uppercase tracking-wide text-white shadow-md shadow-orange-600/10 hover:bg-orange-700 active:scale-98 transition-all duration-200 cursor-pointer">
      <Plus size={14} className="text-neutral-300" /> {label}
    </button>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="inline-flex items-center gap-2.5 rounded-lg border border-neutral-200/70 bg-white px-4.5 py-3.5 text-sm font-medium text-neutral-700 cursor-pointer transition-all hover:bg-neutral-50 shadow-premium-sm">
      <input type="checkbox" className="rounded border-neutral-300 text-orange-600 focus:ring-orange-500 cursor-pointer" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function FieldError({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium uppercase tracking-wider text-neutral-500">
      {label}
      {children}
      {error && <span className="mt-1.5 block text-xs font-semibold normal-case tracking-normal text-red-600">{error}</span>}
    </label>
  );
}

function Toggle({ active, onClick }: { active: boolean; onClick: () => void }) {
  const Icon = active ? ToggleRight : ToggleLeft;
  return (
    <button
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold uppercase tracking-wider transition-all duration-200 cursor-pointer outline-none ${
        active
          ? 'bg-orange-500/[0.04] border-orange-500/10 text-orange-700/90'
          : 'bg-neutral-500/[0.04] border-neutral-500/10 text-neutral-500 hover:text-neutral-700'
      }`}
      onClick={onClick}
      type="button"
    >
      <Icon size={14} />
      <span>{active ? 'Active' : 'Inactive'}</span>
    </button>
  );
}

function DataList({ rows }: { rows: { id: number; title: string; meta: string; active: boolean; toggle: () => void; edit?: () => void }[] }) {
  return (
    <div className="divide-y divide-neutral-100 text-sm">
      {rows.map((row) => (
        <div key={row.id} className="flex items-center justify-between gap-4 py-4.5 px-3 hover:bg-neutral-50/50 rounded-lg transition-all">
          <div className="min-w-0">
            <div className="font-medium text-neutral-800 text-sm">{row.title}</div>
            <div className="text-sm text-neutral-500 font-medium mt-1.5">{row.meta}</div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {row.edit && (
              <button
                className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 px-2 py-1 text-xs font-semibold uppercase tracking-wider text-neutral-600 transition-all hover:border-orange-200 hover:text-orange-700"
                onClick={row.edit}
                type="button"
              >
                <Edit3 size={13} /> Edit
              </button>
            )}
            <Toggle active={row.active} onClick={row.toggle} />
          </div>
        </div>
      ))}
    </div>
  );
}
