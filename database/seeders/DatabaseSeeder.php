<?php

namespace Database\Seeders;

use App\Models\AiFaq;
use App\Models\AttendanceDay;
use App\Models\AttendanceEvent;
use App\Models\AttendanceSchedule;
use App\Models\AttendanceSite;
use App\Models\Department;
use App\Models\LeaveBalance;
use App\Models\LeaveRequest;
use App\Models\LeaveType;
use App\Models\SystemNotification;
use App\Models\User;
use App\Services\AttendanceService;
use App\Services\LeaveBalanceService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use InvalidArgumentException;

class DatabaseSeeder extends Seeder
{
    private const WORKDAY_MINUTES = 9 * 60;

    public function run(AttendanceService $attendance): void
    {
        $this->call(RolePermissionSeeder::class);

        $today = now()->startOfDay();
        $year = (int) $today->year;
        $password = Hash::make('testing123');

        // Keep the demo organization small and aligned with the active departments.
        $departments = collect([
            'IT' => Department::query()->updateOrCreate(['code' => 'IT'], ['name' => 'IT', 'is_active' => true]),
            'SALES' => Department::query()->updateOrCreate(['code' => 'SALES'], ['name' => 'Sales', 'is_active' => true]),
            'HR' => Department::query()->updateOrCreate(['code' => 'HR'], ['name' => 'HR', 'is_active' => true]),
        ]);
        Department::query()->whereIn('code', ['ENG', 'OPS'])->update(['is_active' => false]);

        User::query()->whereIn('email', [
            'ceo@niy.ai',
            'admin@niy.ai',
            'admin@elms.test',
            'hr@niy.ai',
            'hr@elms.test',
            'it@niy.ai',
            'manager@elms.test',
            'sales@niy.ai',
            'hr.staff@niy.ai',
            'it.engineer@niy.ai',
            'staff@elms.test',
            'it.support@niy.ai',
            'sreynimsamuser@gmail.com',
            'samuelsinat11@gmail.com',
            'hakkimhengg@gmail.com',
            'sean.sophearom77@gmail.com',
            'sales.rep@niy.ai',
            'sales.ops@niy.ai',
        ])->update(['employee_code' => null]);

        // Seed the reporting root first so department managers can reference the CEO.
        $ceo = $this->seedUser('ceo@niy.ai', [
            'name' => 'Sophea Sok',
            'password' => $password,
            'role' => 'admin',
            'department_id' => $departments['HR']->id,
            'manager_id' => null,
            'job_title' => 'Chief Executive Officer',
            'phone' => '012 234 501',
            'work_location' => 'Phnom Penh',
            'employment_type' => 'Full-time',
            'emergency_contact_name' => 'Davy Sok',
            'emergency_contact_phone' => '092 234 901',
            'bio' => 'Company-wide executive sponsor for people operations and growth.',
            'hire_date' => $today->copy()->subYears(5)->toDateString(),
            'is_active' => true,
        ]);

        $admin = $this->seedUser('admin@niy.ai', [
            'name' => 'Davy Keo',
            'password' => $password,
            'role' => 'admin',
            'department_id' => $departments['HR']->id,
            'manager_id' => $ceo->id,
            'job_title' => 'System Administrator',
            'phone' => '096 234 5502',
            'work_location' => 'Phnom Penh',
            'employment_type' => 'Full-time',
            'emergency_contact_name' => 'Sophal Keo',
            'emergency_contact_phone' => '093 234 902',
            'bio' => 'System administration account for demo and QA workflows.',
            'hire_date' => $today->copy()->subYears(3)->toDateString(),
            'is_active' => true,
        ], ['admin@elms.test']);

        // Managers and staff are keyed by role so later leave fixtures can reference them clearly.
        $users = collect([
            'hr_manager' => [
                'name' => 'Sreymom Chan',
                'email' => 'hr@niy.ai',
                'role' => 'hr admin',
                'department' => 'HR',
                'manager' => $ceo,
                'job_title' => 'HR Manager',
                'phone' => '011 234 503',
                'emergency_contact_phone' => '097 234 5903',
                'hire_date' => $today->copy()->subYears(3)->subMonths(2),
                'legacy_emails' => ['hr@elms.test'],
            ],
            'it_manager' => [
                'name' => 'Dara Vann',
                'email' => 'it@niy.ai',
                'role' => 'manager',
                'department' => 'IT',
                'manager' => $ceo,
                'job_title' => 'IT Manager',
                'phone' => '017 234 504',
                'emergency_contact_phone' => '010 234 904',
                'hire_date' => $today->copy()->subYears(2)->subMonths(8),
                'legacy_emails' => ['manager@elms.test'],
            ],
            'sales_manager' => [
                'name' => 'Sokha Lim',
                'email' => 'sales@niy.ai',
                'role' => 'manager',
                'department' => 'SALES',
                'manager' => $ceo,
                'job_title' => 'Sales Manager',
                'phone' => '098 234 505',
                'emergency_contact_phone' => '015 234 905',
                'hire_date' => $today->copy()->subYears(2)->subMonths(4),
                'legacy_emails' => [],
            ],
            'hr_specialist' => [
                'name' => 'Sreyneang Kim',
                'email' => 'hr.staff@niy.ai',
                'role' => 'staff',
                'department' => 'HR',
                'manager' => null,
                'job_title' => 'People Operations Specialist',
                'phone' => '016 234 506',
                'emergency_contact_phone' => '099 234 906',
                'hire_date' => $today->copy()->subYear()->subMonths(5),
                'legacy_emails' => [],
            ],
            'it_engineer' => [
                'name' => 'Rithy Heng',
                'email' => 'it.engineer@niy.ai',
                'role' => 'staff',
                'department' => 'IT',
                'manager' => null,
                'job_title' => 'Backend Engineer',
                'phone' => '069 234 507',
                'emergency_contact_phone' => '078 234 907',
                'hire_date' => $today->copy()->subYear()->subMonths(2),
                'legacy_emails' => ['staff@elms.test'],
            ],
            'it_support' => [
                'name' => 'Sothea Chea',
                'email' => 'it.support@niy.ai',
                'role' => 'staff',
                'department' => 'IT',
                'manager' => null,
                'job_title' => 'IT Support Specialist',
                'phone' => '070 234 508',
                'emergency_contact_phone' => '085 234 908',
                'hire_date' => $today->copy()->subMonths(10),
                'legacy_emails' => [],
            ],
            'it_sreynim' => [
                'name' => 'Sam Sreynim',
                'email' => 'sreynimsamuser@gmail.com',
                'role' => 'staff',
                'department' => 'IT',
                'manager' => null,
                'job_title' => 'IT Staff',
                'phone' => '086 234 511',
                'emergency_contact_phone' => '090 234 911',
                'hire_date' => $today,
                'legacy_emails' => [],
            ],
            'it_sinat' => [
                'name' => 'Sinat Samuel',
                'email' => 'samuelsinat11@gmail.com',
                'role' => 'staff',
                'department' => 'IT',
                'manager' => null,
                'job_title' => 'IT Staff',
                'phone' => '089 234 512',
                'emergency_contact_phone' => '060 234 912',
                'hire_date' => $today,
                'legacy_emails' => [],
            ],
            'it_kimheng' => [
                'name' => 'Hak Kimheng',
                'email' => 'hakkimhengg@gmail.com',
                'role' => 'staff',
                'department' => 'IT',
                'manager' => null,
                'job_title' => 'IT Staff',
                'phone' => '066 234 513',
                'emergency_contact_phone' => '067 234 913',
                'hire_date' => $today,
                'legacy_emails' => [],
            ],
            'it_sophearom' => [
                'name' => 'Sean Sophearom',
                'email' => 'sean.sophearom77@gmail.com',
                'role' => 'staff',
                'department' => 'IT',
                'manager' => null,
                'job_title' => 'IT Staff',
                'phone' => '068 234 514',
                'emergency_contact_phone' => '077 234 914',
                'hire_date' => $today,
                'legacy_emails' => [],
            ],
            'sales_rep' => [
                'name' => 'Vicheka Nhim',
                'email' => 'sales.rep@niy.ai',
                'role' => 'staff',
                'department' => 'SALES',
                'manager' => null,
                'job_title' => 'Account Executive',
                'phone' => '081 234 509',
                'emergency_contact_phone' => '088 234 5909',
                'hire_date' => $today->copy()->subYear()->subMonths(8),
                'legacy_emails' => [],
            ],
            'sales_ops' => [
                'name' => 'Bopha Mao',
                'email' => 'sales.ops@niy.ai',
                'role' => 'staff',
                'department' => 'SALES',
                'manager' => null,
                'job_title' => 'Sales Operations Analyst',
                'phone' => '087 234 510',
                'emergency_contact_phone' => '095 234 910',
                'hire_date' => $today->copy()->subMonths(9),
                'legacy_emails' => [],
            ],
        ])->map(function (array $user) use ($departments, $password) {
            $department = $departments[$user['department']];

            return $this->seedUser($user['email'], [
                'name' => $user['name'],
                'password' => $password,
                'role' => $user['role'],
                'department_id' => $department->id,
                'manager_id' => $user['manager']?->id,
                'job_title' => $user['job_title'],
                'phone' => $user['phone'],
                'work_location' => 'Phnom Penh',
                'employment_type' => 'Full-time',
                'emergency_contact_name' => $user['name'].' Emergency',
                'emergency_contact_phone' => $user['emergency_contact_phone'],
                'bio' => 'Employee profile for demo and QA workflows.',
                'hire_date' => $user['hire_date']->toDateString(),
                'is_active' => true,
            ], $user['legacy_emails']);
        });

        // Assign staff after manager records exist.
        $users['hr_specialist']->update(['manager_id' => $users['hr_manager']->id]);
        $users['it_engineer']->update(['manager_id' => $users['it_manager']->id]);
        $users['it_support']->update(['manager_id' => $users['it_manager']->id]);
        $users['it_sreynim']->update(['manager_id' => $users['it_manager']->id]);
        $users['it_sinat']->update(['manager_id' => $users['it_manager']->id]);
        $users['it_kimheng']->update(['manager_id' => $users['it_manager']->id]);
        $users['it_sophearom']->update(['manager_id' => $users['it_manager']->id]);
        $users['sales_rep']->update(['manager_id' => $users['sales_manager']->id]);
        $users['sales_ops']->update(['manager_id' => $users['sales_manager']->id]);

        // Department ownership drives manager-scoped pages and approvals.
        $departments['HR']->update(['manager_id' => $users['hr_manager']->id]);
        $departments['IT']->update(['manager_id' => $users['it_manager']->id]);
        $departments['SALES']->update(['manager_id' => $users['sales_manager']->id]);

        // Leave policy defaults are reflected in each demo employee balance.
        $types = collect([
            'annual' => ['name' => 'Annual Leave', 'code' => 'annual', 'default_allowance_days' => 18, 'paid' => true, 'requires_attachment' => false, 'deducts_balance' => true, 'is_active' => true],
            'sick' => ['name' => 'Sick Leave', 'code' => 'sick', 'default_allowance_days' => 7, 'paid' => true, 'requires_attachment' => true, 'deducts_balance' => true, 'is_active' => true],
            'unpaid' => ['name' => 'Unpaid Leave', 'code' => 'unpaid', 'default_allowance_days' => 30, 'paid' => false, 'requires_attachment' => false, 'deducts_balance' => true, 'is_active' => true],
        ])->mapWithKeys(fn (array $type, string $code) => [
            $code => LeaveType::query()->updateOrCreate(['code' => $code], $type),
        ]);

        $this->call(PublicHolidaySeeder::class);

        $allUsers = collect([$ceo, $admin])->merge($users);
        $balanceService = app(LeaveBalanceService::class);

        // Reset demo balances before replaying demo requests into used and pending totals.
        $allUsers->each(function (User $user) use ($types, $year) {
            $types->each(function (LeaveType $type) use ($user, $year) {
                LeaveBalance::query()->updateOrCreate(
                    ['user_id' => $user->id, 'leave_type_id' => $type->id, 'year' => $year],
                    [
                        'allowance_days' => $type->default_allowance_days,
                        'used_days' => 0,
                        'pending_days' => 0,
                        'carried_forward_days' => 0,
                        'adjustment_days' => 0,
                        'override_reason' => null,
                    ]
                );
            });
        });

        // Relative offsets keep demo requests useful whenever the seeder runs.
        $requests = [
            [$users['sales_rep'], 'annual', -236, -234, 'approved', $users['sales_manager'], 'Travelling to Kampong Cham for my cousin wedding'],
            [$users['it_engineer'], 'sick', -214, -213, 'approved', $users['it_manager'], 'High fever and body aches, clinic advised me rest two days'],
            [$users['hr_specialist'], 'annual', -188, -186, 'approved', $users['hr_manager'], 'Spending few days with my parents while they visiting Phnom Penh'],
            [$users['sales_ops'], 'annual', -161, -160, 'approved', $users['sales_manager'], 'Need handle family land transfer at district office'],
            [$users['it_support'], 'annual', -137, -135, 'approved', $users['it_manager'], 'Visiting my grandparents in Siem Reap for a few days'],
            [$users['sales_manager'], 'sick', -112, -112, 'approved', $ceo, 'Have dental procedure and need some recovery time after'],
            [$users['hr_manager'], 'annual', -86, -84, 'approved', $ceo, 'Taking short family trip we planned few months ago'],
            [$users['it_engineer'], 'annual', -62, -60, 'approved', $users['it_manager'], 'Taking trip with friends that already booked before release'],
            [$users['sales_ops'], 'sick', -39, -39, 'approved', $users['sales_manager'], 'Migraine came back and have clinic appointement this afternoon'],
            [$users['it_engineer'], 'annual', -18, -16, 'approved', $users['it_manager'], 'Family trip to Battambang for my grandmother birthday'],
            [$users['it_support'], 'sick', -7, -7, 'approved', $users['it_manager'], 'Fever and sore throat since last night'],
            [$users['sales_rep'], 'annual', -3, -2, 'approved', $users['sales_manager'], 'Need accompany my mother for specialist appointment'],
            [$users['sales_ops'], 'annual', -1, -1, 'rejected', $users['sales_manager'], 'Urgent bank issue, need go resolve it in person'],
            [$users['hr_specialist'], 'annual', 2, 4, 'pending', $users['hr_manager'], 'Going to close friend wedding in Kep'],
            [$users['it_support'], 'annual', 6, 8, 'pending', $users['it_manager'], 'Taking my parents to Kampot for short family break'],
            [$users['sales_rep'], 'sick', 1, 1, 'pending', $users['sales_manager'], 'Follow up appointment for stomach pain still not better'],
            [$users['sales_manager'], 'annual', 12, 14, 'approved', $ceo, 'Family holiday already booked'],
            [$users['hr_manager'], 'sick', -24, -23, 'approved', $ceo, 'Stomache problem, doctor advised to rest two days'],
            [$ceo, 'annual', 20, 21, 'pending', null, 'Short personal trip before next meeting'],
        ];

        // Create matching in-app notifications so demo accounts show realistic unread state.
        foreach ($requests as [$user, $typeCode, $startOffset, $endOffset, $status, $approver, $reason]) {
            $startsAt = $this->businessDay($today->copy()->addDays($startOffset));
            $endsAt = $this->businessDay($today->copy()->addDays($endOffset));
            $fixtureKey = "{$user->email}:{$typeCode}:{$startOffset}:{$endOffset}";

            if ($endsAt->lt($startsAt)) {
                $endsAt = $startsAt->copy();
            }

            $requestedDays = max(1, $balanceService->workingDays($startsAt->toDateString(), $endsAt->toDateString()));
            $submittedAt = $this->workingTime(
                $startsAt->copy()->subDays($status === 'pending' ? 2 : 10),
                "submitted:{$fixtureKey}",
            );
            $decidedAt = in_array($status, ['approved', 'rejected'], true)
                ? $this->workingTime($submittedAt->copy()->addDay(), "decided:{$fixtureKey}")
                : null;

            $leaveRequest = LeaveRequest::query()->updateOrCreate(
                [
                    'user_id' => $user->id,
                    'leave_type_id' => $types[$typeCode]->id,
                    'starts_at' => $startsAt->toDateString(),
                ],
                [
                    'department_id' => $user->department_id,
                    'approver_id' => $approver?->id,
                    'ends_at' => $endsAt->toDateString(),
                    'requested_days' => $requestedDays,
                    'status' => $status,
                    'reason' => $reason,
                    'manager_comment' => match ($status) {
                        'approved' => 'Approved',
                        'rejected' => 'Rejected due to coverage needs.',
                        default => null,
                    },
                    'submitted_at' => $submittedAt,
                    'decided_at' => $decidedAt,
                ]
            );
            $leaveRequest->forceFill([
                'created_at' => $submittedAt,
                'updated_at' => $decidedAt ?? $submittedAt,
            ])->save();

            if ($status === 'pending' && $approver) {
                $this->seedNotification(
                    $approver,
                    'leave_submitted',
                    'Leave request awaiting review',
                    $user->name.' requested '.$requestedDays.' day(s) of '.$types[$typeCode]->name.'.',
                    '/approvals'
                );
            }

            if (in_array($status, ['approved', 'rejected'], true)) {
                $this->seedNotification(
                    $user,
                    'leave_decided',
                    'Leave request '.$status,
                    'Your '.$types[$typeCode]->name.' request was '.$status.'.',
                    '/dashboard',
                    $leaveRequest->decided_at
                        ? $this->workingTime(
                            Carbon::parse($leaveRequest->decided_at)->addDay(),
                            "notification-read:{$fixtureKey}",
                        )
                        : null,
                );
            }
        }

        // Recalculate aggregate balance columns from the final demo request set.
        LeaveRequest::query()
            ->whereYear('starts_at', $year)
            ->whereIn('user_id', $allUsers->pluck('id'))
            ->get()
            ->groupBy(fn (LeaveRequest $request) => $request->user_id.'-'.$request->leave_type_id)
            ->each(function ($requests, string $key) use ($year) {
                [$userId, $leaveTypeId] = explode('-', $key);

                LeaveBalance::query()->where([
                    'user_id' => $userId,
                    'leave_type_id' => $leaveTypeId,
                    'year' => $year,
                ])->update([
                    'used_days' => $requests->where('status', 'approved')->sum('requested_days'),
                    'pending_days' => $requests->where('status', 'pending')->sum('requested_days'),
                ]);
            });

        AiFaq::query()->firstOrCreate(
            ['question' => 'When do I need a medical certificate?'],
            ['answer' => 'A medical certificate is required for sick leave requests configured by HR as attachment-required.']
        );
        AiFaq::query()->firstOrCreate(
            ['question' => 'How are leave days calculated?'],
            ['answer' => 'The system counts working days between the selected dates, excluding weekends and configured public holidays.']
        );

        $defaultAttendanceSite = AttendanceSite::query()->firstOrCreate(
            ['code' => 'PNH'],
            [
                'name' => 'Phnom Penh Office',
                'timezone' => 'Asia/Phnom_Penh',
                'acceptance_radius_meters' => 150,
                'maximum_accuracy_meters' => 100,
                'allowed_ip_ranges' => [],
                'is_active' => true,
            ]
        );
        $defaultAttendanceSite->qrCode()->firstOrCreate([], [
            'mode' => 'daily',
            'is_enabled' => false,
        ]);

        User::query()->where('is_active', true)->each(
            fn (User $user) => $attendance->createDefaultSchedule($user, $defaultAttendanceSite)
        );

        $demoUserIds = $users->pluck('id')
            ->push($ceo->id)
            ->push($admin->id)
            ->unique()
            ->values()
            ->all();
        $this->seedAttendanceHistory($attendance, $defaultAttendanceSite, $demoUserIds);
    }

