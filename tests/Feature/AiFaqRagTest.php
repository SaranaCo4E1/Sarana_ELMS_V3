<?php

namespace Tests\Feature;

use App\Contracts\Ai\EmbeddingClient;
use App\Jobs\GenerateAiFaqEmbedding;
use App\Models\AiChatLog;
use App\Models\AiFaq;
use App\Models\User;
use App\Services\Ai\FaqCorpusImporter;
use App\Services\Ai\FaqEmbeddingArtifact;
use App\Services\Ai\FaqEmbeddingContent;
use App\Services\Ai\FaqRetriever;
use App\Services\Ai\GeminiEmbeddingClient;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;
use RuntimeException;
use Tests\TestCase;

class AiFaqRagTest extends TestCase
{
    use RefreshDatabase;

    public function test_corpus_import_is_complete_and_idempotent(): void
    {
        $importer = app(FaqCorpusImporter::class);

        $firstImport = $importer->import();
        $secondImport = $importer->import();

        $this->assertSame(513, $firstImport['imported']);
        $this->assertSame(513, $secondImport['imported']);
        $this->assertSame(513, AiFaq::query()->whereNotNull('key')->count());
        $this->assertSame(15, AiFaq::query()->whereNotNull('key')->distinct()->count('category'));
        $this->assertTrue(
            AiFaq::query()
                ->whereNotNull('aliases_km')
                ->get()
                ->contains(fn (AiFaq $faq): bool => ($faq->aliases_km ?? []) !== [])
        );
    }

    public function test_gemini_embedding_client_sends_retrieval_query_and_validates_dimensions(): void
    {
        config([
            'services.google_generative_ai.key' => 'test-key',
            'services.google_generative_ai.embedding_model' => 'gemini-embedding-2',
            'services.google_generative_ai.proxy' => null,
            'ai.faq.embedding_dimensions' => 3,
        ]);
        Http::preventStrayRequests();
        Http::fake([
            'generativelanguage.googleapis.com/*' => Http::response([
                'embedding' => ['values' => [0.25, 0.5, 0.75]],
            ]),
        ]);

        $embedding = app(GeminiEmbeddingClient::class)->embedQuery('How much leave remains?');

        $this->assertSame([0.25, 0.5, 0.75], $embedding);
        Http::assertSent(function (Request $request): bool {
            return $request->hasHeader('x-goog-api-key', 'test-key')
                && ! str_contains($request->url(), 'test-key')
                && $request['output_dimensionality'] === 3
                && str_contains(
                    $request['content']['parts'][0]['text'],
                    'task: question answering | query: How much leave remains?',
                );
        });
    }

    public function test_retriever_returns_relevant_faqs_from_every_category_in_similarity_order(): void
    {
        config([
            'services.google_generative_ai.embedding_model' => 'gemini-embedding-2',
            'ai.faq.minimum_similarity' => 0.5,
            'ai.faq.top_k' => 3,
        ]);
        $this->app->instance(EmbeddingClient::class, new FakeEmbeddingClient([1.0, 0.0, 0.0]));

        $this->createEmbeddedFaq('best', [1.0, 0.0, 0.0]);
        $this->createEmbeddedFaq('second', [0.8, 0.6, 0.0]);
        $this->createEmbeddedFaq('below-threshold', [0.0, 1.0, 0.0]);
        $this->createEmbeddedFaq('inactive', [1.0, 0.0, 0.0], isActive: false);
        $this->createEmbeddedFaq('wrong-model', [1.0, 0.0, 0.0], model: 'old-model');
        $this->createEmbeddedFaq(
            'company_identity_and_history.company_founders',
            [0.9, 0.435889894, 0.0],
            category: 'company_identity_and_history',
        );

        $results = app(FaqRetriever::class)->retrieve('remaining leave');

        $this->assertSame(
            ['best', 'company_identity_and_history.company_founders', 'second'],
            $results->pluck('key')->all(),
        );
        $this->assertEqualsWithDelta(1.0, $results->first()->similarity, 0.0001);
        $this->assertEqualsWithDelta(0.9, $results->get(1)->similarity, 0.0001);
        $this->assertEqualsWithDelta(0.8, $results->last()->similarity, 0.0001);
    }

