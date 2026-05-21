<?php

namespace Database\Seeders;

use App\Models\AiFaq;
use App\Models\Department;
use App\Models\LeaveBalance;
use App\Models\LeaveRequest;
use App\Models\LeaveType;
use App\Models\PublicHoliday;
use App\Models\SystemNotification;
use App\Models\User;
use App\Services\LeaveBalanceService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
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

        // Seed the reporting root first so department managers can reference the CEO.
        $ceo = $this->seedUser('ceo@niy.ai', 'CEO-001', [
            'name' => 'Sophea Sok',
            'password' => $password,
            'role' => 'admin',
            'department_id' => $departments['HR']->id,
            'manager_id' => null,
            'job_title' => 'Chief Executive Officer',
            'phone' => '+66 80 000 1001',
            'work_location' => 'Phnom Penh',
            'employment_type' => 'Full-time',
            'emergency_contact_name' => 'Davy Sok',
            'emergency_contact_phone' => '+66 80 000 1999',
            'bio' => 'Company-wide executive sponsor for people operations and growth.',
            'hire_date' => $today->copy()->subYears(5)->toDateString(),
            'is_active' => true,
        ]);

        $admin = $this->seedUser('admin@niy.ai', 'ADM-001', [
            'name' => 'Davy Keo',
            'password' => $password,
            'role' => 'admin',
            'department_id' => $departments['HR']->id,
            'manager_id' => $ceo->id,
            'job_title' => 'System Administrator',
            'phone' => '+66 80 000 1002',
            'work_location' => 'Phnom Penh',
            'employment_type' => 'Full-time',
            'emergency_contact_name' => 'Sophal Keo',
            'emergency_contact_phone' => '+66 80 000 1998',
            'bio' => 'System administration account for seeded demo and QA workflows.',
            'hire_date' => $today->copy()->subYears(3)->toDateString(),
            'is_active' => true,
        ], ['admin@elms.test']);

        // Managers and staff are keyed by role so later leave fixtures can reference them clearly.
        $users = collect([
            'hr_manager' => [
                'name' => 'Sreymom Chan',
                'email' => 'hr@niy.ai',
                'role' => 'hr',
                'department' => 'HR',
                'manager' => $ceo,
                'employee_code' => 'HR-001',
                'job_title' => 'HR Manager',
                'hire_date' => $today->copy()->subYears(3)->subMonths(2),
                'legacy_emails' => ['hr@elms.test'],
            ],
            'it_manager' => [
                'name' => 'Dara Vann',
                'email' => 'it@niy.ai',
                'role' => 'manager',
                'department' => 'IT',
                'manager' => $ceo,
                'employee_code' => 'IT-001',
                'job_title' => 'IT Manager',
                'hire_date' => $today->copy()->subYears(2)->subMonths(8),
                'legacy_emails' => ['manager@elms.test'],
            ],
            'sales_manager' => [
                'name' => 'Sokha Lim',
                'email' => 'sales@niy.ai',
                'role' => 'manager',
                'department' => 'SALES',
                'manager' => $ceo,
                'employee_code' => 'SALES-001',
                'job_title' => 'Sales Manager',
                'hire_date' => $today->copy()->subYears(2)->subMonths(4),
                'legacy_emails' => [],
            ],
            'hr_specialist' => [
                'name' => 'Sreyneang Kim',
                'email' => 'hr.staff@niy.ai',
                'role' => 'staff',
                'department' => 'HR',
                'manager' => null,
                'employee_code' => 'HR-101',
                'job_title' => 'People Operations Specialist',
                'hire_date' => $today->copy()->subYear()->subMonths(5),
                'legacy_emails' => [],
            ],
            'it_engineer' => [
                'name' => 'Rithy Heng',
                'email' => 'it.engineer@niy.ai',
                'role' => 'staff',
                'department' => 'IT',
                'manager' => null,
                'employee_code' => 'IT-101',
                'job_title' => 'Backend Engineer',
                'hire_date' => $today->copy()->subYear()->subMonths(2),
                'legacy_emails' => ['staff@elms.test'],
            ],
            'it_support' => [
                'name' => 'Sothea Chea',
                'email' => 'it.support@niy.ai',
                'role' => 'staff',
                'department' => 'IT',
                'manager' => null,
                'employee_code' => 'IT-102',
                'job_title' => 'IT Support Specialist',
                'hire_date' => $today->copy()->subMonths(10),
                'legacy_emails' => [],
            ],
            'sales_rep' => [
                'name' => 'Vicheka Nhim',
                'email' => 'sales.rep@niy.ai',
                'role' => 'staff',
                'department' => 'SALES',
                'manager' => null,
                'employee_code' => 'SALES-101',
                'job_title' => 'Account Executive',
                'hire_date' => $today->copy()->subYear()->subMonths(8),
                'legacy_emails' => [],
            ],
            'sales_ops' => [
                'name' => 'Bopha Mao',
                'email' => 'sales.ops@niy.ai',
                'role' => 'staff',
                'department' => 'SALES',
                'manager' => null,
                'employee_code' => 'SALES-102',
                'job_title' => 'Sales Operations Analyst',
                'hire_date' => $today->copy()->subMonths(9),
                'legacy_emails' => [],
            ],
        ])->map(function (array $user) use ($departments, $password) {
            $department = $departments[$user['department']];

            return $this->seedUser($user['email'], $user['employee_code'], [
                'name' => $user['name'],
                'password' => $password,
                'role' => $user['role'],
                'department_id' => $department->id,
                'manager_id' => $user['manager']?->id,
                'job_title' => $user['job_title'],
                'phone' => '+66 80 000 '.substr($user['employee_code'], -3),
                'work_location' => 'Phnom Penh',
                'employment_type' => 'Full-time',
                'emergency_contact_name' => $user['name'].' Emergency',
                'emergency_contact_phone' => '+66 80 999 '.substr($user['employee_code'], -3),
                'bio' => 'Seeded employee profile for demo and QA workflows.',
                'hire_date' => $user['hire_date']->toDateString(),
                'is_active' => true,
            ], $user['legacy_emails']);
        });

        // Assign staff after manager records exist.
        $users['hr_specialist']->update(['manager_id' => $users['hr_manager']->id]);
        $users['it_engineer']->update(['manager_id' => $users['it_manager']->id]);
        $users['it_support']->update(['manager_id' => $users['it_manager']->id]);
        $users['sales_rep']->update(['manager_id' => $users['sales_manager']->id]);
        $users['sales_ops']->update(['manager_id' => $users['sales_manager']->id]);

        // Department ownership drives manager-scoped pages and approvals.
        $departments['HR']->update(['manager_id' => $users['hr_manager']->id]);
        $departments['IT']->update(['manager_id' => $users['it_manager']->id]);
        $departments['SALES']->update(['manager_id' => $users['sales_manager']->id]);

        // Leave policy defaults are reflected in each seeded employee balance.
        $types = collect([
            'annual' => ['name' => 'Annual Leave', 'code' => 'annual', 'default_allowance_days' => 18, 'paid' => true, 'requires_attachment' => false, 'deducts_balance' => true, 'is_active' => true],
            'sick' => ['name' => 'Sick Leave', 'code' => 'sick', 'default_allowance_days' => 5, 'paid' => true, 'requires_attachment' => true, 'deducts_balance' => true, 'is_active' => true],
            'unpaid' => ['name' => 'Unpaid Leave', 'code' => 'unpaid', 'default_allowance_days' => 30, 'paid' => false, 'requires_attachment' => false, 'deducts_balance' => true, 'is_active' => true],
        ])->mapWithKeys(fn (array $type, string $code) => [
            $code => LeaveType::query()->updateOrCreate(['code' => $code], $type),
        ]);

        $this->seedPublicHolidays();

        $allUsers = collect([$ceo, $admin])->merge($users);
        $balanceService = app(LeaveBalanceService::class);

        // Reset seeded balances before replaying seeded requests into used and pending totals.
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

        // Relative offsets keep demo requests clustered around the day the seeder runs.
        $requests = [
            [$users['it_engineer'], 'annual', -18, -16, 'approved', $users['it_manager'], 'Family trip planned before the sprint handoff.'],
            [$users['it_support'], 'sick', -7, -7, 'approved', $users['it_manager'], 'Fever and clinic visit.'],
            [$users['sales_rep'], 'annual', -3, -2, 'approved', $users['sales_manager'], 'Personal appointment and travel time.'],
            [$users['sales_ops'], 'unpaid', -1, -1, 'rejected', $users['sales_manager'], 'Unpaid personal errand requested at short notice.'],
            [$users['hr_specialist'], 'annual', 2, 4, 'pending', $users['hr_manager'], 'Short break after onboarding cycle.'],
            [$users['it_support'], 'annual', 6, 8, 'pending', $users['it_manager'], 'Planned long weekend with family.'],
            [$users['sales_rep'], 'sick', 1, 1, 'pending', $users['sales_manager'], 'Medical checkup follow-up.'],
            [$users['sales_manager'], 'annual', 12, 14, 'approved', $ceo, 'Regional sales planning retreat.'],
            [$users['hr_manager'], 'sick', -24, -23, 'approved', $ceo, 'Doctor advised rest.'],
            [$ceo, 'annual', 20, 21, 'pending', null, 'Board travel buffer.'],
        ];

        // Create matching in-app notifications so seeded accounts show realistic unread state.
        foreach ($requests as [$user, $typeCode, $startOffset, $endOffset, $status, $approver, $reason]) {
            $startsAt = $this->businessDay($today->copy()->addDays($startOffset));
            $endsAt = $this->businessDay($today->copy()->addDays($endOffset));

            if ($endsAt->lt($startsAt)) {
                $endsAt = $startsAt->copy();
            }

            $requestedDays = max(1, $balanceService->workingDays($startsAt->toDateString(), $endsAt->toDateString()));
            $submittedAt = $startsAt->copy()->subDays($status === 'pending' ? 2 : 10)->setTime(9, 0);
            $decidedAt = in_array($status, ['approved', 'rejected'], true)
                ? $submittedAt->copy()->addDay()->setTime(15, 30)
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
                        'approved' => 'Approved in seeded demo data.',
                        'rejected' => 'Rejected in seeded demo data due to coverage needs.',
                        default => null,
                    },
                    'submitted_at' => $submittedAt,
                    'decided_at' => $decidedAt,
                ]
            );

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
                    $leaveRequest->decided_at ? Carbon::parse($leaveRequest->decided_at)->addHour() : null
                );
            }
        }

        // Recalculate aggregate balance columns from the final seeded request set.
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

    }

    private function businessDay(Carbon $date): Carbon
    {
        // Seed fixtures avoid weekends so every request has at least one working day.
        while ($date->isWeekend()) {
            $date->addDay();
        }

        return $date;
    }

    private function seedPublicHolidays(): void
    {
        // Holiday fixtures live outside seeder code so new years can be added as data only.
        foreach (glob(database_path('data/holidays/*.json')) ?: [] as $path) {
            $data = json_decode((string) file_get_contents($path), true);

            if (! is_array($data) || ! isset($data['holidays']) || ! is_array($data['holidays'])) {
                continue;
            }

            foreach ($data['holidays'] as $holiday) {
                if (! isset($holiday['date'], $holiday['name'])) {
                    continue;
                }

                PublicHoliday::query()->updateOrCreate(
                    ['holiday_date' => $holiday['date']],
                    ['name' => $holiday['name'], 'is_active' => true]
                );
            }
        }
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

    /**
     * Keep the seeder rerunnable when older demo accounts used the same employee codes.
     */
    private function seedUser(string $email, string $employeeCode, array $attributes, array $legacyEmails = []): User
    {
        $user = User::query()
            ->where('email', $email)
            ->orWhere('employee_code', $employeeCode)
            ->orWhereIn('email', $legacyEmails)
            ->first();

        if (! $user) {
            return User::query()->create($attributes + [
                'email' => $email,
                'employee_code' => $employeeCode,
            ]);
        }

        $user->fill($attributes + [
            'email' => $email,
            'employee_code' => $employeeCode,
        ]);
        $user->save();

        return $user;
    }
}
