<?php

namespace App\Http\Controllers;

use App\Models\LeaveRequest;
use App\Models\PublicHoliday;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class CalendarController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $user = $request->user();

        $visibleUserIds = $user->isManager()
            ? User::query()
                ->when(! $user->isHr(), fn ($query) => $query->where('manager_id', $user->id))
                ->when($user->isHr(), fn ($query) => $query->whereKeyNot($user->id))
                ->pluck('id')
            : collect([$user->id]);

        $leaveEvents = LeaveRequest::query()
            ->with(['user.department', 'leaveType'])
            ->whereIn('user_id', $visibleUserIds)
            ->whereIn('status', ['pending', 'approved'])
            ->whereDate('ends_at', '>=', now()->subMonth()->toDateString())
            ->orderBy('starts_at')
            ->get();

        $holidays = PublicHoliday::query()
            ->where('is_active', true)
            ->whereDate('holiday_date', '>=', now()->startOfYear()->toDateString())
            ->whereDate('holiday_date', '<=', now()->addYear()->endOfYear()->toDateString())
            ->orderBy('holiday_date')
            ->get();

        return Inertia::render('Calendar', [
            'leaveEvents' => $leaveEvents,
            'holidays' => $holidays,
            'scopeLabel' => $user->isHr() ? 'Company calendar' : ($user->isManager() ? 'Team calendar' : 'My calendar'),
        ]);
    }
}
