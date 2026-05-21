import { ArrowLeft, ShieldAlert, Lock, CheckCircle2 } from 'lucide-react';
import { Head, Link } from '@inertiajs/react';
import type React from 'react';

export default function Privacy() {
  return (
    <div className="relative min-h-screen bg-slate-50/40 text-neutral-800 antialiased selection:bg-emerald-500 selection:text-white">
      {/* Background glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-0 left-0 -translate-x-1/3 -translate-y-1/3 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-emerald-400/8 to-teal-500/8 blur-3xl"></div>
        <div className="absolute bottom-0 right-0 translate-x-1/3 translate-y-1/3 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-emerald-400/5 to-teal-500/5 blur-3xl"></div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-6 py-12 sm:py-20">
        {/* Navigation Header */}
        <div className="mb-10 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-bold text-neutral-500 hover:text-neutral-900 transition-colors uppercase tracking-wider group"
          >
            <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
            Back to Portal
          </Link>
          <div className="flex items-center gap-2 text-xs font-bold text-neutral-450 uppercase tracking-widest bg-neutral-200/50 px-3.5 py-1.5 rounded-xl border border-neutral-250/20">
            <Lock size={12} className="text-emerald-500" />
            GDPR Compliance
          </div>
        </div>

        {/* Title */}
        <div className="mb-12 text-center sm:text-left">
          <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900 sm:text-4xl">
            Privacy Policy
          </h1>
          <p className="mt-4 text-sm font-semibold text-neutral-500 max-w-2xl leading-relaxed">
            NiyAI ELMS is committed to safeguarding the privacy and security of your personnel records. This Privacy Policy details what information we collect, how it is secured, and user rights.
          </p>
        </div>

        {/* Content Box */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 sm:p-10 shadow-premium-lg space-y-8">
          <section className="space-y-3">
            <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 font-bold text-xs">1</span>
              Information We Collect
            </h2>
            <div className="text-xs font-medium text-neutral-500 leading-relaxed pl-8 space-y-2">
              <p>We process standard corporate and administrative employee metrics necessary for leave calculations:</p>
              <ul className="list-disc pl-4 space-y-1">
                <li><strong>Identity Metrics:</strong> Full name, corporate email address, and active department assignments.</li>
                <li><strong>Leave Submissions:</strong> Requested durations, leave type categories, written notes, and employee-uploaded documents (e.g. medical clearance certificates).</li>
                <li><strong>MFA & Authentication Data:</strong> Secure salted password hashes and temporary multi-factor session codes.</li>
                <li><strong>System logs:</strong> Login audits, AI interaction logs, and approval transaction records.</li>
              </ul>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 font-bold text-xs">2</span>
              How We Utilize Data
            </h2>
            <p className="text-xs font-medium text-neutral-500 leading-relaxed pl-8">
              We process data purely to facilitate leave tracking and administrative transparency: calculating holiday balances, populating team calendars to avoid department overlap, dispatching approval alerts to designated line managers, and optimizing system reliability.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 font-bold text-xs">3</span>
              Security & Storage Protocols
            </h2>
            <p className="text-xs font-medium text-neutral-500 leading-relaxed pl-8">
              All data payloads, profile records, and certificates are transmitted via HTTPS secure layers and stored behind encrypted PostgreSQL database instances. Access is strictly audited. Medical clearances uploaded by users are isolated within protected directories and accessible solely to authorized Human Resources personnel and designated managers.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 font-bold text-xs">4</span>
              Data Protection & Compliance Rights
            </h2>
            <p className="text-xs font-medium text-neutral-500 leading-relaxed pl-8">
              As an employee of an enterprise using NiyAI ELMS, you retain rights under relevant privacy laws to inspect your recorded balances, audit leave histories, request factual updates, or query AI log histories. For structural changes or balance overrides, contact your organization's designated HR Administrator.
            </p>
          </section>

          <div className="border-t border-neutral-100 pt-8 flex items-center gap-3">
            <ShieldAlert size={20} className="text-emerald-500 shrink-0" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-450 leading-none">
              ISO 27001 Structured Security Control Framework
            </span>
          </div>
        </div>

        {/* Mini Footer */}
        <div className="mt-12 text-center text-[10px] text-neutral-400 font-bold uppercase tracking-wider">
          &copy; {new Date().getFullYear()} NiyAI Data Co., Ltd. All rights reserved.
        </div>
      </div>
    </div>
  );
}
