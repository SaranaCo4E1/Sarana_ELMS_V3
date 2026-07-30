<?php

namespace App\Jobs;

use App\Contracts\Ai\EmbeddingClient;
use App\Models\AiFaq;
use App\Services\Ai\FaqEmbeddingContent;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;
use Throwable;

class GenerateAiFaqEmbedding implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public int $tries = 5;

    public int $timeout = 60;

    public int $uniqueFor = 3600;

    /**
     * @param  string  $expectedContentHash  Prevents a stale queued job from overwriting newer FAQ content.
     */
    public function __construct(
        public int $faqId,
        public string $expectedContentHash,
    ) {}

    /**
     * @return array<int, int>
     */
    public function backoff(): array
    {
        return [5, 30, 120, 300];
    }

    public function uniqueId(): string
    {
        return "{$this->faqId}:{$this->expectedContentHash}";
    }

    public function handle(
        EmbeddingClient $embeddingClient,
        FaqEmbeddingContent $embeddingContent,
    ): void {
        $faq = AiFaq::query()->find($this->faqId);
        $model = (string) config('services.google_generative_ai.embedding_model');

        if (! $faq instanceof AiFaq
            || ! $faq->is_active
            || $faq->content_hash !== $this->expectedContentHash
            || $embeddingContent->hash($faq) !== $this->expectedContentHash) {
            return;
        }

        if ($faq->embedding !== null
            && $faq->embedding_model === $model
            && $faq->embedding_content_hash === $this->expectedContentHash) {
            return;
        }

        $embedding = $embeddingClient->embedDocument(
            $embeddingContent->title($faq),
            $embeddingContent->text($faq),
        );

        $faq->forceFill([
            'embedding' => $embedding,
            'embedding_model' => $model,
            'embedding_content_hash' => $this->expectedContentHash,
            'embedded_at' => now(),
        ])->save();
    }

    public function failed(?Throwable $exception): void
    {
        Log::error('FAQ embedding generation failed.', [
            'faq_id' => $this->faqId,
            'content_hash' => $this->expectedContentHash,
            'exception' => $exception,
        ]);
    }
}
