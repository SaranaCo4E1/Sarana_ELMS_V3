import { Link, router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { Mail, ArrowLeft, Loader2 } from 'lucide-react';
import type { PageProps } from '../../types';

export default function ForgotPassword() {
  const { errors, flash } = usePage<PageProps>().props;
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-neutral-50/60 px-4 py-12">
      {/* Ambient background decoration */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 h-80 w-80 rounded-full bg-orange-500/5 blur-3xl"></div>
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 h-80 w-80 rounded-full bg-amber-500/5 blur-3xl"></div>

      <div className="relative w-full max-w-md">
        <div className="rounded-xl border border-neutral-200/50 bg-white p-8 shadow-premium-md">
          {/* Header & Logo */}
          <div className="flex flex-col items-center text-center mb-6">
            <Link
              href="/"
              aria-label="Go to NiyAI ELMS home page"
              className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-orange-100 bg-white shadow-md shadow-orange-600/10 transition-all hover:border-orange-200 hover:shadow-premium-md active:scale-95"
            >
              <img src="/images/niyai-logo.png" alt="NiyAI logo" className="h-auto w-9" />
            </Link>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-800">Reset Password</h1>
            <p className="mt-2 text-sm font-medium text-neutral-500 leading-relaxed">
              Enter your email address and we will send you a secure link to reset your account password.
            </p>
          </div>

          {/* Flash Messages */}
          {flash.success && (
            <div className="mb-6 rounded-lg bg-orange-50 border border-orange-100/60 p-4 text-sm font-semibold text-orange-800 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-500 shrink-0"></span>
              {flash.success}
            </div>
          )}

          {/* Form */}
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              router.post('/forgot-password', { email }, {
                onStart: () => setLoading(true),
                onFinish: () => setLoading(false),
              });
            }}
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
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  placeholder="name@company.com"
                  required
                />
              </div>
              {errors.email && <p className="mt-1.5 text-xs font-semibold text-rose-500">{errors.email}</p>}
            </div>

            {/* Submit Button */}
            <button 
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-orange-600 disabled:bg-neutral-200 disabled:text-neutral-400 py-4 text-sm font-semibold tracking-wide uppercase text-white shadow-md shadow-orange-600/10 hover:bg-orange-700 active:scale-98 transition-all cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin text-neutral-400" />
                  Sending Link...
                </>
              ) : (
                'Send Reset Link'
              )}
            </button>
          </form>

          {/* Navigation Links */}
          <div className="mt-6 text-center">
            <Link 
              className="group inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-500 hover:text-neutral-800 transition-colors" 
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
