<?php

namespace App\Http\Controllers;

use App\Models\AiFaq;
use App\Models\LeaveRequest;
use App\Models\LeaveType;
use App\Models\SystemNotification;
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

        return Inertia::render('Dashboard', [
            'leaveTypes' => LeaveType::query()->where('is_active', true)->orderBy('name')->get(),
            'balances' => $user->leaveBalances()->with('leaveType')->where('year', now()->year)->get(),
            'requests' => $user->leaveRequests()->with(['leaveType', 'approver', 'attachments'])->latest()->get(),
            'pendingApprovals' => $pendingApprovals,
            'notifications' => SystemNotification::query()->where('user_id', $user->id)->latest()->limit(8)->get(),
            'faqs' => AiFaq::query()->where('is_active', true)->latest()->limit(10)->get(),
        ]);
    }
}
