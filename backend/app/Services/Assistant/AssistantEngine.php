<?php

namespace App\Services\Assistant;

/**
 * The BloodMap guide's answer engine (POST /api/assistant/messages, 51:561).
 * Today it is HelpArticleAssistant (no model, no API key). An LLM-backed
 * engine can replace it later behind the same contract, still limited to
 * the approved help articles.
 */
interface AssistantEngine
{
    /**
     * @return array{
     *     answer: string,
     *     sources: list<array{id: string, title: string, path: string}>,
     *     safety_note: string|null,
     *     matched: bool,
     *     generated: bool,
     *     suggestions: list<string>,
     * }
     */
    public function answer(string $question): array;
}
