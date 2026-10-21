<?php

namespace App\Notifications;

use App\Models\BloodRequest;
use App\Models\User;
use App\Services\Settings;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * One notification for every request update a person should hear about.
 * In-app (database) always; email per the recipient's preferences —
 * "Email only in this version" (29:1137). Owners always get email for review
 * outcomes and expiry.
 */
class RequestUpdate extends Notification implements ShouldQueue
{
    use Queueable;

    /** kind → which preference switches email for non-owners. */
    private const SAVER_PREFERENCE = [
        'status_changed' => 'email_saved_status_changes',
        'expired' => 'email_saved_status_changes',
        'expiring_soon' => 'email_expiry_reminder',
    ];

    /**
     * @param  string  $kind  approved|needs_correction|rejected|status_changed|expired|expiring_soon
     */
    public function __construct(public BloodRequest $request, public string $kind) {}

    /** @return list<string> */
    public function via(User $notifiable): array
    {
        $isOwner = $this->request->submitter_id === $notifiable->getKey();
        $preference = self::SAVER_PREFERENCE[$this->kind] ?? null;
        $email = $isOwner || ($preference && ($notifiable->resolvedPreferences()[$preference] ?? false));
        // "Notify owners when a correction is requested" (41:2021) can switch that email off.
        if ($this->kind === 'needs_correction' && ! Settings::bool('notifications.correction_email')) {
            $email = false;
        }

        // Deactivated accounts get no email (29:1215).
        $reachable = $notifiable->deletion_requested_at === null && $notifiable->deactivated_at === null;

        return $email && $reachable ? ['database', 'mail'] : ['database'];
    }

    public function toMail(User $notifiable): MailMessage
    {
        $id = $this->request->public_id;
        $url = rtrim((string) config('app.frontend_url'), '/').'/requests/'.$id;
        $replace = ['id' => $id, 'hours' => Settings::int('expiry.reminder_hours')];

        return (new MailMessage)
            ->subject(__("notifications.request.{$this->kind}.subject", $replace))
            ->line(__("notifications.request.{$this->kind}.line", $replace))
            ->when($this->request->correction_note && $this->kind === 'needs_correction',
                fn (MailMessage $m) => $m->line($this->request->correction_note))
            ->action(__('notifications.request.action'), $url);
    }

    /** @return array<string, mixed> */
    public function toArray(User $notifiable): array
    {
        $this->request->loadMissing('municipality');

        return [
            'kind' => $this->kind,
            'request_id' => $this->request->public_id,
            'status' => $this->request->status->value,
            'blood_type' => $this->request->blood_type->value,
            'municipality' => $this->request->municipality?->name,
            'expires_at' => $this->request->expires_at?->toIso8601ZuluString(),
        ];
    }
}
