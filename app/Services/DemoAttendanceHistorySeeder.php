<?php

namespace App\Services;

use App\Models\AttendanceSchedule;
use App\Models\AttendanceSite;
use App\Models\LeaveRequest;
use App\Models\PublicHoliday;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;

class DemoAttendanceHistorySeeder
{
    private const BATCH_DAYS = 30;

    private const MISSING_PERCENT = 5;

    private const LATE_PERCENT = 8;

    private const EARLY_PERCENT = 4;

    /**
     * @param  array<int, int>  $demoUserIds
     */
    public function seed(AttendanceSite $site, array $demoUserIds): void
    {
        $baseline = $this->baseline($site->timezone);
        $yesterday = now($site->timezone)->startOfDay()->subDay();

        User::query()
            ->whereKey($demoUserIds)
            ->where('is_active', true)
            ->where(function ($query) use ($baseline): void {
                $query
                    ->whereNull('hire_date')
                    ->orWhereDate('hire_date', '>', $baseline->toDateString());
            })
            ->update(['hire_date' => $baseline->toDateString()]);

        if ($baseline->gt($yesterday)) {
            return;
        }

        $site->loadMissing('qrCode');
        $users = User::query()
            ->with([
                'attendanceSchedules' => fn ($query) => $query
                    ->with('allowedSites')
                    ->orderBy('effective_from')
                    ->orderBy('id'),
            ])
            ->whereKey($demoUserIds)
            ->where('is_active', true)
            ->orderBy('id')
            ->get();

        $this->alignSchedules($users, $site, $baseline);

        $holidays = PublicHoliday::query()
            ->where('is_active', true)
            ->whereBetween('holiday_date', [$baseline->toDateString(), $yesterday->toDateString()])
            ->get()
            ->keyBy(fn (PublicHoliday $holiday): string => $holiday->holiday_date->toDateString());
        $approvedLeaves = LeaveRequest::query()
            ->whereIn('user_id', $users->modelKeys())
            ->where('status', 'approved')
            ->whereDate('starts_at', '<=', $yesterday->toDateString())
            ->whereDate('ends_at', '>=', $baseline->toDateString())
            ->orderBy('starts_at')
            ->get()
            ->groupBy('user_id');

        DB::transaction(function () use ($users, $site, $baseline, $yesterday, $holidays, $approvedLeaves): void {
            for (
                $batchStart = $baseline->copy();
                $batchStart->lte($yesterday);
                $batchStart->addDays(self::BATCH_DAYS)
            ) {
                $batchEnd = $batchStart->copy()->addDays(self::BATCH_DAYS - 1)->min($yesterday);
                $this->seedBatch($users, $site, $batchStart, $batchEnd, $holidays, $approvedLeaves);
            }
        });
    }

    /**
     * @param  Collection<int, User>  $users
     */
    private function alignSchedules(Collection $users, AttendanceSite $site, Carbon $baseline): void
    {
        $users->each(function (User $user) use ($site, $baseline): void {
            $schedule = $user->attendanceSchedules
                ->where('primary_site_id', $site->id)
                ->sortBy('effective_from')
                ->first();

            if (! $schedule || $schedule->attendanceDays()->exists()) {
                return;
            }

            $effectiveFrom = $baseline->copy();
            if ($user->hire_date && $user->hire_date->toDateString() > $effectiveFrom->toDateString()) {
                $effectiveFrom = $user->hire_date->copy()->startOfDay();
            }

            if ($schedule->effective_from->toDateString() > $effectiveFrom->toDateString()) {
                $schedule->update(['effective_from' => $effectiveFrom->toDateString()]);
                $schedule->effective_from = $effectiveFrom;
            }
        });
    }

