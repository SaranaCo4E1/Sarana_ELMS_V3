<?php

namespace App\Http\Controllers;

use App\Models\Department;
use App\Models\LeaveBalance;
use App\Models\LeaveType;
use App\Models\PublicHoliday;
use App\Models\User;
use App\Support\Audit;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class AdminController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('Admin', [
            'departments' => Department::with('manager')->orderBy('name')->get(),
            'leaveTypes' => LeaveType::orderBy('name')->get(),
            'holidays' => PublicHoliday::orderByDesc('holiday_date')->get(),
            'users' => User::with(['department', 'manager'])->orderBy('name')->get(),
            'balances' => LeaveBalance::with(['user.department', 'leaveType'])
                ->where('year', now()->year)
                ->orderBy('user_id')
                ->get(),
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

    public function storeHoliday(Request $request): RedirectResponse
    {
        $holiday = PublicHoliday::query()->create($request->validate([
            'holiday_date' => ['required', 'date', 'unique:public_holidays,holiday_date'],
            'name' => ['required', 'string', 'max:255'],
        ]));
        Audit::record($request, 'admin.holiday.created', $holiday);

        return back()->with('success', 'Holiday added.');
    }

    public function storeUser(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'department_id' => ['nullable', 'exists:departments,id'],
            'manager_id' => ['nullable', 'exists:users,id'],
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'unique:users,email'],
            'role' => ['required', 'in:staff,manager,hr,admin'],
            'employee_code' => ['nullable', 'string', 'max:50', 'unique:users,employee_code'],
            'job_title' => ['nullable', 'string', 'max:255'],
            'hire_date' => ['nullable', 'date'],
            'two_factor_enabled' => ['boolean'],
        ]);

        $defaultPassword = Str::random(12);
        $data['password'] = Hash::make($defaultPassword);
        $data['must_change_password'] = true;
        $user = User::query()->create($data);
        Audit::record($request, 'admin.user.created', $user);

        return back()->with('success', 'User created.')->with('default_password', $defaultPassword);
    }

    public function updateDepartment(Request $request, Department $department): RedirectResponse
    {
        $department->update($request->validate([
            'name' => ['required', 'string', 'max:255', 'unique:departments,name,' . $department->id],
            'code' => ['required', 'string', 'max:20', 'unique:departments,code,' . $department->id],
            'manager_id' => ['nullable', 'exists:users,id'],
        ]));
        Audit::record($request, 'admin.department.updated', $department);

        return back()->with('success', 'Department updated.');
    }

    public function destroyDepartment(Request $request, Department $department): RedirectResponse
    {
        if (User::where('department_id', $department->id)->exists()) {
            return back()->with('error', 'Cannot delete this department because it still has assigned users.');
        }

        Audit::record($request, 'admin.department.deleted', $department);
        $department->delete();

        return back()->with('success', 'Department deleted.');
    }

    public function updateLeaveType(Request $request, LeaveType $leaveType): RedirectResponse
    {
        $leaveType->update($request->validate([
            'name' => ['required', 'string', 'max:255', 'unique:leave_types,name,' . $leaveType->id],
            'code' => ['required', 'string', 'max:30', 'unique:leave_types,code,' . $leaveType->id],
            'default_allowance_days' => ['required', 'numeric', 'min:0', 'max:366'],
            'paid' => ['boolean'],
            'requires_attachment' => ['boolean'],
            'deducts_balance' => ['boolean'],
        ]));
        Audit::record($request, 'admin.leave_type.updated', $leaveType);

        return back()->with('success', 'Leave type updated.');
    }

    public function destroyLeaveType(Request $request, LeaveType $leaveType): RedirectResponse
    {
        $hasRequests = \App\Models\LeaveRequest::where('leave_type_id', $leaveType->id)->exists();
        $hasBalances = \App\Models\LeaveBalance::where('leave_type_id', $leaveType->id)->exists();

        if ($hasRequests || $hasBalances) {
            return back()->with('error', 'Cannot delete this leave type because it has existing requests or balances. Consider deactivating it instead.');
        }

        Audit::record($request, 'admin.leave_type.deleted', $leaveType);
        $leaveType->delete();

        return back()->with('success', 'Leave type deleted.');
    }

    public function updateHoliday(Request $request, PublicHoliday $holiday): RedirectResponse
    {
        $holiday->update($request->validate([
            'holiday_date' => ['required', 'date', 'unique:public_holidays,holiday_date,' . $holiday->id],
            'name' => ['required', 'string', 'max:255'],
        ]));
        Audit::record($request, 'admin.holiday.updated', $holiday);

        return back()->with('success', 'Holiday updated.');
    }

    public function destroyHoliday(Request $request, PublicHoliday $holiday): RedirectResponse
    {
        Audit::record($request, 'admin.holiday.deleted', $holiday);
        $holiday->delete();

        return back()->with('success', 'Holiday deleted.');
    }

    public function updateUser(Request $request, User $user): RedirectResponse
    {
        $data = $request->validate([
            'department_id' => ['nullable', 'exists:departments,id'],
            'manager_id' => ['nullable', 'exists:users,id'],
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'unique:users,email,' . $user->id],
            'password' => ['nullable', 'string', 'min:8'],
            'role' => ['required', 'in:staff,manager,hr,admin'],
            'employee_code' => ['nullable', 'string', 'max:50', 'unique:users,employee_code,' . $user->id],
            'job_title' => ['nullable', 'string', 'max:255'],
            'hire_date' => ['nullable', 'date'],
            'two_factor_enabled' => ['boolean'],
        ]);

        if (!empty($data['password'])) {
            $data['password'] = Hash::make($data['password']);
        } else {
            unset($data['password']);
        }

        $user->update($data);
        Audit::record($request, 'admin.user.updated', $user);

        return back()->with('success', 'User updated.');
    }

    public function destroyUser(Request $request, User $user): RedirectResponse
    {
        if (\App\Models\LeaveRequest::where('user_id', $user->id)->exists()) {
            return back()->with('error', 'Cannot delete this user because they have existing leave requests. Consider deactivating the account instead.');
        }

        Audit::record($request, 'admin.user.deleted', $user);
        $user->delete();

        return back()->with('success', 'User deleted.');
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

    public function updateBalance(Request $request, LeaveBalance $balance): RedirectResponse
    {
        $data = $request->validate([
            'allowance_days' => ['required', 'numeric', 'min:0', 'max:366'],
            'adjustment_days' => ['required', 'numeric', 'min:-366', 'max:366'],
            'override_reason' => ['required', 'string', 'max:1000'],
        ]);

        $balance->update($data);
        Audit::record($request, 'admin.balance.updated', $balance);

        return back()->with('success', 'Balance updated.');
    }

    public function destroyBalance(Request $request, LeaveBalance $balance): RedirectResponse
    {
        Audit::record($request, 'admin.balance.deleted', $balance);
        $balance->delete();

        return back()->with('success', 'Balance deleted.');
    }
}
