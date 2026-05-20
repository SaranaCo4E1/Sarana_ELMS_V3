import { router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import type { PageProps } from '../../types';

export default function ForgotPassword() {
  const { errors, flash } = usePage<PageProps>().props;
  const [email, setEmail] = useState('');
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <form className="w-full max-w-sm rounded-md border border-slate-200 bg-white p-6 shadow-sm" onSubmit={(e) => { e.preventDefault(); router.post('/forgot-password', { email }); }}>
        <h1 className="text-xl font-semibold">Reset password</h1>
        {flash.success && <p className="mt-4 rounded-md bg-emerald-100 px-3 py-2 text-sm text-emerald-900">{flash.success}</p>}
        <input className="mt-5 w-full rounded-md border border-slate-300 px-3 py-2" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
        <button className="mt-5 w-full rounded-md bg-emerald-700 px-4 py-2 font-medium text-white">Send reset link</button>
      </form>
    </main>
  );
}
