<?php

namespace Database\Seeders;

use App\Services\Ai\FaqCorpusImporter;
use App\Services\Ai\FaqEmbeddingArtifact;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class AiFaqSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(
        FaqCorpusImporter $corpusImporter,
        FaqEmbeddingArtifact $embeddingArtifact,
    ): void {
        DB::transaction(function () use ($corpusImporter, $embeddingArtifact): void {
            $corpusImporter->import();
            $embeddingArtifact->importIntoDatabase();
        });
    }
}
