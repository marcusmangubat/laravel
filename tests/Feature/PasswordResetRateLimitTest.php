<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;

test('password reset actions use separate rate-limit buckets', function () {
    $limiter = RateLimiter::limiter('password-reset');
    $server = ['REMOTE_ADDR' => '127.0.0.1'];

    $requestLimit = $limiter(Request::create(
        '/password/reset',
        'POST',
        ['action' => 'request'],
        server: $server,
    ));
    $verifyLimit = $limiter(Request::create(
        '/password/reset',
        'POST',
        ['action' => 'verify'],
        server: $server,
    ));

    expect($requestLimit->key)->not->toBe($verifyLimit->key)
        ->and($verifyLimit->maxAttempts)->toBeGreaterThan($requestLimit->maxAttempts);
});
