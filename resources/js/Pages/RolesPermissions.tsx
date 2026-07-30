import { router, usePage } from '@inertiajs/react';
import { Check, Plus, Search, Shield, ShieldCheck, X, Loader2 } from 'lucide-react';
import type React from 'react';
import { Fragment, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import AppLayout from '../Layouts/AppLayout';
import type { PageProps, Permission, Role } from '../types';
import { formatRole } from '../utils';

const emptyRoleForm = { name: '', description: '' };

export default function RolesPermissions({ roles, permissions }: { roles: Role[]; permissions: Permission[] }) {
  const { errors } = usePage<PageProps>().props;
  const [activeTab, setActiveTab] = useState('roles');
  const [isAddRoleOpen, setIsAddRoleOpen] = useState(false);
  const [isModalClosing, setIsModalClosing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [roleForm, setRoleForm] = useState(emptyRoleForm);
  const [roleQuery, setRoleQuery] = useState('');
  const [savingRoleId, setSavingRoleId] = useState<number | null>(null);

  const tabs = [
    { id: 'roles', label: 'Roles', icon: <Shield size={16} /> },
    { id: 'permissions', label: 'Permissions', icon: <ShieldCheck size={16} /> },
  ];

  const filteredRoles = useMemo(() => roles.filter((role) => {
    const haystack = `${role.name} ${role.slug} ${role.description ?? ''}`.toLowerCase();
    return haystack.includes(roleQuery.toLowerCase());
  }), [roles, roleQuery]);

  const permissionGroups = useMemo(() => {
    const groups = new Map<string, Permission[]>();
    permissions.forEach((permission) => {
      const list = groups.get(permission.group) ?? [];
      list.push(permission);
      groups.set(permission.group, list);
    });
    return Array.from(groups.entries());
  }, [permissions]);

  const openAddRole = () => {
    setRoleForm(emptyRoleForm);
    setIsAddRoleOpen(true);
  };

  const closeAddRole = () => {
    setIsModalClosing(true);
    setTimeout(() => {
      setIsAddRoleOpen(false);
      setIsModalClosing(false);
    }, 180);
  };

  const submitRole = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    router.post('/roles-permissions/roles', roleForm, {
      preserveScroll: true,
      onStart: () => setIsSubmitting(true),
      onFinish: () => setIsSubmitting(false),
      onSuccess: closeAddRole,
    });
  };

  const togglePermission = (role: Role, permission: Permission) => {
    const currentIds = (role.permissions ?? []).map((p) => p.id);
    const nextIds = currentIds.includes(permission.id)
      ? currentIds.filter((id) => id !== permission.id)
      : [...currentIds, permission.id];

    router.patch(`/roles-permissions/roles/${role.id}/permissions`, { permission_ids: nextIds }, {
      preserveScroll: true,
      onStart: () => setSavingRoleId(role.id),
      onFinish: () => setSavingRoleId(null),
    });
  };

  return (
    <AppLayout>
      <div className="space-y-8 animate-fade-in">
        {/* Metric Statistics */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          <Metric label="Total Roles" value={roles.length} variant="indigo" />
          <Metric label="Custom Roles" value={roles.filter((r) => !r.is_system).length} variant="orange" />
          <Metric label="Total Permissions" value={permissions.length} variant="slate" />
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-neutral-200/60 overflow-x-auto whitespace-nowrap scrollbar-none gap-3">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4.5 py-4 text-sm font-medium uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                  active
                    ? 'border-orange-600 text-orange-700'
                    : 'border-transparent text-neutral-500 hover:text-neutral-800 font-medium'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Contents */}
        <div className="space-y-6">
          {activeTab === 'roles' && (
            <section className="rounded-xl border border-neutral-200/50 bg-white p-6 shadow-premium-sm overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-100 pb-5 mb-5">
                <div>
                  <h3 className="text-base font-medium text-neutral-800">Roles Directory</h3>
                  <p className="text-sm text-neutral-500 font-medium mt-1">Create new roles, then assign permissions from the Permissions tab</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <div className="relative">
                    <Search className="absolute left-3.5 top-3.5 text-neutral-400" size={14} />
                    <input
                      className="w-52 rounded-lg border border-neutral-200 py-2.5 pl-9 pr-3.5 text-sm bg-white font-medium text-neutral-800 placeholder-neutral-400 outline-none focus:border-orange-600 focus:ring-4 focus:ring-orange-500/5 transition-all shadow-premium-sm"
                      placeholder="Search roles..."
                      value={roleQuery}
                      onChange={(e) => setRoleQuery(e.target.value)}
                    />
                  </div>
                  <button
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-medium uppercase tracking-wide text-white shadow-md shadow-orange-600/10 hover:bg-orange-700 active:scale-98 transition-all cursor-pointer"
                    onClick={openAddRole}
                    type="button"
                  >
                    <Plus size={14} /> Add Role
                  </button>
                </div>
              </div>

              <div className="divide-y divide-neutral-100 text-sm">
                {filteredRoles.map((role) => (
                  <div key={role.id} className="flex flex-wrap items-center justify-between gap-4 py-4.5 px-3 hover:bg-neutral-50/50 rounded-lg transition-all">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5">
                        <span className="font-medium text-neutral-800 text-sm">{role.name}</span>
                        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                          role.is_system
                            ? 'bg-indigo-50 border-indigo-100 text-indigo-600'
                            : 'bg-orange-50 border-orange-100 text-orange-700'
                        }`}>
                          {role.is_system ? 'System' : 'Custom'}
                        </span>
                      </div>
                      <div className="text-sm text-neutral-500 font-medium mt-1.5">
                        {role.description || 'No description'} · {permissionSummary(role)} · {role.users_count ?? 0} members
                      </div>
                    </div>
                    <button
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-neutral-200 px-2 py-1 text-xs font-semibold uppercase tracking-wider text-neutral-600 transition-all hover:border-orange-200 hover:text-orange-700"
                      onClick={() => setActiveTab('permissions')}
                      type="button"
                    >
                      <ShieldCheck size={13} /> Configure Permissions
                    </button>
                  </div>
                ))}
                {filteredRoles.length === 0 && (
                  <div className="p-8 text-center text-sm text-neutral-400 font-medium">
                    No matching roles found.
                  </div>
                )}
              </div>
            </section>
          )}

          {activeTab === 'permissions' && (
            <section className="rounded-xl border border-neutral-200/50 bg-white p-6 shadow-premium-sm overflow-hidden">
              <div className="border-b border-neutral-100 pb-5 mb-5">
                <h3 className="text-base font-medium text-neutral-800">Permission Matrix</h3>
                <p className="text-sm text-neutral-500 font-medium mt-1">Toggle which fixed permissions each role has. Permissions themselves are system-defined and cannot be added here.</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-neutral-50/50 text-xs font-medium uppercase tracking-wider text-neutral-500 border-b border-neutral-200/60">
                      <th className="px-4 py-4.5 sticky left-0 bg-neutral-50/50 min-w-[220px]">Permission</th>
                      {roles.map((role) => (
                        <th key={role.id} className="px-4 py-4.5 text-center min-w-[120px]">{formatRole(role.slug)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {permissionGroups.map(([group, groupPermissions]) => (
                      <Fragment key={group}>
                        <tr className="bg-neutral-50/30">
                          <td colSpan={roles.length + 1} className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                            {group}
                          </td>
                        </tr>
                        {groupPermissions.map((permission) => (
                          <tr key={permission.id} className="hover:bg-neutral-50/50 transition-all">
                            <td className="px-4 py-4 sticky left-0 bg-white">
                              <div className="font-medium text-neutral-800">{permission.name}</div>
                              {permission.description && (
                                <div className="text-xs text-neutral-500 font-medium mt-1">{permission.description}</div>
                              )}
                            </td>
                            {roles.map((role) => {
                              const active = (role.permissions ?? []).some((p) => p.id === permission.id);
                              const saving = savingRoleId === role.id;
                              return (
                                <td key={role.id} className="px-4 py-4 text-center">
                                  <button
                                    type="button"
                                    disabled={saving}
                                    onClick={() => togglePermission(role, permission)}
                                    className={`inline-flex h-7 w-7 items-center justify-center rounded-md border transition-all cursor-pointer disabled:opacity-50 ${
                                      active
                                        ? 'bg-orange-500/[0.08] border-orange-500/20 text-orange-700'
                                        : 'bg-neutral-500/[0.04] border-neutral-500/10 text-transparent hover:text-neutral-300'
                                    }`}
                                    aria-label={`${active ? 'Revoke' : 'Grant'} ${permission.name} for ${formatRole(role.slug)}`}
                                  >
                                    <Check size={14} />
                                  </button>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      </div>

      {isAddRoleOpen && typeof document !== 'undefined' && createPortal(
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center px-4 py-6 ${
            isModalClosing ? 'animate-backdrop-leave' : 'animate-backdrop-enter'
          }`}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeAddRole();
          }}
        >
          <div className={`w-full max-w-md overflow-y-auto rounded-xl border border-neutral-200 bg-white shadow-2xl ${
            isModalClosing ? 'animate-modal-leave' : 'animate-modal-enter'
          }`}>
            <div className="flex items-center justify-between gap-4 border-b border-neutral-100 px-6 py-4">
              <div>
                <h3 className="text-base font-semibold text-neutral-800">Add Role</h3>
                <p className="mt-1 text-sm font-medium text-neutral-500">Permissions are assigned afterward in the Permissions tab.</p>
              </div>
              <button
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 transition-all hover:border-orange-200 hover:text-orange-700"
                onClick={closeAddRole}
                type="button"
              >
                <X size={16} />
              </button>
            </div>

            <form className="space-y-4.5 p-6" onSubmit={submitRole}>
              <FieldError label="Role Name" error={errors.name}>
                <input
                  className="mt-1.5 w-full rounded-lg border border-neutral-200/70 bg-white px-4 py-3 text-sm font-medium text-neutral-800 outline-none transition-all placeholder-neutral-400 shadow-premium-sm focus:border-orange-600 focus:ring-4 focus:ring-orange-500/5"
                  placeholder="e.g. Team Lead"
                  value={roleForm.name}
                  onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                  required
                />
              </FieldError>
              <FieldError label="Description" error={errors.description}>
                <textarea
                  className="mt-1.5 w-full rounded-lg border border-neutral-200/70 bg-white px-4 py-3 text-sm font-medium text-neutral-800 outline-none transition-all placeholder-neutral-400 shadow-premium-sm focus:border-orange-600 focus:ring-4 focus:ring-orange-500/5"
                  placeholder="What does this role represent?"
                  rows={3}
                  value={roleForm.description}
                  onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                />
              </FieldError>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full inline-flex items-center justify-center gap-2.5 rounded-lg bg-orange-600 disabled:bg-neutral-200 disabled:text-neutral-400 py-3.5 text-sm font-medium uppercase tracking-wide text-white shadow-md shadow-orange-600/10 hover:bg-orange-700 active:scale-98 transition-all duration-200 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Creating Role...
                  </>
                ) : (
                  <>
                    <Plus size={14} /> Create Role
                  </>
                )}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}
    </AppLayout>
  );
}

