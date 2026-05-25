<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\UserProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class ProfileUpdateTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_update_optional_profile_details(): void
    {
        $user = User::factory()->create([
            'name' => 'Original Name',
            'email' => 'original@example.com',
        ]);

        $response = $this
            ->actingAs($user)
            ->post(route('profile.update'), [
                '_method' => 'patch',
                'name' => 'Updated Name',
                'email' => 'updated@example.com',
                'date_of_birth' => '1995-04-15',
                'gender' => 'Female',
                'nationality' => 'Cambodian',
                'national_id_number' => 'ID-123456',
                'join_date' => '2026-01-05',
                'employment_type' => 'Full-time',
                'address' => 'Phnom Penh',
                'emergency_contact_name' => 'Sok Emergency',
                'emergency_contact_phone' => '012345678',
                'bank_account_number' => '1234567890',
                'bank_name' => 'Acleda Bank',
            ]);

        $response->assertSessionHasNoErrors();
        $response->assertRedirect();

        $this->assertDatabaseHas(User::class, [
            'id' => $user->id,
            'name' => 'Updated Name',
            'email' => 'updated@example.com',
        ]);

        $this->assertDatabaseHas(UserProfile::class, [
            'user_id' => $user->id,
            'date_of_birth' => '1995-04-15',
            'gender' => 'Female',
            'nationality' => 'Cambodian',
            'national_id_number' => 'ID-123456',
            'join_date' => '2026-01-05',
            'employment_type' => 'Full-time',
            'address' => 'Phnom Penh',
            'emergency_contact_name' => 'Sok Emergency',
            'emergency_contact_phone' => '012345678',
            'bank_account_number' => '1234567890',
            'bank_name' => 'Acleda Bank',
        ]);
    }

    public function test_user_profile_rejects_invalid_optional_values(): void
    {
        $user = User::factory()->create();

        $response = $this
            ->actingAs($user)
            ->patch(route('profile.update'), [
                'name' => $user->name,
                'email' => $user->email,
                'gender' => 'Other',
                'emergency_contact_phone' => Str::random(21),
            ]);

        $response->assertSessionHasErrors(['gender', 'emergency_contact_phone']);
    }
}
