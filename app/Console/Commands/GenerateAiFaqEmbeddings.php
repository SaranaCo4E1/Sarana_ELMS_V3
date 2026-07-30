<?php

namespace App\Console\Commands;

use App\Contracts\Ai\EmbeddingClient;
use App\Services\Ai\FaqCorpusImporter;
use App\Services\Ai\FaqEmbeddingArtifact;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('ai:faq-embeddings
    {--force : Regenerate every embedding through Gemini instead of reusing current vectors}')]
#[Description('Generate the committed FAQ embedding artifact and import it into the database')]
class GenerateAiFaqEmbeddings extends Command
{
    public function handle(
        FaqCorpusImporter $corpusImporter,
        FaqEmbeddingArtifact $embeddingArtifact,
        EmbeddingClient $embeddingClient,
    ): int {
        $import = $corpusImporter->import();
        $this->components->info(
            "Imported {$import['imported']} FAQ records; "
            ."{$import['changed']} changed and {$import['deactivated']} deactivated."
        );

        $progressBar = $this->output->createProgressBar($import['imported']);
        $progressBar->start();

        $result = $embeddingArtifact->generate(
            embeddingClient: $embeddingClient,
            force: (bool) $this->option('force'),
            progress: function () use ($progressBar): void {
                $progressBar->advance();
            },
        );

        $progressBar->finish();
        $this->newLine(2);
        $embeddingArtifact->importIntoDatabase();

        $this->components->info(
            "Wrote {$result['total']} embeddings: {$result['generated']} generated, "
            ."{$result['reused_database']} reused from the database, and "
            ."{$result['reused_artifact']} reused from the artifact."
        );

        return self::SUCCESS;
    }
}
