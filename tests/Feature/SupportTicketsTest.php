<?php

namespace Tests\Feature;

use App\Models\SupportMessage;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class SupportTicketsTest extends TestCase
{
    use RefreshDatabase;

    public function test_hr_admin_can_view_submitted_support_tickets(): void
    {
        $hrAdmin = User::factory()->create(['role' => 'hr admin']);
        $submitter = User::factory()->create();

        SupportMessage::query()->create([
            'user_id' => $submitter->id,
            'name' => $submitter->name,
            'email' => $submitter->email,
            'subject' => 'Unable to submit leave',
            'message' => 'The request form does not complete.',
        ]);

        $this
            ->actingAs($hrAdmin)
            ->get(route('support.tickets'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('SupportTickets')
                ->has('tickets', 1)
                ->where('tickets.0.subject', 'Unable to submit leave')
                ->where('stats.total', 1)
                ->where('stats.registered', 1)
            );
    }

    public function test_staff_cannot_view_support_tickets(): void
    {
        $staff = User::factory()->create(['role' => 'staff']);

        $this
            ->actingAs($staff)
            ->get(route('support.tickets'))
            ->assertForbidden();
    }
}
