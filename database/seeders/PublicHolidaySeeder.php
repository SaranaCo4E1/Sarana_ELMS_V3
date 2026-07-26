<?php

namespace Database\Seeders;

use App\Models\PublicHoliday;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use RuntimeException;

class PublicHolidaySeeder extends Seeder
{
    public function run(): void
    {
        DB::transaction(function (): void {
            foreach (File::glob(database_path('data/holidays/*.json')) as $path) {
                $this->seedYear($path);
            }
        });
    }

    private function seedYear(string $path): void
    {
        $data = json_decode(File::get($path), true, flags: JSON_THROW_ON_ERROR);
        $fileYear = (int) pathinfo($path, PATHINFO_FILENAME);
        $year = $data['year'] ?? null;
        $holidays = $data['holidays'] ?? null;

        if ($year !== $fileYear || ! is_array($holidays)) {
            throw new RuntimeException("Invalid public holiday data in {$path}.");
        }

        $dates = [];

        foreach ($holidays as $holiday) {
            $date = $holiday['date'] ?? null;
            $name = $holiday['name'] ?? null;

            if (
                ! is_string($date)
                || ! is_string($name)
                || trim($name) === ''
                || ! Carbon::hasFormatWithModifiers($date, 'Y-m-d')
                || (int) substr($date, 0, 4) !== $year
                || in_array($date, $dates, true)
            ) {
                throw new RuntimeException("Invalid public holiday entry in {$path}.");
            }

            $dates[] = $date;
        }

        $staleHolidays = PublicHoliday::query()->whereYear('holiday_date', $year);

        if ($dates !== []) {
            $staleHolidays->whereNotIn('holiday_date', $dates);
        }

        $staleHolidays->delete();

        foreach ($holidays as $holiday) {
            PublicHoliday::query()->updateOrCreate(
                ['holiday_date' => $holiday['date']],
                ['name' => $holiday['name'], 'is_active' => true],
            );
        }
    }
}
