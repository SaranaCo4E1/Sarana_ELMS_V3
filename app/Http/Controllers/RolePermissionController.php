<?php

namespace App\Http\Controllers;

use App\Models\Permission;
use App\Models\Role;
use App\Support\Audit;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class RolePermissionController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('RolesPermissions', [
            'roles' => Role::with('permissions')->withCount('users')->orderBy('name')->get(),
            'permissions' => Permission::orderBy('group')->orderBy('name')->get(),
        ]);
    }

    public function storeRole(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:1000'],
        ]);

        $slug = mb_strtolower(trim($data['name']));

        if (Role::query()->where('slug', $slug)->exists()) {
            throw ValidationException::withMessages(['name' => 'A role with this name already exists.']);
        }

        $role = Role::query()->create([
            'name' => $data['name'],
            'slug' => $slug,
            'description' => $data['description'] ?? null,
            'is_system' => false,
        ]);
        Audit::recordChange($request, 'admin.role.created', $role, [], $role->only([
            'name', 'slug', 'description', 'is_system',
        ]));

        return back()->with('success', 'Role created.');
    }

    public function updateRolePermissions(Request $request, Role $role): RedirectResponse
    {
        $data = $request->validate([
            'permission_ids' => ['present', 'array'],
            'permission_ids.*' => ['integer', 'exists:permissions,id'],
        ]);

        $before = $role->permissions()->orderBy('key')->pluck('key')->all();
        $role->permissions()->sync($data['permission_ids']);
        $after = $role->permissions()->orderBy('key')->pluck('key')->all();
        Audit::recordChange($request, 'admin.role.permissions_updated', $role, [
            'permissions' => $before,
        ], [
            'permissions' => $after,
        ], [
            'permissions_added' => array_values(array_diff($after, $before)),
            'permissions_removed' => array_values(array_diff($before, $after)),
        ]);

        return back()->with('success', 'Role permissions updated.');
    }
}
