<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * "Weekly area summary" (29:1149, decision #96): public numbers only, the
 * same for every recipient, so nothing personal goes into the email.
 */
class WeeklySummary extends Notification implements ShouldQueue
{
    use Queueable;

    /**
     * @param  array{active: int, new: int, types: array<string, int>, expiring: list<array{id: string, type: string, place: string, when: string}>}  $summary
     */
    public function __construct(public array $summary) {}

    /** @return list<string> */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $s = $this->summary;
        $mail = (new MailMessage)
            ->subject(__('notifications.digest.subject'))
            ->line(__('notifications.digest.intro'));

        if ($s['active'] === 0) {
            $mail->line(__('notifications.digest.none'));
        } else {
            $types = collect($s['types'])->map(fn (int $n, string $type) => "{$type} ({$n})")->implode(', ');
            $mail->line(__('notifications.digest.active', ['count' => $s['active'], 'new' => $s['new']]))
                ->line(__('notifications.digest.types', ['types' => $types]))
                ->line(__('notifications.digest.expiring'));
            foreach ($s['expiring'] as $item) {
                $mail->line('• '.__('notifications.digest.item', $item));
            }
        }

        return $mail
            ->action(__('notifications.digest.action'), rtrim((string) config('app.frontend_url'), '/').'/requests')
            ->line(__('notifications.digest.footer'));
    }
}
