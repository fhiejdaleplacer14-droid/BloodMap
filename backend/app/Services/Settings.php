<?php

namespace App\Services;

use App\Models\Setting;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Editable system settings (41:2021, decision #93). Every business rule that
 * an administrator can change reads its value here; unset keys fall back to
 * DEFAULTS, which are the values the platform shipped with.
 */
final class Settings
{
    private const CACHE_KEY = 'settings:v1';

    /** @var array<string, int|bool|string> */
    public const DEFAULTS = [
        'expiry.max_extension_hours' => 72,
        'expiry.reminder_hours' => 6,
        'notifications.correction_email' => true,
        'notifications.weekly_digest' => false,
        'general.assistant' => 'ai',
        'retention.deleted_accounts_days' => 30,
        'retention.deactivated_accounts_days' => 90,
        'retention.inactive_saved_days' => 30,
    ];

    /** Validation per key (PATCH /api/admin/settings). */
    public const RULES = [
        'expiry.max_extension_hours' => ['integer', 'min:1', 'max:168'],
        'expiry.reminder_hours' => ['integer', 'min:1', 'max:48'],
        'notifications.correction_email' => ['boolean'],
        'notifications.weekly_digest' => ['boolean'],
        'general.assistant' => ['string', 'in:ai,articles'],
        'retention.deleted_accounts_days' => ['integer', 'min:7', 'max:365'],
        'retention.deactivated_accounts_days' => ['integer', 'min:30', 'max:730'],
        'retention.inactive_saved_days' => ['integer', 'min:7', 'max:365'],
    ];

    /** Changing these needs a written reason (41:2021 "Changing these requires a reason"). */
    public const NEEDS_REASON = 'retention.';

    /** @return array<string, int|bool|string> */
    public static function all(): array
    {
        /** @var array<string, mixed> $stored */
        $stored = Cache::rememberForever(self::CACHE_KEY, fn () => Setting::query()->pluck('value', 'key')->all());

        return array_merge(self::DEFAULTS, array_intersect_key($stored, self::DEFAULTS));
    }

    public static function int(string $key): int
    {
        return (int) self::all()[$key];
    }

    public static function bool(string $key): bool
    {
        return (bool) self::all()[$key];
    }

    public static function string(string $key): string
    {
        return (string) self::all()[$key];
    }

    /**
     * Stores the values that changed and writes one audit entry per key.
     *
     * @param  array<string, int|bool|string>  $values  validated, known keys only
     * @return list<string> the keys that changed
     */
    public static function update(array $values, User $actor, ?string $reason): array
    {
        $current = self::all();
        $changed = array_keys(array_filter($values, fn ($value, string $key) => $current[$key] !== $value, ARRAY_FILTER_USE_BOTH));

        DB::transaction(function () use ($changed, $values, $current, $actor, $reason) {
            foreach ($changed as $key) {
                $setting = Setting::query()->firstOrNew(['key' => $key]);
                $setting->fill(['value' => $values[$key], 'updated_by' => $actor->getKey()])->save();
                AuditLogger::record($actor, 'settings.updated', $setting, self::show($current[$key]), self::show($values[$key]), $reason, [
                    'target_label' => $key,
                ]);
            }
        });
        Cache::forget(self::CACHE_KEY);

        return $changed;
    }

    private static function show(int|bool|string $value): string
    {
        return is_bool($value) ? ($value ? 'on' : 'off') : (string) $value;
    }
}
