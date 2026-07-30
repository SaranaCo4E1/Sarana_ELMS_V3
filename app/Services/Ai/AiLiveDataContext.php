<?php

namespace App\Services\Ai;

use App\Models\AttendanceDay;
use App\Models\LeaveRequest;
use App\Models\LeaveType;
use App\Models\PublicHoliday;
use App\Models\User;
use App\Services\ReportScope;
use Illuminate\Support\Carbon;
use Throwable;

class AiLiveDataContext
{
    private const MAX_RANGE_DAYS = 366;

    public function __construct(private ReportScope $reportScope) {}

    /**
     * @param  array{id: ?string, name: string, args: array<string, mixed>}  $call
     * @return array{response: array<string, mixed>, metadata: array<string, mixed>}
     */
    public function execute(User $actor, array $call, string $timezone): array
    {
        try {
            return match ($call['name']) {
                'get_leave_roster' => $this->leaveRoster($actor, $call['args'], $timezone),
                'get_attendance_summary' => $this->attendanceSummary($actor, $call['args'], $timezone),
                'get_my_leave_balances' => $this->leaveBalances($actor, $call['args']),
                'get_my_leave_requests' => $this->leaveRequests($actor, $call['args'], $timezone),
                'get_holidays' => $this->holidays($call['args'], $timezone),
                'get_leave_draft_context' => $this->leaveDraftContext($actor, $timezone),
                default => $this->error($call['name'], 'Unsupported function.'),
            };
        } catch (Throwable $exception) {
            report($exception);

            return $this->error($call['name'], 'The requested application data could not be loaded.');
        }
    }

    /**
     * @param  array<string, mixed>  $args
     * @return array{response: array<string, mixed>, metadata: array<string, mixed>}
     */
    private function leaveRoster(User $actor, array $args, string $timezone): array
    {
        $range = $this->range($args, $timezone);

        if ($range === null) {
            return $this->error('get_leave_roster', 'Provide a valid inclusive date range of no more than 366 days.');
        }

        [$startDate, $endDate] = $range;
        $capabilities = $this->reportScope->capabilities($actor);
        $authorizedUsers = User::query()
            ->select('id')
            ->where('is_active', true)
            ->when(
                ! $capabilities['organization'] && $capabilities['team'],
                fn ($query) => $query->where('manager_id', $actor->id),
            )
            ->when(
                ! $capabilities['organization'] && ! $capabilities['team'],
                fn ($query) => $query->whereKey($actor->id),
            );
        $query = LeaveRequest::query()
            ->with(['user:id,name,department_id', 'user.department:id,name'])
            ->whereIn('user_id', $authorizedUsers)
            ->where('status', 'approved')
            ->whereDate('starts_at', '<=', $endDate)
            ->whereDate('ends_at', '>=', $startDate);
        $total = (clone $query)->count();
        $requests = $query
            ->orderBy('starts_at')
            ->orderBy('user_id')
            ->orderBy('id')
            ->limit(100)
            ->get();
        $scope = $capabilities['organization']
            ? 'organization'
            : ($capabilities['team'] ? 'direct_reports' : 'self');
        $records = $requests->map(fn (LeaveRequest $request): array => [
            'employee' => $request->user?->name ?? 'Unknown employee',
            'department' => $request->user?->department?->name ?? 'No department',
            'starts_at' => $request->starts_at->toDateString(),
            'ends_at' => $request->ends_at->toDateString(),
        ])->values()->all();

        return $this->success('get_leave_roster', [
            'scope' => $scope,
            'timezone' => $timezone,
            'start_date' => $startDate->toDateString(),
            'end_date' => $endDate->toDateString(),
            'total_matches' => $total,
            'returned_matches' => count($records),
            'truncated' => $total > count($records),
            'records' => $records,
        ], resultCount: $total);
    }

    /**
     * @param  array<string, mixed>  $args
     * @return array{response: array<string, mixed>, metadata: array<string, mixed>}
     */
    private function attendanceSummary(User $actor, array $args, string $timezone): array
    {
        $range = $this->range($args, $timezone);

        if ($range === null) {
            return $this->error('get_attendance_summary', 'Provide a valid inclusive date range of no more than 366 days.');
        }

        [$startDate, $endDate] = $range;
        $days = AttendanceDay::query()
            ->with(['slots:id,attendance_day_id,status'])
            ->where('user_id', $actor->id)
            ->whereBetween('work_date', [$startDate, $endDate])
            ->whereNull('excuse_type')
            ->whereIn('status', ['complete', 'issues'])
            ->orderBy('work_date')
            ->get(['id', 'work_date', 'status']);
        $lateDays = $days->filter(fn (AttendanceDay $day): bool => $day->slots->contains('status', 'late'));
        $earlyDays = $days->filter(fn (AttendanceDay $day): bool => $day->slots->contains('status', 'early'));
        $missingDays = $days->filter(fn (AttendanceDay $day): bool => $day->slots->contains('status', 'missing'));
        $completeDays = $days->where('status', 'complete')->count();

        return $this->success('get_attendance_summary', [
            'scope' => 'self',
            'employee' => $actor->name,
            'timezone' => $timezone,
            'start_date' => $startDate->toDateString(),
            'end_date' => $endDate->toDateString(),
            'finalized_days' => $days->count(),
            'late_days' => $lateDays->count(),
            'early_days' => $earlyDays->count(),
            'missing_punch_days' => $missingDays->count(),
            'compliance_percent' => $days->isEmpty()
                ? 0
                : round(($completeDays / $days->count()) * 100, 1),
            'late_dates' => $lateDays->pluck('work_date')->map->toDateString()->values()->all(),
        ], resultCount: $days->count());
    }

