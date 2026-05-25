import { Link, usePage } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import { 
  Bot, 
  CalendarDays, 
  ClipboardCheck, 
  ArrowRight, 
  CheckCircle2, 
  Activity, 
  Sparkles, 
  ChevronDown, 
  ChevronRight,
  ShieldAlert,
  Users,
  Compass,
  ArrowUpRight,
  Plus
} from 'lucide-react';
import type { PageProps } from '../types';

export default function Landing() {
  const { auth } = usePage<PageProps>().props;
  const user = auth?.user;

  // Interactive dashboard mock state
  const [activeTab, setActiveTab] = useState<'staff' | 'manager'>('staff');
  const [mockRequestApproved, setMockRequestApproved] = useState(false);
  const [showAiDraft, setShowAiDraft] = useState(false);
  const [chatStep, setChatStep] = useState<'initial' | 'draft' | 'submitted'>('initial');
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  // Auto-typing simulator for policy search
  const [searchText, setSearchText] = useState('');
  const fullSearchText = "How many annual leave days do I have left?";
  
  useEffect(() => {
    let index = 0;
    const interval = setInterval(() => {
      if (index < fullSearchText.length) {
        setSearchText((prev) => prev + fullSearchText.charAt(index));
        index++;
      } else {
        clearInterval(interval);
        setTimeout(() => setShowAiDraft(true), 600);
      }
    }, 55);

    return () => clearInterval(interval);
  }, []);

  const toggleFaq = (index: number) => {
    setActiveFaq(activeFaq === index ? null : index);
  };

  const faqs = [
    {
      q: "How does ELMS Copilot draft requests?",
      a: "ELMS Copilot uses natural language processing. Simply chat with it to check your balances, explain leave policies, or request a leave draft. Once ready, it generates a pre-filled submission form ready for your approval."
    },
    {
      q: "Can managers see team coverage before approving leave?",
      a: "Yes. Managers get a Team Center and approval dashboard with pending requests, upcoming leave, roster context, and calendar visibility so they can make approval decisions with coverage in mind."
    },
    {
      q: "How are leave balances calculated?",
      a: "Balances are calculated based on your contract type and hire date, with HR administrators capable of setting annual allowances and manually overriding balances for special carry-overs."
    },
    {
      q: "How does manager approval work?",
      a: "Submitted leave requests route to the employee's assigned manager. Managers can review dates, attachments, reason notes, and team coverage before approving or rejecting with a comment."
    }
  ];

  return (
    <div className="relative min-h-screen bg-slate-50/40 text-neutral-800 antialiased selection:bg-emerald-500 selection:text-white">
      {/* Ambient background glows wrapped in a clipped container to prevent height leakage */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-emerald-400/8 to-teal-500/8 blur-3xl"></div>
        <div className="absolute top-[35%] right-0 translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-gradient-to-br from-emerald-500/5 to-teal-600/5 blur-3xl"></div>
        <div className="absolute bottom-0 left-[15%] translate-y-1/2 h-[400px] w-[400px] rounded-full bg-gradient-to-tr from-emerald-400/5 to-teal-400/5 blur-3xl"></div>
      </div>

      {/* Navigation Header */}
      <header className="sticky top-0 z-40 w-full border-b border-neutral-200/50 bg-white/70 backdrop-blur-md transition-all">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 sm:px-8">
          {/* Logo */}
          <div className="flex items-center gap-3 select-none">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-600/10 border border-emerald-500/10">
              <Bot size={18} className="text-white" />
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight text-neutral-900 leading-none">NiyAI ELMS</div>
              <div className="text-[9px] font-semibold text-neutral-450 uppercase tracking-widest mt-1">Leave Portal</div>
            </div>
          </div>

          {/* Nav links (Visual anchors) */}
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-xs font-semibold text-neutral-500 hover:text-neutral-900 transition-colors">Features</a>
            <a href="#preview" className="text-xs font-semibold text-neutral-500 hover:text-neutral-900 transition-colors">Interactive Demo</a>
            <a href="#faq" className="text-xs font-semibold text-neutral-500 hover:text-neutral-900 transition-colors">Policies & FAQ</a>
            <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 border border-emerald-100/60 shadow-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Platform Active
            </div>
          </nav>

          {/* Dynamic CTA */}
          <div>
            {user ? (
              <Link
                href="/dashboard"
                className="flex items-center gap-1.5 rounded-xl bg-neutral-800 px-4.5 py-2 text-xs font-semibold text-white hover:bg-neutral-700 shadow-md hover:shadow-premium-md active:scale-98 transition-all"
              >
                Go to Dashboard <ArrowUpRight size={14} className="text-emerald-400" />
              </Link>
            ) : (
              <Link
                href="/login"
                className="flex items-center gap-1 rounded-xl bg-neutral-800 px-4.5 py-2.5 text-xs font-semibold text-white hover:bg-neutral-700 shadow-md hover:shadow-premium-md active:scale-98 transition-all"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 pt-16 pb-12 sm:px-8 sm:pt-24 lg:grid lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-6 flex flex-col justify-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50/50 px-3.5 py-1.5 text-xs font-bold text-emerald-800 shadow-premium-sm mb-6 w-fit">
            <Sparkles size={13} className="text-emerald-600" /> Introducing intelligent Leave Planning
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight text-neutral-900 sm:text-5xl lg:text-5.5xl leading-[1.12]">
            Elevate Leave Operations.<br />
            <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
              Simplify Employee Workflows.
            </span>
          </h1>

          <p className="mt-6 max-w-lg text-sm sm:text-base font-medium leading-relaxed text-neutral-500">
            An AI-powered Employee Leave Management System designed to orchestrate holiday schedules, automate approvals, and maintain department synchronization in real-time.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {user ? (
              <Link
                href="/dashboard"
                className="flex h-12 items-center justify-center gap-2 rounded-xl bg-neutral-800 px-6 font-semibold text-white hover:bg-neutral-700 shadow-md hover:shadow-premium-lg active:scale-98 transition-all"
              >
                Access Dashboard <ArrowRight size={15} className="text-emerald-400" />
              </Link>
            ) : (
              <Link
                href="/login"
                className="flex h-12 items-center justify-center gap-2 rounded-xl bg-neutral-800 px-6 font-semibold text-white hover:bg-neutral-700 shadow-md hover:shadow-premium-lg active:scale-98 transition-all"
              >
                Access Leave Portal <ArrowRight size={15} className="text-emerald-400" />
              </Link>
            )}
            <a 
              href="#preview" 
              className="flex h-12 items-center justify-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-6 font-semibold text-neutral-600 hover:bg-neutral-50 active:scale-98 transition-all shadow-premium-sm"
            >
              Interactive Demo
            </a>
          </div>

          <div className="mt-12 flex flex-col sm:flex-row sm:items-center gap-6 sm:gap-8 border-t border-neutral-200/60 pt-8">
            <div className="flex-1">
              <div className="text-2xl font-bold text-neutral-900">100%</div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400 mt-0.5">Automated Audits</div>
            </div>
            <div className="hidden sm:block h-8 w-px bg-neutral-200"></div>
            <div className="flex-1">
              <div className="text-2xl font-bold text-neutral-900">&lt; 30 min</div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400 mt-0.5">Average Approval</div>
            </div>
            <div className="hidden sm:block h-8 w-px bg-neutral-200"></div>
            <div className="flex-1">
              <div className="text-2xl font-bold text-neutral-900">Active</div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400 mt-0.5">ELMS Copilot</div>
            </div>
          </div>
        </div>

        {/* CSS Mockup Representation of Portal (Right side) */}
        <div className="lg:col-span-6 mt-12 lg:mt-0 relative flex justify-center items-center">
          <div className="w-full max-w-lg rounded-2xl border border-neutral-200 bg-white shadow-premium-lg overflow-hidden animate-fade-in">
            {/* Mock Header */}
            <div className="flex items-center justify-between border-b border-neutral-100 bg-neutral-50/50 px-5 py-3">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              </div>
              <div className="rounded-lg bg-neutral-200/50 px-4 py-1 text-[10px] font-semibold text-neutral-500">
                sarana.online/dashboard
              </div>
              <div className="w-6" />
            </div>

            {/* Mock Interface Content */}
            <div className="p-5 space-y-4">
              {/* Balances widgets */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-3 shadow-premium-sm">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-emerald-800">Annual Leave</div>
                  <div className="mt-1.5 flex items-baseline gap-1">
                    <span className="text-lg font-bold text-emerald-950">14.5</span>
                    <span className="text-[9px] font-medium text-emerald-700">days left</span>
                  </div>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-emerald-100 overflow-hidden">
                    <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500" />
                  </div>
                </div>
                <div className="rounded-xl border border-amber-100 bg-amber-50/30 p-3 shadow-premium-sm">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-amber-800">Sick Leave</div>
                  <div className="mt-1.5 flex items-baseline gap-1">
                    <span className="text-lg font-bold text-amber-950">8.0</span>
                    <span className="text-[9px] font-medium text-amber-700">days left</span>
                  </div>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-amber-100 overflow-hidden">
                    <div className="h-full w-4/5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500" />
                  </div>
                </div>
                <div className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-3 shadow-premium-sm">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-neutral-500">Unpaid Leave</div>
                  <div className="mt-1.5 flex items-baseline gap-1">
                    <span className="text-lg font-bold text-neutral-850">0.0</span>
                    <span className="text-[9px] font-medium text-neutral-450">days used</span>
                  </div>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-neutral-200" />
                </div>
              </div>

              {/* simulated AI Chat Assistant Box */}
              <div className="rounded-xl border border-neutral-200/80 bg-white p-3.5 shadow-premium-sm">
                <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
                  <div className="flex items-center gap-2">
                    <Bot size={14} className="text-emerald-600" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-700">ELMS Copilot</span>
                  </div>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                
                <div className="mt-2.5 space-y-2.5 text-[11px] leading-relaxed">
                  {/* Step 1: Initial Question */}
                  <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-100/40 px-3 py-1.5 font-semibold">
                      {searchText || "How many annual leave days do I have left?"}
                    </div>
                  </div>

                  {showAiDraft && (
                    <>
                      {/* AI Initial Response */}
                      <div className="flex justify-start animate-fade-in">
                        <div className="max-w-[90%] space-y-2">
                          <div className="rounded-xl bg-neutral-50/60 border border-neutral-200/50 px-3 py-2 text-neutral-600 font-medium">
                            🤖 Based on NiyAI handbook, you have <strong className="font-bold text-neutral-900">14.5 days</strong> of Annual Leave remaining. Would you like me to draft a request for you?
                          </div>
                          
                          {chatStep === 'initial' && (
                            <div className="flex items-center gap-1.5">
                              <button 
                                className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1 text-[9px] font-bold text-white transition-all cursor-pointer shadow-premium-sm"
                                onClick={() => setChatStep('draft')}
                              >
                                Yes, draft it
                              </button>
                              <button className="rounded-lg bg-white border border-neutral-200/80 hover:bg-neutral-50 px-2 py-1 text-[9px] font-semibold text-neutral-600 transition-all cursor-pointer shadow-premium-sm">
                                No, thank you
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Step 2: User responds Yes, draft it */}
                      {chatStep !== 'initial' && (
                        <div className="flex justify-end animate-fade-in">
                          <div className="max-w-[85%] rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-100/40 px-3 py-1.5 font-semibold">
                            Yes, draft it
                          </div>
                        </div>
                      )}

                      {/* AI Response: Draft Card & submission flow */}
                      {chatStep !== 'initial' && (
                        <div className="flex justify-start animate-fade-in">
                          <div className="max-w-[95%] space-y-2">
                            <div className="rounded-xl bg-neutral-50/60 border border-neutral-200/50 p-4 text-neutral-600 font-medium space-y-3.5 text-left shadow-premium-sm">
                              <div className="flex items-center gap-2 border-b border-neutral-100 pb-2">
                                <Bot size={14} className="text-emerald-600" />
                                <span className="font-bold text-neutral-800 text-[10px] uppercase tracking-wider">Leave Draft Ready</span>
                              </div>
                              
                              <div className="grid grid-cols-3 gap-2">
                                <div className="rounded-xl border border-neutral-200 bg-white p-2.5">
                                  <div className="text-[8px] font-bold uppercase tracking-wider text-neutral-400">Type</div>
                                  <div className="mt-1 font-bold text-[10px] text-neutral-800">Annual</div>
                                </div>
                                <div className="rounded-xl border border-neutral-200 bg-white p-2.5">
                                  <div className="text-[8px] font-bold uppercase tracking-wider text-neutral-400">Start</div>
                                  <div className="mt-1 font-bold text-[10px] text-neutral-800">Jun 15</div>
                                </div>
                                <div className="rounded-xl border border-neutral-200 bg-white p-2.5">
                                  <div className="text-[8px] font-bold uppercase tracking-wider text-neutral-400">End</div>
                                  <div className="mt-1 font-bold text-[10px] text-neutral-800">Jun 19</div>
                                </div>
                              </div>

                              <div className="rounded-xl border border-neutral-200 bg-white p-2.5">
                                <div className="text-[8px] font-bold uppercase tracking-wider text-neutral-400">Application Note</div>
                                <div className="mt-1 text-[9.5px] font-medium leading-relaxed text-neutral-600">
                                  Family trip and summer vacation.
                                </div>
                              </div>

                              {chatStep === 'draft' ? (
                                <button
                                  onClick={() => setChatStep('submitted')}
                                  className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-[10px] font-bold text-white transition-all cursor-pointer shadow-premium-sm flex items-center justify-center gap-1.5"
                                >
                                  Submit Request
                                </button>
                              ) : (
                                <div className="text-center py-2 text-[10px] font-bold text-emerald-700 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center justify-center gap-1.5 animate-fade-in">
                                  <CheckCircle2 size={12} className="text-emerald-600" /> Submitted Successfully!
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Bottom request queue panel */}
              <div className="rounded-xl border border-neutral-200 bg-white p-3 shadow-premium-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Upcoming Schedule</span>
                  <span className="text-[10px] font-semibold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 size={10} /> Active Plan
                  </span>
                </div>
                
                {/* Live simulated draft request appearing in schedule after submission */}
                {chatStep === 'submitted' && (
                  <div className="flex flex-row items-center justify-between gap-2 flex-wrap border-t border-neutral-100 py-2.5 text-xs animate-fade-in">
                    <div className="flex items-center gap-2">
                       <CalendarDays size={13} className="text-neutral-400" />
                       <div>
                         <div className="font-semibold text-neutral-850">Summer Vacation</div>
                         <div className="text-[10px] font-medium text-neutral-450">Jun 15 - Jun 19 (5 days)</div>
                       </div>
                    </div>
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-bold text-amber-700 border border-amber-100">
                      Pending Approval
                    </span>
                  </div>
                )}

                <div className="flex flex-row items-center justify-between gap-2 flex-wrap border-t border-neutral-100 pt-2.5 text-xs">
                  <div className="flex items-center gap-2">
                    <CalendarDays size={13} className="text-neutral-400" />
                    <div>
                      <div className="font-semibold text-neutral-800">Summer Vacation</div>
                      <div className="text-[10px] font-medium text-neutral-450">Jun 14 - Jun 18 (5 days)</div>
                    </div>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700 border border-emerald-100">
                    Approved
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid Section */}
      <section id="features" className="relative z-10 border-t border-b border-neutral-200/40 bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-6 sm:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-600">Enterprise Ready</h2>
            <p className="mt-3 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
              Precision built for modern workspaces
            </p>
            <p className="mt-4 text-sm font-medium text-neutral-500">
              NiyAI ELMS replaces clumsy spreadsheets and disjointed chains of emails with a unified, state-of-the-art platform.
            </p>
          </div>

          <div className="mx-auto mt-16 max-w-5xl grid grid-cols-1 gap-8 sm:grid-cols-3">
            {/* Feature 1 */}
            <div className="relative rounded-2xl border border-neutral-200 bg-[#fafbfa]/40 p-6.5 shadow-premium-sm transition-all hover:bg-white hover:shadow-premium-md group">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-md shadow-emerald-500/10 group-hover:scale-105 transition-all">
                <Bot size={20} />
              </div>
              <h3 className="mt-5 text-sm font-bold text-neutral-900">ELMS Copilot Integration</h3>
              <p className="mt-2.5 text-xs font-medium leading-relaxed text-neutral-500">
                Verify complex company policy rules, calculate prorated allowances, and construct drafts through conversational prompts.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="relative rounded-2xl border border-neutral-200 bg-[#fafbfa]/40 p-6.5 shadow-premium-sm transition-all hover:bg-white hover:shadow-premium-md group">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600 text-white shadow-md shadow-teal-600/10 group-hover:scale-105 transition-all">
                <CalendarDays size={20} />
              </div>
              <h3 className="mt-5 text-sm font-bold text-neutral-900">Interactive Team Calendars</h3>
              <p className="mt-2.5 text-xs font-medium leading-relaxed text-neutral-500">
                Visualize overlaps instantly. Seamless department filters prevent short-staffing while managing comprehensive scheduling.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="relative rounded-2xl border border-neutral-200 bg-[#fafbfa]/40 p-6.5 shadow-premium-sm transition-all hover:bg-white hover:shadow-premium-md group">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-600/10 group-hover:scale-105 transition-all">
                <ClipboardCheck size={20} />
              </div>
              <h3 className="mt-5 text-sm font-bold text-neutral-900">Smart Leave Routing</h3>
              <p className="mt-2.5 text-xs font-medium leading-relaxed text-neutral-500">
                One-click emails and dashboard alerts for managers. Track history, add comments, and approve instantly without bottleneck.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Demonstration Demo Component */}
      <section id="preview" className="relative z-10 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-6 sm:px-8">
          <div className="mx-auto max-w-2xl text-center mb-12">
            <span className="rounded-full bg-emerald-100/60 border border-emerald-200/50 px-3 py-1 text-[10px] font-bold text-emerald-800">
              Interactive Preview
            </span>
            <h2 className="mt-3.5 text-3xl font-extrabold tracking-tight text-neutral-900 sm:text-4xl">
              See the workflow in action
            </h2>
            <p className="mt-3.5 text-sm font-medium text-neutral-500">
              Experience both sides of the system. Switch views below to see how requests flow seamlessly from employees to team managers.
            </p>
          </div>

          <div className="mx-auto max-w-4xl rounded-2xl border border-neutral-200 bg-white p-6 shadow-premium-lg relative overflow-hidden">
            {/* View Selector Tabs */}
            <div className="flex border-b border-neutral-200 pb-4 justify-between items-center flex-wrap gap-4">
              <div className="grid grid-cols-2 gap-2 w-full sm:w-auto sm:flex sm:items-center">
                <button
                  onClick={() => setActiveTab('staff')}
                  className={`flex items-center justify-center sm:justify-start gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'staff'
                      ? 'bg-emerald-600 text-white shadow-premium-sm'
                      : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50'
                  }`}
                >
                  <Users size={14} /> <span className="truncate">Staff View</span>
                </button>
                <button
                  onClick={() => setActiveTab('manager')}
                  className={`flex items-center justify-center sm:justify-start gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'manager'
                      ? 'bg-emerald-600 text-white shadow-premium-sm'
                      : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50'
                  }`}
                >
                  <ClipboardCheck size={14} /> <span className="truncate">Manager View</span>
                </button>
              </div>

              <div className="text-[10px] text-neutral-450 font-semibold uppercase tracking-wider flex items-center gap-1.5 w-full sm:w-auto justify-center sm:justify-start">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                Live simulator
              </div>
            </div>

            {/* TAB CONTENTS */}
            <div className="mt-6">
              {activeTab === 'staff' ? (
                <div className="space-y-6 animate-fade-in">
                  <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div>
                      <h4 className="text-sm font-bold text-neutral-850">Staff's Leave Dashboard</h4>
                      <p className="text-[11px] font-semibold text-neutral-400 mt-0.5">Staff Portal · Engineering Dept</p>
                    </div>

                    <div className="flex gap-2">
                      <span className="rounded-xl border border-neutral-200 bg-neutral-50/50 px-3.5 py-1.5 text-xs font-semibold text-neutral-700 flex items-center gap-1.5">
                        Role: Staff
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="rounded-xl border border-neutral-100 bg-[#fafbfa]/80 p-4">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Total Allowance</div>
                      <div className="text-xl font-bold text-neutral-800 mt-1">25.0 days</div>
                      <div className="text-[10px] font-medium text-neutral-400 mt-1">Fiscal Year 2026</div>
                    </div>
                    <div className="rounded-xl border border-neutral-100 bg-[#fafbfa]/80 p-4">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Approved Leave</div>
                      <div className="text-xl font-bold text-emerald-700 mt-1">10.5 days</div>
                      <div className="text-[10px] font-medium text-emerald-500 mt-1">Calculated instantly</div>
                    </div>
                    <div className="rounded-xl border border-neutral-100 bg-[#fafbfa]/80 p-4">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800">Pending Approval</div>
                      <div className="text-xl font-bold text-amber-700 mt-1">
                        {mockRequestApproved ? '0.0 days' : '3.0 days'}
                      </div>
                      <div className="text-[10px] font-medium text-amber-500 mt-1">
                        {mockRequestApproved ? 'Queue clear' : "Awaiting Manager's review"}
                      </div>
                    </div>
                  </div>

                  {/* Active Request Simulation */}
                  <div className="rounded-xl border border-neutral-200/60 bg-white p-4.5 shadow-premium-sm">
                    <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-2 border-b border-neutral-100 pb-3 mb-3">
                      <span className="text-xs font-bold text-neutral-800">Recent Leave Request Submission</span>
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold border transition-colors ${
                        mockRequestApproved 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                          : 'bg-amber-50 text-amber-700 border-amber-100'
                      }`}>
                        {mockRequestApproved ? 'Approved' : 'Pending Approval'}
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-medium text-neutral-500">
                      <div className="space-y-1">
                        <div className="font-bold text-neutral-800">Sick Leave (Medical recovery)</div>
                        <div>Schedule: May 25 – May 28 (3.0 requested days)</div>
                        <div className="text-[10px] text-neutral-400">Submitted: Today · Handled via ELMS Copilot</div>
                      </div>

                      {!mockRequestApproved && (
                        <button
                          onClick={() => setActiveTab('manager')}
                          className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2 text-[11px] font-semibold text-white flex items-center gap-1 shrink-0 select-none self-start sm:self-center shadow-md shadow-emerald-600/10 cursor-pointer active:scale-98 transition-all"
                        >
                          Switch to Manager to Approve <ChevronRight size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6 animate-fade-in">
                  <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-bold text-neutral-850">Manager's Approval Desk</h4>
                      <p className="text-[11px] font-semibold text-neutral-400 mt-0.5">Manager Dashboard · Engineering Lead</p>
                    </div>
                    <span className="rounded-xl border border-neutral-200 bg-neutral-50/50 px-3 py-1.5 text-xs font-semibold text-neutral-700 self-start xs:self-center">
                      Active Queue: {mockRequestApproved ? '0' : '1'} request
                    </span>
                  </div>

                  {mockRequestApproved ? (
                    <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50/40 p-8 text-center animate-fade-in">
                      <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 mb-3 border border-emerald-100">
                        <CheckCircle2 size={18} />
                      </div>
                      <h5 className="text-xs font-bold text-neutral-800">Leave approval completed!</h5>
                      <p className="text-[11px] text-neutral-400 mt-1">
                        The Staff's request has been updated. The Manager's inbox is empty.
                      </p>
                      <button
                        onClick={() => {
                          setMockRequestApproved(false);
                          setActiveTab('staff');
                          setChatStep('initial');
                        }}
                        className="mt-4 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-[10px] font-bold text-neutral-600 hover:bg-neutral-50 transition-colors shadow-xs"
                      >
                        Reset Demo
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-neutral-200 bg-neutral-50/30 p-4.5 space-y-3.5 animate-fade-in">
                      <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7.5 w-7.5 items-center justify-center rounded-lg bg-emerald-100 font-bold text-emerald-800 text-[10px]">
                            SE
                          </div>
                          <div>
                            <div className="text-xs font-bold text-neutral-850">Software Engineer</div>
                            <div className="text-[10px] font-semibold text-neutral-400">Engineering Dept</div>
                          </div>
                        </div>
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-bold text-amber-700 border border-amber-100 self-start xs:self-center">
                          Needs Decision
                        </span>
                      </div>

                      <div className="border-t border-neutral-200/60 pt-3 flex flex-col sm:flex-row justify-between gap-3 text-xs font-medium text-neutral-500">
                        <div className="space-y-1">
                          <div className="font-bold text-neutral-800">Sick Leave Request · 3.0 days</div>
                          <div>Dates: May 25 – May 28 (Mon - Thu)</div>
                          <div className="text-[10px] font-semibold text-rose-600 flex items-center gap-1 mt-1">
                            <ShieldAlert size={11} /> No calendar conflicts detected for this period.
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                          <button
                            onClick={() => setMockRequestApproved(true)}
                            className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2 text-[11px] font-semibold text-white shadow-premium-sm select-none active:scale-97 transition-all"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => {
                              alert("In the live platform, this rejects the leave request and triggers a comment prompt.");
                            }}
                            className="rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 px-3.5 py-2 text-[11px] font-semibold text-neutral-600 shadow-premium-sm"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Accordion FAQ Section */}
      <section id="faq" className="relative z-10 border-t border-neutral-200/40 bg-white/40 py-20 sm:py-24">
        <div className="mx-auto max-w-3xl px-6 sm:px-8">
          <div className="text-center mb-16">
            <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-600">Company Policies</h2>
            <p className="mt-3.5 text-3xl font-extrabold tracking-tight text-neutral-900 sm:text-4xl">
              Frequently Asked Questions
            </p>
            <p className="mt-4 text-sm font-medium text-neutral-500">
              Got questions about guidelines, leaves, and approvals? Check out our quick answers below.
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => (
              <div 
                key={idx} 
                className="rounded-2xl border border-neutral-200 bg-white shadow-premium-sm overflow-hidden transition-all"
              >
                <button
                  onClick={() => toggleFaq(idx)}
                  className="flex w-full items-center justify-between p-5 text-left font-bold text-neutral-800 hover:bg-neutral-50/50 transition-colors"
                >
                  <span className="text-sm font-bold text-neutral-850 pr-4">{faq.q}</span>
                  <div className="shrink-0 rounded-lg bg-neutral-100 p-1 text-neutral-500">
                    {activeFaq === idx ? <ChevronDown size={14} className="rotate-180 transition-transform duration-200" /> : <ChevronDown size={14} className="transition-transform duration-200" />}
                  </div>
                </button>

                {activeFaq === idx && (
                  <div className="border-t border-neutral-100 p-5 text-xs font-medium leading-relaxed text-neutral-500 animate-fade-in">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Corporate Call to Action Footer */}
      <section className="relative z-10 border-t border-neutral-200/60 bg-neutral-50/60 text-neutral-800 py-16">
        <div className="mx-auto max-w-7xl px-6 text-center sm:px-8">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-600/10 border border-emerald-500/10 mb-6">
            <Bot size={20} className="text-white" />
          </div>
          
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl text-neutral-850">
            Ready to streamline leave administration?
          </h2>
          <p className="mx-auto mt-4 max-w-md text-xs font-semibold text-neutral-500 leading-relaxed">
            NiyAI ELMS is private, corporate-controlled leave portal. Authenticate with your secure company profile to begin managing schedules.
          </p>

          <div className="mt-8 flex justify-center">
            {user ? (
              <Link
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 shadow-md hover:shadow-premium-md active:scale-98 transition-all"
                href="/dashboard"
              >
                Access Portal <ArrowRight size={13} />
              </Link>
            ) : (
              <Link
                className="flex items-center gap-1 rounded-xl bg-emerald-600 px-4.5 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700 shadow-md hover:shadow-premium-md active:scale-98 transition-all"
                href="/login"
              >             Sign In to Portal <ArrowRight size={14} />
              </Link>
            )}
          </div>

          <div className="mt-16 border-t border-neutral-200/60 pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-[10px] text-neutral-450 font-bold uppercase tracking-wider">
            <div>
              &copy; {new Date().getFullYear()} NiyAI Data Co., Ltd. All rights reserved.
            </div>
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 md:justify-end">
              <Link href="/privacy" className="hover:text-emerald-700 transition-colors">Privacy Policy</Link>
              <Link href="/terms" className="hover:text-emerald-700 transition-colors">Terms of Service</Link>
              <Link href="/support" className="hover:text-emerald-700 transition-colors">Support Desk</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
