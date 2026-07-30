<?php

namespace App\Console\Commands;

use App\Services\Ai\FaqCorpusImporter;
use App\Services\Ai\FaqEmbeddingArtifact;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

#[Signature('ai:faq-sync
    {--without-embeddings : Import the corpus without loading the committed embedding artifact}')]
#[Description('Import the FAQ corpus and its committed embedding artifact')]
class SyncAiFaqCorpus extends Command
{
    public function handle(
        FaqCorpusImporter $importer,
        FaqEmbeddingArtifact $embeddingArtifact,
    ): int {
        [$result, $embeddingResult] = DB::transaction(function () use ($importer, $embeddingArtifact): array {
            $result = $importer->import();
            $embeddingResult = $this->option('without-embeddings')
                ? null
                : $embeddingArtifact->importIntoDatabase();

            return [$result, $embeddingResult];
        });

        $this->components->info(
            "Imported {$result['imported']} FAQ records; "
            ."{$result['changed']} changed and {$result['deactivated']} deactivated."
        );

        if ($this->option('without-embeddings')) {
            return self::SUCCESS;
        }

        $this->components->info(
            "Imported {$embeddingResult['imported']} precomputed FAQ embeddings."
        );

        return self::SUCCESS;
    }
}
