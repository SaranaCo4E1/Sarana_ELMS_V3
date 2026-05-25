import { Link, router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { Bot, Mail, KeyRound, Eye, EyeOff } from 'lucide-react';
import type { PageProps } from '../../types';

export default function Login() {
  const { errors, flash } = usePage<PageProps>().props;
  const [form, setForm] = useState({ email: '', password: '', remember: true });
  const [showPassword, setShowPassword] = useState(false);

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-neutral-50/60 px-4 py-12">
      {/* Ambient background decoration */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 h-80 w-80 rounded-full bg-orange-500/5 blur-3xl"></div>
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 h-80 w-80 rounded-full bg-amber-500/5 blur-3xl"></div>

      <div className="relative w-full max-w-md">
        <div className="rounded-xl border border-neutral-200/50 bg-white p-8 shadow-premium-md">
          {/* Header & Logo */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-600 text-white shadow-md shadow-orange-600/10 mb-4">
              <Bot size={22} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-800">Welcome Back</h1>
            <p className="mt-2 text-sm font-medium text-neutral-500">Sign in to manage leave, approvals, and schedules.</p>
          </div>

          {/* Flash Messages */}
          {flash.success && (
            <div className="mb-6 rounded-lg bg-orange-50 border border-orange-100/60 p-4 text-sm font-semibold text-orange-800 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-500 shrink-0"></span>
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
              <label className="block text-sm font-semibold uppercase tracking-wider text-neutral-500">
                Email Address
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-neutral-400">
                  <Mail size={15} />
                </div>
                <input
                  type="email"
                  className="w-full rounded-lg border border-neutral-200 bg-white pl-11 pr-4 py-3 text-sm text-neutral-800 placeholder-neutral-400 focus:border-orange-600 focus:ring-4 focus:ring-orange-500/5 shadow-premium-sm font-medium transition-all outline-none"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="name@company.com"
                  required
                  tabIndex={1}
                  autoFocus
                />
              </div>
              {errors.email && <p className="mt-1.5 text-xs font-semibold text-rose-500">{errors.email}</p>}
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-semibold uppercase tracking-wider text-neutral-500">
                  Password
                </label>
                <Link
                  className="text-sm font-semibold text-orange-600 hover:text-orange-700 hover:underline transition-colors"
                  href="/forgot-password"
                  tabIndex={4}
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-neutral-400">
                  <KeyRound size={15} />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  className="w-full rounded-lg border border-neutral-200 bg-white pl-11 pr-11 py-3 text-sm text-neutral-800 placeholder-neutral-400 focus:border-orange-600 focus:ring-4 focus:ring-orange-500/5 shadow-premium-sm font-medium transition-all outline-none"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                  required
                  tabIndex={2}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-4 text-neutral-400 hover:text-neutral-600 transition-colors focus:outline-none"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center">
              <input
                id="remember_me"
                type="checkbox"
                className="h-4.5 w-4.5 rounded border-neutral-300 text-orange-600 focus:ring-orange-500"
                checked={form.remember}
                onChange={(e) => setForm({ ...form, remember: e.target.checked })}
                tabIndex={5}
              />
              <label htmlFor="remember_me" className="ml-2.5 block text-sm font-medium text-neutral-600 select-none">
                Remember this device
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full rounded-lg bg-orange-600 py-4 text-sm font-semibold tracking-wide uppercase text-white shadow-md shadow-orange-600/10 hover:bg-orange-700 active:scale-98 transition-all cursor-pointer"
              tabIndex={3}
            >
              Sign In
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
