<?php

test('pending access requests are routed to the pending handler', function () {
    $route = app('router')->getRoutes()->getByName('admin.access-requests.pending');

    expect($route)->not->toBeNull()
        ->and($route->uri())->toBe('admin/access-requests/pending')
        ->and($route->getActionMethod())->toBe('pending');
});