    /**
     * @param  Collection<int, User>  $users
     * @param  Collection<string, PublicHoliday>  $holidays
     * @param  Collection<int, Collection<int, LeaveRequest>>  $approvedLeaves
     */
    private function seedBatch(
        Collection $users,
        AttendanceSite $site,
        Carbon $batchStart,
        Carbon $batchEnd,
        Collection $holidays,
        Collection $approvedLeaves
    ): void {
        $existingDays = DB::table('attendance_days')
            ->whereIn('user_id', $users->modelKeys())
            ->whereBetween('work_date', [$batchStart->toDateString(), $batchEnd->toDateString()])
            ->get(['user_id', 'work_date'])
            ->mapWithKeys(fn (object $day): array => [$day->user_id.':'.$day->work_date => true]);
        $definitions = collect();

        for ($date = $batchStart->copy(); $date->lte($batchEnd); $date->addDay()) {
            foreach ($users as $user) {
                $dateString = $date->toDateString();
                if (
                    $existingDays->has($user->id.':'.$dateString)
                    || ($user->hire_date && $user->hire_date->toDateString() > $dateString)
                ) {
                    continue;
                }

                $schedule = $this->activeSchedule($user, $date);
                if (! $schedule) {
                    continue;
                }

                $definitions->push($this->dayDefinition(
                    $user,
                    $schedule,
                    $site,
                    $date,
                    $holidays,
                    $approvedLeaves->get($user->id, collect()),
                ));
            }
        }

        if ($definitions->isEmpty()) {
            return;
        }

        DB::table('attendance_days')->insert($definitions->pluck('day')->all());
        $days = DB::table('attendance_days')
            ->whereIn('user_id', $users->modelKeys())
            ->whereBetween('work_date', [$batchStart->toDateString(), $batchEnd->toDateString()])
            ->get(['id', 'user_id', 'work_date'])
            ->keyBy(fn (object $day): string => $day->user_id.':'.$day->work_date);

        $events = $definitions
            ->flatMap(function (array $definition) use ($days): array {
                $day = $days[$definition['key']];

                return array_map(
                    fn (array $event): array => ['attendance_day_id' => $day->id] + $event,
                    $definition['events'],
                );
            })
            ->values();

        if ($events->isNotEmpty()) {
            DB::table('attendance_events')->insert($events->all());
        }

        $eventIds = DB::table('attendance_events')
            ->whereIn('attendance_day_id', $days->pluck('id'))
            ->where('source', 'seed')
            ->get(['id', 'attendance_day_id', 'classification'])
            ->keyBy(fn (object $event): string => $event->attendance_day_id.':'.$event->classification);
        $slots = $definitions
            ->flatMap(function (array $definition) use ($days, $eventIds): array {
                $day = $days[$definition['key']];

                return array_map(function (array $slot) use ($day, $eventIds): array {
                    $event = $eventIds->get($day->id.':'.$slot['type']);

                    return [
                        'attendance_day_id' => $day->id,
                        'attendance_event_id' => $event?->id,
                    ] + $slot;
                }, $definition['slots']);
            })
            ->values();

        DB::table('attendance_slots')->insert($slots->all());
    }

    private function activeSchedule(User $user, Carbon $date): ?AttendanceSchedule
    {
        return $user->attendanceSchedules
            ->filter(
                fn (AttendanceSchedule $schedule): bool => $schedule->effective_from->toDateString()
                    <= $date->toDateString()
            )
            ->last();
    }