    /**
     * @param  array<string, mixed>  $args
     * @return array{response: array<string, mixed>, metadata: array<string, mixed>}
     */
    private function leaveBalances(User $actor, array $args): array
    {
        $year = filter_var($args['year'] ?? null, FILTER_VALIDATE_INT);

        if (! is_int($year) || $year < 2000 || $year > 2100) {
            return $this->error('get_my_leave_balances', 'Provide a valid four-digit calendar year.');
        }

        $balances = $actor->leaveBalances()
            ->with('leaveType:id,name,code')
            ->where('year', $year)
            ->get()
            ->map(fn ($balance): array => [
                'leave_type' => $balance->leaveType?->name ?? 'Unknown leave type',
                'code' => $balance->leaveType?->code,
                'available_days' => round((float) $balance->available_days, 2),
                'pending_days' => round((float) $balance->pending_days, 2),
                'used_days' => round((float) $balance->used_days, 2),
                'allowance_days' => round((float) $balance->allowance_days, 2),
                'carried_forward_days' => round((float) $balance->carried_forward_days, 2),
                'adjustment_days' => round((float) $balance->adjustment_days, 2),
            ])
            ->values()
            ->all();

        return $this->success('get_my_leave_balances', [
            'scope' => 'self',
            'employee' => $actor->name,
            'year' => $year,
            'balances' => $balances,
        ], resultCount: count($balances));
    }

    /**
     * @param  array<string, mixed>  $args
     * @return array{response: array<string, mixed>, metadata: array<string, mixed>}
     */
    private function leaveRequests(User $actor, array $args, string $timezone): array
    {
        $range = $this->range($args, $timezone);
        $status = is_string($args['status'] ?? null) ? $args['status'] : 'all';

        if ($range === null || ! in_array($status, ['all', 'pending', 'approved', 'rejected', 'cancelled'], true)) {
            return $this->error('get_my_leave_requests', 'Provide a valid date range and request status.');
        }

        [$startDate, $endDate] = $range;
        $query = $actor->leaveRequests()
            ->with('leaveType:id,name')
            ->whereDate('starts_at', '<=', $endDate)
            ->whereDate('ends_at', '>=', $startDate)
            ->when($status !== 'all', fn ($query) => $query->where('status', $status));
        $total = (clone $query)->count();
        $requests = $query
            ->orderByDesc('starts_at')
            ->orderByDesc('id')
            ->limit(50)
            ->get()
            ->map(fn (LeaveRequest $request): array => [
                'leave_type' => $request->leaveType?->name ?? 'Leave',
                'starts_at' => $request->starts_at->toDateString(),
                'ends_at' => $request->ends_at->toDateString(),
                'requested_days' => round((float) $request->requested_days, 2),
                'status' => $request->status,
                'submitted_at' => $request->submitted_at?->toIso8601String(),
                'decided_at' => $request->decided_at?->toIso8601String(),
            ])
            ->values()
            ->all();

        return $this->success('get_my_leave_requests', [
            'scope' => 'self',
            'employee' => $actor->name,
            'timezone' => $timezone,
            'start_date' => $startDate->toDateString(),
            'end_date' => $endDate->toDateString(),
            'status_filter' => $status,
            'total_matches' => $total,
            'returned_matches' => count($requests),
            'truncated' => $total > count($requests),
            'requests' => $requests,
        ], resultCount: $total);
    }

