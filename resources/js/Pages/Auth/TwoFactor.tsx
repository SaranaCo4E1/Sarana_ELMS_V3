import { Link, router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { Bot, ShieldCheck, ArrowLeft } from 'lucide-react';
import type { PageProps } from '../../types';

export default function TwoFactor() {
  const { errors } = usePage<PageProps>().props;
  const [code, setCode] = useState('');

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-neutral-50/60 px-4 py-12">
      {/* Ambient background decoration */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 h-80 w-80 rounded-full bg-emerald-500/5 blur-3xl"></div>
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 h-80 w-80 rounded-full bg-teal-500/5 blur-3xl"></div>

      <div className="relative w-full max-w-md">
        <div className="rounded-2xl border border-neutral-200/50 bg-white p-8 shadow-premium-md">
          {/* Header & Logo */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-950 text-white shadow-md mb-4">
              <ShieldCheck size={22} className="text-emerald-400" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-850">2-Step Verification</h1>
            <p className="mt-1.5 text-xs font-medium text-neutral-500 leading-relaxed">
              We have sent a one-time verification code to your email. Please enter the 6-digit code below to sign in.
            </p>
          </div>

          {/* Form */}
          <form 
            onSubmit={(e) => { e.preventDefault(); router.post('/two-factor', { code }); }}
            className="space-y-5"
          >
            {/* Verification Code Field */}
            <div className="space-y-2">
              <label className="block text-center text-[10px] font-semibold uppercase tracking-widest text-neutral-450">
                Verification Code
              </label>
              <input 
                className="w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-3 text-center text-lg font-semibold tracking-widest text-neutral-850 placeholder-neutral-300 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/5 shadow-premium-sm transition-all outline-none" 
                inputMode="numeric" 
                maxLength={6} 
                value={code} 
                onChange={(e) => setCode(e.target.value)} 
                placeholder="000000"
                required
              />
              {errors.code && <p className="mt-1 text-center text-xs font-medium text-rose-500">{errors.code}</p>}
            </div>

            {/* Submit Button */}
            <button 
              type="submit"
              className="w-full rounded-xl bg-neutral-950 py-3.5 text-xs font-semibold tracking-wide uppercase text-white shadow-md hover:bg-neutral-900 active:scale-98 transition-all cursor-pointer"
            >
              Verify & Sign In
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

