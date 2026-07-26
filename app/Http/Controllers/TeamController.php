<?php

namespace App\Http\Controllers;

use App\Models\LeaveRequest;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class TeamController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $members = User::query()
            ->with([
                'department',
                'manager',
                'leaveRequests' => fn (HasMany $query) => $query
                    ->with(['leaveType', 'approver:id,name'])
                    ->whereYear('starts_at', now()->year)
                    ->orderByDesc('starts_at')
                    ->orderByDesc('id'),
            ])
            ->withCount([
                'leaveRequests as pending_leave_requests_count' => fn (Builder $query) => $query->where('status', 'pending'),
                'leaveRequests as approved_leave_requests_count' => fn (Builder $query) => $query->where('status', 'approved')->whereYear('starts_at', now()->year),
            ])
            ->when(! $user->isHr(), fn (Builder $query) => $query->where('manager_id', $user->id))
            ->when($user->isHr(), fn (Builder $query) => $query->whereKeyNot($user->id))
            ->orderBy('name')
            ->get();

        $memberIds = $members->pluck('id');

        return Inertia::render('Team', [
            'members' => $members,
            'leaveCalendar' => LeaveRequest::query()
                ->with(['user.department', 'leaveType'])
                ->whereIn('user_id', $memberIds)
                ->whereIn('status', ['pending', 'approved'])
                ->whereDate('ends_at', '>=', now()->toDateString())
                ->orderBy('starts_at')
                ->limit(50)
                ->get(),
            'pendingRequests' => LeaveRequest::query()
                ->with(['user.department', 'leaveType'])
                ->whereIn('user_id', $memberIds)
                ->where('status', 'pending')
                ->orderByDesc('created_at')
                ->orderByDesc('id')
                ->get(),
            'teamStats' => [
                'members' => $members->count(),
                'pending' => LeaveRequest::query()->whereIn('user_id', $memberIds)->where('status', 'pending')->count(),
                'on_leave_today' => LeaveRequest::query()
                    ->whereIn('user_id', $memberIds)
                    ->where('status', 'approved')
                    ->whereDate('starts_at', '<=', now()->toDateString())
                    ->whereDate('ends_at', '>=', now()->toDateString())
                    ->count(),
                'approved_this_year' => LeaveRequest::query()
                    ->whereIn('user_id', $memberIds)
                    ->where('status', 'approved')
                    ->whereYear('starts_at', now()->year)
                    ->count(),
            ],
            'requestYear' => now()->year,
        ]);
    }
}
