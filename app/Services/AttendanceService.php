<?php

namespace App\Services;

use App\Models\AttendanceDay;
use App\Models\AttendanceEvent;
use App\Models\AttendanceQrCode;
use App\Models\AttendanceSchedule;
use App\Models\AttendanceSite;
use App\Models\LeaveRequest;
use App\Models\PublicHoliday;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\IpUtils;

class AttendanceService
{
    public const SLOT_TYPES = ['morning_in', 'lunch_out', 'lunch_in', 'final_out'];
    public const PUNCH_COOLDOWN_SECONDS = 30;

    public function activeSchedule(User $user, string|Carbon $localDate): ?AttendanceSchedule
    {
        $date = $localDate instanceof Carbon ? $localDate->toDateString() : $localDate;

        return AttendanceSchedule::query()
            ->with(['primarySite.qrCode', 'allowedSites'])
            ->where('user_id', $user->id)
            ->whereDate('effective_from', '<=', $date)
            ->latest('effective_from')
            ->latest('id')
            ->first();
    }

    public function currentSchedule(User $user): ?AttendanceSchedule
    {
        return AttendanceSchedule::query()
            ->with(['primarySite.qrCode', 'allowedSites'])
            ->where('user_id', $user->id)
            ->latest('effective_from')
            ->latest('id')
            ->get()
            ->first(fn (AttendanceSchedule $schedule) => $schedule->effective_from->toDateString()
                <= now($schedule->primarySite->timezone)->toDateString());
    }

    public function ensureDay(User $user, AttendanceSchedule $schedule, Carbon $localDate): AttendanceDay
    {
        $schedule->loadMissing(['primarySite', 'allowedSites']);
        $date = $localDate->copy()->setTimezone($schedule->primarySite->timezone)->startOfDay();
        $excuse = $this->excuseFor($user, $date);
        $snapshot = [
            'work_start' => $schedule->work_start,
            'lunch_start' => $schedule->lunch_start,
            'lunch_end' => $schedule->lunch_end,
            'work_end' => $schedule->work_end,
            'lunch_classification_lead_minutes' => $schedule->lunch_classification_lead_minutes,
            'lunch_return_window_minutes' => (int) config('attendance.lunch_return_window_minutes', 60),
            'grace_minutes' => $schedule->grace_minutes,
            'primary_site_id' => $schedule->primary_site_id,
            'allowed_site_ids' => $schedule->allowedSites->pluck('id')->push($schedule->primary_site_id)->unique()->values()->all(),
        ];

        $day = AttendanceDay::query()->firstOrCreate(
            ['user_id' => $user->id, 'work_date' => $date],
            [
                'attendance_schedule_id' => $schedule->id,
                'primary_site_id' => $schedule->primary_site_id,
                'timezone' => $schedule->primarySite->timezone,
                'schedule_snapshot' => $snapshot,
                'status' => $excuse ? 'excused' : 'pending',
                'excuse_type' => $excuse['type'] ?? null,
                'excuse_reference_id' => $excuse['reference_id'] ?? null,
            ]
        );

        if ($day->slots()->doesntExist()) {
            foreach ([
                'morning_in' => $snapshot['work_start'],
                'lunch_out' => $snapshot['lunch_start'],
                'lunch_in' => $snapshot['lunch_end'],
                'final_out' => $snapshot['work_end'],
            ] as $type => $time) {
                $day->slots()->create([
                    'type' => $type,
                    'expected_at' => $this->localMoment($day, $time),
                    'status' => $excuse ? 'excused' : 'pending',
                ]);
            }
        }

        return $day->load(['slots.event', 'events.site', 'primarySite']);
    }

    public function nextDirection(AttendanceDay $day): string
    {
        $latest = $day->events()
            ->whereNull('voided_at')
            ->latest('effective_at')
            ->latest('id')
            ->first();

        if ($latest) {
            return $latest->direction === 'out' ? 'in' : 'out';
        }

        $lunchReturnDeadline = $this->lunchReturnDeadline($day);

        return now()->greaterThanOrEqualTo($lunchReturnDeadline) ? 'out' : 'in';
    }

