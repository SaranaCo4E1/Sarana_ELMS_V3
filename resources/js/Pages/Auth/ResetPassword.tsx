import { Link, router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { Bot, Mail, KeyRound, ArrowLeft } from 'lucide-react';
import type { PageProps } from '../../types';

export default function ResetPassword({ token, email }: { token: string; email: string }) {
  const { errors } = usePage<PageProps>().props;
  const [form, setForm] = useState({ token, email, password: '', password_confirmation: '' });

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-neutral-50/60 px-4 py-12">
      {/* Ambient background decoration */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 h-80 w-80 rounded-full bg-emerald-500/5 blur-3xl"></div>
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 h-80 w-80 rounded-full bg-teal-500/5 blur-3xl"></div>

      <div className="relative w-full max-w-md">
        <div className="rounded-2xl border border-neutral-200/50 bg-white p-8 shadow-premium-md">
          {/* Header & Logo */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-600/10 mb-4">
              <Bot size={22} className="text-white" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-850">Set New Password</h1>
            <p className="mt-1.5 text-xs font-medium text-neutral-500 leading-relaxed">
              Create a strong password that you do not use elsewhere for your security.
            </p>
          </div>

          {/* Form */}
          <form 
            onSubmit={(e) => { e.preventDefault(); router.post('/reset-password', form); }}
            className="space-y-4"
          >
            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-neutral-450">
                Email Address
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-neutral-400">
                  <Mail size={15} />
                </div>
                <input 
                  type="email"
                  className="w-full rounded-xl border border-neutral-200 bg-white pl-10 pr-3.5 py-2.5 text-xs text-neutral-850 placeholder-neutral-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/5 shadow-premium-sm font-medium transition-all outline-none"
                  value={form.email} 
                  onChange={(e) => setForm({ ...form, email: e.target.value })} 
                  placeholder="name@company.com"
                  required
                />
              </div>
              {errors.email && <p className="mt-1 text-xs font-medium text-rose-500">{errors.email}</p>}
            </div>

            {/* New Password Field */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-neutral-450">
                New Password
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-neutral-400">
                  <KeyRound size={15} />
                </div>
                <input 
                  type="password" 
                  className="w-full rounded-xl border border-neutral-200 bg-white pl-10 pr-3.5 py-2.5 text-xs text-neutral-850 placeholder-neutral-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/5 shadow-premium-sm font-medium transition-all outline-none"
                  onChange={(e) => setForm({ ...form, password: e.target.value })} 
                  placeholder="••••••••"
                  required
                />
              </div>
              {errors.password && <p className="mt-1 text-xs font-medium text-rose-500">{errors.password}</p>}
            </div>

            {/* Confirm Password Field */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-neutral-450">
                Confirm Password
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-neutral-400">
                  <KeyRound size={15} />
                </div>
                <input 
                  type="password" 
                  className="w-full rounded-xl border border-neutral-200 bg-white pl-10 pr-3.5 py-2.5 text-xs text-neutral-850 placeholder-neutral-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/5 shadow-premium-sm font-medium transition-all outline-none"
                  onChange={(e) => setForm({ ...form, password_confirmation: e.target.value })} 
                  placeholder="••••••••"
                  required
                />
              </div>
              {errors.password_confirmation && <p className="mt-1 text-xs font-medium text-rose-500">{errors.password_confirmation}</p>}
            </div>

            {/* Submit Button */}
            <button 
              type="submit"
              className="w-full rounded-xl bg-emerald-600 py-3.5 text-xs font-semibold tracking-wide uppercase text-white shadow-md shadow-emerald-600/10 hover:bg-emerald-700 active:scale-98 transition-all cursor-pointer"
            >
              Reset Password
            </button>
          </form>

          {/* Navigation Links */}
          <div className="mt-6 text-center">
            <Link 
              className="group inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-800 transition-colors" 
              href="/login"
            >
              <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-0.5" />
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

