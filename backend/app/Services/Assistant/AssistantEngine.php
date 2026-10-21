<?php

namespace App\Services\Assistant;

/**
 * The BloodMap guide's answer engine (POST /api/assistant/messages, 51:561).
 * HelpArticleAssistant needs no model or API key; GeminiAssistant is the
 * LLM-backed engine behind the same contract, still limited to the approved
 * help articles. AppServiceProvider picks one from ASSISTANT_DRIVER.
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
