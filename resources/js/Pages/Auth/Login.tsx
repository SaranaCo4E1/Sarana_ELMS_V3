import { Link, router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { Bot, Mail, KeyRound } from 'lucide-react';
import type { PageProps } from '../../types';

export default function Login() {
  const { errors, flash } = usePage<PageProps>().props;
  const [form, setForm] = useState({ email: '', password: '', remember: true });

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-neutral-50/60 px-4 py-12">
      {/* Ambient background decoration */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 h-80 w-80 rounded-full bg-emerald-500/5 blur-3xl"></div>
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 h-80 w-80 rounded-full bg-teal-500/5 blur-3xl"></div>

      <div className="relative w-full max-w-md">
        <div className="rounded-2xl border border-neutral-200/50 bg-white p-8 shadow-premium-md">
          {/* Header & Logo */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-950 text-white shadow-md mb-4">
              <Bot size={22} className="text-emerald-400" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-850">Welcome Back</h1>
            <p className="mt-1.5 text-xs font-medium text-neutral-500">Sign in to manage leave, approvals, and schedules.</p>
          </div>

          {/* Flash Messages */}
          {flash.success && (
            <div className="mb-6 rounded-xl bg-emerald-50 border border-emerald-100/60 p-4 text-xs font-semibold text-emerald-800 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0"></span>
              {flash.success}
            </div>
          )}

          {/* Login Form */}
          <form
            onSubmit={(e) => { e.preventDefault(); router.post('/login', form); }}
            className="space-y-5"
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

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-[10px] font-semibold uppercase tracking-widest text-neutral-450">
                  Password
                </label>
                <Link
                  className="text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:underline transition-colors"
                  href="/forgot-password"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-neutral-400">
                  <KeyRound size={15} />
                </div>
                <input
                  type="password"
                  className="w-full rounded-xl border border-neutral-200 bg-white pl-10 pr-3.5 py-2.5 text-xs text-neutral-850 placeholder-neutral-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/5 shadow-premium-sm font-medium transition-all outline-none"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center">
              <input
                id="remember_me"
                type="checkbox"
                className="h-4 w-4 rounded-md border-neutral-300 text-emerald-600 focus:ring-emerald-500"
                checked={form.remember}
                onChange={(e) => setForm({ ...form, remember: e.target.checked })}
              />
              <label htmlFor="remember_me" className="ml-2 block text-xs font-medium text-neutral-600 select-none">
                Remember this device
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full rounded-xl bg-neutral-950 py-3.5 text-xs font-semibold tracking-wide uppercase text-white shadow-md hover:bg-neutral-900 active:scale-98 transition-all cursor-pointer"
            >
              Sign In
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