    /**
     * @param  Collection<string, PublicHoliday>  $holidays
     * @param  Collection<int, LeaveRequest>  $approvedLeaves
     * @return array{
     *     key: string,
     *     day: array<string, mixed>,
     *     events: array<int, array<string, mixed>>,
     *     slots: array<int, array<string, mixed>>
     * }
     */
    private function dayDefinition(
        User $user,
        AttendanceSchedule $schedule,
        AttendanceSite $site,
        Carbon $date,
        Collection $holidays,
        Collection $approvedLeaves
    ): array {
        $dateString = $date->toDateString();
        $timestamp = now()->utc()->toDateTimeString();
        $snapshot = [
            'work_start' => Str::substr($schedule->work_start, 0, 5),
            'lunch_start' => Str::substr($schedule->lunch_start, 0, 5),
            'lunch_end' => Str::substr($schedule->lunch_end, 0, 5),
            'work_end' => Str::substr($schedule->work_end, 0, 5),
            'lunch_classification_lead_minutes' => $schedule->lunch_classification_lead_minutes,
            'lunch_return_window_minutes' => (int) config('attendance.lunch_return_window_minutes', 60),
            'grace_minutes' => $schedule->grace_minutes,
            'primary_site_id' => $schedule->primary_site_id,
            'allowed_site_ids' => $schedule->allowedSites
                ->pluck('id')
                ->push($schedule->primary_site_id)
                ->unique()
                ->values()
                ->all(),
        ];
        $excuse = $this->excuse($date, $holidays, $approvedLeaves);
        $events = $excuse ? [] : $this->events($user, $schedule, $site, $date, $timestamp);
        $eventsByType = collect($events)->keyBy('classification');
        $slots = collect([
            'morning_in' => $snapshot['work_start'],
            'lunch_out' => $snapshot['lunch_start'],
            'lunch_in' => $snapshot['lunch_end'],
            'final_out' => $snapshot['work_end'],
        ])->map(function (string $time, string $type) use ($dateString, $site, $schedule, $excuse, $eventsByType, $timestamp): array {
            $expectedAt = Carbon::parse("{$dateString} {$time}", $site->timezone)->utc();
            $event = $eventsByType->get($type);

            return [
                'type' => $type,
                'expected_at' => $expectedAt->toDateTimeString(),
                'status' => $excuse
                    ? 'not_applicable'
                    : $this->slotStatus($type, $event['effective_at'] ?? null, $expectedAt, $schedule->grace_minutes),
                'created_at' => $timestamp,
                'updated_at' => $timestamp,
            ];
        })->values()->all();
        $status = $excuse['status'] ?? (collect($slots)->contains(
            fn (array $slot): bool => in_array($slot['status'], ['late', 'early', 'missing'], true)
        ) ? 'issues' : 'complete');
        $finalizedAt = Carbon::parse("{$dateString} {$snapshot['work_end']}", $site->timezone)->utc();

        return [
            'key' => $user->id.':'.$dateString,
            'day' => [
                'user_id' => $user->id,
                'attendance_schedule_id' => $schedule->id,
                'primary_site_id' => $site->id,
                'work_date' => $dateString,
                'timezone' => $site->timezone,
                'schedule_snapshot' => json_encode($snapshot, JSON_THROW_ON_ERROR),
                'status' => $status,
                'excuse_type' => $excuse['type'] ?? null,
                'excuse_reference_id' => $excuse['reference_id'] ?? null,
                'finalized_at' => $finalizedAt->toDateTimeString(),
                'created_at' => $timestamp,
                'updated_at' => $timestamp,
            ],
            'events' => $events,
            'slots' => $slots,
        ];
    }

