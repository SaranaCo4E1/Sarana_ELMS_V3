<?php

namespace Database\Seeders;

use App\Models\AttendanceEvent;
use App\Models\AttendanceSite;
use App\Models\AuditLog;
use App\Models\Department;
use App\Models\LeaveBalance;
use App\Models\LeaveRequest;
use App\Models\LeaveType;
use App\Models\Role;
use App\Models\SystemNotification;
use App\Models\User;
use App\Services\AttendanceService;
use App\Services\DemoAttendanceHistorySeeder;
use App\Services\LeaveBalanceService;
use App\Support\Audit;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use InvalidArgumentException;

class DatabaseSeeder extends Seeder
{
    private const WORKDAY_MINUTES = 9 * 60;

    public function run(AttendanceService $attendance, DemoAttendanceHistorySeeder $attendanceHistory): void
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
            'name' => 'Sona Yea',
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
            [$users['it_engineer'], 'annual', -15, -13, 'approved', $users['it_manager'], 'Family trip to Battambang for my grandmother birthday'],
            [$users['it_support'], 'annual', -14, -13, 'approved', $users['it_manager'], 'Helping my parents move house before their new tenancy starts'],
            [$users['sales_ops'], 'annual', -13, -13, 'approved', $users['sales_manager'], 'Attending my younger sister university graduation ceremony'],
            [$users['it_support'], 'sick', -7, -7, 'approved', $users['it_manager'], 'Fever and sore throat since last night'],
            [$users['sales_rep'], 'annual', -3, -2, 'approved', $users['sales_manager'], 'Need accompany my mother for specialist appointment'],
            [$users['sales_ops'], 'annual', -1, -1, 'rejected', $users['sales_manager'], 'Urgent bank issue, need go resolve it in person'],
            [$users['hr_specialist'], 'annual', 2, 4, 'pending', $users['hr_manager'], 'Going to close friend wedding in Kep'],
            [$users['it_support'], 'annual', 6, 8, 'pending', $users['it_manager'], 'Taking my parents to Kampot for short family break'],
            [$users['sales_rep'], 'sick', 1, 1, 'pending', $users['sales_manager'], 'Follow up appointment for stomach pain still not better'],
            [$users['sales_manager'], 'annual', 12, 14, 'approved', $ceo, 'Family holiday already booked'],
            [$users['hr_manager'], 'sick', -24, -23, 'approved', $ceo, 'Stomache problem, doctor advised to rest two days'],
            [$ceo, 'annual', 20, 21, 'pending', null, 'Short personal trip before next meeting'],
            [$admin, 'annual', -31, -30, 'approved', $ceo, 'Taking a short break to visit family in Kampong Thom'],
            [$admin, 'annual', 9, 10, 'pending', $ceo, 'Personal appointment and family commitments'],
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
            $submissionDate = $startsAt->copy()->subDays($status === 'pending' ? 2 : 10);
            if ($submissionDate->gte($today)) {
                $minimumAge = $status === 'pending' ? 1 : 3;
                $maximumAge = $status === 'pending' ? 4 : 6;
                $submissionDate = $today->copy()->subDays(
                    $this->seededNumber("submitted-age:{$fixtureKey}", $minimumAge, $maximumAge)
                );
            }
            $submittedAt = $this->workingTime($submissionDate, "submitted:{$fixtureKey}");
            $decidedAt = in_array($status, ['approved', 'rejected'], true)
                ? $this->workingTime($submittedAt->copy()->addDay(), "decided:{$fixtureKey}")
                : null;

            $matchingFixtures = LeaveRequest::query()
                ->where('user_id', $user->id)
                ->where('leave_type_id', $types[$typeCode]->id)
                ->where('reason', $reason)
                ->orderBy('id')
                ->get();
            $leaveRequest = $matchingFixtures->shift() ?? new LeaveRequest;

            // Relative dates move with "today", so use stable fixture identity and
            // clean up duplicates produced by older date-keyed seeder runs.
            $matchingFixtures->each(fn (LeaveRequest $duplicate) => $duplicate->delete());

