<?php

return [
    'faq' => [
        'embedding_dimensions' => 768,
        'top_k' => (int) env('AI_FAQ_TOP_K', 6),
        'minimum_similarity' => (float) env('AI_FAQ_MINIMUM_SIMILARITY', 0.35),
    ],
];
