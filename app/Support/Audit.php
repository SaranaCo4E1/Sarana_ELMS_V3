<?php

namespace App\Support;

use App\Models\AuditLog;
use BackedEnum;
use DateTimeInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class Audit
{
    public static function record(Request $request, string $action, ?Model $subject = null, array $metadata = []): void
    {
        if (! isset($metadata['changes']) && isset($metadata['before'], $metadata['after'])
            && is_array($metadata['before']) && is_array($metadata['after'])) {
            $metadata['changes'] = self::changes($metadata['before'], $metadata['after']);
            $metadata['changed_fields'] = array_column($metadata['changes'], 'field');
            unset($metadata['before'], $metadata['after']);
        }

        $metadata['request'] ??= [
            'method' => $request->method(),
            'route' => $request->route()?->getName(),
            'user_agent' => Str::limit((string) $request->userAgent(), 255, ''),
        ];

        AuditLog::query()->create([
            'actor_id' => $request->user()?->id,
            'action' => $action,
            'subject_type' => $subject ? $subject::class : null,
            'subject_id' => $subject?->getKey(),
            'metadata' => self::sanitize($metadata),
            'ip_address' => $request->ip(),
        ]);
    }

    public static function recordChange(
        Request $request,
        string $action,
        Model $subject,
        array $before,
        array $after,
        array $metadata = []
    ): void {
        $changes = self::changes($before, $after);

        self::record($request, $action, $subject, [
            ...$metadata,
            'changes' => $changes,
            'changed_fields' => array_column($changes, 'field'),
        ]);
    }

    /**
     * @return array<int, array{field: string, label: string, from: mixed, to: mixed}>
     */
    public static function changes(array $before, array $after): array
    {
        $ignored = ['created_at', 'updated_at', 'deleted_at'];
        $keys = array_unique([...array_keys($before), ...array_keys($after)]);
        $changes = [];

        foreach ($keys as $key) {
            if (in_array($key, $ignored, true) || self::isSecretKey((string) $key)) {
                continue;
            }

            $from = self::normalizeValue($before[$key] ?? null, (string) $key);
            $to = self::normalizeValue($after[$key] ?? null, (string) $key);

            if ($from === $to) {
                continue;
            }

            $changes[] = [
                'field' => (string) $key,
                'label' => Str::of((string) $key)->replace('_id', '')->headline()->toString(),
                'from' => $from,
                'to' => $to,
            ];
        }

        return $changes;
    }

    private static function sanitize(mixed $value, ?string $key = null): mixed
    {
        if ($key !== null && self::isSecretKey($key)) {
            return '[REDACTED]';
        }

        if (is_array($value)) {
            $sanitized = [];
            foreach ($value as $nestedKey => $nestedValue) {
                $sanitized[$nestedKey] = self::sanitize($nestedValue, is_string($nestedKey) ? $nestedKey : null);
            }

            return $sanitized;
        }

        return self::normalizeValue($value, $key);
    }

    private static function normalizeValue(mixed $value, ?string $key = null): mixed
    {
        if ($key !== null && self::isSecretKey($key)) {
            return '[REDACTED]';
        }

        if ($value instanceof BackedEnum) {
            $value = $value->value;
        } elseif ($value instanceof DateTimeInterface) {
            $value = $value->format(DateTimeInterface::ATOM);
        } elseif (is_object($value) && method_exists($value, '__toString')) {
            $value = (string) $value;
        }

        if ($key !== null && in_array($key, ['national_id_number', 'bank_account_number'], true)) {
            if (! filled($value)) {
                return $value;
            }

            $plain = (string) $value;

            return str_repeat('•', max(4, mb_strlen($plain) - 4)).mb_substr($plain, -4);
        }

        return $value;
    }

    private static function isSecretKey(string $key): bool
    {
        return (bool) preg_match('/(^|_)(password|password_confirmation|current_password|token|secret|two_factor_code|remember_token)($|_)/i', $key);
    }
}
