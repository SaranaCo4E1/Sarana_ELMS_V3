import { Link, router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { Bot, Mail, ArrowLeft } from 'lucide-react';
import type { PageProps } from '../../types';

export default function ForgotPassword() {
  const { errors, flash } = usePage<PageProps>().props;
  const [email, setEmail] = useState('');

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
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Reset Password</h1>
            <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">
              Enter your email address and we will send you a secure link to reset your account password.
            </p>
          </div>

          {/* Flash Messages */}
          {flash.success && (
            <div className="mb-6 rounded-xl bg-emerald-50 border border-emerald-100 p-4 text-xs font-semibold text-emerald-800 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0"></span>
              {flash.success}
            </div>
          )}

          {/* Form */}
          <form 
            onSubmit={(e) => { e.preventDefault(); router.post('/forgot-password', { email }); }}
            className="space-y-5"
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
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/30 pl-10 pr-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 shadow-2xs transition-all outline-hidden"
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  placeholder="name@company.com"
                  required
                />
              </div>
              {errors.email && <p className="mt-1 text-xs font-medium text-rose-500">{errors.email}</p>}
            </div>

            {/* Submit Button */}
            <button 
              type="submit"
              className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold uppercase tracking-wider text-white shadow-md shadow-emerald-600/10 hover:bg-emerald-700 active:scale-98 transition-all"
            >
              Send Reset Link
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

