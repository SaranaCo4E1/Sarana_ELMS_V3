import { Link, router, usePage } from '@inertiajs/react';
import {
  Bell,
  Bot,
  CalendarCheck,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  LayoutDashboard,
  Lock,
  LogOut,
  Mail,
  Send,
  Settings,
  ShieldCheck,
  User2,
  X,
  XCircle,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { PageProps } from '../types';

type Notification = { id: number; title: string; body: string; created_at: string; type?: string; reference_id?: number | null };
type Faq = { id: number; question: string; answer: string };

type Props = {
  children: React.ReactNode;
  notifications?: Notification[];
  faqs?: Faq[];
};

export default function AppLayout({ children, notifications: initialNotifications = [], faqs = [] }: Props) {
  const page = usePage<PageProps>();
  const { auth, flash, errors } = page.props;
  const pageUrl = page.url;
  const user = auth.user;
  const mustChangePassword = auth.must_change_password ?? false;
  const canApprove = ['manager', 'hr', 'admin'].includes(user.role);
  const canAdmin = ['hr', 'admin'].includes(user.role);

  const [notifications, setNotifications] = useState(initialNotifications);
  const [bellOpen, setBellOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileModal, setProfileModal] = useState(false);
  const [passwordModal, setPasswordModal] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setNotifications(initialNotifications); }, [initialNotifications]);

  function markRead(n: Notification) {
    setNotifications((prev) => prev.filter((x) => x.id !== n.id));
    fetch(`/notifications/${n.id}/read`, {
      method: 'PATCH',
      headers: { 'X-CSRF-TOKEN': document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '', 'Accept': 'application/json' },
    });
  }

  const photoUrl = user.profile_photo ? `/storage/${user.profile_photo}` : null;
  const initials = user.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const navCls = (active: boolean) =>
    `flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] transition-colors ${
      active
        ? 'bg-emerald-50 font-semibold text-emerald-700'
        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
    }`;

  return (
    <div className="min-h-screen bg-[#f6f7f9]">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 bg-white px-4 py-5 lg:flex lg:flex-col">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-700 text-white">
            <CalendarCheck size={20} />
          </div>
          <div>
            <div className="font-semibold text-slate-950">ELMS</div>
            <div className="text-[11px] text-slate-500">Staff operations</div>
          </div>
        </div>

        <nav className="mt-8 flex flex-1 flex-col gap-1">
          <Link className={navCls(pageUrl === '/')} href="/">
            <LayoutDashboard size={17} /> Dashboard
          </Link>
          <Link className={navCls(pageUrl.startsWith('/leave-requests'))} href="/leave-requests">
            <FileText size={17} /> Leave Request
          </Link>

          {(canApprove || canAdmin) && <div className="my-3 border-t border-slate-100" />}

          {canApprove && (
            <Link className={navCls(pageUrl.startsWith('/approvals'))} href="/approvals">
              <ClipboardCheck size={17} /> Approvals
            </Link>
          )}
          {canAdmin && (
            <Link className={navCls(pageUrl.startsWith('/admin'))} href="/admin">
              <Settings size={17} /> HR Admin
            </Link>
          )}
        </nav>

        <button
          type="button"
          className="mt-auto flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-600 transition-colors hover:bg-slate-50"
          onClick={() => router.post('/logout')}
        >
          <LogOut size={17} /> Sign out
        </button>
      </aside>

      {/* Main */}
      <main className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 px-4 py-4 backdrop-blur-md sm:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold text-slate-950 sm:text-xl">
                Employee Leave Management System
              </h1>
              <p className="text-sm text-slate-500">
                {user.name} &middot; {user.department?.name ?? 'No department'} &middot; {user.role}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {/* Bell */}
              <div className="relative" ref={bellRef}>
                <button
                  type="button"
                  className="relative flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  onClick={() => setBellOpen((v) => !v)}
                  aria-label="Notifications"
                >
                  <Bell size={20} />
                  {notifications.length > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold leading-none text-white">
                      {notifications.length}
                    </span>
                  )}
                </button>

                {bellOpen && (
                  <div className="absolute right-0 top-12 w-[340px] rounded-2xl border border-slate-200 bg-white shadow-xl">
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5">
                      <span className="text-sm font-semibold text-slate-900">Notifications</span>
                      {notifications.length > 0 && (
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600">
                          {notifications.length} new
                        </span>
                      )}
                    </div>
                    <div className="max-h-[400px] overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="flex flex-col items-center px-4 py-12">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                            <Bell size={22} />
                          </div>
                          <p className="mt-3 text-sm font-medium text-slate-500">All caught up!</p>
                          <p className="mt-0.5 text-xs text-slate-400">No new notifications</p>
                        </div>
                      ) : (
                        notifications.map((n) => {
                          const icon = notificationIcon(n);
                          const href = n.reference_id ? `/leave-requests?request=${n.reference_id}` : null;
                          const Wrapper = href ? 'button' : 'div';
                          return (
                            <Wrapper
                              key={n.id}
                              {...(href ? { type: 'button' as const, onClick: () => { markRead(n); setBellOpen(false); router.visit(href); } } : {})}
                              className={`flex w-full items-start gap-3 border-b border-slate-50 px-4 py-3.5 text-left ${href ? 'cursor-pointer transition-colors hover:bg-slate-50' : ''}`}
                            >
                              <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${icon.bg}`}>
                                {icon.el}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium text-slate-900">{n.title}</div>
                                <div className="mt-0.5 text-xs leading-relaxed text-slate-500">{n.body}</div>
                                <div className="mt-1.5 text-[11px] text-slate-400">
                                  {new Date(n.created_at).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </div>
                              </div>
                              {href && <ChevronRight size={14} className="mt-1 shrink-0 text-slate-300" />}
                            </Wrapper>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Profile Avatar */}
              <div className="relative" ref={profileRef}>
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 border-slate-200 transition-colors hover:border-emerald-400"
                  onClick={() => setProfileOpen((v) => !v)}
                >
                  {photoUrl ? (
                    <img src={photoUrl} alt={user.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center bg-emerald-700 text-xs font-bold text-white">
                      {initials}
                    </span>
                  )}
                </button>

                {profileOpen && (
                  <div className="absolute right-0 top-12 w-56 rounded-2xl border border-slate-200 bg-white py-2 shadow-xl">
                    <div className="border-b border-slate-100 px-4 pb-3 pt-2">
                      <div className="text-sm font-semibold text-slate-900">{user.name}</div>
                      <div className="text-xs text-slate-500">{user.email}</div>
                    </div>
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-slate-700 transition-colors hover:bg-slate-50"
                      onClick={() => { setProfileOpen(false); setProfileModal(true); }}
                    >
                      <User2 size={15} className="text-slate-400" /> View Profile
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-slate-700 transition-colors hover:bg-slate-50"
                      onClick={() => { setProfileOpen(false); setPasswordModal(true); }}
                    >
                      <KeyRound size={15} className="text-slate-400" /> Change Password
                    </button>
                    <div className="border-t border-slate-100 pt-1">
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-600 transition-colors hover:bg-red-50"
                        onClick={() => router.post('/logout')}
                      >
                        <LogOut size={15} /> Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {flash.success && (
            <div className="mt-3 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">{flash.success}</div>
          )}
          {flash.error && (
            <div className="mt-3 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-800">{flash.error}</div>
          )}
        </header>

        <div className="px-4 py-6 sm:px-8">{children}</div>
      </main>

      {/* Floating Policy FAQ Bot */}
      <PolicyBotWidget faqs={faqs} />

      {/* Force Change Password Modal */}
      {mustChangePassword && <ForceChangePasswordModal errors={errors} />}

      {/* Profile Modal */}
      {profileModal && <ProfileModal user={user} photoUrl={photoUrl} initials={initials} onClose={() => setProfileModal(false)} />}

      {/* Voluntary Change Password Modal */}
      {passwordModal && <ChangePasswordModal onClose={() => setPasswordModal(false)} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Notification Icon                                                  */
/* ------------------------------------------------------------------ */

function notificationIcon(n: Notification): { el: React.ReactNode; bg: string } {
  const t = (n.type ?? '').toLowerCase();
  const title = n.title.toLowerCase();

  if (t.includes('approved') || title.includes('approved'))
    return { el: <CheckCircle2 size={16} className="text-emerald-600" />, bg: 'bg-emerald-100' };
  if (t.includes('rejected') || title.includes('rejected'))
    return { el: <XCircle size={16} className="text-red-500" />, bg: 'bg-red-100' };
  if (t.includes('approval') || title.includes('approval') || title.includes('pending'))
    return { el: <Clock size={16} className="text-amber-600" />, bg: 'bg-amber-100' };
  if (t.includes('leave') || title.includes('leave') || title.includes('request'))
    return { el: <FileText size={16} className="text-sky-600" />, bg: 'bg-sky-100' };

  return { el: <Bell size={16} className="text-slate-500" />, bg: 'bg-slate-100' };
}

/* ------------------------------------------------------------------ */
/*  Force Change Password Modal                                        */
/* ------------------------------------------------------------------ */

type PasswordRule = { label: string; test: (pw: string) => boolean };

const PASSWORD_RULES: PasswordRule[] = [
  { label: 'At least 8 characters', test: (pw) => pw.length >= 8 },
  { label: 'One uppercase letter', test: (pw) => /[A-Z]/.test(pw) },
  { label: 'One lowercase letter', test: (pw) => /[a-z]/.test(pw) },
  { label: 'One number', test: (pw) => /\d/.test(pw) },
  { label: 'One special character (!@#$...)', test: (pw) => /[^A-Za-z0-9]/.test(pw) },
];

function strengthLevel(pw: string): { label: string; color: string; pct: number } {
  const passed = PASSWORD_RULES.filter((r) => r.test(pw)).length;
  if (passed <= 1) return { label: 'Very Weak', color: 'bg-red-500', pct: 20 };
  if (passed === 2) return { label: 'Weak', color: 'bg-orange-500', pct: 40 };
  if (passed === 3) return { label: 'Fair', color: 'bg-amber-500', pct: 60 };
  if (passed === 4) return { label: 'Strong', color: 'bg-emerald-500', pct: 80 };
  return { label: 'Very Strong', color: 'bg-emerald-600', pct: 100 };
}

function ForceChangePasswordModal({ errors }: { errors: Record<string, string> }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const strength = useMemo(() => strengthLevel(newPassword), [newPassword]);
  const allPassed = PASSWORD_RULES.every((r) => r.test(newPassword));
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const canSubmit = currentPassword.length > 0 && allPassed && passwordsMatch && !submitting;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    router.post('/password/force-change', {
      current_password: currentPassword,
      password: newPassword,
      password_confirmation: confirmPassword,
    }, {
      preserveScroll: true,
      onFinish: () => setSubmitting(false),
    });
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative w-full max-w-md animate-[scaleIn_0.2s_ease-out] rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-4 rounded-t-2xl bg-gradient-to-r from-emerald-700 to-emerald-800 px-6 py-5 text-white">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Change Your Password</h2>
            <p className="text-sm text-emerald-200">
              You must set a new password before continuing
            </p>
          </div>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Server errors */}
          {(errors.current_password || errors.password) && (
            <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {errors.current_password || errors.password}
            </div>
          )}

          {/* Current Password */}
          <div className="mb-5">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Current Password</label>
            <div className="relative">
              <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Lock size={16} /></div>
              <input
                type={showCurrent ? 'text' : 'password'}
                className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-10 text-sm transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="Enter current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoFocus
              />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => setShowCurrent((v) => !v)}>
                {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div className="mb-3">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">New Password</label>
            <div className="relative">
              <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Lock size={16} /></div>
              <input
                type={showNew ? 'text' : 'password'}
                className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-10 text-sm transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="Create a strong password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => setShowNew((v) => !v)}>
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Strength Meter */}
          {newPassword.length > 0 && (
            <div className="mb-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Password Strength</span>
                <span className={`text-xs font-semibold ${strength.pct >= 80 ? 'text-emerald-600' : strength.pct >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                  {strength.label}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${strength.color}`}
                  style={{ width: `${strength.pct}%` }}
                />
              </div>

              {/* Rules checklist */}
              <div className="mt-3 grid grid-cols-1 gap-1.5">
                {PASSWORD_RULES.map((rule) => {
                  const passed = rule.test(newPassword);
                  return (
                    <div key={rule.label} className="flex items-center gap-2">
                      <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition-colors ${passed ? 'bg-emerald-500 text-white' : 'border border-slate-300 bg-white'}`}>
                        {passed && <Check size={10} strokeWidth={3} />}
                      </div>
                      <span className={`text-xs transition-colors ${passed ? 'text-emerald-700' : 'text-slate-500'}`}>{rule.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Confirm Password */}
          <div className="mb-6">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Confirm New Password</label>
            <div className="relative">
              <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Lock size={16} /></div>
              <input
                type={showConfirm ? 'text' : 'password'}
                className={`w-full rounded-lg border py-2.5 pl-10 pr-10 text-sm transition-colors focus:outline-none focus:ring-1 ${
                  confirmPassword.length > 0
                    ? passwordsMatch
                      ? 'border-emerald-400 focus:border-emerald-500 focus:ring-emerald-500'
                      : 'border-red-400 focus:border-red-500 focus:ring-red-500'
                    : 'border-slate-300 focus:border-emerald-500 focus:ring-emerald-500'
                }`}
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => setShowConfirm((v) => !v)}>
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {confirmPassword.length > 0 && !passwordsMatch && (
              <p className="mt-1.5 text-xs text-red-500">Passwords do not match</p>
            )}
            {passwordsMatch && (
              <p className="mt-1.5 flex items-center gap-1 text-xs text-emerald-600">
                <Check size={12} strokeWidth={3} /> Passwords match
              </p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ShieldCheck size={18} />
            {submitting ? 'Changing...' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Profile Modal                                                      */
/* ------------------------------------------------------------------ */

function ProfileModal({
  user,
  photoUrl,
  initials,
  onClose,
}: {
  user: PageProps['auth']['user'];
  photoUrl: string | null;
  initials: string;
  onClose: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const data = new FormData();
    data.append('photo', file);
    router.post('/profile/photo', data, {
      forceFormData: true,
      onFinish: () => setUploading(false),
      onSuccess: () => { if (fileRef.current) fileRef.current.value = ''; },
    });
  }

  const roleBadge: Record<string, string> = {
    staff: 'bg-slate-100 text-slate-600',
    manager: 'bg-sky-100 text-sky-700',
    hr: 'bg-purple-100 text-purple-700',
    admin: 'bg-amber-100 text-amber-800',
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md animate-[scaleIn_0.15s_ease-out] overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="relative flex flex-col items-center bg-gradient-to-br from-emerald-700 to-emerald-800 px-6 pb-16 pt-6">
          <button
            type="button"
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            onClick={onClose}
          >
            <X size={18} />
          </button>
          <h3 className="text-lg font-semibold text-white">My Profile</h3>
        </div>

        {/* Avatar (overlaps header) */}
        <div className="relative -mt-12 flex justify-center">
          <div className="group relative">
            <div className="h-24 w-24 overflow-hidden rounded-full border-4 border-white shadow-lg">
              {photoUrl ? (
                <img src={photoUrl} alt={user.name} className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-emerald-600 text-2xl font-bold text-white">
                  {initials}
                </span>
              )}
            </div>
            <button
              type="button"
              disabled={uploading}
              className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-emerald-700 text-white shadow transition-colors hover:bg-emerald-800 disabled:opacity-50"
              onClick={() => fileRef.current?.click()}
            >
              <Camera size={14} />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handlePhotoUpload}
            />
          </div>
        </div>

        {/* Info */}
        <div className="px-6 pb-6 pt-4">
          <div className="text-center">
            <h4 className="text-lg font-semibold text-slate-900">{user.name}</h4>
            <div className="mt-1 flex items-center justify-center gap-2">
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${roleBadge[user.role] ?? 'bg-slate-100 text-slate-600'}`}>
                {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
              </span>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <ProfileRow icon={<Mail size={15} />} label="Email" value={user.email} />
            <ProfileRow icon={<User2 size={15} />} label="Department" value={user.department?.name ?? '—'} />
            {user.job_title && <ProfileRow icon={<ShieldCheck size={15} />} label="Position" value={user.job_title} />}
            {user.employee_code && <ProfileRow icon={<FileText size={15} />} label="Employee Code" value={user.employee_code} />}
            {user.manager && <ProfileRow icon={<User2 size={15} />} label="Manager" value={user.manager.name} />}
            {user.hire_date && <ProfileRow icon={<CalendarCheck size={15} />} label="Hire Date" value={new Date(user.hire_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} />}
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-slate-400 shadow-sm">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">{label}</div>
        <div className="mt-0.5 truncate text-sm font-medium text-slate-800">{value}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Voluntary Change Password Modal                                    */
/* ------------------------------------------------------------------ */

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  const strength = useMemo(() => strengthLevel(newPassword), [newPassword]);
  const allPassed = PASSWORD_RULES.every((r) => r.test(newPassword));
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const canSubmit = currentPassword.length > 0 && allPassed && passwordsMatch && !submitting;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setServerError('');
    router.post('/password/change', {
      current_password: currentPassword,
      password: newPassword,
      password_confirmation: confirmPassword,
    }, {
      preserveScroll: true,
      onFinish: () => setSubmitting(false),
      onSuccess: () => onClose(),
      onError: (errs) => setServerError(errs.current_password || errs.password || 'Something went wrong.'),
    });
  }

  const inputCls = 'w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-10 text-sm transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md animate-[scaleIn_0.15s_ease-out] rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <KeyRound size={18} />
            </div>
            <h3 className="text-base font-semibold text-slate-900">Change Password</h3>
          </div>
          <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {serverError && (
            <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{serverError}</div>
          )}

          <div className="mb-5">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Current Password</label>
            <div className="relative">
              <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Lock size={16} /></div>
              <input type={showCurrent ? 'text' : 'password'} className={inputCls} placeholder="Enter current password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoFocus />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => setShowCurrent((v) => !v)}>
                {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="mb-3">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">New Password</label>
            <div className="relative">
              <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Lock size={16} /></div>
              <input type={showNew ? 'text' : 'password'} className={inputCls} placeholder="Create a strong password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => setShowNew((v) => !v)}>
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {newPassword.length > 0 && (
            <div className="mb-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Password Strength</span>
                <span className={`text-xs font-semibold ${strength.pct >= 80 ? 'text-emerald-600' : strength.pct >= 60 ? 'text-amber-600' : 'text-red-600'}`}>{strength.label}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full rounded-full transition-all duration-300 ${strength.color}`} style={{ width: `${strength.pct}%` }} />
              </div>
              <div className="mt-3 grid grid-cols-1 gap-1.5">
                {PASSWORD_RULES.map((rule) => {
                  const passed = rule.test(newPassword);
                  return (
                    <div key={rule.label} className="flex items-center gap-2">
                      <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition-colors ${passed ? 'bg-emerald-500 text-white' : 'border border-slate-300 bg-white'}`}>
                        {passed && <Check size={10} strokeWidth={3} />}
                      </div>
                      <span className={`text-xs transition-colors ${passed ? 'text-emerald-700' : 'text-slate-500'}`}>{rule.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mb-6">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Confirm New Password</label>
            <div className="relative">
              <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Lock size={16} /></div>
              <input
                type={showConfirm ? 'text' : 'password'}
                className={`w-full rounded-lg border py-2.5 pl-10 pr-10 text-sm transition-colors focus:outline-none focus:ring-1 ${
                  confirmPassword.length > 0
                    ? passwordsMatch ? 'border-emerald-400 focus:border-emerald-500 focus:ring-emerald-500' : 'border-red-400 focus:border-red-500 focus:ring-red-500'
                    : 'border-slate-300 focus:border-emerald-500 focus:ring-emerald-500'
                }`}
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => setShowConfirm((v) => !v)}>
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {confirmPassword.length > 0 && !passwordsMatch && <p className="mt-1.5 text-xs text-red-500">Passwords do not match</p>}
            {passwordsMatch && <p className="mt-1.5 flex items-center gap-1 text-xs text-emerald-600"><Check size={12} strokeWidth={3} /> Passwords match</p>}
          </div>

          <div className="flex items-center justify-end gap-3">
            <button type="button" className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ShieldCheck size={16} />
              {submitting ? 'Changing...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Floating Policy FAQ Chat Widget                                    */
/* ------------------------------------------------------------------ */

function PolicyBotWidget({ faqs }: { faqs: Faq[] }) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  async function askFaq(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/ai-help', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '',
        },
        body: JSON.stringify({ prompt }),
      });
      const json = await res.json();
      setAnswer(json.answer);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50" ref={panelRef}>
      {/* Popup Panel */}
      {open && (
        <div className="absolute bottom-16 right-0 mb-2 flex w-[360px] flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between rounded-t-2xl bg-emerald-700 px-5 py-4 text-white">
            <div className="flex items-center gap-2.5">
              <Bot size={20} />
              <div>
                <div className="text-sm font-semibold">Policy Assistant</div>
                <div className="text-[11px] text-emerald-200">Ask about leave policy</div>
              </div>
            </div>
            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-emerald-600"
              onClick={() => setOpen(false)}
            >
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="flex max-h-[400px] flex-col overflow-y-auto px-5 py-4">
            <p className="text-sm text-slate-500">
              Get instant answers about company leave rules, entitlements, and procedures.
            </p>

            {answer && (
              <div className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm leading-relaxed text-emerald-900">{answer}</div>
            )}

            {faqs.length > 0 && (
              <div className="mt-4 space-y-1.5">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Common Questions</div>
                {faqs.map((faq) => (
                  <details
                    key={faq.id}
                    className="group rounded-lg border border-slate-100 transition-colors open:border-slate-200 open:bg-slate-50/50"
                  >
                    <summary className="cursor-pointer px-3 py-2.5 text-[13px] font-medium text-slate-700 group-open:text-emerald-700">
                      {faq.question}
                    </summary>
                    <p className="px-3 pb-2.5 text-[13px] leading-relaxed text-slate-500">{faq.answer}</p>
                  </details>
                ))}
              </div>
            )}
          </div>

          {/* Input */}
          <form onSubmit={askFaq} className="flex gap-2 border-t border-slate-100 px-4 py-3">
            <input
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Type a question..."
            />
            <button
              type="submit"
              disabled={loading}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-700 text-white transition-colors hover:bg-emerald-800 disabled:opacity-60"
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      )}

      {/* Floating Button */}
      <button
        type="button"
        className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-700 text-white shadow-lg transition-all hover:scale-105 hover:bg-emerald-800 hover:shadow-xl"
        onClick={() => setOpen((v) => !v)}
        aria-label="Policy FAQ"
      >
        {open ? <X size={24} /> : <Bot size={24} />}
      </button>
    </div>
  );
}
