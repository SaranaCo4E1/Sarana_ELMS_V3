<?php

namespace Tests\Feature;

use App\Models\LeaveRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class DatabaseSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_database_seeder_assigns_global_id_based_employee_codes(): void
    {
        $this->seed();

        $ceo = User::query()->where('email', 'ceo@niy.ai')->firstOrFail();

        $this->assertSame(1, $ceo->id);
        $this->assertSame('HR-001', $ceo->employee_code);

        User::query()
            ->with('department')
            ->whereNotNull('employee_code')
            ->each(function (User $user): void {
                $this->assertNotNull($user->department);
                $this->assertSame(
                    User::formatEmployeeCode($user->department, $user->id),
                    $user->employee_code,
                );
            });
    }

    public function test_database_seeder_contains_localized_demo_data_without_placeholder_text(): void
    {
        $source = file_get_contents(database_path('seeders/DatabaseSeeder.php'));

        $this->assertIsString($source);
        $this->assertStringNotContainsString('+855', $source);
        $this->assertStringNotContainsString('+66', $source);
        $this->assertStringNotContainsString('Seeded employee profile', $source);
        $this->assertStringNotContainsString('seeded demo data', $source);

        foreach ([
            'sreynimsamuser@gmail.com',
            'samuelsinat11@gmail.com',
            'hakkimhengg@gmail.com',
            'sean.sophearom77@gmail.com',
        ] as $staffEmail) {
            $this->assertStringContainsString("'email' => '{$staffEmail}'", $source);
        }

        preg_match_all("/'(?:phone|emergency_contact_phone)' => '([^']+)'/", $source, $phoneMatches);
        $this->assertGreaterThanOrEqual(20, count($phoneMatches[1]));

        foreach ($phoneMatches[1] as $phoneNumber) {
            $this->assertMatchesRegularExpression('/^(?:(?:010|011|012|014|015|016|017|060|066|067|068|069|070|077|078|081|085|086|087|089|090|092|093|095|098|099) \d{3} \d{3}|(?:018|031|071|076|088|096|097) \d{3} \d{4})$/', $phoneNumber);
        }

        preg_match_all("/^\\s+\\[\\$.*?, '[^']+', (-?\\d+), (-?\\d+),/m", $source, $requestMatches);
        $startOffsets = array_map('intval', $requestMatches[1]);

        $this->assertGreaterThanOrEqual(19, count($startOffsets));
        $this->assertLessThanOrEqual(-236, min($startOffsets));
        $this->assertGreaterThanOrEqual(20, max($startOffsets));
    }

    public function test_database_seeder_distributes_timestamps_across_working_hours_deterministically(): void
    {
        $this->seed();

        $requests = LeaveRequest::query()->orderBy('id')->get();

        $this->assertGreaterThan(1, $requests->pluck('submitted_at')->map->format('H:i')->unique()->count());
        $this->assertGreaterThan(1, $requests->pluck('decided_at')->filter()->map->format('H:i')->unique()->count());

        foreach ($requests as $request) {
            $this->assertWorkingTime($request->submitted_at);

            if ($request->decided_at) {
                $this->assertWorkingTime($request->decided_at);
                $this->assertTrue($request->decided_at->isAfter($request->submitted_at));
            }
        }

        $timestampsByRequest = $requests->mapWithKeys(fn (LeaveRequest $request): array => [
            $request->user_id.'-'.$request->starts_at->toDateString() => [
                $request->submitted_at->toDateTimeString(),
                $request->decided_at?->toDateTimeString(),
            ],
        ])->all();

        $this->seed();

        $reseededTimestamps = LeaveRequest::query()->orderBy('id')->get()
            ->mapWithKeys(fn (LeaveRequest $request): array => [
                $request->user_id.'-'.$request->starts_at->toDateString() => [
                    $request->submitted_at->toDateTimeString(),
                    $request->decided_at?->toDateTimeString(),
                ],
            ])->all();

        $this->assertSame($timestampsByRequest, $reseededTimestamps);
    }

    private function assertWorkingTime(Carbon $timestamp): void
    {
        $time = $timestamp->format('H:i:s');

        $this->assertGreaterThanOrEqual('08:00:00', $time);
        $this->assertLessThan('17:00:00', $time);
    }
}
