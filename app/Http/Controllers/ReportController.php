<?php

namespace App\Http\Controllers;

use App\Http\Requests\ReportRequest;
use App\Models\AttendanceDay;
use App\Models\AuditLog;
use App\Models\LeaveBalance;
use App\Models\LeaveRequest;
use App\Models\PublicHoliday;
use App\Services\ReportAnalyticsService;
use App\Services\ReportScope;
use App\Support\Audit;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    public function index(ReportRequest $request, ReportAnalyticsService $reports): Response
    {
        return Inertia::render('Reports', $reports->build($request->user(), $request->filters()));
    }

    public function exportLeave(
        ReportRequest $request,
        ReportAnalyticsService $reports,
        ReportScope $scope
    ): StreamedResponse {
        $filters = $request->filters();
        $resolved = $scope->resolve($request->user(), $filters);
        $userIds = $resolved['users']->pluck('id');
        $holidays = $this->holidays($filters->startDate, $filters->endDate);

        $rows = LeaveRequest::query()
            ->with(['user.department', 'leaveType', 'approver', 'attachments'])
            ->whereIn('user_id', $userIds)
            ->whereDate('starts_at', '<=', $filters->endDate)
            ->whereDate('ends_at', '>=', $filters->startDate)
            ->when($filters->leaveTypeIds, fn ($query) => $query->whereIn('leave_type_id', $filters->leaveTypeIds))
            ->when($filters->leaveStatuses, fn ($query) => $query->whereIn('status', $filters->leaveStatuses))
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->get();

        Audit::record($request, 'report.leave.exported', null, [
            'scope' => $resolved['scope'],
            'filters' => $filters->toArray(),
            'row_count' => $rows->count(),
        ]);

        $filename = sprintf(
            'leave-report-%s-to-%s.csv',
            $filters->startDate->toDateString(),
            $filters->endDate->toDateString(),
        );

        return response()->streamDownload(function () use ($rows, $reports, $filters, $holidays) {
            $out = fopen('php://output', 'w');
            fputcsv($out, [
                'Leave Request ID',
                'Employee ID',
                'Employee Name',
                'Employee Code',
                'Department',
                'Leave Type ID',
                'Leave Type',
                'Start Date',
                'End Date',
                'Requested Days',
                'Days In Selected Period',
                'Status',
                'Approver ID',
                'Approver Name',
                'Reason',
                'Manager Comment',
                'Attachments',
                'Submitted At',
                'Decided At',
                'Created At',
                'Updated At',
            ]);

            foreach ($rows as $row) {
                $days = (float) $row->requested_days;
                $daysFormatted = ($days == (int) $days) ? (int) $days : $days;
                $inRangeDays = $reports->workingDaysWithin($row, $filters, $holidays);
                $attachmentsList = $row->attachments->pluck('original_name')->implode(', ');

                fputcsv($out, [
                    $row->id,
                    $row->user_id,
                    $row->user?->name,
                    $row->user?->employee_code,
                    $row->user?->department?->name,
                    $row->leave_type_id,
                    $row->leaveType?->name,
                    $row->starts_at?->toDateString(),
                    $row->ends_at?->toDateString(),
                    $daysFormatted,
                    $inRangeDays,
                    ucfirst($row->status),
                    $row->approver_id,
                    $row->approver?->name,
                    $row->reason,
                    $row->manager_comment,
                    $attachmentsList,
                    $row->submitted_at?->toDateTimeString(),
                    $row->decided_at?->toDateTimeString(),
                    $row->created_at?->toDateTimeString(),
                    $row->updated_at?->toDateTimeString(),
                ]);
            }
            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv']);
    }

    public function exportAttendance(ReportRequest $request, ReportScope $scope): StreamedResponse
    {
        $filters = $request->filters();
        $resolved = $scope->resolve($request->user(), $filters);

        $rows = AttendanceDay::query()
            ->with(['user.department', 'slots.event', 'events'])
            ->whereIn('user_id', $resolved['users']->pluck('id'))
            ->whereBetween('work_date', [$filters->startDate, $filters->endDate])
            ->whereNull('excuse_type')
            ->whereIn('status', ['complete', 'issues'])
            ->when($filters->attendanceStatuses, fn ($query) => $query->whereIn('status', $filters->attendanceStatuses))
            ->when($filters->attendanceIssues, fn ($query) => $query->whereHas(
                'slots',
                fn ($slotQuery) => $slotQuery->whereIn('status', $filters->attendanceIssues)
            ))
            ->orderByDesc('work_date')
            ->orderBy('user_id')
            ->get();

        Audit::record($request, 'report.attendance.exported', null, [
            'scope' => $resolved['scope'],
            'filters' => $filters->toArray(),
            'row_count' => $rows->count(),
        ]);

        $filename = sprintf(
            'attendance-report-%s-to-%s.csv',
            $filters->startDate->toDateString(),
            $filters->endDate->toDateString(),
        );

        return response()->streamDownload(function () use ($rows) {
            $out = fopen('php://output', 'w');
            fputcsv($out, [
                'Employee ID',
                'Employee Name',
                'Employee Code',
                'Department',
                'Work Date',
                'Status',
                'Morning In',
                'Morning In Status',
                'Lunch Out',
                'Lunch Out Status',
                'Lunch In',
                'Lunch In Status',
                'Final Out',
                'Final Out Status',
                'Unresolved Flags',
            ]);

            foreach ($rows as $day) {
                $slots = $day->slots->keyBy('type');
                $value = fn (string $type) => $slots[$type]?->event?->effective_at
                    ? $slots[$type]->event->effective_at->setTimezone($day->timezone)->format('H:i:s')
                    : null;
                fputcsv($out, [
                    $day->user_id,
                    $day->user?->name,
                    $day->user?->employee_code,
                    $day->user?->department?->name,
                    $day->work_date?->toDateString(),
                    ucfirst($day->status),
                    $value('morning_in'),
                    self::attendanceSlotStatus($slots['morning_in']?->status),
                    $value('lunch_out'),
                    self::attendanceSlotStatus($slots['lunch_out']?->status),
                    $value('lunch_in'),
                    self::attendanceSlotStatus($slots['lunch_in']?->status),
                    $value('final_out'),
                    self::attendanceSlotStatus($slots['final_out']?->status),
                    $day->events->where('verification_status', 'flagged')->whereNull('reviewed_at')->count(),
                ]);
            }
            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv']);
    }

    public function monthly(
        ReportRequest $request,
        ReportAnalyticsService $reports,
        ReportScope $scope
    ): StreamedResponse {
        return $this->exportLeave($request, $reports, $scope);
    }

    public function auditLogs(Request $request): StreamedResponse
    {
        $data = $request->validate([
            'month' => ['nullable', 'date_format:Y-m'],
            'start_month' => ['nullable', 'date_format:Y-m', 'required_without:month'],
            'end_month' => ['nullable', 'date_format:Y-m', 'required_without:month'],
        ]);

        $startMonth = $data['start_month'] ?? $data['month'] ?? null;
        $endMonth = $data['end_month'] ?? $data['month'] ?? null;

        if (! $startMonth || ! $endMonth) {
            abort(422, 'Invalid date range parameters.');
        }

        $startDate = Carbon::parse($startMonth)->startOfMonth();
        $endDate = Carbon::parse($endMonth)->endOfMonth();

        $rows = AuditLog::query()
            ->with([
                'actor',
                'subject' => function ($morphTo) {
                    $morphTo->morphWith([
                        LeaveRequest::class => ['user', 'leaveType'],
                        LeaveBalance::class => ['user', 'leaveType'],
                    ]);
                },
            ])
            ->whereBetween('created_at', [$startDate, $endDate])
            ->orderBy('created_at')
            ->get();

        Audit::record($request, 'report.audit_logs.exported', null, [
            'start_month' => $startMonth,
            'end_month' => $endMonth,
            'row_count' => $rows->count(),
        ]);

        $filename = ($startMonth === $endMonth)
            ? 'audit-trail-report-'.$startMonth.'.csv'
            : 'audit-trail-report-'.$startMonth.'-to-'.$endMonth.'.csv';

        return response()->streamDownload(function () use ($rows) {
            $out = fopen('php://output', 'w');
            fputcsv($out, [
                'Log ID',
                'Timestamp',
                'Actor ID',
                'Actor Name',
                'Actor Email',
                'Actor Role',
                'Action',
                'Description',
                'Subject Type',
                'Subject Type Short',
                'Subject ID',
                'IP Address',
                'Changed Fields',
                'Before Values',
                'After Values',
                'Reason / Note',
                'Request Method',
                'Request Route',
                'User Agent',
                'Metadata',
            ]);

            foreach ($rows as $row) {
                $changes = collect($row->metadata['changes'] ?? []);
                $reason = $row->metadata['reason']
                    ?? $row->metadata['decision_reason']
                    ?? $row->metadata['note']
                    ?? '';
                $requestContext = $row->metadata['request'] ?? [];

                fputcsv($out, [
                    $row->id,
                    $row->created_at?->toDateTimeString(),
                    $row->actor_id,
                    $row->actor?->name,
                    $row->actor?->email,
                    $row->actor?->getFormattedRole() ?? 'System',
                    $row->action,
                    $row->formatDescription(),
                    $row->subject_type,
                    $row->subject_type ? class_basename($row->subject_type) : '',
                    $row->subject_id,
                    $row->ip_address,
                    $changes->pluck('label')->filter()->implode('; '),
                    $changes->map(fn ($change) => ($change['label'] ?? $change['field']).': '.self::csvAuditValue($change['from'] ?? null))->implode('; '),
                    $changes->map(fn ($change) => ($change['label'] ?? $change['field']).': '.self::csvAuditValue($change['to'] ?? null))->implode('; '),
                    $reason,
                    $requestContext['method'] ?? '',
                    $requestContext['route'] ?? '',
                    $requestContext['user_agent'] ?? '',
                    $row->metadata ? json_encode($row->metadata) : '',
                ]);
            }
            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv']);
    }

    private static function csvAuditValue(mixed $value): string
    {
        if ($value === null || $value === '') {
            return 'Not set';
        }

        if (is_bool($value)) {
            return $value ? 'Yes' : 'No';
        }

        if (is_array($value)) {
            return implode(', ', array_map([self::class, 'csvAuditValue'], $value));
        }

        return (string) $value;
    }

    private static function attendanceSlotStatus(?string $status): ?string
    {
        return match ($status) {
            'late' => 'Late in',
            'early' => 'Early out',
            default => $status,
        };
    }

    private function holidays(Carbon $startDate, Carbon $endDate): Collection
    {
        return PublicHoliday::query()
            ->where('is_active', true)
            ->whereBetween('holiday_date', [$startDate, $endDate])
            ->pluck('holiday_date')
            ->map(fn ($date) => Carbon::parse($date)->toDateString())
            ->flip();
    }
}
