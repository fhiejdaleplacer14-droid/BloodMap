<?php

namespace App\Providers;

use App\Models\User;
use App\Services\Assistant\AssistantEngine;
use App\Services\Assistant\HelpArticleAssistant;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // The guide answers from approved help articles; swap here for an LLM-backed engine (decision #77).
        $this->app->bind(AssistantEngine::class, HelpArticleAssistant::class);
    }

    public function boot(): void
    {
        // Catch typos in mass assignment early; lazy loading stays allowed.
        Model::preventSilentlyDiscardingAttributes(! $this->app->isProduction());

        // Public search: generous for people, firm for scrapers.
        RateLimiter::for('public', fn (Request $request) => Limit::perMinute(120)->by($request->ip()));
        RateLimiter::for('assistant', fn (Request $request) => Limit::perMinute(20)->by($request->ip()));

        // Reset links open the SPA, which posts to /reset-password.
        ResetPassword::createUrlUsing(fn (User $user, string $token) => rtrim((string) config('app.frontend_url'), '/')
            .'/reset-password?token='.$token.'&email='.urlencode($user->getEmailForPasswordReset()));
    }
}
