import { ArrowLeft, Send, CheckCircle2, MessageSquare, AlertCircle, Loader2 } from 'lucide-react';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import type React from 'react';
import { useEffect, useState } from 'react';

type PageProps = {
  auth?: {
    user?: {
      id: number;
      name: string;
      email: string;
    };
  };
  flash?: {
    success?: string;
  };
};

export default function Support() {
  const { auth, flash } = usePage<any>().props;
  const user = auth?.user;
  const returnHref = user ? '/dashboard' : '/';
  const returnLabel = user ? 'Back to Dashboard' : 'Back to Home';
  
  const [submittedSuccessfully, setSubmittedSuccessfully] = useState(false);

  const { data, setData, post, processing, errors, reset } = useForm({
    name: user?.name ?? '',
    email: user?.email ?? '',
    subject: '',
    message: '',
  });

  // Pre-fill if auth status changes
  useEffect(() => {
    if (user) {
      setData((current) => ({
        ...current,
        name: user.name,
        email: user.email,
      }));
    }
  }, [user]);

  // Monitor flash messages to trigger the success screen
  useEffect(() => {
    if (flash?.success) {
      setSubmittedSuccessfully(true);
      reset('subject', 'message');
    }
  }, [flash]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    post('/support', {
      preserveScroll: true,
      onSuccess: () => {
        setSubmittedSuccessfully(true);
      },
    });
  }

  return (
    <div className="relative min-h-screen bg-slate-50/40 text-neutral-800 antialiased selection:bg-orange-500 selection:text-white">
      <Head title="Help Desk" />
      {/* Dynamic Background Glow elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-0 right-0 translate-x-1/3 -translate-y-1/3 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-orange-400/8 to-amber-500/8 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -translate-x-1/3 translate-y-1/3 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-orange-400/5 to-amber-500/5 blur-3xl"></div>
      </div>

      <div className="relative z-10 max-w-2xl mx-auto px-6 py-12 sm:py-20">
        {/* Navigation Header */}
        <div className="mb-10 flex items-center justify-between">
          <Link
            href={returnHref}
            className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-500 hover:text-neutral-900 transition-colors uppercase tracking-wider group"
          >
            <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
            {returnLabel}
          </Link>
          <div className="flex items-center gap-2.5 text-sm font-semibold text-neutral-400 uppercase tracking-wider bg-neutral-200/50 px-4 py-2 rounded-lg border border-neutral-200/20">
            <MessageSquare size={12} className="text-orange-500" />
            Help Desk
          </div>
        </div>

        {/* Header Intro */}
        {!submittedSuccessfully && (
          <div className="mb-12 text-center sm:text-left">
            <h1 className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
              NiyAI Help Desk
            </h1>
            <p className="mt-4 text-sm font-medium text-neutral-500 max-w-lg leading-relaxed">
              Locked out? Encountering leave calculation discrepancies? Or need a quick admin manual? Send an inquiry and our team will check it out.
            </p>
          </div>
        )}

        {/* Content Box */}
        <div className="rounded-xl border border-neutral-200 bg-white p-6 sm:p-10 shadow-premium-lg">
          {submittedSuccessfully ? (
            <div className="text-center py-6 space-y-6 animate-fade-in">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-orange-50 border border-orange-100 text-orange-600 shadow-premium-sm">
                <CheckCircle2 size={28} />
              </div>
              <div className="space-y-2.5">
                <h2 className="text-xl font-semibold text-neutral-900">Inquiry Logged Successfully</h2>
                <p className="text-sm font-medium text-neutral-500 max-w-md mx-auto leading-relaxed">
                  {flash?.success ?? "Thank you! We have received your inquiry and our support team will contact you shortly."}
                </p>
              </div>
              <div className="pt-4 border-t border-neutral-100 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={() => setSubmittedSuccessfully(false)}
                  className="w-full sm:w-auto px-6 py-3 rounded-lg border border-neutral-200 hover:border-neutral-300 text-sm font-semibold text-neutral-600 transition-all select-none"
                >
                  Submit Another Ticket
                </button>
                <Link
                  href={returnHref}
                  className="w-full sm:w-auto px-6 py-3 rounded-lg bg-orange-600 hover:bg-orange-700 text-sm font-semibold text-white transition-all text-center select-none shadow-md shadow-orange-600/10"
                >
                  {user ? 'Return to Dashboard' : 'Return to Home'}
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Form Grid */}
              <div className="grid gap-6 sm:grid-cols-2">
                {/* Name */}
                <div className="space-y-2">
                  <label htmlFor="name" className="block text-sm font-semibold uppercase tracking-wider text-neutral-500">
                    Full Name
                  </label>
                  <input
                    id="name"
                    type="text"
                    required
                    disabled={!!user}
                    placeholder="Jane Doe"
                    value={data.name}
                    onChange={(e) => setData('name', e.target.value)}
                    className="w-full rounded-lg border border-neutral-200 bg-neutral-50/50 px-4 py-3 text-sm text-neutral-800 placeholder-neutral-400 focus:bg-white focus:border-orange-500 outline-none disabled:bg-neutral-100/70 disabled:text-neutral-400"
                  />
                  {errors.name && (
                    <div className="text-xs font-medium text-rose-600 flex items-center gap-1.5 mt-1">
                      <AlertCircle size={12} />
                      {errors.name}
                    </div>
                  )}
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <label htmlFor="email" className="block text-sm font-semibold uppercase tracking-wider text-neutral-500">
                    Corporate Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    disabled={!!user}
                    placeholder="jane.doe@company.com"
                    value={data.email}
                    onChange={(e) => setData('email', e.target.value)}
                    className="w-full rounded-lg border border-neutral-200 bg-neutral-50/50 px-4 py-3 text-sm text-neutral-800 placeholder-neutral-400 focus:bg-white focus:border-orange-500 outline-none disabled:bg-neutral-100/70 disabled:text-neutral-400"
                  />
                  {errors.email && (
                    <div className="text-xs font-medium text-rose-600 flex items-center gap-1.5 mt-1">
                      <AlertCircle size={12} />
                      {errors.email}
                    </div>
                  )}
                </div>
              </div>

              {/* Subject */}
              <div className="space-y-2">
                <label htmlFor="subject" className="block text-sm font-semibold uppercase tracking-wider text-neutral-500">
                  Subject
                </label>
                <input
                  id="subject"
                  type="text"
                  required
                  placeholder="e.g. Multi-Factor code not received"
                  value={data.subject}
                  onChange={(e) => setData('subject', e.target.value)}
                  className="w-full rounded-lg border border-neutral-200 bg-neutral-50/50 px-4 py-3 text-sm text-neutral-800 placeholder-neutral-400 focus:bg-white focus:border-orange-500 outline-none"
                />
                {errors.subject && (
                  <div className="text-xs font-medium text-rose-600 flex items-center gap-1.5 mt-1">
                    <AlertCircle size={12} />
                    {errors.subject}
                  </div>
                )}
              </div>

              {/* Message */}
              <div className="space-y-2">
                <label htmlFor="message" className="block text-sm font-semibold uppercase tracking-wider text-neutral-500">
                  Detailed Message
                </label>
                <textarea
                  id="message"
                  required
                  rows={5}
                  placeholder="Explain your technical issue or balance inquiry as clearly as possible..."
                  value={data.message}
                  onChange={(e) => setData('message', e.target.value)}
                  className="w-full rounded-lg border border-neutral-200 bg-neutral-50/50 px-4 py-3 text-sm text-neutral-800 placeholder-neutral-400 focus:bg-white focus:border-orange-500 outline-none resize-y"
                />
                {errors.message && (
                  <div className="text-xs font-medium text-rose-600 flex items-center gap-1.5 mt-1">
                    <AlertCircle size={12} />
                    {errors.message}
                  </div>
                )}
              </div>

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={processing}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-orange-600 hover:bg-orange-700 disabled:bg-neutral-200 disabled:text-neutral-400 py-3.5 text-sm font-semibold text-white transition-all shadow-md shadow-orange-600/10 active:scale-98 select-none"
              >
                {processing ? (
                  <>
                    <Loader2 size={14} className="animate-spin text-neutral-400" />
                    Submitting Inquiry...
                  </>
                ) : (
                  <>
                    Submit Ticket <Send size={12} />
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Footer Disclaimer */}
        <div className="mt-12 text-center text-xs text-neutral-400 font-medium uppercase tracking-wider">
          &copy; {new Date().getFullYear()} NiyAI Data Co., Ltd. All rights reserved.
        </div>
      </div>
    </div>
  );
}
