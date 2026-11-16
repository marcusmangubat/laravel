<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EmailAccount extends Model
{
    protected $table = 'email_accounts';
    protected $primaryKey = 'account_id';

    protected $fillable = [
        'label', 'email', 'smtp_host', 'smtp_port', 'smtp_encryption', 'smtp_pass',
        'daily_limit', 'sent_today', 'sent_date', 'total_sent', 'priority',
        'is_active', 'exhausted_until', 'last_error', 'last_used_at',
    ];

    protected $hidden = ['smtp_pass'];

    protected $casts = [
        'is_active'       => 'boolean',
        'sent_date'       => 'date',
        'exhausted_until' => 'datetime',
        'last_used_at'    => 'datetime',
    ];

    public function scopeAvailable($q)
    {
        $today = now()->toDateString();

        return $q->where('is_active', 1)
            ->where(fn ($w) => $w->whereNull('exhausted_until')->orWhere('exhausted_until', '<=', now()))
            ->where(fn ($w) => $w->whereNull('sent_date')
                ->orWhere('sent_date', '<', $today)
                ->orWhereColumn('sent_today', '<', 'daily_limit'))
            ->orderBy('priority');
    }

    public function sentTodayCount(): int
    {
        return $this->sent_date && $this->sent_date->toDateString() === now()->toDateString()
            ? (int) $this->sent_today : 0;
    }

    public function recordSent(int $recipients = 1): void
    {
        $this->forceFill([
            'sent_today'      => $this->sentTodayCount() + $recipients,
            'sent_date'       => now()->toDateString(),
            'total_sent'      => $this->total_sent + $recipients,
            'last_used_at'    => now(),
            'last_error'      => null,
            'exhausted_until' => null,
        ])->save();
    }

    public function markExhausted(string $error): void
    {
        $this->forceFill([
            'exhausted_until' => now()->addHours(24),
            'last_error'      => mb_substr($error, 0, 500),
        ])->save();
    }

    public function markFailed(string $error, int $minutes = 60): void
    {
        $this->forceFill([
            'exhausted_until' => now()->addMinutes($minutes),
            'last_error'      => mb_substr($error, 0, 500),
        ])->save();
    }
}