    private function seedAttendanceHistory(
        AttendanceService $attendance,
        AttendanceSite $site,
        array $demoUserIds
    ): void {
        $baseline = $this->attendanceSeedBaseline($site->timezone);
        $yesterday = now($site->timezone)->startOfDay()->subDay();

        User::query()
            ->whereKey($demoUserIds)
            ->where('is_active', true)
            ->where(function ($query) use ($baseline): void {
                $query
                    ->whereNull('hire_date')
                    ->orWhereDate('hire_date', '>', $baseline->toDateString());
            })
            ->update(['hire_date' => $baseline->toDateString()]);

        if ($baseline->gt($yesterday)) {
            return;
        }

        $site->loadMissing('qrCode');

        User::query()
            ->whereKey($demoUserIds)
            ->where('is_active', true)
            ->orderBy('id')
            ->each(function (User $user) use ($attendance, $baseline, $yesterday, $site): void {
                $this->alignDefaultScheduleWithAttendanceBaseline($user, $site, $baseline);

                for ($date = $baseline->copy(); $date->lte($yesterday); $date->addDay()) {
                    $schedule = $attendance->activeSchedule($user, $date);
                    if (! $schedule || ($user->hire_date && $user->hire_date->toDateString() > $date->toDateString())) {
                        continue;
                    }

                    $day = $attendance->ensureDay($user, $schedule, $date);
                    if (! $day->excuse_type) {
                        $this->seedAttendanceEvents($day, $schedule, $site);
                    }

                    $finalizedAt = Carbon::parse(
                        $day->work_date->toDateString().' '.$day->schedule_snapshot['work_end'],
                        $day->timezone
                    )->utc();
                    $day->update(['finalized_at' => $finalizedAt]);
                    $attendance->recomputeDay($day);
                }
            });
    }