            $leaveRequest->fill([
                'user_id' => $user->id,
                'leave_type_id' => $types[$typeCode]->id,
                'starts_at' => $startsAt->toDateString(),
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
            ])->save();
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
                    '/approvals#request-'.$leaveRequest->id,
                    $submittedAt,
                );
            }

            if ($status === 'pending' && $user->isNot($admin)) {
                $this->seedNotification(
                    $admin,
                    'leave_submitted',
                    'Leave request awaiting review',
                    $user->name.' requested '.$requestedDays.' day(s) of '.$types[$typeCode]->name.'.',
                    '/approvals#request-'.$leaveRequest->id,
                    $submittedAt,
                );
            }

            if ($status === 'pending' && $user->is($admin)) {
                $this->seedNotification(
                    $admin,
                    'leave_submitted',
                    'Leave request submitted',
                    'Your '.$types[$typeCode]->name.' request is awaiting review.',
                    '/apply-leave',
                    $submittedAt,
                );
            }

            if (in_array($status, ['approved', 'rejected'], true)) {
                $this->seedNotification(
                    $user,
                    'leave_decided',
                    'Leave request '.$status,
                    'Your '.$types[$typeCode]->name.' request was '.$status.'.',
                    '/dashboard',
                    $decidedAt ?? $submittedAt,
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

        $this->call([
            AiFaqSeeder::class,
        ]);

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
        $attendanceHistory->seed($defaultAttendanceSite, $demoUserIds);
        $this->seedAuditHistory($admin, $ceo, $departments, $types, $users, $today);
    }

    private function seedAuditHistory(
        User $admin,
        User $ceo,
        $departments,
        $types,
        $users,
        Carbon $today
    ): void {
        AuditLog::query()->where('metadata->seeded', true)->delete();

        LeaveRequest::query()
            ->with(['user', 'approver', 'leaveType'])
            ->whereIn('user_id', $users->pluck('id')->push($admin->id)->push($ceo->id))
            ->orderBy('submitted_at')
            ->get()
            ->each(function (LeaveRequest $leaveRequest): void {
                $this->seedAuditLog(
                    $leaveRequest->user,
                    'leave.request.submitted',
                    $leaveRequest,
                    [
                        'changes' => Audit::changes([], $leaveRequest->only([
                            'leave_type_id', 'starts_at', 'ends_at', 'requested_days', 'status', 'reason',
                        ])),
                        'changed_fields' => ['leave_type_id', 'starts_at', 'ends_at', 'requested_days', 'status', 'reason'],
                        'attachment_count' => 0,
                        'leave_type_name' => $leaveRequest->leaveType->name,
                    ],
                    Carbon::parse($leaveRequest->submitted_at)
                );

                if (in_array($leaveRequest->status, ['approved', 'rejected'], true) && $leaveRequest->decided_at) {
                    $after = [
                        'status' => $leaveRequest->status,
                        'manager_comment' => $leaveRequest->manager_comment,
                        'approver_id' => $leaveRequest->approver_id,
                    ];
                    $this->seedAuditLog(
                        $leaveRequest->approver,
                        'leave.request.'.$leaveRequest->status,
                        $leaveRequest,
                        [
                            'changes' => Audit::changes([
                                'status' => 'pending',
                                'manager_comment' => null,
                                'approver_id' => null,
                            ], $after),
                            'changed_fields' => array_keys($after),
                            'decision_reason' => $leaveRequest->manager_comment,
                        ],
                        Carbon::parse($leaveRequest->decided_at)
                    );
                }
            });

        $itManager = $users['it_manager'];
        $itEngineer = $users['it_engineer'];
        $sickType = $types['sick'];
        $managerRole = Role::query()->where('slug', 'manager')->with('permissions')->first();

        $this->seedAuditLog($admin, 'admin.user.updated', $itEngineer, [
            'changes' => Audit::changes([
                'job_title' => 'Junior Backend Engineer',
                'manager_id' => null,
            ], [
                'job_title' => $itEngineer->job_title,
                'manager_id' => $itManager->id,
            ]),
            'changed_fields' => ['job_title', 'manager_id'],
        ], $today->copy()->subDays(74)->setTime(10, 18));

        $this->seedAuditLog($admin, 'admin.leave_type.updated', $sickType, [
            'changes' => Audit::changes([
                'requires_attachment' => false,
                'default_allowance_days' => 5,
            ], [
                'requires_attachment' => (bool) $sickType->requires_attachment,
                'default_allowance_days' => $sickType->default_allowance_days,
            ]),
            'changed_fields' => ['requires_attachment', 'default_allowance_days'],
            'reason' => 'Aligned the sick-leave policy with the updated HR handbook.',
        ], $today->copy()->subDays(68)->setTime(14, 5));

        $this->seedAuditLog($admin, 'admin.department.updated', $departments['IT'], [
            'changes' => Audit::changes(['manager_id' => null], ['manager_id' => $itManager->id]),
            'changed_fields' => ['manager_id'],
            'reason' => 'Assigned the new IT reporting owner.',
        ], $today->copy()->subDays(61)->setTime(9, 32));

        if ($managerRole) {
            $currentPermissions = $managerRole->permissions->sortBy('key')->pluck('key')->values()->all();
            $previousPermissions = array_values(array_filter(
                $currentPermissions,
                fn (string $permission): bool => $permission !== 'attendance.team.manage'
            ));
            $this->seedAuditLog($admin, 'admin.role.permissions_updated', $managerRole, [
                'changes' => Audit::changes(
                    ['permissions' => $previousPermissions],
                    ['permissions' => $currentPermissions]
                ),
                'changed_fields' => ['permissions'],
                'permissions_added' => array_values(array_diff($currentPermissions, $previousPermissions)),
                'permissions_removed' => [],
                'reason' => 'Managers need access to their team attendance overview.',
            ], $today->copy()->subDays(44)->setTime(16, 20));
        }

        $balance = LeaveBalance::query()
            ->where('user_id', $itEngineer->id)
            ->where('leave_type_id', $types['annual']->id)
            ->first();
        if ($balance) {
            $this->seedAuditLog($admin, 'admin.balance.overridden', $balance, [
                'changes' => Audit::changes([
                    'adjustment_days' => -1,
                    'available_days' => (float) $balance->available_days - 1.5,
                    'override_reason' => null,
                ], [
                    'adjustment_days' => 0.5,
                    'available_days' => (float) $balance->available_days,
                    'override_reason' => 'Carried forward 1.5 days after payroll reconciliation.',
                ]),
                'changed_fields' => ['adjustment_days', 'available_days', 'override_reason'],
                'delta_days' => 1.5,
                'year' => (int) $today->year,
                'reason' => 'Carried forward 1.5 days after payroll reconciliation.',
            ], $today->copy()->subDays(27)->setTime(11, 47));
        }

        $this->seedAuditLog($itEngineer, 'profile.updated', $itEngineer, [
            'changes' => Audit::changes([
                'emergency_contact_phone' => '078 000 000',
                'bank_account_number' => '001234567890',
            ], [
                'emergency_contact_phone' => $itEngineer->profile?->emergency_contact_phone,
                'bank_account_number' => '001234569999',
            ]),
            'changed_fields' => ['emergency_contact_phone', 'bank_account_number'],
        ], $today->copy()->subDays(12)->setTime(8, 55));

        foreach ([9, 6, 3, 1] as $daysAgo) {
            $this->seedAuditLog($admin, 'auth.login.succeeded', $admin, [
                'remembered' => $daysAgo === 9,
                'two_factor_used' => true,
                'security_event' => true,
            ], $today->copy()->subDays($daysAgo)->setTime(8 + ($daysAgo % 2), 12));
        }

        $this->seedAuditLog(null, 'auth.login.failed', null, [
            'attempted_email' => $admin->email,
            'reason' => 'invalid_credentials',
            'security_event' => true,
        ], $today->copy()->subDays(2)->setTime(21, 16), '203.0.113.42');

        $correctedEvent = AttendanceEvent::query()
            ->with('day')
            ->whereNotNull('correction_reason')
            ->latest('effective_at')
            ->first();
        if ($correctedEvent) {
            $this->seedAuditLog($admin, 'attendance.event.corrected', $correctedEvent, [
                'changes' => Audit::changes([
                    'effective_at' => $correctedEvent->effective_at->copy()->subMinutes(12),
                    'verification_status' => 'flagged',
                ], [
                    'effective_at' => $correctedEvent->effective_at,
                    'verification_status' => $correctedEvent->verification_status,
                ]),
                'changed_fields' => ['effective_at', 'verification_status'],
                'reason' => $correctedEvent->correction_reason,
                'employee_name' => $correctedEvent->day?->user?->name,
            ], Carbon::parse($correctedEvent->updated_at));
        }
    }

    private function seedAuditLog(
        ?User $actor,
        string $action,
        $subject,
        array $metadata,
        Carbon $occurredAt,
        string $ipAddress = '10.10.0.24'
    ): void {
        $request = $this->seededAuditRequest($action);
        $subjectType = $subject ? $subject::class : 'system';
        $timestampKey = implode(':', [
            $action,
            $actor?->getKey() ?? 'system',
            $subjectType,
            $subject?->getKey() ?? 'none',
            $occurredAt->format('Y-m-d H:i'),
        ]);
        $occurredAt = $occurredAt->copy()->setSecond(
            $this->seededNumber("audit-second:{$timestampKey}", 1, 59)
        );
        $log = AuditLog::query()->create([
            'actor_id' => $actor?->id,
            'action' => $action,
            'subject_type' => $subject ? $subjectType : null,
            'subject_id' => $subject?->getKey(),
            'metadata' => [
                ...$metadata,
                'seeded' => true,
                'request' => [
                    ...$request,
                    'user_agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/136.0 Safari/537.36',
                ],
            ],
            'ip_address' => $ipAddress,
        ]);
        $log->forceFill(['created_at' => $occurredAt, 'updated_at' => $occurredAt])->saveQuietly();
    }

    private function seededAuditRequest(string $action): array
    {
        return match ($action) {
            'leave.request.submitted' => ['method' => 'POST', 'route' => 'leave-requests.store'],
            'leave.request.approved',
            'leave.request.rejected' => ['method' => 'PATCH', 'route' => 'approvals.update'],
            'admin.user.updated' => ['method' => 'PATCH', 'route' => 'admin.users.update'],
            'admin.leave_type.updated' => ['method' => 'PATCH', 'route' => 'admin.leave-types.update'],
            'admin.department.updated' => ['method' => 'PATCH', 'route' => 'admin.departments.update'],
            'admin.role.permissions_updated' => ['method' => 'PATCH', 'route' => 'roles-permissions.roles.permissions.update'],
            'admin.balance.overridden' => ['method' => 'POST', 'route' => 'admin.balances.override'],
            'profile.updated' => ['method' => 'PATCH', 'route' => 'profile.update'],
            'auth.login.succeeded' => ['method' => 'POST', 'route' => 'two-factor.verify'],
            'auth.login.failed' => ['method' => 'POST', 'route' => 'login.store'],
            'attendance.event.corrected' => ['method' => 'PATCH', 'route' => 'attendance.events.correct'],
            default => throw new InvalidArgumentException("No seeded request route is defined for audit action [{$action}]."),
        };
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
        Carbon $createdAt,
        ?Carbon $readAt = null
    ): void {
        $matchingFixtures = SystemNotification::query()
            ->where('user_id', $user->id)
            ->where('type', $type)
            ->where('title', $title)
            ->where('body', $body)
            ->orderBy('id')
            ->get();
        $notification = $matchingFixtures->shift() ?? new SystemNotification;
        $matchingFixtures->each(fn (SystemNotification $duplicate) => $duplicate->delete());

        $notification->fill([
            'user_id' => $user->id,
            'type' => $type,
            'title' => $title,
            'body' => $body,
            'action_url' => $actionUrl,
            'read_at' => $readAt,
        ])->save();
        $notification->forceFill([
            'created_at' => $createdAt,
            'updated_at' => $readAt ?? $createdAt,
        ])->saveQuietly();
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
