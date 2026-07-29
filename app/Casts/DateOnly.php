<?php

namespace App\Casts;

use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Contracts\Database\Eloquent\SerializesCastableAttributes;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Keeps SQL DATE values date-only on every database driver while exposing Carbon to models.
 */
class DateOnly implements CastsAttributes, SerializesCastableAttributes
{
    public function get(Model $model, string $key, mixed $value, array $attributes): ?Carbon
    {
        return $value === null ? null : Carbon::parse($value)->startOfDay();
    }

    public function set(Model $model, string $key, mixed $value, array $attributes): ?string
    {
        return $value === null ? null : Carbon::parse($value)->toDateString();
    }

    public function serialize(Model $model, string $key, mixed $value, array $attributes): ?string
    {
        return $value === null ? null : Carbon::parse($value)->toDateString();
    }
}
