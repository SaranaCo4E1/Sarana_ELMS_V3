<?php

namespace App\Services;

use App\Data\ReportFilters;
use App\Models\AttendanceDay;
use App\Models\AttendanceSite;
use App\Models\LeaveBalance;
use App\Models\LeaveRequest;
use App\Models\LeaveType;
use App\Models\PublicHoliday;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

class ReportAnalyticsService
{
    public function __construct(private readonly ReportScope $scope) {}

    public function build(User $actor, ReportFilters $filters): array
    {
        $resolved = $this->scope->resolve($actor, $filters);
        $baseUsers = $resolved['base'];
        $users = $resolved['users'];
        $userIds = $users->pluck('id');
        $baseUserIds = $baseUsers->pluck('id');

        $leaveTypes = LeaveType::query()
            ->orderBy('name')
            ->get(['id', 'name', 'code', 'paid', 'deducts_balance']);
        $this->assertSubset($filters->leaveTypeIds, $leaveTypes->pluck('id'));

        $sites = AttendanceSite::query()
            ->whereIn('id', AttendanceDay::query()
                ->whereIn('user_id', $baseUserIds)
                ->whereNotNull('primary_site_id')
                ->select('primary_site_id'))
            ->orderBy('name')
            ->get(['id', 'name']);
        $this->assertSubset($filters->siteIds, $sites->pluck('id'));

        $holidays = PublicHoliday::query()
            ->where('is_active', true)
            ->whereBetween('holiday_date', [$filters->startDate, $filters->endDate])
            ->pluck('holiday_date')
            ->map(fn ($date) => Carbon::parse($date)->toDateString())
            ->flip();

        $leaveRequests = LeaveRequest::query()
            ->with(['user:id,name,department_id', 'user.department:id,name', 'leaveType:id,name,code,paid'])
            ->whereIn('user_id', $userIds)
            ->whereDate('starts_at', '<=', $filters->endDate)
            ->whereDate('ends_at', '>=', $filters->startDate)
            ->when($filters->leaveTypeIds, fn ($query) => $query->whereIn('leave_type_id', $filters->leaveTypeIds))
            ->when($filters->leaveStatuses, fn ($query) => $query->whereIn('status', $filters->leaveStatuses))
            ->orderBy('starts_at')
            ->get();

        $balanceYear = (int) $filters->endDate->year;
        $balances = LeaveBalance::query()
            ->with(['user:id,name,department_id', 'user.department:id,name', 'leaveType:id,name,code,paid'])
            ->whereIn('user_id', $userIds)
            ->where('year', $balanceYear)
            ->when($filters->leaveTypeIds, fn ($query) => $query->whereIn('leave_type_id', $filters->leaveTypeIds))
            ->get();

        $attendanceDays = AttendanceDay::query()
            ->with([
                'user:id,name,department_id',
                'user.department:id,name',
                'primarySite:id,name',
                'slots.event:id,effective_at',
                'events' => fn ($query) => $query
                    ->whereNull('voided_at')
                    ->select(['id', 'attendance_day_id', 'effective_at', 'verification_status', 'reviewed_at', 'voided_at']),
            ])
            ->whereIn('user_id', $userIds)
            ->whereBetween('work_date', [$filters->startDate, $filters->endDate])
            ->whereNull('excuse_type')
            ->whereIn('status', ['complete', 'issues'])
            ->when($filters->attendanceStatuses, fn ($query) => $query->whereIn('status', $filters->attendanceStatuses))
            ->when($filters->siteIds, fn ($query) => $query->whereIn('primary_site_id', $filters->siteIds))
            ->orderBy('work_date')
            ->get();

        $leave = $this->leaveAnalytics($leaveRequests, $balances, $filters, $holidays);
        $attendance = $this->attendanceAnalytics($attendanceDays, $filters);
        $details = $this->detailRows($users, $leaveRequests, $balances, $attendanceDays, $filters, $holidays);

        return [
            'capabilities' => $resolved['capabilities'],
            'scope' => $resolved['scope'],
            'filters' => $filters->toArray(),
            'filterOptions' => $this->filterOptions($baseUsers, $leaveTypes, $sites),
            'summary' => [
                'employees' => $users->count(),
                'approved_leave_days' => $leave['summary']['approved_days'],
                'pending_leave_days' => $leave['summary']['pending_days'],
                'available_balance' => $leave['summary']['available_balance'],
                'attendance_compliance' => $attendance['summary']['compliance'],
                'late' => $attendance['summary']['late'],
                'early' => $attendance['summary']['early'],
                'missing' => $attendance['summary']['missing'],
                'unresolved_flags' => $attendance['summary']['unresolved_flags'],
            ],
            'leave' => $leave,
            'attendance' => $attendance,
            'details' => $details,
        ];
    }