    /**
     * @param  array<string, mixed>  $args
     * @return array{response: array<string, mixed>, metadata: array<string, mixed>}
     */
    private function holidays(array $args, string $timezone): array
    {
        $range = $this->range($args, $timezone);

        if ($range === null) {
            return $this->error('get_holidays', 'Provide a valid inclusive date range of no more than 366 days.');
        }

        [$startDate, $endDate] = $range;
        $holidays = PublicHoliday::query()
            ->where('is_active', true)
            ->whereBetween('holiday_date', [$startDate, $endDate])
            ->orderBy('holiday_date')
            ->limit(100)
            ->get(['name', 'holiday_date'])
            ->map(fn (PublicHoliday $holiday): array => [
                'date' => $holiday->holiday_date->toDateString(),
                'name' => $holiday->name,
            ])
            ->all();

        return $this->success('get_holidays', [
            'timezone' => $timezone,
            'start_date' => $startDate->toDateString(),
            'end_date' => $endDate->toDateString(),
            'holidays' => $holidays,
        ], resultCount: count($holidays));
    }

    /**
     * @return array{response: array<string, mixed>, metadata: array<string, mixed>}
     */
    private function leaveDraftContext(User $actor, string $timezone): array
    {
        $now = now($timezone);
        $leaveTypes = LeaveType::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->get()
            ->map(fn (LeaveType $type): array => [
                'name' => $type->name,
                'code' => $type->code,
                'default_allowance_days' => round((float) $type->default_allowance_days, 2),
                'paid' => $type->paid,
                'requires_attachment' => $type->requires_attachment,
                'deducts_balance' => $type->deducts_balance,
            ])
            ->values()
            ->all();
        $balances = $actor->leaveBalances()
            ->with('leaveType:id,name')
            ->where('year', $now->year)
            ->get()
            ->map(fn ($balance): array => [
                'leave_type' => $balance->leaveType?->name ?? 'Unknown leave type',
                'available_days' => round((float) $balance->available_days, 2),
                'pending_days' => round((float) $balance->pending_days, 2),
                'used_days' => round((float) $balance->used_days, 2),
            ])
            ->values()
            ->all();
        $holidays = PublicHoliday::query()
            ->where('is_active', true)
            ->whereDate('holiday_date', '>=', $now->toDateString())
            ->orderBy('holiday_date')
            ->limit(12)
            ->get(['name', 'holiday_date'])
            ->map(fn (PublicHoliday $holiday): array => [
                'date' => $holiday->holiday_date->toDateString(),
                'name' => $holiday->name,
            ])
            ->all();
        $recentRequests = $actor->leaveRequests()
            ->with('leaveType:id,name')
            ->latest()
            ->limit(5)
            ->get()
            ->map(fn (LeaveRequest $request): array => [
                'leave_type' => $request->leaveType?->name ?? 'Leave',
                'starts_at' => $request->starts_at->toDateString(),
                'ends_at' => $request->ends_at->toDateString(),
                'requested_days' => round((float) $request->requested_days, 2),
                'status' => $request->status,
            ])
            ->values()
            ->all();

        return $this->success('get_leave_draft_context', [
            'scope' => 'self',
            'employee' => $actor->name,
            'timezone' => $timezone,
            'current_date' => $now->toDateString(),
            'leave_types' => $leaveTypes,
            'current_year_balances' => $balances,
            'upcoming_holidays' => $holidays,
            'recent_requests' => $recentRequests,
        ], resultCount: count($leaveTypes) + count($balances) + count($holidays) + count($recentRequests));
    }

    /**
     * @param  array<string, mixed>  $args
     * @return array{Carbon, Carbon}|null
     */
    private function range(array $args, string $timezone): ?array
    {
        $startDate = $args['start_date'] ?? null;
        $endDate = $args['end_date'] ?? null;

        if (! is_string($startDate) || ! is_string($endDate)) {
            return null;
        }

        try {
            $start = Carbon::createFromFormat('!Y-m-d', $startDate, $timezone)->startOfDay();
            $end = Carbon::createFromFormat('!Y-m-d', $endDate, $timezone)->startOfDay();
        } catch (Throwable) {
            return null;
        }

        if ($start->toDateString() !== $startDate
            || $end->toDateString() !== $endDate
            || $end->lt($start)
            || ($start->diffInDays($end) + 1) > self::MAX_RANGE_DAYS) {
            return null;
        }

        return [$start, $end];
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array{response: array<string, mixed>, metadata: array<string, mixed>}
     */
    private function success(string $tool, array $data, int $resultCount): array
    {
        return [
            'response' => [
                'ok' => true,
                'tool' => $tool,
                'as_of' => now()->toIso8601String(),
                'data' => $data,
            ],
            'metadata' => [
                'tool' => $tool,
                'ok' => true,
                'result_count' => $resultCount,
            ],
        ];
    }

    /**
     * @return array{response: array<string, mixed>, metadata: array<string, mixed>}
     */
    private function error(string $tool, string $message): array
    {
        return [
            'response' => [
                'ok' => false,
                'tool' => $tool,
                'error' => $message,
            ],
            'metadata' => [
                'tool' => $tool,
                'ok' => false,
                'result_count' => 0,
            ],
        ];
    }
}