    private function alignDefaultScheduleWithAttendanceBaseline(
        User $user,
        AttendanceSite $site,
        Carbon $baseline
    ): void {
        $schedule = $user->attendanceSchedules()
            ->where('primary_site_id', $site->id)
            ->oldest('effective_from')
            ->first();

        if (! $schedule || $schedule->attendanceDays()->exists()) {
            return;
        }

        $effectiveFrom = $baseline->copy();
        if ($user->hire_date && $user->hire_date->toDateString() > $effectiveFrom->toDateString()) {
            $effectiveFrom = $user->hire_date->copy()->startOfDay();
        }

        if ($schedule->effective_from->gt($effectiveFrom)) {
            $schedule->update(['effective_from' => $effectiveFrom->toDateString()]);
        }
    }

    private function seedAttendanceEvents(
        AttendanceDay $day,
        AttendanceSchedule $schedule,
        AttendanceSite $site
    ): void {
        $fixtureKey = $day->user_id.':'.$day->work_date->toDateString();
        $morningRoll = $this->seededNumber("{$fixtureKey}:morning-roll", 0, 99);
        $lunchRoll = $this->seededNumber("{$fixtureKey}:lunch-roll", 0, 99);
        $checkoutRoll = $this->seededNumber("{$fixtureKey}:checkout-roll", 0, 99);

        $moments = [
            'morning_in' => [
                'direction' => 'in',
                'scheduled' => $schedule->work_start,
                'minutes' => $morningRoll < 12
                    ? $this->seededNumber("{$fixtureKey}:morning-late", 3, 18)
                    : -$this->seededNumber("{$fixtureKey}:morning-normal", 1, 12),
            ],
            'lunch_out' => [
                'direction' => 'out',
                'scheduled' => $schedule->lunch_start,
                'minutes' => $this->seededNumber("{$fixtureKey}:lunch-out", 0, 7),
            ],
            'lunch_in' => [
                'direction' => 'in',
                'scheduled' => $schedule->lunch_end,
                'minutes' => $lunchRoll < 8
                    ? $this->seededNumber("{$fixtureKey}:lunch-late", 2, 10)
                    : -$this->seededNumber("{$fixtureKey}:lunch-normal", 2, 10),
            ],
            'final_out' => [
                'direction' => 'out',
                'scheduled' => $schedule->work_end,
                'minutes' => $checkoutRoll < 6
                    ? -$this->seededNumber("{$fixtureKey}:checkout-early", 5, 20)
                    : $this->seededNumber("{$fixtureKey}:checkout-normal", 1, 18),
            ],
        ];

        foreach ($moments as $classification => $fixture) {
            $effectiveAt = Carbon::parse(
                $day->work_date->toDateString().' '.$fixture['scheduled'],
                $day->timezone
            )
                ->addMinutes($fixture['minutes'])
                ->addSeconds($this->seededNumber("{$fixtureKey}:{$classification}:seconds", 0, 50))
                ->utc();

            AttendanceEvent::query()->updateOrCreate(
                [
                    'user_id' => $day->user_id,
                    'idempotency_key' => $this->seededUuid("attendance:{$fixtureKey}:{$classification}"),
                ],
                [
                    'attendance_day_id' => $day->id,
                    'attendance_site_id' => $site->id,
                    'attendance_qr_code_id' => $site->qrCode?->id,
                    'direction' => $fixture['direction'],
                    'classification' => $classification,
                    'occurred_at' => $effectiveAt,
                    'effective_at' => $effectiveAt,
                    'source' => 'seed',
                    'latitude' => $site->latitude,
                    'longitude' => $site->longitude,
                    'accuracy_meters' => $site->latitude !== null ? 12 : null,
                    'distance_meters' => $site->latitude !== null ? 0 : null,
                    'ip_address' => '127.0.0.1',
                    'user_agent' => 'DatabaseSeeder',
                    'geolocation_status' => $site->latitude !== null ? 'passed' : 'unavailable',
                    'network_status' => 'not_configured',
                    'site_assignment_status' => 'assigned',
                    'verification_status' => 'clean',
                    'flag_reasons' => [],
                ]
            );
        }
    }

