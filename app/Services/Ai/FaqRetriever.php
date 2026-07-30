<?php

namespace App\Services\Ai;

use App\Contracts\Ai\EmbeddingClient;
use App\Models\AiFaq;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Throwable;

class FaqRetriever
{
    public function __construct(private EmbeddingClient $embeddingClient) {}

    /**
     * @return Collection<int, AiFaq>
     */
    public function retrieve(string $query): Collection
    {
        if (! $this->eligibleVectorQuery()->exists()) {
            return $this->lexicalFallback($query);
        }

        try {
            $embedding = $this->embeddingClient->embedQuery($query);

            return $this->usesPostgres()
                ? $this->retrieveWithPgvector($embedding)
                : $this->retrieveInMemory($embedding);
        } catch (Throwable $exception) {
            report($exception);

            return $this->lexicalFallback($query);
        }
    }

    /**
     * @param  array<int, float>  $embedding
     * @return Collection<int, AiFaq>
     */
    private function retrieveWithPgvector(array $embedding): Collection
    {
        $minimumSimilarity = (float) config('ai.faq.minimum_similarity', 0.35);

        return $this->eligibleVectorQuery()
            ->select(['id', 'key', 'category', 'question', 'answer'])
            ->selectVectorDistance('embedding', $embedding, 'distance')
            ->whereVectorSimilarTo('embedding', $embedding, $minimumSimilarity)
            ->limit($this->topK())
            ->get()
            ->each(function (AiFaq $faq): void {
                $faq->setAttribute('similarity', 1 - (float) $faq->getAttribute('distance'));
                $faq->offsetUnset('distance');
            });
    }

    /**
     * @param  array<int, float>  $embedding
     * @return Collection<int, AiFaq>
     */
    private function retrieveInMemory(array $embedding): Collection
    {
        $minimumSimilarity = (float) config('ai.faq.minimum_similarity', 0.35);

        return $this->eligibleVectorQuery()
            ->get(['id', 'key', 'category', 'question', 'answer', 'embedding'])
            ->map(function (AiFaq $faq) use ($embedding): AiFaq {
                $faq->setAttribute(
                    'similarity',
                    $this->cosineSimilarity($embedding, $faq->embedding ?? []),
                );

                return $faq;
            })
            ->filter(fn (AiFaq $faq): bool => $faq->similarity >= $minimumSimilarity)
            ->sortByDesc('similarity')
            ->take($this->topK())
            ->values();
    }

    /**
     * @return Collection<int, AiFaq>
     */
    private function lexicalFallback(string $query): Collection
    {
        $normalizedQuery = mb_strtolower(trim($query));
        $queryTokens = $this->tokens($normalizedQuery);

        if ($normalizedQuery === '' || $queryTokens === []) {
            return collect();
        }

        return $this->baseQuery()
            ->get(['id', 'key', 'category', 'question', 'answer', 'aliases_en', 'aliases_km'])
            ->map(function (AiFaq $faq) use ($normalizedQuery, $queryTokens): AiFaq {
                $searchable = mb_strtolower(implode(' ', [
                    $faq->question,
                    ...($faq->aliases_en ?? []),
                    ...($faq->aliases_km ?? []),
                ]));
                $documentTokens = $this->tokens($searchable);
                $matchingTokens = array_intersect($queryTokens, $documentTokens);
                $coverage = count($matchingTokens) / max(count($queryTokens), 1);
                $similarity = str_contains($searchable, $normalizedQuery)
                    ? 1.0
                    : $coverage * 0.7;

                $faq->setAttribute('similarity', $similarity);

                return $faq;
            })
            ->filter(fn (AiFaq $faq): bool => $faq->similarity >= 0.5)
            ->sortByDesc('similarity')
            ->take($this->topK())
            ->values();
    }

    /**
     * @return Builder<AiFaq>
     */
    private function baseQuery(): Builder
    {
        return AiFaq::query()
            ->where('is_active', true);
    }

    /**
     * @return Builder<AiFaq>
     */
    private function eligibleVectorQuery(): Builder
    {
        return $this->baseQuery()
            ->whereNotNull('embedding')
            ->where('embedding_model', config('services.google_generative_ai.embedding_model'))
            ->whereColumn('embedding_content_hash', 'content_hash');
    }

    /**
     * @param  array<int, float>  $left
     * @param  array<int, float>  $right
     */
    private function cosineSimilarity(array $left, array $right): float
    {
        if ($left === [] || count($left) !== count($right)) {
            return -1.0;
        }

        $dotProduct = 0.0;
        $leftMagnitude = 0.0;
        $rightMagnitude = 0.0;

        foreach ($left as $index => $leftValue) {
            $rightValue = (float) $right[$index];
            $dotProduct += $leftValue * $rightValue;
            $leftMagnitude += $leftValue ** 2;
            $rightMagnitude += $rightValue ** 2;
        }

        if ($leftMagnitude === 0.0 || $rightMagnitude === 0.0) {
            return -1.0;
        }

        return $dotProduct / (sqrt($leftMagnitude) * sqrt($rightMagnitude));
    }

    /**
     * @return array<int, string>
     */
    private function tokens(string $value): array
    {
        preg_match_all('/[\p{L}\p{N}]+/u', $value, $matches);

        return array_values(array_unique($matches[0] ?? []));
    }

    private function topK(): int
    {
        return max(1, (int) config('ai.faq.top_k', 6));
    }

    private function usesPostgres(): bool
    {
        return AiFaq::query()->getConnection()->getDriverName() === 'pgsql';
    }
}
