import { ArrowLeft, ShieldCheck, FileText, CheckCircle2 } from 'lucide-react';
import { Head, Link } from '@inertiajs/react';
import type React from 'react';

export default function Terms() {
  return (
    <div className="relative min-h-screen bg-slate-50/40 text-neutral-800 antialiased selection:bg-emerald-500 selection:text-white">
      {/* Background glow effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-0 right-0 translate-x-1/3 -translate-y-1/3 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-emerald-400/8 to-teal-500/8 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -translate-x-1/3 translate-y-1/3 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-emerald-400/5 to-teal-500/5 blur-3xl"></div>
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
            <FileText size={12} className="text-emerald-500" />
            Last Updated: May 2026
          </div>
        </div>

        {/* Hero title */}
        <div className="mb-12 text-center sm:text-left">
          <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900 sm:text-4xl">
            Terms of Service
          </h1>
          <p className="mt-4 text-sm font-semibold text-neutral-500 max-w-2xl leading-relaxed">
            Welcome to NiyAI ELMS. These Terms of Service outline the rules, conditions, and user guidelines regulating access and usage of our enterprise Leave Management System portal.
          </p>
        </div>

        {/* Content Box */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 sm:p-10 shadow-premium-lg space-y-8">
          <section className="space-y-3">
            <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 font-bold text-xs">1</span>
              Acceptance of Terms
            </h2>
            <p className="text-xs font-medium text-neutral-500 leading-relaxed pl-8">
              By authenticating and logging into NiyAI ELMS, you agree to comply with and be bound by these Terms of Service. If you are accessing this portal on behalf of an organization or enterprise client, you certify that you have the authority to act on their behalf and accept these conditions.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 font-bold text-xs">2</span>
              User Registration & Portal Integrity
            </h2>
            <p className="text-xs font-medium text-neutral-500 leading-relaxed pl-8">
              Accounts on NiyAI ELMS are enterprise-controlled and pre-authorized. You are solely responsible for maintaining the confidentiality of your session credentials, multi-factor codes, and account security. You agree not to bypass security frameworks, share authentication tokens, or engage in behavior that compromises system databases.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 font-bold text-xs">3</span>
              Authorized Usage & Submissions
            </h2>
            <p className="text-xs font-medium text-neutral-500 leading-relaxed pl-8">
              This platform must be used strictly for corporate leave administration, department scheduling, and balance checks. Any submitted materials (such as medical certificates, sick leave documentations, and holiday overrides) must be factual, accurate, and lawfully obtained. Falsification of documents or system usage for unauthorized activities will trigger immediate termination of portal privileges.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 font-bold text-xs">4</span>
              AI Copilot & Assistance Advisory
            </h2>
            <p className="text-xs font-medium text-neutral-500 leading-relaxed pl-8">
              NiyAI ELMS incorporates smart conversational models (AI Copilot) designed to summarize leave rules, draft applications, and outline calendar policies. While we strive to maintain absolute parity with corporate policy documents, AI-drafted prompts should be carefully reviewed before final submission. NiyAI is not liable for administrative overlaps or discrepancies resulting from automated summaries.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 font-bold text-xs">5</span>
              System Performance & Modifications
            </h2>
            <p className="text-xs font-medium text-neutral-500 leading-relaxed pl-8">
              We reserve the right to deploy regular system upgrades, database schema migrations, and frontend updates. NiyAI Technologies does not guarantee uninterrupted operation but promises proactive diagnostics, performance monitoring, and maximum uptime availability.
            </p>
          </section>

          <div className="border-t border-neutral-100 pt-8 flex items-center gap-3">
            <ShieldCheck size={20} className="text-emerald-500 shrink-0" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-450 leading-none">
              Secured & Managed by NiyAI Enterprise Solutions
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
