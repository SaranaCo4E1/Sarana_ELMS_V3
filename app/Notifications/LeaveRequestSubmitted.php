<?php

namespace App\Notifications;

use App\Models\LeaveBalance;
use App\Models\LeaveRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class LeaveRequestSubmitted extends Notification
{
    use Queueable;

    public function __construct(private readonly LeaveRequest $leaveRequest) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $user = $this->leaveRequest->user;
        $leaveType = $this->leaveRequest->leaveType;
        $departmentName = $user->department?->name ?? 'N/A';
        $reason = $this->leaveRequest->reason ?: 'No reason provided.';

        $balance = LeaveBalance::query()
            ->where('user_id', $user->id)
            ->where('leave_type_id', $leaveType->id)
            ->where('year', now()->year)
            ->first();

        $attachmentsCount = $this->leaveRequest->attachments()->count();
        $attachmentsText = $attachmentsCount > 0 ? "Yes ($attachmentsCount file(s) attached)" : 'None';

        $message = (new MailMessage)
            ->subject('Leave Request Awaiting Approval: '.$user->name)
            ->greeting('Hello '.$notifiable->name.',')
            ->line($user->name.' has submitted a new leave request that requires your review.')
            ->line('### Request Details')
            ->line('**Employee:** '.$user->name.' ('.($user->job_title ?: 'Staff').', Department: '.$departmentName.')')
            ->line('**Leave Type:** '.$leaveType->name)
            ->line('**Dates:** '.$this->leaveRequest->starts_at->format('M d, Y').' to '.$this->leaveRequest->ends_at->format('M d, Y'))
            ->line('**Duration:** '.$this->leaveRequest->requested_days.' working days')
            ->line('**Reason:** '.$reason)
            ->line('**Supporting Documents:** '.$attachmentsText);

        $message->line('### Leave Balance Summary');

        if ($balance) {
            $message->line('**Annual Allowance:** '.$balance->allowance_days.' days')
                ->line('**Available Balance:** '.$balance->available_days.' days')
                ->line('**Pending Days:** '.$balance->pending_days.' days')
                ->line('**Used Days:** '.$balance->used_days.' days');
        } else {
            $message->line('No leave balance has been configured for this employee for '.now()->year.'.');
        }

        return $message->action('Review Request', route('approvals.index'))
            ->line('Thank you for using the ELMS application!');
    }
}
