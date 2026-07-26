<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\LeaveBalance;
use App\Models\LeaveRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    public function monthly(Request $request): StreamedResponse
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

        $rows = LeaveRequest::query()
            ->with(['user.department', 'leaveType', 'approver', 'attachments'])
            ->whereBetween('starts_at', [$startDate, $endDate])
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->get();

        $filename = ($startMonth === $endMonth)
            ? 'leave-report-'.$startMonth.'.csv'
            : 'leave-report-'.$startMonth.'-to-'.$endMonth.'.csv';

        return response()->streamDownload(function () use ($rows) {
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
                'Metadata',
            ]);

            foreach ($rows as $row) {
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
                    $row->metadata ? json_encode($row->metadata) : '',
                ]);
            }
            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv']);
    }
}
