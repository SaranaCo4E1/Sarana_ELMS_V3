<?php

namespace Tests\Feature;

use App\Models\AttendanceDay;
use App\Models\AttendanceSlot;
use App\Models\AuditLog;
use App\Models\Department;
use App\Models\LeaveBalance;
use App\Models\LeaveRequest;
use App\Models\LeaveType;
use App\Models\Permission;
use App\Models\PublicHoliday;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ReportModuleTest extends TestCase
{
    use RefreshDatabase;

    public function test_reports_default_to_the_last_thirty_days(): void
    {
        $this->travelTo(Carbon::parse('2026-07-31 10:00:00', 'Asia/Phnom_Penh'));
        $staff = User::factory()->create(['role' => 'staff', 'is_active' => true]);

        $this->actingAs($staff)
            ->get(route('reports.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Reports')
                ->where('filters.start_date', '2026-07-02')
                ->where('filters.end_date', '2026-07-31'));
    }

    public function test_staff_can_only_view_their_own_individual_report(): void
    {
        $staff = User::factory()->create(['role' => 'staff', 'is_active' => true]);
        User::factory()->create(['role' => 'staff', 'is_active' => true]);

        $this->actingAs($staff)
            ->get(route('reports.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Reports')
                ->where('scope', 'individual')
                ->where('summary.employees', 1)
                ->has('filterOptions.employees', 1)
                ->where('filterOptions.employees.0.id', $staff->id)
                ->where('capabilities.team', false)
                ->where('capabilities.organization', false));

        $this->actingAs($staff)
            ->get(route('reports.index', ['view' => 'multi']))
            ->assertForbidden();
    }

    public function test_manager_multi_view_is_limited_to_direct_reports_and_rejects_forged_filters(): void
    {
        $manager = User::factory()->create(['role' => 'manager', 'is_active' => true]);
        $direct = User::factory()->create(['role' => 'staff', 'manager_id' => $manager->id, 'is_active' => true]);
        $inactiveDirect = User::factory()->create(['role' => 'staff', 'manager_id' => $manager->id, 'is_active' => false]);
        $outsider = User::factory()->create(['role' => 'staff', 'is_active' => true]);

        $this->actingAs($manager)
            ->get(route('reports.index', ['view' => 'multi']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('scope', 'team')
                ->where('summary.employees', 1)
                ->has('filterOptions.employees', 2)
                ->where('filterOptions.employees', fn ($employees) => $employees
                    ->pluck('id')
                    ->sort()
                    ->values()
                    ->all() === collect([$direct->id, $inactiveDirect->id])->sort()->values()->all()));

        $this->actingAs($manager)
            ->get(route('reports.index', [
                'view' => 'multi',
                'employee_ids' => [$outsider->id],
            ]))
            ->assertForbidden();
    }

    public function test_organization_filters_cascade_and_only_selected_department_is_aggregated(): void
    {
        $hr = User::factory()->create(['role' => 'hr admin', 'is_active' => true]);
        $manager = User::factory()->create(['role' => 'manager', 'is_active' => true]);
        $engineering = Department::query()->create(['name' => 'Engineering', 'code' => 'ENG', 'is_active' => true]);
        $sales = Department::query()->create(['name' => 'Sales', 'code' => 'SALES', 'is_active' => true]);
        $engineer = User::factory()->create([
            'role' => 'staff',
            'department_id' => $engineering->id,
            'manager_id' => $manager->id,
            'is_active' => true,
        ]);
        User::factory()->create([
            'role' => 'staff',
            'department_id' => $sales->id,
            'manager_id' => $manager->id,
            'is_active' => true,
        ]);

        $this->actingAs($hr)
            ->get(route('reports.index', [
                'view' => 'multi',
                'department_ids' => [$engineering->id],
            ]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('scope', 'organization')
                ->where('summary.employees', 1)
                ->where('details.data.0.id', $engineer->id)
                ->where('filterOptions.departments', fn ($departments) => $departments->pluck('id')->contains($sales->id)));
    }

    public function test_report_calculates_in_range_working_days_balance_year_and_attendance_compliance(): void
    {
        $staff = User::factory()->create(['role' => 'staff', 'is_active' => true]);
        $type = LeaveType::query()->create([
            'name' => 'Annual Leave',
            'code' => 'AL',
            'default_allowance_days' => 18,
            'paid' => true,
            'requires_attachment' => false,
            'deducts_balance' => true,
            'is_active' => true,
        ]);
        $unpaidType = LeaveType::query()->create([
            'name' => 'Unpaid Leave',
            'code' => 'UL',
            'default_allowance_days' => 30,
            'paid' => false,
            'requires_attachment' => false,
            'deducts_balance' => true,
            'is_active' => true,
        ]);
        LeaveRequest::query()->create([
            'user_id' => $staff->id,
            'leave_type_id' => $type->id,
            'starts_at' => '2026-07-03',
            'ends_at' => '2026-07-06',
            'requested_days' => 2,
            'status' => 'approved',
        ]);
        PublicHoliday::query()->create([
            'holiday_date' => '2026-07-06',
            'name' => 'Test Holiday',
            'is_active' => true,
        ]);
        LeaveBalance::query()->create([
            'user_id' => $staff->id,
            'leave_type_id' => $type->id,
            'year' => 2026,
            'allowance_days' => 18,
            'used_days' => 2,
            'pending_days' => 1,
        ]);
        LeaveBalance::query()->create([
            'user_id' => $staff->id,
            'leave_type_id' => $unpaidType->id,
            'year' => 2026,
            'allowance_days' => 30,
            'used_days' => 0,
            'pending_days' => 0,
        ]);

        $this->attendanceDay($staff, '2026-07-03', 'complete', ['on_time', 'on_time', 'on_time', 'on_time']);
        $this->attendanceDay($staff, '2026-07-06', 'issues', ['late', 'early', 'on_time', 'missing']);

        $this->actingAs($staff)
            ->get(route('reports.index', [
                'start_date' => '2026-07-01',
                'end_date' => '2026-07-07',
            ]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('summary.approved_leave_days', 1)
                ->where('summary.available_balance', 15)
                ->where('summary.attendance_compliance', 50)
                ->where('summary.late', 1)
                ->where('summary.early', 1)
                ->where('summary.missing', 1)
                ->where('attendance.issue_mix.0.name', 'Late-in days')
                ->where('attendance.issue_mix.1.name', 'Early-out days')
                ->where('leave.balance_year', 2026));

        $export = $this->actingAs($staff)->get(route('reports.export.attendance', [
            'start_date' => '2026-07-01',
            'end_date' => '2026-07-07',
        ]));

        $export->assertOk();
        $exportContent = $export->streamedContent();
        $this->assertStringContainsString('Late in', $exportContent);
        $this->assertStringContainsString('Early out', $exportContent);
    }

    public function test_attendance_reports_only_include_finalized_working_days(): void
    {
        $staff = User::factory()->create(['role' => 'staff', 'is_active' => true]);
        $this->attendanceDay($staff, '2026-07-01', 'complete', ['on_time', 'on_time', 'on_time', 'on_time']);
        $nonWorkingDay = $this->attendanceDay(
            $staff,
            '2026-07-02',
            'on_leave',
            ['not_applicable', 'not_applicable', 'not_applicable', 'not_applicable'],
        );
        $nonWorkingDay->update(['excuse_type' => 'approved_leave']);
        $this->attendanceDay(
            $staff,
            '2026-07-03',
            'pending',
            ['pending', 'pending', 'pending', 'pending'],
        );

        $this->actingAs($staff)
            ->get(route('reports.index', [
                'section' => 'attendance',
                'start_date' => '2026-07-01',
                'end_date' => '2026-07-03',
            ]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('attendance.heatmap', 1)
                ->where('attendance.heatmap.0.date', '2026-07-01')
                ->where('attendance.trend.0.values.complete', 1)
                ->missing('attendance.trend.0.values.on_leave'));

        $export = $this->actingAs($staff)->get(route('reports.export.attendance', [
            'start_date' => '2026-07-01',
            'end_date' => '2026-07-03',
        ]));
        $export->assertOk();
        $this->assertStringContainsString('2026-07-01', $export->streamedContent());
        $this->assertStringNotContainsString('2026-07-02', $export->streamedContent());
        $this->assertStringNotContainsString('2026-07-03', $export->streamedContent());

        $this->actingAs($staff)
            ->get(route('reports.index', [
                'section' => 'attendance',
                'start_date' => '2026-07-01',
                'end_date' => '2026-07-03',
                'attendance_statuses' => ['on_leave'],
            ]))
            ->assertSessionHasErrors('attendance_statuses.0');

        $this->actingAs($staff)
            ->get(route('reports.index', [
                'section' => 'attendance',
                'start_date' => '2026-07-01',
                'end_date' => '2026-07-03',
                'attendance_statuses' => ['pending'],
            ]))
            ->assertSessionHasErrors('attendance_statuses.0');
    }

    public function test_attendance_issue_totals_count_affected_employee_days_instead_of_slots(): void
    {
        $staff = User::factory()->create(['role' => 'staff', 'is_active' => true]);
        $this->attendanceDay($staff, '2026-07-01', 'issues', ['late', 'late', 'missing', 'missing']);
        $this->attendanceDay($staff, '2026-07-02', 'issues', ['early', 'early', 'missing', 'missing']);

        $this->actingAs($staff)
            ->get(route('reports.index', [
                'section' => 'attendance',
                'start_date' => '2026-07-01',
                'end_date' => '2026-07-02',
            ]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('summary.late', 1)
                ->where('summary.early', 1)
                ->where('summary.missing', 2)
                ->where('attendance.issue_mix.0.value', 1)
                ->where('attendance.issue_mix.1.value', 1)
                ->where('attendance.issue_mix.2.value', 2)
                ->where('attendance.employees.0.late', 1)
                ->where('attendance.employees.0.early', 1)
                ->where('attendance.employees.0.missing', 2)
                ->where('details.data.0.late', 1)
                ->where('details.data.0.early', 1)
                ->where('details.data.0.missing', 2));

        $this->actingAs($staff)
            ->get(route('reports.index', [
                'section' => 'attendance',
                'start_date' => '2026-07-01',
                'end_date' => '2026-07-02',
                'attendance_issues' => ['late'],
            ]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('filters.attendance_issues', ['late'])
                ->where('attendance.issue_days.total', 1)
                ->where('attendance.issue_days.data.0.date', '2026-07-01')
                ->where('summary.late', 1));

        $this->actingAs($staff)
            ->get(route('reports.index', [
                'section' => 'attendance',
                'attendance_issues' => ['not-an-issue'],
            ]))
            ->assertSessionHasErrors('attendance_issues.0');
    }

    public function test_absence_concurrency_distribution_groups_working_days_and_counts_distinct_employees(): void
    {
        $manager = User::factory()->create(['role' => 'manager', 'is_active' => true]);
        $firstReport = User::factory()->create(['role' => 'staff', 'manager_id' => $manager->id, 'is_active' => true]);
        $secondReport = User::factory()->create(['role' => 'staff', 'manager_id' => $manager->id, 'is_active' => true]);
        $thirdReport = User::factory()->create(['role' => 'staff', 'manager_id' => $manager->id, 'is_active' => true]);
        $leaveType = LeaveType::query()->create([
            'name' => 'Annual Leave',
            'code' => 'AL',
            'default_allowance_days' => 18,
            'paid' => true,
            'requires_attachment' => false,
            'deducts_balance' => true,
            'is_active' => true,
        ]);

        foreach ([$firstReport, $firstReport, $secondReport] as $employee) {
            LeaveRequest::query()->create([
                'user_id' => $employee->id,
                'leave_type_id' => $leaveType->id,
                'starts_at' => '2026-07-02',
                'ends_at' => '2026-07-02',
                'requested_days' => 1,
                'status' => 'approved',
            ]);
        }

        foreach ([$firstReport, $secondReport, $thirdReport] as $employee) {
            LeaveRequest::query()->create([
                'user_id' => $employee->id,
                'leave_type_id' => $leaveType->id,
                'starts_at' => '2026-07-03',
                'ends_at' => '2026-07-03',
                'requested_days' => 1,
                'status' => 'approved',
            ]);
        }

        $this->actingAs($manager)
            ->get(route('reports.index', [
                'view' => 'multi',
                'start_date' => '2026-07-01',
                'end_date' => '2026-07-03',
            ]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('leave.concurrency_distribution', [
                    ['name' => '0 absent', 'days' => 1],
                    ['name' => '1 absent', 'days' => 0],
                    ['name' => '2 absent', 'days' => 1],
                    ['name' => '3+ absent', 'days' => 1],
                ]));
    }

    public function test_report_exposes_question_oriented_findings_and_scoped_drill_down_records(): void
    {
        $manager = User::factory()->create(['role' => 'manager', 'name' => 'Team Manager', 'is_active' => true]);
        $topEmployee = User::factory()->create(['role' => 'staff', 'name' => 'Top Employee', 'manager_id' => $manager->id, 'is_active' => true]);
        $otherEmployee = User::factory()->create(['role' => 'staff', 'name' => 'Other Employee', 'manager_id' => $manager->id, 'is_active' => true]);
        $type = LeaveType::query()->create([
            'name' => 'Annual Leave',
            'code' => 'AL',
            'default_allowance_days' => 18,
            'paid' => true,
            'requires_attachment' => false,
            'deducts_balance' => true,
            'is_active' => true,
        ]);

        LeaveRequest::query()->create([
            'user_id' => $topEmployee->id,
            'leave_type_id' => $type->id,
            'approver_id' => $manager->id,
            'starts_at' => '2026-07-01',
            'ends_at' => '2026-07-03',
            'requested_days' => 3,
            'status' => 'approved',
            'reason' => 'Family commitment',
            'manager_comment' => 'Approved with coverage arranged',
        ]);
        LeaveRequest::query()->create([
            'user_id' => $otherEmployee->id,
            'leave_type_id' => $type->id,
            'approver_id' => $manager->id,
            'starts_at' => '2026-07-02',
            'ends_at' => '2026-07-02',
            'requested_days' => 1,
            'status' => 'approved',
            'reason' => 'Personal appointment',
        ]);
        $this->attendanceDay($topEmployee, '2026-07-06', 'issues', ['late', 'on_time', 'on_time', 'missing']);
        $this->attendanceDay($otherEmployee, '2026-07-07', 'issues', ['on_time', 'early', 'on_time', 'on_time']);

        $this->actingAs($manager)
            ->get(route('reports.index', [
                'view' => 'multi',
                'section' => 'leave',
                'start_date' => '2026-07-01',
                'end_date' => '2026-07-31',
                'leave_sort' => 'name',
                'leave_direction' => 'desc',
            ]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('leave.insights.top_employee.user_id', $topEmployee->id)
                ->where('leave.insights.top_employee.days', 3)
                ->where('leave.insights.top_employee.requests', 1)
                ->where('leave.insights.top_employee.primary_type', 'Annual Leave')
                ->where('leave.insights.peak_absence.date', '2026-07-02')
                ->where('leave.insights.peak_absence.employees', 2)
                ->where('filters.leave_sort', 'name')
                ->where('filters.leave_direction', 'desc')
                ->where('leave.requests.total', 2)
                ->where('leave.requests.data.0.name', 'Top Employee')
                ->where('leave.requests.data.0.reason', 'Family commitment')
                ->where('leave.requests.data.0.approver', 'Team Manager')
                ->where('leave.requests.data.0.manager_comment', 'Approved with coverage arranged'));

        $this->actingAs($manager)
            ->get(route('reports.index', [
                'view' => 'multi',
                'section' => 'attendance',
                'start_date' => '2026-07-01',
                'end_date' => '2026-07-31',
                'attendance_sort' => 'issue_count',
                'attendance_direction' => 'desc',
            ]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('filters.attendance_sort', 'issue_count')
                ->where('filters.attendance_direction', 'desc')
                ->where('attendance.insights.top_issue_employee.user_id', $topEmployee->id)
                ->where('attendance.issue_days.total', 2)
                ->where('attendance.issue_days.data.0.name', 'Top Employee')
                ->where('attendance.issue_days.data.0.issue_count', 2)
                ->where('attendance.issue_days.data.0.issues', ['late', 'missing'])
                ->where('attendance.issue_days.data.0.slots', fn ($slots) => $slots->pluck('status')->contains('late')
                    && $slots->pluck('status')->contains('missing'))
                ->missing('attendance.issue_days.data.0.site')
                ->missing('filterOptions.sites')
                ->missing('filters.site_ids'));
    }

    public function test_scoped_csv_exports_exclude_other_employees_and_are_audited(): void
    {
        $staff = User::factory()->create([
            'role' => 'staff',
            'name' => 'Scoped Employee',
            'is_active' => true,
        ]);
        $outsider = User::factory()->create([
            'role' => 'staff',
            'name' => 'Hidden Employee',
            'is_active' => true,
        ]);
        $type = LeaveType::query()->create([
            'name' => 'Annual Leave',
            'code' => 'AL',
            'default_allowance_days' => 18,
            'paid' => true,
            'requires_attachment' => false,
            'deducts_balance' => true,
            'is_active' => true,
        ]);
        foreach ([$staff, $outsider] as $employee) {
            LeaveRequest::query()->create([
                'user_id' => $employee->id,
                'leave_type_id' => $type->id,
                'starts_at' => '2026-07-01',
                'ends_at' => '2026-07-01',
                'requested_days' => 1,
                'status' => 'approved',
            ]);
            $this->attendanceDay($employee, '2026-07-01', 'complete', ['on_time', 'on_time', 'on_time', 'on_time']);
        }

        $leave = $this->actingAs($staff)->get(route('reports.export.leave', [
            'start_date' => '2026-07-01',
            'end_date' => '2026-07-31',
        ]));
        $leave->assertOk();
        $this->assertStringContainsString('Scoped Employee', $leave->streamedContent());
        $this->assertStringNotContainsString('Hidden Employee', $leave->streamedContent());

        $attendance = $this->actingAs($staff)->get(route('reports.export.attendance', [
            'start_date' => '2026-07-01',
            'end_date' => '2026-07-31',
        ]));
        $attendance->assertOk();
        $attendanceContent = $attendance->streamedContent();
        $this->assertStringContainsString('Scoped Employee', $attendanceContent);
        $this->assertStringNotContainsString('Hidden Employee', $attendanceContent);
        $this->assertStringNotContainsString('Branch', $attendanceContent);
        $this->assertStringContainsString('Morning In', $attendanceContent);
        $this->assertStringContainsString('Lunch Out', $attendanceContent);
        $this->assertStringContainsString('Lunch In', $attendanceContent);
        $this->assertStringContainsString('Final Out', $attendanceContent);

        $this->assertDatabaseHas(AuditLog::class, ['actor_id' => $staff->id, 'action' => 'report.leave.exported']);
        $this->assertDatabaseHas(AuditLog::class, ['actor_id' => $staff->id, 'action' => 'report.attendance.exported']);
    }

    public function test_custom_role_with_only_self_permission_cannot_open_multi_view(): void
    {
        $role = Role::query()->create([
            'name' => 'Report Reader',
            'slug' => 'report-reader',
            'description' => 'Personal report access only.',
            'is_system' => false,
        ]);
        $role->permissions()->attach(Permission::query()->where('key', 'reports.self.view')->firstOrFail());
        $reader = User::factory()->create(['role' => $role->slug, 'is_active' => true]);
        User::factory()->create(['role' => 'staff', 'is_active' => true]);

        $this->actingAs($reader)
            ->get(route('reports.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('scope', 'individual')
                ->where('summary.employees', 1));

        $this->actingAs($reader)
            ->get(route('reports.index', ['view' => 'multi']))
            ->assertForbidden();
    }

    public function test_legacy_monthly_export_delegates_to_scoped_leave_export(): void
    {
        $hr = User::factory()->create(['role' => 'hr admin', 'is_active' => true]);

        $this->actingAs($hr)
            ->get(route('reports.monthly', ['month' => '2026-07']))
            ->assertOk()
            ->assertDownload('leave-report-2026-07-01-to-2026-07-31.csv');
    }

    private function attendanceDay(User $user, string $date, string $status, array $slotStatuses): AttendanceDay
    {
        $day = AttendanceDay::query()->create([
            'user_id' => $user->id,
            'work_date' => $date,
            'timezone' => 'Asia/Phnom_Penh',
            'schedule_snapshot' => [],
            'status' => $status,
            'finalized_at' => now(),
        ]);

        foreach (array_combine(['morning_in', 'lunch_out', 'lunch_in', 'final_out'], $slotStatuses) as $type => $slotStatus) {
            AttendanceSlot::query()->create([
                'attendance_day_id' => $day->id,
                'type' => $type,
                'expected_at' => $date.' 08:00:00',
                'status' => $slotStatus,
            ]);
        }

        return $day;
    }
}
