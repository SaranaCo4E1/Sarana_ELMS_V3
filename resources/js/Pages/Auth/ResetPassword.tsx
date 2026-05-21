import { Link, router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { Bot, Mail, KeyRound, ArrowLeft } from 'lucide-react';
import type { PageProps } from '../../types';

export default function ResetPassword({ token, email }: { token: string; email: string }) {
  const { errors } = usePage<PageProps>().props;
  const [form, setForm] = useState({ token, email, password: '', password_confirmation: '' });

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-slate-50/50 px-4 py-12">
      {/* Ambient background decoration */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 h-80 w-80 rounded-full bg-emerald-500/5 blur-3xl"></div>
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 h-80 w-80 rounded-full bg-teal-500/5 blur-3xl"></div>

      <div className="relative w-full max-w-md">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-8 shadow-md">
          {/* Header & Logo */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-md shadow-emerald-600/10 mb-4">
              <Bot size={24} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Set New Password</h1>
            <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">
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
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                Email Address
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Mail size={16} />
                </div>
                <input 
                  type="email"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/30 pl-10 pr-3.5 py-2.5 text-sm text-slate-800 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 shadow-2xs transition-all outline-hidden"
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
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                New Password
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <KeyRound size={16} />
                </div>
                <input 
                  type="password" 
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/30 pl-10 pr-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 shadow-2xs transition-all outline-hidden"
                  onChange={(e) => setForm({ ...form, password: e.target.value })} 
                  placeholder="••••••••"
                  required
                />
              </div>
              {errors.password && <p className="mt-1 text-xs font-medium text-rose-500">{errors.password}</p>}
            </div>

            {/* Confirm Password Field */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                Confirm Password
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <KeyRound size={16} />
                </div>
                <input 
                  type="password" 
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/30 pl-10 pr-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 shadow-2xs transition-all outline-hidden"
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
              className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold uppercase tracking-wider text-white shadow-md shadow-emerald-600/10 hover:bg-emerald-700 active:scale-98 transition-all"
            >
              Reset Password
            </button>
          </form>

          {/* Navigation Links */}
          <div className="mt-6 text-center">
            <Link 
              className="group inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors" 
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

