<?php

namespace Tests\Feature;

use App\Models\SystemNotification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class NotificationTest extends TestCase
{
    use RefreshDatabase;

    public function test_dashboard_keeps_layout_notification_props_available(): void
    {
        $user = User::factory()->create();
        SystemNotification::query()->create([
            'user_id' => $user->id,
            'type' => 'leave_decided',
            'title' => 'Decision',
            'body' => 'Approved',
            'action_url' => route('dashboard'),
        ]);

        $this->actingAs($user)
            ->get('/')
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard')
                ->has('notifications.items', 1)
                ->where('notifications.unread_count', 1)
                ->has('systemAlerts', 1)
            );
    }

    public function test_clicking_notification_marks_it_read_before_redirecting(): void
    {
        $user = User::factory()->create();
        $notification = SystemNotification::query()->create([
            'user_id' => $user->id,
            'type' => 'leave_decided',
            'title' => 'Decision',
            'body' => 'Approved',
            'action_url' => route('dashboard'),
        ]);

        $this->actingAs($user)
            ->patch("/notifications/{$notification->id}/read")
            ->assertRedirect(route('dashboard'));

        $this->assertNotNull($notification->fresh()->read_at);
    }
}
