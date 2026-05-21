<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\LeaveRequest;
use App\Models\LeaveType;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LeaveRequestTest extends TestCase
{
    use RefreshDatabase;

    public function test_staff_can_submit_half_day_leave(): void
    {
        [$user, $leaveType] = $this->staffAndLeaveType();

        $response = $this->actingAs($user)->post('/leave-requests', [
            'leave_type_id' => $leaveType->id,
            'starts_at' => '2026-06-01',
            'ends_at' => '2026-06-01',
            'duration' => 'half_day',
            'reason' => 'Appointment',
        ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('leave_requests', [
            'user_id' => $user->id,
            'requested_days' => 0.5,
            'status' => 'pending',
        ]);
    }

    public function test_staff_cannot_submit_overlapping_pending_or_approved_leave(): void
    {
        [$user, $leaveType] = $this->staffAndLeaveType();
        LeaveRequest::query()->create([
            'user_id' => $user->id,
            'leave_type_id' => $leaveType->id,
            'starts_at' => '2026-06-01',
            'ends_at' => '2026-06-01',
            'requested_days' => 1,
            'status' => 'pending',
            'reason' => 'Existing request',
        ]);

        $response = $this->actingAs($user)
            ->from('/apply-leave')
            ->post('/leave-requests', [
                'leave_type_id' => $leaveType->id,
                'starts_at' => '2026-06-01',
                'ends_at' => '2026-06-01',
                'duration' => 'half_day',
                'reason' => 'Duplicate request',
            ]);

        $response->assertRedirect('/apply-leave');
        $response->assertSessionHasErrors('starts_at');
        $this->assertDatabaseCount('leave_requests', 1);
    }

    private function staffAndLeaveType(): array
    {
        $department = Department::query()->create(['name' => 'Operations', 'code' => 'OPS']);
        $user = User::factory()->create(['department_id' => $department->id, 'role' => 'staff']);
        $leaveType = LeaveType::query()->create([
            'name' => 'Annual Leave',
            'code' => 'annual',
            'default_allowance_days' => 10,
            'paid' => true,
            'requires_attachment' => false,
            'deducts_balance' => true,
        ]);

        return [$user, $leaveType];
    }
}
