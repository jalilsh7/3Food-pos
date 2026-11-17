<?php
declare(strict_types=1);

/*
 * Copy this file to private/config.php and fill the values.
 * Keep private/ outside the web document root whenever possible.
 */
return [
    // Generate a random 64-character key; do not reuse the DB password.
    'app_key' => 'REPLACE_WITH_A_DIFFERENT_RANDOM_64_CHARACTER_KEY',
    'db' => [
        'host' => 'localhost',
        'port' => 3306,
        'database' => 'YOUR_DATABASE_NAME',
        'username' => 'YOUR_DATABASE_USER',
        'password' => 'CHANGE_THIS_DATABASE_PASSWORD',
        'charset' => 'utf8mb4',
    ],

    // Generate a random 64-character token for the one-time first-manager setup.
    // After setup, remove this value from config.php.
    'setup_token' => 'REPLACE_WITH_A_RANDOM_64_CHARACTER_TOKEN',

    // Optional: configure National Payamak credentials here in a later phase.
    // Never place SMS credentials in the browser or in a public JS bundle.
    'sms' => [
        'provider' => 'none',
        'username' => '',
        'password' => '',
        'sender' => '',
    ],

    'session' => [
        'name' => '3FOODPOSSESSID',
        'same_site' => 'Strict',
        'idle_timeout' => 28800,
    ],
];
