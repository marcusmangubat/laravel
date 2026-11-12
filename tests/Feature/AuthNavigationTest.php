<?php

use App\Models\User;

test('authenticated users are redirected away from login', function () {
    $user = new User(['user_id' => 1, 'role' => 'admin']);

    $this->actingAs($user)
        ->get(route('login'))
        ->assertRedirect(route('dashboard'));
});

test('logout prevents access to the dashboard and redirects to login', function () {
    $user = new User(['user_id' => 1, 'role' => 'admin']);

    $this->actingAs($user)
        ->post(route('logout'))
        ->assertRedirect(route('login'));

    $this->get(route('admin.dashboard'))
        ->assertRedirect(route('login'));
});

test('authenticated pages are not cached by the browser', function () {
    $user = new User(['user_id' => 1, 'role' => 'admin']);

    $response = $this->actingAs($user)->get(route('dashboard'));

    expect($response->headers->get('Cache-Control'))
        ->toContain('no-store')
        ->toContain('no-cache');

    $response->assertHeader('Pragma', 'no-cache');
});
