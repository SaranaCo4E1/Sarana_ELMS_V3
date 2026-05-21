<?php

namespace App\Http\Controllers;

use App\Models\AiFaq;
use App\Models\LeaveRequest;
use App\Models\LeaveType;
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
                ->latest()
                ->get()
            : collect();

        $teamMemberIds = $user->isManager()
            ? User::query()
                ->when(! $user->isHr(), fn ($query) => $query->where('manager_id', $user->id))
                ->when($user->isHr(), fn ($query) => $query->whereKeyNot($user->id))
                ->pluck('id')
            : collect();

        $teamCalendar = $user->isManager()
            ? LeaveRequest::query()
                ->with(['user.department', 'leaveType'])
                ->whereIn('user_id', $teamMemberIds)
                ->whereIn('status', ['pending', 'approved'])
                ->whereDate('ends_at', '>=', now()->toDateString())
                ->orderBy('starts_at')
                ->limit(12)
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

        $requests = $user->leaveRequests()->with(['leaveType', 'approver', 'attachments'])->latest()->get();
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

        return Inertia::render('Dashboard', [
            'leaveTypes' => LeaveType::query()->where('is_active', true)->orderBy('name')->get(),
            'balances' => $user->leaveBalances()->with('leaveType')->where('year', now()->year)->get(),
            'requests' => $requests,
            'requestStats' => $requestStats,
            'pendingApprovals' => $pendingApprovals,
            'teamMembers' => $teamMembers,
            'teamCalendar' => $teamCalendar,
            'holidays' => PublicHoliday::query()->where('is_active', true)->whereDate('holiday_date', '>=', now()->toDateString())->orderBy('holiday_date')->limit(8)->get(),
            'notifications' => SystemNotification::query()->where('user_id', $user->id)->latest()->limit(8)->get(),
            'faqs' => AiFaq::query()->where('is_active', true)->latest()->limit(10)->get(),
        ]);
    }
}
