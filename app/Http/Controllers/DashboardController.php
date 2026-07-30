<?php

namespace App\Http\Controllers;

use App\Models\LeaveRequest;
use App\Models\PublicHoliday;
use App\Models\SystemNotification;
use App\Models\User;
use App\Services\AttendanceService;
use App\Services\LeaveBalanceService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(
        Request $request,
        LeaveBalanceService $balances,
        AttendanceService $attendance
    ): Response {
        $user = $request->user();
        $balances->ensureBalances($user);
        $attendanceSchedule = $attendance->currentSchedule($user);
        $attendanceDay = $attendanceSchedule
            ? $attendance->ensureDay(
                $user,
                $attendanceSchedule,
                now($attendanceSchedule->primarySite->timezone)
            )
            : null;
        if ($attendanceDay) {
            $attendance->finalizeIfDue($attendanceDay);
            $attendanceDay->refresh()->load(['slots.event', 'events', 'primarySite']);
        }
        $nextAttendanceDirection = $attendanceDay
            ? $attendance->nextSelfServiceDirection($attendanceDay)
            : null;

        $pendingApprovals = $user->isManager()
            ? LeaveRequest::query()
                ->with(['user.department', 'leaveType', 'attachments'])
                ->where('status', 'pending')
                ->where('user_id', '!=', $user->id)
                ->whereHas('user', fn ($query) => $user->isHr() ? $query : $query->where('manager_id', $user->id))
                ->orderByDesc('created_at')
                ->orderByDesc('id')
                ->get()
            : collect();

        $teamMembers = $user->isManager()
            ? User::query()
                ->with('department')
                ->withCount([
                    'leaveRequests as pending_leave_requests_count' => fn ($query) => $query->where('status', 'pending'),
                    'leaveRequests as approved_leave_requests_count' => fn ($query) => $query->where('status', 'approved')->whereYear('starts_at', now()->year),
                ])
                ->when(! $user->isHr(), fn ($query) => $query->where('manager_id', $user->id))
                ->when($user->isHr(), fn ($query) => $query->whereKeyNot($user->id))
                ->orderBy('name')
                ->limit(16)
                ->get()
            : collect();

        $requests = $user->leaveRequests()
            ->with(['leaveType', 'approver', 'attachments'])
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->get();
        $requestStats = [
            'pending' => $requests->where('status', 'pending')->count(),
            'approved' => $requests->where('status', 'approved')->count(),
            'rejected' => $requests->where('status', 'rejected')->count(),
            'cancelled' => $requests->where('status', 'cancelled')->count(),
            'scheduled_days' => (float) $requests
                ->where('status', 'approved')
                ->filter(fn (LeaveRequest $request) => $request->starts_at->toDateString() >= now()->toDateString())
                ->sum('requested_days'),
        ];

        $upcomingHolidays = PublicHoliday::query()
            ->where('is_active', true)
            ->whereDate('holiday_date', '>=', now()->toDateString())
            ->orderBy('holiday_date')
            ->limit(5)
            ->get();

        $myUpcomingLeaves = $user->leaveRequests()
            ->with(['leaveType', 'approver'])
            ->where('status', 'approved')
            ->whereDate('ends_at', '>=', now()->toDateString())
            ->orderBy('starts_at')
            ->limit(5)
            ->get();

        $teamUpcomingLeaves = $user->isManager()
            ? LeaveRequest::query()
                ->with(['user.department', 'leaveType'])
                ->where('status', 'approved')
                ->where('user_id', '!=', $user->id)
                ->whereDate('ends_at', '>=', now()->toDateString())
                ->whereHas('user', fn ($query) => $user->isHr() ? $query : $query->where('manager_id', $user->id))
                ->orderBy('starts_at')
                ->limit(5)
                ->get()
            : collect();

        return Inertia::render('Dashboard', [
            'balances' => $user->leaveBalances()->with('leaveType')->where('year', now()->year)->get(),
            'requests' => $requests,
            'requestStats' => $requestStats,
            'pendingApprovals' => $pendingApprovals,
            'teamMembers' => $teamMembers,
            'systemAlerts' => SystemNotification::query()->where('user_id', $user->id)->latest()->limit(8)->get(),
            'upcomingHolidays' => $upcomingHolidays,
            'myUpcomingLeaves' => $myUpcomingLeaves,
            'teamUpcomingLeaves' => $teamUpcomingLeaves,
            'attendanceAction' => [
                'direction' => $nextAttendanceDirection,
                'branch_name' => $attendanceSchedule?->primarySite?->name,
                'cooldown_until' => $attendanceDay ? $attendance->punchCooldownUntil($attendanceDay)?->toIso8601String() : null,
                'preview' => $attendanceDay && $nextAttendanceDirection ? $attendance->previewNextPunch($attendanceDay) : null,
                'unavailable_reason' => match ($attendanceDay?->excuse_type) {
                    'weekend' => 'Attendance is unavailable on weekends',
                    'public_holiday' => 'Attendance is unavailable on public holidays',
                    'approved_leave' => 'Attendance is unavailable during approved leave',
                    default => $attendanceSchedule ? null : 'No active attendance schedule',
                },
            ],
        ]);
    }
}