    private function attendanceSeedBaseline(string $timezone): Carbon
    {
        $configured = trim((string) config('attendance.seed_baseline_date', '2026-07-28'));

        foreach (['Y-m-d', 'd/m/Y'] as $format) {
            try {
                $date = Carbon::createFromFormat('!'.$format, $configured, $timezone);
                if ($date && $date->format($format) === $configured) {
                    return $date->startOfDay();
                }
            } catch (\Throwable) {
                // Try the other supported format before reporting the configuration error.
            }
        }

        throw new InvalidArgumentException(
            'ATTENDANCE_SEED_BASELINE_DATE must use YYYY-MM-DD or DD/MM/YYYY format.'
        );
    }

    private function seededNumber(string $fixtureKey, int $minimum, int $maximum): int
    {
        $hashPrefix = Str::substr(hash('sha256', $fixtureKey), 0, 8);

        return $minimum + ((int) hexdec($hashPrefix) % ($maximum - $minimum + 1));
    }

    private function seededUuid(string $fixtureKey): string
    {
        $hex = Str::substr(hash('sha256', $fixtureKey), 0, 32);
        $hex[12] = '4';
        $hex[16] = dechex((hexdec($hex[16]) & 0x3) | 0x8);

        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split($hex, 4));
    }

    private function businessDay(Carbon $date): Carbon
    {
        // Seed fixtures avoid weekends so every request has at least one working day.
        while ($date->isWeekend()) {
            $date->addDay();
        }

        return $date;
    }

    private function workingTime(Carbon $date, string $fixtureKey): Carbon
    {
        $hashPrefix = Str::substr(hash('sha256', $fixtureKey), 0, 8);
        $minuteOffset = (int) (hexdec($hashPrefix) % self::WORKDAY_MINUTES);

        return $date->copy()->startOfDay()->addHours(8)->addMinutes($minuteOffset);
    }

    private function seedNotification(
        User $user,
        string $type,
        string $title,
        string $body,
        string $actionUrl,
        ?Carbon $readAt = null
    ): void {
        // Match runtime notification uniqueness closely enough to keep db:seed rerunnable.
        SystemNotification::query()->updateOrCreate(
            [
                'user_id' => $user->id,
                'type' => $type,
                'title' => $title,
                'body' => $body,
                'action_url' => $actionUrl,
            ],
            ['read_at' => $readAt]
        );
    }

    private function seedUser(string $email, array $attributes, array $legacyEmails = []): User
    {
        $user = User::query()
            ->where('email', $email)
            ->orWhereIn('email', $legacyEmails)
            ->first();

        if (! $user) {
            $user = User::query()->create($attributes + [
                'email' => $email,
                'employee_code' => null,
            ]);
        } else {
            $user->fill($attributes + [
                'email' => $email,
                'employee_code' => null,
            ]);
            $user->save();
        }

        $department = Department::query()->findOrFail($attributes['department_id']);
        $user->update([
            'employee_code' => User::formatEmployeeCode($department, $user->id),
        ]);

        return $user;
    }
}
