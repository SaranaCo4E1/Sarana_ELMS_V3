<?php

namespace Tests\Feature;

use Tests\TestCase;

class DatabaseSeederTest extends TestCase
{
    public function test_database_seeder_contains_localized_demo_data_without_placeholder_text(): void
    {
        $source = file_get_contents(database_path('seeders/DatabaseSeeder.php'));

        $this->assertIsString($source);
        $this->assertStringNotContainsString('+855', $source);
        $this->assertStringNotContainsString('+66', $source);
        $this->assertStringNotContainsString('Seeded employee profile', $source);
        $this->assertStringNotContainsString('seeded demo data', $source);

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
}
