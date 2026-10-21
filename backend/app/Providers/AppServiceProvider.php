<?php

namespace App\Providers;

use App\Models\User;
use App\Services\Assistant\AssistantEngine;
use App\Services\Assistant\GeminiAssistant;
use App\Services\Assistant\HelpArticleAssistant;
use App\Services\Settings;
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
        // The guide answers from approved help articles (decision #77); with a Gemini key it phrases the answer with a model (decision #92).
        $this->app->bind(AssistantEngine::class, fn () => config('services.assistant.driver') === 'gemini' && filled(config('services.gemini.key')) && Settings::string('general.assistant') === 'ai'
            ? $this->app->make(GeminiAssistant::class)
            : $this->app->make(HelpArticleAssistant::class));
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