    /**
     * @param  Collection<string, PublicHoliday>  $holidays
     * @param  Collection<int, LeaveRequest>  $approvedLeaves
     * @return null|array{type: string, reference_id: ?int, status: string}
     */
    private function excuse(Carbon $date, Collection $holidays, Collection $approvedLeaves): ?array
    {
        if ($date->isWeekend()) {
            return ['type' => 'weekend', 'reference_id' => null, 'status' => 'weekend'];
        }

        if ($holiday = $holidays->get($date->toDateString())) {
            return ['type' => 'public_holiday', 'reference_id' => $holiday->id, 'status' => 'holiday'];
        }

        $leave = $approvedLeaves->first(
            fn (LeaveRequest $request): bool => $request->starts_at->toDateString() <= $date->toDateString()
                && $request->ends_at->toDateString() >= $date->toDateString()
        );

        return $leave
            ? ['type' => 'approved_leave', 'reference_id' => $leave->id, 'status' => 'on_leave']
            : null;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function events(
        User $user,
        AttendanceSchedule $schedule,
        AttendanceSite $site,
        Carbon $date,
        string $timestamp
    ): array {
        $fixtureKey = $user->id.':'.$date->toDateString();
        $hasLateIn = $this->seededNumber("{$fixtureKey}:late-roll", 0, 99) < self::LATE_PERCENT;
        $lateClassification = $this->seededNumber("{$fixtureKey}:late-classification", 0, 1) === 0
            ? 'morning_in'
            : 'lunch_in';
        $hasEarlyOut = $this->seededNumber("{$fixtureKey}:early-roll", 0, 99) < self::EARLY_PERCENT;
        $hasMissingPunch = $this->seededNumber("{$fixtureKey}:missing-roll", 0, 99) < self::MISSING_PERCENT;
        $missingCandidates = array_values(array_filter(
            ['morning_in', 'lunch_out', 'lunch_in', 'final_out'],
            fn (string $classification): bool => ! ($hasLateIn && $classification === $lateClassification)
                && ! ($hasEarlyOut && $classification === 'final_out'),
        ));
        $missingClassification = $hasMissingPunch
            ? $missingCandidates[$this->seededNumber(
                "{$fixtureKey}:missing-classification",
                0,
                count($missingCandidates) - 1,
            )]
            : null;
        $moments = [
            'morning_in' => ['direction' => 'in', 'scheduled' => $schedule->work_start, 'minutes' => $hasLateIn && $lateClassification === 'morning_in'
                ? $this->seededNumber("{$fixtureKey}:morning-late", 3, 18)
                : -$this->seededNumber("{$fixtureKey}:morning-normal", 1, 12)],
            'lunch_out' => ['direction' => 'out', 'scheduled' => $schedule->lunch_start, 'minutes' => $this->seededNumber("{$fixtureKey}:lunch-out", 0, 7)],
            'lunch_in' => ['direction' => 'in', 'scheduled' => $schedule->lunch_end, 'minutes' => $hasLateIn && $lateClassification === 'lunch_in'
                ? $this->seededNumber("{$fixtureKey}:lunch-late", 2, 10)
                : -$this->seededNumber("{$fixtureKey}:lunch-normal", 2, 10)],
            'final_out' => ['direction' => 'out', 'scheduled' => $schedule->work_end, 'minutes' => $hasEarlyOut
                ? -$this->seededNumber("{$fixtureKey}:checkout-early", 5, 20)
                : $this->seededNumber("{$fixtureKey}:checkout-normal", 1, 18)],
        ];
        $events = [];

        foreach ($moments as $classification => $fixture) {
            if ($classification === $missingClassification) {
                continue;
            }

            $effectiveAt = Carbon::parse(
                $date->toDateString().' '.$fixture['scheduled'],
                $site->timezone,
            )
                ->addMinutes($fixture['minutes'])
                ->addSeconds($this->seededNumber("{$fixtureKey}:{$classification}:seconds", 0, 50))
                ->utc()
                ->toDateTimeString();
            $events[] = [
                'user_id' => $user->id,
                'attendance_site_id' => $site->id,
                'attendance_qr_code_id' => $site->qrCode?->id,
                'direction' => $fixture['direction'],
                'classification' => $classification,
                'occurred_at' => $effectiveAt,
                'effective_at' => $effectiveAt,
                'source' => 'seed',
                'idempotency_key' => $this->seededUuid("attendance:{$fixtureKey}:{$classification}"),
                'latitude' => $site->latitude,
                'longitude' => $site->longitude,
                'accuracy_meters' => $site->latitude !== null ? 12 : null,
                'distance_meters' => $site->latitude !== null ? 0 : null,
                'ip_address' => '127.0.0.1',
                'user_agent' => 'DatabaseSeeder',
                'geolocation_status' => $site->latitude !== null ? 'passed' : 'unavailable',
                'network_status' => 'not_configured',
                'site_assignment_status' => 'assigned',
                'verification_status' => 'clean',
                'flag_reasons' => json_encode([], JSON_THROW_ON_ERROR),
                'created_at' => $timestamp,
                'updated_at' => $timestamp,
            ];
        }

        return $events;
    }

    private function slotStatus(
        string $type,
        ?string $actual,
        Carbon $expected,
        int $graceMinutes
    ): string {
        if (! $actual) {
            return 'missing';
        }

        $actualAt = Carbon::parse($actual);

        return match ($type) {
            'morning_in', 'lunch_in' => $actualAt->gt($expected->copy()->addMinutes($graceMinutes))
                ? 'late'
                : 'on_time',
            'lunch_out', 'final_out' => $actualAt->lt($expected->copy()->subMinutes($graceMinutes))
                ? 'early'
                : 'on_time',
            default => 'on_time',
        };
    }

    private function baseline(string $timezone): Carbon
    {
        $configured = trim((string) config('attendance.seed_baseline_date', '2026-07-28'));

        foreach (['Y-m-d', 'd/m/Y'] as $format) {
            try {
                $date = Carbon::createFromFormat('!'.$format, $configured, $timezone);
                if ($date && $date->format($format) === $configured) {
                    return $date->startOfDay();
                }
            } catch (\Throwable) {
                // Try the other supported format before reporting the configuration error.
            }
        }

        throw new InvalidArgumentException(
            'ATTENDANCE_SEED_BASELINE_DATE must use YYYY-MM-DD or DD/MM/YYYY format.'
        );
    }

    private function seededNumber(string $fixtureKey, int $minimum, int $maximum): int
    {
        $hashPrefix = Str::substr(hash('sha256', $fixtureKey), 0, 8);

        return $minimum + ((int) hexdec($hashPrefix) % ($maximum - $minimum + 1));
    }

    private function seededUuid(string $fixtureKey): string
    {
        $hex = Str::substr(hash('sha256', $fixtureKey), 0, 32);
        $hex[12] = '4';
        $hex[16] = dechex((hexdec($hex[16]) & 0x3) | 0x8);

        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split($hex, 4));
    }
}