    public function nextSelfServiceDirection(AttendanceDay $day): ?string
    {
        if ($day->excuse_type) {
            return null;
        }

        $finalOutRecorded = $day->slots()
            ->where('type', 'final_out')
            ->whereNotNull('attendance_event_id')
            ->exists();

        return $finalOutRecorded ? null : $this->nextDirection($day);
    }

    public function punchCooldownUntil(AttendanceDay $day): ?Carbon
    {
        $latest = $day->events()
            ->whereNull('voided_at')
            ->latest('occurred_at')
            ->latest('id')
            ->first();

        if (! $latest) {
            return null;
        }

        $availableAt = $latest->occurred_at->copy()->addSeconds(self::PUNCH_COOLDOWN_SECONDS);

        return now()->lt($availableAt) ? $availableAt : null;
    }

    /**
     * @return array{classification: string, status: string, expected_at: ?string}
     */
    public function previewNextPunch(AttendanceDay $day, ?Carbon $at = null): array
    {
        $at ??= now();
        $day->loadMissing(['slots.event', 'events']);
        $slots = $day->slots->keyBy('type');
        $direction = $this->nextDirection($day);
        $classification = 'ordinary';
        $lunchStart = $this->localMoment($day, $day->schedule_snapshot['lunch_start']);
        $lunchEnd = $this->localMoment($day, $day->schedule_snapshot['lunch_end']);
        $lunchReturnDeadline = $this->lunchReturnDeadline($day);

        if ($slots->get('lunch_in')?->event && $direction === 'out') {
            $classification = 'final_out';
        } elseif ($day->events->isEmpty()) {
            if (
                $direction === 'in'
                && $at->greaterThanOrEqualTo($lunchStart)
                && $at->lessThan($lunchReturnDeadline)
            ) {
                $classification = 'lunch_in';
            } elseif ($direction === 'out' && $at->greaterThanOrEqualTo($lunchEnd)) {
                $classification = 'final_out';
            } else {
                $classification = 'morning_in';
            }
        } elseif ($direction === 'out') {
            if ($slots->get('lunch_in')?->event) {
                $classification = 'final_out';
            } elseif (! $slots->get('lunch_out')?->event) {
                $snapshot = $day->schedule_snapshot;
                $lunchOutFloor = $lunchStart->copy()
                    ->subMinutes((int) $snapshot['lunch_classification_lead_minutes']);

                if ($at->greaterThanOrEqualTo($lunchOutFloor) && $at->lessThan($lunchEnd)) {
                    $classification = 'lunch_out';
                } elseif ($at->greaterThanOrEqualTo($lunchEnd)) {
                    $classification = 'final_out';
                }
            }
        } elseif (
            $slots->get('lunch_out')?->event
            && ! $slots->get('lunch_in')?->event
            && $at->greaterThanOrEqualTo($lunchStart)
        ) {
            $classification = 'lunch_in';
        }

        $slot = $slots->get($classification);
        $status = $slot
            ? $this->slotStatus(
                $classification,
                $at,
                $slot->expected_at,
                (int) ($day->schedule_snapshot['grace_minutes'] ?? 0)
            )
            : 'ordinary';

        return [
            'classification' => $classification,
            'status' => $status,
            'expected_at' => $slot?->expected_at?->toIso8601String(),
        ];
    }

    public function recordPunch(
        User $user,
        AttendanceQrCode $qrCode,
        array $data,
        ?string $ipAddress,
        ?string $userAgent
    ): AttendanceEvent {
        $qrCode->loadMissing('site');
        $site = $qrCode->site;
        abort_unless($site?->is_active, 422, 'This attendance branch is inactive.');
        $localNow = now()->setTimezone($site->timezone);
        $schedule = $this->activeSchedule($user, $localNow);
        abort_unless($schedule, 422, 'No attendance schedule is active for your account.');

        return $this->recordEvent(
            $user,
            $schedule,
            $site,
            $data,
            $ipAddress,
            $userAgent,
            'qr',
            $qrCode
        );
    }

