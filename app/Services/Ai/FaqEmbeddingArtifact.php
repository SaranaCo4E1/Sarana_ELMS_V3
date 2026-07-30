<?php

namespace App\Services\Ai;

use App\Contracts\Ai\EmbeddingClient;
use App\Models\AiFaq;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use JsonException;
use RuntimeException;

class FaqEmbeddingArtifact
{
    public const INPUT_SCHEMA = 'faq-document-v1';

    public function __construct(private FaqEmbeddingContent $embeddingContent) {}

    /**
     * @return array{imported: int}
     *
     * @throws JsonException
     */
    public function importIntoDatabase(?string $path = null): array
    {
        $records = $this->records($path);
        $faqs = $this->activeFaqs();
        $missingKeys = $faqs->keys()->diff($records->keys());
        $unknownKeys = $records->keys()->diff($faqs->keys());

        if ($missingKeys->isNotEmpty() || $unknownKeys->isNotEmpty()) {
            throw new RuntimeException(implode(' ', array_filter([
                $missingKeys->isNotEmpty()
                    ? 'Missing FAQ embeddings: '.$missingKeys->implode(', ').'.'
                    : null,
                $unknownKeys->isNotEmpty()
                    ? 'Unknown FAQ embeddings: '.$unknownKeys->implode(', ').'.'
                    : null,
            ])));
        }

        DB::transaction(function () use ($faqs, $records): void {
            foreach ($faqs as $key => $faq) {
                $record = $records->get($key);
                $this->validateForFaq($record, $faq);

                $faq->forceFill([
                    'embedding' => $record['embedding'],
                    'embedding_model' => $record['embedding_model'],
                    'embedding_content_hash' => $record['content_hash'],
                    'embedded_at' => now(),
                ])->saveQuietly();
            }
        });

        return ['imported' => $faqs->count()];
    }

    /**
     * @param  null|callable(int, int, string, string): void  $progress
     * @return array{total: int, generated: int, reused_database: int, reused_artifact: int}
     *
     * @throws JsonException
     */
    public function generate(
        EmbeddingClient $embeddingClient,
        ?string $path = null,
        bool $force = false,
        ?callable $progress = null,
    ): array {
        $path = $this->path($path);
        $existingRecords = File::isFile($path)
            ? $this->records($path)
            : collect();
        $faqs = $this->activeFaqs()->sortKeys();
        $model = $this->model();
        $dimensions = $this->dimensions();
        $records = [];
        $generated = 0;
        $reusedDatabase = 0;
        $reusedArtifact = 0;
        $current = 0;

        foreach ($faqs as $key => $faq) {
            $source = 'generated';
            $embedding = null;

            if (! $force && $this->faqHasCurrentEmbedding($faq)) {
                $embedding = $faq->embedding;
                $source = 'database';
                $reusedDatabase++;
            } elseif (! $force) {
                $existingRecord = $existingRecords->get($key);

                if ($this->recordMatchesFaq($existingRecord, $faq)) {
                    $embedding = $existingRecord['embedding'];
                    $source = 'artifact';
                    $reusedArtifact++;
                }
            }

            if ($embedding === null) {
                $embedding = $embeddingClient->embedDocument(
                    $this->embeddingContent->title($faq),
                    $this->embeddingContent->text($faq),
                );
                $generated++;
            }

            $embedding = $this->validateEmbedding($embedding, $dimensions, $key);
            $records[] = [
                'key' => $key,
                'content_hash' => $faq->content_hash,
                'embedding_model' => $model,
                'dimensions' => $dimensions,
                'input_schema' => self::INPUT_SCHEMA,
                'embedding' => $embedding,
            ];

            $current++;
            $progress?->__invoke($current, $faqs->count(), $key, $source);
        }

        $contents = collect($records)
            ->map(fn (array $record): string => json_encode(
                $record,
                JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE,
            ))
            ->implode("\n")."\n";

        File::ensureDirectoryExists(dirname($path));
        File::replace($path, $contents);

        return [
            'total' => count($records),
            'generated' => $generated,
            'reused_database' => $reusedDatabase,
            'reused_artifact' => $reusedArtifact,
        ];
    }

    /**
     * @return Collection<string, array<string, mixed>>
     *
     * @throws JsonException
     */
    private function records(?string $path = null): Collection
    {
        $path = $this->path($path);

        if (! File::isFile($path)) {
            throw new RuntimeException("FAQ embedding artifact does not exist: {$path}");
        }

        $records = collect();

        foreach (File::lines($path) as $lineNumber => $line) {
            $line = trim($line);

            if ($line === '') {
                continue;
            }

            $record = json_decode($line, true, flags: JSON_THROW_ON_ERROR);
            $key = is_array($record) ? ($record['key'] ?? null) : null;

            if (! is_string($key) || trim($key) === '') {
                throw new RuntimeException('Invalid FAQ embedding record at line '.($lineNumber + 1).'.');
            }

            if ($records->has($key)) {
                throw new RuntimeException("Duplicate FAQ embedding key: {$key}.");
            }

            $records->put($key, $record);
        }

        return $records;
    }

    /**
     * @return Collection<string, AiFaq>
     */
    private function activeFaqs(): Collection
    {
        return AiFaq::query()
            ->where('is_active', true)
            ->whereNotNull('key')
            ->get()
            ->keyBy('key');
    }

    /**
     * @param  array<string, mixed>  $record
     */
    private function validateForFaq(array $record, AiFaq $faq): void
    {
        if (! $this->recordMatchesFaq($record, $faq)) {
            throw new RuntimeException(
                "FAQ embedding artifact is stale or invalid for key {$faq->key}."
            );
        }
    }

    private function faqHasCurrentEmbedding(AiFaq $faq): bool
    {
        return $faq->embedding_model === $this->model()
            && $faq->embedding_content_hash === $faq->content_hash
            && $this->isValidEmbedding($faq->embedding, $this->dimensions());
    }

    private function recordMatchesFaq(mixed $record, AiFaq $faq): bool
    {
        return is_array($record)
            && ($record['key'] ?? null) === $faq->key
            && ($record['content_hash'] ?? null) === $faq->content_hash
            && ($record['embedding_model'] ?? null) === $this->model()
            && ($record['dimensions'] ?? null) === $this->dimensions()
            && ($record['input_schema'] ?? null) === self::INPUT_SCHEMA
            && $this->isValidEmbedding($record['embedding'] ?? null, $this->dimensions());
    }

    /**
     * @return array<int, float>
     */
    private function validateEmbedding(mixed $embedding, int $dimensions, string $key): array
    {
        if (! $this->isValidEmbedding($embedding, $dimensions)) {
            throw new RuntimeException(
                "FAQ embedding for {$key} must contain {$dimensions} finite numeric values."
            );
        }

        return array_map(
            fn (mixed $value): float => (float) $value,
            array_values($embedding),
        );
    }

    private function isValidEmbedding(mixed $embedding, int $dimensions): bool
    {
        if (! is_array($embedding) || count($embedding) !== $dimensions) {
            return false;
        }

        foreach ($embedding as $value) {
            if ((! is_int($value) && ! is_float($value) && ! is_numeric($value))
                || ! is_finite((float) $value)) {
                return false;
            }
        }

        return true;
    }

    private function path(?string $path): string
    {
        return $path ?? database_path('data/ai/rag_faq_embeddings.jsonl');
    }

    private function model(): string
    {
        return (string) config('services.google_generative_ai.embedding_model');
    }

    private function dimensions(): int
    {
        return (int) config('ai.faq.embedding_dimensions');
    }
}
