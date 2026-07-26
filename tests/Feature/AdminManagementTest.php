<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\LeaveType;
use App\Models\PublicHoliday;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_hr_admin_creates_user_with_employee_code_based_on_global_user_id(): void
    {
        $hrAdmin = User::factory()->create(['role' => 'hr admin']);
        $departmentManager = User::factory()->create(['role' => 'manager']);
        $engineering = Department::query()->create([
            'name' => 'Engineering',
            'code' => 'ENG',
            'manager_id' => $departmentManager->id,
            'is_active' => true,
        ]);
        $sales = Department::query()->create([
            'name' => 'Sales',
            'code' => 'SALES',
            'is_active' => true,
        ]);
        User::factory()->create([
            'department_id' => $engineering->id,
            'employee_code' => 'ENG-009',
        ]);
        User::factory()->create([
            'department_id' => $sales->id,
            'employee_code' => 'SALES-099',
        ]);

        $response = $this
            ->actingAs($hrAdmin)
            ->post(route('admin.users.store'), [
                'department_id' => $engineering->id,
                'manager_id' => $departmentManager->id,
                'name' => 'New Engineer',
                'email' => 'new.engineer@example.com',
                'password' => 'password',
                'role' => 'staff',
                'employee_code' => 'TAMPERED-999',
                'job_title' => 'Software Engineer',
                'hire_date' => now()->toDateString(),
                'two_factor_enabled' => false,
            ]);

        $response->assertSessionHasNoErrors();
        $response->assertRedirect();

        $user = User::query()->where('email', 'new.engineer@example.com')->firstOrFail();

        $this->assertSame('ENG-005', $user->employee_code);
        $this->assertSame($engineering->id, $user->department_id);
        $this->assertSame($departmentManager->id, $user->manager_id);
        $this->assertSame('Software Engineer', $user->job_title);
        $this->assertDatabaseMissing(User::class, [
            'employee_code' => 'TAMPERED-999',
        ]);
    }

    public function test_user_without_department_is_created_without_employee_code(): void
    {
        $hrAdmin = User::factory()->create(['role' => 'hr admin']);

        $response = $this
            ->actingAs($hrAdmin)
            ->post(route('admin.users.store'), [
                'department_id' => null,
                'manager_id' => null,
                'name' => 'Unassigned Employee',
                'email' => 'unassigned@example.com',
                'password' => 'password',
                'role' => 'staff',
                'employee_code' => 'TAMPERED-999',
                'job_title' => null,
                'hire_date' => null,
                'two_factor_enabled' => false,
            ]);

        $response->assertSessionHasNoErrors();

        $this->assertDatabaseHas(User::class, [
            'name' => 'Unassigned Employee',
            'department_id' => null,
            'employee_code' => null,
        ]);
    }

    public function test_hr_admin_can_update_a_user_without_changing_password(): void
    {
        $hrAdmin = User::factory()->create(['role' => 'hr admin']);
        $manager = User::factory()->create(['role' => 'manager']);
        $department = Department::query()->create([
            'name' => 'People Operations',
            'code' => 'POPS',
            'is_active' => true,
        ]);
        $newDepartment = Department::query()->create([
            'name' => 'Engineering',
            'code' => 'ENG',
            'is_active' => true,
        ]);
        $user = User::factory()->create([
            'department_id' => $department->id,
            'role' => 'staff',
            'employee_code' => 'EMP-001',
            'job_title' => 'Coordinator',
        ]);

        $response = $this
            ->actingAs($hrAdmin)
            ->patch(route('admin.users.update', $user), [
                'department_id' => $newDepartment->id,
                'manager_id' => $manager->id,
                'name' => 'Updated Employee',
                'email' => $user->email,
                'password' => null,
                'role' => 'manager',
                'employee_code' => 'EMP-002',
                'job_title' => 'Team Lead',
                'hire_date' => now()->toDateString(),
                'two_factor_enabled' => true,
            ]);

        $response->assertSessionHasNoErrors();
        $response->assertRedirect();

        $expectedEmployeeCode = 'ENG-'.str_pad((string) $user->id, 3, '0', STR_PAD_LEFT);

        $this->assertDatabaseHas(User::class, [
            'id' => $user->id,
            'name' => 'Updated Employee',
            'department_id' => $newDepartment->id,
            'manager_id' => $manager->id,
            'role' => 'manager',
            'employee_code' => $expectedEmployeeCode,
            'job_title' => 'Team Lead',
            'two_factor_enabled' => true,
        ]);
    }

    public function test_reporting_manager_must_have_manager_or_admin_role(): void
    {
        $hrAdmin = User::factory()->create(['role' => 'hr admin']);
        $staffManager = User::factory()->create(['role' => 'staff']);
        $user = User::factory()->create(['role' => 'staff']);

        $response = $this
            ->actingAs($hrAdmin)
            ->patch(route('admin.users.update', $user), [
                'department_id' => null,
                'manager_id' => $staffManager->id,
                'name' => $user->name,
                'email' => $user->email,
                'password' => null,
                'role' => 'staff',
                'employee_code' => null,
                'job_title' => null,
                'hire_date' => null,
                'two_factor_enabled' => false,
            ]);

        $response->assertSessionHasErrors('manager_id');
    }

    public function test_hr_admin_can_update_department_leave_type_and_holiday(): void
    {
        $hrAdmin = User::factory()->create(['role' => 'hr admin']);
        $manager = User::factory()->create(['role' => 'manager']);
        $department = Department::query()->create([
            'name' => 'Engineering',
            'code' => 'ENG',
            'is_active' => true,
        ]);
        $leaveType = LeaveType::query()->create([
            'name' => 'Annual Leave',
            'code' => 'AL',
            'default_allowance_days' => 18,
            'paid' => true,
            'requires_attachment' => false,
            'deducts_balance' => true,
            'is_active' => true,
        ]);
        $holiday = PublicHoliday::query()->create([
            'name' => 'Old Holiday',
            'holiday_date' => '2026-01-01',
            'is_active' => true,
        ]);

        $this
            ->actingAs($hrAdmin)
            ->patch(route('admin.departments.update', $department), [
                'name' => 'Product Engineering',
                'code' => 'PROD',
                'manager_id' => $manager->id,
            ])
            ->assertSessionHasNoErrors()
            ->assertRedirect();

        $this
            ->actingAs($hrAdmin)
            ->patch(route('admin.leave-types.update', $leaveType), [
                'name' => 'Vacation',
                'code' => 'VAC',
                'default_allowance_days' => 20,
                'paid' => true,
                'requires_attachment' => true,
                'deducts_balance' => true,
            ])
            ->assertSessionHasNoErrors()
            ->assertRedirect();

        $this
            ->actingAs($hrAdmin)
            ->patch(route('admin.holidays.update', $holiday), [
                'name' => 'New Year Holiday',
                'holiday_date' => '2026-01-02',
            ])
            ->assertSessionHasNoErrors()
            ->assertRedirect();

        $this->assertDatabaseHas(Department::class, [
            'id' => $department->id,
            'name' => 'Product Engineering',
            'code' => 'PROD',
            'manager_id' => $manager->id,
        ]);
        $this->assertDatabaseHas(LeaveType::class, [
            'id' => $leaveType->id,
            'name' => 'Vacation',
            'code' => 'VAC',
            'default_allowance_days' => 20,
            'requires_attachment' => true,
        ]);
        $this->assertDatabaseHas(PublicHoliday::class, [
            'id' => $holiday->id,
            'name' => 'New Year Holiday',
            'holiday_date' => '2026-01-02',
        ]);
    }
}