    public function recordSelfServicePunch(
        User $user,
        array $data,
        ?string $ipAddress,
        ?string $userAgent
    ): AttendanceEvent {
        $schedule = $this->currentSchedule($user);
        if (! $schedule) {
            throw ValidationException::withMessages([
                'attendance' => 'No attendance schedule is active for your account.',
            ]);
        }
        if (! $schedule->primarySite?->is_active) {
            throw ValidationException::withMessages([
                'attendance' => 'Your attendance branch is inactive.',
            ]);
        }

        return $this->recordEvent(
            $user,
            $schedule,
            $schedule->primarySite,
            $data,
            $ipAddress,
            $userAgent,
            'self_service'
        );
    }

    private function recordEvent(
        User $user,
        AttendanceSchedule $schedule,
        AttendanceSite $site,
        array $data,
        ?string $ipAddress,
        ?string $userAgent,
        string $source,
        ?AttendanceQrCode $qrCode = null
    ): AttendanceEvent {
        $localNow = now()->setTimezone($site->timezone);

        return DB::transaction(function () use ($user, $qrCode, $site, $schedule, $localNow, $data, $ipAddress, $userAgent, $source) {
            $day = $this->ensureDay($user, $schedule, $localNow);
            $day = AttendanceDay::query()->lockForUpdate()->findOrFail($day->id);
            if ($day->excuse_type) {
                if ($source === 'self_service') {
                    throw ValidationException::withMessages([
                        'attendance' => 'Attendance actions are unavailable on an excused day.',
                    ]);
                }
                abort(422, 'Attendance actions are unavailable on an excused day.');
            }

            if ($existing = AttendanceEvent::query()
                ->where('user_id', $user->id)
                ->where('idempotency_key', $data['idempotency_key'])
                ->first()) {
                return $existing;
            }

            if ($source === 'self_service') {
                if (! $this->nextSelfServiceDirection($day)) {
                    throw ValidationException::withMessages([
                        'attendance' => 'No attendance actions remain for today.',
                    ]);
                }
            }

            $latest = $day->events()
                ->whereNull('voided_at')
                ->latest('effective_at')
                ->latest('id')
                ->first();

            if ($latest) {
                $availableAt = $latest->occurred_at->copy()->addSeconds(self::PUNCH_COOLDOWN_SECONDS);
                if (now()->lt($availableAt)) {
                    $remainingSeconds = max(1, (int) ceil(now()->diffInMilliseconds($availableAt) / 1000));
                    throw ValidationException::withMessages([
                        'attendance' => "Your previous punch was recorded. Please wait {$remainingSeconds} seconds before the next action.",
                    ]);
                }
            }

            $direction = $this->nextDirection($day);
            $evidence = $this->verifyEvidence($schedule, $site, $data, $ipAddress);
            $event = $day->events()->create([
                'user_id' => $user->id,
                'attendance_site_id' => $site->id,
                'attendance_qr_code_id' => $qrCode?->id,
                'direction' => $direction,
                'classification' => 'ordinary',
                'occurred_at' => now(),
                'effective_at' => now(),
                'source' => $source,
                'idempotency_key' => $data['idempotency_key'],
                'latitude' => $data['latitude'] ?? null,
                'longitude' => $data['longitude'] ?? null,
                'accuracy_meters' => $data['accuracy_meters'] ?? null,
                'distance_meters' => $evidence['distance_meters'],
                'ip_address' => $ipAddress,
                'user_agent' => $userAgent,
                'geolocation_status' => $evidence['geolocation_status'],
                'network_status' => $evidence['network_status'],
                'site_assignment_status' => $evidence['site_assignment_status'],
                'verification_status' => $evidence['verification_status'],
                'flag_reasons' => $evidence['flag_reasons'],
            ]);

            $this->recomputeDay($day);

            return $event->fresh();
        });
    }

