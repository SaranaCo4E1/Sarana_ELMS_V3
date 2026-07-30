<?php

namespace Tests\Feature;

use App\Models\AttendanceDay;
use App\Models\AttendanceSlot;
use App\Models\Department;
use App\Models\LeaveBalance;
use App\Models\LeaveRequest;
use App\Models\LeaveType;
use App\Models\PublicHoliday;
use App\Models\User;
use App\Services\Ai\AiLiveDataContext;
use App\Services\Ai\AiOrganizationContext;
use App\Services\Ai\AiPromptPlanner;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class AiAppDataContextTest extends TestCase
{
    use RefreshDatabase;

    public function test_organization_context_contains_current_structure_and_user_relationships(): void
    {
        $chief = User::factory()->create([
            'name' => 'Chief Executive',
            'role' => 'admin',
            'is_active' => true,
        ]);
        $manager = User::factory()->create([
            'name' => 'IT Manager',
            'role' => 'manager',
            'manager_id' => $chief->id,
            'is_active' => true,
        ]);
        $it = Department::query()->create([
            'name' => 'Information Technology',
            'code' => 'IT',
            'manager_id' => $manager->id,
            'is_active' => true,
        ]);
        $manager->update(['department_id' => $it->id]);
        Department::query()->create([
            'name' => 'Archived',
            'code' => 'OLD',
            'is_active' => false,
        ]);
        $actor = User::factory()->create([
            'name' => 'Current Employee',
            'email' => 'private-actor@example.test',
            'phone' => '012345678',
            'role' => 'staff',
            'department_id' => $it->id,
            'manager_id' => $manager->id,
            'is_active' => true,
        ]);
        User::factory()->create([
            'name' => 'Active Teammate',
            'role' => 'staff',
            'department_id' => $it->id,
            'manager_id' => $manager->id,
            'is_active' => true,
        ]);
        User::factory()->create([
            'name' => 'Inactive Teammate',
            'role' => 'staff',
            'department_id' => $it->id,
            'manager_id' => $manager->id,
            'is_active' => false,
        ]);

        $context = app(AiOrganizationContext::class)->build($actor);

        $this->assertStringContainsString('Active department count: 1', $context);
        $this->assertStringContainsString(
            'Information Technology (IT): manager IT Manager; 3 active employees, including 2 employees with the staff role',
            $context,
        );
        $this->assertStringContainsString('Current user\'s manager: IT Manager', $context);
        $this->assertStringContainsString('Active Teammate', $context);
        $this->assertStringNotContainsString('Inactive Teammate', $context);
        $this->assertStringContainsString('IT Manager -> Chief Executive', $context);
        $this->assertStringNotContainsString('Archived', $context);
        $this->assertStringNotContainsString('private-actor@example.test', $context);
        $this->assertStringNotContainsString('012345678', $context);
    }

    public function test_manager_leave_roster_is_scoped_to_active_direct_reports_and_omits_sensitive_fields(): void
    {
        $manager = User::factory()->create([
            'name' => 'Team Manager',
            'role' => 'manager',
            'is_active' => true,
        ]);
        $directReport = User::factory()->create([
            'name' => 'Visible Employee',
            'role' => 'staff',
            'manager_id' => $manager->id,
            'is_active' => true,
        ]);
        $inactiveReport = User::factory()->create([
            'name' => 'Inactive Employee',
            'role' => 'staff',
            'manager_id' => $manager->id,
            'is_active' => false,
        ]);
        $outsider = User::factory()->create([
            'name' => 'Hidden Employee',
            'role' => 'staff',
            'is_active' => true,
        ]);
        $leaveType = $this->leaveType('Sensitive Sick Leave');

        $this->leaveRequest($directReport, $leaveType, '2026-07-20', '2026-07-22', 'approved', 'Private medical reason');
        $this->leaveRequest($directReport, $leaveType, '2026-07-21', '2026-07-21', 'pending', 'Pending private reason');
        $this->leaveRequest($inactiveReport, $leaveType, '2026-07-21', '2026-07-21', 'approved', 'Inactive reason');
        $this->leaveRequest($outsider, $leaveType, '2026-07-21', '2026-07-21', 'approved', 'Outsider reason');

        $result = app(AiLiveDataContext::class)->execute($manager, [
            'id' => 'leave-call',
            'name' => 'get_leave_roster',
            'args' => [
                'start_date' => '2026-07-21',
                'end_date' => '2026-07-21',
            ],
        ], 'Asia/Phnom_Penh');

        $this->assertSame(1, $result['metadata']['result_count']);
        $this->assertSame('direct_reports', $result['response']['data']['scope']);
        $this->assertSame('Visible Employee', $result['response']['data']['records'][0]['employee']);
        $encoded = json_encode($result['response'], JSON_THROW_ON_ERROR);
        $this->assertStringNotContainsString('Hidden Employee', $encoded);
        $this->assertStringNotContainsString('Inactive Employee', $encoded);
        $this->assertStringNotContainsString('Sensitive Sick Leave', $encoded);
        $this->assertStringNotContainsString('Private medical reason', $encoded);
    }

    public function test_staff_leave_roster_only_exposes_the_authenticated_employee(): void
    {
        $staff = User::factory()->create([
            'name' => 'Current Staff',
            'role' => 'staff',
            'is_active' => true,
        ]);
        $outsider = User::factory()->create([
            'name' => 'Other Staff',
            'role' => 'staff',
            'is_active' => true,
        ]);
        $leaveType = $this->leaveType('Annual Leave');

        $this->leaveRequest($staff, $leaveType, '2026-07-31', '2026-07-31', 'approved');
        $this->leaveRequest($outsider, $leaveType, '2026-07-31', '2026-07-31', 'approved');

        $result = app(AiLiveDataContext::class)->execute($staff, [
            'id' => null,
            'name' => 'get_leave_roster',
            'args' => [
                'start_date' => '2026-07-31',
                'end_date' => '2026-07-31',
            ],
        ], 'Asia/Phnom_Penh');

        $this->assertSame('self', $result['response']['data']['scope']);
        $this->assertSame(1, $result['metadata']['result_count']);
        $this->assertSame('Current Staff', $result['response']['data']['records'][0]['employee']);
        $this->assertStringNotContainsString(
            'Other Staff',
            json_encode($result['response'], JSON_THROW_ON_ERROR),
        );
    }

    public function test_attendance_summary_counts_affected_days_instead_of_late_slots(): void
    {
        $staff = User::factory()->create([
            'name' => 'Attendance Employee',
            'role' => 'staff',
            'is_active' => true,
        ]);
        $outsider = User::factory()->create(['role' => 'staff', 'is_active' => true]);

        $this->attendanceDay($staff, '2026-07-01', 'issues', ['late', 'on_time', 'late', 'on_time']);
        $this->attendanceDay($staff, '2026-07-02', 'complete', ['on_time', 'on_time', 'on_time', 'on_time']);
        $excused = $this->attendanceDay($staff, '2026-07-03', 'issues', ['late', 'on_time', 'on_time', 'on_time']);
        $excused->update(['excuse_type' => 'approved_leave']);
        $this->attendanceDay($staff, '2026-07-04', 'pending', ['late', 'pending', 'pending', 'pending']);
        $this->attendanceDay($staff, '2026-06-30', 'issues', ['late', 'on_time', 'on_time', 'on_time']);
        $this->attendanceDay($outsider, '2026-07-02', 'issues', ['late', 'on_time', 'on_time', 'on_time']);

        $result = app(AiLiveDataContext::class)->execute($staff, [
            'id' => 'attendance-call',
            'name' => 'get_attendance_summary',
            'args' => [
                'start_date' => '2026-07-01',
                'end_date' => '2026-07-31',
            ],
        ], 'Asia/Phnom_Penh');

        $this->assertSame('self', $result['response']['data']['scope']);
        $this->assertSame(2, $result['metadata']['result_count']);
        $this->assertSame(1, $result['response']['data']['late_days']);
        $this->assertSame(2, $result['response']['data']['finalized_days']);
        $this->assertSame(50.0, $result['response']['data']['compliance_percent']);
        $this->assertSame(['2026-07-01'], $result['response']['data']['late_dates']);

        $invalid = app(AiLiveDataContext::class)->execute($staff, [
            'id' => 'invalid-range',
            'name' => 'get_attendance_summary',
            'args' => [
                'start_date' => '2026-07-31',
                'end_date' => '2026-07-01',
                'employee_id' => $outsider->id,
            ],
        ], 'Asia/Phnom_Penh');

        $this->assertFalse($invalid['response']['ok']);
        $this->assertArrayNotHasKey('data', $invalid['response']);
    }

    public function test_personal_balance_request_holiday_and_draft_tools_return_bounded_safe_data(): void
    {
        $this->travelTo(Carbon::parse('2026-07-31 10:00:00', 'Asia/Phnom_Penh'));
        $staff = User::factory()->create([
            'name' => 'Tool Employee',
            'role' => 'staff',
            'is_active' => true,
        ]);
        $leaveType = $this->leaveType('Annual Leave');
        LeaveBalance::query()->create([
            'user_id' => $staff->id,
            'leave_type_id' => $leaveType->id,
            'year' => 2026,
            'allowance_days' => 18,
            'used_days' => 3,
            'pending_days' => 2,
        ]);
        $this->leaveRequest(
            $staff,
            $leaveType,
            '2026-07-20',
            '2026-07-21',
            'approved',
            'Secret family details',
        );
        PublicHoliday::query()->create([
            'name' => 'Constitution Day',
            'holiday_date' => '2026-09-24',
            'is_active' => true,
        ]);
        $tools = app(AiLiveDataContext::class);

        $balances = $tools->execute($staff, [
            'id' => 'balance-1',
            'name' => 'get_my_leave_balances',
            'args' => ['year' => 2026],
        ], 'Asia/Phnom_Penh');
        $requests = $tools->execute($staff, [
            'id' => 'requests-1',
            'name' => 'get_my_leave_requests',
            'args' => [
                'start_date' => '2026-07-01',
                'end_date' => '2026-07-31',
                'status' => 'all',
            ],
        ], 'Asia/Phnom_Penh');
        $holidays = $tools->execute($staff, [
            'id' => 'holiday-1',
            'name' => 'get_holidays',
            'args' => [
                'start_date' => '2026-09-01',
                'end_date' => '2026-09-30',
            ],
        ], 'Asia/Phnom_Penh');
        $draft = $tools->execute($staff, [
            'id' => 'draft-1',
            'name' => 'get_leave_draft_context',
            'args' => [],
        ], 'Asia/Phnom_Penh');

        $this->assertSame(13.0, $balances['response']['data']['balances'][0]['available_days']);
        $this->assertSame('approved', $requests['response']['data']['requests'][0]['status']);
        $this->assertStringNotContainsString(
            'Secret family details',
            json_encode($requests['response'], JSON_THROW_ON_ERROR),
        );
        $this->assertSame('Constitution Day', $holidays['response']['data']['holidays'][0]['name']);
        $this->assertSame('Annual Leave', $draft['response']['data']['leave_types'][0]['name']);
        $this->assertStringNotContainsString(
            'Secret family details',
            json_encode($draft['response'], JSON_THROW_ON_ERROR),
        );
    }

    public function test_prompt_planner_has_safe_deterministic_fallback_ranges(): void
    {
        config(['services.google_generative_ai.key' => null]);
        $this->travelTo(Carbon::parse('2026-07-31 10:00:00', 'UTC'));
        $staff = User::factory()->create(['role' => 'staff', 'is_active' => true]);
        $planner = app(AiPromptPlanner::class);

        $lastWeek = $planner->plan($staff, 'Who was on leave last week?');
        $latePolicy = $planner->plan($staff, 'What is the late attendance policy?');

        $this->assertSame('get_leave_roster', $lastWeek['calls'][0]['name']);
        $this->assertSame('2026-07-20', $lastWeek['calls'][0]['args']['start_date']);
        $this->assertSame('2026-07-26', $lastWeek['calls'][0]['args']['end_date']);
        $this->assertSame([], $latePolicy['calls']);
    }

    public function test_prompt_planner_accepts_only_structured_allowlisted_model_output(): void
    {
        config([
            'services.google_generative_ai.key' => 'test-key',
            'services.google_generative_ai.proxy' => null,
            'services.google_generative_ai.model' => 'gemini-test',
        ]);
        Http::preventStrayRequests();
        Http::fake([
            'generativelanguage.googleapis.com/*' => Http::response([
                'candidates' => [[
                    'content' => [
                        'parts' => [[
                            'text' => 'I will check current records.',
                        ], [
                            'functionCall' => [
                                'id' => 'attendance-1',
                                'name' => 'get_attendance_summary',
                                'args' => [
                                    'start_date' => '2026-07-01',
                                    'end_date' => '2026-07-31',
                                ],
                            ],
                        ]],
                    ],
                ]],
            ]),
        ]);
        $staff = User::factory()->create(['role' => 'staff', 'is_active' => true]);
        $planner = app(AiPromptPlanner::class);

        $plan = $planner->plan($staff, 'How many days was I late this month?');

        $this->assertSame('get_attendance_summary', $plan['calls'][0]['name']);
        $this->assertSame('attendance-1', $plan['calls'][0]['id']);
        $this->assertSame('2026-07-01', $plan['calls'][0]['args']['start_date']);
        $this->assertSame(
            'I will check current records.',
            $plan['model_content']['parts'][0]['text'],
        );
        Http::assertSent(fn (Request $request): bool => $request->hasHeader('x-goog-api-key', 'test-key')
            && $request['toolConfig']['functionCallingConfig']['mode'] === 'AUTO'
            && collect($request['tools'][0]['functionDeclarations'])->pluck('name')->all() === [
                'get_leave_roster',
                'get_attendance_summary',
                'get_my_leave_balances',
                'get_my_leave_requests',
                'get_holidays',
                'get_leave_draft_context',
            ]
            && ! str_contains(
                json_encode($request['tools'], JSON_THROW_ON_ERROR),
                'employee_id',
            ));

        $conversation = $planner->conversation($plan, [[
            'response' => [
                'ok' => true,
                'tool' => 'get_attendance_summary',
                'data' => ['late_days' => 2],
            ],
        ]]);

        $this->assertSame(
            'attendance-1',
            $conversation[1]['parts'][0]['functionResponse']['id'],
        );
        $this->assertSame(
            2,
            $conversation[1]['parts'][0]['functionResponse']['response']['data']['late_days'],
        );
    }

    private function leaveType(string $name): LeaveType
    {
        return LeaveType::query()->create([
            'name' => $name,
            'code' => str($name)->slug()->limit(20, '')->toString(),
            'default_allowance_days' => 10,
            'paid' => true,
            'requires_attachment' => false,
            'deducts_balance' => true,
            'is_active' => true,
        ]);
    }

    private function leaveRequest(
        User $user,
        LeaveType $leaveType,
        string $startsAt,
        string $endsAt,
        string $status,
        string $reason = 'Private reason',
    ): LeaveRequest {
        return LeaveRequest::query()->create([
            'user_id' => $user->id,
            'leave_type_id' => $leaveType->id,
            'department_id' => $user->department_id,
            'starts_at' => $startsAt,
            'ends_at' => $endsAt,
            'requested_days' => 1,
            'status' => $status,
            'reason' => $reason,
        ]);
    }

    /**
     * @param  array<int, string>  $slotStatuses
     */
    private function attendanceDay(
        User $user,
        string $date,
        string $status,
        array $slotStatuses,
    ): AttendanceDay {
        $day = AttendanceDay::query()->create([
            'user_id' => $user->id,
            'work_date' => $date,
            'timezone' => 'Asia/Phnom_Penh',
            'schedule_snapshot' => [],
            'status' => $status,
            'finalized_at' => now(),
        ]);

        foreach (array_combine(
            ['morning_in', 'lunch_out', 'lunch_in', 'final_out'],
            $slotStatuses,
        ) as $type => $slotStatus) {
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
