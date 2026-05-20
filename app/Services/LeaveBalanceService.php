<?php

namespace App\Services;

use App\Models\LeaveBalance;
use App\Models\LeaveRequest;
use App\Models\LeaveType;
use App\Models\PublicHoliday;
use App\Models\User;
use Carbon\CarbonPeriod;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class LeaveBalanceService
{
    public function workingDays(string $startsAt, string $endsAt): float
    {
        $holidays = PublicHoliday::query()
            ->where('is_active', true)
            ->whereBetween('holiday_date', [$startsAt, $endsAt])
            ->pluck('holiday_date')
            ->map(fn ($date) => Carbon::parse($date)->toDateString())
            ->all();

        $days = 0;
        foreach (CarbonPeriod::create($startsAt, $endsAt) as $date) {
            if (! $date->isWeekend() && ! in_array($date->toDateString(), $holidays, true)) {
                $days++;
            }
        }

        return (float) $days;
    }

    public function ensureBalances(User $user, ?int $year = null): void
    {
        $year ??= now()->year;

        LeaveType::query()->where('is_active', true)->each(function (LeaveType $type) use ($user, $year) {
            LeaveBalance::query()->firstOrCreate(
                ['user_id' => $user->id, 'leave_type_id' => $type->id, 'year' => $year],
                ['allowance_days' => $type->default_allowance_days]
            );
        });
    }

    public function reservePending(LeaveRequest $request): void
    {
        $this->moveBalance($request, 'pending_days', (float) $request->requested_days);
    }

    public function approve(LeaveRequest $request): void
    {
        DB::transaction(function () use ($request) {
            $balance = $this->balanceFor($request);
            $balance->pending_days = max(0, (float) $balance->pending_days - (float) $request->requested_days);

            if ($request->leaveType->deducts_balance) {
                $balance->used_days = (float) $balance->used_days + (float) $request->requested_days;
            }

            $balance->save();
        });
    }

    public function releasePending(LeaveRequest $request): void
    {
        $this->moveBalance($request, 'pending_days', -1 * (float) $request->requested_days);
    }

    private function moveBalance(LeaveRequest $request, string $column, float $delta): void
    {
        DB::transaction(function () use ($request, $column, $delta) {
            $balance = $this->balanceFor($request);
            $balance->{$column} = max(0, (float) $balance->{$column} + $delta);
            $balance->save();
        });
    }

    private function balanceFor(LeaveRequest $request): LeaveBalance
    {
        return LeaveBalance::query()->firstOrCreate(
            [
                'user_id' => $request->user_id,
                'leave_type_id' => $request->leave_type_id,
                'year' => Carbon::parse($request->starts_at)->year,
            ],
            ['allowance_days' => $request->leaveType->default_allowance_days]
        );
    }
}