    public function recomputeDay(AttendanceDay $day): void
    {
        $day->load(['slots', 'events' => fn ($query) => $query->whereNull('voided_at')->orderBy('effective_at')->orderBy('id')]);
        $snapshot = $day->schedule_snapshot;
        $events = $day->events->values();

        foreach ($events as $event) {
            if ($event->classification !== 'ordinary') {
                $event->update(['classification' => 'ordinary']);
            }
        }

        $assignments = [];
        $lunchStart = $this->localMoment($day, $snapshot['lunch_start']);
        $firstIn = $events->first(fn (AttendanceEvent $event) => $event->direction === 'in');
        if ($firstIn) {
            if (
                $events->first()?->is($firstIn)
                && $firstIn->effective_at->greaterThanOrEqualTo($lunchStart)
                && $firstIn->effective_at->lessThan($this->lunchReturnDeadline($day))
            ) {
                $assignments['lunch_in'] = $firstIn;
                $firstIn->update(['classification' => 'lunch_in']);
            } else {
                $assignments['morning_in'] = $firstIn;
                $firstIn->update(['classification' => 'morning_in']);
            }
        }

        $lunchOutFloor = $lunchStart->copy()
            ->subMinutes((int) $snapshot['lunch_classification_lead_minutes']);
        $lunchOutCeiling = $this->localMoment($day, $snapshot['lunch_end']);
        $lunchInFloor = $lunchStart;

        for ($index = 0; $index < $events->count() - 1; $index++) {
            $out = $events[$index];
            $in = $events[$index + 1];
            if (
                $out->direction === 'out'
                && $in->direction === 'in'
                && $out->effective_at->greaterThanOrEqualTo($lunchOutFloor)
                && $out->effective_at->lessThan($lunchOutCeiling)
                && $in->effective_at->greaterThanOrEqualTo($lunchInFloor)
                && $in->effective_at->lessThan($this->lunchReturnDeadline($day))
            ) {
                $assignments['lunch_out'] = $out;
                $assignments['lunch_in'] = $in;
                $out->update(['classification' => 'lunch_out']);
                $in->update(['classification' => 'lunch_in']);
                break;
            }
        }

        $last = $events->last();
        if (
            ! isset($assignments['lunch_out'])
            && $last
            && $last->direction === 'out'
            && $last->effective_at->greaterThanOrEqualTo($lunchOutFloor)
            && $last->effective_at->lessThan($lunchOutCeiling)
        ) {
            $assignments['lunch_out'] = $last;
            $last->update(['classification' => 'lunch_out']);
        }

        $finalOutFloor = $this->localMoment($day, $snapshot['lunch_end']);
        $isOutAfterCompletedLunch = isset($assignments['lunch_in'])
            && $last
            && $last->effective_at->greaterThan($assignments['lunch_in']->effective_at);
        if (
            $last
            && $last->direction === 'out'
            && ($isOutAfterCompletedLunch || $last->effective_at->greaterThanOrEqualTo($finalOutFloor))
        ) {
            $assignments['final_out'] = $last;
            $last->update(['classification' => 'final_out']);
        }

        $progressedAt = $events->last()?->effective_at;
        $localNow = now()->setTimezone($day->timezone);
        if (
            $day->work_date->toDateString() === $localNow->toDateString()
            && (! $progressedAt || $localNow->greaterThan($progressedAt))
        ) {
            $progressedAt = $localNow;
        }
        foreach ($day->slots as $slot) {
            if ($day->excuse_type) {
                $slot->update(['attendance_event_id' => null, 'status' => 'excused']);

                continue;
            }

            $event = $assignments[$slot->type] ?? null;
            $status = $event
                ? $this->slotStatus($slot->type, $event->effective_at, $slot->expected_at, (int) ($snapshot['grace_minutes'] ?? 0))
                : ($day->finalized_at || ($progressedAt && $progressedAt->greaterThanOrEqualTo($this->slotMissingDeadline($day, $slot->type)))
                    ? 'missing'
                    : 'pending');
            $slot->update(['attendance_event_id' => $event?->id, 'status' => $status]);
        }

        $day->refresh()->load(['slots', 'events']);
        if ($day->excuse_type) {
            $status = 'excused';
        } else {
            $hasIssues = $day->slots->contains(fn ($slot) => in_array($slot->status, ['late', 'early', 'missing'], true))
                || $day->events->contains(fn ($event) => $event->verification_status === 'flagged' && ! $event->reviewed_at && ! $event->voided_at);
            $status = $hasIssues ? 'issues' : ($day->finalized_at ? 'complete' : 'pending');
        }
        $day->update(['status' => $status]);
    }