    public function scopedUsers(User $actor, ReportFilters $filters): Collection
    {
        return $this->scope->resolve($actor, $filters)['users'];
    }

    public function workingDaysWithin(LeaveRequest $request, ReportFilters $filters, Collection $holidays): float
    {
        $start = Carbon::parse($request->starts_at)->max($filters->startDate)->startOfDay();
        $end = Carbon::parse($request->ends_at)->min($filters->endDate)->startOfDay();
        $days = 0.0;

        for ($date = $start->copy(); $date->lte($end); $date->addDay()) {
            if (! $date->isWeekend() && ! $holidays->has($date->toDateString())) {
                $days++;
            }
        }

        return $days;
    }

    private function filterOptions(Collection $users, Collection $leaveTypes, Collection $sites): array
    {
        $employees = $users->map(fn (User $user) => [
            'id' => $user->id,
            'name' => $user->name,
            'employee_code' => $user->employee_code,
            'department_id' => $user->department_id,
            'manager_id' => $user->manager_id,
            'role' => $user->role,
            'is_active' => $user->is_active,
        ])->values();

        return [
            'employees' => $employees,
            'departments' => $users->filter->department
                ->map(fn (User $user) => ['id' => $user->department->id, 'name' => $user->department->name])
                ->unique('id')->sortBy('name')->values(),
            'managers' => $users->filter->manager
                ->map(fn (User $user) => ['id' => $user->manager->id, 'name' => $user->manager->name])
                ->unique('id')->sortBy('name')->values(),
            'roles' => $users->pluck('role')->filter()->unique()->sort()->values(),
            'leave_types' => $leaveTypes->map(fn (LeaveType $type) => [
                'id' => $type->id,
                'name' => $type->name,
                'code' => $type->code,
                'paid' => $type->paid,
            ])->values(),
            'sites' => $sites->values(),
        ];
    }

