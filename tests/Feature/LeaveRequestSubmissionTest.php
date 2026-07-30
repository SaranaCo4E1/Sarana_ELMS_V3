<?php

namespace Tests\Feature;

use App\Models\LeaveRequest;
use App\Models\LeaveType;
use App\Models\SystemNotification;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LeaveRequestSubmissionTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_submit_leave_for_today_without_a_reason(): void
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
        $leaveDate = now()->toDateString();

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

    public function test_user_cannot_submit_any_backdated_leave(): void
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
        $leaveDate = now()->subDay()->toDateString();

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
                'starts_at' => 'Leave requests cannot be backdated.',
            ])
            ->assertRedirect();

        $this->assertDatabaseMissing(LeaveRequest::class, [
            'user_id' => $user->id,
            'starts_at' => $leaveDate,
        ]);
    }

    public function test_submission_notifies_the_manager_and_global_approval_reviewers(): void
    {
        $this->travelTo(Carbon::parse('2026-07-29 12:00:00'));
        $manager = User::factory()->create(['role' => 'manager']);
        $admin = User::factory()->create(['role' => 'admin']);
        $hr = User::factory()->create(['role' => 'hr admin']);
        $user = User::factory()->create(['manager_id' => $manager->id]);
        $leaveType = LeaveType::query()->create([
            'name' => 'Annual Leave',
            'code' => 'annual',
            'default_allowance_days' => 18,
            'paid' => true,
            'requires_attachment' => false,
            'deducts_balance' => true,
            'is_active' => true,
        ]);

        $this->actingAs($user)->post(route('leave-requests.store'), [
            'leave_type_id' => $leaveType->id,
            'starts_at' => '2026-07-30',
            'ends_at' => '2026-07-30',
            'duration' => 'full_day',
        ])->assertSessionHasNoErrors();

        $leaveRequest = LeaveRequest::query()->sole();

        foreach ([$manager, $admin, $hr] as $reviewer) {
            $this->assertDatabaseHas(SystemNotification::class, [
                'user_id' => $reviewer->id,
                'type' => 'leave_submitted',
                'action_url' => route('approvals.index').'#request-'.$leaveRequest->id,
            ]);
        }

        $this->assertDatabaseCount(SystemNotification::class, 3);
    }
}
