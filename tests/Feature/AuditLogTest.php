<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\User;
use App\Support\Audit;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Tests\TestCase;

class AuditLogTest extends TestCase
{
    use RefreshDatabase;

    public function test_change_audit_records_only_changed_fields_and_redacts_sensitive_values(): void
    {
        $actor = User::factory()->create();
        $subject = User::factory()->create();
        $request = Request::create('/admin/users/'.$subject->id, 'PATCH', server: [
            'REMOTE_ADDR' => '10.0.0.8',
            'HTTP_USER_AGENT' => 'Audit test browser',
        ]);
        $request->setUserResolver(fn () => $actor);

        Audit::recordChange($request, 'admin.user.updated', $subject, [
            'name' => 'Old Name',
            'email' => 'same@example.com',
            'password' => 'old-secret',
            'bank_account_number' => '1234567890',
        ], [
            'name' => 'New Name',
            'email' => 'same@example.com',
            'password' => 'new-secret',
            'bank_account_number' => '9876543210',
        ]);

        $log = AuditLog::query()->firstOrFail();

        $this->assertSame(['name', 'bank_account_number'], $log->metadata['changed_fields']);
        $this->assertSame('Old Name', $log->metadata['changes'][0]['from']);
        $this->assertSame('New Name', $log->metadata['changes'][0]['to']);
        $this->assertStringEndsWith('7890', $log->metadata['changes'][1]['from']);
        $this->assertStringEndsWith('3210', $log->metadata['changes'][1]['to']);
        $this->assertStringNotContainsString('old-secret', json_encode($log->metadata));
        $this->assertStringNotContainsString('new-secret', json_encode($log->metadata));
        $this->assertSame('PATCH', $log->metadata['request']['method']);
        $this->assertSame('10.0.0.8', $log->ip_address);
    }

    public function test_profile_update_audit_contains_masked_before_and_after_values(): void
    {
        $user = User::factory()->create(['name' => 'Before Name']);
        $user->profile()->create([
            'national_id_number' => 'ID-111111',
            'bank_account_number' => '111122223333',
        ]);

        $this->actingAs($user)->patch(route('profile.update'), [
            'name' => 'After Name',
            'email' => $user->email,
            'national_id_number' => 'ID-999999',
            'bank_account_number' => '999988887777',
        ])->assertSessionHasNoErrors();

        $log = AuditLog::query()->where('action', 'profile.updated')->firstOrFail();
        $changes = collect($log->metadata['changes'])->keyBy('field');

        $this->assertSame('Before Name', $changes['name']['from']);
        $this->assertSame('After Name', $changes['name']['to']);
        $this->assertStringEndsWith('1111', $changes['national_id_number']['from']);
        $this->assertStringEndsWith('9999', $changes['national_id_number']['to']);
        $this->assertStringNotContainsString('111122223333', json_encode($log->metadata));
        $this->assertStringNotContainsString('999988887777', json_encode($log->metadata));
    }
}
