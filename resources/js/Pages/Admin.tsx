import { router } from '@inertiajs/react';
import { Building2, CalendarDays, Download, Plus, SlidersHorizontal, UserPlus } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import AppLayout from '../Layouts/AppLayout';
import type { LeaveType, User } from '../types';

type Department = { id: number; name: string; code: string; manager_id?: number };
type Holiday = { id: number; name: string; holiday_date: string };

export default function Admin({ departments, leaveTypes, holidays, users }: { departments: Department[]; leaveTypes: LeaveType[]; holidays: Holiday[]; users: User[] }) {
  const [department, setDepartment] = useState({ name: '', code: '', manager_id: '' });
  const [leaveType, setLeaveType] = useState({ name: '', code: '', default_allowance_days: 0, paid: true, requires_attachment: false, deducts_balance: true });
  const [holiday, setHoliday] = useState({ name: '', holiday_date: '' });
  const [user, setUser] = useState({ name: '', email: '', password: 'password', role: 'staff', department_id: '', manager_id: '', employee_code: '', job_title: '', hire_date: '', two_factor_enabled: false });
  const [balance, setBalance] = useState({ user_id: '', leave_type_id: '', year: new Date().getFullYear(), allowance_days: 0, adjustment_days: 0, override_reason: '' });

  return (
    <AppLayout>
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel icon={<Building2 size={18} />} title="Departments">
          <form className="grid gap-3 md:grid-cols-4" onSubmit={(e) => { e.preventDefault(); router.post('/admin/departments', department); }}>
            <input className="rounded-md border px-3 py-2 text-sm" placeholder="Name" value={department.name} onChange={(e) => setDepartment({ ...department, name: e.target.value })} />
            <input className="rounded-md border px-3 py-2 text-sm" placeholder="Code" value={department.code} onChange={(e) => setDepartment({ ...department, code: e.target.value })} />
            <select className="rounded-md border px-3 py-2 text-sm" value={department.manager_id} onChange={(e) => setDepartment({ ...department, manager_id: e.target.value })}><option value="">No manager</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
            <Submit />
          </form>
          <List items={departments.map((d) => `${d.code} · ${d.name}`)} />
        </Panel>

        <Panel icon={<SlidersHorizontal size={18} />} title="Leave Types">
          <form className="grid gap-3 md:grid-cols-3" onSubmit={(e) => { e.preventDefault(); router.post('/admin/leave-types', leaveType); }}>
            <input className="rounded-md border px-3 py-2 text-sm" placeholder="Name" value={leaveType.name} onChange={(e) => setLeaveType({ ...leaveType, name: e.target.value })} />
            <input className="rounded-md border px-3 py-2 text-sm" placeholder="Code" value={leaveType.code} onChange={(e) => setLeaveType({ ...leaveType, code: e.target.value })} />
            <input className="rounded-md border px-3 py-2 text-sm" type="number" placeholder="Days" value={leaveType.default_allowance_days} onChange={(e) => setLeaveType({ ...leaveType, default_allowance_days: Number(e.target.value) })} />
            <label className="text-sm"><input type="checkbox" checked={leaveType.paid} onChange={(e) => setLeaveType({ ...leaveType, paid: e.target.checked })} /> Paid</label>
            <label className="text-sm"><input type="checkbox" checked={leaveType.requires_attachment} onChange={(e) => setLeaveType({ ...leaveType, requires_attachment: e.target.checked })} /> Attachment</label>
            <Submit />
          </form>
          <List items={leaveTypes.map((t) => `${t.code} · ${t.name} · ${t.default_allowance_days} days`)} />
        </Panel>

        <Panel icon={<CalendarDays size={18} />} title="Public Holidays">
          <form className="grid gap-3 md:grid-cols-3" onSubmit={(e) => { e.preventDefault(); router.post('/admin/holidays', holiday); }}>
            <input className="rounded-md border px-3 py-2 text-sm" type="date" value={holiday.holiday_date} onChange={(e) => setHoliday({ ...holiday, holiday_date: e.target.value })} />
            <input className="rounded-md border px-3 py-2 text-sm" placeholder="Name" value={holiday.name} onChange={(e) => setHoliday({ ...holiday, name: e.target.value })} />
            <Submit />
          </form>
          <List items={holidays.slice(0, 8).map((h) => `${h.holiday_date} · ${h.name}`)} />
        </Panel>

        <Panel icon={<UserPlus size={18} />} title="User Accounts">
          <form className="grid gap-3 md:grid-cols-3" onSubmit={(e) => { e.preventDefault(); router.post('/admin/users', user); }}>
            <input className="rounded-md border px-3 py-2 text-sm" placeholder="Name" value={user.name} onChange={(e) => setUser({ ...user, name: e.target.value })} />
            <input className="rounded-md border px-3 py-2 text-sm" placeholder="Email" value={user.email} onChange={(e) => setUser({ ...user, email: e.target.value })} />
            <select className="rounded-md border px-3 py-2 text-sm" value={user.role} onChange={(e) => setUser({ ...user, role: e.target.value })}><option>staff</option><option>manager</option><option>hr</option><option>admin</option></select>
            <select className="rounded-md border px-3 py-2 text-sm" value={user.department_id} onChange={(e) => setUser({ ...user, department_id: e.target.value })}><option value="">Department</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
            <select className="rounded-md border px-3 py-2 text-sm" value={user.manager_id} onChange={(e) => setUser({ ...user, manager_id: e.target.value })}><option value="">Manager</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
            <Submit />
          </form>
          <List items={users.slice(0, 8).map((u) => `${u.name} · ${u.role}`)} />
        </Panel>

        <Panel icon={<SlidersHorizontal size={18} />} title="Balance Override">
          <form className="grid gap-3 md:grid-cols-3" onSubmit={(e) => { e.preventDefault(); router.post('/admin/balances', balance); }}>
            <select className="rounded-md border px-3 py-2 text-sm" value={balance.user_id} onChange={(e) => setBalance({ ...balance, user_id: e.target.value })}><option value="">User</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
            <select className="rounded-md border px-3 py-2 text-sm" value={balance.leave_type_id} onChange={(e) => setBalance({ ...balance, leave_type_id: e.target.value })}><option value="">Leave type</option>{leaveTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
            <input className="rounded-md border px-3 py-2 text-sm" type="number" value={balance.year} onChange={(e) => setBalance({ ...balance, year: Number(e.target.value) })} />
            <input className="rounded-md border px-3 py-2 text-sm" type="number" placeholder="Allowance" value={balance.allowance_days} onChange={(e) => setBalance({ ...balance, allowance_days: Number(e.target.value) })} />
            <input className="rounded-md border px-3 py-2 text-sm" type="number" placeholder="Adjustment" value={balance.adjustment_days} onChange={(e) => setBalance({ ...balance, adjustment_days: Number(e.target.value) })} />
            <input className="rounded-md border px-3 py-2 text-sm" placeholder="Reason" value={balance.override_reason} onChange={(e) => setBalance({ ...balance, override_reason: e.target.value })} />
            <Submit />
          </form>
        </Panel>

        <Panel icon={<Download size={18} />} title="Reports">
          <a className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white" href={`/reports/monthly?month=${new Date().toISOString().slice(0, 7)}`}><Download size={16} /> Download monthly attendance CSV</a>
        </Panel>
      </div>
    </AppLayout>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-4 flex items-center gap-2 font-semibold">{icon}{title}</h2>{children}</section>;
}

function Submit() {
  return <button className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white"><Plus size={16} /> Add</button>;
}

function List({ items }: { items: string[] }) {
  return <div className="mt-4 divide-y divide-slate-100 text-sm">{items.map((item) => <div key={item} className="py-2 text-slate-600">{item}</div>)}</div>;
}
