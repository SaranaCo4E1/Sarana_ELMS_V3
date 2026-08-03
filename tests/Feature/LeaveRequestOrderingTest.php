<?php

namespace Tests\Feature;

use App\Models\LeaveBalance;
use App\Models\LeaveRequest;
use App\Models\LeaveType;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class LeaveRequestOrderingTest extends TestCase
{
    use RefreshDatabase;

    public function test_approval_queues_and_decisions_are_sorted_by_newest_creation_date(): void
    {
        $manager = User::factory()->create(['role' => 'manager']);
        $employee = User::factory()->create([
            'role' => 'staff',
            'manager_id' => $manager->id,
        ]);
        $leaveType = LeaveType::query()->create([
            'name' => 'Annual Leave',
            'code' => 'AL',
        ]);

        $olderPending = $this->createLeaveRequest($employee, $leaveType, [
            'status' => 'pending',
            'created_at' => now()->subDays(4),
        ]);
        $newerPending = $this->createLeaveRequest($employee, $leaveType, [
            'status' => 'pending',
            'created_at' => now()->subDay(),
        ]);
        LeaveBalance::query()->create([
            'user_id' => $employee->id,
            'leave_type_id' => $leaveType->id,
            'year' => now()->year,
            'allowance_days' => 18,
            'used_days' => 2,
            'pending_days' => 1,
        ]);
        $olderCreatedButLaterDecided = $this->createLeaveRequest($employee, $leaveType, [
            'status' => 'approved',
            'created_at' => now()->subDays(3),
            'decided_at' => now(),
        ]);
        $newerCreatedButEarlierDecided = $this->createLeaveRequest($employee, $leaveType, [
            'status' => 'rejected',
            'created_at' => now()->subDays(2),
            'decided_at' => now()->subDay(),
        ]);

        $this->actingAs($manager)
            ->get(route('approvals.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('requests.0.id', $newerPending->id)
                ->where('requests.0.user.leave_balances.0.available_days', 15)
                ->where('requests.1.id', $olderPending->id)
                ->where('recentDecisions.0.id', $newerCreatedButEarlierDecided->id)
                ->where('recentDecisions.1.id', $olderCreatedButLaterDecided->id));
    }

    public function test_rejection_requires_a_decision_comment(): void
    {
        $manager = User::factory()->create(['role' => 'manager']);
        $employee = User::factory()->create([
            'role' => 'staff',
            'manager_id' => $manager->id,
        ]);
        $leaveType = LeaveType::query()->create([
            'name' => 'Annual Leave',
            'code' => 'AL',
        ]);
        $leaveRequest = $this->createLeaveRequest($employee, $leaveType, [
            'status' => 'pending',
            'created_at' => now(),
        ]);

        $this->actingAs($manager)
            ->patch(route('approvals.update', $leaveRequest), [
                'decision' => 'rejected',
                'manager_comment' => '',
            ])
            ->assertSessionHasErrors([
                'manager_comment' => 'Add a reason before rejecting this request.',
            ]);

        $this->assertDatabaseHas(LeaveRequest::class, [
            'id' => $leaveRequest->id,
            'status' => 'pending',
        ]);
    }

    public function test_request_can_be_approved_without_a_required_attachment(): void
    {
        Notification::fake();

        $manager = User::factory()->create(['role' => 'manager']);
        $employee = User::factory()->create([
            'role' => 'staff',
            'manager_id' => $manager->id,
        ]);
        $leaveType = LeaveType::query()->create([
            'name' => 'Sick Leave',
            'code' => 'SL',
            'requires_attachment' => true,
        ]);
        $leaveRequest = $this->createLeaveRequest($employee, $leaveType, [
            'status' => 'pending',
            'created_at' => now(),
        ]);
        LeaveBalance::query()->create([
            'user_id' => $employee->id,
            'leave_type_id' => $leaveType->id,
            'year' => now()->year,
            'allowance_days' => 10,
            'pending_days' => 1,
        ]);

        $this->actingAs($manager)
            ->patch(route('approvals.update', $leaveRequest), [
                'decision' => 'approved',
                'manager_comment' => '',
            ])
            ->assertSessionHasNoErrors();

        $this->assertDatabaseHas(LeaveRequest::class, [
            'id' => $leaveRequest->id,
            'status' => 'approved',
            'approver_id' => $manager->id,
        ]);
    }

    private function createLeaveRequest(User $employee, LeaveType $leaveType, array $attributes): LeaveRequest
    {
        $createdAt = $attributes['created_at'];
        unset($attributes['created_at']);

        $leaveRequest = LeaveRequest::query()->create([
            'user_id' => $employee->id,
            'leave_type_id' => $leaveType->id,
            'starts_at' => now()->addWeek()->toDateString(),
            'ends_at' => now()->addWeek()->toDateString(),
            'requested_days' => 1,
            'reason' => null,
            'submitted_at' => now(),
            ...$attributes,
        ]);

        $leaveRequest->forceFill([
            'created_at' => $createdAt,
            'updated_at' => $createdAt,
        ])->saveQuietly();

        return $leaveRequest;
    }
}
