<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Department;
use App\Models\LeaveBalance;
use App\Models\LeaveRequest;
use App\Models\LeaveType;
use App\Models\PublicHoliday;
use App\Models\Role;
use App\Models\User;
use App\Services\AttendanceService;
use App\Support\Audit;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class AdminController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('Admin', [
            'roles' => Role::orderBy('name')->get(['id', 'name', 'slug']),
            'managerEligibleRoleSlugs' => $this->managerEligibleRoleSlugs(),
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
        Audit::recordChange($request, 'admin.department.created', $department, [], $department->only([
            'name', 'code', 'manager_id', 'is_active',
        ]));

        return back()->with('success', 'Department created.');
    }

    public function updateDepartment(Request $request, Department $department): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255', Rule::unique('departments', 'name')->ignore($department)],
            'code' => ['required', 'string', 'max:20', Rule::unique('departments', 'code')->ignore($department)],
            'manager_id' => ['nullable', 'exists:users,id'],
        ]);
        $before = $department->only(array_keys($data));
        $department->update($data);
        Audit::recordChange($request, 'admin.department.updated', $department, $before, $department->only(array_keys($data)));

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
        Audit::recordChange($request, 'admin.leave_type.created', $leaveType, [], $leaveType->only([
            'name', 'code', 'default_allowance_days', 'paid', 'requires_attachment', 'deducts_balance', 'is_active',
        ]));

        return back()->with('success', 'Leave type created.');
    }

    public function updateLeaveType(Request $request, LeaveType $leaveType): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255', Rule::unique('leave_types', 'name')->ignore($leaveType)],
            'code' => ['required', 'string', 'max:30', Rule::unique('leave_types', 'code')->ignore($leaveType)],
            'default_allowance_days' => ['required', 'numeric', 'min:0', 'max:366'],
            'paid' => ['boolean'],
            'requires_attachment' => ['boolean'],
            'deducts_balance' => ['boolean'],
        ]);
        $before = $leaveType->only(array_keys($data));
        $leaveType->update($data);
        Audit::recordChange($request, 'admin.leave_type.updated', $leaveType, $before, $leaveType->only(array_keys($data)));

        return back()->with('success', 'Leave type updated.');
    }

    public function storeHoliday(Request $request): RedirectResponse
    {
        $holiday = PublicHoliday::query()->create($request->validate([
            'holiday_date' => ['required', 'date', 'unique:public_holidays,holiday_date'],
            'name' => ['required', 'string', 'max:255'],
        ]));
        Audit::recordChange($request, 'admin.holiday.created', $holiday, [], $holiday->only([
            'name', 'holiday_date', 'is_active',
        ]));

        return back()->with('success', 'Holiday added.');
    }

    public function updateHoliday(Request $request, PublicHoliday $holiday): RedirectResponse
    {
        $data = $request->validate([
            'holiday_date' => ['required', 'date', Rule::unique('public_holidays', 'holiday_date')->ignore($holiday)],
            'name' => ['required', 'string', 'max:255'],
        ]);
        $before = $holiday->only(array_keys($data));
        $holiday->update($data);
        Audit::recordChange($request, 'admin.holiday.updated', $holiday, $before, $holiday->only(array_keys($data)));

        return back()->with('success', 'Holiday updated.');
    }

    public function storeUser(Request $request, AttendanceService $attendance): RedirectResponse
    {
        $data = $request->validate([
            'department_id' => ['nullable', 'exists:departments,id'],
            'manager_id' => ['nullable', Rule::exists('users', 'id')->whereIn('role', $this->managerEligibleRoleSlugs())],
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
            'role' => ['required', Rule::in(Role::query()->pluck('slug'))],
            'phone' => ['required', 'string', 'max:30'],
            'employee_code' => ['nullable', 'string', 'max:50', 'unique:users,employee_code'],
            'job_title' => ['nullable', 'string', 'max:255'],
            'hire_date' => ['nullable', 'date'],
            'two_factor_enabled' => ['boolean'],
        ]);
        $data['password'] = Hash::make($data['password']);

        $user = DB::transaction(function () use ($data): User {
            $department = filled($data['department_id'] ?? null)
                ? Department::query()->findOrFail($data['department_id'])
                : null;

            $data['employee_code'] = null;
            $user = User::query()->create($data);

            $user->update([
                'employee_code' => $department
                    ? User::formatEmployeeCode($department, $user->id)
                    : null,
            ]);

            return $user;
        });
        Audit::recordChange($request, 'admin.user.created', $user, [], $user->only([
            'name', 'email', 'role', 'phone', 'employee_code', 'department_id', 'manager_id',
            'job_title', 'hire_date', 'two_factor_enabled', 'is_active',
        ]));
        $attendance->createDefaultSchedule($user);

        return back()->with('success', 'User created.');
    }

    public function updateUser(Request $request, User $user): RedirectResponse
    {
        $data = $request->validate([
            'department_id' => ['nullable', 'exists:departments,id'],
            'manager_id' => ['nullable', Rule::exists('users', 'id')->whereIn('role', $this->managerEligibleRoleSlugs()), Rule::notIn([$user->id])],
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', Rule::unique('users', 'email')->ignore($user)],
            'password' => ['nullable', 'string', 'min:8'],
            'role' => ['required', Rule::in(Role::query()->pluck('slug'))],
            'phone' => ['required', 'string', 'max:30'],
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

        $department = filled($data['department_id'] ?? null)
            ? Department::query()->findOrFail($data['department_id'])
            : null;
        $data['employee_code'] = $department
            ? User::formatEmployeeCode($department, $user->id)
            : null;

        $before = $user->only(array_keys($data));
        $passwordChanged = array_key_exists('password', $data);
        $user->update($data);
        Audit::recordChange(
            $request,
            'admin.user.updated',
            $user,
            $before,
            $user->only(array_keys($data)),
            ['password_changed' => $passwordChanged]
        );

        return back()->with('success', 'User updated.');
    }

    public function overrideBalance(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'user_id' => ['required', 'exists:users,id'],
            'leave_type_id' => ['required', 'exists:leave_types,id'],
            'delta_days' => ['required', 'numeric', 'min:-366', 'max:366', 'not_in:0'],
            'override_reason' => ['required', 'string', 'max:1000'],
        ]);

        $currentYear = now()->year;

        DB::transaction(function () use ($currentYear, $data, $request) {
            $leaveType = LeaveType::query()->findOrFail($data['leave_type_id']);
            $balance = LeaveBalance::query()->firstOrCreate(
                ['user_id' => $data['user_id'], 'leave_type_id' => $leaveType->id, 'year' => $currentYear],
                ['allowance_days' => $leaveType->default_allowance_days]
            );
            $balance = LeaveBalance::query()->lockForUpdate()->findOrFail($balance->id);
            $before = [
                'adjustment_days' => (float) $balance->adjustment_days,
                'available_days' => (float) $balance->available_days,
                'override_reason' => $balance->override_reason,
            ];
            $balance->adjustment_days = (float) $balance->adjustment_days + (float) $data['delta_days'];
            $balance->override_reason = $data['override_reason'];
            $balance->save();

            Audit::recordChange($request, 'admin.balance.overridden', $balance, $before, [
                'adjustment_days' => (float) $balance->adjustment_days,
                'available_days' => (float) $balance->available_days,
                'override_reason' => $balance->override_reason,
            ], [
                'delta_days' => (float) $data['delta_days'],
                'year' => $currentYear,
                'reason' => $data['override_reason'],
            ]);
        });

        return back()->with('success', 'Leave balance updated.');
    }

    public function updateUserStatus(Request $request, User $user): RedirectResponse
    {
        $data = $request->validate(['is_active' => ['required', 'boolean']]);
        abort_if($request->user()->is($user) && ! $data['is_active'], 422, 'You cannot deactivate your own account.');

        $before = $user->only(['is_active']);
        $user->update($data);
        Audit::recordChange($request, $data['is_active'] ? 'admin.user.activated' : 'admin.user.deactivated', $user, $before, $user->only(['is_active']));

        return back()->with('success', 'User status updated.');
    }

    public function updateLeaveTypeStatus(Request $request, LeaveType $leaveType): RedirectResponse
    {
        $data = $request->validate(['is_active' => ['required', 'boolean']]);
        $before = $leaveType->only(['is_active']);
        $leaveType->update($data);
        Audit::recordChange($request, $data['is_active'] ? 'admin.leave_type.activated' : 'admin.leave_type.deactivated', $leaveType, $before, $leaveType->only(['is_active']));

        return back()->with('success', 'Leave type status updated.');
    }

    public function updateDepartmentStatus(Request $request, Department $department): RedirectResponse
    {
        $data = $request->validate(['is_active' => ['required', 'boolean']]);
        $before = $department->only(['is_active']);
        $department->update($data);
        Audit::recordChange($request, $data['is_active'] ? 'admin.department.activated' : 'admin.department.deactivated', $department, $before, $department->only(['is_active']));

        return back()->with('success', 'Department status updated.');
    }

    public function updateHolidayStatus(Request $request, PublicHoliday $holiday): RedirectResponse
    {
        $data = $request->validate(['is_active' => ['required', 'boolean']]);
        $before = $holiday->only(['is_active']);
        $holiday->update($data);
        Audit::recordChange($request, $data['is_active'] ? 'admin.holiday.activated' : 'admin.holiday.deactivated', $holiday, $before, $holiday->only(['is_active']));

        return back()->with('success', 'Holiday status updated.');
    }

    /**
     * @return array<int, string>
     */
    private function managerEligibleRoleSlugs(): array
    {
        return Role::query()
            ->whereHas('permissions', fn ($query) => $query->where('key', 'approvals.manage'))
            ->pluck('slug')
            ->all();
    }
}
