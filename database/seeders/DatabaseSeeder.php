<?php

namespace Database\Seeders;

use App\Models\AiFaq;
use App\Models\Department;
use App\Models\LeaveBalance;
use App\Models\LeaveType;
use App\Models\PublicHoliday;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $engineering = Department::query()->firstOrCreate(['code' => 'ENG'], ['name' => 'Engineering']);
        $operations = Department::query()->firstOrCreate(['code' => 'OPS'], ['name' => 'Operations']);
        $hrDepartment = Department::query()->firstOrCreate(['code' => 'HR'], ['name' => 'Human Resources']);

        $admin = User::query()->firstOrCreate(
            ['email' => 'admin@elms.test'],
            ['name' => 'ELMS Admin', 'password' => Hash::make('password'), 'role' => 'admin', 'department_id' => $hrDepartment->id, 'employee_code' => 'ADM-001', 'job_title' => 'System Administrator', 'hire_date' => now()->subYears(3)]
        );
        $hr = User::query()->firstOrCreate(
            ['email' => 'hr@elms.test'],
            ['name' => 'HR Manager', 'password' => Hash::make('password'), 'role' => 'hr', 'department_id' => $hrDepartment->id, 'manager_id' => $admin->id, 'employee_code' => 'HR-001', 'job_title' => 'HR Lead', 'hire_date' => now()->subYears(2)]
        );
        $manager = User::query()->firstOrCreate(
            ['email' => 'manager@elms.test'],
            ['name' => 'Data Operations Manager', 'password' => Hash::make('password'), 'role' => 'manager', 'department_id' => $operations->id, 'manager_id' => $hr->id, 'employee_code' => 'OPS-001', 'job_title' => 'Department Manager', 'hire_date' => now()->subYears(2)]
        );
        User::query()->firstOrCreate(
            ['email' => 'staff@elms.test'],
            ['name' => 'General Staff', 'password' => Hash::make('password'), 'role' => 'staff', 'department_id' => $operations->id, 'manager_id' => $manager->id, 'employee_code' => 'OPS-101', 'job_title' => 'Data Annotator', 'hire_date' => now()->subYear()]
        );

        $operations->update(['manager_id' => $manager->id]);
        $hrDepartment->update(['manager_id' => $hr->id]);
        $engineering->update(['manager_id' => $manager->id]);

        $types = [
            ['name' => 'Annual Leave', 'code' => 'annual', 'default_allowance_days' => 10, 'paid' => true, 'requires_attachment' => false, 'deducts_balance' => true],
            ['name' => 'Sick Leave', 'code' => 'sick', 'default_allowance_days' => 30, 'paid' => true, 'requires_attachment' => true, 'deducts_balance' => true],
            ['name' => 'Unpaid Leave', 'code' => 'unpaid', 'default_allowance_days' => 0, 'paid' => false, 'requires_attachment' => false, 'deducts_balance' => false],
        ];

        foreach ($types as $type) {
            LeaveType::query()->firstOrCreate(['code' => $type['code']], $type);
        }

        PublicHoliday::query()->firstOrCreate(['holiday_date' => now()->year.'-01-01'], ['name' => 'New Year Day']);
        PublicHoliday::query()->firstOrCreate(['holiday_date' => now()->year.'-04-13'], ['name' => 'Songkran Festival']);

        User::query()->each(function (User $user) {
            LeaveType::query()->each(function (LeaveType $type) use ($user) {
                LeaveBalance::query()->firstOrCreate(
                    ['user_id' => $user->id, 'leave_type_id' => $type->id, 'year' => now()->year],
                    ['allowance_days' => $type->default_allowance_days]
                );
            });
        });

        AiFaq::query()->firstOrCreate(
            ['question' => 'When do I need a medical certificate?'],
            ['answer' => 'A medical certificate is required for sick leave requests configured by HR as attachment-required.']
        );
        AiFaq::query()->firstOrCreate(
            ['question' => 'How are leave days calculated?'],
            ['answer' => 'The system counts working days between the selected dates, excluding weekends and configured public holidays.']
        );
    }
}