    public function reconcileDueDays(): int
    {
        $processed = 0;
        User::query()->where('is_active', true)->orderBy('id')->chunkById(100, function ($users) use (&$processed) {
            foreach ($users as $user) {
                $candidateSchedules = AttendanceSchedule::query()
                    ->with(['primarySite', 'allowedSites'])
                    ->where('user_id', $user->id)
                    ->orderByDesc('effective_from')
                    ->get();

                foreach ($candidateSchedules as $schedule) {
                    $localNow = now()->setTimezone($schedule->primarySite->timezone);
                    if ($schedule->effective_from->greaterThan($localNow->copy()->startOfDay())) {
                        continue;
                    }
                    $day = $this->ensureDay($user, $schedule, $localNow);
                    $this->finalizeIfDue($day, $localNow);
                    $processed++;
                    break;
                }
            }
        });

        return $processed;
    }

    public function finalizeIfDue(AttendanceDay $day, ?Carbon $at = null): void
    {
        $at ??= now()->setTimezone($day->timezone);
        $scheduledEnd = Carbon::parse(
            $day->work_date->toDateString().' '.$day->schedule_snapshot['work_end'],
            $day->timezone
        );

        if (! $day->finalized_at && $at->greaterThanOrEqualTo($scheduledEnd)) {
            $day->update(['finalized_at' => now()]);
            $this->recomputeDay($day);

            return;
        }

        if (! $day->finalized_at && $day->work_date->toDateString() === $at->toDateString()) {
            $this->recomputeDay($day);
        }
    }

    public function reconcileApprovedLeave(LeaveRequest $leave): void
    {
        AttendanceDay::query()
            ->where('user_id', $leave->user_id)
            ->whereBetween('work_date', [$leave->starts_at, $leave->ends_at])
            ->get()
            ->each(function (AttendanceDay $day) use ($leave) {
                $day->update([
                    'excuse_type' => 'approved_leave',
                    'excuse_reference_id' => $leave->id,
                    'status' => 'excused',
                ]);
                $this->recomputeDay($day);
            });
    }

    public function createDefaultSchedule(User $user, ?AttendanceSite $site = null): ?AttendanceSchedule
    {
        $site ??= AttendanceSite::query()->where('is_active', true)->orderBy('id')->first();
        if (! $site || $user->attendanceSchedules()->exists()) {
            return null;
        }
        $effectiveFrom = max(now()->toDateString(), $user->hire_date?->toDateString() ?? now()->toDateString());
        $schedule = AttendanceSchedule::query()->create([
            'user_id' => $user->id,
            'primary_site_id' => $site->id,
            'effective_from' => $effectiveFrom,
        ]);
        $schedule->allowedSites()->sync([$site->id]);

        return $schedule;
    }

