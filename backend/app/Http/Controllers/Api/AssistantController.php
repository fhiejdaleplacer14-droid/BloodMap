<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Assistant\AssistantEngine;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The BloodMap guide (04 · Assistant). Open to everyone, rate-limited.
 * Questions are answered and forgotten: nothing about the message is
 * stored or logged (stricter than the 30-day limit in 55:371).
 */
class AssistantController extends Controller
{
    /** POST /api/assistant/messages → { answer, sources[], safety_note? } (51:561) */
    public function message(Request $request, AssistantEngine $engine): JsonResponse
    {
        $message = $request->validate(['message' => ['required', 'string', 'max:500']])['message'];

        return response()->json(['data' => $engine->answer($message)]);
    }
}
