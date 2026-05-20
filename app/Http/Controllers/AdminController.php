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
            'password' => ['required', 'string', 'min:8'],
            'role' => ['required', 'in:staff,manager,hr,admin'],
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
}