    public function test_embedding_job_does_not_overwrite_changed_content(): void
    {
        config(['services.google_generative_ai.embedding_model' => 'gemini-embedding-2']);
        $content = app(FaqEmbeddingContent::class);
        $faq = AiFaq::query()->create([
            'key' => 'leave.changed',
            'category' => 'leave_policies_and_balances',
            'question' => 'What is my balance?',
            'answer' => 'Check the balance page.',
            'aliases_en' => [],
            'aliases_km' => [],
            'content_hash' => 'new-hash',
            'is_active' => true,
        ]);
        $client = new FakeEmbeddingClient([1.0, 0.0, 0.0]);

        (new GenerateAiFaqEmbedding($faq->id, 'old-hash'))->handle($client, $content);

        $this->assertNull($faq->fresh()->embedding);

        $faq->update(['content_hash' => $content->hash($faq)]);
        (new GenerateAiFaqEmbedding($faq->id, $faq->fresh()->content_hash))->handle($client, $content);

        $embeddedFaq = $faq->fresh();
        $this->assertSame([1, 0, 0], $embeddedFaq->embedding);
        $this->assertSame('gemini-embedding-2', $embeddedFaq->embedding_model);
        $this->assertNotNull($embeddedFaq->embedded_at);
    }

    public function test_sync_command_imports_precomputed_embeddings_without_an_api_key(): void
    {
        config(['services.google_generative_ai.key' => null]);
        Http::preventStrayRequests();

        $this->artisan('ai:faq-sync')->assertSuccessful();

        $this->assertSame(513, AiFaq::query()->whereNotNull('key')->count());
        $this->assertSame(513, AiFaq::query()->whereNotNull('embedding')->count());
        $this->assertSame(
            513,
            AiFaq::query()
                ->whereColumn('embedding_content_hash', 'content_hash')
                ->count(),
        );
    }

    public function test_embedding_artifact_generation_reuses_current_vectors_and_only_regenerates_changed_content(): void
    {
        config([
            'services.google_generative_ai.embedding_model' => 'gemini-embedding-2',
            'ai.faq.embedding_dimensions' => 3,
        ]);
        $faq = $this->createEmbeddedFaq('leave.balance', [1.0, 0.0, 0.0]);
        $client = new FakeEmbeddingClient([0.0, 1.0, 0.0]);
        $path = tempnam(sys_get_temp_dir(), 'faq-embeddings-');

        try {
            $firstResult = app(FaqEmbeddingArtifact::class)->generate($client, $path);

            $this->assertSame(0, $firstResult['generated']);
            $this->assertSame(1, $firstResult['reused_database']);
            $this->assertSame(0, $client->documentCalls);

            $faq->forceFill([
                'embedding' => null,
                'embedding_model' => null,
                'embedding_content_hash' => null,
                'embedded_at' => null,
            ])->save();

            $secondResult = app(FaqEmbeddingArtifact::class)->generate($client, $path);

            $this->assertSame(0, $secondResult['generated']);
            $this->assertSame(1, $secondResult['reused_artifact']);
            $this->assertSame(0, $client->documentCalls);

            $faq->update(['question' => 'Where can I find my current leave balance?']);
            $faq->update([
                'content_hash' => app(FaqEmbeddingContent::class)->hash($faq),
            ]);

            $thirdResult = app(FaqEmbeddingArtifact::class)->generate($client, $path);

            $this->assertSame(1, $thirdResult['generated']);
            $this->assertSame(1, $client->documentCalls);
        } finally {
            File::delete($path);
        }
    }

