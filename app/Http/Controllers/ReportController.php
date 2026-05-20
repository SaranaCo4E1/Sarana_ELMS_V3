<?php

namespace App\Http\Controllers;

use App\Models\LeaveRequest;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    public function monthly(Request $request): StreamedResponse
    {
        $data = $request->validate([
            'month' => ['required', 'date_format:Y-m'],
        ]);

        [$year, $month] = explode('-', $data['month']);
        $rows = LeaveRequest::query()
            ->with(['user.department', 'leaveType', 'approver'])
            ->whereYear('starts_at', $year)
            ->whereMonth('starts_at', $month)
            ->orderBy('starts_at')
            ->get();

        return response()->streamDownload(function () use ($rows) {
            $out = fopen('php://output', 'w');
            fputcsv($out, ['Employee', 'Department', 'Leave Type', 'Start', 'End', 'Days', 'Status', 'Approver', 'Reason']);
            foreach ($rows as $row) {
                fputcsv($out, [
                    $row->user->name,
                    $row->user->department?->name,
                    $row->leaveType->name,
                    $row->starts_at->toDateString(),
                    $row->ends_at->toDateString(),
                    $row->requested_days,
                    $row->status,
                    $row->approver?->name,
                    $row->reason,
                ]);
            }
            fclose($out);
        }, 'monthly-leave-report-'.$data['month'].'.csv', ['Content-Type' => 'text/csv']);
    }
}
