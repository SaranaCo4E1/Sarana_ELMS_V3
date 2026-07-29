<?php

namespace Tests\Feature;

use App\Models\LeaveRequest;
use App\Models\LeaveType;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LeaveRequestSubmissionTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_submit_leave_backdated_by_seven_days_without_a_reason(): void
    {
        $this->travelTo(Carbon::parse('2026-07-29 12:00:00'));
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
        $leaveDate = now()->subDays(7)->toDateString();

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

    public function test_user_cannot_submit_leave_backdated_by_more_than_seven_days(): void
    {
        $this->travelTo(Carbon::parse('2026-07-29 12:00:00'));
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
        $leaveDate = now()->subDays(8)->toDateString();

        $response = $this
            ->actingAs($user)
            ->post(route('leave-requests.store'), [
                'leave_type_id' => $leaveType->id,
                'starts_at' => $leaveDate,
                'ends_at' => $leaveDate,
                'duration' => 'full_day',
            ]);

        $response
            ->assertSessionHasErrors([
                'starts_at' => 'Leave requests cannot be backdated by more than 7 days.',
            ])
            ->assertRedirect();

        $this->assertDatabaseMissing(LeaveRequest::class, [
            'user_id' => $user->id,
            'starts_at' => $leaveDate,
        ]);
    }
}