    private function leaveAnalytics(
        Collection $requests,
        Collection $balances,
        ReportFilters $filters,
        Collection $holidays
    ): array {
        $buckets = $this->emptyBuckets($filters, ['approved', 'pending', 'rejected', 'cancelled']);
        $status = collect(['approved', 'pending', 'rejected', 'cancelled'])
            ->mapWithKeys(fn ($key) => [$key => ['name' => ucfirst($key), 'count' => 0, 'days' => 0.0]])
            ->all();
        $types = [];
        $concurrentByDate = [];

        for ($date = $filters->startDate->copy(); $date->lte($filters->endDate); $date->addDay()) {
            if (! $date->isWeekend() && ! $holidays->has($date->toDateString())) {
                $concurrentByDate[$date->toDateString()] = [];
            }
        }

        foreach ($requests as $request) {
            $days = $this->workingDaysWithin($request, $filters, $holidays);
            $status[$request->status]['count']++;
            $status[$request->status]['days'] += $days;
            $typeName = $request->leaveType?->name ?? 'Unknown';
            $types[$typeName] ??= ['name' => $typeName, 'count' => 0, 'days' => 0.0];
            $types[$typeName]['count']++;
            $types[$typeName]['days'] += $days;

            $start = Carbon::parse($request->starts_at)->max($filters->startDate)->startOfDay();
            $end = Carbon::parse($request->ends_at)->min($filters->endDate)->startOfDay();
            for ($date = $start->copy(); $date->lte($end); $date->addDay()) {
                if ($date->isWeekend() || $holidays->has($date->toDateString())) {
                    continue;
                }
                $bucket = $this->bucketKey($date, $filters);
                $buckets[$bucket]['values'][$request->status] += 1;
                if ($request->status === 'approved') {
                    $concurrentByDate[$date->toDateString()][$request->user_id] = true;
                }
            }
        }

        $balanceByType = $balances->groupBy(fn (LeaveBalance $balance) => $balance->leaveType?->name ?? 'Unknown')
            ->map(function (Collection $rows, string $name): array {
                $entitlement = $rows->sum(fn (LeaveBalance $row) => (float) $row->allowance_days + (float) $row->carried_forward_days + (float) $row->adjustment_days);
                $used = (float) $rows->sum('used_days');
                $pending = (float) $rows->sum('pending_days');
                $available = (float) $rows->sum(fn (LeaveBalance $row) => $row->available_days);

                return [
                    'name' => $name,
                    'entitlement' => round($entitlement, 2),
                    'used' => round($used, 2),
                    'pending' => round($pending, 2),
                    'available' => round($available, 2),
                    'utilization' => $entitlement > 0 ? round(($used / $entitlement) * 100, 1) : 0,
                ];
            })->values();

        $employeeBalances = $balances->groupBy('user_id')->map(function (Collection $rows): array {
            $entitlement = $rows->sum(fn (LeaveBalance $row) => (float) $row->allowance_days + (float) $row->carried_forward_days + (float) $row->adjustment_days);
            $used = (float) $rows->sum('used_days');

            return [
                'user_id' => $rows->first()->user_id,
                'name' => $rows->first()->user?->name ?? 'Unknown',
                'department' => $rows->first()->user?->department?->name ?? 'Unassigned',
                'used' => round($used, 2),
                'available' => round((float) $rows->sum(fn (LeaveBalance $row) => $row->available_days), 2),
                'utilization' => $entitlement > 0 ? round(($used / $entitlement) * 100, 1) : 0,
            ];
        })->sortByDesc('used')->values();

        $rankings = $requests->where('status', 'approved')->groupBy('user_id')->map(function (Collection $rows) use ($filters, $holidays): array {
            return [
                'user_id' => $rows->first()->user_id,
                'name' => $rows->first()->user?->name ?? 'Unknown',
                'department' => $rows->first()->user?->department?->name ?? 'Unassigned',
                'days' => round($rows->sum(fn (LeaveRequest $request) => $this->workingDaysWithin($request, $filters, $holidays)), 2),
            ];
        })->sortByDesc('days')->values();

        return [
            'balance_year' => (int) $filters->endDate->year,
            'summary' => [
                'approved_days' => round((float) ($status['approved']['days'] ?? 0), 2),
                'pending_days' => round((float) ($status['pending']['days'] ?? 0), 2),
                'available_balance' => round((float) $balances
                    ->filter(fn (LeaveBalance $balance) => $balance->leaveType?->paid)
                    ->sum(fn (LeaveBalance $balance) => $balance->available_days), 2),
            ],
            'trend' => array_values($buckets),
            'status' => array_values($status),
            'types' => array_values($types),
            'balances' => $balanceByType,
            'employee_balances' => $employeeBalances,
            'rankings' => $rankings,
            'concurrency_distribution' => collect([
                '0 absent' => fn (int $employees): bool => $employees === 0,
                '1 absent' => fn (int $employees): bool => $employees === 1,
                '2 absent' => fn (int $employees): bool => $employees === 2,
                '3+ absent' => fn (int $employees): bool => $employees >= 3,
            ])->map(function (callable $matches, string $name) use ($concurrentByDate): array {
                return [
                    'name' => $name,
                    'days' => collect($concurrentByDate)
                        ->map(fn (array $users): int => count($users))
                        ->filter($matches)
                        ->count(),
                ];
            })->values(),
        ];
    }

