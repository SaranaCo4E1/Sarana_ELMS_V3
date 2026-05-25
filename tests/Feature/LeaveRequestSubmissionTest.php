<?php

namespace Tests\Feature;

use App\Models\LeaveRequest;
use App\Models\LeaveType;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LeaveRequestSubmissionTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_submit_backdated_leave_without_a_reason(): void
    {
        $user = User::factory()->create();
        $leaveType = LeaveType::query()->create([
            'name' => 'Annual Leave',
            'code' => 'annual',
            'default_allowance_days' => 18,
            'paid' => true,
            'requires_attachment' => false,
            'deducts_balance' => true,
            'is_active' => true,
        ]);
        $leaveDate = now()->subWeek()->startOfWeek()->toDateString();

        $response = $this
            ->actingAs($user)
            ->post(route('leave-requests.store'), [
                'leave_type_id' => $leaveType->id,
                'starts_at' => $leaveDate,
                'ends_at' => $leaveDate,
                'duration' => 'full_day',
            ]);

        $response->assertSessionHasNoErrors();
        $response->assertRedirect();

        $this->assertDatabaseHas(LeaveRequest::class, [
            'user_id' => $user->id,
            'leave_type_id' => $leaveType->id,
            'starts_at' => $leaveDate,
            'ends_at' => $leaveDate,
            'reason' => null,
            'status' => 'pending',
        ]);
    }
}
