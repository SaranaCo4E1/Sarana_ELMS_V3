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
        $scope = LeaveRequest::query()
            ->with(['user.department', 'leaveType', 'attachments'])
            ->whereHas('user', fn ($query) => $user->isHr() ? $query : $query->where('manager_id', $user->id));

        return Inertia::render('Approvals', [
            'requests' => (clone $scope)->where('status', 'pending')->latest()->get(),
            'recentDecisions' => (clone $scope)
                ->whereIn('status', ['approved', 'rejected'])
                ->latest('decided_at')
                ->limit(20)
                ->get(),
            'approvalStats' => [
                'pending' => (clone $scope)->where('status', 'pending')->count(),
                'approved_this_month' => (clone $scope)->where('status', 'approved')->whereMonth('decided_at', now()->month)->whereYear('decided_at', now()->year)->count(),
                'rejected_this_month' => (clone $scope)->where('status', 'rejected')->whereMonth('decided_at', now()->month)->whereYear('decided_at', now()->year)->count(),
                'team_members_on_leave' => (clone $scope)->where('status', 'approved')->whereDate('starts_at', '<=', now()->toDateString())->whereDate('ends_at', '>=', now()->toDateString())->count(),
            ],
        ]);
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
            'action_url' => route('dashboard'),
        ]);

        Audit::record($request, 'leave.request.'.$data['decision'], $leaveRequest);

        return back()->with('success', 'Leave request '.$data['decision'].'.');
    }
}
