<?php

namespace App\Services\Ai;

use App\Contracts\Ai\EmbeddingClient;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;
use RuntimeException;
use Throwable;

class GeminiEmbeddingClient implements EmbeddingClient
{
    public function embedDocument(string $title, string $text): array
    {
        return $this->embed("title: {$title} | text: {$text}");
    }

    public function embedQuery(string $query): array
    {
        return $this->embed("task: question answering | query: {$query}");
    }

    /**
     * @return array<int, float>
     */
    private function embed(string $text): array
    {
        $model = (string) config('services.google_generative_ai.embedding_model');
        $dimensions = (int) config('ai.faq.embedding_dimensions', 768);

        if (trim($model) === '') {
            throw new RuntimeException('The Gemini embedding model is not configured.');
        }

        $response = $this->request()
            ->post(sprintf(
                'https://generativelanguage.googleapis.com/v1beta/models/%s:embedContent',
                rawurlencode($model),
            ), [
                'content' => [
                    'parts' => [['text' => $text]],
                ],
                'output_dimensionality' => $dimensions,
            ])
            ->throw();

        $values = $response->json('embedding.values')
            ?? $response->json('embeddings.0.values');

        if (! is_array($values) || count($values) !== $dimensions) {
            throw new RuntimeException("Gemini returned an invalid {$dimensions}-dimension embedding.");
        }

        foreach ($values as $value) {
            if (! is_int($value) && ! is_float($value) && ! is_numeric($value)) {
                throw new RuntimeException('Gemini returned a non-numeric embedding value.');
            }
        }

        $embedding = array_map(
            fn (mixed $value): float => (float) $value,
            array_values($values),
        );

        foreach ($embedding as $value) {
            if (! is_finite($value)) {
                throw new RuntimeException('Gemini returned a non-finite embedding value.');
            }
        }

        return $embedding;
    }

    private function request(): PendingRequest
    {
        $apiKey = config('services.google_generative_ai.key');

        if (! is_string($apiKey) || trim($apiKey) === '') {
            throw new RuntimeException('Google Generative AI is not configured.');
        }

        $request = Http::asJson()
            ->acceptJson()
            ->withHeaders(['x-goog-api-key' => $apiKey])
            ->connectTimeout(5)
            ->timeout(30)
            ->retry(
                [200, 500, 1000],
                when: function (Throwable $exception): bool {
                    if ($exception instanceof ConnectionException) {
                        return true;
                    }

                    return $exception instanceof RequestException
                        && ($exception->response->status() === 429
                            || $exception->response->serverError());
                },
            );
        $proxy = config('services.google_generative_ai.proxy');

        if (is_string($proxy) && trim($proxy) !== '') {
            $request->withOptions(['proxy' => trim($proxy)]);
        }

        return $request;
    }
}
