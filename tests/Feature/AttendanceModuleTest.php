<?php

namespace Tests\Feature;

use App\Models\AttendanceDay;
use App\Models\AttendanceQrCode;
use App\Models\AttendanceSchedule;
use App\Models\AttendanceSite;
use App\Models\User;
use App\Notifications\AttendanceFlagged;
use App\Notifications\Channels\TelegramChannel;
use App\Services\AttendanceQrService;
use App\Services\AttendanceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Tests\TestCase;

class AttendanceModuleTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_four_punches_are_classified_into_daily_milestones(): void
    {
        [$user, $site, $schedule, $code] = $this->attendanceSetup();
        $service = app(AttendanceService::class);

        $this->punchAt($service, $user, $code, '2026-07-29 08:00:00', 1);
        $lunchOut = $this->punchAt($service, $user, $code, '2026-07-29 11:45:00', 2);
        $lunchIn = $this->punchAt($service, $user, $code, '2026-07-29 12:45:00', 3);
        $this->punchAt($service, $user, $code, '2026-07-29 17:00:00', 4);

        $day = AttendanceDay::query()->with(['slots.event', 'events'])->firstOrFail();
        $this->assertCount(4, $day->events, 'All four distinct punches should be persisted.');
        $slots = $day->slots->keyBy('type');

        $this->assertSame('lunch_out', $lunchOut->fresh()->classification);
        $this->assertSame('lunch_in', $lunchIn->fresh()->classification);
        $this->assertSame('on_time', $slots['morning_in']->status);
        $this->assertSame('early', $slots['lunch_out']->status);
        $this->assertSame('on_time', $slots['lunch_in']->status);
        $this->assertSame('on_time', $slots['final_out']->status);
        $this->assertSame('issues', $day->status);
    }

    public function test_punch_preview_uses_the_same_milestone_and_timing_rules_as_recording(): void
    {
        [$user, $site, $schedule, $code] = $this->attendanceSetup();
        $service = app(AttendanceService::class);
        Carbon::setTestNow(Carbon::parse('2026-07-29 08:01:00', $site->timezone)->utc());
        $day = $service->ensureDay($user, $schedule, now($site->timezone));

        $this->assertSame('morning_in', $service->previewNextPunch($day)['classification']);
        $this->assertSame('late', $service->previewNextPunch($day)['status']);

        $this->punchAt($service, $user, $code, '2026-07-29 08:01:00', 1);
        Carbon::setTestNow(Carbon::parse('2026-07-29 11:45:00', $site->timezone)->utc());
        $this->assertSame('lunch_out', $service->previewNextPunch($day->fresh())['classification']);
        $this->assertSame('early', $service->previewNextPunch($day->fresh())['status']);

        $this->punchAt($service, $user, $code, '2026-07-29 11:45:00', 2);
        Carbon::setTestNow(Carbon::parse('2026-07-29 12:45:00', $site->timezone)->utc());
        $this->assertSame('lunch_in', $service->previewNextPunch($day->fresh())['classification']);
        $this->assertSame('on_time', $service->previewNextPunch($day->fresh())['status']);

        $this->punchAt($service, $user, $code, '2026-07-29 12:45:00', 3);
        Carbon::setTestNow(Carbon::parse('2026-07-29 12:46:00', $site->timezone)->utc());
        $this->assertSame('final_out', $service->previewNextPunch($day->fresh())['classification']);
        $this->assertSame('early', $service->previewNextPunch($day->fresh())['status']);
    }

    public function test_non_qualifying_exit_return_pairs_remain_ordinary_and_lunch_is_missing_after_finalization(): void
    {
        [$user, $site, $schedule, $code] = $this->attendanceSetup();
        $service = app(AttendanceService::class);

        $this->punchAt($service, $user, $code, '2026-07-29 08:00:00', 1);
        $ordinaryOut = $this->punchAt($service, $user, $code, '2026-07-29 10:30:00', 2);
        $this->punchAt($service, $user, $code, '2026-07-29 10:45:00', 3);
        $shortLunchOut = $this->punchAt($service, $user, $code, '2026-07-29 11:50:00', 4);
        $this->punchAt($service, $user, $code, '2026-07-29 11:55:00', 5);
        $this->punchAt($service, $user, $code, '2026-07-29 17:00:00', 6);

        $day = AttendanceDay::query()->firstOrFail();
        $day->update(['finalized_at' => now()]);
        $service->recomputeDay($day);
        $slots = $day->fresh()->slots->keyBy('type');

        $this->assertSame('ordinary', $ordinaryOut->fresh()->classification);
        $this->assertSame('ordinary', $shortLunchOut->fresh()->classification);
        $this->assertSame('missing', $slots['lunch_out']->status);
        $this->assertSame('missing', $slots['lunch_in']->status);
    }

    public function test_unmatched_exit_during_lunch_window_is_immediately_classified_as_lunch_out(): void
    {
        [$user, $site, $schedule, $code] = $this->attendanceSetup();
        $service = app(AttendanceService::class);

        $this->punchAt($service, $user, $code, '2026-07-29 11:43:00', 1);
        $lunchOut = $this->punchAt($service, $user, $code, '2026-07-29 12:41:00', 2);

        $day = AttendanceDay::query()->with(['slots.event', 'events'])->firstOrFail();
        $slots = $day->slots->keyBy('type');

        $this->assertSame('lunch_out', $lunchOut->fresh()->classification);
        $this->assertSame($lunchOut->id, $slots['lunch_out']->attendance_event_id);
        $this->assertSame('on_time', $slots['lunch_out']->status);
        $this->assertSame('pending', $slots['lunch_in']->status);
        $this->assertSame('issues', $day->status, 'The late morning check-in remains an issue.');
    }

    public function test_short_lunch_after_noon_still_populates_both_lunch_milestones(): void
    {
        [$user, $site, $schedule, $code] = $this->attendanceSetup();
        $service = app(AttendanceService::class);

        $this->punchAt($service, $user, $code, '2026-07-29 11:43:00', 1);
        $lunchOut = $this->punchAt($service, $user, $code, '2026-07-29 12:41:00', 2);
        $lunchIn = $this->punchAt($service, $user, $code, '2026-07-29 12:43:00', 3);

        $slots = AttendanceDay::query()->with('slots.event')->firstOrFail()->slots->keyBy('type');

        $this->assertSame('lunch_out', $lunchOut->fresh()->classification);
        $this->assertSame('lunch_in', $lunchIn->fresh()->classification);
        $this->assertSame($lunchOut->id, $slots['lunch_out']->attendance_event_id);
        $this->assertSame($lunchIn->id, $slots['lunch_in']->attendance_event_id);
        $this->assertSame('on_time', $slots['lunch_out']->status);
        $this->assertSame('on_time', $slots['lunch_in']->status);
    }

    public function test_next_exit_after_completed_lunch_is_final_out_even_before_lunch_end(): void
    {
        [$user, $site, $schedule, $code] = $this->attendanceSetup();
        $service = app(AttendanceService::class);

        $this->punchAt($service, $user, $code, '2026-07-29 11:43:00', 1);
        $this->punchAt($service, $user, $code, '2026-07-29 12:41:00', 2);
        $this->punchAt($service, $user, $code, '2026-07-29 12:43:00', 3);
        $finalOut = $this->punchAt($service, $user, $code, '2026-07-29 12:44:00', 4);

        $day = AttendanceDay::query()->with('slots.event')->firstOrFail();
        $slots = $day->slots->keyBy('type');

        $this->assertSame('final_out', $finalOut->fresh()->classification);
        $this->assertSame($finalOut->id, $slots['final_out']->attendance_event_id);
        $this->assertSame('early', $slots['final_out']->status);
        $this->assertSame('issues', $day->status);
        $this->assertNull($service->nextSelfServiceDirection($day));
    }

    public function test_first_scan_after_lunch_is_final_out_and_passed_milestones_are_missing(): void
    {
        [$user, $site, $schedule, $code] = $this->attendanceSetup();
        $event = $this->punchAt(
            app(AttendanceService::class),
            $user,
            $code,
            '2026-07-29 15:18:00',
            1
        );

        $day = AttendanceDay::query()->with('slots')->firstOrFail();
        $slots = $day->slots->keyBy('type');

        $this->assertSame('out', $event->direction);
        $this->assertSame('final_out', $event->fresh()->classification);
        $this->assertSame('missing', $slots['morning_in']->status);
        $this->assertSame('missing', $slots['lunch_out']->status);
        $this->assertSame('missing', $slots['lunch_in']->status);
        $this->assertSame('early', $slots['final_out']->status);
        $this->assertSame('issues', $day->status);
    }

    public function test_first_check_in_during_lunch_return_window_is_lunch_in_with_prior_milestones_missing(): void
    {
        [$user, $site, $schedule, $code] = $this->attendanceSetup();
        $service = app(AttendanceService::class);
        Carbon::setTestNow(Carbon::parse('2026-07-29 12:54:00', $site->timezone)->utc());
        $day = $service->ensureDay($user, $schedule, now($site->timezone));

        $preview = $service->previewNextPunch($day);
        $this->assertSame('lunch_in', $preview['classification']);
        $this->assertSame('on_time', $preview['status']);

        $lunchIn = $this->punchAt($service, $user, $code, '2026-07-29 12:54:00', 1);
        $slots = $day->fresh()->slots->keyBy('type');

        $this->assertSame('in', $lunchIn->direction);
        $this->assertSame('lunch_in', $lunchIn->fresh()->classification);
        $this->assertSame('missing', $slots['morning_in']->status);
        $this->assertSame('missing', $slots['lunch_out']->status);
        $this->assertSame('on_time', $slots['lunch_in']->status);
        $this->assertSame('pending', $slots['final_out']->status);
        $this->assertSame('issues', $day->fresh()->status);
    }

    public function test_lunch_in_remains_available_and_pending_during_late_return_window(): void
    {
        [$user, $site, $schedule, $code] = $this->attendanceSetup();
        $service = app(AttendanceService::class);
        Carbon::setTestNow(Carbon::parse('2026-07-29 13:01:00', $site->timezone)->utc());
        $day = $service->ensureDay($user, $schedule, now($site->timezone));
        $service->finalizeIfDue($day);

        $slots = $day->fresh()->slots->keyBy('type');
        $preview = $service->previewNextPunch($day->fresh());

        $this->assertSame('missing', $slots['morning_in']->status);
        $this->assertSame('missing', $slots['lunch_out']->status);
        $this->assertSame('pending', $slots['lunch_in']->status);
        $this->assertSame('pending', $slots['final_out']->status);
        $this->assertSame('in', $service->nextDirection($day));
        $this->assertSame('lunch_in', $preview['classification']);
        $this->assertSame('late', $preview['status']);

        $lunchIn = $this->punchAt($service, $user, $code, '2026-07-29 13:01:00', 1);
        $this->assertSame('lunch_in', $lunchIn->fresh()->classification);
        $this->assertSame('late', $day->fresh()->slots->firstWhere('type', 'lunch_in')->status);
    }

    public function test_elapsed_milestones_are_missing_after_lunch_even_without_punches(): void
    {
        [$user, $site, $schedule] = $this->attendanceSetup();
        Carbon::setTestNow(Carbon::parse('2026-07-29 14:00:00', $site->timezone)->utc());
        $service = app(AttendanceService::class);
        $day = $service->ensureDay($user, $schedule, now()->setTimezone($site->timezone));

        $service->finalizeIfDue($day);

        $slots = $day->fresh()->slots->keyBy('type');
        $this->assertSame('missing', $slots['morning_in']->status);
        $this->assertSame('missing', $slots['lunch_out']->status);
        $this->assertSame('missing', $slots['lunch_in']->status);
        $this->assertSame('pending', $slots['final_out']->status);
        $this->assertSame('issues', $day->fresh()->status);
        $this->assertSame('out', $service->nextDirection($day->fresh()));
    }

    public function test_office_ip_can_verify_a_punch_when_location_is_denied(): void
    {
        [$user, $site, $schedule, $code] = $this->attendanceSetup(['allowed_ip_ranges' => ['203.0.113.0/24']]);
        Carbon::setTestNow(Carbon::parse('2026-07-29 08:00:00', $site->timezone)->utc());

        $event = app(AttendanceService::class)->recordPunch(
            $user,
            $code,
            ['idempotency_key' => (string) Str::uuid(), 'geolocation_error' => 'denied'],
            '203.0.113.42',
            'PHPUnit'
        );

        $this->assertSame('denied', $event->geolocation_status);
        $this->assertSame('passed', $event->network_status);
        $this->assertSame('clean', $event->verification_status);
    }

    public function test_employee_can_use_the_self_service_attendance_action_from_the_dashboard(): void
    {
        [$user, $site] = $this->attendanceSetup();
        Carbon::setTestNow(Carbon::parse('2026-07-29 08:00:00', $site->timezone)->utc());

        $this->actingAs($user)
            ->from(route('dashboard'))
            ->post(route('attendance.punch.store'), [
                'idempotency_key' => (string) Str::uuid(),
                'latitude' => $site->latitude,
                'longitude' => $site->longitude,
                'accuracy_meters' => 10,
            ])
            ->assertRedirect(route('dashboard'))
            ->assertSessionHas('success', 'Check-in recorded at 08:00');

        $this->assertDatabaseHas('attendance_events', [
            'user_id' => $user->id,
            'attendance_site_id' => $site->id,
            'attendance_qr_code_id' => null,
            'direction' => 'in',
            'source' => 'self_service',
            'verification_status' => 'clean',
        ]);

        $this->actingAs($user)
            ->get(route('dashboard'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Dashboard')
                ->where('attendanceAction.direction', 'out')
                ->where('attendanceAction.branch_name', $site->name)
                ->where('attendanceAction.unavailable_reason', null)
            );
    }

    public function test_second_punch_during_cooldown_is_explained_instead_of_silently_returning_the_previous_event(): void
    {
        [$user, $site] = $this->attendanceSetup();
        $firstPunchAt = Carbon::parse('2026-07-29 08:00:00', $site->timezone)->utc();
        Carbon::setTestNow($firstPunchAt);

        $payload = [
            'latitude' => $site->latitude,
            'longitude' => $site->longitude,
            'accuracy_meters' => 10,
        ];

        $this->actingAs($user)->post(route('attendance.punch.store'), [
            ...$payload,
            'idempotency_key' => (string) Str::uuid(),
        ])->assertSessionHasNoErrors();

        Carbon::setTestNow($firstPunchAt->copy()->addSeconds(5));

        $this->actingAs($user)
            ->from(route('attendance.index'))
            ->post(route('attendance.punch.store'), [
                ...$payload,
                'idempotency_key' => (string) Str::uuid(),
            ])
            ->assertRedirect(route('attendance.index'))
            ->assertSessionHasErrors([
                'attendance' => 'Your previous punch was recorded. Please wait 25 seconds before the next action.',
            ]);

        $this->assertDatabaseCount('attendance_events', 1);
        $this->actingAs($user)
            ->get(route('attendance.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('nextDirection', 'out')
                ->where('punchCooldownUntil', $firstPunchAt->copy()->addSeconds(30)->toIso8601String())
            );

        Carbon::setTestNow($firstPunchAt->copy()->addSeconds(30));
        $this->actingAs($user)->post(route('attendance.punch.store'), [
            ...$payload,
            'idempotency_key' => (string) Str::uuid(),
        ])->assertSessionHasNoErrors();

        $this->assertDatabaseCount('attendance_events', 2);
        $this->assertDatabaseHas('attendance_events', [
            'user_id' => $user->id,
            'direction' => 'out',
            'source' => 'self_service',
        ]);
    }

    public function test_self_service_attendance_is_unavailable_on_an_excused_day(): void
    {
        [$user, $site] = $this->attendanceSetup();
        Carbon::setTestNow(Carbon::parse('2026-08-01 08:00:00', $site->timezone)->utc());

        $this->actingAs($user)
            ->from(route('attendance.index'))
            ->post(route('attendance.punch.store'), [
                'idempotency_key' => (string) Str::uuid(),
                'latitude' => $site->latitude,
                'longitude' => $site->longitude,
                'accuracy_meters' => 10,
            ])
            ->assertRedirect(route('attendance.index'))
            ->assertSessionHasErrors([
                'attendance' => 'Attendance actions are unavailable on an excused day.',
            ]);

        $this->assertDatabaseCount('attendance_events', 0);
        $this->actingAs($user)
            ->get(route('attendance.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('nextDirection', null)
                ->where('attendanceUnavailableReason', 'Attendance is unavailable on weekends')
            );
    }

    public function test_self_service_action_stops_after_the_final_checkout(): void
    {
        [$user, $site, $schedule, $code] = $this->attendanceSetup();
        $service = app(AttendanceService::class);

        $this->punchAt($service, $user, $code, '2026-07-29 08:00:00', 1);
        $this->punchAt($service, $user, $code, '2026-07-29 12:00:00', 2);
        $this->punchAt($service, $user, $code, '2026-07-29 13:00:00', 3);
        $this->punchAt($service, $user, $code, '2026-07-29 17:00:00', 4);

        $day = AttendanceDay::query()->firstOrFail();
        $this->assertNull($service->nextSelfServiceDirection($day));

        $this->actingAs($user)
            ->from(route('attendance.index'))
            ->post(route('attendance.punch.store'), [
                'idempotency_key' => (string) Str::uuid(),
                'latitude' => $site->latitude,
                'longitude' => $site->longitude,
                'accuracy_meters' => 10,
            ])
            ->assertRedirect(route('attendance.index'))
            ->assertSessionHasErrors([
                'attendance' => 'No attendance actions remain for today.',
            ]);

        $this->assertDatabaseCount('attendance_events', 4);
        $this->actingAs($user)
            ->get(route('attendance.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('nextDirection', null)
                ->where('attendanceUnavailableReason', 'No attendance actions remaining today')
            );
        $this->actingAs($user)
            ->get(route('dashboard'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->where('attendanceAction.direction', null));
    }

    public function test_daily_qr_requires_authentication_and_the_current_token(): void
    {
        [$user, $site, $schedule, $code] = $this->attendanceSetup();
        Carbon::setTestNow(Carbon::parse('2026-07-29 08:00:00', $site->timezone)->utc());
        $token = app(AttendanceQrService::class)->token($code);

        $this->get(route('attendance.scan', ['qrCode' => $code, 'token' => $token]))
            ->assertRedirect(route('login'));

        $this->actingAs($user)
            ->get(route('attendance.scan', ['qrCode' => $code, 'token' => 'tampered']))
            ->assertNotFound();

        $this->actingAs($user)
            ->get(route('attendance.scan', ['qrCode' => $code, 'token' => $token]))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('AttendanceScan')
                ->where('direction', 'in')
                ->where('punchPreview.classification', 'morning_in')
                ->where('punchPreview.status', 'on_time')
            );
    }

    public function test_admin_can_render_the_current_qr_as_svg_and_daily_token_expires(): void
    {
        [$user, $site, $schedule, $code] = $this->attendanceSetup();
        $admin = User::factory()->create(['role' => 'admin']);
        $service = app(AttendanceQrService::class);
        Carbon::setTestNow(Carbon::parse('2026-07-29 08:00:00', $site->timezone)->utc());
        $token = $service->token($code);

        $this->actingAs($admin)
            ->get(route('attendance.qr.image', ['qrCode' => $code, 'token' => $token]))
            ->assertOk()
            ->assertHeader('Content-Type', 'image/svg+xml');

        Carbon::setTestNow(Carbon::parse('2026-07-30 08:00:00', $site->timezone)->utc());
        $this->assertFalse($service->isValid($code, $token));
    }

    public function test_inactive_site_rejects_qr_and_self_service_punches(): void
    {
        [$user, $site, $schedule, $code] = $this->attendanceSetup();
        Carbon::setTestNow(Carbon::parse('2026-07-29 08:00:00', $site->timezone)->utc());
        $token = app(AttendanceQrService::class)->token($code);
        $site->update(['is_active' => false]);

        $this->actingAs($user)
            ->get(route('attendance.scan', ['qrCode' => $code, 'token' => $token]))
            ->assertNotFound();

        $this->actingAs($user)
            ->post(route('attendance.punch.store'), [
                'idempotency_key' => (string) Str::uuid(),
            ])
            ->assertSessionHasErrors([
                'attendance' => 'Your attendance branch is inactive.',
            ]);

        $this->assertDatabaseCount('attendance_events', 0);
    }

    public function test_site_qr_configuration_failure_is_returned_as_a_form_error(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);

        $this->actingAs($admin)
            ->from(route('attendance.index'))
            ->post(route('attendance.sites.store'), [
                'name' => 'Unverified office',
                'code' => 'UNVERIFIED',
                'timezone' => 'Asia/Phnom_Penh',
                'latitude' => null,
                'longitude' => null,
                'acceptance_radius_meters' => 150,
                'maximum_accuracy_meters' => 100,
                'allowed_ip_ranges' => [],
                'is_active' => true,
                'qr_mode' => 'daily',
                'qr_enabled' => true,
            ])
            ->assertRedirect(route('attendance.index'))
            ->assertSessionHasErrors([
                'qr_enabled' => 'Configure coordinates or an allowed IP range before enabling QR attendance.',
            ]);
    }

    public function test_manager_can_correct_direct_report_but_not_another_employee(): void
    {
        $manager = User::factory()->create(['role' => 'manager']);
        [$directReport, $site, $schedule, $code] = $this->attendanceSetup([], ['manager_id' => $manager->id]);
        [$otherUser, $otherSite, $otherSchedule, $otherCode] = $this->attendanceSetup(['code' => 'OTHER'], []);
        $directEvent = $this->punchAt(app(AttendanceService::class), $directReport, $code, '2026-07-29 08:00:00', 1);
        $otherEvent = $this->punchAt(app(AttendanceService::class), $otherUser, $otherCode, '2026-07-29 08:00:00', 2);

        $payload = [
            'direction' => 'in',
            'effective_at' => '2026-07-29T08:05',
            'void' => false,
            'reason' => 'Verified against office register',
        ];

        $this->actingAs($manager)->patch(route('attendance.events.correct', $directEvent), $payload)
            ->assertRedirect()
            ->assertSessionHasNoErrors();
        $this->actingAs($manager)->patch(route('attendance.events.correct', $otherEvent), $payload)
            ->assertForbidden();
    }

    public function test_manual_events_require_an_assigned_active_site_and_matching_work_date(): void
    {
        [$user, $site] = $this->attendanceSetup();
        $admin = User::factory()->create(['role' => 'admin']);
        $otherSite = AttendanceSite::query()->create([
            'name' => 'Other Office',
            'code' => 'UNASSIGNED',
            'timezone' => 'Asia/Phnom_Penh',
            'is_active' => true,
        ]);
        $basePayload = [
            'user_id' => $user->id,
            'work_date' => '2026-07-29',
            'direction' => 'in',
            'effective_at' => '2026-07-29T08:00',
            'reason' => 'Verified against office register',
        ];

        $this->actingAs($admin)
            ->post(route('attendance.events.manual'), [
                ...$basePayload,
                'attendance_site_id' => $otherSite->id,
            ])
            ->assertSessionHasErrors([
                'attendance_site_id' => 'Select an active branch assigned to this employee.',
            ]);

        $this->actingAs($admin)
            ->post(route('attendance.events.manual'), [
                ...$basePayload,
                'attendance_site_id' => $site->id,
                'effective_at' => '2026-07-30T08:00',
            ])
            ->assertSessionHasErrors([
                'effective_at' => 'The event time must fall on the selected work date.',
            ]);

        $this->assertDatabaseCount('attendance_events', 0);
    }

    public function test_correction_cannot_move_an_event_to_another_work_date(): void
    {
        $manager = User::factory()->create(['role' => 'manager']);
        [$user, $site, $schedule, $code] = $this->attendanceSetup([], ['manager_id' => $manager->id]);
        $event = $this->punchAt(
            app(AttendanceService::class),
            $user,
            $code,
            '2026-07-29 08:00:00',
            1
        );

        $this->actingAs($manager)
            ->patch(route('attendance.events.correct', $event), [
                'direction' => 'in',
                'effective_at' => '2026-07-30T08:00',
                'void' => false,
                'reason' => 'Incorrect date',
            ])
            ->assertSessionHasErrors([
                'effective_at' => 'The corrected time must remain on the attendance work date.',
            ]);

        $this->assertSame(
            '2026-07-29',
            $event->fresh()->effective_at->setTimezone($site->timezone)->toDateString()
        );
    }

    public function test_new_schedule_does_not_rewrite_an_existing_day_snapshot(): void
    {
        [$user, $site, $schedule] = $this->attendanceSetup();
        $service = app(AttendanceService::class);
        $day = $service->ensureDay($user, $schedule, Carbon::parse('2026-07-29', $site->timezone));
        $snapshot = $day->schedule_snapshot;

        AttendanceSchedule::query()->create([
            'user_id' => $user->id,
            'primary_site_id' => $site->id,
            'effective_from' => '2026-07-30',
            'work_start' => '09:00',
            'lunch_start' => '12:00',
            'lunch_end' => '13:00',
            'work_end' => '18:00',
        ])->allowedSites()->sync([$site->id]);

        $this->assertSame($snapshot, $day->fresh()->schedule_snapshot);
        $this->assertSame('08:00', $day->fresh()->schedule_snapshot['work_start']);
    }

    public function test_admin_can_update_a_staff_schedule_without_exposing_internal_tolerance_fields(): void
    {
        [$user, $site, $schedule] = $this->attendanceSetup();
        $admin = User::factory()->create(['role' => 'admin']);
        $otherSite = AttendanceSite::query()->create([
            'name' => 'Branch Office',
            'code' => 'BRANCH',
            'timezone' => 'Asia/Phnom_Penh',
            'acceptance_radius_meters' => 150,
            'maximum_accuracy_meters' => 100,
            'allowed_ip_ranges' => [],
            'is_active' => true,
        ]);

        $this->actingAs($admin)->patch(route('attendance.schedules.update', $schedule), [
            'primary_site_id' => $otherSite->id,
            'allowed_site_ids' => [$site->id],
            'work_start' => '08:30',
            'lunch_start' => '12:00',
            'lunch_end' => '13:00',
            'work_end' => '17:30',
        ])->assertRedirect()->assertSessionHasNoErrors();

        $schedule->refresh();
        $this->assertSame($otherSite->id, $schedule->primary_site_id);
        $this->assertSame('08:30', $schedule->work_start);
        $this->assertSame(15, $schedule->lunch_classification_lead_minutes);
        $this->assertSame(0, $schedule->grace_minutes);
        $this->assertEqualsCanonicalizing(
            [$site->id, $otherSite->id],
            $schedule->allowedSites()->pluck('attendance_sites.id')->all()
        );
    }

    public function test_flagged_scan_notifies_the_employee_manager_once_by_email_telegram_and_in_app(): void
    {
        Notification::fake();
        $manager = User::factory()->create(['role' => 'manager']);
        [$user, $site, $schedule, $code] = $this->attendanceSetup([], ['manager_id' => $manager->id]);
        Carbon::setTestNow(Carbon::parse('2026-07-29 15:18:00', $site->timezone)->utc());
        $token = app(AttendanceQrService::class)->token($code);
        $idempotencyKey = (string) Str::uuid();
        $payload = [
            'token' => $token,
            'idempotency_key' => $idempotencyKey,
            'geolocation_error' => 'denied',
        ];

        $this->actingAs($user)->post(route('attendance.scan.store', $code), $payload)->assertRedirect();
        $this->actingAs($user)->post(route('attendance.scan.store', $code), $payload)->assertRedirect();

        Notification::assertSentToTimes($manager, AttendanceFlagged::class, 1);
        Notification::assertSentTo($manager, AttendanceFlagged::class, function (AttendanceFlagged $notification, array $channels): bool {
            return in_array('mail', $channels, true) && in_array(TelegramChannel::class, $channels, true);
        });
        $this->assertDatabaseCount('system_notifications', 1);
        $this->assertDatabaseHas('system_notifications', [
            'user_id' => $manager->id,
            'type' => 'attendance_flagged',
            'title' => 'Flagged attendance check-out',
        ]);
    }

    public function test_team_records_materialize_every_direct_report_for_the_selected_historical_date(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-07-30 10:00:00', 'Asia/Phnom_Penh')->utc());
        $manager = User::factory()->create(['role' => 'manager']);
        [$firstReport] = $this->attendanceSetup([], ['manager_id' => $manager->id]);
        [$secondReport] = $this->attendanceSetup([], ['manager_id' => $manager->id]);
        [$otherEmployee] = $this->attendanceSetup();

        $this->actingAs($manager)
            ->get(route('attendance.index', ['attendance_date' => '2026-07-29', 'tab' => 'records']))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Attendance')
                ->where('selectedDate', '2026-07-29')
                ->has('records', 2)
                ->where('records.0.user.id', $firstReport->id)
                ->where('records.1.user.id', $secondReport->id)
                ->where('records.0.status', 'issues')
                ->where('records.1.status', 'issues')
                ->has('teamToday', 2)
                ->where(
                    'teamToday',
                    fn ($entries) => $entries->pluck('user.id')->sort()->values()->all()
                        === collect([$firstReport->id, $secondReport->id])->sort()->values()->all()
                )
            );

        $this->assertTrue(AttendanceDay::query()->where('user_id', $firstReport->id)->whereDate('work_date', '2026-07-29')->exists());
        $this->assertTrue(AttendanceDay::query()->where('user_id', $secondReport->id)->whereDate('work_date', '2026-07-29')->exists());
        $this->assertFalse(AttendanceDay::query()->where('user_id', $otherEmployee->id)->whereDate('work_date', '2026-07-29')->exists());
    }

    public function test_team_records_reject_a_future_date(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-07-30 10:00:00', 'Asia/Phnom_Penh')->utc());
        $manager = User::factory()->create(['role' => 'manager']);

        $this->actingAs($manager)
            ->get(route('attendance.index', ['attendance_date' => '2026-07-31', 'tab' => 'records']))
            ->assertRedirect()
            ->assertSessionHasErrors('attendance_date');
    }

    public function test_personal_history_can_be_loaded_for_a_previous_month(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-09-15 10:00:00', 'Asia/Phnom_Penh')->utc());
        [$user, $site, $schedule] = $this->attendanceSetup();
        $service = app(AttendanceService::class);
        $service->ensureDay($user, $schedule, Carbon::parse('2026-08-04', $site->timezone));
        $service->ensureDay($user, $schedule, Carbon::parse('2026-08-18', $site->timezone));
        $service->ensureDay($user, $schedule, Carbon::parse('2026-08-01', $site->timezone));
        $service->ensureDay($user, $schedule, Carbon::parse('2026-08-02', $site->timezone));
        $service->ensureDay($user, $schedule, Carbon::parse('2026-09-01', $site->timezone));

        $this->actingAs($user)
            ->get(route('attendance.index', ['history_month' => '2026-08', 'tab' => 'history']))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Attendance')
                ->where('selectedHistoryMonth', '2026-08')
                ->has('historyRecords', 2)
                ->where('historyRecords.0.work_date', '2026-08-18T00:00:00.000000Z')
                ->where('historyRecords.1.work_date', '2026-08-04T00:00:00.000000Z')
            );
    }

    public function test_manager_can_filter_history_by_direct_report(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-09-15 10:00:00', 'Asia/Phnom_Penh')->utc());
        $manager = User::factory()->create(['role' => 'manager']);
        [$directReport, $site, $schedule] = $this->attendanceSetup([], ['manager_id' => $manager->id]);
        $day = app(AttendanceService::class)->ensureDay(
            $directReport,
            $schedule,
            Carbon::parse('2026-09-14', $site->timezone)
        );

        $this->actingAs($manager)
            ->get(route('attendance.index', [
                'tab' => 'history',
                'history_month' => '2026-09',
                'history_user_id' => $directReport->id,
            ]))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Attendance')
                ->where('selectedHistoryUser.id', $directReport->id)
                ->where('historyRecords.0.id', $day->id)
                ->has('historyUsers', 2)
                ->where('historyUsers', fn ($users) => $users->contains('id', $directReport->id))
            );
    }

    public function test_manager_cannot_view_history_for_someone_outside_their_team(): void
    {
        $manager = User::factory()->create(['role' => 'manager']);
        $otherEmployee = User::factory()->create(['role' => 'staff', 'is_active' => true]);

        $this->actingAs($manager)
            ->get(route('attendance.index', [
                'tab' => 'history',
                'history_user_id' => $otherEmployee->id,
            ]))
            ->assertRedirect()
            ->assertSessionHasErrors('history_user_id');
    }

    public function test_personal_record_can_be_selected_by_weekday_date(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-09-15 10:00:00', 'Asia/Phnom_Penh')->utc());
        [$user, $site, $schedule] = $this->attendanceSetup();
        $day = app(AttendanceService::class)->ensureDay(
            $user,
            $schedule,
            Carbon::parse('2026-09-14', $site->timezone)
        );

        $this->actingAs($user)
            ->get(route('attendance.index', ['personal_date' => '2026-09-14']))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Attendance')
                ->where('selectedPersonalDate', '2026-09-14')
                ->where('personalRecord.id', $day->id)
            );
    }

    public function test_personal_history_rejects_a_future_month(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-09-15 10:00:00', 'Asia/Phnom_Penh')->utc());
        [$user] = $this->attendanceSetup();

        $this->actingAs($user)
            ->get(route('attendance.index', ['history_month' => '2026-10', 'tab' => 'history']))
            ->assertRedirect()
            ->assertSessionHasErrors('history_month');
    }

    /**
     * @return array{User, AttendanceSite, AttendanceSchedule, AttendanceQrCode}
     */
    private function attendanceSetup(array $siteOverrides = [], array $userOverrides = []): array
    {
        $site = AttendanceSite::query()->create([
            'name' => 'Test Office '.Str::random(5),
            'code' => $siteOverrides['code'] ?? 'SITE'.Str::upper(Str::random(4)),
            'timezone' => 'Asia/Phnom_Penh',
            'latitude' => 11.5564,
            'longitude' => 104.9282,
            'acceptance_radius_meters' => 150,
            'maximum_accuracy_meters' => 100,
            'allowed_ip_ranges' => $siteOverrides['allowed_ip_ranges'] ?? [],
            'is_active' => $siteOverrides['is_active'] ?? true,
        ]);
        $user = User::factory()->create(['role' => 'staff', 'is_active' => true, ...$userOverrides]);
        $schedule = AttendanceSchedule::query()->create([
            'user_id' => $user->id,
            'primary_site_id' => $site->id,
            'effective_from' => '2026-07-29',
            'work_start' => '08:00',
            'lunch_start' => '12:00',
            'lunch_end' => '13:00',
            'work_end' => '17:00',
            'lunch_classification_lead_minutes' => 15,
            'grace_minutes' => 0,
        ]);
        $schedule->allowedSites()->sync([$site->id]);
        $code = AttendanceQrCode::query()->create([
            'attendance_site_id' => $site->id,
            'mode' => 'daily',
            'is_enabled' => true,
        ]);

        return [$user, $site, $schedule, $code];
    }

    private function punchAt(
        AttendanceService $service,
        User $user,
        AttendanceQrCode $code,
        string $localDateTime,
        int $sequence
    ) {
        Carbon::setTestNow(Carbon::parse($localDateTime, $code->site->timezone)->utc());

        return $service->recordPunch($user, $code, [
            'idempotency_key' => (string) Str::uuid(),
            'latitude' => $code->site->latitude,
            'longitude' => $code->site->longitude,
            'accuracy_meters' => 10,
        ], '198.51.100.10', 'PHPUnit/'.$sequence);
    }
}
