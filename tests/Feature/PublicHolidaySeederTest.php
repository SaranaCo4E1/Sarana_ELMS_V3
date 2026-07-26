<?php

namespace Tests\Feature;

use App\Models\PublicHoliday;
use Database\Seeders\PublicHolidaySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PublicHolidaySeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_synchronizes_authoritative_public_holiday_data(): void
    {
        PublicHoliday::query()->create([
            'holiday_date' => '2026-05-22',
            'name' => 'Stale Visak Bochea Day',
            'is_active' => true,
        ]);
        PublicHoliday::query()->create([
            'holiday_date' => '2027-01-01',
            'name' => 'Unverified 2027 holiday',
            'is_active' => true,
        ]);

        $this->seed(PublicHolidaySeeder::class);
        $this->seed(PublicHolidaySeeder::class);

        $this->assertSame(24, PublicHoliday::query()->whereYear('holiday_date', 2024)->count());
        $this->assertSame(22, PublicHoliday::query()->whereYear('holiday_date', 2025)->count());
        $this->assertSame(21, PublicHoliday::query()->whereYear('holiday_date', 2026)->count());
        $this->assertSame(0, PublicHoliday::query()->whereYear('holiday_date', 2027)->count());
        $this->assertSame(67, PublicHoliday::query()->count());
        $this->assertSame(67, PublicHoliday::query()->where('is_active', true)->count());

        $this->assertSame(
            'Funan Techo Canal Groundbreaking Holiday',
            PublicHoliday::query()->whereDate('holiday_date', '2024-08-05')->value('name'),
        );
        $this->assertSame(
            'International Labor Day and Visak Bochea Day',
            PublicHoliday::query()->whereDate('holiday_date', '2026-05-01')->value('name'),
        );
        $this->assertSame(
            'Pchum Ben Festival (Day 1)',
            PublicHoliday::query()->whereDate('holiday_date', '2026-10-10')->value('name'),
        );
        $this->assertSame(
            'Water Festival (Day 3)',
            PublicHoliday::query()->whereDate('holiday_date', '2026-11-25')->value('name'),
        );
        $this->assertFalse(
            PublicHoliday::query()->whereDate('holiday_date', '2026-05-22')->exists(),
        );
    }
}
