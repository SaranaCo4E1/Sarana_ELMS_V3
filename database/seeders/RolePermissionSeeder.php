<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;

class RolePermissionSeeder extends Seeder
{
    public function run(): void
    {
        $permissions = collect([
            ['key' => 'users.manage', 'name' => 'Manage Users', 'group' => 'Users', 'description' => 'Create, edit, and activate/deactivate user accounts.'],
            ['key' => 'departments.manage', 'name' => 'Manage Departments', 'group' => 'Departments', 'description' => 'Create, edit, and activate/deactivate departments.'],
            ['key' => 'leave_types.manage', 'name' => 'Manage Leave Types', 'group' => 'Leave Types', 'description' => 'Create, edit, and activate/deactivate leave policies.'],
            ['key' => 'holidays.manage', 'name' => 'Manage Public Holidays', 'group' => 'Holidays', 'description' => 'Create, edit, and activate/deactivate public holidays.'],
            ['key' => 'balances.override', 'name' => 'Override Leave Balances', 'group' => 'Balances', 'description' => 'Directly adjust or set leave balance quotas for staff.'],
            ['key' => 'reports.view', 'name' => 'View Monthly Reports', 'group' => 'Reports', 'description' => 'View and export monthly leave reports.'],
            ['key' => 'audit_logs.view', 'name' => 'View Audit Logs', 'group' => 'Reports', 'description' => 'View and export system audit logs.'],
            ['key' => 'team.view', 'name' => 'View Team Center', 'group' => 'Team', 'description' => 'View team members and their leave activity.'],
            ['key' => 'approvals.manage', 'name' => 'Manage Leave Approvals', 'group' => 'Approvals', 'description' => 'Approve or reject leave requests.'],
            ['key' => 'support_tickets.manage', 'name' => 'Manage Support Tickets', 'group' => 'Support', 'description' => 'View and respond to support tickets.'],
        ])->mapWithKeys(function (array $data) {
            $permission = Permission::query()->updateOrCreate(['key' => $data['key']], $data);

            return [$data['key'] => $permission];
        });

        $roles = collect([
            [
                'slug' => 'admin',
                'name' => 'Admin',
                'description' => 'Full system access, including user, role, and configuration management.',
                'permissions' => $permissions->keys()->all(),
            ],
            [
                'slug' => 'hr admin',
                'name' => 'HR Admin',
                'description' => 'Manages users, departments, leave policies, and reporting.',
                'permissions' => $permissions->keys()->reject(fn (string $key) => $key === 'support_tickets.manage')->all(),
            ],
            [
                'slug' => 'manager',
                'name' => 'Manager',
                'description' => 'Views team members and approves leave requests for direct reports.',
                'permissions' => ['team.view', 'approvals.manage'],
            ],
            [
                'slug' => 'staff',
                'name' => 'Staff',
                'description' => 'Standard employee access with no management capabilities.',
                'permissions' => [],
            ],
        ]);

        foreach ($roles as $data) {
            $role = Role::query()->updateOrCreate(
                ['slug' => $data['slug']],
                ['name' => $data['name'], 'description' => $data['description'], 'is_system' => true]
            );

            $role->permissions()->sync(
                $permissions->only($data['permissions'])->map(fn (Permission $permission) => $permission->id)->values()->all()
            );
        }
    }
}
