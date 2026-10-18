<?php

use App\Http\Middleware\EnsureAccountActive;
use App\Http\Middleware\EnsureRole;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Sanctum SPA cookie auth for requests from SANCTUM_STATEFUL_DOMAINS.
        $middleware->statefulApi();
        $middleware->alias([
            'account.active' => EnsureAccountActive::class,
            'role' => EnsureRole::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // The SPA always gets JSON errors (422 / 401 / 403 / 404 / 409 / 429).
        $exceptions->shouldRenderJsonWhen(fn (Request $request) => $request->is('api/*', 'login', 'logout', 'register', 'forgot-password', 'reset-password', 'email/*') || $request->expectsJson());
    })->create();