function Metric({ label, value, variant }: { label: string; value: number; variant: 'orange' | 'slate' | 'amber' | 'indigo' | 'green' }) {
  const styles = {
    orange: 'bg-orange-500/10 text-orange-700',
    slate: 'bg-neutral-500/10 text-neutral-600',
    amber: 'bg-amber-500/10 text-amber-700',
    indigo: 'bg-indigo-500/10 text-indigo-700',
    green: 'bg-green-500/10 text-green-700',
  };

  return (
    <div className="rounded-xl border border-neutral-200/50 bg-white p-6 shadow-premium-sm">
      <div className="text-xs font-medium uppercase tracking-wider text-neutral-500">{label}</div>
      <div className="mt-3.5 flex items-baseline gap-2.5">
        <span className="text-3xl font-semibold tracking-tight text-neutral-800">{value}</span>
        <span className={`inline-flex h-2 w-2 rounded-full ${styles[variant].split(' ')[0]}`}></span>
      </div>
    </div>
  );
}

function permissionSummary(role: Role) {
  const explicitCount = role.permissions?.length ?? 0;
  if (role.slug === 'staff' && explicitCount === 0) {
    return 'Standard employee access (no additional permissions)';
  }
  return `${explicitCount} permission${explicitCount === 1 ? '' : 's'}`;
}

function FieldError({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium uppercase tracking-wider text-neutral-500">
      {label}
      {children}
      {error && <span className="mt-1.5 block text-xs font-semibold normal-case tracking-normal text-red-600">{error}</span>}
    </label>
  );
}
