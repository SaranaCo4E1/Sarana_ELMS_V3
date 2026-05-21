import { router } from '@inertiajs/react';
import { Activity, Building2, CalendarDays, Download, Plus, Search, Shield, SlidersHorizontal, ToggleLeft, ToggleRight, UserPlus, Users } from 'lucide-react';
import type React from 'react';
import { useMemo, useState } from 'react';
import AppLayout from '../Layouts/AppLayout';
import type { LeaveType, User } from '../types';

type Department = { id: number; name: string; code: string; manager_id?: number; manager?: User; is_active: boolean; users_count?: number };
type Holiday = { id: number; name: string; holiday_date: string; is_active: boolean };
type AuditLog = { id: number; action: string; subject_type?: string | null; subject_id?: number | null; ip_address?: string | null; created_at: string };
type Stats = { active_users: number; inactive_users: number; pending_requests: number; approved_this_month: number; departments: number; leave_types: number };

export default function Admin({ departments, leaveTypes, holidays, users, auditLogs, stats }: { departments: Department[]; leaveTypes: LeaveType[]; holidays: Holiday[]; users: User[]; auditLogs: AuditLog[]; stats: Stats }) {
  const [department, setDepartment] = useState({ name: '', code: '', manager_id: '' });
  const [leaveType, setLeaveType] = useState({ name: '', code: '', default_allowance_days: 0, paid: true, requires_attachment: false, deducts_balance: true });
  const [holiday, setHoliday] = useState({ name: '', holiday_date: '' });
  const [user, setUser] = useState({ name: '', email: '', password: 'password', role: 'staff', department_id: '', manager_id: '', employee_code: '', job_title: '', hire_date: '', two_factor_enabled: false });
  const [balance, setBalance] = useState({ user_id: '', leave_type_id: '', year: new Date().getFullYear(), allowance_days: 0, adjustment_days: 0, override_reason: '' });
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const filteredUsers = useMemo(() => users.filter((item) => {
    const matchesRole = roleFilter === 'all' || item.role === roleFilter;
    const haystack = `${item.name} ${item.email} ${item.employee_code ?? ''} ${item.department?.name ?? ''} ${item.job_title ?? ''}`.toLowerCase();
    return matchesRole && haystack.includes(query.toLowerCase());
  }), [query, roleFilter, users]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          <Metric label="Active users" value={stats.active_users} />
          <Metric label="Inactive users" value={stats.inactive_users} />
          <Metric label="Pending requests" value={stats.pending_requests} />
          <Metric label="Approved month" value={stats.approved_this_month} />
          <Metric label="Departments" value={stats.departments} />
          <Metric label="Leave types" value={stats.leave_types} />
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Panel icon={<Building2 size={18} />} title="Departments">
            <form className="grid gap-3 md:grid-cols-4" onSubmit={(e) => { e.preventDefault(); router.post('/admin/departments', department, { preserveScroll: true }); }}>
              <input className="rounded-md border px-3 py-2 text-sm" placeholder="Name" value={department.name} onChange={(e) => setDepartment({ ...department, name: e.target.value })} />
              <input className="rounded-md border px-3 py-2 text-sm" placeholder="Code" value={department.code} onChange={(e) => setDepartment({ ...department, code: e.target.value })} />
              <select className="rounded-md border px-3 py-2 text-sm" value={department.manager_id} onChange={(e) => setDepartment({ ...department, manager_id: e.target.value })}><option value="">No manager</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
              <Submit label="Add" />
            </form>
            <DataList rows={departments.map((item) => ({
              id: item.id,
              title: `${item.code} · ${item.name}`,
              meta: `${item.users_count ?? 0} user(s) · Manager: ${item.manager?.name ?? 'Unassigned'}`,
              active: item.is_active,
              toggle: () => router.patch(`/admin/departments/${item.id}/status`, { is_active: !item.is_active }, { preserveScroll: true }),
            }))} />
          </Panel>

          <Panel icon={<SlidersHorizontal size={18} />} title="Leave Types">
            <form className="grid gap-3 md:grid-cols-3" onSubmit={(e) => { e.preventDefault(); router.post('/admin/leave-types', leaveType, { preserveScroll: true }); }}>
              <input className="rounded-md border px-3 py-2 text-sm" placeholder="Name" value={leaveType.name} onChange={(e) => setLeaveType({ ...leaveType, name: e.target.value })} />
              <input className="rounded-md border px-3 py-2 text-sm" placeholder="Code" value={leaveType.code} onChange={(e) => setLeaveType({ ...leaveType, code: e.target.value })} />
              <input className="rounded-md border px-3 py-2 text-sm" type="number" min="0" step="0.5" placeholder="Days" value={leaveType.default_allowance_days} onChange={(e) => setLeaveType({ ...leaveType, default_allowance_days: Number(e.target.value) })} />
              <Check label="Paid" checked={leaveType.paid} onChange={(checked) => setLeaveType({ ...leaveType, paid: checked })} />
              <Check label="Attachment" checked={leaveType.requires_attachment} onChange={(checked) => setLeaveType({ ...leaveType, requires_attachment: checked })} />
              <Check label="Deducts balance" checked={leaveType.deducts_balance} onChange={(checked) => setLeaveType({ ...leaveType, deducts_balance: checked })} />
              <Submit label="Add" />
            </form>
            <DataList rows={leaveTypes.map((item) => ({
              id: item.id,
              title: `${item.code} · ${item.name}`,
              meta: `${item.default_allowance_days} days · ${item.paid ? 'Paid' : 'Unpaid'} · ${item.requires_attachment ? 'Attachment required' : 'No attachment'} · ${item.balances_count ?? 0} balance(s)`,
              active: item.is_active,
              toggle: () => router.patch(`/admin/leave-types/${item.id}/status`, { is_active: !item.is_active }, { preserveScroll: true }),
            }))} />
          </Panel>

          <Panel icon={<CalendarDays size={18} />} title="Public Holidays">
            <form className="grid gap-3 md:grid-cols-3" onSubmit={(e) => { e.preventDefault(); router.post('/admin/holidays', holiday, { preserveScroll: true }); }}>
              <input className="rounded-md border px-3 py-2 text-sm" type="date" value={holiday.holiday_date} onChange={(e) => setHoliday({ ...holiday, holiday_date: e.target.value })} />
              <input className="rounded-md border px-3 py-2 text-sm" placeholder="Name" value={holiday.name} onChange={(e) => setHoliday({ ...holiday, name: e.target.value })} />
              <Submit label="Add" />
            </form>
            <DataList rows={holidays.slice(0, 12).map((item) => ({
              id: item.id,
              title: `${formatDate(item.holiday_date)} · ${item.name}`,
              meta: item.is_active ? 'Excluded from working-day calculations' : 'Currently ignored',
              active: item.is_active,
              toggle: () => router.patch(`/admin/holidays/${item.id}/status`, { is_active: !item.is_active }, { preserveScroll: true }),
            }))} />
          </Panel>

          <Panel icon={<UserPlus size={18} />} title="Create User Account">
            <form className="grid gap-3 md:grid-cols-3" onSubmit={(e) => { e.preventDefault(); router.post('/admin/users', user, { preserveScroll: true }); }}>
              <input className="rounded-md border px-3 py-2 text-sm" placeholder="Name" value={user.name} onChange={(e) => setUser({ ...user, name: e.target.value })} />
              <input className="rounded-md border px-3 py-2 text-sm" placeholder="Email" value={user.email} onChange={(e) => setUser({ ...user, email: e.target.value })} />
              <input className="rounded-md border px-3 py-2 text-sm" placeholder="Employee code" value={user.employee_code} onChange={(e) => setUser({ ...user, employee_code: e.target.value })} />
              <input className="rounded-md border px-3 py-2 text-sm" placeholder="Job title" value={user.job_title} onChange={(e) => setUser({ ...user, job_title: e.target.value })} />
              <input className="rounded-md border px-3 py-2 text-sm" type="date" value={user.hire_date} onChange={(e) => setUser({ ...user, hire_date: e.target.value })} />
              <select className="rounded-md border px-3 py-2 text-sm" value={user.role} onChange={(e) => setUser({ ...user, role: e.target.value })}><option>staff</option><option>manager</option><option>hr</option><option>admin</option></select>
              <select className="rounded-md border px-3 py-2 text-sm" value={user.department_id} onChange={(e) => setUser({ ...user, department_id: e.target.value })}><option value="">Department</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
              <select className="rounded-md border px-3 py-2 text-sm" value={user.manager_id} onChange={(e) => setUser({ ...user, manager_id: e.target.value })}><option value="">Manager</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
              <input className="rounded-md border px-3 py-2 text-sm" type="password" placeholder="Temporary password" value={user.password} onChange={(e) => setUser({ ...user, password: e.target.value })} />
              <Check label="2FA" checked={user.two_factor_enabled} onChange={(checked) => setUser({ ...user, two_factor_enabled: checked })} />
              <Submit label="Create" />
            </form>
          </Panel>

          <Panel icon={<Shield size={18} />} title="Balance Override">
            <form className="grid gap-3 md:grid-cols-3" onSubmit={(e) => { e.preventDefault(); router.post('/admin/balances', balance, { preserveScroll: true }); }}>
              <select className="rounded-md border px-3 py-2 text-sm" value={balance.user_id} onChange={(e) => setBalance({ ...balance, user_id: e.target.value })}><option value="">User</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
              <select className="rounded-md border px-3 py-2 text-sm" value={balance.leave_type_id} onChange={(e) => setBalance({ ...balance, leave_type_id: e.target.value })}><option value="">Leave type</option>{leaveTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
              <input className="rounded-md border px-3 py-2 text-sm" type="number" value={balance.year} onChange={(e) => setBalance({ ...balance, year: Number(e.target.value) })} />
              <input className="rounded-md border px-3 py-2 text-sm" type="number" step="0.5" placeholder="Allowance" value={balance.allowance_days} onChange={(e) => setBalance({ ...balance, allowance_days: Number(e.target.value) })} />
              <input className="rounded-md border px-3 py-2 text-sm" type="number" step="0.5" placeholder="Adjustment" value={balance.adjustment_days} onChange={(e) => setBalance({ ...balance, adjustment_days: Number(e.target.value) })} />
              <input className="rounded-md border px-3 py-2 text-sm" placeholder="Reason" value={balance.override_reason} onChange={(e) => setBalance({ ...balance, override_reason: e.target.value })} />
              <Submit label="Apply" />
            </form>
          </Panel>

          <Panel icon={<Download size={18} />} title="Reports">
            <div className="flex flex-wrap gap-2">
              {[0, 1, 2].map((offset) => {
                const date = new Date();
                date.setMonth(date.getMonth() - offset);
                const month = date.toISOString().slice(0, 7);
                return <a key={month} className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white" href={`/reports/monthly?month=${month}`}><Download size={16} /> {month} CSV</a>;
              })}
            </div>
          </Panel>
        </div>

        <Panel icon={<Users size={18} />} title="User Directory">
          <div className="mb-4 flex flex-wrap gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
              <input className="rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm" placeholder="Search users" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              {['all', 'staff', 'manager', 'hr', 'admin'].map((role) => <option key={role}>{role}</option>)}
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Name</th><th>Role</th><th>Department</th><th>Manager</th><th>Requests</th><th>Security</th><th>Status</th></tr></thead>
              <tbody>
                {filteredUsers.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="px-4 py-3"><div className="font-medium">{item.name}</div><div className="text-xs text-slate-500">{item.email} · {item.employee_code ?? 'No code'}</div></td>
                    <td>{item.role}</td>
                    <td>{item.department?.name ?? '-'}</td>
                    <td>{item.manager?.name ?? '-'}</td>
                    <td>{item.pending_leave_requests_count ?? 0} pending · {item.approved_leave_requests_count ?? 0} approved</td>
                    <td>{item.two_factor_enabled ? '2FA enabled' : 'Password only'}</td>
                    <td><Toggle active={Boolean(item.is_active)} onClick={() => router.patch(`/admin/users/${item.id}/status`, { is_active: !item.is_active }, { preserveScroll: true })} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel icon={<Activity size={18} />} title="Audit Trail">
          <div className="divide-y divide-slate-100">
            {auditLogs.map((log) => <div key={log.id} className="grid gap-2 py-3 text-sm md:grid-cols-[1fr_180px_160px]"><span className="font-medium">{log.action}</span><span className="text-slate-500">{log.subject_type ?? 'system'} #{log.subject_id ?? '-'}</span><span className="text-slate-500">{formatDateTime(log.created_at)}</span></div>)}
            {auditLogs.length === 0 && <p className="text-sm text-slate-500">No audit events yet.</p>}
          </div>
        </Panel>
      </div>
    </AppLayout>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-4 flex items-center gap-2 font-semibold">{icon}{title}</h2>{children}</section>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm"><div className="text-xs uppercase text-slate-500">{label}</div><div className="mt-2 text-2xl font-semibold text-slate-950">{value}</div></div>;
}

function Submit({ label }: { label: string }) {
  return <button className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white"><Plus size={16} /> {label}</button>;
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> {label}</label>;
}

function Toggle({ active, onClick }: { active: boolean; onClick: () => void }) {
  const Icon = active ? ToggleRight : ToggleLeft;
  return <button className={`inline-flex items-center gap-2 rounded-md px-2 py-1 text-xs ${active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`} onClick={onClick}><Icon size={18} /> {active ? 'Active' : 'Inactive'}</button>;
}

function DataList({ rows }: { rows: { id: number; title: string; meta: string; active: boolean; toggle: () => void }[] }) {
  return <div className="mt-4 divide-y divide-slate-100 text-sm">{rows.map((row) => <div key={row.id} className="flex items-start justify-between gap-3 py-3"><div><div className="font-medium text-slate-700">{row.title}</div><div className="text-xs text-slate-500">{row.meta}</div></div><Toggle active={row.active} onClick={row.toggle} /></div>)}</div>;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
