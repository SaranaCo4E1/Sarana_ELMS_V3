import { router, usePage } from '@inertiajs/react';
import { Banknote, BriefcaseBusiness, CalendarDays, Eye, EyeOff, IdCard, KeyRound, LockKeyhole, Mail, MapPin, Phone, Shield, ShieldAlert, ShieldCheck, UserRound } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import AppLayout from '../Layouts/AppLayout';
import type { PageProps, User } from '../types';
import { formatDate, formatRole } from '../utils';

export default function Profile({ profile }: { profile: User }) {
  const { errors } = usePage<PageProps>().props;
  const employeeProfile = profile.profile;
  const [form, setForm] = useState({
    name: profile.name ?? '',
    email: profile.email ?? '',
    date_of_birth: toDateInputValue(employeeProfile?.date_of_birth),
    gender: employeeProfile?.gender ?? '',
    nationality: employeeProfile?.nationality ?? '',
    national_id_number: employeeProfile?.national_id_number ?? '',
    join_date: toDateInputValue(employeeProfile?.join_date),
    employment_type: employeeProfile?.employment_type ?? '',
    address: employeeProfile?.address ?? '',
    emergency_contact_name: employeeProfile?.emergency_contact_name ?? '',
    emergency_contact_phone: employeeProfile?.emergency_contact_phone ?? '',
    bank_account_number: employeeProfile?.bank_account_number ?? '',
    bank_name: employeeProfile?.bank_name ?? '',
  });
  const [passwordForm, setPasswordForm] = useState({ current_password: '', password: '', password_confirmation: '' });
  const [twoFactorPassword, setTwoFactorPassword] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    router.patch('/profile', form, { preserveScroll: true });
  }

  function updatePassword(e: React.FormEvent) {
    e.preventDefault();
    router.patch('/profile/password', passwordForm, {
      preserveScroll: true,
      onSuccess: () => setPasswordForm({ current_password: '', password: '', password_confirmation: '' }),
    });
  }

  function toggleTwoFactor(enabled: boolean) {
    router.patch('/profile/two-factor', { enabled, current_password: twoFactorPassword }, {
      preserveScroll: true,
      onSuccess: () => setTwoFactorPassword(''),
    });
  }

  // Get initials for profile avatar
  const initials = profile.name
    ? profile.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : 'EM';

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Premium Profile Banner Card */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-tr from-orange-600 via-orange-600 to-amber-700 p-6 text-white shadow-premium-md animate-fade-in">
          {/* Subtle background decoration */}
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-orange-500/10 blur-3xl"></div>
          <div className="absolute -bottom-10 right-20 h-40 w-40 rounded-full bg-amber-500/10 blur-3xl"></div>

          <div className="relative flex flex-col items-center gap-5 sm:flex-row sm:items-center">
            {/* Avatar Circle */}
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-400 to-amber-500 text-neutral-950 font-medium text-2xl shadow-inner border border-orange-300/20">
              {initials}
            </div>

            {/* User Info */}
            <div className="text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <h1 className="text-2xl font-medium tracking-tight text-white">{profile.name}</h1>
                <span className="inline-flex items-center rounded-md bg-orange-500/15 px-2 py-0.5 text-xs font-semibold text-orange-200 border border-orange-500/25">
                  Active Account
                </span>
              </div>
              <p className="mt-1.5 text-sm text-neutral-300 font-medium">
                {formatRole(profile.role)} · {profile.department?.name ?? 'Unassigned Department'}
              </p>
              
              <div className="mt-3.5 flex flex-wrap justify-center gap-y-1.5 gap-x-4 text-sm text-neutral-300 sm:justify-start font-medium">
                <span className="flex items-center gap-1.5">
                  <Mail size={13} className="text-neutral-300/80" />
                  {profile.email}
                </span>
                {profile.employee_code && (
                  <span className="flex items-center gap-1.5">
                    <BriefcaseBusiness size={13} className="text-neutral-300/80" />
                    ID: {profile.employee_code}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Profile Info and Form Grid */}
        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          {/* Main Form */}
          <section className="rounded-xl border border-neutral-200/50 bg-white p-6 shadow-premium-sm">
            <div className="mb-6 flex items-center gap-2 border-b border-neutral-100 pb-4">
              <IdCard size={17} className="text-orange-600" />
              <h2 className="text-base font-medium text-neutral-800">Personal Information</h2>
            </div>
            
            <form onSubmit={submit} className="grid gap-5 md:grid-cols-2">
              <Field label="Full name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} error={errors.name} />
              <Field label="Email" type="email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} error={errors.email} />
              <Field label="Date of birth" type="date" value={form.date_of_birth} onChange={(value) => setForm({ ...form, date_of_birth: value })} error={errors.date_of_birth} />
              <SelectField label="Gender" value={form.gender} onChange={(value) => setForm({ ...form, gender: value })} error={errors.gender} options={['Male', 'Female']} />
              <Field label="Nationality" value={form.nationality} onChange={(value) => setForm({ ...form, nationality: value })} error={errors.nationality} />
              <Field label="National ID number" value={form.national_id_number} onChange={(value) => setForm({ ...form, national_id_number: value })} error={errors.national_id_number} />
              <Field label="Join date" type="date" value={form.join_date} onChange={(value) => setForm({ ...form, join_date: value })} error={errors.join_date} />
              <Field label="Employment type" value={form.employment_type} onChange={(value) => setForm({ ...form, employment_type: value })} error={errors.employment_type} />
              <Field label="Emergency contact" value={form.emergency_contact_name} onChange={(value) => setForm({ ...form, emergency_contact_name: value })} error={errors.emergency_contact_name} />
              <Field label="Emergency phone" value={form.emergency_contact_phone} onChange={(value) => setForm({ ...form, emergency_contact_phone: value })} error={errors.emergency_contact_phone} />
              <Field label="Bank name" value={form.bank_name} onChange={(value) => setForm({ ...form, bank_name: value })} error={errors.bank_name} />
              <Field label="Bank account number" value={form.bank_account_number} onChange={(value) => setForm({ ...form, bank_account_number: value })} error={errors.bank_account_number} />
              
              <TextAreaField label="Address" value={form.address} onChange={(value) => setForm({ ...form, address: value })} error={errors.address} />

              {/* General Error (if any fallback) */}
              {Object.values(errors).length > 0 && !errors.name && !errors.email && !errors.date_of_birth && !errors.gender && !errors.nationality && !errors.national_id_number && !errors.join_date && !errors.employment_type && !errors.address && !errors.emergency_contact_name && !errors.emergency_contact_phone && !errors.bank_account_number && !errors.bank_name && (
                <div className="rounded-lg bg-rose-50 border border-rose-100 p-4 text-sm font-medium text-rose-600 md:col-span-2 animate-fade-in">
                  {Object.values(errors)[0]}
                </div>
              )}

              <div className="pt-2 md:col-span-2">
                <button className="rounded-lg bg-orange-600 px-7 py-3.5 text-sm font-medium tracking-wide uppercase text-white shadow-md shadow-orange-600/10 hover:bg-orange-700 active:scale-98 transition-all cursor-pointer">
                  Save Changes
                </button>
              </div>
            </form>
          </section>

          {/* Quick Roster Stats Card */}
          <aside className="space-y-4">
            <Info icon={<UserRound size={15} />} label="Roster Role" value={formatRole(profile.role)} />
            <Info icon={<BriefcaseBusiness size={15} />} label="Primary Department" value={profile.department?.name ?? 'Unassigned'} />
            <Info icon={<UserRound size={15} />} label="Reporting Manager" value={profile.manager?.name ?? 'No Manager Assigned'} />
            <Info icon={<CalendarDays size={15} />} label="Join Date" value={formatInfoDate(employeeProfile?.join_date ?? profile.hire_date)} />
            <Info icon={<MapPin size={15} />} label="Nationality" value={employeeProfile?.nationality ?? 'Not Set'} />
            <Info icon={<Banknote size={15} />} label="Bank" value={employeeProfile?.bank_name ?? 'Not Set'} />
            <Info 
              icon={<Shield size={15} />} 
              label="Account Protection" 
              value={profile.two_factor_enabled ? 'Two-Factor (2FA) Secured' : 'Standard Password Protection'} 
            />
            <Info icon={<Phone size={15} />} label="Employee ID Code" value={profile.employee_code ?? 'Not Set'} />
          </aside>
        </div>

        {/* Security Details Sections */}
        <div className="grid gap-6 xl:grid-cols-2">
          {/* Reset Password Form */}
          <section className="rounded-xl border border-neutral-200/50 bg-white p-6 shadow-premium-sm">
            <div className="mb-6 flex items-center gap-2 border-b border-neutral-100 pb-4">
              <KeyRound size={17} className="text-orange-600" />
              <h2 className="text-base font-medium text-neutral-800">Change Password</h2>
            </div>
            
            <form onSubmit={updatePassword} className="space-y-4">
              <Field label="Current password" type="password" value={passwordForm.current_password} onChange={(value) => setPasswordForm({ ...passwordForm, current_password: value })} error={errors.current_password} />
              <Field label="New password" type="password" value={passwordForm.password} onChange={(value) => setPasswordForm({ ...passwordForm, password: value })} error={errors.password} />
              <Field label="Confirm new password" type="password" value={passwordForm.password_confirmation} onChange={(value) => setPasswordForm({ ...passwordForm, password_confirmation: value })} error={errors.password_confirmation} />
              
              <div className="pt-2">
                <button className="rounded-lg bg-orange-600 px-7 py-3.5 text-sm font-medium tracking-wide uppercase text-white shadow-md shadow-orange-600/10 hover:bg-orange-700 active:scale-98 transition-all cursor-pointer">
                  Update Password
                </button>
              </div>
            </form>
          </section>

          {/* Two Factor Configuration */}
          <section className="rounded-xl border border-neutral-200/50 bg-white p-6 shadow-premium-sm">
            <div className="mb-6 flex items-center gap-2 border-b border-neutral-100 pb-4">
              <LockKeyhole size={17} className="text-orange-600" />
              <h2 className="text-base font-medium text-neutral-800">Two-Factor Authentication</h2>
            </div>

            <div className="flex gap-4 items-start rounded-xl bg-neutral-50/50 p-4 border border-neutral-200/60 shadow-premium-sm">
              <div className="mt-0.5">
                {profile.two_factor_enabled ? (
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-orange-50 text-orange-600 border border-orange-100">
                    <ShieldCheck size={16} />
                  </div>
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-50 text-amber-600 border border-amber-100">
                    <ShieldAlert size={16} />
                  </div>
                )}
              </div>
              <div>
                <h4 className="text-sm font-medium text-neutral-800">
                  {profile.two_factor_enabled ? '2FA Protection Active' : 'Enable Extra Protection'}
                </h4>
                <p className="mt-1 text-sm text-neutral-500 leading-relaxed font-medium">
                  {profile.two_factor_enabled 
                    ? 'Two-factor authentication is active. Sign-in requests require verification using a secure one-time code sent directly to your email.'
                    : 'Add an extra layer of protection. When signing in, you will be prompted for a verification code sent to your registered email.'}
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <Field 
                label="Confirm with Password" 
                type="password" 
                value={twoFactorPassword} 
                onChange={setTwoFactorPassword} 
                error={errors.current_password} 
                placeholder="Enter current password to modify 2FA settings"
              />
              
              <div className="flex flex-wrap gap-2 pt-2">
                {!profile.two_factor_enabled ? (
                  <button 
                    className="rounded-lg bg-orange-600 px-7 py-3.5 text-sm font-medium tracking-wide uppercase text-white shadow-md shadow-orange-600/10 hover:bg-orange-700 active:scale-98 transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer" 
                    onClick={() => toggleTwoFactor(true)} 
                    type="button"
                    disabled={!twoFactorPassword}
                  >
                    Enable 2FA Protection
                  </button>
                ) : (
                  <button 
                    className="rounded-lg border border-rose-200 bg-white px-7 py-3.5 text-sm font-medium tracking-wide uppercase text-rose-600 shadow-premium-sm hover:bg-rose-50 active:scale-98 transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer" 
                    onClick={() => toggleTwoFactor(false)} 
                    type="button"
                    disabled={!twoFactorPassword}
                  >
                    Disable 2FA Protection
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </AppLayout>
  );
}

function toDateInputValue(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : '';
}

function formatInfoDate(value: string | null | undefined): string {
  return value ? formatDate(value) : 'Not Set';
}

function SelectField({
  label,
  value,
  onChange,
  error,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  options: string[];
}) {
  return (
    <label className="block text-sm font-medium uppercase tracking-wider text-neutral-500">
      {label}
      <select
        className="mt-2 w-full rounded-lg border border-neutral-200/70 bg-white px-4 py-3 text-sm text-neutral-800 focus:border-orange-600 focus:ring-4 focus:ring-orange-500/5 shadow-premium-sm transition-all outline-none font-medium"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Not set</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      {error && <span className="mt-1.5 block text-xs text-rose-600 font-medium normal-case">{error}</span>}
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  return (
    <label className="text-sm font-medium uppercase tracking-wider text-neutral-500 md:col-span-2">
      {label}
      <textarea
        className="mt-2 min-h-[7.5rem] w-full rounded-lg border border-neutral-200/70 p-3.5 text-sm text-neutral-800 placeholder-neutral-400 focus:border-orange-600 focus:ring-4 focus:ring-orange-500/5 shadow-premium-sm transition-all outline-none resize-y font-medium leading-relaxed"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Current address"
      />
      {error && <span className="mt-1.5 block text-xs text-rose-600 font-medium normal-case">{error}</span>}
    </label>
  );
}

function Field({ 
  label, 
  value, 
  onChange, 
  type = 'text', 
  error, 
  placeholder 
}: { 
  label: string; 
  value: string; 
  onChange: (value: string) => void; 
  type?: string; 
  error?: string;
  placeholder?: string;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';

  return (
    <label className="block text-sm font-medium uppercase tracking-wider text-neutral-500">
      {label}
      <div className="relative">
        <input 
          className={`mt-2 w-full rounded-lg border border-neutral-200/70 bg-white pl-4 ${isPassword ? 'pr-11' : 'pr-4'} py-3 text-sm text-neutral-800 placeholder-neutral-400 focus:border-orange-600 focus:ring-4 focus:ring-orange-500/5 shadow-premium-sm transition-all outline-none font-medium`} 
          type={isPassword ? (showPassword ? 'text' : 'password') : type} 
          value={value} 
          onChange={(e) => onChange(e.target.value)} 
          placeholder={placeholder}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3.5 bottom-3 text-neutral-400 hover:text-neutral-600 transition-colors focus:outline-none"
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
      {error && <span className="mt-1.5 block text-xs text-rose-600 font-medium normal-case">{error}</span>}
    </label>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3.5 rounded-lg border border-neutral-200/50 bg-white p-4 shadow-premium-sm hover:shadow-premium-md transition-all duration-300">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-neutral-50 text-neutral-500 border border-neutral-200 shadow-premium-sm">
        <div className="text-neutral-400">{icon}</div>
      </div>
      <div>
        <div className="text-xs font-medium uppercase tracking-wider text-neutral-500">{label}</div>
        <div className="mt-1 text-sm font-medium text-neutral-800">{value}</div>
      </div>
    </div>
  );
}
