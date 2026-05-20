import { router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import type { PageProps } from '../../types';

export default function TwoFactor() {
  const { errors } = usePage<PageProps>().props;
  const [code, setCode] = useState('');
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <form className="w-full max-w-sm rounded-md border border-slate-200 bg-white p-6 shadow-sm" onSubmit={(e) => { e.preventDefault(); router.post('/two-factor', { code }); }}>
        <h1 className="text-xl font-semibold">Two-factor verification</h1>
        <input className="mt-5 w-full rounded-md border border-slate-300 px-3 py-2" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} />
        {errors.code && <p className="mt-1 text-sm text-red-600">{errors.code}</p>}
        <button className="mt-5 w-full rounded-md bg-emerald-700 px-4 py-2 font-medium text-white">Verify</button>
      </form>
    </main>
  );
}
