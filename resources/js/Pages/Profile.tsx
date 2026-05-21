import { router, usePage } from '@inertiajs/react';
import { BriefcaseBusiness, IdCard, KeyRound, LockKeyhole, Phone, Shield, UserRound } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import AppLayout from '../Layouts/AppLayout';
import type { PageProps, User } from '../types';

export default function Profile({ profile }: { profile: User }) {
  const { errors } = usePage<PageProps>().props;
  const [form, setForm] = useState({
    name: profile.name ?? '',
    email: profile.email ?? '',
    phone: profile.phone ?? '',
    work_location: profile.work_location ?? '',
    employment_type: profile.employment_type ?? '',
    emergency_contact_name: profile.emergency_contact_name ?? '',
    emergency_contact_phone: profile.emergency_contact_phone ?? '',
    bio: profile.bio ?? '',
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

  return (
    <AppLayout>
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-2">
            <IdCard size={20} className="text-emerald-700" />
            <h2 className="font-semibold text-slate-950">My Profile</h2>
          </div>
          <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
            <Field label="Full name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} />
            <Field label="Email" type="email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} />
            <Field label="Phone" value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} />
            <Field label="Work location" value={form.work_location} onChange={(value) => setForm({ ...form, work_location: value })} />
            <Field label="Employment type" value={form.employment_type} onChange={(value) => setForm({ ...form, employment_type: value })} />
            <Field label="Emergency contact" value={form.emergency_contact_name} onChange={(value) => setForm({ ...form, emergency_contact_name: value })} />
            <Field label="Emergency phone" value={form.emergency_contact_phone} onChange={(value) => setForm({ ...form, emergency_contact_phone: value })} />
            <label className="text-sm md:col-span-2">
              Bio and handover notes
              <textarea className="mt-1 min-h-28 w-full rounded-md border border-slate-300 px-3 py-2" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
            </label>
            {Object.values(errors).length > 0 && <p className="text-sm text-red-600 md:col-span-2">{Object.values(errors)[0]}</p>}
            <div className="md:col-span-2">
              <button className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800">Save profile</button>
            </div>
          </form>
        </section>

        <aside className="space-y-4">
          <Info icon={<UserRound size={18} />} label="Role" value={profile.role} />
          <Info icon={<BriefcaseBusiness size={18} />} label="Department" value={profile.department?.name ?? 'Unassigned'} />
          <Info icon={<UserRound size={18} />} label="Manager" value={profile.manager?.name ?? 'Unassigned'} />
          <Info icon={<Shield size={18} />} label="Security" value={profile.two_factor_enabled ? 'Two-factor enabled' : 'Password only'} />
          <Info icon={<Phone size={18} />} label="Employee code" value={profile.employee_code ?? 'Not set'} />
        </aside>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-2">
            <KeyRound size={20} className="text-emerald-700" />
            <h2 className="font-semibold text-slate-950">Reset Password</h2>
          </div>
          <form onSubmit={updatePassword} className="grid gap-4">
            <Field label="Current password" type="password" value={passwordForm.current_password} onChange={(value) => setPasswordForm({ ...passwordForm, current_password: value })} />
            <Field label="New password" type="password" value={passwordForm.password} onChange={(value) => setPasswordForm({ ...passwordForm, password: value })} />
            <Field label="Confirm new password" type="password" value={passwordForm.password_confirmation} onChange={(value) => setPasswordForm({ ...passwordForm, password_confirmation: value })} />
            <button className="w-fit rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">Update password</button>
          </form>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-2">
            <LockKeyhole size={20} className="text-emerald-700" />
            <h2 className="font-semibold text-slate-950">Two-Factor Authentication</h2>
          </div>
          <div className="rounded-md bg-slate-50 p-4 text-sm text-slate-600">
            {profile.two_factor_enabled ? 'Two-factor authentication is enabled. Sign-in will require a one-time email code.' : 'Add a one-time email code requirement to your next sign-in.'}
          </div>
          <div className="mt-4">
            <Field label="Current password" type="password" value={twoFactorPassword} onChange={setTwoFactorPassword} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {!profile.two_factor_enabled && <button className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800" onClick={() => toggleTwoFactor(true)} type="button">Enable 2FA</button>}
            {profile.two_factor_enabled && <button className="rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50" onClick={() => toggleTwoFactor(false)} type="button">Disable 2FA</button>}
          </div>
        </section>
      </div>
    </AppLayout>
  );
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className="text-sm">{label}<input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" type={type} value={value} onChange={(e) => onChange(e.target.value)} /></label>;
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center gap-2 text-xs uppercase text-slate-500">{icon}{label}</div><div className="mt-2 font-medium text-slate-950">{value}</div></div>;
}