    private function verifyEvidence(AttendanceSchedule $schedule, AttendanceSite $site, array $data, ?string $ipAddress): array
    {
        $assignedIds = $schedule->allowedSites->pluck('id')->push($schedule->primary_site_id)->unique();
        $assigned = $assignedIds->contains($site->id);
        $distance = null;
        $geoStatus = 'unavailable';
        $geoPass = false;

        if (
            isset($data['latitude'], $data['longitude'], $data['accuracy_meters'])
            && $site->latitude !== null
            && $site->longitude !== null
        ) {
            $distance = $this->haversine(
                (float) $data['latitude'],
                (float) $data['longitude'],
                (float) $site->latitude,
                (float) $site->longitude
            );
            if ((float) $data['accuracy_meters'] > $site->maximum_accuracy_meters) {
                $geoStatus = 'low_accuracy';
            } elseif ($distance > $site->acceptance_radius_meters) {
                $geoStatus = 'outside_geofence';
            } else {
                $geoStatus = 'passed';
                $geoPass = true;
            }
        } elseif (($data['geolocation_error'] ?? null) === 'denied') {
            $geoStatus = 'denied';
        }

        $ranges = array_values(array_filter($site->allowed_ip_ranges ?? []));
        $networkStatus = $ranges === [] ? 'not_configured' : 'not_allowed';
        $networkPass = $ranges !== [] && $ipAddress && IpUtils::checkIp($ipAddress, $ranges);
        if ($networkPass) {
            $networkStatus = 'passed';
        }

        $clean = $assigned && ($geoPass || $networkPass);
        $reasons = [];
        if (! $assigned) {
            $reasons[] = 'unassigned_site';
        }
        if (! $geoPass && ! $networkPass) {
            $reasons[] = $geoStatus;
            $reasons[] = $networkStatus;
        }

        return [
            'distance_meters' => $distance === null ? null : round($distance, 2),
            'geolocation_status' => $geoStatus,
            'network_status' => $networkStatus,
            'site_assignment_status' => $assigned ? 'assigned' : 'unassigned',
            'verification_status' => $clean ? 'clean' : 'flagged',
            'flag_reasons' => array_values(array_unique($reasons)),
        ];
    }

    private function excuseFor(User $user, Carbon $date): ?array
    {
        if ($date->isWeekend()) {
            return ['type' => 'weekend', 'reference_id' => null];
        }
        if ($holiday = PublicHoliday::query()->where('is_active', true)->whereDate('holiday_date', $date)->first()) {
            return ['type' => 'public_holiday', 'reference_id' => $holiday->id];
        }
        if ($leave = LeaveRequest::query()
            ->where('user_id', $user->id)
            ->where('status', 'approved')
            ->whereDate('starts_at', '<=', $date)
            ->whereDate('ends_at', '>=', $date)
            ->first()) {
            return ['type' => 'approved_leave', 'reference_id' => $leave->id];
        }

        return null;
    }

    private function slotStatus(string $type, Carbon $actual, Carbon $expected, int $grace): string
    {
        return match ($type) {
            'morning_in', 'lunch_in' => $actual->greaterThan($expected->copy()->addMinutes($grace)) ? 'late' : 'on_time',
            'lunch_out', 'final_out' => $actual->lessThan($expected->copy()->subMinutes($grace)) ? 'early' : 'on_time',
            default => 'on_time',
        };
    }

    private function lunchReturnDeadline(AttendanceDay $day): Carbon
    {
        return $this->localMoment($day, $day->schedule_snapshot['lunch_end'])
            ->addMinutes((int) ($day->schedule_snapshot['lunch_return_window_minutes']
                ?? config('attendance.lunch_return_window_minutes', 60)));
    }

    private function slotMissingDeadline(AttendanceDay $day, string $type): Carbon
    {
        $snapshot = $day->schedule_snapshot;

        return match ($type) {
            'morning_in' => $this->localMoment($day, $snapshot['lunch_start'])
                ->subMinutes((int) $snapshot['lunch_classification_lead_minutes']),
            'lunch_out' => $this->localMoment($day, $snapshot['lunch_start']),
            'lunch_in' => $this->lunchReturnDeadline($day),
            'final_out' => $this->localMoment($day, $snapshot['work_end']),
            default => $this->localMoment($day, $snapshot['work_end']),
        };
    }

    private function localMoment(AttendanceDay $day, string $time): Carbon
    {
        return Carbon::parse($day->work_date->toDateString().' '.$time, $day->timezone)->utc();
    }

    private function haversine(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $earthRadius = 6371000;
        $latDelta = deg2rad($lat2 - $lat1);
        $lngDelta = deg2rad($lng2 - $lng1);
        $a = sin($latDelta / 2) ** 2
            + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($lngDelta / 2) ** 2;

        return $earthRadius * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }
}
