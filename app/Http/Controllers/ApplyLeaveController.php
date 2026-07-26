<?php

namespace App\Http\Controllers;

use App\Models\LeaveRequest;
use App\Models\LeaveType;
use App\Models\PublicHoliday;
use App\Services\LeaveBalanceService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ApplyLeaveController extends Controller
{
    public function __invoke(Request $request, LeaveBalanceService $balances): Response
    {
        $user = $request->user();
        $balances->ensureBalances($user);

        $requests = $user->leaveRequests()
            ->with(['leaveType', 'approver', 'attachments'])
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->get();

        return Inertia::render('ApplyLeave', [
            'leaveTypes' => LeaveType::query()->where('is_active', true)->orderBy('name')->get(),
            'balances' => $user->leaveBalances()->with('leaveType')->where('year', now()->year)->get(),
            'requests' => $requests,
            'requestStats' => [
                'pending' => $requests->where('status', 'pending')->count(),
                'approved' => $requests->where('status', 'approved')->count(),
                'rejected' => $requests->where('status', 'rejected')->count(),
                'cancelled' => $requests->where('status', 'cancelled')->count(),
                'scheduled_days' => (float) $requests
                    ->where('status', 'approved')
                    ->filter(fn (LeaveRequest $leaveRequest) => $leaveRequest->starts_at->toDateString() >= now()->toDateString())
                    ->sum('requested_days'),
            ],
            'holidays' => PublicHoliday::query()
                ->where('is_active', true)
                ->whereDate('holiday_date', '>=', now()->toDateString())
                ->orderBy('holiday_date')
                ->limit(16)
                ->get(),
        ]);
    }
}
