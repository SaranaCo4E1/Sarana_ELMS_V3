<?php

namespace App\Http\Controllers;

use App\Models\LeaveAttachment;
use App\Models\LeaveRequest;
use App\Models\SystemNotification;
use App\Notifications\LeaveRequestDecided;
use App\Services\AttendanceService;
use App\Services\LeaveBalanceService;
use App\Support\Audit;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class ManagerApprovalController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $scope = LeaveRequest::query()
            ->with([
                'user.department',
                'user.leaveBalances' => fn ($query) => $query->where('year', now()->year),
                'leaveType',
                'attachments',
            ])
            ->where('user_id', '!=', $user->id)
            ->whereHas('user', fn ($query) => $user->isHr() ? $query : $query->where('manager_id', $user->id));

        return Inertia::render('Approvals', [
            'requests' => (clone $scope)
                ->where('status', 'pending')
                ->orderByDesc('created_at')
                ->orderByDesc('id')
                ->get(),
            'recentDecisions' => (clone $scope)
                ->whereIn('status', ['approved', 'rejected'])
                ->orderByDesc('created_at')
                ->orderByDesc('id')
                ->limit(150)
                ->get(),
            'approvalStats' => [
                'pending' => (clone $scope)->where('status', 'pending')->count(),
                'approved_this_month' => (clone $scope)->where('status', 'approved')->whereMonth('decided_at', now()->month)->whereYear('decided_at', now()->year)->count(),
                'rejected_this_month' => (clone $scope)->where('status', 'rejected')->whereMonth('decided_at', now()->month)->whereYear('decided_at', now()->year)->count(),
                'team_members_on_leave' => (clone $scope)->where('status', 'approved')->whereDate('starts_at', '<=', now()->toDateString())->whereDate('ends_at', '>=', now()->toDateString())->count(),
            ],
        ]);
    }

    public function update(Request $request, LeaveRequest $leaveRequest, LeaveBalanceService $balances, AttendanceService $attendance): RedirectResponse
    {
        $data = $request->validate([
            'decision' => ['required', 'in:approved,rejected'],
            'manager_comment' => ['nullable', 'string', 'max:1000', 'required_if:decision,rejected'],
        ], [
            'manager_comment.required_if' => 'Add a reason before rejecting this request.',
        ]);

        $actor = $request->user();
        abort_if($leaveRequest->user_id === $actor->id, 403);
        abort_unless($actor->isHr() || $leaveRequest->user->manager_id === $actor->id, 403);
        abort_unless($leaveRequest->status === 'pending', 422, 'Only pending requests can be decided.');
        $leaveRequest->loadMissing(['leaveType', 'attachments']);
        if ($data['decision'] === 'approved' && $this->overlapsApprovedRequest($leaveRequest)) {
            abort(422, 'This employee already has approved leave on one of these dates.');
        }

        $before = $leaveRequest->only(['status', 'manager_comment', 'approver_id', 'decided_at']);
        $leaveRequest->update([
            'status' => $data['decision'],
            'manager_comment' => $data['manager_comment'] ?? null,
            'approver_id' => $actor->id,
            'decided_at' => now(),
        ]);

        $leaveRequest->load(['user', 'leaveType']);
        $data['decision'] === 'approved' ? $balances->approve($leaveRequest) : $balances->releasePending($leaveRequest);
        if ($data['decision'] === 'approved') {
            $attendance->reconcileApprovedLeave($leaveRequest);
        }

        $leaveRequest->user->notify(new LeaveRequestDecided($leaveRequest));
        SystemNotification::query()->create([
            'user_id' => $leaveRequest->user_id,
            'type' => 'leave_decided',
            'title' => 'Leave request '.$data['decision'],
            'body' => 'Your '.$leaveRequest->leaveType->name.' request was '.$data['decision'].'.',
            'action_url' => route('dashboard'),
        ]);

        Audit::recordChange(
            $request,
            'leave.request.'.$data['decision'],
            $leaveRequest,
            $before,
            $leaveRequest->only(['status', 'manager_comment', 'approver_id', 'decided_at']),
            ['decision_reason' => $data['manager_comment'] ?? null]
        );

        return back()->with('success', 'Leave request '.$data['decision'].'.');
    }

    public function previewAttachment(Request $request, LeaveAttachment $leaveAttachment): BinaryFileResponse
    {
        $this->authorizeAttachment($request, $leaveAttachment);

        $response = response()->file($this->attachmentPath($leaveAttachment), [
            'Content-Type' => $leaveAttachment->mime_type ?: 'application/octet-stream',
        ]);
        $response->setContentDisposition('inline', $this->asciiFilename($leaveAttachment));

        return $response;
    }

    public function downloadAttachment(Request $request, LeaveAttachment $leaveAttachment): BinaryFileResponse
    {
        $this->authorizeAttachment($request, $leaveAttachment);

        return response()->download(
            $this->attachmentPath($leaveAttachment),
            $this->asciiFilename($leaveAttachment),
            ['Content-Type' => $leaveAttachment->mime_type ?: 'application/octet-stream']
        );
    }

    private function overlapsApprovedRequest(LeaveRequest $leaveRequest): bool
    {
        return LeaveRequest::query()
            ->where('user_id', $leaveRequest->user_id)
            ->whereKeyNot($leaveRequest->id)
            ->where('status', 'approved')
            ->whereDate('starts_at', '<=', $leaveRequest->ends_at)
            ->whereDate('ends_at', '>=', $leaveRequest->starts_at)
            ->exists();
    }

    private function authorizeAttachment(Request $request, LeaveAttachment $attachment): void
    {
        $attachment->loadMissing('leaveRequest.user');

        $actor = $request->user();

        abort_unless(
            $actor->isHr() ||
            $attachment->leaveRequest->user->manager_id === $actor->id ||
            $attachment->leaveRequest->user_id === $actor->id,
            403
        );
    }

    private function attachmentPath(LeaveAttachment $attachment): string
    {
        $disk = Storage::disk($attachment->disk);

        abort_unless($disk->exists($attachment->path), 404);

        return $disk->path($attachment->path);
    }

    private function asciiFilename(LeaveAttachment $attachment): string
    {
        $filename = trim((string) preg_replace('/[^A-Za-z0-9._-]+/', '_', $attachment->original_name), '_');

        return $filename !== '' ? $filename : 'attachment';
    }
}