    private function attendanceAnalytics(Collection $days, ReportFilters $filters): array
    {
        $buckets = $this->emptyBuckets($filters, ['complete', 'issues']);
        $issues = ['late' => 0, 'early' => 0, 'missing' => 0, 'flagged' => 0];
        $unresolvedFlags = 0;
        $heatmap = [];

        foreach ($days as $day) {
            $bucket = $this->bucketKey(Carbon::parse($day->work_date), $filters);
            if (array_key_exists($day->status, $buckets[$bucket]['values'])) {
                $buckets[$bucket]['values'][$day->status]++;
            }
            $date = Carbon::parse($day->work_date)->toDateString();
            $heatmap[$date] ??= ['date' => $date, 'records' => 0, 'issues' => 0];
            $heatmap[$date]['records']++;
            $heatmap[$date]['issues'] += $day->status === 'issues' ? 1 : 0;

            foreach (['late', 'early', 'missing'] as $issue) {
                if ($day->slots->contains('status', $issue)) {
                    $issues[$issue]++;
                }
            }

            $flagged = $day->events->where('verification_status', 'flagged');
            $issues['flagged'] += $flagged->count();
            $unresolvedFlags += $flagged->whereNull('reviewed_at')->count();
        }

        foreach ($buckets as &$bucket) {
            $denominator = $bucket['values']['complete'] + $bucket['values']['issues'];
            $bucket['compliance'] = $denominator > 0
                ? round(($bucket['values']['complete'] / $denominator) * 100, 1)
                : 0;
        }
        unset($bucket);

        $complete = $days->where('status', 'complete')->count();
        $issueDays = $days->where('status', 'issues')->count();
        $denominator = $complete + $issueDays;

        $employeeStats = $days->groupBy('user_id')->map(function (Collection $records): array {
            $complete = $records->where('status', 'complete')->count();
            $issueDays = $records->where('status', 'issues')->count();
            $denominator = $complete + $issueDays;

            return [
                'user_id' => $records->first()->user_id,
                'name' => $records->first()->user?->name ?? 'Unknown',
                'department' => $records->first()->user?->department?->name ?? 'Unassigned',
                'compliance' => $denominator > 0 ? round(($complete / $denominator) * 100, 1) : 0,
                'complete' => $complete,
                'issues' => $issueDays,
                'late' => $this->countDaysWithSlotStatus($records, 'late'),
                'early' => $this->countDaysWithSlotStatus($records, 'early'),
                'missing' => $this->countDaysWithSlotStatus($records, 'missing'),
                'records' => $records->count(),
            ];
        })->sortByDesc(fn (array $row) => $row['late'] + $row['missing'])->values();

        $departments = $days->groupBy(fn (AttendanceDay $day) => $day->user?->department?->name ?? 'Unassigned')
            ->map(function (Collection $records, string $name): array {
                $complete = $records->where('status', 'complete')->count();
                $issueDays = $records->where('status', 'issues')->count();
                $denominator = $complete + $issueDays;

                return [
                    'name' => $name,
                    'compliance' => $denominator > 0 ? round(($complete / $denominator) * 100, 1) : 0,
                    'late' => $this->countDaysWithSlotStatus($records, 'late'),
                    'early' => $this->countDaysWithSlotStatus($records, 'early'),
                    'missing' => $this->countDaysWithSlotStatus($records, 'missing'),
                ];
            })->values();

        return [
            'summary' => [
                'compliance' => $denominator > 0 ? round(($complete / $denominator) * 100, 1) : 0,
                'complete' => $complete,
                'issues' => $issueDays,
                'late' => $issues['late'],
                'early' => $issues['early'],
                'missing' => $issues['missing'],
                'unresolved_flags' => $unresolvedFlags,
            ],
            'trend' => array_values($buckets),
            'heatmap' => array_values($heatmap),
            'issue_mix' => collect($issues)->map(fn (int $value, string $name) => [
                'name' => match ($name) {
                    'late' => 'Late-in days',
                    'early' => 'Early-out days',
                    'missing' => 'Missing-punch days',
                    default => ucfirst($name),
                },
                'value' => $value,
            ])->values(),
            'employees' => $employeeStats,
            'departments' => $departments,
        ];
    }

