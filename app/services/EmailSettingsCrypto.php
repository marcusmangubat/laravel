<?php

namespace App\Services;

use RuntimeException;

class EmailSettingsCrypto
{
    private function key(): string
    {
        $encoded = config('services.email_settings.key');

        if (! is_string($encoded) || $encoded === '') {
            throw new RuntimeException('Email settings encryption key is not configured.');
        }

        $key = base64_decode($encoded, true);

        if ($key === false || strlen($key) !== 32) {
            throw new RuntimeException('Email settings encryption key must decode to exactly 32 bytes.');
        }

        return $key;
    }

    // Compatible with the old PHP encrypt_string() format: base64(12-byte IV + 16-byte tag + ciphertext).
    public function encrypt(string $plaintext): string
    {
        if ($plaintext === '') {
            return '';
        }

        $iv = random_bytes(12);
        $tag = '';

        $ciphertext = openssl_encrypt(
            $plaintext,
            'aes-256-gcm',
            $this->key(),
            OPENSSL_RAW_DATA,
            $iv,
            $tag,
            '',
            16
        );

        if ($ciphertext === false) {
            throw new RuntimeException('SMTP password encryption failed.');
        }

        return base64_encode($iv . $tag . $ciphertext);
    }

    public function decrypt(?string $payload): string
    {
        if ($payload === null || $payload === '') {
            return '';
        }

        $data = base64_decode($payload, true);

        if ($data === false || strlen($data) < 28) {
            return '';
        }

        $plaintext = openssl_decrypt(
            substr($data, 28),
            'aes-256-gcm',
            $this->key(),
            OPENSSL_RAW_DATA,
            substr($data, 0, 12),
            substr($data, 12, 16),
            ''
        );

        return $plaintext === false ? '' : $plaintext;
    }
}
