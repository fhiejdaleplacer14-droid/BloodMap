<?php

namespace Tests\Feature;

use App\Services\Assistant\HelpArticles;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/** The BloodMap guide (04 · Assistant, 51:561): approved help articles only. */
class AssistantTest extends TestCase
{
    use RefreshDatabase;

    private function ask(string $message): TestResponse
    {
        return $this->postJson('/api/assistant/messages', ['message' => $message])->assertOk();
    }

    public function test_answers_come_from_an_approved_article_with_its_source(): void
    {
        $this->ask('What do the request statuses mean?')
            ->assertJsonPath('data.sources.0.id', 'request-statuses')
            ->assertJsonPath('data.sources.0.title', 'Request statuses')
            ->assertJsonPath('data.answer', HelpArticles::ALL['request-statuses']['answer'])
            ->assertJsonPath('data.safety_note', null)
            ->assertJsonPath('data.generated', false);

        $this->ask('Can I see who submitted a request?')->assertJsonPath('data.sources.0.id', 'privacy-and-contact');
        $this->ask('How do I find a blood request?')->assertJsonPath('data.sources.0.id', 'finding-requests');
        $this->ask('How do I submit a request?')->assertJsonPath('data.sources.0.id', 'submitting-requests');
        $this->ask('How can I protect my personal information?')->assertJsonPath('data.sources.0.id', 'privacy-and-contact');
        $this->ask('What happens at the coordination desk?')->assertJsonPath('data.sources.0.id', 'coordination-desk');
    }

    public function test_eligibility_questions_get_the_fixed_safety_note(): void
    {
        $this->ask('I got a tattoo last month. Can I still donate?')
            ->assertJsonPath('data.safety_note', HelpArticles::SAFETY_NOTE)
            ->assertJsonPath('data.sources.0.id', 'safety-and-guidelines')
            ->assertJsonPath('data.suggestions', ['What happens at the coordination desk?']);
    }

    public function test_live_request_details_are_never_paraphrased(): void
    {
        $this->ask('Is blood still needed for BM-2026-0012?')
            ->assertJsonPath('data.sources.0.id', 'coordination-desk')
            ->assertJsonPath('data.answer', fn (string $answer) => str_contains($answer, 'can’t see live request details'));
    }

    public function test_no_match_says_so_instead_of_guessing(): void
    {
        $this->ask('What is the capital of France?')
            ->assertJsonPath('data.matched', false)
            ->assertJsonPath('data.sources', [])
            ->assertJsonCount(4, 'data.suggestions');
    }

    public function test_messages_are_validated_and_rate_limited(): void
    {
        $this->postJson('/api/assistant/messages', ['message' => ''])->assertUnprocessable();
        $this->postJson('/api/assistant/messages', ['message' => str_repeat('a', 501)])->assertUnprocessable();

        for ($i = 0; $i < 18; $i++) {
            $this->postJson('/api/assistant/messages', ['message' => 'Hello']);
        }
        $this->postJson('/api/assistant/messages', ['message' => 'Hello'])->assertStatus(429);
    }
}
