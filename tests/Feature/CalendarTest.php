<?php

namespace Tests\Feature;

use App\Models\PublicHoliday;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class CalendarTest extends TestCase
{
    use RefreshDatabase;

    public function test_calendar_returns_active_holidays_for_history_and_upcoming_views(): void
    {
        Carbon::setTestNow('2026-07-30 10:00:00');
        $user = User::factory()->create(['role' => 'staff']);

        PublicHoliday::query()->create([
            'holiday_date' => '2026-07-29',
            'name' => 'Past holiday',
            'is_active' => true,
        ]);
        PublicHoliday::query()->create([
            'holiday_date' => '2025-12-31',
            'name' => 'Prior year holiday',
            'is_active' => true,
        ]);
        PublicHoliday::query()->create([
            'holiday_date' => '2026-07-30',
            'name' => 'Today holiday',
            'is_active' => true,
        ]);
        PublicHoliday::query()->create([
            'holiday_date' => '2026-08-01',
            'name' => 'Upcoming holiday',
            'is_active' => true,
        ]);
        PublicHoliday::query()->create([
            'holiday_date' => '2026-08-02',
            'name' => 'Inactive holiday',
            'is_active' => false,
        ]);

        $this->actingAs($user)
            ->get(route('calendar.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Calendar')
                ->has('holidays', 3)
                ->where('holidays.0.name', 'Past holiday')
                ->where('holidays.1.name', 'Today holiday')
                ->where('holidays.2.name', 'Upcoming holiday')
            );
    }
}
