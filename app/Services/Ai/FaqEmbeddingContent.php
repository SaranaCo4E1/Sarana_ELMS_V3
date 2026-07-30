<?php

namespace App\Services\Ai;

use App\Models\AiFaq;

class FaqEmbeddingContent
{
    public function title(AiFaq $faq): string
    {
        return $faq->question;
    }

    public function text(AiFaq $faq): string
    {
        return $this->fromValues(
            question: $faq->question,
            answer: $faq->answer,
            category: $faq->category,
            aliasesEn: $faq->aliases_en ?? [],
            aliasesKm: $faq->aliases_km ?? [],
        );
    }

    /**
     * @param  array<int, string>  $aliasesEn
     * @param  array<int, string>  $aliasesKm
     */
    public function fromValues(
        string $question,
        string $answer,
        ?string $category,
        array $aliasesEn,
        array $aliasesKm,
    ): string {
        return implode("\n", array_filter([
            $category ? "Category: {$category}" : null,
            "Question: {$question}",
            $aliasesEn !== [] ? "English alternatives:\n- ".implode("\n- ", $aliasesEn) : null,
            $aliasesKm !== [] ? "Khmer alternatives:\n- ".implode("\n- ", $aliasesKm) : null,
            "Answer: {$answer}",
        ]));
    }

    public function hash(AiFaq $faq): string
    {
        return hash('sha256', $this->text($faq));
    }

    /**
     * @param  array<int, string>  $aliasesEn
     * @param  array<int, string>  $aliasesKm
     */
    public function hashFromValues(
        string $question,
        string $answer,
        ?string $category,
        array $aliasesEn,
        array $aliasesKm,
    ): string {
        return hash('sha256', $this->fromValues(
            $question,
            $answer,
            $category,
            $aliasesEn,
            $aliasesKm,
        ));
    }
}
