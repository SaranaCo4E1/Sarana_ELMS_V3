<?php

namespace App\Http\Controllers;

use App\Models\LeaveRequest;
use App\Models\SystemNotification;
use App\Notifications\LeaveRequestDecided;
use App\Services\LeaveBalanceService;
use App\Support\Audit;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ManagerApprovalController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $requests = LeaveRequest::query()
            ->with(['user.department', 'leaveType', 'attachments'])
            ->where('status', 'pending')
            ->whereHas('user', fn ($query) => $user->isHr() ? $query : $query->where('manager_id', $user->id))
            ->latest()
            ->get();

        return Inertia::render('Approvals', ['requests' => $requests]);
    }

    public function update(Request $request, LeaveRequest $leaveRequest, LeaveBalanceService $balances): RedirectResponse
    {
        $data = $request->validate([
            'decision' => ['required', 'in:approved,rejected'],
            'manager_comment' => ['nullable', 'string', 'max:1000'],
        ]);

        $actor = $request->user();
        abort_unless($actor->isHr() || $leaveRequest->user->manager_id === $actor->id, 403);
        abort_unless($leaveRequest->status === 'pending', 422, 'Only pending requests can be decided.');

        $leaveRequest->update([
            'status' => $data['decision'],
            'manager_comment' => $data['manager_comment'] ?? null,
            'approver_id' => $actor->id,
            'decided_at' => now(),
        ]);

        $leaveRequest->load(['user', 'leaveType']);
        $data['decision'] === 'approved' ? $balances->approve($leaveRequest) : $balances->releasePending($leaveRequest);

        $leaveRequest->user->notify(new LeaveRequestDecided($leaveRequest));
        SystemNotification::query()->create([
            'user_id' => $leaveRequest->user_id,
            'type' => 'leave_decided',
            'title' => 'Leave request '.$data['decision'],
            'body' => 'Your '.$leaveRequest->leaveType->name.' request was '.$data['decision'].'.',
            'action_url' => route('dashboard', ['tab' => 'leave-request', 'request' => $leaveRequest->id]),
            'reference_id' => $leaveRequest->id,
        ]);

        Audit::record($request, 'leave.request.'.$data['decision'], $leaveRequest);

        return back()->with('success', 'Leave request '.$data['decision'].'.');
    }
}
