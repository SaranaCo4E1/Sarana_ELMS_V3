import { router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import type { PageProps } from '../../types';

export default function ResetPassword({ token, email }: { token: string; email: string }) {
  const { errors } = usePage<PageProps>().props;
  const [form, setForm] = useState({ token, email, password: '', password_confirmation: '' });
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <form className="w-full max-w-sm rounded-md border border-slate-200 bg-white p-6 shadow-sm" onSubmit={(e) => { e.preventDefault(); router.post('/reset-password', form); }}>
        <h1 className="text-xl font-semibold">Set new password</h1>
        <input className="mt-5 w-full rounded-md border border-slate-300 px-3 py-2" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2" type="password" placeholder="Password" onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <input className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2" type="password" placeholder="Confirm password" onChange={(e) => setForm({ ...form, password_confirmation: e.target.value })} />
        {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
        <button className="mt-5 w-full rounded-md bg-emerald-700 px-4 py-2 font-medium text-white">Reset password</button>
      </form>
    </main>
  );
}