    private function detailRows(
        Collection $users,
        Collection $requests,
        Collection $balances,
        Collection $days,
        ReportFilters $filters,
        Collection $holidays
    ): array {
        $rows = $users->map(function (User $user) use ($requests, $balances, $days, $filters, $holidays): array {
            $userRequests = $requests->where('user_id', $user->id)->where('status', 'approved');
            $userBalances = $balances->where('user_id', $user->id);
            $userDays = $days->where('user_id', $user->id);
            $complete = $userDays->where('status', 'complete')->count();
            $issues = $userDays->where('status', 'issues')->count();
            $denominator = $complete + $issues;

            return [
                'id' => $user->id,
                'name' => $user->name,
                'employee_code' => $user->employee_code,
                'department' => $user->department?->name ?? 'Unassigned',
                'role' => $user->role,
                'leave_days' => round($userRequests->sum(fn (LeaveRequest $request) => $this->workingDaysWithin($request, $filters, $holidays)), 2),
                'used_balance' => round((float) $userBalances->sum('used_days'), 2),
                'available_balance' => round((float) $userBalances->sum(fn (LeaveBalance $balance) => $balance->available_days), 2),
                'attendance_compliance' => $denominator > 0 ? round(($complete / $denominator) * 100, 1) : 0,
                'late' => $this->countDaysWithSlotStatus($userDays, 'late'),
                'early' => $this->countDaysWithSlotStatus($userDays, 'early'),
                'missing' => $this->countDaysWithSlotStatus($userDays, 'missing'),
            ];
        });

        $sortKey = $filters->sort === 'name' ? 'name' : $filters->sort;
        $rows = $filters->direction === 'desc'
            ? $rows->sortByDesc($sortKey, SORT_NATURAL | SORT_FLAG_CASE)
            : $rows->sortBy($sortKey, SORT_NATURAL | SORT_FLAG_CASE);

        $total = $rows->count();
        $lastPage = max(1, (int) ceil($total / $filters->perPage));
        $page = min($filters->page, $lastPage);

        return [
            'data' => $rows->slice(($page - 1) * $filters->perPage, $filters->perPage)->values(),
            'page' => $page,
            'per_page' => $filters->perPage,
            'total' => $total,
            'last_page' => $lastPage,
        ];
    }

    private function countDaysWithSlotStatus(Collection $days, string $status): int
    {
        return $days->filter(
            fn (AttendanceDay $day): bool => $day->slots->contains('status', $status)
        )->count();
    }

    private function emptyBuckets(ReportFilters $filters, array $keys): array
    {
        $buckets = [];
        for ($date = $filters->startDate->copy(); $date->lte($filters->endDate); $date->addDay()) {
            $key = $this->bucketKey($date, $filters);
            if (! isset($buckets[$key])) {
                $buckets[$key] = [
                    'key' => $key,
                    'label' => $this->bucketLabel($date, $filters),
                    'values' => array_fill_keys($keys, 0),
                ];
            }
        }

        return $buckets;
    }

    private function bucketKey(Carbon $date, ReportFilters $filters): string
    {
        $days = $filters->startDate->diffInDays($filters->endDate) + 1;

        return match (true) {
            $days <= 31 => $date->format('Y-m-d'),
            $days <= 180 => $date->copy()->startOfWeek()->format('Y-m-d'),
            default => $date->format('Y-m'),
        };
    }

    private function bucketLabel(Carbon $date, ReportFilters $filters): string
    {
        $days = $filters->startDate->diffInDays($filters->endDate) + 1;

        return match (true) {
            $days <= 31 => $date->format('M j'),
            $days <= 180 => 'Week of '.$date->copy()->startOfWeek()->format('M j'),
            default => $date->format('M Y'),
        };
    }

    private function assertSubset(array $requested, Collection $allowed): void
    {
        if (! $requested) {
            return;
        }

        $allowedValues = $allowed->map(fn ($value) => (int) $value)->unique()->values()->all();
        abort_if(collect($requested)->contains(fn ($value) => ! in_array((int) $value, $allowedValues, true)), 403);
    }
}
