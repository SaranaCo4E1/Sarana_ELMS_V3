<?php

namespace App\Services\Ai;

use App\Models\AiFaq;
use Illuminate\Support\Facades\File;
use JsonException;
use RuntimeException;
use SplFileInfo;

class FaqCorpusImporter
{
    public function __construct(private FaqEmbeddingContent $embeddingContent) {}

    /**
     * @return array{imported: int, changed: int, deactivated: int}
     *
     * @throws JsonException
     */
    public function import(?string $directory = null): array
    {
        $directory ??= database_path('data/ai/rag_faq');

        if (! File::isDirectory($directory)) {
            throw new RuntimeException("FAQ corpus directory does not exist: {$directory}");
        }

        $imported = 0;
        $changed = 0;
        $keys = [];
        $files = collect(File::files($directory))
            ->filter(fn (SplFileInfo $file): bool => $file->getExtension() === 'jsonl')
            ->sortBy(fn (SplFileInfo $file): string => $file->getFilename());

        foreach ($files as $file) {
            foreach (File::lines($file->getPathname()) as $lineNumber => $line) {
                $line = trim($line);

                if ($line === '') {
                    continue;
                }

                $record = json_decode($line, true, flags: JSON_THROW_ON_ERROR);
                $this->validateRecord($record, $file->getFilename(), $lineNumber + 1);

                if (in_array($record['key'], $keys, true)) {
                    throw new RuntimeException(
                        "Duplicate FAQ key {$record['key']} at {$file->getFilename()}:".($lineNumber + 1)
                    );
                }

                $aliasesEn = array_values($record['aliases_en']);
                $aliasesKm = array_values($record['aliases_km']);
                $contentHash = $this->embeddingContent->hashFromValues(
                    $record['question_en'],
                    $record['answer_en'],
                    $record['category'],
                    $aliasesEn,
                    $aliasesKm,
                );
                $faq = AiFaq::query()->firstOrNew(['key' => $record['key']]);
                $contentChanged = $faq->exists && $faq->content_hash !== $contentHash;

                $faq->fill([
                    'category' => $record['category'],
                    'question' => $record['question_en'],
                    'answer' => $record['answer_en'],
                    'aliases_en' => $aliasesEn,
                    'aliases_km' => $aliasesKm,
                    'content_hash' => $contentHash,
                    'is_active' => (bool) $record['is_active'],
                ]);

                if ($contentChanged) {
                    $faq->forceFill([
                        'embedding' => null,
                        'embedding_model' => null,
                        'embedding_content_hash' => null,
                        'embedded_at' => null,
                    ]);
                    $changed++;
                }

                $faq->save();
                $keys[] = $record['key'];
                $imported++;
            }
        }

        $deactivated = AiFaq::query()
            ->whereNotNull('key')
            ->whereNotIn('key', $keys)
            ->update(['is_active' => false]);

        return compact('imported', 'changed', 'deactivated');
    }

    private function validateRecord(mixed $record, string $file, int $line): void
    {
        $isValid = is_array($record)
            && is_string($record['key'] ?? null)
            && trim($record['key']) !== ''
            && is_string($record['category'] ?? null)
            && trim($record['category']) !== ''
            && is_string($record['question_en'] ?? null)
            && trim($record['question_en']) !== ''
            && is_string($record['answer_en'] ?? null)
            && trim($record['answer_en']) !== ''
            && is_array($record['aliases_en'] ?? null)
            && is_array($record['aliases_km'] ?? null)
            && count(array_filter($record['aliases_en'], is_string(...))) === count($record['aliases_en'])
            && count(array_filter($record['aliases_km'], is_string(...))) === count($record['aliases_km'])
            && is_bool($record['is_active'] ?? null);

        if (! $isValid) {
            throw new RuntimeException("Invalid FAQ record at {$file}:{$line}");
        }
    }
}
