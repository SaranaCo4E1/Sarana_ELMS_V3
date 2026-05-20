<?php

namespace App\Http\Controllers;

use App\Models\LeaveAttachment;
use App\Models\LeaveRequest;
use App\Models\LeaveType;
use App\Models\SystemNotification;
use App\Notifications\LeaveRequestSubmitted;
use App\Services\LeaveBalanceService;
use App\Support\Audit;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LeaveRequestController extends Controller
{
    public function store(Request $request, LeaveBalanceService $balances): RedirectResponse
    {
        $data = $request->validate([
            'leave_type_id' => ['required', 'exists:leave_types,id'],
            'starts_at' => ['required', 'date', 'after_or_equal:today'],
            'ends_at' => ['required', 'date', 'after_or_equal:starts_at'],
            'reason' => ['required', 'string', 'max:2000'],
            'attachments.*' => ['file', 'max:5120', 'mimes:pdf,jpg,jpeg,png,webp,doc,docx'],
        ]);

        $type = LeaveType::findOrFail($data['leave_type_id']);
        if ($type->requires_attachment && ! $request->hasFile('attachments')) {
            return back()->withErrors(['attachments' => 'This leave type requires a supporting attachment.']);
        }

        $days = $balances->workingDays($data['starts_at'], $data['ends_at']);
        if ($days <= 0) {
            return back()->withErrors(['starts_at' => 'The selected range has no working days.']);
        }

        $user = $request->user();
        $leaveRequest = DB::transaction(function () use ($request, $data, $days, $user, $balances) {
            $leaveRequest = LeaveRequest::query()->create([
                ...$data,
                'user_id' => $user->id,
                'department_id' => $user->department_id,
                'requested_days' => $days,
                'status' => 'pending',
                'submitted_at' => now(),
            ]);

            foreach ($request->file('attachments', []) as $file) {
                $path = $file->store('leave-attachments', 'public');
                LeaveAttachment::query()->create([
                    'leave_request_id' => $leaveRequest->id,
                    'uploaded_by' => $user->id,
                    'path' => $path,
                    'original_name' => $file->getClientOriginalName(),
                    'mime_type' => $file->getMimeType(),
                    'size' => $file->getSize(),
                ]);
            }

            $balances->reservePending($leaveRequest->load('leaveType'));

            return $leaveRequest->load(['user.manager', 'leaveType']);
        });

        if ($leaveRequest->user->manager) {
            $leaveRequest->user->manager->notify(new LeaveRequestSubmitted($leaveRequest));
            SystemNotification::query()->create([
                'user_id' => $leaveRequest->user->manager_id,
                'type' => 'leave_submitted',
                'title' => 'Leave request awaiting review',
                'body' => $user->name.' requested '.$leaveRequest->requested_days.' day(s) of '.$leaveRequest->leaveType->name.'.',
                'action_url' => route('approvals.index'),
            ]);
        }

        Audit::record($request, 'leave.request.submitted', $leaveRequest);

        return back()->with('success', 'Leave request submitted.');
    }

    public function destroy(Request $request, LeaveRequest $leaveRequest, LeaveBalanceService $balances): RedirectResponse
    {
        abort_unless($leaveRequest->user_id === $request->user()->id && $leaveRequest->status === 'pending', 403);
        $balances->releasePending($leaveRequest->load('leaveType'));
        $leaveRequest->update(['status' => 'cancelled']);
        Audit::record($request, 'leave.request.cancelled', $leaveRequest);

        return back()->with('success', 'Leave request cancelled.');
    }
}
