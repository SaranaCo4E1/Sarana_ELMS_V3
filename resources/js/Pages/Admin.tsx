import { router, usePage } from '@inertiajs/react';
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  Check,
  Copy,
  Download,
  EllipsisVertical,
  Key,
  Pencil,
  Plus,
  Save,
  Scale,
  SlidersHorizontal,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import type React from 'react';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import DatePicker from '../Components/DatePicker';
import Select from '../Components/Select';
import AppLayout from '../Layouts/AppLayout';
import type { LeaveType, PageProps, User } from '../types';

/* ------------------------------------------------------------------ */
/*  Confirm Dialog Context                                             */
/* ------------------------------------------------------------------ */

type ConfirmState = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
};

const ConfirmCtx = createContext<(opts: Omit<ConfirmState, 'open'>) => void>(() => {});

function useConfirm() {
  return useContext(ConfirmCtx);
}

function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ConfirmState>({ open: false, title: '', message: '', confirmLabel: 'Delete', onConfirm: () => {} });

  const ask = useCallback((opts: Omit<ConfirmState, 'open'>) => {
    setState({ ...opts, open: true });
  }, []);

  function close() {
    setState((s) => ({ ...s, open: false }));
  }

  return (
    <ConfirmCtx.Provider value={ask}>
      {children}
      {state.open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={close} />
          <div className="relative w-full max-w-sm animate-[scaleIn_0.15s_ease-out] rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                <AlertTriangle size={22} />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-slate-900">{state.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{state.message}</p>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button type="button" className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50" onClick={close}>
                Cancel
              </button>
              <button type="button" className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700" onClick={() => { state.onConfirm(); close(); }}>
                {state.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmCtx.Provider>
  );
}

/* ------------------------------------------------------------------ */
/*  Form Modal                                                         */
/* ------------------------------------------------------------------ */

function FormModal({
  open,
  onClose,
  title,
  editing,
  onSubmit,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  editing: boolean;
  onSubmit: (e: React.FormEvent) => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg animate-[scaleIn_0.15s_ease-out] rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h3 className="text-base font-semibold text-slate-900">{editing ? `Edit ${title}` : `Add ${title}`}</h3>
          <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
            {children}
          </div>
          <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
            <button type="button" className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className={`inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-colors ${
                editing ? 'bg-sky-600 hover:bg-sky-700' : 'bg-emerald-700 hover:bg-emerald-800'
              }`}
            >
              {editing ? <><Save size={16} /> Update</> : <><Plus size={16} /> Add</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Types & Constants                                                  */
/* ------------------------------------------------------------------ */

type Department = { id: number; name: string; code: string; manager_id?: number };
type Holiday = { id: number; name: string; holiday_date: string };
type Balance = {
  id: number;
  user_id: number;
  leave_type_id: number;
  year: number;
  allowance_days: string;
  carried_forward_days: string;
  used_days: string;
  pending_days: string;
  adjustment_days: string;
  available_days: number;
  override_reason?: string | null;
  user?: User & { department?: { id: number; name: string } | null };
  leave_type?: LeaveType;
};
type AdminTab = 'departments' | 'leave-types' | 'holidays' | 'users' | 'balances';

const TABS: { id: AdminTab; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: 'departments', label: 'Departments', icon: Building2 },
  { id: 'leave-types', label: 'Leave Types', icon: SlidersHorizontal },
  { id: 'holidays', label: 'Holidays', icon: CalendarDays },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'balances', label: 'Balances', icon: Scale },
];

const ROLE_STYLE: Record<string, string> = {
  staff: 'bg-slate-100 text-slate-600',
  manager: 'bg-sky-100 text-sky-700',
  hr: 'bg-purple-100 text-purple-700',
  admin: 'bg-amber-100 text-amber-800',
};

const INPUT =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500';

function formatDate(raw: string): string {
  const str = raw.slice(0, 10);
  const d = new Date(str + 'T00:00:00');
  return isNaN(d.getTime()) ? raw : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function Admin({
  departments,
  leaveTypes,
  holidays,
  users,
  balances,
}: {
  departments: Department[];
  leaveTypes: LeaveType[];
  holidays: Holiday[];
  users: User[];
  balances: Balance[];
}) {
  const initialTab = (() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('tab');
    return TABS.some((tb) => tb.id === t) ? (t as AdminTab) : 'departments';
  })();
  const [tab, setTab] = useState<AdminTab>(initialTab);

  function switchTab(id: AdminTab) {
    setTab(id);
    const url = new URL(window.location.href);
    if (id === 'departments') {
      url.searchParams.delete('tab');
    } else {
      url.searchParams.set('tab', id);
    }
    window.history.replaceState({}, '', url.pathname + url.search);
  }

  const counts: Record<AdminTab, number> = {
    departments: departments.length,
    'leave-types': leaveTypes.length,
    holidays: holidays.length,
    users: users.length,
    balances: balances.length,
  };

  return (
    <AppLayout>
    <ConfirmProvider>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">HR Administration</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Manage organization structure, leave policies, and employee accounts
          </p>
        </div>
        <a
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
          href={`/reports/monthly?month=${new Date().toISOString().slice(0, 7)}`}
        >
          <Download size={15} /> Monthly Report
        </a>
      </div>

      <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm transition-colors ${
              tab === id ? 'bg-white font-medium text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
            onClick={() => switchTab(id)}
          >
            <Icon size={16} />
            {label}
            {counts[id] > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-medium leading-none ${tab === id ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200/80 text-slate-500'}`}>
                {counts[id]}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'departments' && <DepartmentsSection departments={departments} users={users} />}
      {tab === 'leave-types' && <LeaveTypesSection leaveTypes={leaveTypes} />}
      {tab === 'holidays' && <HolidaysSection holidays={holidays} />}
      {tab === 'users' && <UsersSection users={users} departments={departments} />}
      {tab === 'balances' && <BalancesSection balances={balances} users={users} leaveTypes={leaveTypes} />}
    </ConfirmProvider>
    </AppLayout>
  );
}

/* ------------------------------------------------------------------ */
/*  Section Header with Add button                                     */
/* ------------------------------------------------------------------ */

function SectionHeader({ label, onAdd }: { label: string; onAdd: () => void }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h3 className="text-sm font-semibold text-slate-700">{label}</h3>
      <button
        type="button"
        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-800"
        onClick={onAdd}
      >
        <Plus size={15} /> Add
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Departments                                                        */
/* ------------------------------------------------------------------ */

function DepartmentsSection({ departments, users }: { departments: Department[]; users: User[] }) {
  const confirm = useConfirm();
  const blank = { name: '', code: '', manager_id: '' };
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]));

  function openCreate() { setEditingId(null); setForm(blank); setModalOpen(true); }
  function openEdit(d: Department) { setEditingId(d.id); setForm({ name: d.name, code: d.code, manager_id: String(d.manager_id ?? '') }); setModalOpen(true); }
  function closeModal() { setModalOpen(false); setEditingId(null); setForm(blank); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editingId) {
      router.put(`/admin/departments/${editingId}`, form, { onSuccess: closeModal });
    } else {
      router.post('/admin/departments', form, { onSuccess: closeModal });
    }
  }

  function handleDelete(id: number) {
    confirm({ title: 'Delete Department', message: 'This department will be permanently removed. Any employees assigned to it may be affected.', confirmLabel: 'Delete', onConfirm: () => router.delete(`/admin/departments/${id}`) });
  }

  return (
    <>
      <SectionHeader label="Departments" onAdd={openCreate} />
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80">
              <Th>Code</Th><Th>Name</Th><Th>Manager</Th><Th className="w-12" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {departments.map((d) => (
              <tr key={d.id} className="transition-colors hover:bg-slate-50/50">
                <td className="px-6 py-3.5"><span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-medium text-slate-600">{d.code}</span></td>
                <td className="px-6 py-3.5 font-medium text-slate-900">{d.name}</td>
                <td className="px-6 py-3.5 text-slate-500">{d.manager_id ? userMap[d.manager_id] ?? '—' : '—'}</td>
                <td className="px-4 py-3.5"><ActionMenu onEdit={() => openEdit(d)} onDelete={() => handleDelete(d.id)} /></td>
              </tr>
            ))}
            <EmptyRow cols={4} show={departments.length === 0} label="departments" />
          </tbody>
        </table>
      </div>

      <FormModal open={modalOpen} onClose={closeModal} title="Department" editing={!!editingId} onSubmit={handleSubmit}>
        <div className="grid gap-4">
          <Field label="Name">
            <input className={INPUT} placeholder="e.g. Engineering" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
          </Field>
          <Field label="Code">
            <input className={INPUT} placeholder="e.g. ENG" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          </Field>
          <Field label="Manager">
            <Select
              value={form.manager_id}
              onChange={(v) => setForm({ ...form, manager_id: v })}
              options={[{ value: '', label: 'None' }, ...users.map((u) => ({ value: String(u.id), label: u.name }))]}
              placeholder="Select manager"
            />
          </Field>
        </div>
      </FormModal>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Leave Types                                                        */
/* ------------------------------------------------------------------ */

function LeaveTypesSection({ leaveTypes }: { leaveTypes: LeaveType[] }) {
  const confirm = useConfirm();
  const blank = { name: '', code: '', default_allowance_days: 0, paid: true, requires_attachment: false, deducts_balance: true };
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  function openCreate() { setEditingId(null); setForm(blank); setModalOpen(true); }
  function openEdit(t: LeaveType) {
    setEditingId(t.id);
    setForm({ name: t.name, code: t.code, default_allowance_days: Number(t.default_allowance_days) || 0, paid: (t as any).paid ?? true, requires_attachment: t.requires_attachment, deducts_balance: (t as any).deducts_balance ?? true });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditingId(null); setForm(blank); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editingId) {
      router.put(`/admin/leave-types/${editingId}`, form, { onSuccess: closeModal });
    } else {
      router.post('/admin/leave-types', form, { onSuccess: closeModal });
    }
  }

  function handleDelete(id: number) {
    confirm({ title: 'Delete Leave Type', message: 'This leave type will be permanently removed. Existing requests using this type may be affected.', confirmLabel: 'Delete', onConfirm: () => router.delete(`/admin/leave-types/${id}`) });
  }

  return (
    <>
      <SectionHeader label="Leave Types" onAdd={openCreate} />
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80">
              <Th>Code</Th><Th>Name</Th><Th>Days</Th><Th>Attachment</Th><Th className="w-12" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {leaveTypes.map((t) => (
              <tr key={t.id} className="transition-colors hover:bg-slate-50/50">
                <td className="px-6 py-3.5"><span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-medium text-slate-600">{t.code}</span></td>
                <td className="px-6 py-3.5 font-medium text-slate-900">{t.name}</td>
                <td className="px-6 py-3.5 text-slate-600">{t.default_allowance_days}</td>
                <td className="px-6 py-3.5">
                  {t.requires_attachment
                    ? <span className="inline-flex items-center gap-1 text-emerald-600"><Check size={14} /> Yes</span>
                    : <span className="inline-flex items-center gap-1 text-slate-400"><X size={14} /> No</span>}
                </td>
                <td className="px-4 py-3.5"><ActionMenu onEdit={() => openEdit(t)} onDelete={() => handleDelete(t.id)} /></td>
              </tr>
            ))}
            <EmptyRow cols={5} show={leaveTypes.length === 0} label="leave types" />
          </tbody>
        </table>
      </div>

      <FormModal open={modalOpen} onClose={closeModal} title="Leave Type" editing={!!editingId} onSubmit={handleSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <input className={INPUT} placeholder="e.g. Annual Leave" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
          </Field>
          <Field label="Code">
            <input className={INPUT} placeholder="e.g. AL" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          </Field>
          <Field label="Default Allowance Days">
            <input className={INPUT} type="number" min={0} value={form.default_allowance_days} onChange={(e) => setForm({ ...form, default_allowance_days: Number(e.target.value) })} />
          </Field>
        </div>
        <div className="mt-5 flex flex-wrap gap-5">
          <Checkbox label="Paid leave" checked={form.paid} onChange={(v) => setForm({ ...form, paid: v })} />
          <Checkbox label="Requires attachment" checked={form.requires_attachment} onChange={(v) => setForm({ ...form, requires_attachment: v })} />
          <Checkbox label="Deducts balance" checked={form.deducts_balance} onChange={(v) => setForm({ ...form, deducts_balance: v })} />
        </div>
      </FormModal>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Public Holidays                                                    */
/* ------------------------------------------------------------------ */

function HolidaysSection({ holidays }: { holidays: Holiday[] }) {
  const confirm = useConfirm();
  const blank = { name: '', holiday_date: '' };
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  function openCreate() { setEditingId(null); setForm(blank); setModalOpen(true); }
  function openEdit(h: Holiday) { setEditingId(h.id); setForm({ name: h.name, holiday_date: h.holiday_date.slice(0, 10) }); setModalOpen(true); }
  function closeModal() { setModalOpen(false); setEditingId(null); setForm(blank); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editingId) {
      router.put(`/admin/holidays/${editingId}`, form, { onSuccess: closeModal });
    } else {
      router.post('/admin/holidays', form, { onSuccess: closeModal });
    }
  }

  function handleDelete(id: number) {
    confirm({ title: 'Delete Holiday', message: 'This public holiday will be permanently removed from the calendar.', confirmLabel: 'Delete', onConfirm: () => router.delete(`/admin/holidays/${id}`) });
  }

  return (
    <>
      <SectionHeader label="Public Holidays" onAdd={openCreate} />
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80">
              <Th>Date</Th><Th>Name</Th><Th className="w-12" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {holidays.map((h) => (
              <tr key={h.id} className="transition-colors hover:bg-slate-50/50">
                <td className="whitespace-nowrap px-6 py-3.5 text-slate-600">{formatDate(h.holiday_date)}</td>
                <td className="px-6 py-3.5 font-medium text-slate-900">{h.name}</td>
                <td className="px-4 py-3.5"><ActionMenu onEdit={() => openEdit(h)} onDelete={() => handleDelete(h.id)} /></td>
              </tr>
            ))}
            <EmptyRow cols={3} show={holidays.length === 0} label="holidays" />
          </tbody>
        </table>
      </div>

      <FormModal open={modalOpen} onClose={closeModal} title="Holiday" editing={!!editingId} onSubmit={handleSubmit}>
        <div className="grid gap-4">
          <Field label="Holiday Name">
            <input className={INPUT} placeholder="e.g. New Year's Day" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
          </Field>
          <Field label="Date">
            <DatePicker value={form.holiday_date} onChange={(v) => setForm({ ...form, holiday_date: v })} />
          </Field>
        </div>
      </FormModal>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  User Accounts                                                      */
/* ------------------------------------------------------------------ */

function UsersSection({ users, departments }: { users: User[]; departments: Department[] }) {
  const confirm = useConfirm();
  const { flash } = usePage<PageProps>().props;
  const blank = { name: '', email: '', role: 'staff', department_id: '', manager_id: '', employee_code: '', job_title: '', hire_date: '', two_factor_enabled: false };
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (flash.default_password) {
      setCreatedPassword(flash.default_password);
      setCopied(false);
    }
  }, [flash.default_password]);

  function openCreate() { setEditingId(null); setForm(blank); setModalOpen(true); }
  function openEdit(u: User) {
    setEditingId(u.id);
    setForm({ name: u.name, email: u.email, role: u.role, department_id: u.department ? String(u.department.id) : '', manager_id: '', employee_code: '', job_title: '', hire_date: '', two_factor_enabled: false });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditingId(null); setForm(blank); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editingId) {
      router.put(`/admin/users/${editingId}`, form, { onSuccess: closeModal });
    } else {
      router.post('/admin/users', form, { onSuccess: closeModal });
    }
  }

  function copyPassword() {
    if (createdPassword) {
      navigator.clipboard.writeText(createdPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function handleDelete(id: number) {
    confirm({ title: 'Delete User', message: 'This user account will be permanently deleted. All associated data including leave requests and balances may be affected. This action cannot be undone.', confirmLabel: 'Delete User', onConfirm: () => router.delete(`/admin/users/${id}`) });
  }

  return (
    <>
      <SectionHeader label="Users" onAdd={openCreate} />
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80">
              <Th>Name</Th><Th>Email</Th><Th>Role</Th><Th>Department</Th><Th className="w-12" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {users.map((u) => (
              <tr key={u.id} className="transition-colors hover:bg-slate-50/50">
                <td className="whitespace-nowrap px-6 py-3.5 font-medium text-slate-900">{u.name}</td>
                <td className="whitespace-nowrap px-6 py-3.5 text-slate-500">{u.email}</td>
                <td className="px-6 py-3.5">
                  <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium capitalize ${ROLE_STYLE[u.role] ?? 'bg-slate-100 text-slate-600'}`}>{u.role}</span>
                </td>
                <td className="px-6 py-3.5 text-slate-500">{u.department?.name ?? '—'}</td>
                <td className="px-4 py-3.5"><ActionMenu onEdit={() => openEdit(u)} onDelete={() => handleDelete(u.id)} /></td>
              </tr>
            ))}
            <EmptyRow cols={5} show={users.length === 0} label="users" />
          </tbody>
        </table>
      </div>

      <FormModal open={modalOpen} onClose={closeModal} title="User" editing={!!editingId} onSubmit={handleSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full Name">
            <input className={INPUT} placeholder="e.g. Jane Doe" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
          </Field>
          <Field label="Email">
            <input className={INPUT} type="email" placeholder="e.g. jane@company.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Role">
            <Select
              value={form.role}
              onChange={(v) => setForm({ ...form, role: v })}
              options={[
                { value: 'staff', label: 'Staff' },
                { value: 'manager', label: 'Manager' },
                { value: 'hr', label: 'HR' },
                { value: 'admin', label: 'Admin' },
              ]}
              placeholder="Select role"
            />
          </Field>
          <Field label="Department">
            <Select
              value={form.department_id}
              onChange={(v) => setForm({ ...form, department_id: v })}
              options={[{ value: '', label: 'Select department' }, ...departments.map((d) => ({ value: String(d.id), label: d.name }))]}
              placeholder="Select department"
            />
          </Field>
          <Field label="Reports To">
            <Select
              value={form.manager_id}
              onChange={(v) => setForm({ ...form, manager_id: v })}
              options={[{ value: '', label: 'No manager' }, ...users.map((u) => ({ value: String(u.id), label: u.name }))]}
              placeholder="Select manager"
            />
          </Field>
        </div>
      </FormModal>

      {createdPassword && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-sm animate-[scaleIn_0.15s_ease-out] rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <Key size={22} />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-slate-900">User Created Successfully</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500">A default password has been generated. Please share it securely with the new user.</p>
              </div>
            </div>
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Default Password</div>
              <div className="flex items-center gap-3">
                <code className="flex-1 rounded-lg bg-white px-3 py-2 font-mono text-sm font-medium tracking-wide text-slate-900 ring-1 ring-slate-200">{createdPassword}</code>
                <button
                  type="button"
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${copied ? 'bg-emerald-100 text-emerald-600' : 'bg-white text-slate-400 ring-1 ring-slate-200 hover:bg-slate-50 hover:text-slate-600'}`}
                  onClick={copyPassword}
                  title="Copy to clipboard"
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
              {copied && <p className="mt-2 text-xs text-emerald-600">Copied to clipboard</p>}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-amber-600">This password will not be shown again. The user should change it after their first login.</p>
            <div className="mt-5">
              <button type="button" className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-800" onClick={() => setCreatedPassword(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Balance Overrides                                                  */
/* ------------------------------------------------------------------ */

function BalancesSection({ balances, users, leaveTypes }: { balances: Balance[]; users: User[]; leaveTypes: LeaveType[] }) {
  const confirm = useConfirm();
  const blank = { user_id: '', leave_type_id: '', year: new Date().getFullYear(), allowance_days: 0, adjustment_days: 0, override_reason: '' };
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  function openCreate() { setEditingId(null); setForm(blank); setModalOpen(true); }
  function openEdit(b: Balance) {
    setEditingId(b.id);
    setForm({
      user_id: String(b.user_id),
      leave_type_id: String(b.leave_type_id),
      year: b.year,
      allowance_days: parseFloat(b.allowance_days) || 0,
      adjustment_days: parseFloat(b.adjustment_days) || 0,
      override_reason: b.override_reason ?? '',
    });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditingId(null); setForm(blank); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editingId) {
      router.put(`/admin/balances/${editingId}`, {
        allowance_days: form.allowance_days,
        adjustment_days: form.adjustment_days,
        override_reason: form.override_reason,
      }, { onSuccess: closeModal });
    } else {
      router.post('/admin/balances', form, { onSuccess: closeModal });
    }
  }

  function handleDelete(id: number) {
    confirm({
      title: 'Delete Balance',
      message: 'This will permanently remove this balance record. Existing leave requests are not affected.',
      confirmLabel: 'Delete',
      onConfirm: () => router.delete(`/admin/balances/${id}`),
    });
  }

  return (
    <>
      <SectionHeader label={`Leave Balances — ${new Date().getFullYear()}`} onAdd={openCreate} />

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80">
                <Th>Employee</Th>
                <Th>Leave Type</Th>
                <Th className="text-right">Allowance</Th>
                <Th className="text-right">Used</Th>
                <Th className="text-right">Pending</Th>
                <Th className="text-right">Adj.</Th>
                <Th className="text-right">Available</Th>
                <Th className="w-12" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {balances.map((b) => {
                const available = b.available_days;
                const isLow = available <= 2 && available > 0;
                const isZero = available <= 0;
                return (
                  <tr key={b.id} className="transition-colors hover:bg-slate-50/50">
                    <td className="px-6 py-3.5">
                      <div className="font-medium text-slate-900">{b.user?.name ?? '—'}</div>
                      {b.user?.department && (
                        <div className="mt-0.5 text-xs text-slate-400">{b.user.department.name}</div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-3.5">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                        {b.leave_type?.name ?? '—'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-3.5 text-right font-medium text-slate-700">{parseFloat(b.allowance_days)}</td>
                    <td className="whitespace-nowrap px-6 py-3.5 text-right text-slate-600">{parseFloat(b.used_days)}</td>
                    <td className="whitespace-nowrap px-6 py-3.5 text-right text-slate-600">{parseFloat(b.pending_days)}</td>
                    <td className="whitespace-nowrap px-6 py-3.5 text-right text-slate-600">
                      {parseFloat(b.adjustment_days) !== 0 && (
                        <span className={parseFloat(b.adjustment_days) > 0 ? 'text-emerald-600' : 'text-red-500'}>
                          {parseFloat(b.adjustment_days) > 0 ? '+' : ''}{parseFloat(b.adjustment_days)}
                        </span>
                      )}
                      {parseFloat(b.adjustment_days) === 0 && <span className="text-slate-300">0</span>}
                    </td>
                    <td className="whitespace-nowrap px-6 py-3.5 text-right">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        isZero ? 'bg-red-100 text-red-700' : isLow ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {available}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <ActionMenu onEdit={() => openEdit(b)} onDelete={() => handleDelete(b.id)} />
                    </td>
                  </tr>
                );
              })}
              <EmptyRow cols={8} show={balances.length === 0} label="balances" />
            </tbody>
          </table>
        </div>
      </div>

      <FormModal open={modalOpen} onClose={closeModal} title="Balance Override" editing={!!editingId} onSubmit={handleSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          {!editingId && (
            <>
              <Field label="Employee">
                <Select
                  value={form.user_id}
                  onChange={(v) => setForm({ ...form, user_id: v })}
                  options={[{ value: '', label: 'Select employee' }, ...users.map((u) => ({ value: String(u.id), label: u.name }))]}
                  placeholder="Select employee"
                />
              </Field>
              <Field label="Leave Type">
                <Select
                  value={form.leave_type_id}
                  onChange={(v) => setForm({ ...form, leave_type_id: v })}
                  options={[{ value: '', label: 'Select type' }, ...leaveTypes.map((t) => ({ value: String(t.id), label: t.name }))]}
                  placeholder="Select leave type"
                />
              </Field>
              <Field label="Year">
                <input className={INPUT} type="number" value={form.year} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} />
              </Field>
            </>
          )}
          <Field label="Allowance Days">
            <input className={INPUT} type="number" min={0} value={form.allowance_days} onChange={(e) => setForm({ ...form, allowance_days: Number(e.target.value) })} />
          </Field>
          <Field label="Adjustment (+/-)">
            <input className={INPUT} type="number" value={form.adjustment_days} onChange={(e) => setForm({ ...form, adjustment_days: Number(e.target.value) })} />
          </Field>
          <Field label="Reason">
            <input className={INPUT} placeholder="e.g. Carry-over from 2025" value={form.override_reason} onChange={(e) => setForm({ ...form, override_reason: e.target.value })} />
          </Field>
        </div>
      </FormModal>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared UI Primitives                                               */
/* ------------------------------------------------------------------ */

function ActionMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600" onClick={() => setOpen((v) => !v)}>
        <EllipsisVertical size={16} />
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-20 w-36 rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
          <button type="button" className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50" onClick={() => { onEdit(); setOpen(false); }}>
            <Pencil size={14} /> Edit
          </button>
          <button type="button" className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-red-600 transition-colors hover:bg-red-50" onClick={() => { onDelete(); setOpen(false); }}>
            <Trash2 size={14} /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-slate-600">{label}</label>
      {children}
    </div>
  );
}

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
      <span
        className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${checked ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300 bg-white'}`}
        onClick={(e) => e.preventDefault()}
      >
        {checked && <Check size={13} strokeWidth={3} />}
      </span>
      <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function Th({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 ${className}`}>{children}</th>;
}

function EmptyRow({ cols, show, label }: { cols: number; show: boolean; label: string }) {
  if (!show) return null;
  return (
    <tr>
      <td colSpan={cols} className="px-6 py-12 text-center text-sm text-slate-400">No {label} added yet</td>
    </tr>
  );
}
