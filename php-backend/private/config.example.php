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

    // These are fallback defaults. Manage National Payamak credentials from the POS Settings page;
    // the server stores them separately in private/sms-config.php. Never expose them to the browser.
    'sms' => [
        'provider' => 'none',
        'username' => '',
        'password' => '',
        'sender' => '',
        // Inbox settings for GetMessages. Set inbox_location to the value
        // assigned by National Payamak for the receiving mailbox/line.
        'inbox_location' => null,
        'inbox_from' => '',
        'inbox_index' => '1',
        'inbox_count' => 50,
    ],

    'session' => [
        'name' => '3FOODPOSSESSID',
        'same_site' => 'Strict',
        'idle_timeout' => 28800,
    ],
];
