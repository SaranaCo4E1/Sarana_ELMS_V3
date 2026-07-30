<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $now = now();
        $permissions = [
            'reports.self.view' => [
                'name' => 'View Personal Reports',
                'group' => 'Reports',
                'description' => 'View and export personal leave and attendance reports.',
            ],
            'reports.team.view' => [
                'name' => 'View Team Reports',
                'group' => 'Reports',
                'description' => 'View and export reports for direct reports.',
            ],
            'reports.view' => [
                'name' => 'View Organization Reports',
                'group' => 'Reports',
                'description' => 'View and export organization-wide leave and attendance reports.',
            ],
        ];

        foreach ($permissions as $key => $attributes) {
            DB::table('permissions')->updateOrInsert(
                ['key' => $key],
                [...$attributes, 'updated_at' => $now, 'created_at' => $now],
            );
        }

        $rolePermissions = [
            'staff' => ['reports.self.view'],
            'manager' => ['reports.self.view', 'reports.team.view'],
            'hr admin' => ['reports.self.view', 'reports.team.view', 'reports.view'],
            'admin' => ['reports.self.view', 'reports.team.view', 'reports.view'],
        ];

        foreach ($rolePermissions as $roleSlug => $keys) {
            $roleId = DB::table('roles')->where('slug', $roleSlug)->value('id');
            if (! $roleId) {
                continue;
            }

            $permissionIds = DB::table('permissions')->whereIn('key', $keys)->pluck('id');
            foreach ($permissionIds as $permissionId) {
                DB::table('permission_role')->updateOrInsert(
                    ['role_id' => $roleId, 'permission_id' => $permissionId],
                    ['updated_at' => $now, 'created_at' => $now],
                );
            }
        }

        Schema::table('leave_requests', function (Blueprint $table) {
            $table->index(['user_id', 'status', 'starts_at'], 'leave_requests_report_scope_idx');
            $table->index(['starts_at', 'ends_at'], 'leave_requests_report_dates_idx');
        });
    }

    public function down(): void
    {
        $permissionIds = DB::table('permissions')
            ->whereIn('key', ['reports.self.view', 'reports.team.view'])
            ->pluck('id');

        DB::table('permission_role')->whereIn('permission_id', $permissionIds)->delete();
        DB::table('permissions')->whereIn('id', $permissionIds)->delete();

        Schema::table('leave_requests', function (Blueprint $table) {
            $table->dropIndex('leave_requests_report_scope_idx');
            $table->dropIndex('leave_requests_report_dates_idx');
        });
    }
};
