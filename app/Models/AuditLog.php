<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AuditLog extends Model
{
    protected $table = 'audit_logs';
    protected $primaryKey = 'audit_id';
    public $timestamps = false;

    protected $fillable = [
        'user_id',
        'action',
        'description',
        'old_values',
        'new_values',
        'ip_address',
        'user_agent',
    ];

    protected $casts = [
        'new_values' => 'array',
        'old_values' => 'array',
    ];

    /** Flatten new_values into "Label: value · Label: value" (max 120 chars per value). */
    public function detailsText(): string
    {
        $data = $this->new_values;

        if (!is_array($data) || $data === []) {
            return '';
        }

        $parts = [];

        foreach ($data as $key => $value) {
            $text = self::stringify($value);

            if ($text === '') {
                continue;
            }

            $label = ucfirst(str_replace('_', ' ', (string) $key));
            $parts[] = $label . ': ' . mb_substr($text, 0, 120);
        }

        return implode(' · ', $parts);
    }

    private static function stringify(mixed $value): string
    {
        if (is_array($value)) {
            $items = [];

            foreach ($value as $key => $item) {
                $text = self::stringify($item);

                if ($text === '') {
                    continue;
                }

                $items[] = is_string($key) ? "$key = $text" : $text;
            }

            return implode(', ', $items);
        }

        if (is_bool($value)) {
            return $value ? 'yes' : 'no';
        }

        return (string) $value;
    }
}