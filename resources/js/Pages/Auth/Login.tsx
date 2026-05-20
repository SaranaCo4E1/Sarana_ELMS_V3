import { Link, router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import type { PageProps } from '../../types';

export default function Login() {
  const { errors, flash } = usePage<PageProps>().props;
  const [form, setForm] = useState({ email: 'staff@elms.test', password: 'password', remember: true });

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <form className="w-full max-w-sm rounded-md border border-slate-200 bg-white p-6 shadow-sm" onSubmit={(e) => { e.preventDefault(); router.post('/login', form); }}>
        <h1 className="text-xl font-semibold text-slate-950">ELMS</h1>
        <p className="mt-1 text-sm text-slate-500">Sign in to submit, approve, and administer leave.</p>
        {flash.success && <div className="mt-4 rounded-md bg-emerald-100 px-3 py-2 text-sm text-emerald-900">{flash.success}</div>}
        <label className="mt-5 block text-sm font-medium">Email</label>
        <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
        <label className="mt-4 block text-sm font-medium">Password</label>
        <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={form.remember} onChange={(e) => setForm({ ...form, remember: e.target.checked })} /> Remember me</label>
        <button className="mt-5 w-full rounded-md bg-emerald-700 px-4 py-2 font-medium text-white hover:bg-emerald-800">Sign in</button>
        <Link className="mt-4 block text-center text-sm text-emerald-700" href="/forgot-password">Reset password</Link>
      </form>
    </main>
  );
}
