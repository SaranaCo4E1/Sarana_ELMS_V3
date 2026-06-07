<?php

namespace App\Notifications;

use App\Models\LeaveBalance;
use App\Models\LeaveRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class LeaveRequestDecided extends Notification
{
    use Queueable;

    public function __construct(private readonly LeaveRequest $leaveRequest) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $status = ucfirst($this->leaveRequest->status);
        $leaveType = $this->leaveRequest->leaveType;
        $approverName = $this->leaveRequest->approver?->name ?? 'Your Manager';

        $balance = LeaveBalance::query()
            ->where('user_id', $this->leaveRequest->user_id)
            ->where('leave_type_id', $leaveType->id)
            ->where('year', now()->year)
            ->first();

        $message = (new MailMessage)
            ->subject('Leave Request Decision: '.$status)
            ->greeting('Hello '.$notifiable->name.',')
            ->line('Your request for **'.$leaveType->name.'** has been **'.$status.'** by '.$approverName.'.')
            ->line('### Request Details')
            ->line('**Leave Type:** '.$leaveType->name)
            ->line('**Dates:** '.$this->leaveRequest->starts_at->format('M d, Y').' to '.$this->leaveRequest->ends_at->format('M d, Y'))
            ->line('**Duration:** '.$this->leaveRequest->requested_days.' working days')
            ->line('**Manager Comment:** '.($this->leaveRequest->manager_comment ?: 'No comment provided.'));

        $message->line('### Updated Leave Balance');

        if ($balance) {
            $message->line('**Current Available Balance:** '.$balance->available_days.' days')
                ->line('**Total Used This Year:** '.$balance->used_days.' days');
        } else {
            $message->line('No leave balance has been configured for this leave type.');
        }

        return $message->action('View Dashboard', route('dashboard'))
            ->line('Thank you for using the ELMS application!');
    }
}