    public function test_embedding_artifact_import_rejects_stale_content(): void
    {
        config([
            'services.google_generative_ai.embedding_model' => 'gemini-embedding-2',
            'ai.faq.embedding_dimensions' => 3,
        ]);
        $this->createEmbeddedFaq('leave.balance', [1.0, 0.0, 0.0]);
        $path = tempnam(sys_get_temp_dir(), 'faq-embeddings-');
        File::put($path, json_encode([
            'key' => 'leave.balance',
            'content_hash' => 'stale-hash',
            'embedding_model' => 'gemini-embedding-2',
            'dimensions' => 3,
            'input_schema' => FaqEmbeddingArtifact::INPUT_SCHEMA,
            'embedding' => [1.0, 0.0, 0.0],
        ], JSON_THROW_ON_ERROR)."\n");

        try {
            $this->expectException(RuntimeException::class);
            $this->expectExceptionMessage('stale or invalid for key leave.balance');

            app(FaqEmbeddingArtifact::class)->importIntoDatabase($path);
        } finally {
            File::delete($path);
        }
    }

    public function test_ai_assistant_page_no_longer_exposes_faqs(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->get(route('ai-assistant.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('AiAssistant')
                ->missing('faqs')
                ->has('recentChats')
            );
    }

    public function test_legacy_ask_endpoint_uses_retrieval_and_logs_match_metadata(): void
    {
        $user = User::factory()->create();
        $faq = new AiFaq([
            'key' => 'leave.balance',
            'category' => 'leave_policies_and_balances',
            'question' => 'Where is my balance?',
            'answer' => 'Open the leave balance page.',
            'is_active' => true,
        ]);
        $faq->setAttribute('similarity', 0.91234);
        $this->mock(FaqRetriever::class)
            ->shouldReceive('retrieve')
            ->once()
            ->with('Where can I see my leave?')
            ->andReturn(collect([$faq]));

        $this->actingAs($user)
            ->postJson(route('ai-help.ask'), [
                'prompt' => 'Where can I see my leave?',
            ])
            ->assertOk()
            ->assertJson(['answer' => 'Open the leave balance page.']);

        $chatLog = AiChatLog::query()->sole();
        $this->assertSame('faq_rag', $chatLog->metadata['source']);
        $this->assertSame('leave.balance', $chatLog->metadata['rag']['matches'][0]['key']);
        $this->assertSame(0.9123, $chatLog->metadata['rag']['matches'][0]['similarity']);
    }

    public function test_configured_embedding_dimensions_match_the_database_column(): void
    {
        $this->assertSame(768, config('ai.faq.embedding_dimensions'));
    }

    /**
     * @param  array<int, float>  $embedding
     */
    private function createEmbeddedFaq(
        string $key,
        array $embedding,
        bool $isActive = true,
        string $model = 'gemini-embedding-2',
        string $category = 'leave_policies_and_balances',
    ): AiFaq {
        $faq = AiFaq::query()->create([
            'key' => $key,
            'category' => $category,
            'question' => "Question for {$key}",
            'answer' => "Answer for {$key}",
            'aliases_en' => [],
            'aliases_km' => [],
            'content_hash' => "hash-{$key}",
            'is_active' => $isActive,
        ]);

        $faq->forceFill([
            'embedding' => $embedding,
            'embedding_model' => $model,
            'embedding_content_hash' => "hash-{$key}",
            'embedded_at' => now(),
        ])->save();

        return $faq;
    }
}

class FakeEmbeddingClient implements EmbeddingClient
{
    public int $documentCalls = 0;

    /**
     * @param  array<int, float>  $embedding
     */
    public function __construct(private array $embedding) {}

    public function embedDocument(string $title, string $text): array
    {
        $this->documentCalls++;

        return $this->embedding;
    }

    public function embedQuery(string $query): array
    {
        return $this->embedding;
    }
}
