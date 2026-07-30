<?php

namespace App\Http\Controllers;

use App\Models\AttendanceDay;
use App\Models\AttendanceEvent;
use App\Models\AttendanceQrCode;
use App\Models\AttendanceSchedule;
use App\Models\AttendanceSite;
use App\Models\SystemNotification;
use App\Models\User;
use App\Notifications\AttendanceFlagged;
use App\Services\AttendanceQrService;
use App\Services\AttendanceService;
use App\Support\Audit;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AttendanceController extends Controller
{
    public function index(Request $request, AttendanceService $attendance, AttendanceQrService $qr): Response
    {
        $actor = $request->user();
        $canSettings = $actor->hasPermission('attendance.settings.manage');
        $canAll = $actor->hasPermission('attendance.records.manage');
        $canTeam = $actor->hasPermission('attendance.team.manage');
        $dateData = $request->validate([
            'attendance_date' => ['nullable', 'date_format:Y-m-d', 'before_or_equal:today'],
            'history_month' => ['nullable', 'date_format:Y-m'],
            'history_user_id' => ['nullable', 'integer'],
            'personal_date' => ['nullable', 'date_format:Y-m-d', 'before_or_equal:today'],
        ]);
        $selectedDate = $dateData['attendance_date'] ?? now()->toDateString();

        $schedule = $attendance->currentSchedule($actor);
        $actorTimezone = $schedule?->primarySite?->timezone ?? config('app.timezone');
        $currentMonth = now($actorTimezone)->startOfMonth();
        $historyMonth = isset($dateData['history_month'])
            ? Carbon::createFromFormat('Y-m-d', $dateData['history_month'].'-01', $actorTimezone)->startOfMonth()
            : $currentMonth->copy();
        if ($historyMonth->greaterThan($currentMonth)) {
            throw ValidationException::withMessages([
                'history_month' => 'The history month cannot be in the future.',
            ]);
        }

        $today = $schedule
            ? $attendance->ensureDay($actor, $schedule, now()->setTimezone($schedule->primarySite->timezone))
            : null;
        if ($today) {
            $attendance->finalizeIfDue($today);
            $today->refresh()->load(['slots.event', 'events.site', 'primarySite']);
        }
        $nextDirection = $today ? $attendance->nextSelfServiceDirection($today) : null;
        $selectedPersonalDate = $dateData['personal_date'] ?? now($actorTimezone)->toDateString();
        $personalRecord = $this->isWeekend($selectedPersonalDate, $actorTimezone)
            ? null
            : AttendanceDay::query()
                ->with(['user.department', 'primarySite', 'slots.event', 'events' => fn ($query) => $query->orderBy('effective_at')])
                ->where('user_id', $actor->id)
                ->whereDate('work_date', $selectedPersonalDate)
                ->first();

        $recentRecords = AttendanceDay::query()
            ->with(['user.department', 'primarySite', 'slots.event', 'events' => fn ($query) => $query->orderBy('effective_at')])
            ->where('user_id', $actor->id)
            ->whereRaw($this->weekdaySql())
            ->when($today, fn ($query) => $query->whereDate('work_date', '<', $today->work_date))
            ->orderByDesc('work_date')
            ->limit(5)
            ->get();

        $historyUsersQuery = User::query()
            ->where('is_active', true)
            ->with('department')
            ->orderBy('name');
        if (! $canAll) {
            $historyUsersQuery->where(function ($query) use ($actor, $canTeam) {
                $query->whereKey($actor->id);
                if ($canTeam) {
                    $query->orWhere('manager_id', $actor->id);
                }
            });
        }
        $historyUsers = $historyUsersQuery->get(['id', 'department_id', 'name', 'employee_code']);
        $selectedHistoryUserId = (int) ($dateData['history_user_id'] ?? $actor->id);
        $selectedHistoryUser = $historyUsers->firstWhere('id', $selectedHistoryUserId);
        if (! $selectedHistoryUser) {
            throw ValidationException::withMessages([
                'history_user_id' => 'You are not authorized to view attendance history for this team member.',
            ]);
        }

        $historyRecords = AttendanceDay::query()
            ->with(['user.department', 'primarySite', 'slots.event', 'events' => fn ($query) => $query->orderBy('effective_at')])
            ->where('user_id', $selectedHistoryUserId)
            ->whereRaw($this->weekdaySql())
            ->whereDate('work_date', '>=', $historyMonth->toDateString())
            ->whereDate('work_date', '<=', $historyMonth->copy()->endOfMonth()->toDateString())
            ->orderByDesc('work_date')
            ->get();

        if (! $canAll) {
            $historyRecords->each(fn (AttendanceDay $day) => $day->events->each(function (AttendanceEvent $event) {
                $event->makeHidden(['latitude', 'longitude', 'ip_address', 'user_agent']);
            }));
        }

        $teamToday = $canTeam
            ? User::query()
                ->where('manager_id', $actor->id)
                ->where('is_active', true)
                ->with('department')
                ->orderBy('name')
                ->get()
                ->map(function (User $employee) use ($attendance): array {
                    $schedule = $attendance->currentSchedule($employee);
                    $day = null;

                    if ($schedule) {
                        $localNow = now($schedule->primarySite->timezone);
                        $day = $attendance->ensureDay($employee, $schedule, $localNow);
                        $attendance->finalizeIfDue($day);
                        $day->load([
                            'user.department',
                            'primarySite',
                            'slots.event',
                            'events' => fn ($query) => $query->orderBy('effective_at'),
                        ]);
                        $day->events->each(fn (AttendanceEvent $event) => $event->makeHidden([
                            'latitude', 'longitude', 'ip_address', 'user_agent',
                        ]));
                    }

                    return ['user' => $employee, 'day' => $day];
                })
                ->values()
            : collect();

        $recordUsers = ($canAll || $canTeam)
            ? User::query()
                ->where('is_active', true)
                ->with('department')
                ->when(! $canAll, fn ($query) => $query->where('manager_id', $actor->id))
                ->orderBy('name')
                ->get()
            : collect();

        foreach ($recordUsers as $employee) {
            $employeeSchedule = $attendance->activeSchedule($employee, $selectedDate);
            if (! $employeeSchedule) {
                continue;
            }

            $localDate = Carbon::parse($selectedDate, $employeeSchedule->primarySite->timezone);
            $day = $attendance->ensureDay($employee, $employeeSchedule, $localDate);
            $attendance->finalizeIfDue($day);
        }

        $records = AttendanceDay::query()
            ->with(['user.department', 'primarySite', 'slots.event', 'events' => fn ($query) => $query->orderBy('effective_at')])
            ->whereDate('work_date', $selectedDate)
            ->whereIn('user_id', $recordUsers->pluck('id'))
            ->orderBy('user_id')
            ->get();

        if (! $canAll) {
            $records->each(fn (AttendanceDay $day) => $day->events->each(function (AttendanceEvent $event) {
                $event->makeHidden(['latitude', 'longitude', 'ip_address', 'user_agent']);
            }));
        }

        $sites = $canSettings
            ? AttendanceSite::query()->with('qrCode')->orderBy('name')->get()
            : collect();
        $sitePayload = $sites->map(function (AttendanceSite $site) use ($qr) {
            $data = $site->toArray();
            if ($site->qrCode?->is_enabled) {
                $data['qr_code']['scan_url'] = $qr->scanUrl($site->qrCode);
                $data['qr_code']['image_url'] = route('attendance.qr.image', [
                    'qrCode' => $site->qrCode,
                    'token' => $qr->token($site->qrCode),
                ]);
            }

            return $data;
        })->values();

        return Inertia::render('Attendance', [
            'today' => $today,
            'nextDirection' => $nextDirection,
            'punchCooldownUntil' => $today ? $attendance->punchCooldownUntil($today)?->toIso8601String() : null,
            'punchPreview' => $today && $nextDirection ? $attendance->previewNextPunch($today) : null,
            'attendanceUnavailableReason' => $this->attendanceUnavailableReason($schedule, $today, $nextDirection),
            'personalRecord' => $personalRecord,
            'selectedPersonalDate' => $selectedPersonalDate,
            'recentRecords' => $recentRecords,
            'historyRecords' => $historyRecords,
            'selectedHistoryMonth' => $historyMonth->format('Y-m'),
            'historyUsers' => $historyUsers->values(),
            'selectedHistoryUser' => $selectedHistoryUser,
            'teamToday' => $teamToday,
            'records' => $records,
            'selectedDate' => $selectedDate,
            'recordUsers' => $recordUsers->values(),
            'sites' => $sitePayload,
            'schedules' => $canSettings
                ? AttendanceSchedule::query()->with(['user.department', 'primarySite', 'allowedSites'])->latest('effective_from')->get()
                : [],
            'manageableUsers' => $canSettings
                ? User::query()->where('is_active', true)->with('department')->orderBy('name')->get(['id', 'department_id', 'name', 'employee_code'])
                : ($canTeam
                    ? User::query()->where('manager_id', $actor->id)->where('is_active', true)->with('department')->orderBy('name')->get(['id', 'department_id', 'name', 'employee_code'])
                    : []),
            'currentIp' => $request->ip(),
            'capabilities' => [
                'settings' => $canSettings,
                'all_records' => $canAll,
                'team_records' => $canTeam,
            ],
        ]);
    }

    private function weekdaySql(): string
    {
        return match (DB::connection()->getDriverName()) {
            'pgsql' => 'EXTRACT(ISODOW FROM work_date) BETWEEN 1 AND 5',
            'mysql', 'mariadb' => 'WEEKDAY(work_date) BETWEEN 0 AND 4',
            default => "strftime('%w', work_date) NOT IN ('0', '6')",
        };
    }

    private function isWeekend(string $date, string $timezone): bool
    {
        return Carbon::parse($date, $timezone)->isWeekend();
    }

    public function showScan(
        Request $request,
        AttendanceQrCode $qrCode,
        AttendanceQrService $qr,
        AttendanceService $attendance
    ): Response {
        abort_unless($qr->isValid($qrCode, $request->query('token')), 404, 'This QR code is invalid or expired.');
        $qrCode->loadMissing('site');
        $schedule = $attendance->activeSchedule($request->user(), now()->setTimezone($qrCode->site->timezone));
        abort_unless($schedule, 422, 'No attendance schedule is active for your account.');
        $day = $attendance->ensureDay($request->user(), $schedule, now()->setTimezone($qrCode->site->timezone));
        $attendance->finalizeIfDue($day);
        $day->refresh()->load(['slots.event', 'events', 'primarySite']);

        return Inertia::render('AttendanceScan', [
            'site' => $qrCode->site->only(['id', 'name', 'timezone']),
            'direction' => $attendance->nextDirection($day),
            'punchPreview' => $attendance->previewNextPunch($day),
            'token' => $request->query('token'),
            'qrPublicId' => $qrCode->public_id,
            'idempotencyKey' => (string) Str::uuid(),
        ]);
    }

    public function storeScan(
        Request $request,
        AttendanceQrCode $qrCode,
        AttendanceQrService $qr,
        AttendanceService $attendance
    ): RedirectResponse {
        abort_unless($qr->isValid($qrCode, $request->input('token')), 404, 'This QR code is invalid or expired.');
        $data = $request->validate([
            'token' => ['required', 'string'],
            'idempotency_key' => ['required', 'uuid'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90', 'required_with:longitude,accuracy_meters'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180', 'required_with:latitude,accuracy_meters'],
            'accuracy_meters' => ['nullable', 'numeric', 'min:0', 'max:100000', 'required_with:latitude,longitude'],
            'geolocation_error' => ['nullable', Rule::in(['denied', 'unavailable', 'timeout'])],
        ]);

        $event = $attendance->recordPunch(
            $request->user(),
            $qrCode,
            $data,
            $request->ip(),
            $request->userAgent()
        );
        Audit::recordChange($request, 'attendance.event.recorded', $event, [], $event->only([
            'direction', 'effective_at', 'source', 'verification_status', 'site_id',
        ]), ['channel' => 'qr']);

        $message = ($event->direction === 'in' ? 'Check-in' : 'Check-out')
            .' recorded at '.$event->effective_at->setTimezone($qrCode->site->timezone)->format('H:i');
        if ($event->verification_status === 'flagged') {
            $message .= ' and flagged for review.';
            $this->notifyManagerOfFlaggedEvent($event);
        }

        return redirect()->route('attendance.index')->with('success', $message);
    }

    public function storeSelfServicePunch(
        Request $request,
        AttendanceService $attendance
    ): RedirectResponse {
        $data = $request->validate([
            'idempotency_key' => ['required', 'uuid'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90', 'required_with:longitude,accuracy_meters'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180', 'required_with:latitude,accuracy_meters'],
            'accuracy_meters' => ['nullable', 'numeric', 'min:0', 'max:100000', 'required_with:latitude,longitude'],
            'geolocation_error' => ['nullable', Rule::in(['denied', 'unavailable', 'timeout'])],
        ]);

        $event = $attendance->recordSelfServicePunch(
            $request->user(),
            $data,
            $request->ip(),
            $request->userAgent()
        );
        $event->loadMissing('site');
        Audit::recordChange($request, 'attendance.event.recorded', $event, [], $event->only([
            'direction', 'effective_at', 'source', 'verification_status', 'site_id',
        ]), ['channel' => 'self_service']);

        $message = ($event->direction === 'in' ? 'Check-in' : 'Check-out').' recorded at '
            .$event->effective_at->setTimezone($event->site->timezone)->format('H:i');
        if ($event->verification_status === 'flagged') {
            $message .= ' and flagged for review.';
            $this->notifyManagerOfFlaggedEvent($event);
        }

        return back()->with('success', $message);
    }

    public function storeSite(Request $request): RedirectResponse
    {
        $this->authorizeSettings($request);
        $data = $this->validateSite($request);
        $qrData = $this->validateQr($request, $data);

        $site = DB::transaction(function () use ($data, $qrData) {
            $site = AttendanceSite::query()->create($data);
            $site->qrCode()->create($qrData);

            return $site;
        });
        Audit::recordChange($request, 'attendance.site.created', $site, [], [
            ...$site->only(array_keys($data)),
            'qr_mode' => $qrData['mode'] ?? null,
            'qr_enabled' => $qrData['is_enabled'] ?? false,
        ]);

        return back()->with('success', 'Attendance branch created.');
    }

    public function updateSite(Request $request, AttendanceSite $site): RedirectResponse
    {
        $this->authorizeSettings($request);
        $data = $this->validateSite($request, $site);
        $qrData = $this->validateQr($request, $data);
        $before = [
            ...$site->only(array_keys($data)),
            'qr_mode' => $site->qrCode?->mode,
            'qr_enabled' => $site->qrCode?->is_enabled,
        ];
        $site->update($data);
        $site->qrCode()->updateOrCreate([], $qrData);
        Audit::recordChange($request, 'attendance.site.updated', $site, $before, [
            ...$site->only(array_keys($data)),
            'qr_mode' => $qrData['mode'] ?? null,
            'qr_enabled' => $qrData['is_enabled'] ?? false,
        ]);

        return back()->with('success', 'Attendance branch updated.');
    }

    public function regenerateQr(
        Request $request,
        AttendanceSite $site,
        AttendanceQrService $qr
    ): RedirectResponse {
        $this->authorizeSettings($request);
        abort_unless($site->qrCode, 422, 'This branch does not have a QR configuration.');
        $qr->regenerate($site->qrCode);
        Audit::record($request, 'attendance.qr.regenerated', $site->qrCode, [
            'site_id' => $site->id,
            'site_name' => $site->name,
            'invalidated_previous_codes' => true,
        ]);

        return back()->with('success', 'QR code regenerated. Previous printouts are now invalid.');
    }

    public function storeSchedule(Request $request): RedirectResponse
    {
        $this->authorizeSettings($request);
        $data = $request->validate([
            'user_id' => ['required', 'exists:users,id'],
            'primary_site_id' => [
                'required',
                Rule::exists('attendance_sites', 'id')->where('is_active', true),
            ],
            'allowed_site_ids' => ['nullable', 'array'],
            'allowed_site_ids.*' => [
                'integer',
                Rule::exists('attendance_sites', 'id')->where('is_active', true),
            ],
            'effective_from' => ['required', 'date', 'after_or_equal:today'],
            'work_start' => ['required', 'date_format:H:i'],
            'lunch_start' => ['required', 'date_format:H:i', 'after:work_start'],
            'lunch_end' => ['required', 'date_format:H:i', 'after:lunch_start'],
            'work_end' => ['required', 'date_format:H:i', 'after:lunch_end'],
        ]);

        abort_if(
            AttendanceSchedule::query()->where('user_id', $data['user_id'])->whereDate('effective_from', $data['effective_from'])->exists(),
            422,
            'An attendance schedule already starts on this date.'
        );
        abort_if(
            $data['effective_from'] === now()->toDateString()
                && AttendanceDay::query()->where('user_id', $data['user_id'])->whereDate('work_date', $data['effective_from'])->exists(),
            422,
            'Today already has an attendance snapshot. Choose a future effective date.'
        );

        $schedule = DB::transaction(function () use ($data, $request) {
            $siteIds = collect($data['allowed_site_ids'] ?? [])->push((int) $data['primary_site_id'])->unique()->all();
            unset($data['allowed_site_ids']);
            $schedule = AttendanceSchedule::query()->create([...$data, 'created_by' => $request->user()->id]);
            $schedule->allowedSites()->sync($siteIds);

            return $schedule;
        });
        Audit::recordChange($request, 'attendance.schedule.created', $schedule, [], [
            ...$schedule->only([
                'user_id', 'primary_site_id', 'effective_from', 'work_start', 'lunch_start', 'lunch_end', 'work_end',
            ]),
            'allowed_site_ids' => $schedule->allowedSites()->pluck('attendance_sites.id')->all(),
        ]);

        return back()->with('success', 'Effective-dated attendance schedule created.');
    }

    public function updateSchedule(Request $request, AttendanceSchedule $schedule): RedirectResponse
    {
        $this->authorizeSettings($request);
        $data = $request->validate([
            'primary_site_id' => [
                'required',
                Rule::exists('attendance_sites', 'id')->where('is_active', true),
            ],
            'allowed_site_ids' => ['nullable', 'array'],
            'allowed_site_ids.*' => [
                'integer',
                Rule::exists('attendance_sites', 'id')->where('is_active', true),
            ],
            'work_start' => ['required', 'date_format:H:i'],
            'lunch_start' => ['required', 'date_format:H:i', 'after:work_start'],
            'lunch_end' => ['required', 'date_format:H:i', 'after:lunch_start'],
            'work_end' => ['required', 'date_format:H:i', 'after:lunch_end'],
        ]);
        $before = $schedule->only([
            'primary_site_id', 'work_start', 'lunch_start', 'lunch_end', 'work_end',
        ]);

        DB::transaction(function () use ($data, $schedule) {
            $siteIds = collect($data['allowed_site_ids'] ?? [])
                ->push((int) $data['primary_site_id'])
                ->unique()
                ->all();
            unset($data['allowed_site_ids']);
            $schedule->update($data);
            $schedule->allowedSites()->sync($siteIds);
        });
        Audit::record($request, 'attendance.schedule.updated', $schedule, [
            'before' => $before,
            'after' => $schedule->fresh()->only([
                'primary_site_id', 'work_start', 'lunch_start', 'lunch_end', 'work_end',
            ]),
        ]);

        return back()->with('success', 'Attendance schedule updated.');
    }

    public function storeManualEvent(Request $request, AttendanceService $attendance): RedirectResponse
    {
        $data = $request->validate([
            'user_id' => ['required', 'exists:users,id'],
            'work_date' => ['required', 'date'],
            'attendance_site_id' => ['required', 'exists:attendance_sites,id'],
            'direction' => ['required', Rule::in(['in', 'out'])],
            'effective_at' => ['required', 'date'],
            'reason' => ['required', 'string', 'max:1000'],
        ]);
        $user = User::query()->findOrFail($data['user_id']);
        $this->authorizeRecord($request, $user);
        $schedule = $attendance->activeSchedule($user, $data['work_date']);
        abort_unless($schedule, 422, 'No schedule applies to that date.');
        $site = AttendanceSite::query()->findOrFail($data['attendance_site_id']);
        $assignedSiteIds = $schedule->allowedSites
            ->pluck('id')
            ->push($schedule->primary_site_id)
            ->unique();
        if (! $site->is_active || ! $assignedSiteIds->contains($site->id)) {
            throw ValidationException::withMessages([
                'attendance_site_id' => 'Select an active branch assigned to this employee.',
            ]);
        }
        $effectiveAt = Carbon::parse($data['effective_at'], $schedule->primarySite->timezone);
        if ($effectiveAt->toDateString() !== $data['work_date']) {
            throw ValidationException::withMessages([
                'effective_at' => 'The event time must fall on the selected work date.',
            ]);
        }
        $day = $attendance->ensureDay(
            $user,
            $schedule,
            Carbon::parse($data['work_date'], $schedule->primarySite->timezone)
        );
        $event = $day->events()->create([
            'user_id' => $user->id,
            'attendance_site_id' => $site->id,
            'direction' => $data['direction'],
            'classification' => 'ordinary',
            'occurred_at' => now(),
            'effective_at' => $effectiveAt->utc(),
            'source' => 'manual',
            'geolocation_status' => 'not_applicable',
            'network_status' => 'not_applicable',
            'site_assignment_status' => 'assigned',
            'verification_status' => 'clean',
            'corrected_by' => $request->user()->id,
            'correction_reason' => $data['reason'],
        ]);
        $attendance->recomputeDay($day);
        Audit::record($request, 'attendance.event.created_manually', $event, ['reason' => $data['reason']]);

        return back()->with('success', 'Manual attendance event added.');
    }

    public function correctEvent(
        Request $request,
        AttendanceEvent $event,
        AttendanceService $attendance
    ): RedirectResponse {
        $event->loadMissing('user');
        $this->authorizeRecord($request, $event->user);
        $data = $request->validate([
            'direction' => ['required', Rule::in(['in', 'out'])],
            'effective_at' => ['required', 'date'],
            'void' => ['required', 'boolean'],
            'reason' => ['required', 'string', 'max:1000'],
        ]);
        $effectiveAt = Carbon::parse($data['effective_at'], $event->day->timezone);
        if ($effectiveAt->toDateString() !== $event->day->work_date->toDateString()) {
            throw ValidationException::withMessages([
                'effective_at' => 'The corrected time must remain on the attendance work date.',
            ]);
        }
        $before = $event->only(['direction', 'effective_at', 'voided_at']);
        $event->update([
            'direction' => $data['direction'],
            'effective_at' => $effectiveAt->utc(),
            'voided_at' => $data['void'] ? now() : null,
            'voided_by' => $data['void'] ? $request->user()->id : null,
            'corrected_by' => $request->user()->id,
            'correction_reason' => $data['reason'],
        ]);
        $attendance->recomputeDay($event->day);
        Audit::record($request, 'attendance.event.corrected', $event, [
            'before' => $before,
            'after' => $event->only(['direction', 'effective_at', 'voided_at']),
            'reason' => $data['reason'],
        ]);

        return back()->with('success', 'Attendance event corrected.');
    }

    public function reviewEvent(
        Request $request,
        AttendanceEvent $event,
        AttendanceService $attendance
    ): RedirectResponse {
        $event->loadMissing('user');
        $this->authorizeRecord($request, $event->user);
        $data = $request->validate(['note' => ['required', 'string', 'max:1000']]);
        $event->update([
            'reviewed_at' => now(),
            'reviewed_by' => $request->user()->id,
            'review_note' => $data['note'],
        ]);
        $attendance->recomputeDay($event->day);
        Audit::record($request, 'attendance.event.reviewed', $event, ['note' => $data['note']]);

        return back()->with('success', 'Attendance flag resolved.');
    }

    public function export(Request $request): StreamedResponse
    {
        abort_unless(
            $request->user()->hasPermission('attendance.records.manage')
                || $request->user()->hasPermission('attendance.team.manage'),
            403
        );
        $data = $request->validate([
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
            'site_id' => ['nullable', 'exists:attendance_sites,id'],
            'status' => ['nullable', Rule::in(['pending', 'complete', 'issues', 'excused'])],
        ]);
        $actor = $request->user();
        $rows = AttendanceDay::query()
            ->with(['user.department', 'primarySite', 'slots.event', 'events'])
            ->whereBetween('work_date', [$data['start_date'], $data['end_date']])
            ->when($data['site_id'] ?? null, fn ($query, $siteId) => $query->where('primary_site_id', $siteId))
            ->when($data['status'] ?? null, fn ($query, $status) => $query->where('status', $status))
            ->when(! $actor->hasPermission('attendance.records.manage'), fn ($query) => $query->whereHas('user', fn ($users) => $users->where('manager_id', $actor->id)))
            ->orderBy('work_date')
            ->orderBy('user_id')
            ->get();

        return response()->streamDownload(function () use ($rows) {
            $out = fopen('php://output', 'w');
            fputcsv($out, ['Date', 'Employee Code', 'Employee', 'Department', 'Branch', 'Day Status', 'Morning In', 'Morning Status', 'Lunch Out', 'Lunch Out Status', 'Lunch In', 'Lunch In Status', 'Final Out', 'Final Status', 'Worked Hours (Break Excluded)', 'Flagged Events']);
            foreach ($rows as $day) {
                $slots = $day->slots->keyBy('type');
                $value = fn (string $type) => $slots[$type]?->event?->effective_at?->setTimezone($day->timezone)->format('H:i:s');
                $morningIn = $slots['morning_in']?->event?->effective_at;
                $lunchOut = $slots['lunch_out']?->event?->effective_at;
                $lunchIn = $slots['lunch_in']?->event?->effective_at;
                $finalOut = $slots['final_out']?->event?->effective_at;
                $workedHours = null;
                if ($morningIn && $lunchOut && $lunchIn && $finalOut) {
                    $workedSeconds = max(0, $lunchOut->getTimestamp() - $morningIn->getTimestamp())
                        + max(0, $finalOut->getTimestamp() - $lunchIn->getTimestamp());
                    $workedHours = round($workedSeconds / 3600, 2);
                }
                fputcsv($out, [
                    $day->work_date->toDateString(), $day->user?->employee_code, $day->user?->name,
                    $day->user?->department?->name, $day->primarySite?->name, $day->status,
                    $value('morning_in'), $slots['morning_in']?->status,
                    $value('lunch_out'), $slots['lunch_out']?->status,
                    $value('lunch_in'), $slots['lunch_in']?->status,
                    $value('final_out'), $slots['final_out']?->status,
                    $workedHours,
                    $day->events->where('verification_status', 'flagged')->whereNull('reviewed_at')->count(),
                ]);
            }
            fclose($out);
        }, 'attendance-'.$data['start_date'].'-'.$data['end_date'].'.csv', ['Content-Type' => 'text/csv']);
    }

    private function authorizeSettings(Request $request): void
    {
        abort_unless($request->user()->hasPermission('attendance.settings.manage'), 403);
    }

    private function attendanceUnavailableReason(
        ?AttendanceSchedule $schedule,
        ?AttendanceDay $day,
        ?string $nextDirection
    ): ?string {
        if (! $schedule) {
            return 'No active attendance schedule';
        }
        if (! $day?->excuse_type) {
            return $nextDirection ? null : 'No attendance actions remaining today';
        }

        return match ($day->excuse_type) {
            'weekend' => 'Attendance is unavailable on weekends',
            'public_holiday' => 'Attendance is unavailable on public holidays',
            'approved_leave' => 'Attendance is unavailable during approved leave',
            default => 'Attendance is unavailable today',
        };
    }

    private function notifyManagerOfFlaggedEvent(AttendanceEvent $event): void
    {
        $event->loadMissing(['user.manager', 'site', 'day']);
        $manager = $event->user->manager;
        if (! $manager) {
            return;
        }

        $actionUrl = route('attendance.index', ['tab' => 'team']).'&event='.$event->id;
        $notification = SystemNotification::query()->firstOrCreate(
            [
                'user_id' => $manager->id,
                'type' => 'attendance_flagged',
                'action_url' => $actionUrl,
            ],
            [
                'title' => 'Flagged attendance '.($event->direction === 'in' ? 'check-in' : 'check-out'),
                'body' => $event->user->name.' recorded a flagged '.$event->direction.' at '
                    .($event->site?->name ?? 'an unknown branch').'.',
            ]
        );

        if ($notification->wasRecentlyCreated) {
            $manager->notify(new AttendanceFlagged($event));
        }
    }

    private function authorizeRecord(Request $request, User $employee): void
    {
        $actor = $request->user();
        abort_unless(
            $actor->hasPermission('attendance.records.manage')
                || ($actor->hasPermission('attendance.team.manage') && $employee->manager_id === $actor->id),
            403
        );
    }

    private function validateSite(Request $request, ?AttendanceSite $site = null): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'code' => ['required', 'string', 'max:30', Rule::unique('attendance_sites', 'code')->ignore($site)],
            'timezone' => ['required', 'timezone:all'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90', 'required_with:longitude'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180', 'required_with:latitude'],
            'acceptance_radius_meters' => ['required', 'integer', 'min:10', 'max:5000'],
            'maximum_accuracy_meters' => ['required', 'integer', 'min:5', 'max:5000'],
            'allowed_ip_ranges' => ['nullable', 'array'],
            'allowed_ip_ranges.*' => ['string', 'max:80', function ($attribute, $value, $fail) {
                $parts = explode('/', $value, 2);
                if (! filter_var($parts[0], FILTER_VALIDATE_IP)) {
                    $fail('Each IP range must be an IPv4 or IPv6 address with an optional CIDR prefix.');
                }
                if (isset($parts[1]) && (! ctype_digit($parts[1]) || (int) $parts[1] > (str_contains($parts[0], ':') ? 128 : 32))) {
                    $fail('The CIDR prefix is invalid.');
                }
            }],
            'is_active' => ['required', 'boolean'],
        ]);
    }

    private function validateQr(Request $request, array $siteData): array
    {
        $data = $request->validate([
            'qr_mode' => ['required', Rule::in(['static', 'daily'])],
            'qr_enabled' => ['required', 'boolean'],
        ]);
        if ($data['qr_enabled'] && ! (
            isset($siteData['latitude'], $siteData['longitude'])
            || count($siteData['allowed_ip_ranges'] ?? []) > 0
        )) {
            throw ValidationException::withMessages([
                'qr_enabled' => 'Configure coordinates or an allowed IP range before enabling QR attendance.',
            ]);
        }

        return ['mode' => $data['qr_mode'], 'is_enabled' => $data['qr_enabled']];
    }
}
