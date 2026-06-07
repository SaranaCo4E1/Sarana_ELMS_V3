<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Department;
use App\Models\LeaveBalance;
use App\Models\LeaveRequest;
use App\Models\LeaveType;
use App\Models\PublicHoliday;
use App\Models\User;
use App\Support\Audit;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class AdminController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('Admin', [
            'departments' => Department::with('manager')->withCount('users')->orderBy('name')->get(),
            'leaveTypes' => LeaveType::withCount('balances')->orderBy('name')->get(),
            'holidays' => PublicHoliday::orderByDesc('holiday_date')->get(),
            'users' => User::with(['department', 'manager', 'leaveBalances.leaveType'])
                ->withCount([
                    'leaveRequests as pending_leave_requests_count' => fn ($query) => $query->where('status', 'pending'),
                    'leaveRequests as approved_leave_requests_count' => fn ($query) => $query->where('status', 'approved')->whereYear('starts_at', now()->year),
                ])
                ->orderBy('name')
                ->get(),
            'auditLogs' => AuditLog::with([
                'actor',
                'subject' => function ($morphTo) {
                    $morphTo->morphWith([
                        LeaveRequest::class => ['user', 'leaveType'],
                        LeaveBalance::class => ['user', 'leaveType'],
                    ]);
                },
            ])->latest()->limit(250)->get(),
            'stats' => [
                'active_users' => User::query()->where('is_active', true)->count(),
                'inactive_users' => User::query()->where('is_active', false)->count(),
                'pending_requests' => LeaveRequest::query()->where('status', 'pending')->count(),
                'approved_this_month' => LeaveRequest::query()->where('status', 'approved')->whereMonth('decided_at', now()->month)->whereYear('decided_at', now()->year)->count(),
                'departments' => Department::query()->where('is_active', true)->count(),
                'leave_types' => LeaveType::query()->where('is_active', true)->count(),
            ],
        ]);
    }

    public function storeDepartment(Request $request): RedirectResponse
    {
        $department = Department::query()->create($request->validate([
            'name' => ['required', 'string', 'max:255', 'unique:departments,name'],
            'code' => ['required', 'string', 'max:20', 'unique:departments,code'],
            'manager_id' => ['nullable', 'exists:users,id'],
        ]));
        Audit::record($request, 'admin.department.created', $department);

        return back()->with('success', 'Department created.');
    }

    public function updateDepartment(Request $request, Department $department): RedirectResponse
    {
        $department->update($request->validate([
            'name' => ['required', 'string', 'max:255', Rule::unique('departments', 'name')->ignore($department)],
            'code' => ['required', 'string', 'max:20', Rule::unique('departments', 'code')->ignore($department)],
            'manager_id' => ['nullable', 'exists:users,id'],
        ]));
        Audit::record($request, 'admin.department.updated', $department);

        return back()->with('success', 'Department updated.');
    }

    public function storeLeaveType(Request $request): RedirectResponse
    {
        $leaveType = LeaveType::query()->create($request->validate([
            'name' => ['required', 'string', 'max:255', 'unique:leave_types,name'],
            'code' => ['required', 'string', 'max:30', 'unique:leave_types,code'],
            'default_allowance_days' => ['required', 'numeric', 'min:0', 'max:366'],
            'paid' => ['boolean'],
            'requires_attachment' => ['boolean'],
            'deducts_balance' => ['boolean'],
        ]));
        Audit::record($request, 'admin.leave_type.created', $leaveType);

        return back()->with('success', 'Leave type created.');
    }

    public function updateLeaveType(Request $request, LeaveType $leaveType): RedirectResponse
    {
        $leaveType->update($request->validate([
            'name' => ['required', 'string', 'max:255', Rule::unique('leave_types', 'name')->ignore($leaveType)],
            'code' => ['required', 'string', 'max:30', Rule::unique('leave_types', 'code')->ignore($leaveType)],
            'default_allowance_days' => ['required', 'numeric', 'min:0', 'max:366'],
            'paid' => ['boolean'],
            'requires_attachment' => ['boolean'],
            'deducts_balance' => ['boolean'],
        ]));
        Audit::record($request, 'admin.leave_type.updated', $leaveType);

        return back()->with('success', 'Leave type updated.');
    }

    public function storeHoliday(Request $request): RedirectResponse
    {
        $holiday = PublicHoliday::query()->create($request->validate([
            'holiday_date' => ['required', 'date', 'unique:public_holidays,holiday_date'],
            'name' => ['required', 'string', 'max:255'],
        ]));
        Audit::record($request, 'admin.holiday.created', $holiday);

        return back()->with('success', 'Holiday added.');
    }

    public function updateHoliday(Request $request, PublicHoliday $holiday): RedirectResponse
    {
        $holiday->update($request->validate([
            'holiday_date' => ['required', 'date', Rule::unique('public_holidays', 'holiday_date')->ignore($holiday)],
            'name' => ['required', 'string', 'max:255'],
        ]));
        Audit::record($request, 'admin.holiday.updated', $holiday);

        return back()->with('success', 'Holiday updated.');
    }

    public function storeUser(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'department_id' => ['nullable', 'exists:departments,id'],
            'manager_id' => ['nullable', Rule::exists('users', 'id')->whereIn('role', ['manager', 'admin'])],
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
            'role' => ['required', Rule::in(['staff', 'manager', 'hr admin', 'admin'])],
            'employee_code' => ['nullable', 'string', 'max:50', 'unique:users,employee_code'],
            'job_title' => ['nullable', 'string', 'max:255'],
            'hire_date' => ['nullable', 'date'],
            'two_factor_enabled' => ['boolean'],
        ]);
        $data['password'] = Hash::make($data['password']);
        $user = User::query()->create($data);
        Audit::record($request, 'admin.user.created', $user);

        return back()->with('success', 'User created.');
    }

    public function updateUser(Request $request, User $user): RedirectResponse
    {
        $data = $request->validate([
            'department_id' => ['nullable', 'exists:departments,id'],
            'manager_id' => ['nullable', Rule::exists('users', 'id')->whereIn('role', ['manager', 'admin']), Rule::notIn([$user->id])],
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', Rule::unique('users', 'email')->ignore($user)],
            'password' => ['nullable', 'string', 'min:8'],
            'role' => ['required', Rule::in(['staff', 'manager', 'hr admin', 'admin'])],
            'employee_code' => ['nullable', 'string', 'max:50', Rule::unique('users', 'employee_code')->ignore($user)],
            'job_title' => ['nullable', 'string', 'max:255'],
            'hire_date' => ['nullable', 'date'],
            'two_factor_enabled' => ['boolean'],
        ]);

        if (filled($data['password'] ?? null)) {
            $data['password'] = Hash::make($data['password']);
        } else {
            unset($data['password']);
        }

        $user->update($data);
        Audit::record($request, 'admin.user.updated', $user);

        return back()->with('success', 'User updated.');
    }

    public function overrideBalance(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'user_id' => ['required', 'exists:users,id'],
            'leave_type_id' => ['required', 'exists:leave_types,id'],
            'year' => ['required', 'integer', 'min:2000', 'max:2100'],
            'allowance_days' => ['required', 'numeric', 'min:0', 'max:366'],
            'adjustment_days' => ['required', 'numeric', 'min:-366', 'max:366'],
            'override_reason' => ['required', 'string', 'max:1000'],
        ]);

        $balance = LeaveBalance::query()->updateOrCreate(
            ['user_id' => $data['user_id'], 'leave_type_id' => $data['leave_type_id'], 'year' => $data['year']],
            $data
        );
        Audit::record($request, 'admin.balance.overridden', $balance);

        return back()->with('success', 'Leave balance updated.');
    }

    public function updateUserStatus(Request $request, User $user): RedirectResponse
    {
        $data = $request->validate(['is_active' => ['required', 'boolean']]);
        abort_if($request->user()->is($user) && ! $data['is_active'], 422, 'You cannot deactivate your own account.');

        $user->update($data);
        Audit::record($request, $data['is_active'] ? 'admin.user.activated' : 'admin.user.deactivated', $user);

        return back()->with('success', 'User status updated.');
    }

    public function updateLeaveTypeStatus(Request $request, LeaveType $leaveType): RedirectResponse
    {
        $data = $request->validate(['is_active' => ['required', 'boolean']]);
        $leaveType->update($data);
        Audit::record($request, $data['is_active'] ? 'admin.leave_type.activated' : 'admin.leave_type.deactivated', $leaveType);

        return back()->with('success', 'Leave type status updated.');
    }

    public function updateDepartmentStatus(Request $request, Department $department): RedirectResponse
    {
        $data = $request->validate(['is_active' => ['required', 'boolean']]);
        $department->update($data);
        Audit::record($request, $data['is_active'] ? 'admin.department.activated' : 'admin.department.deactivated', $department);

        return back()->with('success', 'Department status updated.');
    }

    public function updateHolidayStatus(Request $request, PublicHoliday $holiday): RedirectResponse
    {
        $data = $request->validate(['is_active' => ['required', 'boolean']]);
        $holiday->update($data);
        Audit::record($request, $data['is_active'] ? 'admin.holiday.activated' : 'admin.holiday.deactivated', $holiday);

        return back()->with('success', 'Holiday status updated.');
    }
}
