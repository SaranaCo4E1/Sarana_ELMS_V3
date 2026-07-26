<?php

namespace App\Http\Controllers;

use App\Models\LeaveRequest;
use App\Models\PublicHoliday;
use App\Models\SystemNotification;
use App\Models\User;
use App\Services\LeaveBalanceService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(Request $request, LeaveBalanceService $balances): Response
    {
        $user = $request->user();
        $balances->ensureBalances($user);

        $pendingApprovals = $user->isManager()
            ? LeaveRequest::query()
                ->with(['user.department', 'leaveType', 'attachments'])
                ->where('status', 'pending')
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
        ]);
    }
}
