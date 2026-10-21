<?php

namespace App\Notifications;

use App\Models\CoordinatorInvite;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * The invite link for a new coordinator (decision #95). Sent immediately, not
 * queued: the plain token must never be serialized into the jobs table.
 */
class CoordinatorInvitation extends Notification
{
    use Queueable;

    public function __construct(public CoordinatorInvite $invite, private string $token) {}

    /** @return list<string> */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $url = rtrim((string) config('app.frontend_url'), '/').'/invite/'.$this->token;

        return (new MailMessage)
            ->subject(__('notifications.invite.subject', ['app' => config('app.name')]))
            ->greeting(__('notifications.invite.greeting', ['name' => $this->invite->name]))
            ->line(__('notifications.invite.line', ['area' => $this->invite->area->name]))
            ->action(__('notifications.invite.action'), $url)
            ->line(__('notifications.invite.expiry', ['days' => CoordinatorInvite::VALID_DAYS]));
    }
}
