<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class AuditLog extends Model
{
    protected $fillable = ['actor_id', 'action', 'subject_type', 'subject_id', 'metadata', 'ip_address'];

    protected function casts(): array
    {
        return ['metadata' => 'array'];
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }

    public function subject(): MorphTo
    {
        return $this->morphTo();
    }

    public function formatDescription(): string
    {
        $subject = $this->subject;
        $subjectName = $subject?->name ?? $this->subject_id ?? 'Unknown';

        switch ($this->action) {
            // Departments
            case 'admin.department.created':
                return "Created department \"{$subjectName}\"";
            case 'admin.department.updated':
                return "Updated department details for \"{$subjectName}\"";
            case 'admin.department.activated':
                return "Activated department \"{$subjectName}\"";
            case 'admin.department.deactivated':
                return "Deactivated department \"{$subjectName}\"";

                // Leave Types
            case 'admin.leave_type.created':
                return "Created leave policy \"{$subjectName}\"";
            case 'admin.leave_type.updated':
                return "Updated leave policy \"{$subjectName}\"";
            case 'admin.leave_type.activated':
                return "Activated leave policy \"{$subjectName}\"";
            case 'admin.leave_type.deactivated':
                return "Deactivated leave policy \"{$subjectName}\"";

                // Holidays
            case 'admin.holiday.created':
                return "Added public holiday \"{$subjectName}\"";
            case 'admin.holiday.updated':
                return "Updated public holiday \"{$subjectName}\"";
            case 'admin.holiday.activated':
                return "Activated public holiday \"{$subjectName}\"";
            case 'admin.holiday.deactivated':
                return "Deactivated public holiday \"{$subjectName}\"";

                // Users
            case 'admin.user.created':
                return "Created user account for \"{$subjectName}\"";
            case 'admin.user.updated':
                return "Updated user account details for \"{$subjectName}\"";
            case 'admin.user.activated':
                return "Activated user account for \"{$subjectName}\"";
            case 'admin.user.deactivated':
                return "Deactivated user account for \"{$subjectName}\"";

                // Balance Override
            case 'admin.balance.overridden':
                $leaveTypeName = $subject?->leaveType?->name ?? 'Leave Type';
                $userBalName = $subject?->user?->name ?? 'Unknown User';
                $delta = (float) ($this->metadata['delta_days'] ?? 0);
                $deltaFormatted = $delta == (int) $delta ? (int) $delta : $delta;
                $signedDelta = $delta > 0 ? "+{$deltaFormatted}" : (string) $deltaFormatted;

                return "Adjusted {$leaveTypeName} balance for {$userBalName} by {$signedDelta} days";

                // Leave Requests
            case 'leave.request.submitted':
                $leaveTypeName = $subject?->leaveType?->name ?? 'Leave Type';
                $days = $subject?->requested_days ?? '—';
                $daysFormatted = (float) $days == (int) $days ? (int) $days : (float) $days;
                $requesterName = $subject?->user?->name ?? $this->actor?->name ?? 'Employee';

                return "{$requesterName} submitted a request for {$leaveTypeName} ({$daysFormatted} days)";
            case 'leave.request.cancelled':
                $leaveTypeName = $subject?->leaveType?->name ?? 'Leave Type';
                $days = $subject?->requested_days ?? '—';
                $daysFormatted = (float) $days == (int) $days ? (int) $days : (float) $days;
                $requesterName = $subject?->user?->name ?? $this->actor?->name ?? 'Employee';

                return "{$requesterName} cancelled request for {$leaveTypeName} ({$daysFormatted} days)";
            case 'leave.request.approved':
                $leaveTypeName = $subject?->leaveType?->name ?? 'Leave Type';
                $days = $subject?->requested_days ?? '—';
                $daysFormatted = (float) $days == (int) $days ? (int) $days : (float) $days;
                $employeeName = $subject?->user?->name ?? 'Employee';

                return "Approved leave request for {$employeeName} ({$leaveTypeName}, {$daysFormatted} days)";
            case 'leave.request.rejected':
                $leaveTypeName = $subject?->leaveType?->name ?? 'Leave Type';
                $days = $subject?->requested_days ?? '—';
                $daysFormatted = (float) $days == (int) $days ? (int) $days : (float) $days;
                $employeeName = $subject?->user?->name ?? 'Employee';

                return "Rejected leave request for {$employeeName} ({$leaveTypeName}, {$daysFormatted} days)";

                // Profile
            case 'profile.updated':
                return 'Updated personal profile details';
            case 'profile.password.updated':
                return 'Updated login password';
            case 'profile.two_factor.enabled':
                return 'Enabled Two-Factor Authentication';
            case 'profile.two_factor.disabled':
                return 'Disabled Two-Factor Authentication';

            default:
                $shortSubjectType = $this->subject_type ? class_basename($this->subject_type) : 'System';
                $subjId = $this->subject_id ?? '—';

                return "{$this->action} on {$shortSubjectType} #{$subjId}";
        }
    }
}
