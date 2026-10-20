<?php

namespace App\Services\Assistant;

use Illuminate\Support\Str;

/**
 * Answers by picking the approved help article that best matches the
 * question and returning its fixed text with the source (decision #77). No
 * model is involved, so nothing is generated and nothing is invented:
 *
 * - eligibility or health questions get the fixed safety note (55:371);
 * - questions about a request's live state point to the request page
 *   instead of paraphrasing it (12:960);
 * - with no good match it says so instead of guessing.
 */
final class HelpArticleAssistant implements AssistantEngine
{
    /** Minimum score for an article to count as the answer. */
    private const THRESHOLD = 2;

    /** "Try asking" (42:3779). */
    public const SUGGESTIONS = [
        'How do I find a blood request?',
        'How do I submit a request?',
        'What do the request statuses mean?',
        'How can I protect my personal information?',
    ];

    public function answer(string $question): array
    {
        $text = $this->normalize($question);

        if ($this->mentions($text, HelpArticles::MEDICAL)) {
            return $this->reply('safety-and-guidelines', safetyNote: HelpArticles::SAFETY_NOTE, suggestions: ['What happens at the coordination desk?']);
        }

        if ($this->mentions($text, HelpArticles::LIVE) || preg_match('/\bbm-\d{4}-\d{3,}\b/', $text)) {
            return [
                ...$this->reply('coordination-desk'),
                'answer' => 'I can’t see live request details or confirm whether blood is still needed. Open the request page for its latest status and coordination steps, or ask its coordination point.',
            ];
        }

        $best = null;
        $bestScore = 0;
        foreach (HelpArticles::ALL as $id => $article) {
            $score = $this->score($text, $article['keywords'], $article['title']);
            if ($score > $bestScore) {
                [$best, $bestScore] = [$id, $score];
            }
        }

        if ($best === null || $bestScore < self::THRESHOLD) {
            return [
                'answer' => 'I couldn’t find that in the approved help articles, so I won’t guess. Try one of these questions, or read Safety and guidelines.',
                'sources' => [],
                'safety_note' => null,
                'matched' => false,
                'generated' => false,
                'suggestions' => self::SUGGESTIONS,
            ];
        }

        return $this->reply($best);
    }

    /**
     * @param  list<string>  $suggestions
     * @return array{answer: string, sources: list<array{id: string, title: string, path: string}>, safety_note: string|null, matched: bool, generated: bool, suggestions: list<string>}
     */
    private function reply(string $id, ?string $safetyNote = null, array $suggestions = []): array
    {
        $article = HelpArticles::ALL[$id];

        return [
            'answer' => $article['answer'],
            'sources' => [['id' => $id, 'title' => $article['title'], 'path' => $article['path']]],
            'safety_note' => $safetyNote,
            'matched' => true,
            'generated' => false,
            'suggestions' => $suggestions,
        ];
    }

    /** @param  list<string>  $keywords */
    private function score(string $text, array $keywords, string $title): int
    {
        $words = preg_split('/[^a-z0-9]+/', $text, -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $score = 0;
        foreach ($keywords as $keyword) {
            if (str_contains($keyword, ' ')) {
                $score += str_contains($text, $keyword) ? 3 : 0;

                continue;
            }
            // Whole word or a simple stem ("status" ↔ "statuses", "save" ↔ "saved").
            foreach ($words as $word) {
                if ($word === $keyword || (strlen($keyword) >= 4 && (str_starts_with($word, $keyword) || str_starts_with($keyword, $word) && strlen($word) >= 4))) {
                    $score += 2;
                    break;
                }
            }
        }
        foreach (preg_split('/\s+/', Str::lower($title)) ?: [] as $word) {
            $score += strlen($word) > 3 && in_array($word, $words, true) ? 1 : 0;
        }

        return $score;
    }

    /** @param  list<string>  $phrases */
    private function mentions(string $text, array $phrases): bool
    {
        foreach ($phrases as $phrase) {
            if (preg_match('/\b'.preg_quote($phrase, '/').'/', $text)) {
                return true;
            }
        }

        return false;
    }

    private function normalize(string $question): string
    {
        return Str::of($question)->lower()->replace(['’', '‘'], "'")->squish()->value();
    }
}
