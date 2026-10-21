<?php

namespace Tests\Feature;

use App\Services\Assistant\AssistantEngine;
use App\Services\Assistant\GeminiAssistant;
use App\Services\Assistant\HelpArticleAssistant;
use App\Services\Assistant\HelpArticles;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/** The guide with Gemini switched on (decision #92): the model never gets past the guardrails. */
class GeminiAssistantTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['services.assistant.driver' => 'gemini', 'services.gemini.key' => 'test-key']);
    }

    private function ask(string $message): TestResponse
    {
        return $this->postJson('/api/assistant/messages', ['message' => $message])->assertOk();
    }

    /** @param  array<string, mixed>  $reply */
    private function geminiReplies(array $reply): void
    {
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response([
            'candidates' => [['content' => ['parts' => [['text' => json_encode($reply)]]]]],
        ])]);
    }

    public function test_the_driver_is_chosen_from_config_and_needs_a_key(): void
    {
        $this->assertInstanceOf(GeminiAssistant::class, app(AssistantEngine::class));

        config(['services.gemini.key' => '']);
        $this->assertInstanceOf(HelpArticleAssistant::class, app(AssistantEngine::class));
    }

    public function test_a_generated_answer_is_limited_to_real_sources(): void
    {
        $this->geminiReplies([
            'answerable' => true,
            'answer' => 'Open Find Blood Requests and search your city.',
            'source_ids' => ['finding-requests', 'made-up-article'],
        ]);

        $this->ask('Paano ako makakita ng request?')
            ->assertJsonPath('data.answer', 'Open Find Blood Requests and search your city.')
            ->assertJsonPath('data.generated', true)
            ->assertJsonPath('data.matched', true)
            ->assertJsonCount(1, 'data.sources')
            ->assertJsonPath('data.sources.0.id', 'finding-requests');

        Http::assertSent(fn (Request $r) => $r->header('x-goog-api-key') === ['test-key']
            && str_contains($r['systemInstruction']['parts'][0]['text'], HelpArticles::ALL['request-statuses']['answer'])
            && $r['contents'][0]['parts'][0]['text'] === 'Paano ako makakita ng request?');
    }

    public function test_eligibility_and_live_questions_never_reach_the_model(): void
    {
        Http::fake();

        $this->ask('I got a tattoo last month. Can I still donate?')
            ->assertJsonPath('data.safety_note', HelpArticles::SAFETY_NOTE)
            ->assertJsonPath('data.generated', false);
        $this->ask('Is blood still needed for BM-2026-0012?')
            ->assertJsonPath('data.answer', fn (string $a) => str_contains($a, 'can’t see live request details'));

        Http::assertNothingSent();
    }

    public function test_an_unanswerable_or_unsourced_reply_is_not_shown(): void
    {
        $this->geminiReplies(['answerable' => false, 'answer' => '', 'source_ids' => []]);
        $this->ask('What is the capital of France?')->assertJsonPath('data.matched', false)->assertJsonPath('data.generated', false);

        $this->geminiReplies(['answerable' => true, 'answer' => 'Call 0917-000-0000.', 'source_ids' => ['invented']]);
        $this->ask('Who do I call?')->assertJsonPath('data.matched', false)->assertJsonPath('data.sources', []);
    }

    public function test_it_falls_back_to_the_help_articles_when_gemini_fails(): void
    {
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response(['error' => 'quota'], 429)]);

        $this->ask('What do the request statuses mean?')
            ->assertJsonPath('data.sources.0.id', 'request-statuses')
            ->assertJsonPath('data.answer', HelpArticles::ALL['request-statuses']['answer'])
            ->assertJsonPath('data.generated', false);

        Http::fake(['generativelanguage.googleapis.com/*' => Http::response(['candidates' => [['content' => ['parts' => [['text' => 'not json']]]]]])]);
        $this->ask('How do I find a blood request?')->assertJsonPath('data.sources.0.id', 'finding-requests');
    }

    public function test_only_suggested_questions_are_cached(): void
    {
        $this->geminiReplies(['answerable' => true, 'answer' => 'Statuses show review progress.', 'source_ids' => ['request-statuses']]);

        $this->ask('What do the request statuses mean?');
        $this->ask('What do the request statuses mean?');
        Http::assertSentCount(1);

        $this->ask('Any other question about saving?');
        $this->ask('Any other question about saving?');
        Http::assertSentCount(3);
    }
}
