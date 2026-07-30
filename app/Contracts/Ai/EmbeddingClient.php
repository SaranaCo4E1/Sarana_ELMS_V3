<?php

namespace App\Contracts\Ai;

interface EmbeddingClient
{
    /**
     * @return array<int, float>
     */
    public function embedDocument(string $title, string $text): array;

    /**
     * @return array<int, float>
     */
    public function embedQuery(string $query): array;
}
